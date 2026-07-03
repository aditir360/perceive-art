import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";

type Point = { x: number; y: number };
type Stroke = { color: string; points: Point[] };

const COLORS = [
  { name: "Rose", value: "#e88aab" },
  { name: "Lavender", value: "#c9a0dc" },
  { name: "Peach", value: "#f9a8a8" },
  { name: "Plum", value: "#9b72cf" },
  { name: "Ink", value: "#3a1f2b" },
];

const WIDTH = 900;
const HEIGHT = 560;

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
  const [announce, setAnnounce] = useState("Welcome to Sonic Bear Studio. Press S to start sound, D to toggle drawing, arrow keys to move.");

  const say = useCallback((msg: string) => setAnnounce(msg), []);

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

  const playCue = useCallback((freq: number, duration = 0.12) => {
    const a = ensureAudio();
    const cue = a.ctx.createOscillator();
    const g = a.ctx.createGain();
    cue.type = "triangle";
    cue.frequency.value = freq;
    g.gain.value = 0.0001;
    cue.connect(g).connect(a.ctx.destination);
    const t = a.ctx.currentTime;
    g.gain.exponentialRampToValueAtTime(0.15, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    cue.start(t);
    cue.stop(t + duration + 0.02);
  }, [ensureAudio]);

  const buzzBorder = useCallback(() => playCue(90, 0.14), [playCue]);

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
    if (hitBorder) buzzBorder();
    if (drawing) {
      setCurrent((c) => c ? { ...c, points: [...c.points, p] } : { color, points: [p] });
    }
  }, [drawing, color, updateAudio, buzzBorder]);

  const toggleDrawing = useCallback(() => {
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
    setSoundOn((s) => {
      const next = !s;
      if (next) {
        const a = ensureAudio();
        if (a.ctx.state === "suspended") a.ctx.resume();
        say("Sound on. Move to explore pitch and pan.");
      } else {
        const a = audioRef.current;
        if (a) a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.02);
        say("Sound off");
      }
      return next;
    });
  }, [ensureAudio, say]);

  const clearCanvas = useCallback(() => {
    setStrokes([]);
    setCurrent(null);
    setDrawing(false);
    playCue(200, 0.2);
    say("Canvas cleared");
  }, [playCue, say]);

  const pickColor = useCallback((c: { name: string; value: string }) => {
    setColor(c.value);
    playCue(523 + COLORS.findIndex((x) => x.value === c.value) * 60);
    say(`Color ${c.name} selected`);
  }, [playCue, say]);

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
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, moveTo, toggleDrawing, toggleSound, clearCanvas]);

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
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = svgPoint(e);
    setCursor(p);
    updateAudio(p);
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
  };
  const exportColor = () => {
    download("sonic-bear-color.svg", buildSvgString(false), "image/svg+xml");
    say("Exported color SVG");
  };
  const exportStl = () => {
    // Simple extrusion: each line segment becomes a thin rectangular prism
    const all = current ? [...strokes, current] : strokes;
    const H = 3; // height in mm
    const W = 1.5; // half-width
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
      // top
      facets.push(facet([0, 0, 1], A, C, D));
      facets.push(facet([0, 0, 1], A, D, B));
      // bottom
      facets.push(facet([0, 0, -1], a, d, c));
      facets.push(facet([0, 0, -1], a, b, d));
      // sides
      facets.push(facet([0, 0, 0], a, c, C)); facets.push(facet([0, 0, 0], a, C, A));
      facets.push(facet([0, 0, 0], b, B, D)); facets.push(facet([0, 0, 0], b, D, d));
      facets.push(facet([0, 0, 0], a, A, B)); facets.push(facet([0, 0, 0], a, B, b));
      facets.push(facet([0, 0, 0], c, d, D)); facets.push(facet([0, 0, 0], c, D, C));
    };
    // scale mm: fit into 150mm wide
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
  };

  const undo = () => {
    setStrokes((s) => s.slice(0, -1));
    playCue(300);
    say("Last line undone");
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
      <div className="rounded-3xl bg-card p-4 shadow-lg ring-1 ring-primary/20">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <Button onClick={toggleSound} variant={soundOn ? "default" : "secondary"} aria-pressed={soundOn}>
            {soundOn ? "🔊 Sound On" : "🔇 Sound Off"} (S)
          </Button>
          <Button onClick={toggleDrawing} variant={drawing ? "default" : "secondary"} aria-pressed={drawing}>
            {drawing ? "✏️ Drawing" : "✋ Idle"} (Space)
          </Button>
          <Button onClick={undo} variant="outline">↶ Undo</Button>
          <Button onClick={clearCanvas} variant="outline">🧹 Clear (C)</Button>
        </div>
        <svg
          ref={svgRef}
          role="img"
          aria-label="Sonic tactile drawing canvas. Use arrow keys to move, space to toggle drawing."
          tabIndex={0}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none rounded-2xl bg-[oklch(0.98_0.02_15)] ring-2 ring-primary/40"
          style={{ aspectRatio: `${WIDTH} / ${HEIGHT}` }}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* soft grid */}
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="oklch(0.9 0.05 15)" strokeWidth="1" />
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
          {/* cursor */}
          <circle cx={cursor.x} cy={cursor.y} r={10} fill={color} fillOpacity={0.3} stroke={color} strokeWidth={2} />
          <circle cx={cursor.x} cy={cursor.y} r={3} fill={color} />
        </svg>
        <p className="mt-3 text-xs text-muted-foreground">
          Tip: horizontal position pans left↔right, vertical position raises pitch. Press S then move.
        </p>
      </div>

      <aside className="space-y-5">
        <section aria-labelledby="colors-heading" className="rounded-3xl bg-card p-4 shadow-md ring-1 ring-primary/20">
          <h2 id="colors-heading" className="mb-2 text-sm font-semibold">Colors</h2>
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
          <h2 id="export-heading" className="mb-2 text-sm font-semibold">Export</h2>
          <div className="grid gap-2">
            <Button onClick={exportSwell}>🫧 Swell Paper SVG</Button>
            <Button onClick={exportColor} variant="secondary">🎨 Color SVG</Button>
            <Button onClick={exportStl} variant="outline">🧊 3D Print (STL)</Button>
          </div>
        </section>

        <section aria-labelledby="kbd-heading" className="rounded-3xl bg-card p-4 shadow-md ring-1 ring-primary/20 text-xs text-muted-foreground">
          <h2 id="kbd-heading" className="mb-2 text-sm font-semibold text-foreground">Keyboard</h2>
          <ul className="space-y-1">
            <li>Arrows — move brush (Shift = faster)</li>
            <li>Space / D — toggle drawing</li>
            <li>S — toggle sound</li>
            <li>C — clear canvas</li>
          </ul>
        </section>
      </aside>

      <div aria-live="assertive" role="status" className="sr-only">{announce}</div>
    </div>
  );
}