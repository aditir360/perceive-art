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
  Keyboard,
  Move,
  Music2,
  Palette,
  Pencil,
  Sparkles,
  type LucideIcon,
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

const ACCENT = "font-['Instrument_Serif',Georgia,serif] font-normal italic tracking-tight";
const SEEN_INTRO_KEY = "perceive-voice-intro-seen";

const INTRO_LONG =
  "Welcome to the Voice Studio. I'm your guide, and you control everything by speaking. " +
  "Say move, then up, down, left or right, to move your brush. " +
  "Say draw to put the pen down, and stop drawing to lift it. " +
  "Say color, then a name like sky or rose, to change the ink. " +
  "Say guide, then circle, square, triangle, star or heart, and I'll coach you around the shape. " +
  "Say undo, clear, save my drawing, or share my drawing. " +
  "Say help any time to hear every command again. " +
  "Press any key or tap the screen to skip this. I'm turning on your microphone now.";
const INTRO_SHORT =
  "Welcome back. I'm turning on your microphone now. Say help any time to hear every command.";
const GATE_PROMPT = "Voice Studio. Tap anywhere, or press any key, to begin.";

type CommandGroup = { id: string; title: string; Icon: LucideIcon; phrases: string[]; note: string; speech: string };
const COMMAND_GROUPS: CommandGroup[] = [
  {
    id: "move", title: "Move", Icon: Move,
    phrases: ["move up", "move down", "left", "right", "up right", "go to the center"],
    note: "Combine directions, or add a number, like “right three”. Say bigger steps or smaller steps to change how far each move goes.",
    speech: HELP_LINES[0] + " " + HELP_LINES[2],
  },
  {
    id: "draw", title: "Draw", Icon: Pencil,
    phrases: ["draw", "pen down", "stop drawing", "pen up", "undo", "clear"],
    note: "Say draw, then move to make a line. Undo removes the last line. Clear starts over.",
    speech: HELP_LINES[1] + " Say undo to remove the last line, and clear to start over.",
  },
  {
    id: "color", title: "Color", Icon: Palette,
    phrases: ["color sky", "color rose", "color mint", "color black"],
    note: "Sixteen colours: black, white, rose, peach, sun, amber, crimson, coral, gold, lavender, plum, sky, teal, mint, forest and indigo.",
    speech: HELP_LINES[3],
  },
  {
    id: "sound", title: "Sound", Icon: Music2,
    phrases: ["sound on", "sound off", "warm tone", "soft pad", "wind chime", "marimba", "louder", "quieter"],
    note: "Left and right pans the sound. Up and down changes the pitch.",
    speech: HELP_LINES[4],
  },
  {
    id: "guides", title: "Shape guides", Icon: Sparkles,
    phrases: ["guide circle", "guide square", "guide triangle", "guide star", "guide heart", "stop guide"],
    note: "I'll tell you which way to go, and how to get back if you drift off the shape.",
    speech: HELP_LINES[5],
  },
  {
    id: "keep", title: "Keep and share", Icon: Download,
    phrases: ["where am I", "save my drawing", "share my drawing", "repeat", "help"],
    note: "Save downloads your drawing. Share sends it to the gallery for review.",
    speech: HELP_LINES[6] + " " + HELP_LINES[7] + " " + HELP_LINES[8],
  },
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

  const [voicePersona, setVoicePersona] = useState<VoicePersona>("lady");
  const voicePersonaRef = useRef<VoicePersona>("lady");
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

  const introRef = useRef(false);
  const startedAtRef = useRef(0);
  const [started, setStarted] = useState(false);
  const startedRef = useRef(false);
  const [speaking, setSpeaking] = useState(false);
  const speakingRef = useRef(false);

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

  const say = useCallback((msg: string, opts?: { force?: boolean; onEnd?: () => void }) => {
    setAnnounce(msg);
    lastSpokenRef.current = msg;
    if ((voiceOnRef.current || opts?.force) && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utter = new SpeechSynthesisUtterance(msg);
      let finished = false;
      const done = () => {
        if (finished) return;
        finished = true;
        speakingRef.current = false;
        setSpeaking(false);
        opts?.onEnd?.();
      };
      utter.onstart = () => { speakingRef.current = true; setSpeaking(true); };
      utter.onend = done;
      utter.onerror = done;
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
    } else if (opts?.onEnd) {
      window.setTimeout(opts.onEnd, 0);
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
      // Don't treat the guide's own voice (picked up by the mic) as a command.
      if (speakingRef.current) return;
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

  const startListening = useCallback((quiet = false) => {
    if (!recognitionRef.current) { setMicSupported(false); return; }
    const a = ensureAudio();
    if (a.ctx.state === "suspended") void a.ctx.resume();
    listeningRef.current = true;
    setListening(true);
    try { recognitionRef.current.start(); } catch { /* already running */ }
    if (quiet) {
      // A short rising two-note cue means "the mic is on, go ahead".
      playSineNote(a.ctx, 523.25, 0.14, 0.1);
      window.setTimeout(() => playSineNote(a.ctx, 783.99, 0.18, 0.1), 120);
      setAnnounce("I'm listening. Say help any time to hear every command.");
    } else {
      say("I'm listening. Say help any time to hear what you can say.", { force: true });
    }
  }, [ensureAudio, say]);

  // First tap / key press: explain the commands out loud, then switch the
  // mic on as soon as the explanation ends (so it never hears the guide).
  // The press is also what lets the browser play audio and ask for the mic.
  const beginSession = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    startedAtRef.current = Date.now();
    setStarted(true);
    const a = ensureAudio();
    if (a.ctx.state === "suspended") void a.ctx.resume();
    let seen = false;
    try {
      seen = window.localStorage.getItem(SEEN_INTRO_KEY) === "1";
      window.localStorage.setItem(SEEN_INTRO_KEY, "1");
    } catch { /* storage unavailable */ }
    introRef.current = true;
    say(seen ? INTRO_SHORT : INTRO_LONG, {
      force: true,
      onEnd: () => {
        introRef.current = false;
        if (!listeningRef.current) startListening(true);
      },
    });
  }, [ensureAudio, say, startListening]);

  // Skip the spoken intro: stop talking and open the mic straight away.
  const skipIntro = useCallback(() => {
    if (!introRef.current || Date.now() - startedAtRef.current < 400) return;
    introRef.current = false;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    speakingRef.current = false;
    setSpeaking(false);
    if (!listeningRef.current) startListening(true);
  }, [startListening]);

  function stopListening() {
    listeningRef.current = false;
    setListening(false);
    try { recognitionRef.current?.stop(); } catch { /* noop */ }
    setAnnounce("Stopped listening. Press Start Listening, or the L key, to continue by voice.");
  }

  // Before the first press: say the "tap anywhere" prompt out loud on a loop
  // (about every 6 seconds). Browsers may keep speech silent until the very
  // first press, so the same text is also in the screen-reader live region.
  useEffect(() => {
    if (started || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    setAnnounce(GATE_PROMPT);
    const speakPrompt = () => {
      if (startedRef.current || window.speechSynthesis.speaking) return;
      const u = new SpeechSynthesisUtterance(GATE_PROMPT);
      if (ladyVoiceRef.current) u.voice = ladyVoiceRef.current;
      u.rate = 1.05;
      u.pitch = 1.3;
      window.speechSynthesis.speak(u);
    };
    const first = window.setTimeout(speakPrompt, 800);
    const loop = window.setInterval(speakPrompt, 6000);
    const onKey = (e: KeyboardEvent) => {
      if (["Shift", "Control", "Alt", "Meta", "CapsLock", "Tab"].includes(e.key)) return;
      e.preventDefault();
      window.speechSynthesis.cancel();
      beginSession();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(loop);
      window.removeEventListener("keydown", onKey);
    };
  }, [started, beginSession]);

  // ── Keyboard fallback — full parity for anyone who can't use (or doesn't
  // want to use) the microphone. ───────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (!startedRef.current) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (introRef.current) { e.preventDefault(); skipIntro(); return; }
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
  }, [clearAll, explainPage, exportDrawing, movePosition, shareToGallery, startDrawing, startGuide, skipIntro, startListening, stopDrawing, undo]);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const guidePath = useMemo(() => (guideKey ? scaleGuide(GUIDES[guideKey]) : null), [guideKey]);
  const guidePoints = guidePath ? guidePath.map((p) => `${p.x},${p.y}`).join(" ") : "";

  const speechLabel = voicePersona === "bear" ? "Bennett" : "Lady guide";
  const statusText = !started
    ? "Waiting to begin"
    : speaking
      ? `${speechLabel} is speaking`
      : listening
        ? "Listening for you"
        : "Microphone is off";
  const GLASS = "rounded-[2rem] bg-card/70 shadow-2xl shadow-primary/15 ring-1 ring-white/60 backdrop-blur-xl";

  return (
    <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6" onPointerDown={skipIntro}>
      <p aria-live="assertive" role="status" className="sr-only">{announce}</p>

      {/* ───────── Start gate: tap anywhere / press any key ───────── */}
      {!started && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Start the Voice Studio"
          onPointerDown={(e) => { e.stopPropagation(); beginSession(); }}
          className="fixed inset-0 z-[70] flex cursor-pointer flex-col items-center justify-center bg-background/95 px-6 text-center backdrop-blur-xl"
        >
          <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-accent/25 blur-3xl" />
          </div>
          <div className="relative">
            <span aria-hidden className="absolute inset-0 -m-6 animate-ping rounded-full bg-primary/20" />
            <span className="relative grid h-36 w-36 place-items-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/40 sm:h-44 sm:w-44">
              <Mic className="h-16 w-16 sm:h-20 sm:w-20" />
            </span>
          </div>
          <p className="relative mt-10 text-[11px] font-bold uppercase tracking-[0.24em] text-primary">Voice Studio</p>
          <h1 className="relative mt-3 text-4xl font-black tracking-[-0.03em] text-foreground sm:text-6xl">
            Tap anywhere to <span className={`${ACCENT} text-[1.12em]`}>begin.</span>
          </h1>
          <p className="relative mt-4 max-w-md text-base text-muted-foreground sm:text-lg">
            Or press any key. Your guide will explain the commands out loud, then turn on your microphone.
          </p>
          <button
            type="button"
            autoFocus
            onClick={beginSession}
            className="relative mt-8 h-14 rounded-full bg-foreground px-8 text-base font-semibold text-background shadow-xl outline-none ring-offset-2 ring-offset-background focus-visible:ring-4 focus-visible:ring-primary"
          >
            Begin voice studio
          </button>
        </div>
      )}

      {/* ───────── Hero + mic ───────── */}
      <div className={`${GLASS} overflow-hidden`}>
        <div className="grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
          <div className="p-6 sm:p-9">
            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              <span aria-hidden className="h-px w-8 bg-primary/60" />
              Hands-free studio
            </div>
            <h1 className="mt-4 text-5xl font-black tracking-[-0.04em] text-foreground sm:text-6xl">
              Voice <span className={`${ACCENT} text-[1.12em]`}>Studio.</span>
            </h1>
            <p className="mt-4 max-w-md text-base leading-relaxed text-muted-foreground">
              Built for people who can't see the screen. Speak a command, and your guide moves the brush, draws,
              and tells you what happened.
            </p>

            <div className="mt-7 flex flex-wrap items-center gap-3">
              <Button
                onClick={() => (listening ? stopListening() : startListening())}
                className="h-14 gap-3 rounded-full px-7 text-base shadow-lg"
                aria-pressed={listening}
              >
                {listening ? <Mic className="h-5 w-5 animate-pulse" /> : <MicOff className="h-5 w-5" />}
                {listening ? "Listening. Tap to stop" : "Start listening"}
                <span className="rounded-md bg-primary-foreground/15 px-1.5 text-xs font-semibold">L</span>
              </Button>
              <Button variant="outline" onClick={explainPage} className="h-14 gap-2 rounded-full bg-background/60 px-5">
                <HelpCircle className="h-4 w-4" /> Hear all commands <span className="text-xs opacity-60">H</span>
              </Button>
            </div>

            {!micSupported && (
              <p className="mt-4 rounded-2xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
                Voice commands aren't supported in this browser. Try Chrome or Edge. The keyboard controls below
                still work fully.
              </p>
            )}

            <div className="mt-7 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => (voiceOn ? (voiceOnRef.current = false, setVoiceOn(false), setAnnounce("Narration is off.")) : (voiceOnRef.current = true, setVoiceOn(true), say("Narration is back on.", { force: true })))}
                aria-pressed={voiceOn}
                className={`flex h-11 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors ${voiceOn ? "bg-primary/15 ring-1 ring-primary/40" : "ring-1 ring-border/70 hover:bg-primary/10"}`}
              >
                {voiceOn ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4" />}
                {voiceOn ? "Narration on" : "Narration off"}
              </button>
              {(["bear", "lady"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => { voicePersonaRef.current = p; setVoicePersona(p); say(p === "bear" ? "Hey, Bennett here!" : "Hi, I'm your lady guide.", { force: true }); }}
                  aria-pressed={voicePersona === p}
                  className={`flex h-11 items-center rounded-full px-4 text-sm font-medium transition-colors ${voicePersona === p ? "bg-foreground text-background shadow-md" : "ring-1 ring-border/70 hover:bg-primary/10"}`}
                >
                  {p === "bear" ? "Bennett" : "Lady"}
                </button>
              ))}
            </div>
          </div>

          {/* Live conversation: big, high-contrast text for low-vision helpers */}
          <div className="border-t border-border/70 bg-secondary/30 p-6 sm:p-9 lg:border-l lg:border-t-0">
            <div className="flex items-center gap-4">
              <span className="relative grid h-16 w-16 shrink-0 place-items-center">
                {(listening || speaking) && <span aria-hidden className="absolute inset-0 animate-ping rounded-full bg-primary/25" />}
                <span className={`relative grid h-16 w-16 place-items-center rounded-full shadow-lg ${speaking ? "bg-accent text-accent-foreground" : listening ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {speaking ? <Volume2 className="h-7 w-7" /> : listening ? <Mic className="h-7 w-7" /> : <MicOff className="h-7 w-7" />}
                </span>
              </span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Status</p>
                <p className="text-xl font-bold text-foreground">{statusText}</p>
              </div>
            </div>

            <div aria-hidden="true" className="mt-6 space-y-4">
              <div className="rounded-2xl bg-background/60 p-4 ring-1 ring-border/70">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">You said</p>
                <p className="mt-1.5 min-h-[1.75rem] text-xl font-semibold text-foreground">{lastHeard || "Nothing yet"}</p>
              </div>
              <div className="rounded-2xl bg-background/60 p-4 ring-1 ring-primary/30">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">{speechLabel} says</p>
                <p className="mt-1.5 text-lg font-medium leading-snug text-foreground">{announce}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ───────── Canvas + guides ───────── */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section aria-label="Canvas" className={`${GLASS} p-4 sm:p-5`}>
          <svg
            viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
            className="w-full rounded-2xl bg-white shadow-inner ring-1 ring-border/70 dark:brightness-[0.88]"
            role="img"
            aria-label={`Drawing canvas. Cursor is ${positionPhrase(position)}.`}
          >
            {guidePath && (
              <polyline points={guidePoints} fill="none" stroke="#c9a0dc" strokeWidth={3} strokeDasharray="6 8" opacity={0.7} />
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
            <circle cx={position.x} cy={position.y} r={isDrawing ? 10 : 8} fill={COLORS[colorIndex].value} stroke="#111111" strokeWidth={2} />
          </svg>

          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            {[
              ["Color", COLORS[colorIndex].name],
              ["Sound", soundOn ? SOUND_STYLE_LABELS[soundStyle] : "off"],
              ["Guide", guideKey ?? "none"],
              ["Pen", isDrawing ? "down" : "up"],
            ].map(([k, v]) => (
              <span key={k} className="rounded-full bg-background/60 px-3 py-1.5 ring-1 ring-border/70">
                <span className="text-muted-foreground">{k}: </span>
                <strong className="capitalize text-foreground">{v}</strong>
              </span>
            ))}
            <span className="ml-auto flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={undo} className="h-9 gap-1.5 rounded-full px-3"><RotateCcw className="h-3.5 w-3.5" /> Undo</Button>
              <Button size="sm" variant="outline" onClick={clearAll} className="h-9 gap-1.5 rounded-full px-3"><Trash2 className="h-3.5 w-3.5" /> Clear</Button>
              <Button size="sm" variant="outline" onClick={exportDrawing} className="h-9 gap-1.5 rounded-full px-3"><Download className="h-3.5 w-3.5" /> Save</Button>
              <Button size="sm" onClick={shareToGallery} disabled={sharing} className="h-9 gap-1.5 rounded-full px-3"><Share2 className="h-3.5 w-3.5" /> {sharing ? "Sending…" : "Share"}</Button>
            </span>
          </div>
        </section>

        <aside className="space-y-6">
          <section className={`${GLASS} p-5`} aria-labelledby="guides-heading">
            <h2 id="guides-heading" className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <span><span className="text-primary">02</span> / Shape guides</span>
              <Sparkles className="h-4 w-4 opacity-70" aria-hidden />
            </h2>
            <h3 className="mt-4 text-xl font-black tracking-tight">
              Trace a <span className={`${ACCENT} text-[1.15em]`}>shape.</span>
            </h3>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {GUIDE_ORDER.map((g) => {
                const Icon = GUIDES[g].Icon;
                const on = guideKey === g;
                return (
                  <button
                    key={g}
                    type="button"
                    onClick={() => (on ? stopGuide() : startGuide(g))}
                    aria-pressed={on}
                    className={`flex h-12 items-center gap-2.5 rounded-xl px-3 text-sm font-medium capitalize transition-colors ${on ? "bg-primary/15 ring-1 ring-primary/50" : "ring-1 ring-border/70 hover:bg-primary/10"}`}
                  >
                    <Icon className="h-4 w-4 shrink-0" /> {g}
                  </button>
                );
              })}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Say "guide circle", then "stop guide" to leave.</p>
          </section>

          <section className={`${GLASS} p-5`} aria-labelledby="colors-heading">
            <h2 id="colors-heading" className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              <span><span className="text-primary">03</span> / Colors</span>
              <Palette className="h-4 w-4 opacity-70" aria-hidden />
            </h2>
            <div className="mt-4 grid grid-cols-8 gap-2">
              {COLORS.map((c, i) => (
                <button
                  key={c.name}
                  type="button"
                  onClick={() => setColorByName(c.name)}
                  aria-label={`Color ${c.name}`}
                  aria-pressed={colorIndex === i}
                  className={`aspect-square w-full rounded-full ring-2 ring-offset-2 ring-offset-card transition-all hover:scale-110 ${colorIndex === i ? "scale-110 ring-foreground" : "ring-border/60"}`}
                  style={{ backgroundColor: c.value }}
                />
              ))}
            </div>
            <p className="mt-3 text-xs text-muted-foreground">Say "color" and a name, like "color {COLORS[2].name}".</p>
          </section>
        </aside>
      </div>

      {/* ───────── Everything you can say ───────── */}
      <section className="mt-10" aria-labelledby="commands-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              <span aria-hidden className="h-px w-8 bg-primary/60" />
              Commands
            </div>
            <h2 id="commands-heading" className="mt-3 text-3xl font-black tracking-[-0.03em] sm:text-4xl">
              Everything you can <span className={`${ACCENT} text-[1.12em]`}>say.</span>
            </h2>
          </div>
          <Button variant="outline" onClick={explainPage} className="h-12 gap-2 rounded-full bg-card/60 px-5">
            <Volume2 className="h-4 w-4" /> Read them all aloud
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {COMMAND_GROUPS.map((g, i) => (
            <article key={g.id} className={`${GLASS} flex flex-col p-5`} aria-labelledby={`cmd-${g.id}`}>
              <h3 id={`cmd-${g.id}`} className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                <span><span className="text-primary">{String(i + 1).padStart(2, "0")}</span> / {g.title}</span>
                <g.Icon className="h-4 w-4 opacity-70" aria-hidden />
              </h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {g.phrases.map((p) => (
                  <li key={p} className="rounded-full bg-background/60 px-3 py-1.5 text-sm font-medium text-foreground ring-1 ring-border/70">
                    “{p}”
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">{g.note}</p>
              <button
                type="button"
                onClick={() => say(g.speech, { force: true })}
                className="mt-4 flex h-10 items-center gap-2 self-start rounded-full px-3.5 text-sm font-medium text-foreground ring-1 ring-border/70 transition-colors hover:bg-primary/10"
              >
                <Volume2 className="h-4 w-4" /> Hear this
              </button>
            </article>
          ))}
        </div>
      </section>

      {/* ───────── Keyboard fallback ───────── */}
      <section className={`${GLASS} mt-8 p-6`} aria-labelledby="kbd-heading">
        <h2 id="kbd-heading" className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          <span><span className="text-primary">08</span> / Keyboard, no mic needed</span>
          <Keyboard className="h-4 w-4 opacity-70" aria-hidden />
        </h2>
        <ul className="mt-4 grid gap-x-6 gap-y-2 text-sm text-muted-foreground sm:grid-cols-2 lg:grid-cols-3">
          <li>Arrow keys: move (Shift = 3 steps)</li>
          <li>Space: pen down or up</li>
          <li>L: start or stop listening</li>
          <li>H: hear all commands</li>
          <li>U: undo. C: clear</li>
          <li>E: save. P: share to gallery</li>
          <li>G: cycle shape guides</li>
          <li>[ and ]: change colour</li>
        </ul>
        <div className="mt-5">
          <Link
            to="/studio"
            className="inline-flex h-11 items-center rounded-full px-4 text-sm font-medium text-foreground ring-1 ring-border/70 transition-colors hover:bg-primary/10"
          >
            Prefer a visual studio? Go there instead
          </Link>
        </div>
      </section>
    </div>
  );
}
