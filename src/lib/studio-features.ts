import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";

/* Shared drawing-studio features, ported from the Sketchpad so the Collab
   Studio can offer the same brushes, sounds, voices and shape guides. */


export type SoundStyle = "sine" | "pad" | "chime" | "marimba";
export const SOUND_STYLE_ORDER: SoundStyle[] = ["sine", "pad", "chime", "marimba"];

export const SOUND_STYLE_LABELS: Record<SoundStyle, string> = {
  sine: "Warm Tone",
  pad: "Soft Pad",
  chime: "Wind Chime",
  marimba: "Marimba",
};

export type VoicePersona = "bear" | "lady";
export const VOICE_PERSONA_ORDER: VoicePersona[] = ["bear", "lady"];
export const VOICE_PERSONA_LABELS: Record<VoicePersona, string> = {
  bear: "Bennett",
  lady: "Lady",
};
export const LADY_VOICE_HINTS = [
  "female", "samantha", "victoria", "zira", "jenny", "aria", "susan",
  "karen", "moira", "tessa", "fiona", "google us english", "google uk english female",
  "hazel", "libby", "sonia", "shelley", "allison",
];

export type Point = { x: number; y: number };
export type Texture = "pen" | "pencil" | "highlighter" | "paintbrush";
export type Stroke = {
  color: string;
  width: number;
  opacity: number;
  texture: Texture;
  points: Point[];
  mode?: "draw" | "blend";
};

// Shared thickness range across all four textures — one slider, applied to
// whichever texture is currently selected (each texture remembers its own
// width/opacity independently; see textureSettings below).
export const MIN_PEN_WIDTH = 1;
export const MAX_PEN_WIDTH = 40; // wide enough for a genuinely boxy highlighter stroke
export const OPACITY_STEP = 0.1;

// Opacity range is per-texture: pen/highlighter/paintbrush can go all the way
// down to faint, but graphite realistically never looks that washed out, so
// pencil's floor (and this ceiling, already the max possible) sit higher —
// its whole slider stays in a darker band.
const MIN_PEN_OPACITY = 0.1;
const MAX_PEN_OPACITY = 1;
const MIN_PENCIL_OPACITY = 0.55;
const MAX_PENCIL_OPACITY = 1;

export const OPACITY_RANGE: Record<Texture, { min: number; max: number }> = {
  pen: { min: MIN_PEN_OPACITY, max: MAX_PEN_OPACITY },
  pencil: { min: MIN_PENCIL_OPACITY, max: MAX_PENCIL_OPACITY },
  highlighter: { min: MIN_PEN_OPACITY, max: MAX_PEN_OPACITY },
  paintbrush: { min: MIN_PEN_OPACITY, max: MAX_PEN_OPACITY },
};

export const TEXTURE_ORDER: Texture[] = ["pen", "pencil", "highlighter", "paintbrush"];
export const TEXTURE_LABELS: Record<Texture, string> = { pen: "Pen", pencil: "Pencil", highlighter: "Highlighter", paintbrush: "Paintbrush" };
export const TEXTURE_TONES: Record<Texture, number> = { pen: 440, pencil: 349.23, highlighter: 622.25, paintbrush: 523.25 };

export const DEFAULT_TEXTURE_SETTINGS: Record<Texture, { width: number; opacity: number }> = {
  pen: { width: 3, opacity: 1 },
  pencil: { width: 2, opacity: 0.85 },
  highlighter: { width: 18, opacity: 0.35 },
  paintbrush: { width: 8, opacity: 0.9 },
};

export const COLORS = [
  { name: "Black",    value: "#000000", tone: 220.00 },
  { name: "White",    value: "#ffffff", tone: 880.00 },
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

export const WIDTH  = 900;
export const HEIGHT = 560;

// Hysteresis for the "off course" guide warning: enter the warned state once
// you're this far from the path, and don't clear it again until you're back
// within the (smaller) exit distance. The gap between the two stops the
// warning from firing repeatedly if you're drawing right at the boundary.
export const OFF_COURSE_ENTER = 70;
export const OFF_COURSE_EXIT  = 45;

export type ShapeGuide = {
  name: string;
  description: string;
  points: Point[];
  checkpoints: { at: number; say: string }[];
};

const norm = (x: number, y: number): Point => ({ x, y });

export const SHAPE_GUIDES: Record<string, ShapeGuide> = {
  circle: {
    name: "Circle",
    description: "A smooth closed loop",
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

export function nearestOnGuide(p: Point, guide: ShapeGuide): { distance: number; progress: number; point: Point } {
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
export function describeDirection(from: Point, to: Point): string {
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
export function describeDistance(px: number): string {
  if (px < 90)  return "just a little";
  if (px < 160) return "a bit";
  return "quite a ways";
}

// Small pools of alternate phrasings so the guide doesn't sound like a
// broken record when the same event (off-course, back on track, checkpoint
// praise) fires over and over during a single drawing session.
export const OFF_COURSE_INTROS = [
  "Whoops, you've wandered off the path.",
  "Hang on, you're off the line.",
  "Uh-oh, you've drifted a bit.",
];
export const BACK_ON_TRACK_LINES = [
  "Yes! Right back on track.",
  "There you go — nailed it.",
  "Perfect, found it again.",
];
export const CHECKPOINT_PRAISE = [
  "Nice work!",
  "You're doing great!",
  "Love it!",
  "Keep going, you've got this!",
  "Beautiful!",
];

export function pickVaried(pool: string[], avoid: string): string {
  const options = pool.filter((s) => s !== avoid);
  return options[Math.floor(Math.random() * options.length)] ?? pool[0];
}

// Per-texture rendering: highlighter gets boxy caps/joins plus a multiply
// blend so overlapping strokes darken like a real marker; pencil gets a
// grainy displacement filter for a rough, hand-drawn edge; pen stays plain.
export function textureVisualProps(texture: Texture): {
  strokeLinecap: "round" | "square";
  strokeLinejoin: "round" | "miter";
  filter?: string;
  style?: CSSProperties;
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

export type BrushDab = { cx: number; cy: number; rx: number; ry: number; rotation: number };

// Real brush strokes blot slightly wider where the bristles first touch down
// and lift off, tapering elsewhere. This computes 1–2 soft, elongated dabs
// (oriented along the direction of travel) to overlay at a paintbrush
// stroke's start and end points — the line body itself is drawn normally.
export function getBrushDabs(s: Stroke): BrushDab[] {
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

export function buildAudio() {
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
export function pluckNote(ctx: AudioContext, freq: number, panVal: number, style: "chime" | "marimba", volume: number) {
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
export function playSineNote(
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
export function playCompleteChime(ctx: AudioContext): void {
  const notes = [523.25, 659.25, 783.99];
  notes.forEach((f, i) => {
    setTimeout(() => playSineNote(ctx, f, 0.28, 0.12, true), i * 90);
  });
}

// Soft two-note "welcome" tone for guide start
export function playGuideStart(ctx: AudioContext, rootFreq: number): void {
  playSineNote(ctx, rootFreq, 0.22, 0.11);
  setTimeout(() => playSineNote(ctx, rootFreq * 1.5, 0.22, 0.09), 140);
}

// Gentle low "bump" for edge (replaces harsh sawtooth)
export function playEdgeBump(ctx: AudioContext): void {
  playSineNote(ctx, 110, 0.18, 0.10);
}
// ── Narrator (Bennett the bear / lady guide) ─────────────────────────────────
export function useNarrator(onText: (msg: string) => void) {
  const [persona, setPersona] = useState<VoicePersona>("bear");
  const personaRef = useRef<VoicePersona>("bear");
  const [voiceOn, setVoiceOn] = useState(true);
  const voiceOnRef = useRef(true);
  const bennettRef = useRef<SpeechSynthesisVoice | null>(null);
  const ladyRef = useRef<SpeechSynthesisVoice | null>(null);
  const onTextRef = useRef(onText);
  useEffect(() => { onTextRef.current = onText; }, [onText]);

  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const pick = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const byName = (re: RegExp) => voices.find((v) => re.test(v.name));
      bennettRef.current =
        byName(/child|kid|junior/i) ||
        byName(/samantha|karen|moira|tessa|fiona|veena/i) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0] ||
        null;
      const english = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
      const pool = english.length ? english : voices;
      ladyRef.current =
        pool.find((v) => LADY_VOICE_HINTS.some((h) => v.name.toLowerCase().includes(h))) || pool[0] || null;
    };
    pick();
    window.speechSynthesis.addEventListener("voiceschanged", pick);
    return () => {
      window.speechSynthesis.removeEventListener("voiceschanged", pick);
      window.speechSynthesis.cancel();
    };
  }, []);

  const say = useCallback((msg: string) => {
    onTextRef.current(msg);
    if (voiceOnRef.current && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(msg);
      if (personaRef.current === "lady") {
        if (ladyRef.current) u.voice = ladyRef.current;
        u.rate = 1.05;
        u.pitch = 1.3;
      } else {
        if (bennettRef.current) u.voice = bennettRef.current;
        u.rate = 1.0;
        u.pitch = 1.4;
      }
      window.speechSynthesis.speak(u);
    }
  }, []);

  const choosePersona = useCallback(
    (next: VoicePersona) => {
      personaRef.current = next;
      setPersona(next);
      say(
        next === "lady"
          ? "Hi there! I'm your lady guide. I'll help you find your way around the canvas."
          : "Hey, Bennett here! Let's make some art together.",
      );
    },
    [say],
  );

  const toggleVoice = useCallback(() => {
    const next = !voiceOnRef.current;
    voiceOnRef.current = next;
    setVoiceOn(next);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    if (next) say("Narration is back on.");
    else onTextRef.current("Narration is off.");
  }, [say]);

  /** Speak a long walkthrough even if narration is currently switched off. */
  const sayForced = useCallback(
    (msg: string) => {
      if (!voiceOnRef.current) {
        voiceOnRef.current = true;
        setVoiceOn(true);
      }
      say(msg);
    },
    [say],
  );

  return { say, persona, choosePersona, voiceOn, toggleVoice, sayForced };
}

// ── Canvas sound engine (warm tone / soft pad / wind chime / marimba) ────────
export function useStudioAudio(soundOn: boolean, style: SoundStyle, volume: number) {
  const ref = useRef<ReturnType<typeof buildAudio> | null>(null);
  const guideRef = useRef<{ osc: OscillatorNode; gain: GainNode } | null>(null);
  const soundOnRef = useRef(soundOn);
  const styleRef = useRef(style);
  const volumeRef = useRef(volume);
  const lastPluckAt = useRef(0);
  const lastPluckPos = useRef<Point | null>(null);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  useEffect(() => { styleRef.current = style; }, [style]);
  useEffect(() => { volumeRef.current = volume; }, [volume]);

  const ensure = useCallback(() => {
    if (!ref.current) ref.current = buildAudio();
    if (ref.current.ctx.state === "suspended") void ref.current.ctx.resume();
    return ref.current;
  }, []);

  const update = useCallback((p: Point, drawing: boolean) => {
    if (!soundOnRef.current) return;
    const a = ensure();
    const panVal = (p.x / WIDTH) * 2 - 1;
    const raw = 220 + (1 - p.y / HEIGHT) * 440;
    const penta = [1, 1.125, 1.25, 1.5, 1.667];
    const base = 220;
    const octave = Math.floor(Math.log2(raw / base));
    const normed = raw / base / Math.pow(2, octave);
    const closest = penta.reduce((b, r) => (Math.abs(r - normed) < Math.abs(b - normed) ? r : b));
    const pitch = base * closest * Math.pow(2, octave);
    const vol = volumeRef.current;
    const st = styleRef.current;
    if (st === "chime" || st === "marimba") {
      a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.05);
      const now = performance.now();
      const moved = lastPluckPos.current ? Math.hypot(p.x - lastPluckPos.current.x, p.y - lastPluckPos.current.y) : Infinity;
      const minGap = st === "marimba" ? 90 : 140;
      const minMove = st === "marimba" ? 10 : 16;
      if (drawing && moved > minMove && now - lastPluckAt.current > minGap) {
        lastPluckAt.current = now;
        lastPluckPos.current = p;
        pluckNote(a.ctx, pitch, panVal, st, vol);
      }
      return;
    }
    const glide = st === "pad" ? 0.12 : 0.05;
    a.filter.frequency.setTargetAtTime(st === "pad" ? 1100 : 2000, a.ctx.currentTime, 0.1);
    a.pan.pan.setTargetAtTime(panVal, a.ctx.currentTime, 0.03);
    a.osc.frequency.setTargetAtTime(pitch, a.ctx.currentTime, glide);
    a.osc2.frequency.setTargetAtTime(pitch, a.ctx.currentTime, glide);
    a.gain.gain.setTargetAtTime((drawing ? 0.15 : 0.05) * vol, a.ctx.currentTime, 0.04);
  }, [ensure]);

  const silence = useCallback(() => {
    const a = ref.current;
    if (a) a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.1);
  }, []);

  const note = useCallback((freq: number, dur = 0.18, vol = 0.12, vibrato = false) => {
    if (!soundOnRef.current) return;
    playSineNote(ensure().ctx, freq, dur, vol, vibrato);
  }, [ensure]);
  const complete = useCallback(() => { if (soundOnRef.current) playCompleteChime(ensure().ctx); }, [ensure]);
  const guideStart = useCallback((root: number) => { if (soundOnRef.current) playGuideStart(ensure().ctx, root); }, [ensure]);
  const bump = useCallback(() => { if (soundOnRef.current) playEdgeBump(ensure().ctx); }, [ensure]);

  const startGuideTone = useCallback(() => {
    if (guideRef.current) return;
    const a = ensure();
    const osc = a.ctx.createOscillator();
    const gain = a.ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 440;
    gain.gain.value = 0;
    osc.connect(gain).connect(a.ctx.destination);
    osc.start();
    guideRef.current = { osc, gain };
  }, [ensure]);

  const stopGuideTone = useCallback(() => {
    const g = guideRef.current;
    if (!g) return;
    g.gain.gain.setTargetAtTime(0, g.osc.context.currentTime, 0.08);
    setTimeout(() => { try { g.osc.stop(); } catch { /* already stopped */ } }, 300);
    guideRef.current = null;
  }, []);

  const guideProximity = useCallback((distance: number) => {
    const g = guideRef.current;
    if (!g) return;
    const closeness = Math.max(0, 1 - Math.min(distance, 120) / 120);
    const freqs = [330, 370, 415, 494, 554, 660, 740, 880];
    const freq = freqs[Math.round(closeness * (freqs.length - 1))];
    g.osc.frequency.setTargetAtTime(freq, g.osc.context.currentTime, 0.06);
    g.gain.gain.setTargetAtTime((0.02 + closeness * 0.13) * volumeRef.current, g.osc.context.currentTime, 0.06);
  }, []);

  useEffect(
    () => () => {
      const g = guideRef.current;
      if (g) { try { g.osc.stop(); } catch { /* */ } guideRef.current = null; }
      const a = ref.current;
      if (a) { void a.ctx.close(); ref.current = null; }
    },
    [],
  );

  return { ensure, update, silence, note, complete, guideStart, bump, startGuideTone, stopGuideTone, guideProximity };
}
