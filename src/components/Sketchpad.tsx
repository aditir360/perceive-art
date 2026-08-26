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
  Eye,
  Map,
  ChevronRight,
  X,
  Circle,
  Square,
  Heart,
  Star,
  Triangle,
  Orbit,
  Home,
  Globe,
  Check,
  Highlighter,
  Paintbrush,
  Infinity as InfinityIcon,
  Flower2,
  Crown,
  Zap,
} from "lucide-react";

// Icon + colour badge per guide, reusing the same swatches from the palette
// below (Rose, Gold, Sky, etc.) instead of introducing new colours or emoji.
const GUIDE_ICONS: Record<string, { Icon: typeof Circle; color: string }> = {
  circle:   { Icon: Circle,   color: "#c9a0dc" }, // Lavender
  square:   { Icon: Square,   color: "#5c6b7a" }, // Slate
  heart:    { Icon: Heart,    color: "#e88aab" }, // Rose
  star:     { Icon: Star,     color: "#e0b04f" }, // Gold
  triangle: { Icon: Triangle, color: "#ff7f6b" }, // Coral
  wave:     { Icon: Waves,    color: "#4da6ff" }, // Sky
  spiral:   { Icon: Orbit,    color: "#9b72cf" }, // Plum
  house:    { Icon: Home,     color: "#48b376" }, // Mint
  infinity: { Icon: InfinityIcon, color: "#7c6fd1" }, // Indigo-violet
  flower:   { Icon: Flower2,  color: "#f4978e" }, // Coral-pink
  crown:    { Icon: Crown,    color: "#d4af37" }, // Antique gold
  lightning:{ Icon: Zap,      color: "#ffd166" }, // Bright yellow
};

type Point = { x: number; y: number };
type PenTexture = "marker" | "highlighter" | "paintbrush" | "scribbly";
type Stroke = { color: string; width: number; points: Point[]; texture: PenTexture; opacity: number };

const MIN_PEN_WIDTH = 1;
const MAX_PEN_WIDTH = 14;

const PEN_TEXTURES: { key: PenTexture; label: string; Icon: typeof Pencil }[] = [
  { key: "marker",      label: "Marker",      Icon: Pencil },
  { key: "highlighter", label: "Highlighter", Icon: Highlighter },
  { key: "paintbrush",  label: "Paintbrush",  Icon: Paintbrush },
  { key: "scribbly",    label: "Scribbly",    Icon: Waves },
];

// Deterministic pseudo-random jitter so a given stroke always looks the same
// across re-renders (no flicker) but still reads as loose/hand-drawn.
function seededJitter(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

// Turns a stroke's points into a wobbly "scribbly" path by nudging each
// point along its perpendicular normal by a small pseudo-random amount.
function scribblyPoints(points: Point[], strength: number): Point[] {
  if (points.length < 2) return points;
  return points.map((p, i) => {
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    const dx = next.x - prev.x;
    const dy = next.y - prev.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len;
    const ny = dx / len;
    const j = (seededJitter(i * 7.31 + p.x * 0.13 + p.y * 0.07) - 0.5) * 2 * strength;
    return { x: p.x + nx * j, y: p.y + ny * j };
  });
}

const COLORS = [
  { name: "Rose",     value: "#e88aab", tone: 523.25 },
  { name: "Peach",    value: "#f9a8a8", tone: 587.33 },
  { name: "Sun",      value: "#f5a623", tone: 659.25 },
  { name: "Amber",    value: "#d98324", tone: 698.46 },
  { name: "Ink",      value: "#3a1f2b", tone: 392.00 },
  { name: "Crimson",  value: "#c2385a", tone: 440.00 },
  { name: "Coral",    value: "#ff7f6b", tone: 493.88 },
  { name: "Gold",     value: "#e0b04f", tone: 783.99 },
  { name: "Lavender", value: "#c9a0dc", tone: 261.63 },
  { name: "Plum",     value: "#9b72cf", tone: 293.66 },
  { name: "Sky",      value: "#4da6ff", tone: 329.63 },
  { name: "Teal",     value: "#3fb8af", tone: 349.23 },
  { name: "Mint",     value: "#48b376", tone: 392.00 },
  { name: "Forest",   value: "#2f6b4f", tone: 440.00 },
  { name: "Indigo",   value: "#5b5ea6", tone: 466.16 },
  { name: "Slate",    value: "#5c6b7a", tone: 493.88 },
];

const WIDTH  = 900;
const HEIGHT = 560;
const GRID   = 60;

// Distance (px) inside which we consider the cursor "on" the template and
// switch from travel directions over to step-by-step drawing checkpoints.
const ARRIVAL_RADIUS = 45;

// Warm, encouraging call-outs sprinkled in as the user hits checkpoints —
// gives the guide voice personality instead of just robotic instructions.
const PRAISE_PHRASES = [
  "Nice and steady!",
  "Great job!",
  "You're doing wonderfully!",
  "Lovely line!",
  "Keep it up, you've got this!",
  "Beautiful — right on track!",
];

type ShapeGuide = {
  name: string;
  description: string;
  emoji: string;
  points: Point[];
  checkpoints: { at: number; say: string }[];
};

const norm = (x: number, y: number): Point => ({ x, y });

const SHAPE_GUIDES: Record<string, ShapeGuide> = {
  circle: {
    name: "Circle",
    description: "A smooth closed loop",
    emoji: "⭕",
    points: Array.from({ length: 64 }, (_, i) => {
      const t = (i / 64) * Math.PI * 2 - Math.PI / 2;
      return norm(0.5 + Math.cos(t) * 0.35, 0.5 + Math.sin(t) * 0.35);
    }),
    checkpoints: [
      { at: 0,    say: "Start at the very top. Move to the right to begin the curve." },
      { at: 0.25, say: "Right side — now curve downward." },
      { at: 0.5,  say: "Bottom of the circle — curve left and start heading up." },
      { at: 0.75, say: "Left side — curve upward, heading back to the top." },
      { at: 0.95, say: "Almost there — close the circle at the top." },
    ],
  },
  square: {
    name: "Square",
    description: "Four equal sides and corners",
    emoji: "⬜",
    points: [
      norm(0.2, 0.2), norm(0.8, 0.2), norm(0.8, 0.8), norm(0.2, 0.8), norm(0.2, 0.2),
    ],
    checkpoints: [
      { at: 0,    say: "Start at the top-left corner. Draw straight right for the top edge." },
      { at: 0.25, say: "Top-right corner — turn and draw straight down." },
      { at: 0.5,  say: "Bottom-right corner — turn and draw straight left." },
      { at: 0.75, say: "Bottom-left corner — turn and draw straight up to close it." },
      { at: 0.95, say: "Back at the top-left — square complete." },
    ],
  },
  heart: {
    name: "Heart",
    description: "Two humps meeting at a bottom point",
    emoji: "❤️",
    points: Array.from({ length: 80 }, (_, i) => {
      const t = (i / 80) * Math.PI * 2 - Math.PI / 2;
      const hx =  16 * Math.pow(Math.sin(t), 3);
      const hy = -(13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t));
      return norm(0.5 + hx / 36, 0.52 + hy / 38);
    }),
    checkpoints: [
      { at: 0,    say: "Start at the bottom point of the heart. Move up and to the right." },
      { at: 0.15, say: "Curving up into the right lobe — keep the arc wide." },
      { at: 0.3,  say: "Top of the right lobe — dip inward toward the center notch." },
      { at: 0.45, say: "Center notch — now rise up and left into the left lobe." },
      { at: 0.6,  say: "Top of the left lobe — begin curving downward." },
      { at: 0.8,  say: "Coming down the left side — aim for the bottom point." },
      { at: 0.95, say: "Almost there — close at the bottom point." },
    ],
  },
  star: {
    name: "Star",
    description: "Five points with inner notches",
    emoji: "⭐",
    points: Array.from({ length: 11 }, (_, i) => {
      const t = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = i % 2 === 0 ? 0.38 : 0.16;
      return norm(0.5 + Math.cos(t) * r, 0.5 + Math.sin(t) * r * 1.05);
    }),
    checkpoints: [
      { at: 0,    say: "Start at the top point of the star. Draw down-right to the first notch." },
      { at: 0.2,  say: "First notch — sharp turn, now draw out to the upper-right point." },
      { at: 0.4,  say: "Upper-right point — sharp turn inward to the center notch." },
      { at: 0.5,  say: "Halfway — now heading toward the lower-right point." },
      { at: 0.6,  say: "Lower-right point — turn left toward the bottom point." },
      { at: 0.8,  say: "Lower-left region — heading back up to the left points." },
      { at: 0.95, say: "Almost back at the top — close the star." },
    ],
  },
  triangle: {
    name: "Triangle",
    description: "Three sides and three corners",
    emoji: "🔺",
    points: [
      norm(0.5,  0.15),
      norm(0.82, 0.82),
      norm(0.18, 0.82),
      norm(0.5,  0.15),
    ],
    checkpoints: [
      { at: 0,    say: "Start at the top point. Draw diagonally down and to the right." },
      { at: 0.33, say: "Bottom-right corner — turn and draw straight left." },
      { at: 0.66, say: "Bottom-left corner — turn and draw diagonally up-right to close." },
      { at: 0.95, say: "Back at the top — triangle complete." },
    ],
  },
  wave: {
    name: "Wave",
    description: "A flowing S-curve from left to right",
    emoji: "🌊",
    points: Array.from({ length: 60 }, (_, i) => {
      const t = i / 59;
      return norm(0.1 + t * 0.8, 0.5 + Math.sin(t * Math.PI * 2) * 0.28);
    }),
    checkpoints: [
      { at: 0,    say: "Start on the left, at the middle height. Move right and upward." },
      { at: 0.25, say: "Crest of the first wave — now curve downward." },
      { at: 0.5,  say: "Middle of the canvas, crossing the center line — continue right." },
      { at: 0.75, say: "Second crest approaching — curve back up." },
      { at: 0.95, say: "Coming to the right edge — wave almost complete." },
    ],
  },
  spiral: {
    name: "Spiral",
    description: "A curve that winds outward from the center",
    emoji: "🌀",
    points: Array.from({ length: 80 }, (_, i) => {
      const t = (i / 79) * Math.PI * 4;
      const r = 0.04 + (i / 79) * 0.36;
      return norm(0.5 + Math.cos(t) * r, 0.5 + Math.sin(t) * r);
    }),
    checkpoints: [
      { at: 0,    say: "Start at the center. Move in a small circle, slowly expanding outward." },
      { at: 0.25, say: "First loop complete — keep circling and expanding." },
      { at: 0.5,  say: "Halfway — the spiral is widening. Keep the motion smooth." },
      { at: 0.75, say: "Three-quarters done — you're near the outer edge." },
      { at: 0.95, say: "Final loop — spiral nearly complete." },
    ],
  },
  house: {
    name: "House",
    description: "A square base with a triangle roof",
    emoji: "🏠",
    points: [
      norm(0.2,  0.75), // bottom-left
      norm(0.8,  0.75), // bottom-right
      norm(0.8,  0.45), // right wall top
      norm(0.5,  0.2),  // roof peak
      norm(0.2,  0.45), // left wall top
      norm(0.2,  0.75), // back to bottom-left
      norm(0.8,  0.75), // bottom-right again (cross the base)
    ],
    checkpoints: [
      { at: 0,    say: "Start at the bottom-left. Draw straight right along the base." },
      { at: 0.2,  say: "Bottom-right corner — draw straight up the right wall." },
      { at: 0.4,  say: "Top of the right wall — draw diagonally up-left to the roof peak." },
      { at: 0.55, say: "Roof peak — draw diagonally down-left to the top of the left wall." },
      { at: 0.7,  say: "Top of the left wall — draw straight down." },
      { at: 0.85, say: "Bottom-left again — draw right to close the base." },
      { at: 0.95, say: "House complete." },
    ],
  },
  infinity: {
    name: "Infinity",
    description: "A flowing figure-eight that loops through the center — more advanced, with two crossing points",
    emoji: "♾️",
    points: Array.from({ length: 96 }, (_, i) => {
      const t = (i / 96) * Math.PI * 2;
      const denom = 1 + Math.sin(t) * Math.sin(t);
      const x = (0.36 * Math.cos(t)) / denom;
      const y = (0.22 * Math.sin(t) * Math.cos(t)) / denom;
      return norm(0.5 + x, 0.5 + y);
    }),
    checkpoints: [
      { at: 0,    say: "Start at the rightmost point of the right loop. Curve up and to the left." },
      { at: 0.25, say: "Passing through the center crossing point — now head into the left loop." },
      { at: 0.5,  say: "Leftmost point — the far edge of the left loop." },
      { at: 0.75, say: "Back through the center crossing a second time — into the right loop." },
      { at: 0.95, say: "Almost home — close the loop at the rightmost point." },
    ],
  },
  flower: {
    name: "Flower",
    description: "Five petals looping out from a shared center — more advanced, with repeating loops",
    emoji: "🌸",
    points: Array.from({ length: 100 }, (_, i) => {
      const t = (i / 99) * Math.PI;
      const r = 0.34 * Math.cos(5 * t);
      return norm(0.5 + r * Math.cos(t), 0.5 + r * Math.sin(t));
    }),
    checkpoints: [
      { at: 0,    say: "Start at the tip of the first petal. Curve inward toward the center." },
      { at: 0.2,  say: "First petal complete — curve out to the next petal tip." },
      { at: 0.4,  say: "Second petal complete — continue on to the third." },
      { at: 0.6,  say: "Third petal complete — two more petals to go." },
      { at: 0.8,  say: "Fourth petal complete — one final petal remains." },
      { at: 0.95, say: "Final petal — flower complete." },
    ],
  },
  crown: {
    name: "Crown",
    description: "Three peaks rising from a wide base — more advanced, with several sharp turns",
    emoji: "👑",
    points: [
      norm(0.18, 0.78),
      norm(0.18, 0.42),
      norm(0.32, 0.58),
      norm(0.5,  0.22),
      norm(0.68, 0.58),
      norm(0.82, 0.42),
      norm(0.82, 0.78),
      norm(0.18, 0.78),
    ],
    checkpoints: [
      { at: 0,    say: "Start at the bottom-left of the crown. Draw straight up to the left peak." },
      { at: 0.14, say: "Left peak — dip down and to the right, into the first valley." },
      { at: 0.28, say: "First valley — rise up to the tall center peak." },
      { at: 0.42, say: "Center peak, the tallest point — dip down into the second valley." },
      { at: 0.57, say: "Second valley — rise up to the right peak." },
      { at: 0.7,  say: "Right peak — draw straight down to the base." },
      { at: 0.85, say: "Bottom-right — draw straight left along the base to close it." },
      { at: 0.95, say: "Crown complete." },
    ],
  },
  lightning: {
    name: "Lightning Bolt",
    description: "A sharp zigzag with quick direction changes — more advanced, with several tight turns",
    emoji: "⚡",
    points: [
      norm(0.55, 0.08),
      norm(0.28, 0.52),
      norm(0.46, 0.52),
      norm(0.36, 0.92),
      norm(0.72, 0.42),
      norm(0.52, 0.42),
      norm(0.55, 0.08),
    ],
    checkpoints: [
      { at: 0,    say: "Start at the top point. Draw a sharp diagonal down and to the left." },
      { at: 0.17, say: "Sharp turn — draw a short line across to the right." },
      { at: 0.33, say: "Another sharp turn — draw diagonally down and left, to the bottom tip." },
      { at: 0.5,  say: "Bottom tip — now draw a long diagonal up and to the right." },
      { at: 0.67, say: "Sharp turn — draw a short line across to the left." },
      { at: 0.85, say: "Final turn — draw diagonally up and to the right, back to the start." },
      { at: 0.95, say: "Lightning bolt complete." },
    ],
  },
};

// Turns a delta between two points into a friendly compass-style direction,
// e.g. "down and to the left". Used to walk the user's cursor over to the
// start of a template before they've touched the guide path at all.
function directionPhrase(dx: number, dy: number): string {
  const parts: string[] = [];
  const H_THRESHOLD = 18;
  const V_THRESHOLD = 18;
  if (dy > V_THRESHOLD) parts.push("down");
  else if (dy < -V_THRESHOLD) parts.push("up");
  if (dx > H_THRESHOLD) parts.push("to the right");
  else if (dx < -H_THRESHOLD) parts.push("to the left");
  if (!parts.length) return "you're right at the start";
  if (parts.length === 1) return `move ${parts[0]}`;
  return `move ${parts[0]} and ${parts[1]}`;
}

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

// ── Pleasant audio helpers ────────────────────────────────────────────────────
// All synthesis uses sine waves + light attack/release envelopes.
// No sawtooth or harsh timbres anywhere in the UI.

function buildAudio() {
  const Ctor: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();

  // Main draw voice: sine + gentle reverb via a small feedback delay
  const osc   = ctx.createOscillator();
  const gain  = ctx.createGain();
  const pan   = ctx.createStereoPanner();
  const delay = ctx.createDelay(0.3);
  const fb    = ctx.createGain();
  const wet   = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = 440;
  gain.gain.value = 0;
  delay.delayTime.value = 0.18;
  fb.gain.value = 0.28;
  wet.gain.value = 0.22;

  osc.connect(gain);
  gain.connect(pan);
  pan.connect(ctx.destination);
  // Reverb tail
  gain.connect(delay);
  delay.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(ctx.destination);

  osc.start();
  return { ctx, osc, gain, pan };
}

// Play a short melodic cue (sine, smooth attack/release, optional vibrato)
function playSineNote(
  ctx: AudioContext,
  freq: number,
  duration = 0.18,
  volume = 0.14,
  vibrato = false,
): void {
  const osc  = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;

  if (vibrato) {
    const lfo  = ctx.createOscillator();
    const lGain = ctx.createGain();
    lfo.frequency.value = 5.5;
    lGain.gain.value = 6;
    lfo.connect(lGain).connect(osc.frequency);
    lfo.start();
    lfo.stop(ctx.currentTime + duration + 0.05);
  }

  gain.gain.value = 0.0001;
  osc.connect(gain).connect(ctx.destination);
  const t = ctx.currentTime;
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.start(t);
  osc.stop(t + duration + 0.05);
}

// Three-note ascending chime (shape complete)
function playCompleteChime(ctx: AudioContext): void {
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((f, i) => {
    setTimeout(() => playSineNote(ctx, f, 0.28, 0.12, true), i * 90);
  });
}

// Soft two-note "welcome" tone for guide start
function playGuideStart(ctx: AudioContext, rootFreq: number): void {
  playSineNote(ctx, rootFreq, 0.22, 0.11);
  setTimeout(() => playSineNote(ctx, rootFreq * 1.5, 0.22, 0.09), 140);
}

// Gentle low "bump" for edge (replaces harsh sawtooth)
function playEdgeBump(ctx: AudioContext): void {
  playSineNote(ctx, 110, 0.18, 0.10);
}

type SketchpadProps = {
  /** Called with the finished artwork's colour SVG once the person confirms
   * they want to make it public. When omitted, the "Post to Gallery" section
   * is not rendered at all, so Sketchpad stays usable standalone. */
  onPost?: (artwork: { svg: string }) => void;
};

// Renders one stroke as one or more SVG primitives depending on its texture:
//  - marker:      a single clean round-cap polyline (the original look)
//  - highlighter: one thick, flat-cap, low-opacity polyline with a multiply
//                 blend so overlapping strokes darken like real highlighter ink
//  - paintbrush:  a few softly offset, semi-transparent polylines layered on
//                 top of each other for a soft bristly, uneven edge
//  - scribbly:    the path is jittered into a wobbly hand-drawn line
function StrokeShape({ stroke, keyPrefix }: { stroke: Stroke; keyPrefix: string }) {
  const { color, width, points, texture, opacity } = stroke;
  if (points.length === 0) return null;
  const toStr = (pts: Point[]) => pts.map((p) => `${p.x},${p.y}`).join(" ");

  if (texture === "highlighter") {
    return (
      <polyline
        points={toStr(points)}
        fill="none"
        stroke={color}
        strokeWidth={width * 2.6}
        strokeLinecap="butt"
        strokeLinejoin="round"
        strokeOpacity={opacity * 0.4}
        style={{ mixBlendMode: "multiply" }}
      />
    );
  }

  if (texture === "paintbrush") {
    const layers = [
      { dx: 0,    dy: 0,    w: width * 1.15, o: opacity * 0.55 },
      { dx: 1.2,  dy: -1,   w: width * 0.9,  o: opacity * 0.35 },
      { dx: -1.1, dy: 1.2,  w: width * 0.75, o: opacity * 0.3 },
    ];
    return (
      <g>
        {layers.map((l, i) => (
          <polyline
            key={`${keyPrefix}-b${i}`}
            points={toStr(points.map((p) => ({ x: p.x + l.dx, y: p.y + l.dy })))}
            fill="none"
            stroke={color}
            strokeWidth={l.w}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeOpacity={l.o}
          />
        ))}
      </g>
    );
  }

  if (texture === "scribbly") {
    const wobble = Math.max(1.5, width * 0.6);
    return (
      <g>
        <polyline
          points={toStr(scribblyPoints(points, wobble))}
          fill="none"
          stroke={color}
          strokeWidth={Math.max(1, width * 0.7)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={opacity}
        />
        <polyline
          points={toStr(scribblyPoints(points, wobble * 1.4))}
          fill="none"
          stroke={color}
          strokeWidth={Math.max(1, width * 0.45)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeOpacity={opacity * 0.55}
        />
      </g>
    );
  }

  // marker (default)
  return (
    <polyline
      points={toStr(points)}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeOpacity={opacity}
    />
  );
}

export function Sketchpad({ onPost }: SketchpadProps = {}) {
  const audioRef = useRef<ReturnType<typeof buildAudio> | null>(null);

  const [strokes,   setStrokes]   = useState<Stroke[]>([]);
  const [current,   setCurrent]   = useState<Stroke | null>(null);
  const [drawing,   setDrawing]   = useState(false);
  const [color,     setColor]     = useState(COLORS[0].value);
  const [cursor,    setCursor]    = useState<Point>({ x: WIDTH / 2, y: HEIGHT / 2 });
  const [soundOn,   setSoundOn]   = useState(false);
  const [announce,  setAnnounce]  = useState(
    "Welcome to Sonic Bear Studio. Press S to start sound, D to toggle drawing, arrow keys to move the brush."
  );
  const [colorIndex, setColorIndex] = useState(0);
  const [penWidth,  setPenWidth]  = useState(3);
  const [penTexture, setPenTexture] = useState<PenTexture>("marker");
  const [penOpacity, setPenOpacity] = useState(1);
  const [guideKey,   setGuideKey]   = useState<string | null>(null);
  const [guidesPanelOpen, setGuidesPanelOpen] = useState(true);
  const [visualAids, setVisualAids] = useState(true);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);
  const [justPosted, setJustPosted] = useState(false);

  const lastCheckpoint = useRef(-1);
  const guideOscRef    = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const trailRef       = useRef<Point[]>([]);
  const navVoiceRef    = useRef<SpeechSynthesisVoice | null>(null);
  const lastNavZone     = useRef<string | null>(null);
  const driftWarnedAt   = useRef<number | null>(null);

  const stats = useCanvasClicks();

  // ── Pick a warm, lady-voiced narrator for canvas navigation ──────────────
  // We prefer a clearly-female English voice (Samantha / Google US English /
  // Microsoft Zira / Jenny, etc). Voice lists load asynchronously in most
  // browsers, so we try immediately and again once `voiceschanged` fires.
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;

    const FEMALE_HINTS = [
      "female", "samantha", "victoria", "zira", "jenny", "aria", "susan",
      "karen", "moira", "tessa", "fiona", "google us english", "google uk english female",
      "hazel", "libby", "sonia", "shelley", "allison",
    ];

    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const englishVoices = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
      const pool = englishVoices.length ? englishVoices : voices;
      const match = pool.find((v) => {
        const name = v.name.toLowerCase();
        return FEMALE_HINTS.some((hint) => name.includes(hint));
      });
      navVoiceRef.current = match ?? pool[0] ?? null;
    };

    pickVoice();
    window.speechSynthesis.addEventListener("voiceschanged", pickVoice);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pickVoice);
  }, []);

  const say = useCallback((msg: string) => {
    setAnnounce(msg);
    // Real spoken narration — independent of the Sound On/Off toggle (that
    // switch only controls the pitch/pan sonification voice). Cancel any
    // utterance in flight so rapid checkpoints don't queue up and stack.
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(msg);
      // A higher pitch + slightly quick, bright rate reads as a cute, warm
      // lady-guide voice, layered on top of whichever female system voice
      // we found (falling back gracefully if none is available).
      utter.rate = 1.05;
      utter.pitch = 1.35;
      if (navVoiceRef.current) utter.voice = navVoiceRef.current;
      window.speechSynthesis.speak(utter);
    }
  }, []);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    audioRef.current = buildAudio();
    return audioRef.current;
  }, []);

  // ── Main draw voice ──────────────────────────────────────────────────────
  const updateAudio = useCallback((p: Point) => {
    const a = audioRef.current;
    if (!a || !soundOn) return;
    const panVal  = (p.x / WIDTH) * 2 - 1;
    // Pitch: gentle pentatonic quantization makes movement always sound musical
    const rawPitch = 220 + (1 - p.y / HEIGHT) * 440;
    const penta    = [1, 1.125, 1.25, 1.5, 1.667]; // major pentatonic ratios
    const base     = 220;
    const octave   = Math.floor(Math.log2(rawPitch / base));
    const normed   = (rawPitch / base) / Math.pow(2, octave);
    const closest  = penta.reduce((b, r) => Math.abs(r - normed) < Math.abs(b - normed) ? r : b);
    const pitch    = base * closest * Math.pow(2, octave);

    a.pan.pan.setTargetAtTime(panVal, a.ctx.currentTime, 0.03);
    a.osc.frequency.setTargetAtTime(pitch, a.ctx.currentTime, 0.04);
    a.gain.gain.setTargetAtTime(drawing ? 0.15 : 0.05, a.ctx.currentTime, 0.04);
  }, [drawing, soundOn]);

  // ── Guide proximity tone ─────────────────────────────────────────────────
  const startGuideTone = useCallback(() => {
    const a = ensureAudio();
    if (guideOscRef.current) return;
    const osc  = a.ctx.createOscillator();
    const gain = a.ctx.createGain();
    // Soft flute-like tone: sine with slight second harmonic
    osc.type = "sine";
    osc.frequency.value = 440;
    gain.gain.value = 0;
    osc.connect(gain).connect(a.ctx.destination);
    osc.start();
    guideOscRef.current = { osc, gain };
  }, [ensureAudio]);

  const stopGuideTone = useCallback(() => {
    const g = guideOscRef.current;
    if (!g) return;
    g.gain.gain.setTargetAtTime(0, g.osc.context.currentTime, 0.08);
    setTimeout(() => { try { g.osc.stop(); } catch { /* already stopped */ } }, 300);
    guideOscRef.current = null;
  }, []);

  const trackGuide = useCallback((p: Point) => {
    if (!guideKey || !soundOn) return;
    const guide = SHAPE_GUIDES[guideKey];
    const { distance, progress } = nearestOnGuide(p, guide);
    const g = guideOscRef.current;
    if (g) {
      // 0 px away = 880 Hz (beautiful high sine); 120 px = 330 Hz (low, "move closer")
      const closeness = Math.max(0, 1 - Math.min(distance, 120) / 120);
      // Map to a pentatonic step so it always sounds melodic even while searching
      const freqs = [330, 370, 415, 494, 554, 660, 740, 880];
      const idx   = Math.round(closeness * (freqs.length - 1));
      const freq  = freqs[idx];
      const vol   = 0.02 + closeness * 0.13;
      g.osc.frequency.setTargetAtTime(freq, g.osc.context.currentTime, 0.06);
      g.gain.gain.setTargetAtTime(vol, g.osc.context.currentTime, 0.06);
    }

    // Haven't reached the template yet — narrate the way there instead of
    // drawing checkpoints. Uses the guide's own starting point as the target.
    const startPt = { x: guide.points[0].x * WIDTH, y: guide.points[0].y * HEIGHT };
    if (distance > ARRIVAL_RADIUS && lastCheckpoint.current < 0) {
      const dx = startPt.x - p.x;
      const dy = startPt.y - p.y;
      const zone = `${dx > 18 ? "r" : dx < -18 ? "l" : ""}${dy > 18 ? "d" : dy < -18 ? "u" : ""}`;
      if (zone !== lastNavZone.current) {
        lastNavZone.current = zone;
        say(`Navigating to the ${guide.name.toLowerCase()} template. ${directionPhrase(dx, dy)} to reach the starting point.`);
      }
      return;
    }

    // Arrived — announce it once, then hand off to checkpoint narration.
    if (lastCheckpoint.current < 0) {
      lastCheckpoint.current = 0;
      lastNavZone.current = null;
      driftWarnedAt.current = null;
      say(`You're on the template! ${guide.checkpoints[0].say}`);
      if (audioRef.current) playSineNote(audioRef.current.ctx, 523, 0.2, 0.08);
      return;
    }

    // Already drawing along the path: if the cursor wanders too far off the
    // line, actively steer it back rather than just going quiet. We nudge
    // the target toward the nearest point slightly *ahead* on the guide so
    // the correction also keeps them moving the right way, not backwards.
    const nearestIdx  = Math.round(progress * (guide.points.length - 1));
    const aheadIdx    = Math.min(guide.points.length - 1, nearestIdx + 4);
    const aheadPt     = { x: guide.points[aheadIdx].x * WIDTH, y: guide.points[aheadIdx].y * HEIGHT };
    const DRIFT_RADIUS = 55;
    const DRIFT_COOLDOWN_MS = 1600;
    if (distance > DRIFT_RADIUS) {
      const now = Date.now();
      if (!driftWarnedAt.current || now - driftWarnedAt.current > DRIFT_COOLDOWN_MS) {
        driftWarnedAt.current = now;
        const dx = aheadPt.x - p.x;
        const dy = aheadPt.y - p.y;
        say(`You're drifting off the line — ${directionPhrase(dx, dy)} to get back on track.`);
      }
      return;
    }
    driftWarnedAt.current = null;

    const cps = guide.checkpoints;
    for (let i = cps.length - 1; i >= 0; i--) {
      if (progress >= cps[i].at && i > lastCheckpoint.current) {
        lastCheckpoint.current = i;
        const praise = PRAISE_PHRASES[i % PRAISE_PHRASES.length];
        const isLast = i === cps.length - 1;
        say(isLast ? `${praise} ${cps[i].say}` : `${cps[i].say} ${praise}`);
        // Play a gentle chime note to signal a checkpoint
        if (audioRef.current) {
          const noteFreqs = [523, 587, 659, 698, 784];
          playSineNote(audioRef.current.ctx, noteFreqs[i % noteFreqs.length], 0.2, 0.08);
        }
        break;
      }
    }
  }, [guideKey, soundOn, say]);

  const startGuide = useCallback((key: string) => {
    stopGuideTone();
    setGuideKey(key);
    lastCheckpoint.current = -1;
    lastNavZone.current = null;
    driftWarnedAt.current = null;
    setGuidesPanelOpen(false);
    startGuideTone();
    const guide = SHAPE_GUIDES[key];
    const startPt = { x: guide.points[0].x * WIDTH, y: guide.points[0].y * HEIGHT };
    const dx = startPt.x - cursor.x;
    const dy = startPt.y - cursor.y;
    if (audioRef.current) playGuideStart(audioRef.current.ctx, 392);
    if (Math.hypot(dx, dy) > ARRIVAL_RADIUS) {
      say(`${guide.name} guide started. Navigating to the template. ${directionPhrase(dx, dy)} to reach the starting point.`);
    } else {
      lastCheckpoint.current = 0;
      say(`${guide.name} guide started. You're on the template. ${guide.checkpoints[0].say}`);
    }
    trackClick();
  }, [startGuideTone, stopGuideTone, say, cursor]);

  const stopGuide = useCallback(() => {
    if (!guideKey) return;
    stopGuideTone();
    say("Guide stopped.");
    setGuideKey(null);
    trackClick();
  }, [guideKey, stopGuideTone, say]);

  // ── Movement ─────────────────────────────────────────────────────────────
  const moveTo = useCallback((next: Point) => {
    let { x, y } = next;
    let hitBorder = false;
    if (x < 0)      { x = 0;      hitBorder = true; }
    if (x > WIDTH)  { x = WIDTH;  hitBorder = true; }
    if (y < 0)      { y = 0;      hitBorder = true; }
    if (y > HEIGHT) { y = HEIGHT; hitBorder = true; }

    const p = { x, y };
    setCursor(p);
    updateAudio(p);
    trackGuide(p);

    if (hitBorder) {
      if (audioRef.current) playEdgeBump(audioRef.current.ctx);
      say("Edge of canvas");
    }

    if (drawing) {
      setCurrent((c) => {
        if (!c) return { color, width: penWidth, points: [p], texture: penTexture, opacity: penOpacity };
        const start = c.points[0];
        const dist  = Math.hypot(p.x - start.x, p.y - start.y);
        if (c.points.length > 6 && dist < 16) {
          if (audioRef.current) playCompleteChime(audioRef.current.ctx);
        }
        return { ...c, points: [...c.points, p] };
      });
    }
  }, [drawing, color, penWidth, penTexture, penOpacity, updateAudio, trackGuide, say]);

  // ── Drawing toggle ────────────────────────────────────────────────────────
  const toggleDrawing = useCallback(() => {
    trackClick();
    setDrawing((d) => {
      const next = !d;
      if (next) {
        setCurrent({ color, width: penWidth, points: [cursor], texture: penTexture, opacity: penOpacity });
        if (audioRef.current) playSineNote(audioRef.current.ctx, 659, 0.15, 0.12);
        say("Drawing on — move to draw");
      } else {
        setCurrent((c) => {
          if (c && c.points.length > 1) setStrokes((s) => [...s, c]);
          return null;
        });
        if (audioRef.current) playSineNote(audioRef.current.ctx, 392, 0.18, 0.10);
        say("Line saved");
      }
      return next;
    });
  }, [color, cursor, penWidth, penTexture, penOpacity, say]);

  // ── Sound toggle ──────────────────────────────────────────────────────────
  const toggleSound = useCallback(() => {
    trackClick();
    setSoundOn((s) => {
      const next = !s;
      if (next) {
        const a = ensureAudio();
        if (a.ctx.state === "suspended") a.ctx.resume();
        playSineNote(a.ctx, 440, 0.2, 0.1, true);
        say("Sound on. Move the brush to explore pitch and left-right panning.");
      } else {
        const a = audioRef.current;
        if (a) a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.05);
        say("Sound off");
      }
      return next;
    });
  }, [ensureAudio, say]);

  // ── Color ─────────────────────────────────────────────────────────────────
  const cycleColor = useCallback((dir: 1 | -1) => {
    setColorIndex((i) => {
      const next = (i + dir + COLORS.length) % COLORS.length;
      const c    = COLORS[next];
      setColor(c.value);
      if (audioRef.current) playSineNote(audioRef.current.ctx, c.tone, 0.2, 0.11, true);
      say(`${c.name}`);
      return next;
    });
    trackClick();
  }, [say]);

  const pickColor = useCallback((c: typeof COLORS[0]) => {
    setColor(c.value);
    setColorIndex(COLORS.indexOf(c));
    if (audioRef.current) playSineNote(audioRef.current.ctx, c.tone, 0.2, 0.11, true);
    say(`Color: ${c.name}`);
    trackClick();
  }, [say]);

  // ── Pen thickness ─────────────────────────────────────────────────────────
  const changePenWidth = useCallback((next: number) => {
    const clamped = Math.max(MIN_PEN_WIDTH, Math.min(MAX_PEN_WIDTH, Math.round(next)));
    setPenWidth((prev) => {
      if (clamped === prev) return prev;
      if (audioRef.current) {
        // Thicker pen = lower tone, thinner pen = higher tone (both still sine, gentle)
        const freq = 300 + (MAX_PEN_WIDTH - clamped) * 30;
        playSineNote(audioRef.current.ctx, freq, 0.12, 0.09);
      }
      say(`Pen thickness ${clamped}`);
      return clamped;
    });
    trackClick();
  }, [say]);

  // ── Canvas ops ────────────────────────────────────────────────────────────
  const clearCanvas = useCallback(() => {
    setStrokes([]);
    setCurrent(null);
    setDrawing(false);
    if (audioRef.current) {
      playSineNote(audioRef.current.ctx, 262, 0.2, 0.08);
      setTimeout(() => audioRef.current && playSineNote(audioRef.current.ctx, 196, 0.25, 0.06), 120);
    }
    say("Canvas cleared");
    trackClick();
  }, [say]);

  const undo = useCallback(() => {
    setStrokes((s) => s.slice(0, -1));
    if (audioRef.current) playSineNote(audioRef.current.ctx, 330, 0.18, 0.09);
    say("Last line removed");
    trackClick();
  }, [say]);

  const toggleVisualAids = useCallback(() => {
    setVisualAids((v) => {
      const next = !v;
      say(next ? "Visual aids on" : "Visual aids off");
      trackClick();
      return next;
    });
  }, [say]);

  // ── Export ────────────────────────────────────────────────────────────────
  const buildSvgString = (highContrast: boolean) => {
    const all = current ? [...strokes, current] : strokes;
    const bg  = highContrast ? "#ffffff" : "#fff5f8";
    const paths = all.map((s) => {
      const d = s.points.map((p, i) =>
        `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`
      ).join(" ");
      const strokeColor = highContrast ? "#000" : s.color;
      const baseW = highContrast ? Math.max(4, s.width + 1) : s.width;

      if (!highContrast && s.texture === "highlighter") {
        const w = baseW * 2.6;
        return `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${w}" stroke-linecap="butt" stroke-linejoin="round" stroke-opacity="${(s.opacity * 0.4).toFixed(2)}" style="mix-blend-mode:multiply"/>`;
      }

      if (!highContrast && s.texture === "paintbrush") {
        const layers = [
          { dx: 0,    dy: 0,    w: baseW * 1.15, o: s.opacity * 0.55 },
          { dx: 1.2,  dy: -1,   w: baseW * 0.9,  o: s.opacity * 0.35 },
          { dx: -1.1, dy: 1.2,  w: baseW * 0.75, o: s.opacity * 0.3 },
        ];
        return layers.map((l) => {
          const dl = s.points.map((p, i) =>
            `${i === 0 ? "M" : "L"}${(p.x + l.dx).toFixed(1)},${(p.y + l.dy).toFixed(1)}`
          ).join(" ");
          return `<path d="${dl}" fill="none" stroke="${strokeColor}" stroke-width="${l.w}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${l.o.toFixed(2)}"/>`;
        }).join("");
      }

      if (!highContrast && s.texture === "scribbly") {
        const wobble = Math.max(1.5, baseW * 0.6);
        const wobblyD = (strength: number) => scribblyPoints(s.points, strength).map((p, i) =>
          `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`
        ).join(" ");
        return (
          `<path d="${wobblyD(wobble)}" fill="none" stroke="${strokeColor}" stroke-width="${Math.max(1, baseW * 0.7)}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${s.opacity.toFixed(2)}"/>` +
          `<path d="${wobblyD(wobble * 1.4)}" fill="none" stroke="${strokeColor}" stroke-width="${Math.max(1, baseW * 0.45)}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${(s.opacity * 0.55).toFixed(2)}"/>`
        );
      }

      // marker (default), and the fallback used for high-contrast exports
      return `<path d="${d}" fill="none" stroke="${strokeColor}" stroke-width="${baseW}" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="${highContrast ? 1 : s.opacity.toFixed(2)}"/>`;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}"><rect width="100%" height="100%" fill="${bg}"/>${paths}</svg>`;
  };

  const dl = (name: string, content: string, type: string) => {
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([content], { type })),
      download: name,
    });
    a.click();
  };

  const exportSwell = () => { dl("sonic-bear-swell.svg", buildSvgString(true),  "image/svg+xml"); say("Exported swell paper SVG"); trackClick(); };
  const exportColor = () => { dl("sonic-bear-color.svg", buildSvgString(false), "image/svg+xml"); say("Exported color SVG");       trackClick(); };

  // ── Post to Gallery ──────────────────────────────────────────────────────
  const hasArtwork = strokes.length > 0 || (!!current && current.points.length > 1);

  const requestPost = useCallback(() => {
    if (!hasArtwork) {
      say("Draw something first, then you can post it to the gallery");
      return;
    }
    setPostConfirmOpen(true);
    trackClick();
  }, [hasArtwork, say]);

  const cancelPost = useCallback(() => {
    setPostConfirmOpen(false);
    say("Post canceled");
  }, [say]);

  const confirmPost = useCallback(() => {
    if (!onPost) return;
    onPost({ svg: buildSvgString(false) });
    setPostConfirmOpen(false);
    setJustPosted(true);
    setTimeout(() => setJustPosted(false), 2200);
    if (audioRef.current) playCompleteChime(audioRef.current.ctx);
    say("Posted to the gallery — visible to everyone");
    trackClick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onPost, strokes, current, say]);

  // ── Keyboard ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (postConfirmOpen) {
        if (e.key === "Escape") { e.preventDefault(); cancelPost(); }
        else if (e.key === "Enter") { e.preventDefault(); confirmPost(); }
        return;
      }
      const step = e.shiftKey ? 30 : 10;
      if      (e.key === "ArrowLeft")  { e.preventDefault(); moveTo({ x: cursor.x - step, y: cursor.y }); }
      else if (e.key === "ArrowRight") { e.preventDefault(); moveTo({ x: cursor.x + step, y: cursor.y }); }
      else if (e.key === "ArrowUp")    { e.preventDefault(); moveTo({ x: cursor.x, y: cursor.y - step }); }
      else if (e.key === "ArrowDown")  { e.preventDefault(); moveTo({ x: cursor.x, y: cursor.y + step }); }
      else if (e.key === " " || e.key.toLowerCase() === "d") { e.preventDefault(); toggleDrawing(); }
      else if (e.key.toLowerCase() === "s") { e.preventDefault(); toggleSound(); }
      else if (e.key.toLowerCase() === "c") { e.preventDefault(); clearCanvas(); }
      else if (e.key.toLowerCase() === "x") { e.preventDefault(); toggleVisualAids(); }
      else if (e.key.toLowerCase() === "g") { e.preventDefault(); setGuidesPanelOpen((o) => !o); say("Guides panel toggled"); }
      else if (e.key.toLowerCase() === "q") { e.preventDefault(); cycleColor(-1); }
      else if (e.key.toLowerCase() === "e") { e.preventDefault(); cycleColor(1); }
      else if (e.key === "[") { e.preventDefault(); changePenWidth(penWidth - 1); }
      else if (e.key === "]") { e.preventDefault(); changePenWidth(penWidth + 1); }
      else if (e.key.toLowerCase() === "escape" && guideKey) { e.preventDefault(); stopGuide(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, moveTo, toggleDrawing, toggleSound, clearCanvas, toggleVisualAids, cycleColor, penWidth, changePenWidth, guideKey, stopGuide, say, postConfirmOpen, cancelPost, confirmPost]);

  // ── Pointer ───────────────────────────────────────────────────────────────
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
    setCurrent({ color, width: penWidth, points: [p], texture: penTexture, opacity: penOpacity });
    updateAudio(p);
    trackClick();
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = svgPoint(e);
    setCursor(p);
    updateAudio(p);
    trackGuide(p);
    if (pointerDrawing.current) {
      setCurrent((c) => c ? { ...c, points: [...c.points, p] } : { color, width: penWidth, points: [p], texture: penTexture, opacity: penOpacity });
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
    say("Line saved");
  };

  const exportStl = () => {
    const all = current ? [...strokes, current] : strokes;
    const H = 3, W = 1.5, scale = 150 / WIDTH;
    const facets: string[] = [];
    const f3 = (n: number[], v1: number[], v2: number[], v3: number[]) =>
      `facet normal ${n.join(" ")}\nouter loop\nvertex ${v1.join(" ")}\nvertex ${v2.join(" ")}\nvertex ${v3.join(" ")}\nendloop\nendfacet`;
    const box = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * W, ny = dx / len * W;
      const a=[x1+nx,y1+ny,0],b=[x1-nx,y1-ny,0],c=[x2+nx,y2+ny,0],d=[x2-nx,y2-ny,0];
      const A=[a[0],a[1],H],B=[b[0],b[1],H],C=[c[0],c[1],H],D=[d[0],d[1],H];
      facets.push(f3([0,0,1],A,C,D),f3([0,0,1],A,D,B));
      facets.push(f3([0,0,-1],a,d,c),f3([0,0,-1],a,b,d));
      [[a,c,C,A],[b,B,D,d],[a,A,B,b],[c,d,D,C]].forEach(([p1,p2,p3,p4])=>{
        facets.push(f3([0,0,0],p1,p2,p3),f3([0,0,0],p1,p3,p4));
      });
    };
    for (const s of all)
      for (let i = 1; i < s.points.length; i++)
        box(s.points[i-1].x*scale,(HEIGHT-s.points[i-1].y)*scale,s.points[i].x*scale,(HEIGHT-s.points[i].y)*scale);
    dl("sonic-bear.stl", `solid sb\n${facets.join("\n")}\nendsolid sb`, "model/stl");
    say("Exported 3D print file");
    trackClick();
  };

  // Trail
  trailRef.current = [...trailRef.current.slice(-14), cursor];

  // Guide path rendered on canvas
  const activeGuide = guideKey ? SHAPE_GUIDES[guideKey] : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_280px]">

      {/* ── Canvas area ── */}
      <div className="rounded-3xl bg-card p-4 shadow-lg ring-1 ring-primary/20">

        {/* Top bar */}
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/20">
            <Sparkles className="h-3.5 w-3.5" />
            {stats.data == null
              ? "Counting canvas drawings…"
              : `${stats.data.toLocaleString()} drawings created worldwide`}
          </div>
          <Button
            onClick={toggleVisualAids}
            variant={visualAids ? "default" : "outline"}
            aria-pressed={visualAids}
            size="sm"
            className="gap-1.5 rounded-full"
          >
            <Eye className="h-3.5 w-3.5" /> Visual aids
            <kbd className="ml-0.5 rounded bg-background/40 px-1 py-0.5 text-[10px]">X</kbd>
          </Button>
        </div>

        {/* Controls */}
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
          <Button onClick={undo}        variant="outline" className="gap-2 rounded-full"><Undo2 className="h-4 w-4" /> Undo</Button>
          <Button onClick={clearCanvas} variant="outline" className="gap-2 rounded-full">
            <Eraser className="h-4 w-4" /> Clear
            <kbd className="ml-1 rounded bg-background/40 px-1.5 py-0.5 text-[10px]">C</kbd>
          </Button>
          {guideKey && (
            <Button onClick={stopGuide} variant="destructive" size="sm" className="gap-1.5 rounded-full">
              <X className="h-3.5 w-3.5" /> Stop guide
              <kbd className="ml-0.5 rounded bg-background/40 px-1 py-0.5 text-[10px]">Esc</kbd>
            </Button>
          )}
        </div>

        {/* SVG Canvas */}
        <svg
          role="img"
          aria-label="Sonic tactile drawing canvas. Use arrow keys to move, space to toggle drawing."
          tabIndex={0}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className={`w-full touch-none rounded-2xl bg-[oklch(0.98_0.02_15)] ${
            visualAids
              ? "ring-4 ring-primary/60 focus-visible:ring-4 focus-visible:ring-primary"
              : "ring-2 ring-primary/40"
          }`}
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
            {/* Glow filter for guide path */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Guide path overlay */}
          {activeGuide && (
            <>
              {/* Wide soft glow */}
              <polyline
                points={activeGuide.points.map((p) => `${p.x * WIDTH},${p.y * HEIGHT}`).join(" ")}
                fill="none"
                stroke="oklch(0.75 0.18 170)"
                strokeWidth={18}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeOpacity={0.12}
              />
              {/* Crisp dashed centre line */}
              <polyline
                points={activeGuide.points.map((p) => `${p.x * WIDTH},${p.y * HEIGHT}`).join(" ")}
                fill="none"
                stroke="oklch(0.72 0.18 170)"
                strokeWidth={2.5}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="8 6"
                strokeOpacity={0.55}
                filter="url(#glow)"
              />
              {/* Checkpoint dots */}
              {activeGuide.checkpoints.map((cp, i) => {
                const idx = Math.round(cp.at * (activeGuide.points.length - 1));
                const pt  = activeGuide.points[idx];
                return (
                  <circle
                    key={i}
                    cx={pt.x * WIDTH}
                    cy={pt.y * HEIGHT}
                    r={i === 0 ? 10 : 6}
                    fill="oklch(0.72 0.18 170)"
                    fillOpacity={i === 0 ? 0.7 : 0.45}
                    stroke="white"
                    strokeWidth={1.5}
                    strokeOpacity={0.6}
                  />
                );
              })}
            </>
          )}

          {/* Drawn strokes */}
          {strokes.map((s, i) => (
            <StrokeShape key={i} stroke={s} keyPrefix={`s${i}`} />
          ))}
          {current && <StrokeShape stroke={current} keyPrefix="cur" />}

          {/* Cursor trail */}
          {visualAids && trailRef.current.map((p, i) => (
            <circle key={i}
              cx={p.x} cy={p.y}
              r={1.5 + (i / trailRef.current.length) * 4}
              fill={color}
              fillOpacity={(i / trailRef.current.length) * 0.28}
            />
          ))}

          {/* Cursor */}
          <circle cx={cursor.x} cy={cursor.y} r={12} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2} />
          <circle cx={cursor.x} cy={cursor.y} r={Math.max(2, penWidth / 2)} fill={color} fillOpacity={penOpacity} />
        </svg>

        <p className="mt-2.5 text-xs text-muted-foreground">
          Left/right pans the sound · Up/down changes pitch · Shift+arrows = bigger steps · Q/E cycle colours · [ ] adjust pen thickness
        </p>

        {/* Audio Guides — moved here from the sidebar so this card doesn't sit
            half-empty next to the taller settings column */}
        <section aria-labelledby="guides-heading" className="mt-4 border-t border-border pt-4">
          <button
            id="guides-heading"
            onClick={() => setGuidesPanelOpen((o) => !o)}
            className="mb-1 flex w-full items-center justify-between text-sm font-semibold"
            aria-expanded={guidesPanelOpen}
          >
            <span className="flex items-center gap-2">
              <Map className="h-4 w-4 text-primary" />
              Audio guides
              <kbd className="rounded bg-muted px-1 py-0.5 text-[10px] font-normal text-muted-foreground">G</kbd>
            </span>
            <ChevronRight className={`h-4 w-4 text-muted-foreground transition-transform ${guidesPanelOpen ? "rotate-90" : ""}`} />
          </button>

          {guideKey && (
            <p className="mb-2 rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary ring-1 ring-primary/20">
              Active: <strong>{SHAPE_GUIDES[guideKey].name}</strong> — move near the glowing path to hear the guide tone
            </p>
          )}

          {guidesPanelOpen && (
            <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(SHAPE_GUIDES).map(([key, guide]) => {
                const { Icon, color } = GUIDE_ICONS[key];
                return (
                  <button
                    key={key}
                    onClick={() => guideKey === key ? stopGuide() : startGuide(key)}
                    className={`flex items-start gap-3 rounded-2xl p-3 text-left transition ring-1 ${
                      guideKey === key
                        ? "bg-primary/15 ring-primary/50 text-primary"
                        : "bg-background/50 ring-border hover:bg-primary/8 hover:ring-primary/30"
                    }`}
                  >
                    <span
                      className="grid h-9 w-9 shrink-0 place-items-center rounded-xl"
                      style={{ backgroundColor: `${color}26` }}
                    >
                      <Icon className="h-4 w-4" style={{ color }} />
                    </span>
                    <div>
                      <div className="text-sm font-medium leading-tight">
                        {guide.name}
                        {guideKey === key && <span className="ml-1.5 text-[10px] font-normal opacity-70">(active — press to stop)</span>}
                      </div>
                      <div className="mt-0.5 text-[11px] text-muted-foreground leading-snug">{guide.description}</div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      {/* ── Sidebar ── */}
      <aside className="space-y-5">

        {/* Palette */}
        <section aria-labelledby="colors-heading" className="rounded-3xl bg-card p-4 shadow-md ring-1 ring-primary/20">
          <h2 id="colors-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Palette className="h-4 w-4 text-primary" /> Palette
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">Q / E to cycle</span>
          </h2>
          <div className="flex flex-wrap gap-2">
            {COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => pickColor(c)}
                aria-label={`Color ${c.name}`}
                aria-pressed={color === c.value}
                className={`h-9 w-9 rounded-full ring-2 transition ${
                  color === c.value ? "scale-110 ring-foreground" : "ring-transparent"
                }`}
                style={{ backgroundColor: c.value }}
              />
            ))}
          </div>
        </section>

        {/* Pen thickness */}
        <section aria-labelledby="pen-heading" className="rounded-3xl bg-card p-4 shadow-md ring-1 ring-primary/20">
          <h2 id="pen-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Pencil className="h-4 w-4 text-primary" /> Pen thickness
            <span className="ml-auto text-[10px] font-normal text-muted-foreground">[ / ] to adjust</span>
          </h2>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => changePenWidth(penWidth - 1)}
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full"
              aria-label="Decrease pen thickness"
            >
              −
            </Button>
            <input
              type="range"
              min={MIN_PEN_WIDTH}
              max={MAX_PEN_WIDTH}
              step={1}
              value={penWidth}
              onChange={(e) => changePenWidth(Number(e.target.value))}
              aria-label="Pen thickness"
              aria-valuemin={MIN_PEN_WIDTH}
              aria-valuemax={MAX_PEN_WIDTH}
              aria-valuenow={penWidth}
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-primary/20 accent-primary"
            />
            <Button
              onClick={() => changePenWidth(penWidth + 1)}
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full"
              aria-label="Increase pen thickness"
            >
              +
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <span
              aria-hidden
              className="inline-block rounded-full"
              style={{ width: Math.max(4, penWidth), height: Math.max(4, penWidth), backgroundColor: color }}
            />
            {penWidth}px
          </div>

          {/* Pen texture */}
          <div className="mt-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Texture
            </h3>
            <div className="grid grid-cols-4 gap-2">
              {PEN_TEXTURES.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    setPenTexture(key);
                    say(`${label} pen selected.`);
                  }}
                  aria-pressed={penTexture === key}
                  aria-label={label}
                  title={label}
                  className={`flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-medium ring-1 transition ${
                    penTexture === key
                      ? "bg-primary/15 text-primary ring-primary/40"
                      : "bg-background/50 text-muted-foreground ring-border hover:bg-primary/8 hover:ring-primary/30"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Pen opacity */}
          <div className="mt-4">
            <h3 className="mb-2 flex items-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Opacity
              <span className="ml-auto font-mono text-[10px] normal-case tracking-normal text-muted-foreground/80">
                {Math.round(penOpacity * 100)}%
              </span>
            </h3>
            <input
              type="range"
              min={10}
              max={100}
              step={5}
              value={Math.round(penOpacity * 100)}
              onChange={(e) => setPenOpacity(Number(e.target.value) / 100)}
              aria-label="Pen opacity"
              aria-valuemin={10}
              aria-valuemax={100}
              aria-valuenow={Math.round(penOpacity * 100)}
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-primary/20 accent-primary"
            />
          </div>
        </section>

        {/* Export */}
        <section aria-labelledby="export-heading" className="rounded-3xl bg-card p-4 shadow-md ring-1 ring-primary/20">
          <h2 id="export-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="h-4 w-4 text-primary" /> Export
          </h2>
          <div className="grid gap-2">
            <Button onClick={exportSwell} className="justify-start gap-2 rounded-full">
              <Waves className="h-4 w-4" /> Swell Paper SVG
            </Button>
            <Button onClick={exportColor} variant="secondary" className="justify-start gap-2 rounded-full">
              <Palette className="h-4 w-4" /> Colour SVG
            </Button>
            <Button onClick={exportStl} variant="outline" className="justify-start gap-2 rounded-full">
              <Box className="h-4 w-4" /> 3D Print (STL)
            </Button>
          </div>
        </section>

        {/* Share */}
        {onPost && (
          <section aria-labelledby="share-heading" className="rounded-3xl bg-card p-4 shadow-md ring-1 ring-primary/20">
            <h2 id="share-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <Globe className="h-4 w-4 text-primary" /> Share
            </h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Post your artwork to the public gallery so creators everywhere can see it.
            </p>
            <Button
              onClick={requestPost}
              disabled={!hasArtwork}
              variant={justPosted ? "secondary" : "default"}
              className="w-full justify-center gap-2 rounded-full"
            >
              {justPosted ? <Check className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
              {justPosted ? "Posted!" : "Post to Gallery"}
            </Button>
          </section>
        )}

        {/* Keyboard reference */}
        <section aria-labelledby="kbd-heading" className="rounded-3xl bg-card p-4 shadow-md ring-1 ring-primary/20 text-xs text-muted-foreground">
          <h2 id="kbd-heading" className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
            <Keyboard className="h-4 w-4 text-primary" /> Keyboard
          </h2>
          <ul className="space-y-1">
            <li>Arrows — move brush (Shift = ×3)</li>
            <li>Space / D — toggle drawing</li>
            <li>S — toggle sound</li>
            <li>C — clear canvas</li>
            <li>Q / E — cycle colour</li>
            <li>[ / ] — pen thickness</li>
            <li>G — open / close guides</li>
            <li>Esc — stop active guide</li>
            <li>X — toggle visual aids</li>
          </ul>
        </section>
      </aside>

      <div aria-live="assertive" role="status" className="sr-only">{announce}</div>

      {/* Post-to-gallery confirmation — a deliberate second step before anything goes public */}
      {postConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="post-confirm-heading"
          className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm"
        >
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-xl ring-1 ring-primary/20">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Globe className="h-6 w-6" />
            </div>
            <h2 id="post-confirm-heading" className="mt-4 text-lg font-bold text-foreground">
              Post this to the gallery?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Your artwork will become public — anyone around the world will be able to see it on the Gallery page.
            </p>
            <div className="mt-5 flex gap-2">
              <Button onClick={cancelPost} variant="outline" className="flex-1 rounded-full">
                Cancel
                <kbd className="ml-1.5 rounded bg-background/40 px-1 py-0.5 text-[10px]">Esc</kbd>
              </Button>
              <Button onClick={confirmPost} className="flex-1 gap-2 rounded-full">
                <Globe className="h-4 w-4" /> Yes, post it
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
