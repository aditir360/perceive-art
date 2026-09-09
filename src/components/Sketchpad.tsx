import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { trackClick, useCanvasClicks } from "@/lib/usage";
import bearSleeping from "@/assets/bear_sleeping.png";
import bearDrawing from "@/assets/bear_drawing.png";
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
  PenLine,
  Highlighter,
  Paintbrush,
  Minus,
  Plus,
  Infinity as InfinityIcon,
  Zap,
  Flower2,
  TrendingUp,
  Bell,
  Music2,
  Wind,
} from "lucide-react";

type SoundStyle = "sine" | "pad" | "chime" | "marimba";
const SOUND_STYLE_ORDER: SoundStyle[] = ["sine", "pad", "chime", "marimba"];
const SOUND_STYLE_LABELS: Record<SoundStyle, string> = {
  sine: "Warm Tone",
  pad: "Soft Pad",
  chime: "Wind Chime",
  marimba: "Marimba",
};
const SOUND_STYLE_ICONS: Record<SoundStyle, typeof Bell> = {
  sine: Waves,
  pad: Wind,
  chime: Bell,
  marimba: Music2,
};

const TEXTURE_ICONS: Record<Texture, typeof PenLine> = {
  pen: PenLine,
  pencil: Pencil,
  highlighter: Highlighter,
  paintbrush: Paintbrush,
};

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
  // ── Advanced guides: more direction changes, sharper turns, and (for the
  // infinity loop) a self-crossing path — noticeably harder to trace than
  // the beginner set above. ──────────────────────────────────────────────
  infinity:  { Icon: InfinityIcon, color: "#5b5ea6" }, // Indigo
  lightning: { Icon: Zap,          color: "#f5a623" }, // Sun
  flower:    { Icon: Flower2,      color: "#f9a8a8" }, // Peach
  staircase: { Icon: TrendingUp,   color: "#3fb8af" }, // Teal
};

type Point = { x: number; y: number };
type Texture = "pen" | "pencil" | "highlighter" | "paintbrush";
type Stroke = { color: string; width: number; opacity: number; texture: Texture; points: Point[] };

// Shared thickness range across all four textures — one slider, applied to
// whichever texture is currently selected (each texture remembers its own
// width/opacity independently; see textureSettings below).
const MIN_PEN_WIDTH = 1;
const MAX_PEN_WIDTH = 40; // wide enough for a genuinely boxy highlighter stroke
const OPACITY_STEP = 0.1;

// Opacity range is per-texture: pen/highlighter/paintbrush can go all the way
// down to faint, but graphite realistically never looks that washed out, so
// pencil's floor (and this ceiling, already the max possible) sit higher —
// its whole slider stays in a darker band.
const MIN_PEN_OPACITY = 0.1;
const MAX_PEN_OPACITY = 1;
const MIN_PENCIL_OPACITY = 0.55;
const MAX_PENCIL_OPACITY = 1;

const OPACITY_RANGE: Record<Texture, { min: number; max: number }> = {
  pen: { min: MIN_PEN_OPACITY, max: MAX_PEN_OPACITY },
  pencil: { min: MIN_PENCIL_OPACITY, max: MAX_PENCIL_OPACITY },
  highlighter: { min: MIN_PEN_OPACITY, max: MAX_PEN_OPACITY },
  paintbrush: { min: MIN_PEN_OPACITY, max: MAX_PEN_OPACITY },
};

const TEXTURE_ORDER: Texture[] = ["pen", "pencil", "highlighter", "paintbrush"];
const TEXTURE_LABELS: Record<Texture, string> = { pen: "Pen", pencil: "Pencil", highlighter: "Highlighter", paintbrush: "Paintbrush" };
const TEXTURE_TONES: Record<Texture, number> = { pen: 440, pencil: 349.23, highlighter: 622.25, paintbrush: 523.25 };

const DEFAULT_TEXTURE_SETTINGS: Record<Texture, { width: number; opacity: number }> = {
  pen: { width: 3, opacity: 1 },
  pencil: { width: 2, opacity: 0.85 },
  highlighter: { width: 18, opacity: 0.35 },
  paintbrush: { width: 8, opacity: 0.9 },
};

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

// Hysteresis for the "off course" guide warning: enter the warned state once
// you're this far from the path, and don't clear it again until you're back
// within the (smaller) exit distance. The gap between the two stops the
// warning from firing repeatedly if you're drawing right at the boundary.
const OFF_COURSE_ENTER = 70;
const OFF_COURSE_EXIT  = 45;

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

  // ── Advanced guides ──────────────────────────────────────────────────────
  // These are intentionally harder than the shapes above: more direction
  // changes packed into the same space, sharper corners, and — for
  // "infinity" — a path that crosses itself, which means the nearest-point
  // search can briefly jump between the two lobes. Good next step once the
  // basic shapes feel easy.
  infinity: {
    name: "Infinity",
    description: "A figure-eight that loops and crosses itself in the middle",
    emoji: "♾️",
    points: Array.from({ length: 96 }, (_, i) => {
      const t = (i / 96) * Math.PI * 2;
      const denom = 1 + Math.sin(t) * Math.sin(t);
      return norm(0.5 + (0.34 * Math.cos(t)) / denom, 0.5 + (0.22 * Math.sin(t) * Math.cos(t)) / denom);
    }),
    checkpoints: [
      { at: 0,    say: "Start at the rightmost point. Curve left into the right loop." },
      { at: 0.25, say: "Crossing through the center — head into the left loop now." },
      { at: 0.5,  say: "Leftmost point of the figure eight — curve back toward the center." },
      { at: 0.75, say: "Crossing the center a second time — curve into the right loop to finish." },
      { at: 0.95, say: "Almost done — close the loop back at the rightmost point." },
    ],
  },
  lightning: {
    name: "Lightning Bolt",
    description: "A jagged zigzag with sharp, sudden turns",
    emoji: "⚡",
    points: [
      norm(0.08, 0.80),
      norm(0.22, 0.20),
      norm(0.36, 0.80),
      norm(0.50, 0.20),
      norm(0.64, 0.80),
      norm(0.78, 0.20),
      norm(0.92, 0.80),
    ],
    checkpoints: [
      { at: 0,     say: "Start at the bottom-left. Draw a sharp diagonal line up and to the right." },
      { at: 0.166, say: "Sharp turn — now angle down and to the right." },
      { at: 0.333, say: "Sharp turn again — back up and to the right." },
      { at: 0.5,   say: "Halfway across — turn sharply down and to the right." },
      { at: 0.666, say: "Turn sharply up and to the right once more." },
      { at: 0.833, say: "One more sharp turn — angle down and to the right." },
      { at: 0.95,  say: "Almost there — finish the zigzag at the bottom-right." },
    ],
  },
  flower: {
    name: "Flower",
    description: "Five petals that each loop out from the center and back",
    emoji: "🌸",
    points: Array.from({ length: 120 }, (_, i) => {
      const t = (i / 120) * Math.PI;
      const r = 0.34 * Math.cos(5 * t);
      return norm(0.5 + r * Math.cos(t), 0.5 + r * Math.sin(t));
    }),
    checkpoints: [
      { at: 0,    say: "Start at the tip of the first petal. Curve inward toward the center." },
      { at: 0.2,  say: "Back at the center — curve outward into the second petal and back." },
      { at: 0.4,  say: "Third petal now — out from the center and back in." },
      { at: 0.6,  say: "Fourth petal — keep the curves smooth and even." },
      { at: 0.8,  say: "Final petal — out and back one last time." },
      { at: 0.95, say: "Closing the last petal back at the starting tip." },
    ],
  },
  staircase: {
    name: "Staircase",
    description: "A run of right-angle steps climbing up to the right",
    emoji: "🪜",
    points: [
      norm(0.15, 0.85),
      norm(0.15, 0.65),
      norm(0.35, 0.65),
      norm(0.35, 0.45),
      norm(0.55, 0.45),
      norm(0.55, 0.25),
      norm(0.75, 0.25),
      norm(0.75, 0.15),
      norm(0.90, 0.15),
    ],
    checkpoints: [
      { at: 0,     say: "Start at the bottom of the stairs. Draw straight up for the first step." },
      { at: 0.125, say: "Turn — draw straight right." },
      { at: 0.25,  say: "Turn — draw straight up again." },
      { at: 0.375, say: "Turn — draw straight right." },
      { at: 0.5,   say: "Halfway up the staircase — turn and draw straight up." },
      { at: 0.625, say: "Turn — draw straight right." },
      { at: 0.75,  say: "Turn — one more short step up." },
      { at: 0.95,  say: "Final stretch — draw right to reach the top of the stairs." },
    ],
  },
};

function nearestOnGuide(p: Point, guide: ShapeGuide): { distance: number; progress: number; point: Point } {
  const pts = guide.points.map((n) => ({ x: n.x * WIDTH, y: n.y * HEIGHT }));
  let best = Infinity;
  let bestIdx = 0;
  for (let i = 0; i < pts.length; i++) {
    const d = Math.hypot(p.x - pts[i].x, p.y - pts[i].y);
    if (d < best) { best = d; bestIdx = i; }
  }
  return { distance: best, progress: bestIdx / (pts.length - 1), point: pts[bestIdx] };
}

// Turns a vector from the drawer's current position to the nearest point on
// the guide path into a plain-language compass direction — this is what
// lets the guide voice say *how* to get back, not just that you've strayed.
// Screen Y grows downward, so "up" means a negative dy.
function describeDirection(from: Point, to: Point): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.hypot(dx, dy) < 1) return "right where you are";
  const angle = Math.atan2(dy, dx); // radians, 0 = right, +Y down
  const deg = (angle * 180) / Math.PI;
  // 8-way compass bucketed into 45° wedges
  if (deg >= -22.5 && deg < 22.5)   return "right";
  if (deg >= 22.5 && deg < 67.5)    return "down and to the right";
  if (deg >= 67.5 && deg < 112.5)   return "down";
  if (deg >= 112.5 && deg < 157.5)  return "down and to the left";
  if (deg >= -67.5 && deg < -22.5)  return "up and to the right";
  if (deg >= -112.5 && deg < -67.5) return "up";
  if (deg >= -157.5 && deg < -112.5) return "up and to the left";
  return "left";
}

// Rough, friendly magnitude so the voice can say how far, not just which way.
function describeDistance(px: number): string {
  if (px < 90)  return "just a little";
  if (px < 160) return "a bit";
  return "quite a ways";
}

// Small pools of alternate phrasings so the guide doesn't sound like a
// broken record when the same event (off-course, back on track, checkpoint
// praise) fires over and over during a single drawing session.
const OFF_COURSE_INTROS = [
  "Whoops, you've wandered off the path.",
  "Hang on, you're off the line.",
  "Uh-oh, you've drifted a bit.",
];
const BACK_ON_TRACK_LINES = [
  "Yes! Right back on track.",
  "There you go — nailed it.",
  "Perfect, found it again.",
];
const CHECKPOINT_PRAISE = [
  "Nice work!",
  "You're doing great!",
  "Love it!",
  "Keep going, you've got this!",
  "Beautiful!",
];

function pickVaried(pool: string[], avoid: string): string {
  const options = pool.filter((s) => s !== avoid);
  return options[Math.floor(Math.random() * options.length)] ?? pool[0];
}

// Per-texture rendering: highlighter gets boxy caps/joins plus a multiply
// blend so overlapping strokes darken like a real marker; pencil gets a
// grainy displacement filter for a rough, hand-drawn edge; pen stays plain.
function textureVisualProps(texture: Texture): {
  strokeLinecap: "round" | "square";
  strokeLinejoin: "round" | "miter";
  filter?: string;
  style?: React.CSSProperties;
} {
  switch (texture) {
    case "highlighter":
      return { strokeLinecap: "square", strokeLinejoin: "miter", style: { mixBlendMode: "multiply" } };
    case "pencil":
      return { strokeLinecap: "round", strokeLinejoin: "round", filter: "url(#pencilTexture)" };
    case "paintbrush":
      return { strokeLinecap: "round", strokeLinejoin: "round", filter: "url(#brushSoften)" };
    default:
      return { strokeLinecap: "round", strokeLinejoin: "round" };
  }
}

type BrushDab = { cx: number; cy: number; rx: number; ry: number; rotation: number };

// Real brush strokes blot slightly wider where the bristles first touch down
// and lift off, tapering elsewhere. This computes 1–2 soft, elongated dabs
// (oriented along the direction of travel) to overlay at a paintbrush
// stroke's start and end points — the line body itself is drawn normally.
function getBrushDabs(s: Stroke): BrushDab[] {
  if (s.texture !== "paintbrush" || s.points.length === 0) return [];
  const angleDeg = (a: Point, b: Point) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;
  const rx = Math.max(1.2, s.width * 0.75);
  const ry = Math.max(1, s.width * 0.5);

  if (s.points.length === 1) {
    const p = s.points[0];
    const r = Math.max(1, s.width * 0.6);
    return [{ cx: p.x, cy: p.y, rx: r, ry: r, rotation: 0 }];
  }

  const start = s.points[0];
  const startNext = s.points[1];
  const end = s.points[s.points.length - 1];
  const endPrev = s.points[s.points.length - 2];

  return [
    { cx: start.x, cy: start.y, rx, ry, rotation: angleDeg(start, startNext) },
    { cx: end.x, cy: end.y, rx, ry, rotation: angleDeg(endPrev, end) },
  ];
}

// ── Pleasant audio helpers ────────────────────────────────────────────────────
// All synthesis uses sine/triangle waves + light attack/release envelopes and
// a lowpass filter to take the edge off — no raw sawtooth/square anywhere,
// and no unfiltered high-frequency sine either (that's what reads as
// "irritating": a bright, buzzy, unchanging drone).

function buildAudio() {
  const Ctor: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();

  // Main draw voice: two gently detuned sines (a soft chorus, for warmth)
  // through a lowpass filter, then a short, filtered slapback echo instead
  // of a raw feedback comb — the old version let the delay's feedback ring
  // on itself with no filtering, which is what made it sound metallic.
  const osc    = ctx.createOscillator();
  const osc2   = ctx.createOscillator();
  const mix    = ctx.createGain();
  const gain   = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const pan    = ctx.createStereoPanner();
  const delay  = ctx.createDelay(0.3);
  const fbFilt = ctx.createBiquadFilter();
  const fb     = ctx.createGain();
  const wet    = ctx.createGain();

  osc.type  = "sine";
  osc2.type = "sine";
  osc.frequency.value  = 440;
  osc2.frequency.value = 440;
  osc2.detune.value    = 6; // cents — subtle chorus, not a beating warble
  mix.gain.value  = 0.5;
  gain.gain.value = 0;
  filter.type = "lowpass";
  filter.frequency.value = 1800;
  filter.Q.value = 0.4;
  delay.delayTime.value = 0.16;
  fbFilt.type = "lowpass";
  fbFilt.frequency.value = 1200; // keeps the echo from building up brightness/ringing
  fb.gain.value  = 0.16;
  wet.gain.value = 0.14;

  osc.connect(mix);
  osc2.connect(mix);
  mix.connect(gain);
  gain.connect(filter);
  filter.connect(pan);
  pan.connect(ctx.destination);
  // Soft, filtered slapback tail
  filter.connect(delay);
  delay.connect(fbFilt);
  fbFilt.connect(fb);
  fb.connect(delay);
  delay.connect(wet);
  wet.connect(ctx.destination);

  osc.start();
  osc2.start();
  return { ctx, osc, osc2, gain, pan, filter };
}

// Plucked/chime-style note for the percussive canvas-sound styles: a short
// decaying tone with its own panner, so rapid notes can overlap cleanly
// instead of fighting over one continuously-sliding oscillator.
function pluckNote(ctx: AudioContext, freq: number, panVal: number, style: "chime" | "marimba", volume: number) {
  const osc    = ctx.createOscillator();
  const gain   = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const panner = ctx.createStereoPanner();
  const isMarimba = style === "marimba";

  osc.type = isMarimba ? "triangle" : "sine";
  osc.frequency.value = freq;
  filter.type = "lowpass";
  filter.frequency.value = isMarimba ? 2200 : 3400;
  panner.pan.value = Math.max(-1, Math.min(1, panVal));

  const now  = ctx.currentTime;
  const peak = Math.max(0.001, volume * (isMarimba ? 0.22 : 0.16));
  const tail = isMarimba ? 0.32 : 0.65;
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(peak, now + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + tail);

  osc.connect(filter);
  filter.connect(gain);
  gain.connect(panner);
  panner.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + tail + 0.05);
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

export function Sketchpad({ onPost }: SketchpadProps = {}) {
  const audioRef = useRef<ReturnType<typeof buildAudio> | null>(null);

  const [strokes,   setStrokes]   = useState<Stroke[]>([]);
  const [current,   setCurrent]   = useState<Stroke | null>(null);
  const [drawing,   setDrawing]   = useState(false);
  const [color,     setColor]     = useState(COLORS[0].value);
  const [cursor,    setCursor]    = useState<Point>({ x: WIDTH / 2, y: HEIGHT / 2 });
  const [soundOn,   setSoundOn]   = useState(false);
  const [soundStyle, setSoundStyle] = useState<SoundStyle>("sine");
  const [soundVolume, setSoundVolume] = useState(0.7);
  const soundStyleRef  = useRef(soundStyle);
  const soundVolumeRef = useRef(soundVolume);
  useEffect(() => { soundStyleRef.current = soundStyle; }, [soundStyle]);
  useEffect(() => { soundVolumeRef.current = soundVolume; }, [soundVolume]);
  const lastPluckAt  = useRef(0);
  const lastPluckPos = useRef<Point | null>(null);
  const [announce,  setAnnounce]  = useState(
    "Hey, Bennett here! Press S for sound, Space to start drawing, and the arrow keys to move me around the canvas."
  );
  const [colorIndex, setColorIndex] = useState(0);
  const [texture, setTexture] = useState<Texture>("pen");
  const [textureSettings, setTextureSettings] = useState(DEFAULT_TEXTURE_SETTINGS);
  // Derived, not stored directly: always reflects whichever texture is
  // currently selected, so every existing thickness/opacity usage below
  // (sliders, stroke creation, cursor preview) automatically applies to the
  // active texture without needing to know textures exist.
  const penWidth = textureSettings[texture].width;
  const penOpacity = textureSettings[texture].opacity;
  const [guideKey,   setGuideKey]   = useState<string | null>(null);
  const [guidesPanelOpen, setGuidesPanelOpen] = useState(true);
  const [keyboardPanelOpen, setKeyboardPanelOpen] = useState(false);
  const [visualAids, setVisualAids] = useState(true);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);
  const [justPosted, setJustPosted] = useState(false);

  const lastCheckpoint = useRef(-1);
  const guideOscRef    = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const trailRef       = useRef<Point[]>([]);
  const offCourseRef   = useRef(false);
  // Guide-voice smarts: throttles repeated off-course reminders, avoids
  // repeating the exact same phrase twice in a row, and makes sure the
  // "you finished the shape" cheer only fires once per guide run.
  const lastOffCourseSayAt = useRef(0);
  const lastOffCourseIntro = useRef("");
  const lastBackOnTrackLine = useRef("");
  const lastPraiseLine = useRef("");
  const guideCompletedRef = useRef(false);

  const stats = useCanvasClicks();

  // Try to find a more youthful/cheerful system voice for Bennett. Voice
  // lists load asynchronously in most browsers, so we grab them once now
  // and again on the voiceschanged event, then cache the pick in a ref.
  const bennettVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const pickVoice = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      // Prefer anything explicitly child/kid-like, then a light/cheerful-
      // sounding named voice, then just fall back to the first English voice
      // — pitch/rate below do most of the "cute bear" work regardless.
      const byName = (re: RegExp) => voices.find((v) => re.test(v.name));
      const pick =
        byName(/child|kid|junior/i) ||
        byName(/samantha|karen|moira|tessa|fiona|veena/i) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0];
      bennettVoiceRef.current = pick ?? null;
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
      if (bennettVoiceRef.current) utter.voice = bennettVoiceRef.current;
      // Higher pitch reads as "small, cheerful bear cub", but pushing it too
      // far (or speaking too fast) starts to hurt intelligibility — dialed
      // both back slightly so it's still clearly Bennett, just easier to
      // make out.
      utter.rate  = 1.0;
      utter.pitch = 1.4;
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
    const vol      = soundVolumeRef.current;
    const style    = soundStyleRef.current;

    if (style === "chime" || style === "marimba") {
      // Percussive styles: keep the continuous oscillator silent and instead
      // trigger short, decaying notes as the brush actually moves — this is
      // what makes them feel like a wind chime / marimba instead of a drone.
      a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.05);
      const now = performance.now();
      const moved = lastPluckPos.current ? Math.hypot(p.x - lastPluckPos.current.x, p.y - lastPluckPos.current.y) : Infinity;
      const minGapMs = style === "marimba" ? 90 : 140;
      const minMovePx = style === "marimba" ? 10 : 16;
      if (drawing && moved > minMovePx && now - lastPluckAt.current > minGapMs) {
        lastPluckAt.current = now;
        lastPluckPos.current = p;
        pluckNote(a.ctx, pitch, panVal, style, vol);
      }
      return;
    }

    // Continuous styles (warm tone / soft pad): softer filter cutoff and a
    // slower glide for "pad" so pitch changes drift instead of snapping.
    const glide = style === "pad" ? 0.12 : 0.05;
    a.filter.frequency.setTargetAtTime(style === "pad" ? 1100 : 2000, a.ctx.currentTime, 0.1);
    a.pan.pan.setTargetAtTime(panVal, a.ctx.currentTime, 0.03);
    a.osc.frequency.setTargetAtTime(pitch, a.ctx.currentTime, glide);
    a.osc2.frequency.setTargetAtTime(pitch, a.ctx.currentTime, glide);
    a.gain.gain.setTargetAtTime((drawing ? 0.15 : 0.05) * vol, a.ctx.currentTime, 0.04);
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
    const { distance, progress, point: nearestPt } = nearestOnGuide(p, guide);

    // "You've moved off course" — now tells you which way and how far to
    // move to get back, instead of just flagging that you've strayed.
    // Edge-triggered on first crossing the threshold (hysteresis; see
    // thresholds above), then re-announced every few seconds *with an
    // updated direction* for as long as you stay off course, since where
    // you need to head can change as you keep moving.
    const now = Date.now();
    if (!offCourseRef.current && distance > OFF_COURSE_ENTER) {
      offCourseRef.current = true;
      lastOffCourseSayAt.current = now;
      const intro = pickVaried(OFF_COURSE_INTROS, lastOffCourseIntro.current);
      lastOffCourseIntro.current = intro;
      const dir = describeDirection(p, nearestPt);
      const far = describeDistance(distance);
      say(`${intro} Move ${dir}, ${far}, and you'll be right back on the ${guide.name.toLowerCase()} line.`);
      if (audioRef.current) playEdgeBump(audioRef.current.ctx);
    } else if (offCourseRef.current && distance < OFF_COURSE_EXIT) {
      offCourseRef.current = false;
      const line = pickVaried(BACK_ON_TRACK_LINES, lastBackOnTrackLine.current);
      lastBackOnTrackLine.current = line;
      say(line);
    } else if (offCourseRef.current && now - lastOffCourseSayAt.current > 4000) {
      // Still off course after a while — give a fresh directional nudge
      // rather than staying silent or nagging every frame.
      lastOffCourseSayAt.current = now;
      const dir = describeDirection(p, nearestPt);
      const far = describeDistance(distance);
      say(`I'm still with you — head ${dir}, ${far}.`);
    }

    const g = guideOscRef.current;
    if (g) {
      // 0 px away = 880 Hz (beautiful high sine); 120 px = 330 Hz (low, "move closer")
      const closeness = Math.max(0, 1 - Math.min(distance, 120) / 120);
      // Map to a pentatonic step so it always sounds melodic even while searching
      const freqs = [330, 370, 415, 494, 554, 660, 740, 880];
      const idx   = Math.round(closeness * (freqs.length - 1));
      const freq  = freqs[idx];
      const vol   = (0.02 + closeness * 0.13) * soundVolumeRef.current;
      g.osc.frequency.setTargetAtTime(freq, g.osc.context.currentTime, 0.06);
      g.gain.gain.setTargetAtTime(vol, g.osc.context.currentTime, 0.06);
    }

    const cps = guide.checkpoints;
    for (let i = cps.length - 1; i >= 0; i--) {
      if (progress >= cps[i].at && i > lastCheckpoint.current) {
        lastCheckpoint.current = i;
        // Interactive praise on every checkpoint after the first (the
        // first is just the opening instruction, nothing to praise yet).
        if (i > 0 && !offCourseRef.current) {
          const praise = pickVaried(CHECKPOINT_PRAISE, lastPraiseLine.current);
          lastPraiseLine.current = praise;
          say(`${praise} ${cps[i].say}`);
        } else {
          say(cps[i].say);
        }
        // Play a gentle chime note to signal a checkpoint
        if (audioRef.current) {
          const noteFreqs = [523, 587, 659, 698, 784];
          playSineNote(audioRef.current.ctx, noteFreqs[i % noteFreqs.length], 0.2, 0.08);
        }
        break;
      }
    }

    // Shape complete — fires once, near the very end of the path while
    // still close enough to the line to count as actually finishing it.
    if (!guideCompletedRef.current && progress >= 0.97 && distance < OFF_COURSE_EXIT) {
      guideCompletedRef.current = true;
      say(`You did it! That's a perfect ${guide.name.toLowerCase()}. Press stop guide, or trace it again with me.`);
      if (audioRef.current) playCompleteChime(audioRef.current.ctx);
    }
  }, [guideKey, soundOn, say]);

  const startGuide = useCallback((key: string) => {
    stopGuideTone();
    setGuideKey(key);
    lastCheckpoint.current = -1;
    offCourseRef.current = false;
    guideCompletedRef.current = false;
    lastOffCourseSayAt.current = 0;
    lastOffCourseIntro.current = "";
    lastBackOnTrackLine.current = "";
    lastPraiseLine.current = "";
    setGuidesPanelOpen(false);
    startGuideTone();
    const guide = SHAPE_GUIDES[key];
    if (audioRef.current) playGuideStart(audioRef.current.ctx, 392);
    say(`Let's trace a ${guide.name.toLowerCase()} together! ${guide.checkpoints[0].say} Get close to the glowing line and I'll hum louder the closer you get.`);
    trackClick();
  }, [startGuideTone, stopGuideTone, say]);

  const stopGuide = useCallback(() => {
    if (!guideKey) return;
    stopGuideTone();
    offCourseRef.current = false;
    say("Guide stopped — nice tracing!");
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
      say("Whoa, that's the edge!");
    }

    if (drawing) {
      setCurrent((c) => {
        if (!c) return { color, width: penWidth, opacity: penOpacity, texture, points: [p] };
        const start = c.points[0];
        const dist  = Math.hypot(p.x - start.x, p.y - start.y);
        if (c.points.length > 6 && dist < 16) {
          if (audioRef.current) playCompleteChime(audioRef.current.ctx);
        }
        return { ...c, points: [...c.points, p] };
      });
    }
  }, [drawing, color, penWidth, penOpacity, texture, updateAudio, trackGuide, say]);

  // ── Drawing toggle ────────────────────────────────────────────────────────
  const toggleDrawing = useCallback(() => {
    trackClick();
    setDrawing((d) => {
      const next = !d;
      if (next) {
        setCurrent({ color, width: penWidth, opacity: penOpacity, texture, points: [cursor] });
        if (audioRef.current) playSineNote(audioRef.current.ctx, 659, 0.15, 0.12);
        say("Drawing on — go ahead, I'm right here with you.");
      } else {
        setCurrent((c) => {
          if (c && c.points.length > 1) setStrokes((s) => [...s, c]);
          return null;
        });
        if (audioRef.current) playSineNote(audioRef.current.ctx, 392, 0.18, 0.10);
        say("Nice line! Saved it.");
      }
      return next;
    });
  }, [color, cursor, penWidth, penOpacity, texture, say]);

  // ── Sound toggle ──────────────────────────────────────────────────────────
  const toggleSound = useCallback(() => {
    trackClick();
    setSoundOn((s) => {
      const next = !s;
      if (next) {
        const a = ensureAudio();
        if (a.ctx.state === "suspended") a.ctx.resume();
        playSineNote(a.ctx, 440, 0.2, 0.1, true);
        say("Sound on! Move around and I'll turn it into music.");
      } else {
        const a = audioRef.current;
        if (a) a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.05);
        say("Sound's off.");
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

  // ── Pen thickness (applies to whichever texture is active) ─────────────────
  const changePenWidth = useCallback((next: number) => {
    const clamped = Math.max(MIN_PEN_WIDTH, Math.min(MAX_PEN_WIDTH, Math.round(next)));
    setTextureSettings((prev) => {
      if (clamped === prev[texture].width) return prev;
      if (audioRef.current) {
        // Thicker = lower tone, thinner = higher tone (both still sine, gentle)
        const freq = 300 + (MAX_PEN_WIDTH - clamped) * 6;
        playSineNote(audioRef.current.ctx, freq, 0.12, 0.09);
      }
      say(`${TEXTURE_LABELS[texture]} thickness ${clamped}`);
      return { ...prev, [texture]: { ...prev[texture], width: clamped } };
    });
    trackClick();
  }, [texture, say]);

  // ── Pen opacity (applies to whichever texture is active) ───────────────────
  const changePenOpacity = useCallback((next: number) => {
    const { min, max } = OPACITY_RANGE[texture];
    // Round to the nearest step to avoid floating-point drift (e.g. 0.30000000000000004)
    const stepped = Math.round(next / OPACITY_STEP) * OPACITY_STEP;
    const clamped = Math.round(Math.max(min, Math.min(max, stepped)) * 100) / 100;
    setTextureSettings((prev) => {
      if (clamped === prev[texture].opacity) return prev;
      if (audioRef.current) {
        // Softer/more transparent = quieter cue, fully opaque = fuller volume — mirrors the visual
        playSineNote(audioRef.current.ctx, 500, 0.12, 0.04 + clamped * 0.08);
      }
      say(`${TEXTURE_LABELS[texture]} opacity ${Math.round(clamped * 100)} percent`);
      return { ...prev, [texture]: { ...prev[texture], opacity: clamped } };
    });
    trackClick();
  }, [texture, say]);

  // ── Texture ──────────────────────────────────────────────────────────────
  const changeTexture = useCallback((next: Texture) => {
    setTexture((prev) => {
      if (prev === next) return prev;
      if (audioRef.current) playSineNote(audioRef.current.ctx, TEXTURE_TONES[next], 0.16, 0.11, true);
      say(`${TEXTURE_LABELS[next]} selected`);
      return next;
    });
    trackClick();
  }, [say]);

  const cycleTexture = useCallback(() => {
    const i = TEXTURE_ORDER.indexOf(texture);
    changeTexture(TEXTURE_ORDER[(i + 1) % TEXTURE_ORDER.length]);
  }, [texture, changeTexture]);

  // ── Canvas ops ────────────────────────────────────────────────────────────
  const clearCanvas = useCallback(() => {
    setStrokes([]);
    setCurrent(null);
    setDrawing(false);
    if (audioRef.current) {
      playSineNote(audioRef.current.ctx, 262, 0.2, 0.08);
      setTimeout(() => audioRef.current && playSineNote(audioRef.current.ctx, 196, 0.25, 0.06), 120);
    }
    say("All clear! Ready for a fresh drawing.");
    trackClick();
  }, [say]);

  const undo = useCallback(() => {
    setStrokes((s) => s.slice(0, -1));
    if (audioRef.current) playSineNote(audioRef.current.ctx, 330, 0.18, 0.09);
    say("Oops, undone! Let's try that again.");
    trackClick();
  }, [say]);

  const toggleVisualAids = useCallback(() => {
    setVisualAids((v) => {
      const next = !v;
      say(next ? "Visual aids are on! I've got you." : "Visual aids off — I'll guide you by sound.");
      trackClick();
      return next;
    });
  }, [say]);

  // ── Export ────────────────────────────────────────────────────────────────
  const buildSvgString = (highContrast: boolean) => {
    const all = current ? [...strokes, current] : strokes;
    const bg  = highContrast ? "#ffffff" : "#fff5f8";
    // Swell paper is a raised/not-raised tactile surface, so blend modes,
    // grainy edges, and blur aren't meaningful there — every stroke's line
    // embosses the same plain way regardless of on-screen settings. The
    // brush dab *shapes* still appear in both modes, though — they're real
    // stroke geometry, not just a visual filter.
    const defsExtra = highContrast ? "" : `<defs><filter id="pencilTexture" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves="3" seed="7" result="grain"/><feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.33 0.33 0.33 0 0" result="grainAlpha"/><feComponentTransfer in="grainAlpha" result="grainMask"><feFuncA type="discrete" tableValues="0 0 0.15 0.35 0.55 0.7 0.82 0.92 1 1"/></feComponentTransfer><feComposite in="SourceGraphic" in2="grainMask" operator="in" result="speckled"/><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="edgeNoise"/><feDisplacementMap in="speckled" in2="edgeNoise" scale="1.5" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="brushSoften" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.6"/></filter></defs>`;
    const paths = all.map((s) => {
      const d = s.points.map((p, i) =>
        `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`
      ).join(" ");
      const w = highContrast ? Math.max(4, s.width + 1) : s.width;
      const op = highContrast ? 1 : s.opacity;
      const cap = !highContrast && s.texture === "highlighter" ? "square" : "round";
      const join = !highContrast && s.texture === "highlighter" ? "miter" : "round";
      const filterAttr = !highContrast && (s.texture === "pencil" || s.texture === "paintbrush")
        ? ` filter="url(#${s.texture === "pencil" ? "pencilTexture" : "brushSoften"})"`
        : "";
      const blendStyle = !highContrast && s.texture === "highlighter" ? ` style="mix-blend-mode:multiply"` : "";
      const pathStr = `<path d="${d}" fill="none" stroke="${highContrast ? "#000" : s.color}" stroke-width="${w}" stroke-opacity="${op}" stroke-linecap="${cap}" stroke-linejoin="${join}"${filterAttr}${blendStyle}/>`;
      const dabsStr = getBrushDabs(s).map((dab) => {
        const dabFilter = highContrast ? "" : ` filter="url(#brushSoften)"`;
        return `<ellipse cx="${dab.cx.toFixed(1)}" cy="${dab.cy.toFixed(1)}" rx="${dab.rx.toFixed(1)}" ry="${dab.ry.toFixed(1)}" transform="rotate(${dab.rotation.toFixed(1)} ${dab.cx.toFixed(1)} ${dab.cy.toFixed(1)})" fill="${highContrast ? "#000" : s.color}" fill-opacity="${op}"${dabFilter}/>`;
      }).join("");
      return pathStr + dabsStr;
    }).join("");
    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">${defsExtra}<rect width="100%" height="100%" fill="${bg}"/>${paths}</svg>`;
  };

  const dl = (name: string, content: string, type: string) => {
    const a = Object.assign(document.createElement("a"), {
      href: URL.createObjectURL(new Blob([content], { type })),
      download: name,
    });
    a.click();
  };

  const exportSwell = () => { dl("sonic-bear-swell.svg", buildSvgString(true),  "image/svg+xml"); say("There you go — your swell paper SVG is downloading."); trackClick(); };
  const exportColor = () => { dl("sonic-bear-color.svg", buildSvgString(false), "image/svg+xml"); say("Nice! Your color SVG is downloading.");       trackClick(); };

  // ── Post to Gallery ──────────────────────────────────────────────────────
  const hasArtwork = strokes.length > 0 || (!!current && current.points.length > 1);

  const requestPost = useCallback(() => {
    if (!hasArtwork) {
      say("Let's draw something first — then I can post it for you!");
      return;
    }
    setPostConfirmOpen(true);
    trackClick();
  }, [hasArtwork, say]);

  const cancelPost = useCallback(() => {
    setPostConfirmOpen(false);
    say("No worries — I kept it just for you.");
  }, [say]);

  const confirmPost = useCallback(() => {
    if (!onPost) return;
    onPost({ svg: buildSvgString(false) });
    setPostConfirmOpen(false);
    setJustPosted(true);
    setTimeout(() => setJustPosted(false), 2200);
    if (audioRef.current) playCompleteChime(audioRef.current.ctx);
    say("Yay! Sent it in for review — it'll go live on the gallery once approved.");
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
      else if (e.key.toLowerCase() === "g") {
        e.preventDefault();
        setGuidesPanelOpen((o) => {
          const next = !o;
          say(next ? "Here are the audio guides — pick one and I'll walk you through it." : "Closing the guides panel.");
          return next;
        });
      }
      else if (e.key.toLowerCase() === "q") { e.preventDefault(); cycleColor(-1); }
      else if (e.key.toLowerCase() === "e") { e.preventDefault(); cycleColor(1); }
      else if (e.key === "[") { e.preventDefault(); changePenWidth(penWidth - 1); }
      else if (e.key === "]") { e.preventDefault(); changePenWidth(penWidth + 1); }
      else if (e.key === ",") { e.preventDefault(); changePenOpacity(penOpacity - OPACITY_STEP); }
      else if (e.key === ".") { e.preventDefault(); changePenOpacity(penOpacity + OPACITY_STEP); }
      else if (e.key.toLowerCase() === "t") { e.preventDefault(); cycleTexture(); }
      else if (e.key.toLowerCase() === "escape" && guideKey) { e.preventDefault(); stopGuide(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [cursor, moveTo, toggleDrawing, toggleSound, clearCanvas, toggleVisualAids, cycleColor, penWidth, changePenWidth, penOpacity, changePenOpacity, cycleTexture, guideKey, stopGuide, say, postConfirmOpen, cancelPost, confirmPost]);

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
    setCurrent({ color, width: penWidth, opacity: penOpacity, texture, points: [p] });
    updateAudio(p);
    trackClick();
  };

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = svgPoint(e);
    setCursor(p);
    updateAudio(p);
    trackGuide(p);
    if (pointerDrawing.current) {
      setCurrent((c) => c ? { ...c, points: [...c.points, p] } : { color, width: penWidth, opacity: penOpacity, texture, points: [p] });
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
    say("Nice line! Saved it.");
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
    say("Your 3D file is ready — happy printing!");
    trackClick();
  };

  // Trail
  trailRef.current = [...trailRef.current.slice(-14), cursor];

  // Guide path rendered on canvas
  const activeGuide = guideKey ? SHAPE_GUIDES[guideKey] : null;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[1fr_336px]">

      {/* ── Canvas area ── */}
      <div className="relative overflow-visible rounded-3xl bg-gradient-to-br from-primary/20 via-card/80 to-accent/20 p-1.5 shadow-2xl shadow-primary/15 ring-1 ring-white/50 backdrop-blur-xl sm:p-2">
        <div className="relative overflow-visible rounded-[1.35rem] bg-card/75 p-4 backdrop-blur-md sm:p-5">

        {/* Top bar */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex items-center gap-2 rounded-full bg-card/70 px-3.5 py-2 text-xs font-bold text-primary ring-1 ring-white/60 shadow-sm backdrop-blur-sm">
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
            className={
              visualAids
                ? "gap-1.5 rounded-full shadow-sm"
                : "gap-1.5 rounded-full border-2 border-primary/50 bg-card font-semibold text-primary shadow-sm hover:bg-primary/10 hover:text-primary"
            }
          >
            <Eye className="h-3.5 w-3.5" /> Visual aids
            <kbd className="ml-0.5 rounded bg-background/40 px-1 py-0.5 text-[10px]">X</kbd>
          </Button>
        </div>

        {/* Controls */}
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-2xl bg-gradient-to-br from-primary/10 via-background/40 to-accent/10 p-2 shadow-inner ring-1 ring-white/50 backdrop-blur-sm">
          <Button onClick={toggleSound} variant={soundOn ? "default" : "secondary"} aria-pressed={soundOn} className="gap-2 rounded-xl shadow-sm">
            {soundOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {soundOn ? "Sound On" : "Sound Off"}
            <kbd className="ml-1 rounded bg-background/40 px-1.5 py-0.5 text-[10px]">S</kbd>
          </Button>
          <Button onClick={toggleDrawing} variant={drawing ? "default" : "secondary"} aria-pressed={drawing} className="gap-2 rounded-xl shadow-sm">
            {drawing ? <Pencil className="h-4 w-4" /> : <Hand className="h-4 w-4" />}
            {drawing ? "Drawing" : "Idle"}
            <kbd className="ml-1 rounded bg-background/40 px-1.5 py-0.5 text-[10px]">Space</kbd>
          </Button>
          <Button onClick={undo}        variant="outline" className="gap-2 rounded-xl bg-card/70 shadow-sm ring-1 ring-white/50"><Undo2 className="h-4 w-4" /> Undo</Button>
          <Button onClick={clearCanvas} variant="outline" className="gap-2 rounded-xl bg-card/70 shadow-sm ring-1 ring-white/50">
            <Eraser className="h-4 w-4" /> Clear
            <kbd className="ml-1 rounded bg-background/40 px-1.5 py-0.5 text-[10px]">C</kbd>
          </Button>
          {guideKey && (
            <Button onClick={stopGuide} variant="destructive" size="sm" className="gap-1.5 rounded-xl shadow-sm">
              <X className="h-3.5 w-3.5" /> Stop guide
              <kbd className="ml-0.5 rounded bg-background/40 px-1 py-0.5 text-[10px]">Esc</kbd>
            </Button>
          )}
        </div>

        {/* SVG Canvas + bear companion. The bear is pinned to the canvas
            frame's own top-right corner (not floating in the gap above the
            controls), so its position is completely independent of the
            controls row above — it cannot ever overlap those buttons. */}
        <div className="relative mt-2 rounded-[1.75rem] bg-gradient-to-br from-primary/15 via-background/60 to-accent/15 p-2 pt-3 shadow-inner ring-1 ring-primary/20 sm:p-2.5 sm:pt-3.5">
          <div className="pointer-events-none absolute -top-12 right-2 z-10 rotate-[6deg] sm:-top-16 sm:right-4">
            <img
              src={drawing ? bearDrawing : bearSleeping}
              alt=""
              aria-hidden="true"
              className="h-20 w-20 select-none object-contain drop-shadow-[0_6px_10px_rgba(58,31,43,0.25)] sm:h-28 sm:w-28"
            />
          </div>
          {/* Double ring "mat frame" — a slim gold hairline just inside the
              soft outer shadow gives the canvas a gallery-framed feel
              instead of a flat rectangle. */}
          <div className="overflow-hidden rounded-2xl bg-[oklch(0.98_0.02_15)] shadow-xl shadow-primary/10 ring-1 ring-[oklch(0.7_0.09_75)]/40">
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
            {/* Classic grid — kept as plain crosshatch lines (not dots),
                since that's the look that reads clearly as "graph paper"
                for tracing/drawing. A warm rose tint on the lines instead of
                cool grey is the one small upgrade here. */}
            <pattern id="grid" width={GRID} height={GRID} patternUnits="userSpaceOnUse">
              <path d={`M ${GRID} 0 L 0 0 0 ${GRID}`} fill="none" stroke="oklch(0.88 0.05 20)" strokeWidth="1" />
            </pattern>
            {/* Glow filter for guide path */}
            <filter id="glow">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
            {/* Graphite grain for the pencil texture: fine noise is thresholded into
                a speckled alpha mask and punched into the stroke (like paper tooth
                showing through graphite), then the whole thing gets a slight rough
                displacement so the edge wobbles like a real hand-drawn line. */}
            <filter id="pencilTexture" x="-20%" y="-20%" width="140%" height="140%">
              <feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves="3" seed="7" result="grain" />
              <feColorMatrix in="grain" type="matrix"
                values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.33 0.33 0.33 0 0"
                result="grainAlpha" />
              <feComponentTransfer in="grainAlpha" result="grainMask">
                <feFuncA type="discrete" tableValues="0 0 0.15 0.35 0.55 0.7 0.82 0.92 1 1" />
              </feComponentTransfer>
              <feComposite in="SourceGraphic" in2="grainMask" operator="in" result="speckled" />
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="edgeNoise" />
              <feDisplacementMap in="speckled" in2="edgeNoise" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
            </filter>
            {/* Gentle blur for the paintbrush texture's line and end dabs — a soft,
                painterly edge instead of a crisp digital line. */}
            <filter id="brushSoften" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.6" />
            </filter>
          </defs>

          <rect width="100%" height="100%" fill="oklch(0.975 0.025 15)" />
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Corner flourishes — small quarter-arc ornaments purely for
              decoration, drawn under the guide/strokes layers so they never
              interfere with drawing or export (they only exist in this
              on-screen canvas, not in the exported SVG/STL files). */}
          <g opacity="0.35" stroke="oklch(0.7 0.09 75)" strokeWidth="2" fill="none" strokeLinecap="round">
            <path d={`M 18 42 Q 18 18 42 18`} />
            <path d={`M ${WIDTH - 42} 18 Q ${WIDTH - 18} 18 ${WIDTH - 18} 42`} />
            <path d={`M 18 ${HEIGHT - 42} Q 18 ${HEIGHT - 18} 42 ${HEIGHT - 18}`} />
            <path d={`M ${WIDTH - 42} ${HEIGHT - 18} Q ${WIDTH - 18} ${HEIGHT - 18} ${WIDTH - 18} ${HEIGHT - 42}`} />
          </g>

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
            <polyline key={i}
              points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none" stroke={s.color} strokeWidth={s.width} strokeOpacity={s.opacity}
              {...textureVisualProps(s.texture)}
            />
          ))}
          {strokes.flatMap((s, i) =>
            getBrushDabs(s).map((d, j) => (
              <ellipse
                key={`dab-${i}-${j}`}
                cx={d.cx} cy={d.cy} rx={d.rx} ry={d.ry}
                transform={`rotate(${d.rotation} ${d.cx} ${d.cy})`}
                fill={s.color} fillOpacity={s.opacity}
                filter="url(#brushSoften)"
              />
            ))
          )}
          {current && (
            <polyline
              points={current.points.map((p) => `${p.x},${p.y}`).join(" ")}
              fill="none" stroke={current.color} strokeWidth={current.width} strokeOpacity={current.opacity}
              {...textureVisualProps(current.texture)}
            />
          )}
          {current && getBrushDabs(current).map((d, j) => (
            <ellipse
              key={`current-dab-${j}`}
              cx={d.cx} cy={d.cy} rx={d.rx} ry={d.ry}
              transform={`rotate(${d.rotation} ${d.cx} ${d.cy})`}
              fill={current.color} fillOpacity={current.opacity}
              filter="url(#brushSoften)"
            />
          ))}

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
          </div>
        </div>

        <p className="mt-3 rounded-xl bg-background/35 px-3 py-2 text-xs text-muted-foreground ring-1 ring-white/40">
          Left/right pans the sound · Up/down changes pitch · Shift+arrows = bigger steps · Q/E cycle colours · [ ] adjust thickness · , . adjust opacity · T cycles texture
        </p>

        {/* New feature callout — Public Gallery. Placed right under the
            canvas so it's clearly visible without digging into the
            sidebar's Export/Share card. */}
        <div className="mt-4 flex flex-col items-start gap-3 rounded-2xl bg-gradient-to-br from-accent/25 via-card/80 to-primary/15 p-4 shadow-md ring-1 ring-white/50 backdrop-blur-md sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-card/60 text-primary ring-1 ring-white/50 backdrop-blur-sm">
              <Globe className="h-4 w-4" />
            </span>
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary-foreground">
                New
              </span>
              <p className="mt-1 text-sm font-semibold text-foreground">The Public Gallery is here</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Finish a drawing and send it in for review — approved pieces get featured on the
                Gallery page for creators everywhere to see.
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm" className="w-full shrink-0 rounded-full bg-card/60 backdrop-blur-sm sm:w-auto">
            <Link to="/gallery" className="gap-1.5">
              <Globe className="h-3.5 w-3.5" /> View Gallery
            </Link>
          </Button>
        </div>

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
      </div>

      {/* ── Sidebar ── */}
      <aside className="space-y-4">

        {/* Palette */}
        <section aria-labelledby="colors-heading" className="rounded-3xl bg-gradient-to-br from-primary/20 via-card/75 to-transparent p-4 shadow-lg shadow-primary/10 ring-1 ring-white/50 backdrop-blur-md">
          <h2 id="colors-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card/60 text-primary ring-1 ring-white/50 backdrop-blur-sm">
              <Palette className="h-3.5 w-3.5" />
            </span>
            Palette
            <span className="ml-auto rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-normal text-muted-foreground">Q / E to cycle</span>
          </h2>
          <div className="flex flex-wrap gap-2.5">
            {COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => pickColor(c)}
                aria-label={`Color ${c.name}`}
                aria-pressed={color === c.value}
                className={`relative h-9 w-9 rounded-full shadow-sm ring-2 ring-offset-2 ring-offset-card transition-all duration-150 hover:scale-110 ${
                  color === c.value ? "scale-110 ring-foreground" : "ring-transparent"
                }`}
                style={{ backgroundColor: c.value }}
              >
                {color === c.value && (
                  <Check
                    className="absolute inset-0 m-auto h-4 w-4 drop-shadow"
                    style={{ color: ["#f5a623", "#e0b04f", "#f9a8a8"].includes(c.value) ? "#3a1f2b" : "#fff" }}
                  />
                )}
              </button>
            ))}
          </div>
        </section>

        {/* Texture */}
        <section aria-labelledby="texture-heading" className="rounded-3xl bg-gradient-to-br from-accent/30 via-card/75 to-transparent p-4 shadow-lg shadow-accent/10 ring-1 ring-white/50 backdrop-blur-md">
          <h2 id="texture-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card/60 text-primary ring-1 ring-white/50 backdrop-blur-sm">
              <Pencil className="h-3.5 w-3.5" />
            </span>
            Texture
            <span className="ml-auto rounded-full bg-background/60 px-2 py-0.5 text-[10px] font-normal text-muted-foreground">T to cycle</span>
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {TEXTURE_ORDER.map((t) => {
              const TextureIcon = TEXTURE_ICONS[t];
              const active = texture === t;
              return (
                <button
                  key={t}
                  onClick={() => changeTexture(t)}
                  aria-pressed={active}
                  className={`flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-sm font-medium shadow-sm transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-card/60 text-foreground ring-1 ring-white/50 backdrop-blur-sm hover:bg-primary/10"
                  }`}
                >
                  <TextureIcon className="h-4 w-4" />
                  {TEXTURE_LABELS[t]}
                </button>
              );
            })}
          </div>
        </section>

        {/* Thickness + Opacity (per active texture) — merged into one card;
            two sliders under one header take noticeably less vertical
            space than two separate cards each with their own header/ring. */}
        <section aria-labelledby="pen-heading" className="rounded-3xl bg-gradient-to-br from-secondary/40 via-card/75 to-transparent p-4 shadow-lg shadow-secondary/10 ring-1 ring-white/50 backdrop-blur-md">
          <h2 id="pen-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card/60 text-primary ring-1 ring-white/50 backdrop-blur-sm">
              <Pencil className="h-3.5 w-3.5" />
            </span>
            {TEXTURE_LABELS[texture]} settings
          </h2>

          <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Thickness</span>
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">{penWidth}px</span>
              <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px]">[ / ]</span>
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <Button
              onClick={() => changePenWidth(penWidth - 1)}
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full bg-card/60 ring-1 ring-white/50 backdrop-blur-sm"
              aria-label={`Decrease ${TEXTURE_LABELS[texture].toLowerCase()} thickness`}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <input
              type="range"
              min={MIN_PEN_WIDTH}
              max={MAX_PEN_WIDTH}
              step={1}
              value={penWidth}
              onChange={(e) => changePenWidth(Number(e.target.value))}
              aria-label={`${TEXTURE_LABELS[texture]} thickness`}
              aria-valuemin={MIN_PEN_WIDTH}
              aria-valuemax={MAX_PEN_WIDTH}
              aria-valuenow={penWidth}
              className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-card [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary"
              style={{
                background: `linear-gradient(to right, oklch(0.58 0.15 20) ${((penWidth - MIN_PEN_WIDTH) / (MAX_PEN_WIDTH - MIN_PEN_WIDTH)) * 100}%, oklch(0.58 0.15 20 / 0.18) ${((penWidth - MIN_PEN_WIDTH) / (MAX_PEN_WIDTH - MIN_PEN_WIDTH)) * 100}%)`,
              }}
            />
            <Button
              onClick={() => changePenWidth(penWidth + 1)}
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full bg-card/60 ring-1 ring-white/50 backdrop-blur-sm"
              aria-label={`Increase ${TEXTURE_LABELS[texture].toLowerCase()} thickness`}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>

          <div className="mt-4 flex items-center justify-between text-xs font-medium text-muted-foreground">
            <span>Opacity</span>
            <span className="flex items-center gap-1.5">
              <span className="font-semibold text-foreground">{Math.round(penOpacity * 100)}%</span>
              <span className="rounded-full bg-background/60 px-2 py-0.5 text-[10px]">, / .</span>
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2.5">
            <Button
              onClick={() => changePenOpacity(penOpacity - OPACITY_STEP)}
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full bg-card/60 ring-1 ring-white/50 backdrop-blur-sm"
              aria-label={`Decrease ${TEXTURE_LABELS[texture].toLowerCase()} opacity`}
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <input
              type="range"
              min={OPACITY_RANGE[texture].min}
              max={OPACITY_RANGE[texture].max}
              step={OPACITY_STEP}
              value={penOpacity}
              onChange={(e) => changePenOpacity(Number(e.target.value))}
              aria-label={`${TEXTURE_LABELS[texture]} opacity`}
              aria-valuemin={OPACITY_RANGE[texture].min}
              aria-valuemax={OPACITY_RANGE[texture].max}
              aria-valuenow={penOpacity}
              className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-card [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary"
              style={{
                background: `linear-gradient(to right, oklch(0.58 0.15 20) ${((penOpacity - OPACITY_RANGE[texture].min) / (OPACITY_RANGE[texture].max - OPACITY_RANGE[texture].min)) * 100}%, oklch(0.58 0.15 20 / 0.18) ${((penOpacity - OPACITY_RANGE[texture].min) / (OPACITY_RANGE[texture].max - OPACITY_RANGE[texture].min)) * 100}%)`,
              }}
            />
            <Button
              onClick={() => changePenOpacity(penOpacity + OPACITY_STEP)}
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full bg-card/60 ring-1 ring-white/50 backdrop-blur-sm"
              aria-label={`Increase ${TEXTURE_LABELS[texture].toLowerCase()} opacity`}
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
        </section>

        {/* Canvas Sound */}
        <section aria-labelledby="canvas-sound-heading" className="rounded-3xl bg-gradient-to-br from-primary/20 via-card/75 to-transparent p-4 shadow-lg shadow-primary/10 ring-1 ring-white/50 backdrop-blur-md">
          <h2 id="canvas-sound-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card/60 text-primary ring-1 ring-white/50 backdrop-blur-sm">
              <Volume2 className="h-3.5 w-3.5" />
            </span>
            Canvas sound
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {SOUND_STYLE_ORDER.map((s) => {
              const StyleIcon = SOUND_STYLE_ICONS[s];
              const active = soundStyle === s;
              return (
                <button
                  key={s}
                  onClick={() => { setSoundStyle(s); say(`${SOUND_STYLE_LABELS[s]} sound.`); trackClick(); }}
                  aria-pressed={active}
                  className={`flex items-center justify-center gap-1.5 rounded-2xl px-3 py-2.5 text-sm font-medium shadow-sm transition-all ${
                    active
                      ? "bg-primary text-primary-foreground shadow-md"
                      : "bg-card/60 text-foreground ring-1 ring-white/50 backdrop-blur-sm hover:bg-primary/10"
                  }`}
                >
                  <StyleIcon className="h-4 w-4" />
                  {SOUND_STYLE_LABELS[s]}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-3">
            <Button
              onClick={() => setSoundVolume((v) => Math.max(0, +(v - 0.1).toFixed(2)))}
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full bg-card/60 ring-1 ring-white/50 backdrop-blur-sm"
              aria-label="Decrease canvas sound volume"
            >
              <Minus className="h-3.5 w-3.5" />
            </Button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={soundVolume}
              onChange={(e) => setSoundVolume(Number(e.target.value))}
              aria-label="Canvas sound volume"
              className="h-2 flex-1 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-card [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary"
              style={{ background: `linear-gradient(to right, oklch(0.58 0.15 20) ${soundVolume * 100}%, oklch(0.58 0.15 20 / 0.18) ${soundVolume * 100}%)` }}
            />
            <Button
              onClick={() => setSoundVolume((v) => Math.min(1, +(v + 0.1).toFixed(2)))}
              variant="outline"
              size="icon"
              className="h-8 w-8 shrink-0 rounded-full bg-card/60 ring-1 ring-white/50 backdrop-blur-sm"
              aria-label="Increase canvas sound volume"
            >
              <Plus className="h-3.5 w-3.5" />
            </Button>
          </div>
          <div className="mt-2.5 rounded-full bg-background/50 py-1.5 text-center text-xs font-medium text-muted-foreground">
            {Math.round(soundVolume * 100)}% volume
          </div>
        </section>

        {/* Export & Share — merged into one card */}
        <section aria-labelledby="export-heading" className="rounded-3xl bg-gradient-to-br from-accent/25 via-card/75 to-transparent p-4 shadow-lg shadow-accent/10 ring-1 ring-white/50 backdrop-blur-md">
          <h2 id="export-heading" className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card/60 text-primary ring-1 ring-white/50 backdrop-blur-sm">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            Export
          </h2>
          <div className="grid gap-2">
            <Button onClick={exportSwell} className="justify-start gap-3 rounded-2xl py-4 shadow-md">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-foreground/20">
                <Waves className="h-4 w-4" />
              </span>
              Swell Paper SVG
            </Button>
            <Button onClick={exportColor} variant="secondary" className="justify-start gap-3 rounded-2xl py-4 shadow-sm">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-foreground/10">
                <Palette className="h-4 w-4" />
              </span>
              Colour SVG
            </Button>
            <Button onClick={exportStl} variant="outline" className="justify-start gap-3 rounded-2xl bg-background/60 py-4 shadow-sm ring-1 ring-primary/15">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/10">
                <Box className="h-4 w-4" />
              </span>
              3D Print (STL)
            </Button>
          </div>

          {onPost && (
            <>
              <div className="my-4 border-t border-primary/10" />
              <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-card/60 text-primary ring-1 ring-white/50 backdrop-blur-sm">
                  <Globe className="h-3.5 w-3.5" />
                </span>
                Share
              </h2>
              <p className="mb-3 text-xs text-muted-foreground">
                Send your artwork in for a quick review — approved pieces appear on the public
                Gallery page for creators everywhere to see.
              </p>
              <Button
                onClick={requestPost}
                disabled={!hasArtwork}
                variant={justPosted ? "secondary" : "default"}
                className="w-full justify-center gap-2 rounded-full"
              >
                {justPosted ? <Check className="h-4 w-4" /> : <Globe className="h-4 w-4" />}
                {justPosted ? "Sent for review!" : "Send to Gallery"}
              </Button>
            </>
          )}
        </section>

        {/* Keyboard reference — collapsed by default; it's the single
            tallest block in this sidebar and most people don't need it
            open all the time, so tucking it away keeps the whole sidebar
            closer in height to the canvas next to it. */}
        <section aria-labelledby="kbd-heading" className="rounded-3xl bg-gradient-to-br from-secondary/30 via-card/75 to-transparent p-4 shadow-lg shadow-secondary/10 ring-1 ring-white/50 backdrop-blur-md text-xs text-muted-foreground">
          <button
            type="button"
            onClick={() => setKeyboardPanelOpen((o) => !o)}
            aria-expanded={keyboardPanelOpen}
            aria-controls="kbd-list"
            className="flex w-full items-center gap-2 text-sm font-semibold text-foreground"
          >
            <Keyboard className="h-4 w-4 text-primary" /> Keyboard shortcuts
            <ChevronRight className={`ml-auto h-4 w-4 text-primary transition-transform ${keyboardPanelOpen ? "rotate-90" : ""}`} />
          </button>
          {keyboardPanelOpen && (
            <ul id="kbd-list" className="mt-3 space-y-1">
              <li>Arrows — move brush (Shift = ×3)</li>
              <li>Space / D — toggle drawing</li>
              <li>S — toggle sound</li>
              <li>C — clear canvas</li>
              <li>Q / E — cycle colour</li>
              <li>[ / ] — thickness</li>
              <li>, / . — opacity</li>
              <li>T — cycle texture</li>
              <li>G — open / close guides</li>
              <li>Esc — stop active guide</li>
              <li>X — toggle visual aids</li>
            </ul>
          )}
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
              Send this to the gallery?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Our team reviews every submission before it goes live — once approved, anyone around
              the world will be able to see it on the Gallery page.
            </p>
            <div className="mt-5 flex gap-2">
              <Button onClick={cancelPost} variant="outline" className="flex-1 rounded-full">
                Cancel
                <kbd className="ml-1.5 rounded bg-background/40 px-1 py-0.5 text-[10px]">Esc</kbd>
              </Button>
              <Button onClick={confirmPost} className="flex-1 gap-2 rounded-full">
                <Globe className="h-4 w-4" /> Yes, send for review
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
