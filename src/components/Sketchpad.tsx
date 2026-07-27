import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { trackClick, useCanvasClicks } from "@/lib/usage";
import {
  Volume2,
  VolumeX,
  Pencil,
  Hand,
  Undo2,
  Eraser,
  Waves,
  Palette,
  Box,
  Keyboard,
  Sparkles,
  Ear,
  Eye,
  Settings2,
} from "lucide-react";

type Point = { x: number; y: number };
type Stroke = { color: string; points: Point[] };

// Each color has a fixed tone so it can be identified by ear alone — the interval
// pattern repeats every 8 colors (a full major-ish scale) so "warm" (0-7) and
// "cool" (8-15) are two learnable octaves rather than 16 arbitrary pitches.
const COLORS = [
  { name: "Rose", value: "#e88aab", tone: 392.0 },
  { name: "Peach", value: "#f9a8a8", tone: 440.0 },
  { name: "Sun", value: "#f5a623", tone: 493.88 },
  { name: "Amber", value: "#d98324", tone: 523.25 },
  { name: "Ink", value: "#3a1f2b", tone: 587.33 },
  { name: "Crimson", value: "#c2385a", tone: 659.25 },
  { name: "Coral", value: "#ff7f6b", tone: 698.46 },
  { name: "Gold", value: "#e0b04f", tone: 783.99 },
  { name: "Lavender", value: "#c9a0dc", tone: 392.0 / 2 },
  { name: "Plum", value: "#9b72cf", tone: 440.0 / 2 },
  { name: "Sky", value: "#4da6ff", tone: 493.88 / 2 },
  { name: "Teal", value: "#3fb8af", tone: 523.25 / 2 },
  { name: "Mint", value: "#48b376", tone: 587.33 / 2 },
  { name: "Forest", value: "#2f6b4f", tone: 659.25 / 2 },
  { name: "Indigo", value: "#5b5ea6", tone: 698.46 / 2 },
  { name: "Slate", value: "#5c6b7a", tone: 783.99 / 2 },
];

const WIDTH = 900;
const HEIGHT = 560;
const GRID = 60;

// Shape guides: each is a closed path in 0..1 normalized space (scaled to the
// canvas at render time), plus spoken checkpoints keyed by how far along the
// path (0..1) the user should be when that instruction fires. Checkpoints
// only announce once per attempt so instructions don't repeat mid-move.
type ShapeGuide = {
  name: string;
  points: Point[]; // normalized 0..1, closed loop
  checkpoints: { at: number; say: string }[];
};

const norm = (x: number, y: number): Point => ({ x, y });

const SHAPE_GUIDES: Record<string, ShapeGuide> = {
  circle: {
    name: "Circle",
    points: Array.from({ length: 48 }, (_, i) => {
      const t = (i / 48) * Math.PI * 2;
      return norm(0.5 + Math.cos(t) * 0.35, 0.5 + Math.sin(t) * 0.35);
    }),
    checkpoints: [
      { at: 0, say: "Start at the top. Move right to begin the curve." },
      { at: 0.25, say: "Quarter way — now curving down." },
      { at: 0.5, say: "Halfway — you're at the bottom, curve back up and left." },
      { at: 0.75, say: "Three quarters — heading back to the top." },
      { at: 0.98, say: "Almost closed — you're back near the start." },
    ],
  },
  square: {
    name: "Square",
    points: [
      norm(0.2, 0.2), norm(0.8, 0.2), norm(0.8, 0.8), norm(0.2, 0.8), norm(0.2, 0.2),
    ],
    checkpoints: [
      { at: 0, say: "Start at the top left corner. Move right for the top edge." },
      { at: 0.25, say: "Top right corner — now turn and move down." },
      { at: 0.5, say: "Bottom right corner — now turn and move left." },
      { at: 0.75, say: "Bottom left corner — now turn and move up to close it." },
      { at: 0.98, say: "Back at the start — square complete." },
    ],
  },
  heart: {
    name: "Heart",
    points: Array.from({ length: 64 }, (_, i) => {
      const t = (i / 64) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(t), 3);
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      return norm(0.5 + (hx / 34), 0.5 + (hy / 34));
    }),
    checkpoints: [
      { at: 0, say: "Start at the bottom point of the heart. Move up and left." },
      { at: 0.2, say: "Curving up into the left lobe." },
      { at: 0.35, say: "You're at the top of the left lobe — dip down into the middle notch." },
      { at: 0.5, say: "Center notch — now rise up into the right lobe." },
      { at: 0.65, say: "Top of the right lobe — begin curving down." },
      { at: 0.85, say: "Coming down the right side, back toward the bottom point." },
      { at: 0.98, say: "Almost there — closing at the bottom point." },
    ],
  },
  star: {
    name: "Star",
    points: Array.from({ length: 10 }, (_, i) => {
      const t = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 0.4 : 0.17;
      return norm(0.5 + Math.cos(t) * r, 0.5 + Math.sin(t) * r * 1.1);
    }).concat([norm(0.5, 0.1)]),
    checkpoints: [
      { at: 0, say: "Start at the top point of the star." },
      { at: 0.2, say: "First inner notch — sharp turn." },
      { at: 0.4, say: "Second outer point." },
      { at: 0.6, say: "Bottom points — you're past the halfway mark." },
      { at: 0.8, say: "Final outer point before closing." },
      { at: 0.98, say: "Back at the top — star complete." },
    ],
  },
};

// Returns { distance, progress } where distance is in canvas units to the
// nearest point on the guide path, and progress is 0..1 fraction along it —
// used to drive both the proximity tone and which spoken checkpoint fires.
function nearestOnGuide(p: Point, guide: ShapeGuide): { distance: number; progress: number } {
  const pts = guide.points.map((n) => ({ x: n.x * WIDTH, y: n.y * HEIGHT }));
  let best = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(p.x - pts[i].x, p.y - pts[i].y);
    if (d < best) { best = d; bestIdx = i; }
  }
  return { distance: best, progress: bestIdx / (pts.length - 1) };
}

export function Sketchpad() {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const audioRef = useRef<{
    ctx: AudioContext;
    osc: OscillatorNode;
    gain: GainNode;
    panner: StereoPannerNode;
  } | null>(null);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [color, setColor] = useState(COLORS[0].value);
  const [cursor, setCursor] = useState<Point>({ x: WIDTH / 2, y: HEIGHT / 2 });
  const [soundOn, setSoundOn] = useState(false);
  const [announce, setAnnounce] = useState(
    "Welcome to Sonic Bear Studio. Press S to start sound, D to toggle drawing, arrow keys to move."
  );

  // Independent accessibility toggles
  const [verboseAudio, setVerboseAudio] = useState(true); // grid ticks, edge tone, shape-complete chime, richer speech
  const [visualAids, setVisualAids] = useState(true); // cursor trail, bolder focus ring

  const [colorIndex, setColorIndex] = useState(0);
  const [guideKey, setGuideKey] = useState<keyof typeof SHAPE_GUIDES | null>(null);
  const lastCheckpoint = useRef(-1);
  const guideOscRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);

  const say = useCallback((msg: string) => setAnnounce(msg), []);
  const stats = useCanvasClicks();

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    const Ctor: typeof AudioContext =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const panner = ctx.createStereoPanner();
    osc.type = "sine";
    osc.frequency.value = 440;
    gain.gain.value = 0;
    osc.connect(gain).connect(panner).connect(ctx.destination);
    osc.start();
    audioRef.current = { ctx, osc, gain, panner };
    return audioRef.current;
  }, []);

  const updateAudio = useCallback((p: Point) => {
    const a = audioRef.current;
    if (!a || !soundOn) return;
    const pan = (p.x / WIDTH) * 2 - 1;
    const pitch = 220 + (1 - p.y / HEIGHT) * 660;
    a.panner.pan.setTargetAtTime(pan, a.ctx.currentTime, 0.02);
    a.osc.frequency.setTargetAtTime(pitch, a.ctx.currentTime, 0.02);
    a.gain.gain.setTargetAtTime(drawing ? 0.18 : 0.08, a.ctx.currentTime, 0.03);
  }, [drawing, soundOn]);

  const playCue = useCallback((freq: number, duration = 0.12, type: OscillatorType = "triangle") => {
    const a = ensureAudio();
    const cue = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    cue.type = type;
    cue.frequency.value = freq;
    g.gain.value = 0.0001;
    cue.connect(g).connect(a.ctx.destination);
    const t = a.ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    cue.start(t);
    cue.stop(t + duration + 0.02);
  }, [ensureAudio]);

  // Two-tone chime when a shape closes near its own starting point
  const playShapeComplete = useCallback(() => {
    playCue(784, 0.1, "sine");
    setTimeout(() => playCue(988, 0.16, "sine"), 90);
  }, [playCue]);

  const buzzBorder = useCallback(() => playCue(90, 0.14, "sawtooth"), [playCue]);

  // Soft tick each time the cursor crosses a grid line, gated behind verboseAudio
  // so it doesn't overwhelm anyone who just wants the plain pan/pitch signal.
  const lastCell = useRef<{ gx: number; gy: number } | null>(null);
  const gridTick = useCallback((p: Point) => {
    if (!verboseAudio || !soundOn) return;
    const gx = Math.floor(p.x / GRID);
    const gy = Math.floor(p.y / GRID);
    const last = lastCell.current;
    if (!last || last.gx !== gx || last.gy !== gy) {
      lastCell.current = { gx, gy };
      if (last) playCue(1200, 0.03, "sine");
    }
  }, [verboseAudio, soundOn, playCue]);

  // Continuous "on-path" tone for shape guides: a separate oscillator from the
  // main pitch/pan voice so the two never fight for the same frequency. Pitch
  // rises as distance-to-path shrinks — hot/cold by ear, like sonar.
  const startGuideTone = useCallback(() => {
    const a = ensureAudio();
    if (guideOscRef.current) return;
    const osc = a.ctx.createOscillator();
    const gain = a.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 300;
    gain.gain.value = 0;
    osc.connect(gain).connect(a.ctx.destination);
    osc.start();
    guideOscRef.current = { osc, gain };
  }, [ensureAudio]);

  const stopGuideTone = useCallback(() => {
    const g = guideOscRef.current;
    if (g) {
      g.gain.gain.setTargetAtTime(0, g.osc.context.currentTime, 0.05);
      setTimeout(() => { try { g.osc.stop(); } catch { /* already stopped */ } }, 200);
      guideOscRef.current = null;
    }
  }, []);

  const trackGuide = useCallback((p: Point) => {
    if (!guideKey || !soundOn) return;
    const guide = SHAPE_GUIDES[guideKey];
    const { distance, progress } = nearestOnGuide(p, guide);
    const g = guideOscRef.current;
    if (g) {
      // Within ~90px of the path: 300Hz far → 1000Hz right on it.
      const closeness = Math.max(0, 1 - Math.min(distance, 90) / 90);
      const freq = 300 + closeness * 700;
      const vol = 0.03 + closeness * 0.12;
      g.osc.frequency.setTargetAtTime(freq, g.osc.context.currentTime, 0.05);
      g.gain.gain.setTargetAtTime(vol, g.osc.context.currentTime, 0.05);
    }
    const cps = guide.checkpoints;
    for (let i = cps.length - 1; i >= 0; i--) {
      if (progress >= cps[i].at && i > lastCheckpoint.current) {
        lastCheckpoint.current = i;
        say(cps[i].say);
        break;
      }
    }
  }, [guideKey, soundOn, say]);

  const startGuide = useCallback((key: keyof typeof SHAPE_GUIDES) => {
    setGuideKey(key);
    lastCheckpoint.current = -1;
    startGuideTone();
    say(`${SHAPE_GUIDES[key].name} guide started. ${SHAPE_GUIDES[key].checkpoints[0].say}`);
    trackClick();
  }, [startGuideTone, say]);

  const stopGuide = useCallback(() => {
    if (!guideKey) return;
    stopGuideTone();
    say("Guide stopped");
    setGuideKey(null);
    trackClick();
  }, [guideKey, stopGuideTone, say]);

  const cycleColor = useCallback((dir: 1 | -1) => {
    setColorIndex((i) => {
      const next = (i + dir + COLORS.length) % COLORS.length;
      const c = COLORS[next];
      setColor(c.value);
      playCue(c.tone, 0.18, "sine");
      say(`${c.name}`);
      return next;
    });
    trackClick();
  }, [playCue, say]);

  const moveTo = useCallback((next: Point) => {
    let { x, y } = next;
    let hitBorder = false;
    if (x < 0) { x = 0; hitBorder = true; }
    if (x > WIDTH) { x = WIDTH; hitBorder = true; }
    if (y < 0) { y = 0; hitBorder = true; }
    if (y > HEIGHT) { y = HEIGHT; hitBorder = true; }
    const p = { x, y };
    setCursor(p);
    updateAudio(p);
    gridTick(p);
    trackGuide(p);
    if (hitBorder) {
      buzzBorder();
      if (verboseAudio) say("Edge reached");
    }
    if (drawing) {
      setCurrent((c) => {
        if (!c) return { color, points: [p] };
        const start = c.points[0];
        const dist = Math.hypot(p.x - start.x, p.y - start.y);
        if (c.points.length > 6 && dist < 14) playShapeComplete();
        return { ...c, points: [...c.points, p] };
      });
    }
  }, [drawing, color, updateAudio, gridTick, trackGuide, buzzBorder, verboseAudio, say, playShapeComplete]);

  const toggleDrawing = useCallback(() => {
    trackClick();
    setDrawing((d) => {
      const next = !d;
      if (next) {
        setCurrent({ color, points: [cursor] });
        playCue(660);
        say("Drawing on");
      } else {
        setCurrent((c) => {
          if (c && c.points.length > 1) setStrokes((s) => [...s, c]);
          return null;
        });
        playCue(330);
        say("Line connected");
      }
      return next;
    });
  }, [color, cursor, playCue, say]);

  const toggleSound = useCallback(() => {
    trackClick();
    setSoundOn((s) => {
      const next = !s;
      if (next) {
        const a = ensureAudio();
        if (a.ctx.state === "suspended") a.ctx.resume();
        say(verboseAudio
          ? "Sound on. Move to explore pitch and pan. Grid ticks and edge tones are on."
          : "Sound on. Move to explore pitch and pan.");
      } else {
        const a = audioRef.current;
        if (a) a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.02);
        say("Sound off");
      }
      return next;
    });
  }, [ensureAudio, say, verboseAudio]);

  const clearCanvas = useCallback(() => {
    setStrokes([]);
    setCurrent(null);
    setDrawing(false);
    playCue(200, 0.2);
    say("Canvas cleared");
    trackClick();
  }, [playCue, say]);

  const pickColor = useCallback((c: { name: string; value: string }) => {
    setColor(c.value);
    playCue(523 + COLORS.findIndex((x) => x.value === c.value) * 60);
    say(`Color ${c.name} selected`);
    trackClick();
  }, [playCue, say]);

  const toggleVerboseAudio = useCallback(() => {
    setVerboseAudio((v) => {
      const next = !v;
      say(next ? "Verbose audio cues on" : "Verbose audio cues off");
      trackClick();
      return next;
    });
  }, [say]);

  const toggleVisualAids = useCallback(() => {
    setVisualAids((v) => {
      const next = !v;
      say(next ? "Visual aids on" : "Visual aids off");
      trackClick();
      return next;
    });
  }, [say]);

  // Keyboard
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 30 : 10;
      if (e.key === "ArrowLeft") { e.preventDefault(); moveTo({ x: cursor.x - step, y: cursor.y }); }
      else if (e.key === "ArrowRight") { e.preventDefault(); moveTo({ x: cursor.x + step, y: cursor.y }); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveTo({ x: cursor.x, y: cursor.y - step }); }
      else if (e.key === "ArrowDown") { e.preventDefault(); moveTo({ x: cursor.x, y: cursor.y + step }); }
      else if (e.key === " " || e.key.toLowerCase() === "d") { e.preventDefault(); toggleDrawing(); }
      else if (e.key.toLowerCase() === "s") { e.preventDefault(); toggleSound(); }
      else if (e.key.toLowerCase() === "c") { e.preventDefault(); clearCanvas(); }
      else if (e.key.toLowerCase() === "v") { e.preventDefault(); toggleVerboseAudio(); }
      else if (e.key.toLowerCase() === "x") { e.preventDefault(); toggleVisualAids(); }
      if ([" ", "d", "s", "c", "v", "x"].includes(e.key.toLowerCase()) && !e.repeat) trackClick();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, moveTo, toggleDrawing, toggleSound, clearCanvas, toggleVerboseAudio, toggleVisualAids]);

  // Pointer
  const pointerDrawing = useRef(false);
  const svgPoint = (e: React.PointerEvent<SVGSVGElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) / rect.width) * WIDTH,
      y: ((e.clientY - rect.top) / rect.height) * HEIGHT,
    };
  };

  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    pointerDrawing.current = true;
    const p = svgPoint(e);
    setCursor(p);
    setDrawing(true);
    setCurrent({ color, points: [p] });
    updateAudio(p);
    trackClick();
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = svgPoint(e);
    setCursor(p);
    updateAudio(p);
    gridTick(p);
    trackGuide(p);
    if (pointerDrawing.current) {
      setCurrent((c) => c ? { ...c, points: [...c.points, p] } : { color, points: [p] });
    }
  };
  const onPointerUp = () => {
    if (!pointerDrawing.current) return;
    pointerDrawing.current = false;
    setDrawing(false);
    setCurrent((c) => {
      if (c && c.points.length > 1) setStrokes((s) => [...s, c]);
      return null;
    });
    say("Line connected");
  };

  const buildSvgString = (highContrast: boolean) => {
    const all = current ? [...strokes, current] : strokes;
    const bg = highContrast ? "#ffffff" : "#fff5f8";
    const paths = all
      .map((s) => {
        const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
        const stroke = highContrast ? "#000000" : s.color;
        return `<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${highContrast ? 4 : 3}" stroke-linecap="round" stroke-linejoin="round"/>`;
      })
      .join("");
    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}"><rect width="100%" height="100%" fill="${bg}"/>${paths}</svg>`;
  };

  const download = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  const exportSwell = () => {
    download("sonic-bear-swell.svg", buildSvgString(true), "image/svg+xml");
    say("Exported high-contrast SVG for swell paper");
    trackClick();
  };
  const exportColor = () => {
    download("sonic-bear-color.svg", buildSvgString(false), "image/svg+xml");
    say("Exported color SVG");
    trackClick();
  };
  const exportStl = () => {
    const all = current ? [...strokes, current] : strokes;
    const H = 3;
    const W = 1.5;
    const facets: string[] = [];
    const facet = (n: number[], v1: number[], v2: number[], v3: number[]) =>
      `facet normal ${n[0]} ${n[1]} ${n[2]}\nouter loop\nvertex ${v1[0]} ${v1[1]} ${v1[2]}\nvertex ${v2[0]} ${v2[1]} ${v2[2]}\nvertex ${v3[0]} ${v3[1]} ${v3[2]}\nendloop\nendfacet`;
    const box = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1, dy = y2 - y1;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * W, ny = dx / len * W;
      const a = [x1 + nx, y1 + ny, 0], b = [x1 - nx, y1 - ny, 0];
      const c = [x2 + nx, y2 + ny, 0], d = [x2 - nx, y2 - ny, 0];
      const A = [a[0], a[1], H], B = [b[0], b[1], H], C = [c[0], c[1], H], D = [d[0], d[1], H];
      facets.push(facet([0, 0, 1], A, C, D));
      facets.push(facet([0, 0, 1], A, D, B));
      facets.push(facet([0, 0, -1], a, d, c));
      facets.push(facet([0, 0, -1], a, b, d));
      facets.push(facet([0, 0, 0], a, c, C)); facets.push(facet([0, 0, 0], a, C, A));
      facets.push(facet([0, 0, 0], b, B, D)); facets.push(facet([0, 0, 0], b, D, d));
      facets.push(facet([0, 0, 0], a, A, B)); facets.push(facet([0, 0, 0], a, B, b));
      facets.push(facet([0, 0, 0], c, d, D)); facets.push(facet([0, 0, 0], c, D, C));
    };
    const scale = 150 / WIDTH;
    for (const s of all) {
      for (let i = 1; i < s.points.length; i++) {
        const p0 = s.points[i - 1], p1 = s.points[i];
        box(p0.x * scale, (HEIGHT - p0.y) * scale, p1.x * scale, (HEIGHT - p1.y) * scale);
      }
    }
    const stl = `solid sonic_bear\n${facets.join("\n")}\nendsolid sonic_bear`;
    download("sonic-bear.stl", stl, "model/stl");
    say("Exported 3D printable STL file");
    trackClick();
  };

  const undo = () => {
    setStrokes((s) => s.slice(0, -1));
    playCue(300);
    say("Last line undone");
    trackClick();
  };

  // Trail of recent cursor points, only rendered when visual aids are on
  const trailRef = useRef<Point[]>([]);
  trailRef.current = [...trailRef.current.slice(-11), cursor];

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="rounded-3xl bg-card p-4 shadow-lg ring-1 ring-primary/20">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/20">
            <Sparkles className="h-3.5 w-3.5" />
            {stats.data == null
              ? "Counting canvas drawings…"
              : `${stats.data.toLocaleString()} canvas drawings created worldwide`}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              onClick={toggleVerboseAudio}
              variant={verboseAudio ? "default" : "outline"}
              aria-pressed={verboseAudio}
              size="sm"
              className="gap-1.5 rounded-full"
              title="Toggle grid ticks, edge tones, and extra spoken cues"
            >
              <Ear className="h-3.5 w-3.5" /> Rich audio
              <kbd className="ml-0.5 rounded bg-background/40 px-1 py-0.5 text-[10px]">V</kbd>
            </Button>
            <Button
              onClick={toggleVisualAids}
              variant={visualAids ? "default" : "outline"}
              aria-pressed={visualAids}
              size="sm"
              className="gap-1.5 rounded-full"
              title="Toggle cursor trail and high-contrast focus ring"
            >
              <Eye className="h-3.5 w-3.5" /> Visual aids
              <kbd className="ml-0.5 rounded bg-background/40 px-1 py-0.5 text-[10px]">X</kbd>
            </Button>
          </div>
        </div>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button onClick={toggleSound} variant={soundOn ? "default" : "secondary"} aria-pressed={soundOn} className="gap-2 rounded-full">
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {soundOn ? "Sound On" : "Sound Off"}
            <kbd className="ml-1 rounded bg-background/40 px-1.5 py-0.5 text-[10px]">S</kbd>
          </Button>
          <Button onClick={toggleDrawing} variant={drawing ? "default" : "secondary"} aria-pressed={drawing} className="gap-2 rounded-full">
            {drawing ? <Pencil className="h-4 w-4" /> : <Hand className="h-4 w-4" />}
            {drawing ? "Drawing" : "Idle"}
            <kbd className="ml-1 rounded bg-background/40 px-1.5 py-0.5 text-[10px]">Space</kbd>
          </Button>
          <Button onClick={undo} variant="outline" className="gap-2 rounded-full">
            <Undo2 className="h-4 w-4" /> Undo
          </Button>
          <Button onClick={clearCanvas} variant="outline" className="gap-2 rounded-full">
            <Eraser className="h-4 w-4" /> Clear
            <kbd className="ml-1 rounded bg-background/40 px-1.5 py-0.5 text-[10px]">C</kbd>
          </Button>
        </div>
        <svg
          ref={svgRef}
          role="img"
          aria-label="Sonic tactile drawing canvas. Use arrow keys to move, space to toggle drawing."
          tabIndex={0}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className={`w-full touch-none rounded-2xl bg-[oklch(0.98_0.02_15)] ${visualAids ? "ring-4 ring-primary/60 focus-visible:ring-4 focus-visible:ring-primary" : "ring-2 ring-primary/40"}`}
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          <defs>
            <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="oklch(0.9 0.05 15)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
          {strokes.map((s, i) => (
            <polyline
              key={i}
              points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={s.color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
          {current && (
            <polyline
              points={current.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none"
              stroke={current.color}
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          )}
          {visualAids && trailRef.current.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={2 + (i / trailRef.current.length) * 3}
              fill={color}
              fillOpacity={(i / trailRef.current.length) * 0.35}
            />
          ))}
          <circle cx={cursor.x} cy={cursor.y} r={10} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={2} />
          <circle cx={cursor.x} cy={cursor.y} r={3} fill={color} />
        </svg>
        <p className="mt-3 text-xs text-muted-foreground">
          Tip: horizontal position pans left↔right, vertical position raises pitch. Press S then move.
        </p>
      </div>

      <aside className="space-y-5">
        <section aria-labelledby="settings-heading" className="rounded-3xl bg-card p-4 shadow-md ring-1 ring-primary/20">
          <h2 id="settings-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Settings2 className="h-4 w-4 text-primary" /> Studio settings
          </h2>
          <div className="space-y-2 text-xs text-muted-foreground">
            <label className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5"><Ear className="h-3.5 w-3.5" /> Rich audio cues</span>
              <input type="checkbox" checked={verboseAudio} onChange={toggleVerboseAudio} className="h-4 w-4 accent-primary" />
            </label>
            <label className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5" /> Visual aids</span>
              <input type="checkbox" checked={visualAids} onChange={toggleVisualAids} className="h-4 w-4 accent-primary" />
            </label>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground/80">
            Rich audio adds grid ticks, an edge tone, and a two-note chime when a shape closes.
            Visual aids add a cursor trail and a bolder focus ring.
          </p>
        </section>

        <section aria-labelledby="colors-heading" className="rounded-3xl bg-card p-4 shadow-md ring-1 ring-primary/20">
          <h2 id="colors-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Palette className="h-4 w-4 text-primary" /> Palette
          </h2>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => pickColor(c)}
                aria-label={`Color ${c.name}`}
                aria-pressed={color === c.value}
                className={`h-10 w-10 rounded-full ring-2 transition ${color === c.value ? "ring-foreground scale-110" : "ring-transparent"}`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </section>

        <section aria-labelledby="export-heading" className="rounded-3xl bg-card p-4 shadow-md ring-1 ring-primary/20">
          <h2 id="export-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Bring it to life
          </h2>
          <div className="grid gap-2">
            <Button onClick={exportSwell} className="justify-start gap-2 rounded-full">
              <Waves className="h-4 w-4" /> Swell Paper SVG
            </Button>
            <Button onClick={exportColor} variant="secondary" className="justify-start gap-2 rounded-full">
              <Palette className="h-4 w-4" /> Color SVG
            </Button>
            <Button onClick={exportStl} variant="outline" className="justify-start gap-2 rounded-full">
              <Box className="h-4 w-4" /> 3D Print (STL)
            </Button>
          </div>
        </section>

        <section aria-labelledby="kbd-heading" className="rounded-3xl bg-card p-4 shadow-md ring-1 ring-primary/20 text-xs text-muted-foreground">
          <h2 id="kbd-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Keyboard className="h-4 w-4 text-primary" /> Keyboard
          </h2>
          <ul className="space-y-1">
            <li>Arrows — move brush (Shift = faster)</li>
            <li>Space / D — toggle drawing</li>
            <li>S — toggle sound</li>
            <li>C — clear canvas</li>
            <li>V — toggle rich audio cues</li>
            <li>X — toggle visual aids</li>
          </ul>
        </section>
      </aside>

      <div aria-live="assertive" role="status" className="sr-only">{announce}</div>
    </div>
  );
}
