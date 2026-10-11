import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { saveArtwork } from "@/lib/gallery-storage";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  HelpCircle,
  RotateCcw,
  Trash2,
  Download,
  Share2,
  Circle,
  Square,
  Heart,
  Star,
  Triangle,
  Compass,
  Sparkles,
} from "lucide-react";

/* ──────────────────────────────────────────────────────────────────────────
   Blind Studio — a fully voice-controlled drawing + sound page.

   Everything here happens through speech: the person says a command
   ("move right", "draw", "color sky", "guide circle", "save my drawing")
   and Bennett (or the lady guide) speaks back what happened and what to do
   next. The canvas, colour swatches, and command list are still drawn on
   screen for sighted helpers/testers, but nothing about using this page
   requires seeing it — every control also has a keyboard equivalent, so it
   still works in full on a browser that can't do speech recognition at all.
   ────────────────────────────────────────────────────────────────────────── */

const WIDTH = 900;
const HEIGHT = 560;

const COLORS = [
  { name: "black", value: "#000000" },
  { name: "white", value: "#ffffff" },
  { name: "rose", value: "#e88aab" },
  { name: "peach", value: "#f9a8a8" },
  { name: "sun", value: "#f5a623" },
  { name: "amber", value: "#d98324" },
  { name: "crimson", value: "#c2385a" },
  { name: "coral", value: "#ff7f6b" },
  { name: "gold", value: "#e0b04f" },
  { name: "lavender", value: "#c9a0dc" },
  { name: "plum", value: "#9b72cf" },
  { name: "sky", value: "#4da6ff" },
  { name: "teal", value: "#3fb8af" },
  { name: "mint", value: "#48b376" },
  { name: "forest", value: "#2f6b4f" },
  { name: "indigo", value: "#5b5ea6" },
];

type SoundStyle = "sine" | "pad" | "chime" | "marimba";
const SOUND_STYLE_LABELS: Record<SoundStyle, string> = {
  sine: "warm tone",
  pad: "soft pad",
  chime: "wind chime",
  marimba: "marimba",
};

type VoicePersona = "bear" | "lady";
const LADY_VOICE_HINTS = [
  "female", "samantha", "victoria", "zira", "jenny", "aria", "susan",
  "karen", "moira", "tessa", "fiona", "google us english", "google uk english female",
  "hazel", "libby", "sonia", "shelley", "allison",
];

type Point = { x: number; y: number };
type Stroke = { color: string; points: Point[] };

const STEP_SMALL = 18;
const STEP_BIG = 54;

// ── Shape guides, generated algorithmically so this page stays self
// contained (no dependency on Sketchpad's internals). Points are normalised
// 0..1 then scaled to the canvas at render/use time. ─────────────────────
type Guide = { name: string; Icon: typeof Circle; points: Point[] };

function buildGuides(): Record<string, Guide> {
  const circle: Point[] = Array.from({ length: 64 }, (_, i) => {
    const t = (i / 64) * Math.PI * 2 - Math.PI / 2;
    return { x: 0.5 + Math.cos(t) * 0.35, y: 0.5 + Math.sin(t) * 0.35 };
  });
  const square: Point[] = [
    { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.2 }, { x: 0.8, y: 0.8 }, { x: 0.2, y: 0.8 }, { x: 0.2, y: 0.2 },
  ];
  const triangle: Point[] = [
    { x: 0.5, y: 0.15 }, { x: 0.85, y: 0.8 }, { x: 0.15, y: 0.8 }, { x: 0.5, y: 0.15 },
  ];
  const star: Point[] = Array.from({ length: 11 }, (_, i) => {
    const t = (i / 10) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? 0.38 : 0.16;
    return { x: 0.5 + Math.cos(t) * r, y: 0.5 + Math.sin(t) * r };
  });
  const heart: Point[] = Array.from({ length: 64 }, (_, i) => {
    const t = (i / 64) * Math.PI * 2;
    const hx = 16 * Math.sin(t) ** 3;
    const hy = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
    return { x: 0.5 + (hx / 34), y: 0.5 + (hy / 34) };
  });
  return {
    circle: { name: "circle", Icon: Circle, points: circle },
    square: { name: "square", Icon: Square, points: square },
    triangle: { name: "triangle", Icon: Triangle, points: triangle },
    star: { name: "star", Icon: Star, points: star },
    heart: { name: "heart", Icon: Heart, points: heart },
  };
}
const GUIDES = buildGuides();
const GUIDE_ORDER = ["circle", "square", "triangle", "star", "heart"];

function scaleGuide(g: Guide): Point[] {
  const pad = 60;
  return g.points.map((p) => ({
    x: pad + p.x * (WIDTH - pad * 2),
    y: pad + p.y * (HEIGHT - pad * 2),
  }));
}

// ── Pleasant audio helpers (same recipe used elsewhere in Perceive: sine
// waves, gentle envelopes, a lowpass filter — never raw/buzzy tones). ────
function buildAudio() {
  const Ctor: typeof AudioContext =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  const ctx = new Ctor();
  const osc = ctx.createOscillator();
  const osc2 = ctx.createOscillator();
  const mix = ctx.createGain();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const pan = ctx.createStereoPanner();
  osc.type = "sine";
  osc2.type = "sine";
  osc.frequency.value = 440;
  osc2.frequency.value = 440;
  osc2.detune.value = 6;
  mix.gain.value = 0.5;
  gain.gain.value = 0;
  filter.type = "lowpass";
  filter.frequency.value = 1800;
  filter.Q.value = 0.4;
  osc.connect(mix);
  osc2.connect(mix);
  mix.connect(gain);
  gain.connect(filter);
  filter.connect(pan);
  pan.connect(ctx.destination);
  osc.start();
  osc2.start();
  return { ctx, osc, osc2, gain, pan, filter };
}

function pluckNote(ctx: AudioContext, freq: number, panVal: number, style: "chime" | "marimba", volume: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  const filter = ctx.createBiquadFilter();
  const panner = ctx.createStereoPanner();
  const isMarimba = style === "marimba";
  osc.type = isMarimba ? "triangle" : "sine";
  osc.frequency.value = freq;
  filter.type = "lowpass";
  filter.frequency.value = isMarimba ? 2200 : 3400;
  panner.pan.value = Math.max(-1, Math.min(1, panVal));
  const now = ctx.currentTime;
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

function playSineNote(ctx: AudioContext, freq: number, duration = 0.18, volume = 0.14, vibrato = false): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = "sine";
  osc.frequency.value = freq;
  if (vibrato) {
    const lfo = ctx.createOscillator();
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

function playCompleteChime(ctx: AudioContext): void {
  [523.25, 659.25, 783.99].forEach((f, i) => setTimeout(() => playSineNote(ctx, f, 0.28, 0.12, true), i * 90));
}

function freqForY(y: number): number {
  const rawPitch = 220 + (1 - y / HEIGHT) * 440;
  const penta = [1, 1.125, 1.25, 1.5, 1.667];
  const base = 220;
  const octave = Math.floor(Math.log2(rawPitch / base));
  const normed = rawPitch / base / Math.pow(2, octave);
  const closest = penta.reduce((b, r) => (Math.abs(r - normed) < Math.abs(b - normed) ? r : b));
  return base * closest * Math.pow(2, octave);
}

// ── Direction / position helpers (used both for guide coaching and for
// "where am I" / movement replies). ───────────────────────────────────────
function compassPhrase(dx: number, dy: number): string {
  const ax = Math.abs(dx);
  const ay = Math.abs(dy);
  const horiz = dx > 4 ? "right" : dx < -4 ? "left" : "";
  const vert = dy > 4 ? "down" : dy < -4 ? "up" : "";
  if (horiz && vert) {
    // Only call it diagonal when both components are meaningfully large;
    // otherwise favour whichever axis dominates so the phrase stays simple.
    if (Math.min(ax, ay) / Math.max(ax, ay) > 0.4) return `${vert} and ${horiz}`;
    return ax > ay ? horiz : vert;
  }
  return horiz || vert || "steady, you're right on it";
}

function positionPhrase(p: Point): string {
  const col = p.x < WIDTH / 3 ? "left" : p.x > (WIDTH * 2) / 3 ? "right" : "middle";
  const row = p.y < HEIGHT / 3 ? "top" : p.y > (HEIGHT * 2) / 3 ? "bottom" : "middle";
  if (col === "middle" && row === "middle") return "right in the center of the canvas";
  if (col === "middle") return `in the ${row} middle of the canvas`;
  if (row === "middle") return `on the ${col} side, middle height`;
  return `in the ${row}-${col} of the canvas`;
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
};
function parseCount(text: string): number {
  const digit = text.match(/\b(\d+)\b/);
  if (digit) return Math.max(1, Math.min(10, parseInt(digit[1], 10)));
  for (const [w, n] of Object.entries(NUMBER_WORDS)) {
    if (new RegExp(`\\b${w}\\b`).test(text)) return n;
  }
  return 1;
}

const HELP_LINES = [
  "You can say: move up, down, left, right, or combine them like up right.",
  "Say draw, or pen down, to start a line, and stop drawing, or pen up, to lift it.",
  "Say bigger steps or smaller steps to change how far each move goes.",
  "Say color, then a name — like color sky, or color rose — to change the ink.",
  "Say sound on or sound off, and warm tone, soft pad, wind chime, or marimba to change how it sounds.",
  "Say guide, then a shape — circle, square, triangle, star, or heart — and I'll coach you around it.",
  "Say where am I to hear your position, undo to remove the last line, clear to start over.",
  "Say save my drawing to download it, or share my drawing to send it to the public gallery.",
  "Say bear voice or lady voice to switch narrators. Say help any time to hear this again.",
];

export function BlindStudio() {
  const audioRef = useRef<ReturnType<typeof buildAudio> | null>(null);

  const [position, setPosition] = useState<Point>({ x: WIDTH / 2, y: HEIGHT / 2 });
  const positionRef = useRef(position);
  useEffect(() => { positionRef.current = position; }, [position]);

  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const strokesRef = useRef(strokes);
  useEffect(() => { strokesRef.current = strokes; }, [strokes]);
  const currentStrokeRef = useRef<Stroke | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const isDrawingRef = useRef(false);

  const [colorIndex, setColorIndex] = useState(0);
  const colorIndexRef = useRef(0);
  useEffect(() => { colorIndexRef.current = colorIndex; }, [colorIndex]);

  const [step, setStep] = useState(STEP_SMALL);
  const stepRef = useRef(STEP_SMALL);
  useEffect(() => { stepRef.current = step; }, [step]);

  const [soundOn, setSoundOn] = useState(true);
  const soundOnRef = useRef(true);
  useEffect(() => { soundOnRef.current = soundOn; }, [soundOn]);
  const [soundStyle, setSoundStyle] = useState<SoundStyle>("sine");
  const soundStyleRef = useRef<SoundStyle>("sine");
  useEffect(() => { soundStyleRef.current = soundStyle; }, [soundStyle]);
  const [soundVolume, setSoundVolume] = useState(0.7);
  const soundVolumeRef = useRef(0.7);
  useEffect(() => { soundVolumeRef.current = soundVolume; }, [soundVolume]);

  const [voicePersona, setVoicePersona] = useState<VoicePersona>("bear");
  const voicePersonaRef = useRef<VoicePersona>("bear");
  const [voiceOn, setVoiceOn] = useState(true);
  const voiceOnRef = useRef(true);
  useEffect(() => { voiceOnRef.current = voiceOn; }, [voiceOn]);

  const [guideKey, setGuideKey] = useState<string | null>(null);
  const guideKeyRef = useRef<string | null>(null);
  const guideProgressRef = useRef(0);

  const [sharing, setSharing] = useState(false);
  const sharingRef = useRef(false);

  const [announce, setAnnounce] = useState(
    "Welcome to the fully voice-controlled studio. Press Start Listening, or the L key, then say help to hear what you can say."
  );
  const lastSpokenRef = useRef(announce);

  const [listening, setListening] = useState(false);
  const listeningRef = useRef(false);
  const [micSupported, setMicSupported] = useState(true);
  const [lastHeard, setLastHeard] = useState("");
  const recognitionRef = useRef<any>(null);

  const bennettVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  const ladyVoiceRef = useRef<SpeechSynthesisVoice | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const pickVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      if (!voices.length) return;
      const byName = (re: RegExp) => voices.find((v) => re.test(v.name));
      bennettVoiceRef.current =
        byName(/child|kid|junior/i) ||
        byName(/samantha|karen|moira|tessa|fiona|veena/i) ||
        voices.find((v) => v.lang.startsWith("en")) ||
        voices[0] ||
        null;
      const english = voices.filter((v) => v.lang?.toLowerCase().startsWith("en"));
      const pool = english.length ? english : voices;
      ladyVoiceRef.current =
        pool.find((v) => LADY_VOICE_HINTS.some((h) => v.name.toLowerCase().includes(h))) || pool[0] || null;
    };
    pickVoices();
    window.speechSynthesis.addEventListener("voiceschanged", pickVoices);
    return () => window.speechSynthesis.removeEventListener("voiceschanged", pickVoices);
  }, []);

  const say = useCallback((msg: string, opts?: { force?: boolean }) => {
    setAnnounce(msg);
    lastSpokenRef.current = msg;
    if ((voiceOnRef.current || opts?.force) && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(msg);
      if (voicePersonaRef.current === "lady") {
        if (ladyVoiceRef.current) utter.voice = ladyVoiceRef.current;
        utter.rate = 1.05;
        utter.pitch = 1.3;
      } else {
        if (bennettVoiceRef.current) utter.voice = bennettVoiceRef.current;
        utter.rate = 1.0;
        utter.pitch = 1.4;
      }
      window.speechSynthesis.speak(utter);
    }
  }, []);

  const ensureAudio = useCallback(() => {
    if (audioRef.current) return audioRef.current;
    audioRef.current = buildAudio();
    return audioRef.current;
  }, []);

  // Fire a short sound cue for the current position — a continuous tone for
  // warm tone/soft pad, a plucked note for wind chime/marimba. Called after
  // every move so the pitch/pan of the canvas is always audible, drawing or
  // not (quieter when not drawing, same as the rest of Perceive).
  const soundForPosition = useCallback((p: Point, drawingNow: boolean) => {
    if (!soundOnRef.current) return;
    const a = ensureAudio();
    const panVal = (p.x / WIDTH) * 2 - 1;
    const pitch = freqForY(p.y);
    const vol = soundVolumeRef.current;
    const style = soundStyleRef.current;
    if (style === "chime" || style === "marimba") {
      a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.05);
      pluckNote(a.ctx, pitch, panVal, style, vol);
      return;
    }
    const glide = style === "pad" ? 0.12 : 0.05;
    a.filter.frequency.setTargetAtTime(style === "pad" ? 1100 : 2000, a.ctx.currentTime, 0.1);
    a.pan.pan.setTargetAtTime(panVal, a.ctx.currentTime, 0.03);
    a.osc.frequency.setTargetAtTime(pitch, a.ctx.currentTime, glide);
    a.osc2.frequency.setTargetAtTime(pitch, a.ctx.currentTime, glide);
    a.gain.gain.setTargetAtTime((drawingNow ? 0.16 : 0.07) * vol, a.ctx.currentTime, 0.04);
    window.setTimeout(() => {
      a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.25);
    }, 260);
  }, [ensureAudio]);

  // ── Guide coaching ───────────────────────────────────────────────────────
  const guideFeedback = useCallback((p: Point): string | null => {
    const key = guideKeyRef.current;
    if (!key) return null;
    const guide = GUIDES[key];
    const path = scaleGuide(guide);
    let nearestIdx = 0;
    let nearestDist = Infinity;
    path.forEach((pt, i) => {
      const d = Math.hypot(pt.x - p.x, pt.y - p.y);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    });
    guideProgressRef.current = Math.max(guideProgressRef.current, nearestIdx);
    const lookahead = path[(nearestIdx + 4) % path.length];
    const dir = compassPhrase(lookahead.x - p.x, lookahead.y - p.y);

    const covered = guideProgressRef.current / (path.length - 1);
    if (covered > 0.92 && nearestDist < 40) {
      const a = ensureAudio();
      playCompleteChime(a.ctx);
      guideProgressRef.current = 0;
      return `Beautiful ${guide.name}! You traced the whole shape — nice work.`;
    }
    if (nearestDist > 70) {
      return `You've drifted off the ${guide.name}. Move ${dir} to get back on track.`;
    }
    if (nearestDist > 40) {
      return `Close — nudge ${dir} to stay right on the line.`;
    }
    return `Good, you're on the line. Keep moving ${dir}.`;
  }, [ensureAudio]);

  // ── Movement / drawing ───────────────────────────────────────────────────
  const movePosition = useCallback((dx: number, dy: number, times: number) => {
    const cur = positionRef.current;
    const next: Point = {
      x: Math.max(0, Math.min(WIDTH, cur.x + dx * times)),
      y: Math.max(0, Math.min(HEIGHT, cur.y + dy * times)),
    };
    positionRef.current = next;
    setPosition(next);

    if (isDrawingRef.current) {
      const stroke = currentStrokeRef.current;
      if (stroke) {
        stroke.points.push(next);
        setStrokes((prev) => {
          const copy = prev.slice(0, -1);
          return [...copy, { ...stroke, points: [...stroke.points] }];
        });
      }
    }
    soundForPosition(next, isDrawingRef.current);

    const guideLine = guideFeedback(next);
    if (guideLine) {
      say(guideLine);
    } else {
      say(`Moved ${isDrawingRef.current ? "and drawing, " : ""}now ${positionPhrase(next)}.`);
    }
  }, [guideFeedback, say, soundForPosition]);

  const startDrawing = useCallback(() => {
    if (isDrawingRef.current) { say("Already drawing."); return; }
    isDrawingRef.current = true;
    setIsDrawing(true);
    const stroke: Stroke = { color: COLORS[colorIndexRef.current].value, points: [positionRef.current] };
    currentStrokeRef.current = stroke;
    setStrokes((prev) => [...prev, stroke]);
    say(`Drawing with ${COLORS[colorIndexRef.current].name}. Say move, then a direction, to draw a line.`);
  }, [say]);

  const stopDrawing = useCallback(() => {
    if (!isDrawingRef.current) { say("The pen is already up."); return; }
    isDrawingRef.current = false;
    setIsDrawing(false);
    currentStrokeRef.current = null;
    say("Pen up. Line saved.");
  }, [say]);

  const undo = useCallback(() => {
    setStrokes((prev) => {
      if (!prev.length) { say("Nothing to undo yet."); return prev; }
      say("Undid the last line.");
      return prev.slice(0, -1);
    });
  }, [say]);

  const clearAll = useCallback(() => {
    setStrokes([]);
    currentStrokeRef.current = null;
    isDrawingRef.current = false;
    setIsDrawing(false);
    say("Canvas cleared. Starting fresh.");
  }, [say]);

  const setColorByName = useCallback((name: string) => {
    const idx = COLORS.findIndex((c) => name.includes(c.name));
    if (idx === -1) {
      say(`I don't know the color "${name}". Try black, rose, peach, sky, mint, or another swatch name.`);
      return;
    }
    setColorIndex(idx);
    if (currentStrokeRef.current) currentStrokeRef.current.color = COLORS[idx].value;
    say(`Color set to ${COLORS[idx].name}.`);
  }, [say]);

  const setStyleByName = useCallback((name: string): boolean => {
    const map: [RegExp, SoundStyle][] = [
      [/warm|sine|tone/, "sine"],
      [/pad|soft/, "pad"],
      [/chime|wind/, "chime"],
      [/marimba/, "marimba"],
    ];
    for (const [re, style] of map) {
      if (re.test(name)) {
        setSoundStyle(style);
        say(`Sound style set to ${SOUND_STYLE_LABELS[style]}.`);
        return true;
      }
    }
    return false;
  }, [say]);

  const startGuide = useCallback((name: string) => {
    const key = GUIDE_ORDER.find((g) => name.includes(g));
    if (!key) {
      say("I know circle, square, triangle, star, and heart. Say guide, then one of those.");
      return;
    }
    guideKeyRef.current = key;
    guideProgressRef.current = 0;
    setGuideKey(key);
    const a = ensureAudio();
    playSineNote(a.ctx, 523.25, 0.22, 0.11);
    say(`Starting the ${key} guide. Move around and I'll tell you which way to go. Say stop guide any time to leave it.`);
  }, [ensureAudio, say]);

  const stopGuide = useCallback(() => {
    if (!guideKeyRef.current) { say("No guide is running."); return; }
    guideKeyRef.current = null;
    guideProgressRef.current = 0;
    setGuideKey(null);
    say("Guide stopped.");
  }, [say]);

  // Shared SVG builder — used for both the local download and the gallery
  // submission, so the two always match what's on the canvas.
  const buildSvgString = useCallback((): string => {
    const lines = strokesRef.current
      .map((s) => {
        const pts = s.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
        return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="6" stroke-linecap="round" stroke-linejoin="round" />`;
      })
      .join("\n  ");
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff" />
  ${lines}
</svg>`;
  }, []);

  const exportDrawing = useCallback(() => {
    if (!strokesRef.current.length) { say("There's nothing drawn yet to save."); return; }
    const svg = buildSvgString();
    const blob = new Blob([svg], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "perceive-voice-drawing.svg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    say("Your drawing is saved as an SVG file in your downloads.");
  }, [buildSvgString, say]);

  const shareToGallery = useCallback(() => {
    if (!strokesRef.current.length) { say("There's nothing drawn yet to share."); return; }
    if (sharingRef.current) { say("Already sending your drawing, one moment."); return; }
    sharingRef.current = true;
    setSharing(true);
    say("Sending your drawing to the gallery for review…");
    const svg = buildSvgString();
    saveArtwork(svg)
      .then(() => {
        say("Sent! Your drawing is waiting for a quick review before it joins the public gallery.", { force: true });
      })
      .catch(() => {
        say("Something went wrong sending that to the gallery. You can still say save my drawing to download it instead.", { force: true });
      })
      .finally(() => {
        sharingRef.current = false;
        setSharing(false);
      });
  }, [buildSvgString, say]);

  const explainPage = useCallback(() => {
    say(
      [
        "Here's a tour of the voice studio.",
        "There's no mouse or touch needed here. Say a command and I'll act on it and tell you what happened.",
        ...HELP_LINES,
      ].join(" "),
      { force: true }
    );
  }, [say]);

  // ── Command parsing ──────────────────────────────────────────────────────
  const handleCommand = useCallback((raw: string) => {
    const text = raw.toLowerCase().trim();
    if (!text) return;
    setLastHeard(raw);

    if (/\b(help|what can i say|commands|options)\b/.test(text)) { explainPage(); return; }
    if (/\b(explain|tour|walkthrough)\b/.test(text)) { explainPage(); return; }
    if (/\b(repeat|say that again|say again)\b/.test(text)) { say(lastSpokenRef.current, { force: true }); return; }

    if (/\b(stop listening|pause listening|turn off the mic)\b/.test(text)) { stopListening(); return; }

    if (/\b(draw|pen down|start drawing|begin drawing)\b/.test(text)) { startDrawing(); return; }
    if (/\b(stop drawing|pen up|lift the pen|lift pen)\b/.test(text)) { stopDrawing(); return; }

    if (/\bundo\b/.test(text)) { undo(); return; }
    if (/\b(clear|start over|erase everything|new canvas)\b/.test(text)) { clearAll(); return; }

    if (/\b(where am i|my position|position)\b/.test(text)) {
      say(`You're ${positionPhrase(positionRef.current)}.`);
      return;
    }

    // Sharing to the public gallery — checked before the plain "save" export
    // so "share my drawing" / "post to the gallery" don't fall through.
    if (/\b(share|post|submit)\b/.test(text)) { shareToGallery(); return; }
    if (/\b(save|export|download)\b/.test(text) || /\bsave it\b/.test(text)) { exportDrawing(); return; }

    if (/\b(bigger steps|move faster|larger steps)\b/.test(text)) {
      setStep(STEP_BIG);
      say("Bigger steps — moves will cover more ground now.");
      return;
    }
    if (/\b(smaller steps|move slower|tinier steps|precise)\b/.test(text)) {
      setStep(STEP_SMALL);
      say("Smaller steps — moves will be more precise now.");
      return;
    }

    if (/\b(sound on|turn on sound|unmute sound)\b/.test(text)) { setSoundOn(true); say("Sound is on."); return; }
    if (/\b(sound off|turn off sound|mute sound)\b/.test(text)) { setSoundOn(false); say("Sound is off."); return; }
    if (/\b(louder|turn it up)\b/.test(text)) { setSoundVolume((v) => Math.min(1, v + 0.15)); say("A bit louder."); return; }
    if (/\b(quieter|turn it down|softer)\b/.test(text)) { setSoundVolume((v) => Math.max(0.1, v - 0.15)); say("A bit quieter."); return; }
    if (setStyleByName(text)) return;

    if (/\b(bear voice|switch to bennett|use bennett)\b/.test(text)) {
      voicePersonaRef.current = "bear"; setVoicePersona("bear");
      say("Hey, Bennett here!");
      return;
    }
    if (/\b(lady voice|switch to lady|use the lady)\b/.test(text)) {
      voicePersonaRef.current = "lady"; setVoicePersona("lady");
      say("Hi, I'm your lady guide.");
      return;
    }
    if (/\b(mute narration|turn off narration|quiet please|stop talking)\b/.test(text)) {
      voiceOnRef.current = false; setVoiceOn(false);
      setAnnounce("Narration is off. Say unmute narration to bring my voice back.");
      return;
    }
    if (/\b(unmute narration|turn on narration|start talking)\b/.test(text)) {
      voiceOnRef.current = true; setVoiceOn(true);
      say("Narration is back on.", { force: true });
      return;
    }

    if (/\b(stop guide|cancel guide|leave guide|end guide)\b/.test(text)) { stopGuide(); return; }
    if (/\b(guide|trace|draw a|draw an)\b/.test(text) && GUIDE_ORDER.some((g) => text.includes(g))) {
      startGuide(text);
      return;
    }
    if (/\b(color|colour)\b/.test(text)) { setColorByName(text.replace(/color|colour/g, "").trim()); return; }

    // Directions — checked last since they're the most common command and
    // the broadest match (plain "up"/"left"/etc.), so more specific
    // commands above get first refusal.
    const count = parseCount(text);
    const has = (re: RegExp) => re.test(text);
    let dx = 0, dy = 0, matched = false;
    if (has(/\bup\b/)) { dy -= stepRef.current; matched = true; }
    if (has(/\bdown\b/)) { dy += stepRef.current; matched = true; }
    if (has(/\bleft\b/)) { dx -= stepRef.current; matched = true; }
    if (has(/\bright\b/)) { dx += stepRef.current; matched = true; }
    if (has(/\b(center|middle|home)\b/)) {
      positionRef.current = { x: WIDTH / 2, y: HEIGHT / 2 };
      setPosition(positionRef.current);
      say("Back at the center.");
      return;
    }
    if (matched) { movePosition(dx, dy, count); return; }

    say("Sorry, I didn't catch that. Say help to hear what you can say.");
  }, [clearAll, exportDrawing, explainPage, movePosition, say, setColorByName, setStyleByName, shareToGallery, startDrawing, startGuide, stopDrawing, stopGuide, undo]);

  // ── Speech recognition wiring ────────────────────────────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!Ctor) { setMicSupported(false); return; }
    const recognition = new Ctor();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event: any) => {
      const result = event.results[event.results.length - 1];
      const transcript = result?.[0]?.transcript ?? "";
      handleCommand(transcript);
    };
    recognition.onerror = (event: any) => {
      if (event.error === "no-speech" || event.error === "aborted") return;
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        listeningRef.current = false;
        setListening(false);
        say("I need microphone permission to listen. Please allow microphone access and press Start Listening again.", { force: true });
      }
    };
    recognition.onend = () => {
      // Most browsers stop the recognizer after a pause — restart it
      // automatically as long as the person hasn't asked us to stop.
      if (listeningRef.current) {
        try { recognition.start(); } catch { /* already starting */ }
      }
    };
    recognitionRef.current = recognition;
    return () => {
      try { recognition.stop(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleCommand]);

  const startListening = useCallback(() => {
    if (!recognitionRef.current) { setMicSupported(false); return; }
    ensureAudio();
    listeningRef.current = true;
    setListening(true);
    try { recognitionRef.current.start(); } catch { /* already running */ }
    say("I'm listening. Say help any time to hear what you can say.", { force: true });
  }, [ensureAudio, say]);

  function stopListening() {
    listeningRef.current = false;
    setListening(false);
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setAnnounce("Stopped listening. Press Start Listening, or the L key, to continue by voice.");
  }

  // ── Keyboard fallback — full parity for anyone who can't use (or doesn't
  // want to use) the microphone. ───────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const count = e.shiftKey ? 3 : 1;
      switch (e.key) {
        case "ArrowUp": e.preventDefault(); movePosition(0, -stepRef.current, count); break;
        case "ArrowDown": e.preventDefault(); movePosition(0, stepRef.current, count); break;
        case "ArrowLeft": e.preventDefault(); movePosition(-stepRef.current, 0, count); break;
        case "ArrowRight": e.preventDefault(); movePosition(stepRef.current, 0, count); break;
        case " ": e.preventDefault(); isDrawingRef.current ? stopDrawing() : startDrawing(); break;
        case "l": case "L": listeningRef.current ? stopListening() : startListening(); break;
        case "h": case "H": explainPage(); break;
        case "u": case "U": undo(); break;
        case "c": case "C": clearAll(); break;
        case "e": case "E": exportDrawing(); break;
        case "p": case "P": shareToGallery(); break;
        case "g": case "G": {
          const idx = guideKeyRef.current ? (GUIDE_ORDER.indexOf(guideKeyRef.current) + 1) % GUIDE_ORDER.length : 0;
          startGuide(GUIDE_ORDER[idx]);
          break;
        }
        case "[": setColorIndex((i) => (i - 1 + COLORS.length) % COLORS.length); break;
        case "]": setColorIndex((i) => (i + 1) % COLORS.length); break;
        default: break;
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [clearAll, explainPage, exportDrawing, movePosition, shareToGallery, startDrawing, startGuide, startListening, stopDrawing, undo]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const guidePath = useMemo(() => (guideKey ? scaleGuide(GUIDES[guideKey]) : null), [guideKey]);
  const guidePoints = guidePath ? guidePath.map((p) => `${p.x},${p.y}`).join(" ") : "";

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
      <p aria-live="assertive" role="status" className="sr-only">{announce}</p>

      <div className="rounded-[2rem] bg-card/80 p-5 shadow-lg ring-1 ring-primary/15 backdrop-blur-md sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
              Voice <span className="font-['Instrument_Serif',Georgia,serif] font-normal italic">Studio</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Built for people who can't see the screen at all. Everything here — moving, drawing, colour,
              sound, shape guides, and saving your work — happens by voice. Press Start Listening and say
              "help" to hear every command.
            </p>
          </div>
          <Link
            to="/studio"
            className="shrink-0 rounded-full bg-background/60 px-3.5 py-2 text-xs font-medium text-muted-foreground ring-1 ring-primary/10 transition-colors hover:bg-primary/10 hover:text-foreground"
          >
            Prefer a visual studio? Go there instead
          </Link>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <Button
            onClick={() => (listening ? stopListening() : startListening())}
            className="h-14 gap-2 rounded-full px-6 text-base shadow-md"
            aria-pressed={listening}
          >
            {listening ? <Mic className="h-5 w-5 animate-pulse" /> : <MicOff className="h-5 w-5" />}
            {listening ? "Listening… (say “stop listening”)" : "Start Listening"}
          </Button>
          <Button
            variant="outline"
            onClick={() => (voiceOn ? (voiceOnRef.current = false, setVoiceOn(false)) : (voiceOnRef.current = true, setVoiceOn(true), say("Narration is back on.", { force: true })))}
            className="h-12 gap-2 rounded-full px-4"
            aria-pressed={voiceOn}
          >
            {voiceOn ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}
            {voiceOn ? "Narration on" : "Narration off"}
          </Button>
          <Button variant="outline" onClick={explainPage} className="h-12 gap-2 rounded-full px-4">
            <HelpCircle className="h-4 w-4" /> Explain this page
          </Button>
          {!micSupported && (
            <span className="rounded-full bg-destructive/10 px-3 py-1.5 text-xs font-medium text-destructive">
              Voice commands aren't supported in this browser — try Chrome or Edge. Keyboard controls below
              still work fully.
            </span>
          )}
        </div>

        <div aria-hidden="true" className="mt-4 rounded-2xl bg-background/60 p-4 ring-1 ring-white/50">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Last heard</p>
          <p className="mt-1 text-sm text-foreground">{lastHeard || "— nothing yet —"}</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Bennett says</p>
          <p className="mt-1 text-sm font-medium text-foreground">{announce}</p>
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="rounded-3xl bg-card/80 p-4 shadow-lg ring-1 ring-primary/15 backdrop-blur-md sm:p-5">
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full rounded-2xl bg-white shadow-inner"
            role="img"
            aria-label={`Drawing canvas. Cursor is ${positionPhrase(position)}.`}
          >
            {guidePath && (
              <polyline points={guidePoints} fill="none" stroke="#c9a0dc" strokeWidth={3} strokeDasharray="6 8" opacity={0.6} />
            )}
            {strokes.map((s, i) => (
              <polyline
                key={i}
                points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
                fill="none"
                stroke={s.color}
                strokeWidth={6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            <circle cx={position.x} cy={position.y} r={isDrawing ? 10 : 8} fill={COLORS[colorIndex].value} stroke="#ffffff" strokeWidth={2} />
          </svg>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>Color: <strong className="text-foreground">{COLORS[colorIndex].name}</strong></span>
            <span>Sound: <strong className="text-foreground">{soundOn ? SOUND_STYLE_LABELS[soundStyle] : "off"}</strong></span>
            <span>Guide: <strong className="text-foreground">{guideKey ?? "none"}</strong></span>
            <span>Voice: <strong className="text-foreground">{voicePersona === "bear" ? "Bennett" : "Lady"}</strong></span>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={undo} className="h-8 gap-1.5 rounded-full px-3 text-xs">
                <RotateCcw className="h-3 w-3" /> Undo
              </Button>
              <Button size="sm" variant="outline" onClick={clearAll} className="h-8 gap-1.5 rounded-full px-3 text-xs">
                <Trash2 className="h-3 w-3" /> Clear
              </Button>
              <Button size="sm" variant="outline" onClick={exportDrawing} className="h-8 gap-1.5 rounded-full px-3 text-xs">
                <Download className="h-3 w-3" /> Save
              </Button>
              <Button size="sm" variant="outline" onClick={shareToGallery} disabled={sharing} className="h-8 gap-1.5 rounded-full px-3 text-xs">
                <Share2 className="h-3 w-3" /> {sharing ? "Sending…" : "Share"}
              </Button>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-3xl bg-card/80 p-4 shadow-lg ring-1 ring-primary/15 backdrop-blur-md">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Compass className="h-4 w-4 text-primary" /> Things you can say
            </h2>
            <ul className="space-y-2 text-xs leading-relaxed text-muted-foreground">
              {HELP_LINES.map((l, i) => (<li key={i}>{l}</li>))}
            </ul>
          </div>

          <div className="rounded-3xl bg-card/80 p-4 shadow-lg ring-1 ring-primary/15 backdrop-blur-md">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Sparkles className="h-4 w-4 text-primary" /> Shape guides
            </h2>
            <div className="flex flex-wrap gap-2">
              {GUIDE_ORDER.map((g) => {
                const Icon = GUIDES[g].Icon;
                const on = guideKey === g;
                return (
                  <button
                    key={g}
                    onClick={() => (on ? stopGuide() : startGuide(g))}
                    aria-pressed={on}
                    className={`flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors ${
                      on ? "bg-primary text-primary-foreground shadow-md" : "bg-background/60 text-foreground ring-1 ring-primary/10 hover:bg-primary/10"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" /> {g}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-[11px] text-muted-foreground">
              Keyboard, no mic needed: arrow keys move, Space draws/lifts the pen, G cycles guides, L toggles
              listening, H explains the page, U undoes, C clears, E saves, P shares to the gallery, [ and ]
              change colour.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
