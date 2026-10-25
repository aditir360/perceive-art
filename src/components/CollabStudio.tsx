import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { saveArtwork } from "@/lib/gallery-storage";
import {
  CANVAS_H,
  CANVAS_W,
  CODE_LENGTH,
  PRIVATE_CAP,
  PUBLIC_CAP,
  makeRoomCode,
  normalizeCode,
  useCollabRoom,
  type CStroke,
  type Pt,
  type RoomRequest,
} from "@/lib/collab";
import {
  ArrowRight,
  Check,
  Copy,
  Download,
  Box,
  Eraser,
  Waves,
  Palette,
  Paintbrush,
  Eye,
  Keyboard,
  ChevronRight,
  Map,
  PaintBucket,
  Pencil,
  Globe,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Share2,
  Trash2,
  Undo2,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";

const ACCENT = "font-['Instrument_Serif',Georgia,serif] font-normal italic tracking-tight";

const SWATCHES = [
  { name: "black", value: "#000000" },
  { name: "rose", value: "#e88aab" },
  { name: "crimson", value: "#c2385a" },
  { name: "coral", value: "#ff7f6b" },
  { name: "sun", value: "#f5a623" },
  { name: "gold", value: "#e0b04f" },
  { name: "mint", value: "#48b376" },
  { name: "teal", value: "#3fb8af" },
  { name: "sky", value: "#4da6ff" },
  { name: "indigo", value: "#5b5ea6" },
  { name: "plum", value: "#9b72cf" },
  { name: "peach", value: "#f9a8a8" },
  { name: "amber", value: "#d98324" },
  { name: "ink", value: "#3a1f2b" },
  { name: "lavender", value: "#c9a0dc" },
  { name: "forest", value: "#2f6b4f" },
  { name: "white", value: "#ffffff" },
];

const KEY_STEP = 14;
const KEY_STEP_BIG = 56;
const TEXTURES = ["pen", "pencil", "highlighter", "paintbrush"] as const;
const TEXTURE_LABELS: Record<(typeof TEXTURES)[number], string> = { pen: "Pen", pencil: "Pencil", highlighter: "Highlighter", paintbrush: "Paintbrush" };
const SHAPE_GUIDES: Record<string, { name: string; points: Pt[] }> = {
  circle: { name: "Circle", points: Array.from({ length: 65 }, (_, i) => ({ x: CANVAS_W / 2 + Math.cos((i / 64) * Math.PI * 2) * 150, y: CANVAS_H / 2 + Math.sin((i / 64) * Math.PI * 2) * 150 })) },
  wave: { name: "Wave", points: Array.from({ length: 61 }, (_, i) => ({ x: 90 + i * 12, y: CANVAS_H / 2 + Math.sin(i / 60 * Math.PI * 4) * 100 })) },
  heart: { name: "Heart", points: Array.from({ length: 81 }, (_, i) => { const t = i / 80 * Math.PI * 2; return { x: CANVAS_W / 2 + 10 * 16 * Math.pow(Math.sin(t), 3), y: CANVAS_H / 2 - 9 * (13 * Math.cos(t) - 5 * Math.cos(2*t) - 2 * Math.cos(3*t) - Math.cos(4*t)) }; }) },
  spiral: { name: "Spiral", points: Array.from({ length: 90 }, (_, i) => { const t = i / 89 * Math.PI * 5; const r = 8 + i * 1.7; return { x: CANVAS_W / 2 + Math.cos(t) * r, y: CANVAS_H / 2 + Math.sin(t) * r }; }) },
};

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Rasterize the current line work at half resolution, flood-fill the connected
// paper region, and encode the result as compact SVG rectangle subpaths.
function makeBucketFillPath(
  strokes: { points: { x: number; y: number }[]; color: string; width: number; opacity?: number; fillPath?: string }[],
  width: number, height: number, point: { x: number; y: number },
): string | null {
  const scale = 2;
  const w = Math.ceil(width / scale), h = Math.ceil(height / scale);
  const canvas = document.createElement("canvas"); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true }); if (!ctx) return null;
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  for (const s of strokes) {
    if (s.fillPath) {
      ctx.save(); ctx.scale(1 / scale, 1 / scale); ctx.fillStyle = s.color; ctx.fill(new Path2D(s.fillPath)); ctx.restore();
      continue;
    }
    if (s.points.length < 1) continue;
    ctx.beginPath(); ctx.moveTo(s.points[0].x / scale, s.points[0].y / scale);
    for (const p of s.points.slice(1)) ctx.lineTo(p.x / scale, p.y / scale);
    ctx.strokeStyle = s.color; ctx.globalAlpha = s.opacity ?? 1; ctx.lineWidth = Math.max(1, s.width / scale); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  const image = ctx.getImageData(0, 0, w, h), data = image.data;
  const sx = Math.max(0, Math.min(w - 1, Math.floor(point.x / scale)));
  const sy = Math.max(0, Math.min(h - 1, Math.floor(point.y / scale)));
  const start = (sy * w + sx) * 4;
  const eligible = (i: number) => data[i + 3] > 0 && data[i] > 238 && data[i + 1] > 238 && data[i + 2] > 238;
  if (!eligible(start)) return null;
  const seen = new Uint8Array(w * h), filled = new Uint8Array(w * h), stack = [sy * w + sx];
  seen[sy * w + sx] = 1;
  while (stack.length) {
    const idx = stack.pop()!;
    if (!eligible(idx * 4)) continue;
    filled[idx] = 1;
    const x = idx % w, y = Math.floor(idx / w);
    const neighbors = [x > 0 ? idx - 1 : -1, x + 1 < w ? idx + 1 : -1, y > 0 ? idx - w : -1, y + 1 < h ? idx + w : -1];
    for (const next of neighbors) if (next >= 0 && !seen[next]) { seen[next] = 1; stack.push(next); }
  }
  const runs: string[] = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      while (x < w && !filled[y * w + x]) x++;
      if (x >= w) break;
      const left = x;
      while (x < w && filled[y * w + x]) x++;
      const runWidth = x - left;
      runs.push(`M${left * scale},${y * scale}h${runWidth * scale}v${scale}h-${runWidth * scale}z`);
    }
  }
  return runs.length ? runs.join("") : null;
}

function buildSvg(strokes: CStroke[]): string {
  const lines = strokes
    .filter((s) => s.points.length > 0 || !!s.fillPath)
    .map((s) => {
      if (s.fillPath) return `<path d="${s.fillPath}" fill="${s.color}" />`;
      const pts = s.points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
      return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-opacity="${s.opacity ?? 1}" stroke-linecap="${s.texture === "highlighter" ? "square" : "round"}" stroke-linejoin="${s.texture === "highlighter" ? "miter" : "round"}" />`;
    })
    .join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}">
  <rect width="${CANVAS_W}" height="${CANVAS_H}" fill="#ffffff" />
  ${lines}
</svg>`;
}

// ── A small sine "brush tone": left/right pans, up/down changes pitch. ────
function freqForY(y: number): number {
  const raw = 220 + (1 - y / CANVAS_H) * 440;
  const penta = [1, 1.125, 1.25, 1.5, 1.667];
  const base = 220;
  const octave = Math.floor(Math.log2(raw / base));
  const normed = raw / base / Math.pow(2, octave);
  const closest = penta.reduce((b, r) => (Math.abs(r - normed) < Math.abs(b - normed) ? r : b));
  return base * closest * Math.pow(2, octave);
}

function useBrushTone(enabled: boolean, volume = 0.7, style: OscillatorType = "sine") {
  const ref = useRef<{
    ctx: AudioContext;
    osc: OscillatorNode;
    gain: GainNode;
    pan: StereoPannerNode;
    timer: ReturnType<typeof setTimeout> | null;
  } | null>(null);

  const play = useCallback(
    (p: Pt, drawing: boolean) => {
      if (!enabled || typeof window === "undefined") return;
      let a = ref.current;
      if (!a) {
        const Ctor: typeof AudioContext =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        const ctx = new Ctor();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const filter = ctx.createBiquadFilter();
        const pan = ctx.createStereoPanner();
        osc.type = style;
        gain.gain.value = 0;
        filter.type = "lowpass";
        filter.frequency.value = 1800;
        osc.connect(gain);
        gain.connect(filter);
        filter.connect(pan);
        pan.connect(ctx.destination);
        osc.start();
        a = ref.current = { ctx, osc, gain, pan, timer: null };
      }
      if (a.ctx.state === "suspended") void a.ctx.resume();
      const t = a.ctx.currentTime;
      a.osc.type = style;
      a.osc.frequency.setTargetAtTime(freqForY(p.y), t, 0.05);
      a.pan.pan.setTargetAtTime(clamp((p.x / CANVAS_W) * 2 - 1, -1, 1), t, 0.03);
      a.gain.gain.setTargetAtTime((drawing ? 0.14 : 0.06) * volume, t, 0.04);
      if (a.timer) clearTimeout(a.timer);
      const node = a;
      a.timer = setTimeout(() => node.gain.gain.setTargetAtTime(0, node.ctx.currentTime, 0.2), 220);
    },
    [enabled, volume, style],
  );

  const silence = useCallback(() => {
    const a = ref.current;
    if (a) a.gain.gain.setTargetAtTime(0, a.ctx.currentTime, 0.1);
  }, []);

  useEffect(
    () => () => {
      const a = ref.current;
      if (a) {
        if (a.timer) clearTimeout(a.timer);
        void a.ctx.close();
        ref.current = null;
      }
    },
    [],
  );

  return { play, silence };
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function setUrlCode(code: string | null) {
  try {
    const url = new URL(window.location.href);
    if (code) url.searchParams.set("code", code);
    else url.searchParams.delete("code");
    window.history.replaceState(null, "", url.toString());
  } catch {
    /* non-critical */
  }
}

export function CollabStudio({ initialCode }: { initialCode?: string }) {
  const [req, setReq] = useState<RoomRequest | null>(null);
  const [codeInput, setCodeInput] = useState("");
  const [codeError, setCodeError] = useState("");
  const [announce, setAnnounce] = useState("");

  const room = useCollabRoom(req);

  // Open straight into a room when the page is reached from an invite link.
  const autoJoined = useRef(false);
  useEffect(() => {
    if (autoJoined.current || !initialCode) return;
    autoJoined.current = true;
    const code = normalizeCode(initialCode);
    if (code.length === CODE_LENGTH) setReq({ kind: "private", code });
  }, [initialCode]);

  const say = useCallback((msg: string) => setAnnounce(msg), []);

  const joinPublic = () => {
    setUrlCode(null);
    setReq({ kind: "public" });
  };
  const createPrivate = () => {
    const code = makeRoomCode();
    setUrlCode(code);
    setReq({ kind: "private", code });
  };
  const joinWithCode = (e: React.FormEvent) => {
    e.preventDefault();
    const code = normalizeCode(codeInput);
    if (code.length !== CODE_LENGTH) {
      setCodeError(`Codes are ${CODE_LENGTH} letters and numbers.`);
      return;
    }
    setCodeError("");
    setUrlCode(code);
    setReq({ kind: "private", code });
  };
  const leave = () => {
    setUrlCode(null);
    setReq(null);
    setAnnounce("You left the room.");
  };

  const liveText = room.notice || announce;

  return (
    <div className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6">
      <p aria-live="polite" role="status" className="sr-only">
        {liveText}
      </p>

      {!req && (
        <Lobby
          codeInput={codeInput}
          codeError={codeError}
          onCodeChange={(v) => setCodeInput(normalizeCode(v))}
          onJoinPublic={joinPublic}
          onCreatePrivate={createPrivate}
          onJoinWithCode={joinWithCode}
        />
      )}

      {req && room.status === "connecting" && (
        <StatusCard
          icon={<Loader2 className="h-6 w-6 animate-spin" />}
          title={req.kind === "public" ? "Finding a public room…" : "Joining your room…"}
          body={room.roomLabel || "Connecting"}
        />
      )}

      {req && room.status === "full" && (
        <StatusCard
          icon={<Users className="h-6 w-6" />}
          title="That room is full"
          body={`Private rooms hold up to ${PRIVATE_CAP} people. Ask the host to make space, or start a room of your own.`}
          action={<Button onClick={leave} className="rounded-full">Back to rooms</Button>}
        />
      )}

      {req && room.status === "error" && (
        <StatusCard
          icon={<Globe className="h-6 w-6" />}
          title="Couldn't connect"
          body="Check your connection and try again."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button onClick={room.retry} className="rounded-full">Try again</Button>
              <Button onClick={leave} variant="outline" className="rounded-full">Back</Button>
            </div>
          }
        />
      )}

      {req && room.status === "ready" && <Room req={req} room={room} onLeave={leave} say={say} />}
    </div>
  );
}

// ───────────────────────────── Lobby ──────────────────────────────────────

function Lobby(props: {
  codeInput: string;
  codeError: string;
  onCodeChange: (v: string) => void;
  onJoinPublic: () => void;
  onCreatePrivate: () => void;
  onJoinWithCode: (e: React.FormEvent) => void;
}) {
  return (
    <section aria-labelledby="collab-heading">
      <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
        <span aria-hidden className="h-px w-8 bg-primary/60" />
        Draw together
      </div>
      <h1 id="collab-heading" className="mt-4 text-5xl font-black tracking-[-0.04em] text-foreground sm:text-6xl">
        Collab <span className={`${ACCENT} text-[1.12em]`}>Studio.</span>
      </h1>
      <p className="mt-3 max-w-2xl text-base text-muted-foreground sm:text-lg">
        Share one canvas in real time. Everyone's lines appear as they draw, and you can hear your own brush as you go.
      </p>

      <div className="mt-10 grid gap-6 md:grid-cols-2">
        {/* Public */}
        <div className="flex flex-col rounded-3xl bg-card p-7 shadow-sm ring-1 ring-primary/15">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Globe className="h-6 w-6" />
          </span>
          <h2 className="mt-5 text-2xl font-bold text-foreground">Public room</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            Drop into a shared canvas with other creators. You'll be matched into a room with space (up to {PUBLIC_CAP}{" "}
            people) and given a friendly random name. There's no chat, and nobody sees who you are.
          </p>
          <Button onClick={props.onJoinPublic} size="lg" className="mt-6 w-full gap-2 rounded-full shadow-md sm:w-fit">
            Join a public room <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Private */}
        <div className="flex flex-col rounded-3xl bg-card p-7 shadow-sm ring-1 ring-primary/15">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Lock className="h-6 w-6" />
          </span>
          <h2 className="mt-5 text-2xl font-bold text-foreground">Private room</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Make a room with a code and share it with friends. Up to {PRIVATE_CAP} people can join, and only people who
            have the code can get in.
          </p>
          <Button onClick={props.onCreatePrivate} size="lg" className="mt-5 w-full gap-2 rounded-full shadow-md sm:w-fit">
            <KeyRound className="h-4 w-4" /> Create a private room
          </Button>

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or join with a code <span className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={props.onJoinWithCode} className="flex flex-wrap items-start gap-2">
            <div className="min-w-[10rem] flex-1">
              <label htmlFor="room-code" className="sr-only">
                Room code
              </label>
              <input
                id="room-code"
                value={props.codeInput}
                onChange={(e) => props.onCodeChange(e.target.value)}
                placeholder="ABC123"
                inputMode="text"
                autoComplete="off"
                autoCapitalize="characters"
                spellCheck={false}
                maxLength={CODE_LENGTH + 2}
                aria-invalid={!!props.codeError}
                aria-describedby={props.codeError ? "room-code-error" : undefined}
                className="h-11 w-full rounded-xl border border-border bg-background px-4 font-mono text-base uppercase tracking-[0.3em] text-foreground outline-none ring-primary/30 placeholder:tracking-[0.3em] placeholder:text-muted-foreground/50 focus:ring-2"
              />
              {props.codeError && (
                <p id="room-code-error" className="mt-1.5 text-xs text-destructive">
                  {props.codeError}
                </p>
              )}
            </div>
            <Button type="submit" variant="outline" className="h-11 rounded-full px-5">
              Join
            </Button>
          </form>
        </div>
      </div>

      <p className="mt-6 max-w-2xl text-xs leading-relaxed text-muted-foreground">
        Public rooms are open to anyone, so keep it kind. Anything you send to the gallery from a room still goes through
        review before it's shown.
      </p>
    </section>
  );
}

function StatusCard(props: { icon: React.ReactNode; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="mx-auto mt-16 max-w-md rounded-3xl bg-card p-10 text-center shadow-sm ring-1 ring-primary/15">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
        {props.icon}
      </span>
      <h2 className="mt-5 text-xl font-semibold text-foreground">{props.title}</h2>
      <p className="mt-2 text-sm text-muted-foreground">{props.body}</p>
      {props.action && <div className="mt-6">{props.action}</div>}
    </div>
  );
}

// ───────────────────────────── Room ───────────────────────────────────────

type RoomApi = ReturnType<typeof useCollabRoom>;

function Room({
  req,
  room,
  onLeave,
  say,
}: {
  req: RoomRequest;
  room: RoomApi;
  onLeave: () => void;
  say: (m: string) => void;
}) {
  const { me, peers, strokes, cursors } = room;
  const isPrivate = req.kind === "private";
  const cap = isPrivate ? PRIVATE_CAP : PUBLIC_CAP;

  const [color, setColor] = useState(SWATCHES[1].value);
  const [width, setWidth] = useState(6);
  const [opacity, setOpacity] = useState(1);
  const [texture, setTexture] = useState<(typeof TEXTURES)[number]>("pen");
  const [tool, setTool] = useState<"draw" | "eraser" | "blend" | "fill">("draw");
  const [eraserSize, setEraserSize] = useState(28);
  const [blendSize, setBlendSize] = useState(36);
  const [visualAids, setVisualAids] = useState(true);
  const [guidesOpen, setGuidesOpen] = useState(false);
  const [activeGuide, setActiveGuide] = useState<string | null>(null);
  const [shortcutOpen, setShortcutOpen] = useState(false);
  const [lineCount, setLineCount] = useState(0);
  const lineCountRef = useRef(0);
  const pointerMovedRef = useRef(false);
  const pointerStartRef = useRef<Pt>({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
  const [soundOn, setSoundOn] = useState(true);
  const [soundStyle, setSoundStyle] = useState<OscillatorType>("sine");
  const [soundVolume, setSoundVolume] = useState(0.7);
  const [voiceOn, setVoiceOn] = useState(false);
  const [voicePersona, setVoicePersona] = useState<"bear" | "guide">("bear");
  const [pos, setPos] = useState<Pt>({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
  const [penDown, setPenDown] = useState(false);
  const [copied, setCopied] = useState<"" | "code" | "link">("");
  const [sharing, setSharing] = useState(false);
  const [shareConfirmOpen, setShareConfirmOpen] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const posRef = useRef(pos);
  const penDownRef = useRef(false);
  const pointerDrawingRef = useRef(false);
  const colorRef = useRef(color);
  const widthRef = useRef(width);
  const opacityRef = useRef(opacity);
  const textureRef = useRef(texture);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { widthRef.current = width; }, [width]);
  useEffect(() => { opacityRef.current = opacity; }, [opacity]);
  useEffect(() => { textureRef.current = texture; }, [texture]);

  const tone = useBrushTone(soundOn, soundVolume, soundStyle);
  const narrate = useCallback((message: string) => {
    say(message);
    if (voiceOn && typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(message);
      utterance.pitch = voicePersona === "bear" ? 1.35 : 1;
      utterance.rate = voicePersona === "bear" ? 1.02 : 0.94;
      window.speechSynthesis.speak(utterance);
    }
  }, [say, voiceOn, voicePersona]);

  const explainStudio = useCallback(() => {
    narrate([
      "Here's a tour of Collab Studio.",
      "The shared canvas is in the middle. Draw with a mouse, finger, or pen, or focus the canvas and use the arrow keys with Space or Enter to draw by keyboard.",
      "The left panel contains Draw, Eraser, Blend, and Fill tools. You can adjust brush size and opacity, choose pen, pencil, highlighter, or paintbrush, and select from the color palette including black and white.",
      "The right panel controls sound, volume, guide voice, visual aids, and inspiration shapes. Left and right movement pans the sound; vertical movement changes its pitch.",
      "Below the canvas you can export SVG, swell-paper SVG, colour SVG, or an STL for 3D printing, and submit the shared artwork to the gallery for review. Room controls let you copy an invite, undo your last line, clear your own lines, or leave the room.",
      "Press H to hear this tour again. Q and E cycle colors, T cycles brush textures, comma and period change opacity, and V, R, B, and F select drawing tools."
    ].join(" "));
  }, [narrate]);

  const setPosition = useCallback((p: Pt) => {
    posRef.current = p;
    setPos(p);
  }, []);

  const toPt = (e: { clientX: number; clientY: number }): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - r.left) * CANVAS_W) / r.width, 0, CANVAS_W),
      y: clamp(((e.clientY - r.top) * CANVAS_H) / r.height, 0, CANVAS_H),
    };
  };

  // Pointer (mouse / touch / pen) drawing
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPt(e);
    setPosition(p);
    pointerMovedRef.current = false;
    pointerStartRef.current = p;
    if (tool === "fill") {
      const path = makeBucketFillPath(room.strokes, CANVAS_W, CANVAS_H, p);
      if (path) room.addFill(colorRef.current, path);
      else narrate("That spot is not enclosed yet. Try filling inside a closed shape.");
      return;
    }
    if (tool === "eraser") { pointerDrawingRef.current = true; room.eraseAt(p, eraserSize / 2); return; }
    pointerDrawingRef.current = true;
    room.begin(colorRef.current, tool === "blend" ? blendSize : widthRef.current, p, {
      opacity: tool === "blend" ? 0.42 : opacityRef.current,
      texture: tool === "blend" ? "paintbrush" : textureRef.current,
      mode: tool === "blend" ? "blend" : "draw",
    });
    tone.play(p, true);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toPt(e);
    setPosition(p);
    if (pointerDrawingRef.current) {
      if (Math.hypot(p.x - pointerStartRef.current.x, p.y - pointerStartRef.current.y) > 1) pointerMovedRef.current = true;
      if (tool === "eraser") room.eraseAt(p, eraserSize / 2);
      else room.extend(p);
      tone.play(p, true);
    } else {
      room.moveCursor(p);
    }
  };
  const endPointer = () => {
    if (!pointerDrawingRef.current) return;
    pointerDrawingRef.current = false;
    room.end();
    tone.silence();
    if (tool !== "eraser" && pointerMovedRef.current) {
      lineCountRef.current += 1;
      const next = lineCountRef.current;
      setLineCount(next);
      if (next % 10 === 0) narrate(`Great line! That's ${next} lines from you. Keep going!`);
    }
    pointerMovedRef.current = false;
  };

  // Keyboard drawing: arrows move, Space lowers/lifts the pen.
  const togglePen = useCallback(() => {
    if (penDownRef.current) {
      penDownRef.current = false;
      setPenDown(false);
      room.end();
      tone.silence();
      narrate("Pen up.");
    } else {
      penDownRef.current = true;
      setPenDown(true);
      room.begin(colorRef.current, widthRef.current, posRef.current, { opacity: opacityRef.current, texture: textureRef.current, mode: "draw" });
      tone.play(posRef.current, true);
      narrate("Pen down. Use the arrow keys to draw.");
    }
  }, [room, narrate, tone]);

  const doUndo = useCallback(() => {
    narrate(room.undoMine() ? "Undid your last line." : "You have nothing to undo.");
  }, [room, narrate]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
      e.preventDefault();
      doUndo();
      return;
    }
    const step = e.shiftKey ? KEY_STEP_BIG : KEY_STEP;
    let dx = 0;
    let dy = 0;
    switch (e.key) {
      case "ArrowLeft": dx = -step; break;
      case "ArrowRight": dx = step; break;
      case "ArrowUp": dy = -step; break;
      case "ArrowDown": dy = step; break;
      case " ":
      case "Enter":
      case "d":
      case "D":
        e.preventDefault();
        togglePen();
        return;
      case "m":
      case "M":
      case "s":
      case "S":
        setSoundOn((v) => !v);
        return;
      case "v": case "V": setTool("draw"); return;
      case "q": case "Q": setColor((v) => SWATCHES[(SWATCHES.findIndex((s) => s.value === v) - 1 + SWATCHES.length) % SWATCHES.length].value); return;
      case "e": case "E": setColor((v) => SWATCHES[(SWATCHES.findIndex((s) => s.value === v) + 1) % SWATCHES.length].value); return;
      case "t": case "T": setTexture((v) => TEXTURES[(TEXTURES.indexOf(v) + 1) % TEXTURES.length]); return;
      case ",": setOpacity((v) => Math.max(0.1, +(v - 0.1).toFixed(2))); return;
      case ".": setOpacity((v) => Math.min(1, +(v + 0.1).toFixed(2))); return;
      case "h": case "H": e.preventDefault(); explainStudio(); return;
      case "c": case "C": room.clearMine(); narrate("Cleared your lines."); return;
      case "Escape": setActiveGuide(null); return;
      case "r": case "R": setTool("eraser"); return;
      case "b": case "B": setTool("blend"); return;
      case "f": case "F": setTool("fill"); return;
      case "x": case "X": setVisualAids((v) => !v); return;
      case "g": case "G": setGuidesOpen((v) => !v); return;
      case "[": setWidth((v) => Math.max(1, v - 1)); return;
      case "]": setWidth((v) => Math.min(40, v + 1)); return;
      default:
        return;
    }
    e.preventDefault();
    const p = {
      x: clamp(posRef.current.x + dx, 0, CANVAS_W),
      y: clamp(posRef.current.y + dy, 0, CANVAS_H),
    };
    setPosition(p);
    if (penDownRef.current) room.extend(p);
    else room.moveCursor(p);
    tone.play(p, penDownRef.current);
  };

  // If the keyboard pen is down when the person leaves the canvas, lift it.
  const onBlur = () => {
    if (penDownRef.current) {
      penDownRef.current = false;
      setPenDown(false);
      room.end();
      tone.silence();
    }
  };

  const code = req.kind === "private" ? req.code : "";
  const inviteLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("code", code);
    return url.toString();
  };
  const copy = async (what: "code" | "link") => {
    const ok = await copyText(what === "code" ? code : inviteLink());
    setCopied(ok ? what : "");
    narrate(ok ? (what === "code" ? "Room code copied." : "Invite link copied.") : "Couldn't copy. Select the code and copy it by hand.");
    if (ok) setTimeout(() => setCopied(""), 2000);
  };

  const downloadSvgVariant = (swell: boolean) => {
    if (!strokes.length) return narrate("There's nothing drawn yet to save.");
    const bg = swell ? "#ffffff" : "#fff5f8";
    const paths = strokes.map((s) => s.fillPath
      ? `<path d="${s.fillPath}" fill="${swell ? "#000000" : s.color}"/>`
      : `<polyline points="${s.points.map((p) => `${p.x},${p.y}`).join(" ")}" fill="none" stroke="${swell ? "#000000" : s.color}" stroke-width="${s.width}" stroke-opacity="${swell ? 1 : s.opacity ?? 1}" stroke-linecap="${s.texture === "highlighter" ? "square" : "round"}" stroke-linejoin="round"/>`).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${CANVAS_W}" height="${CANVAS_H}" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}"><rect width="100%" height="100%" fill="${bg}"/>${paths}</svg>`;
    const a = document.createElement("a"); const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
    a.href = url; a.download = swell ? "sonic-bear-swell.svg" : "sonic-bear-color.svg"; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    narrate(swell ? "Your swell paper SVG is downloading." : "Your color SVG is downloading.");
  };

  const downloadStl = () => {
    const facets: string[] = [];
    const height = 3, half = 1.5, scale = 150 / CANVAS_W;
    const tri = (a: number[], b: number[], c: number[]) => `facet normal 0 0 0\nouter loop\nvertex ${a.join(" ")}\nvertex ${b.join(" ")}\nvertex ${c.join(" ")}\nendloop\nendfacet`;
    for (const s of strokes) for (let i = 1; i < s.points.length; i++) {
      const a = s.points[i - 1], b = s.points[i]; const dx = b.x - a.x, dy = b.y - a.y; const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len * half, ny = dx / len * half;
      const p1=[a.x*scale+nx,(CANVAS_H-a.y)*scale+ny,0], p2=[a.x*scale-nx,(CANVAS_H-a.y)*scale-ny,0], p3=[b.x*scale+nx,(CANVAS_H-b.y)*scale+ny,0], p4=[b.x*scale-nx,(CANVAS_H-b.y)*scale-ny,0];
      const A=[p1[0],p1[1],height], B=[p2[0],p2[1],height], C=[p3[0],p3[1],height], D=[p4[0],p4[1],height];
      facets.push(tri(A,C,D),tri(A,D,B),tri(p1,p4,p3),tri(p1,p2,p4));
    }
    const a = document.createElement("a"); const url = URL.createObjectURL(new Blob([`solid perceive\n${facets.join("\n")}\nendsolid perceive`], { type: "model/stl" }));
    a.href = url; a.download = "sonic-bear.stl"; document.body.appendChild(a); a.click(); a.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); narrate("Your 3D print STL is downloading.");
  };

  const download = () => {
    if (!strokes.length) return narrate("There's nothing drawn yet to save.");
    const blob = new Blob([buildSvg(strokes)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "perceive-collab-drawing.svg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    narrate("Saved your drawing as an SVG.");
  };

  const requestShare = () => {
    if (!strokes.length) return narrate("There's nothing drawn yet to share.");
    setShareConfirmOpen(true);
  };

  const share = async () => {
    if (!strokes.length) return narrate("There's nothing drawn yet to share.");
    setShareConfirmOpen(false);
    setSharing(true);
    try {
      await saveArtwork(buildSvg(strokes));
      narrate("Sent to the gallery for review.");
    } catch {
      narrate("Something went wrong sending that to the gallery.");
    } finally {
      setSharing(false);
    }
  };

  const clearAll = () => {
    if (window.confirm("Clear the whole canvas for everyone in this room?")) {
      room.clearAll();
      narrate("Cleared the canvas for everyone.");
    }
  };

  const peerByKey = new Map(peers.map((p) => [p.key, p]));

  return (
    <section aria-label="Collaborative canvas" className="relative isolate">
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-secondary/20 blur-3xl" />
      </div>
      {/* Room header */}
      <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
            <span aria-hidden className="h-px w-8 bg-primary/60" />
            {isPrivate ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
            {isPrivate ? "Private room" : "Public room"}
          </div>
          <h1 className="mt-4 text-5xl font-black tracking-[-0.04em] text-foreground sm:text-7xl">
            {isPrivate ? (
              <>
                Room <span className="font-mono tracking-[0.18em]">{code}</span>
              </>
            ) : (
              <>
                {room.roomLabel.replace("Public r", "R")}
                <span className={`${ACCENT} ml-2 text-[1.1em]`}>together.</span>
              </>
            )}
          </h1>
        </div>
      </div>



      <div className="overflow-hidden rounded-[2rem] bg-card/70 shadow-2xl shadow-primary/15 ring-1 ring-white/60 backdrop-blur-xl">
        <div className="grid xl:grid-cols-[264px_minmax(0,1fr)_316px] xl:grid-rows-[auto_1fr]">
          {/* LEFT: participants, tools, and color — mirrors the regular Studio's left rail */}
          <aside
            aria-label="Room members and drawing tools"
            className="order-2 divide-y divide-border/70 border-t border-border/70 xl:col-start-1 xl:row-span-2 xl:row-start-1 xl:border-r xl:border-t-0"
          >
            <section aria-labelledby="people-heading" className="p-5">
              <h2 id="people-heading" className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-primary">
                <Users className="h-4 w-4" /> In this room
                <span className="ml-auto rounded-full bg-background/60 px-2.5 py-0.5 text-xs font-normal tracking-normal text-muted-foreground">{peers.length}/{cap}</span>
              </h2>
              <ul className="mt-4 space-y-2.5">
                {peers.map((p) => (
                  <li key={p.key} className="flex items-center gap-2.5 text-sm text-foreground">
                    <span aria-hidden className="h-3 w-3 shrink-0 rounded-full ring-1 ring-black/10" style={{ background: p.color }} />
                    <span className="truncate">{p.name}</span>
                    {p.key === me.key && <span className="text-xs text-muted-foreground">(you)</span>}
                  </li>
                ))}
              </ul>
            </section>

            <section aria-labelledby="tools-heading" className="p-5">
              <h2 id="tools-heading" className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">01 / Tools</h2>
              <div className="mt-4 space-y-2">
                <Button onClick={() => setTool("draw")} aria-pressed={tool === "draw"} variant={tool === "draw" ? "default" : "outline"} className="h-11 w-full justify-start gap-2 rounded-xl"><Pencil className="h-4 w-4" /> Draw <span className="ml-auto text-xs opacity-60">V</span></Button>
                <Button onClick={() => setTool("eraser")} aria-pressed={tool === "eraser"} variant={tool === "eraser" ? "default" : "outline"} className="h-11 w-full justify-start gap-2 rounded-xl"><Eraser className="h-4 w-4" /> Eraser <span className="ml-auto text-xs opacity-60">R</span></Button>
                <Button onClick={() => setTool("blend")} aria-pressed={tool === "blend"} variant={tool === "blend" ? "default" : "outline"} className="h-11 w-full justify-start gap-2 rounded-xl"><Waves className="h-4 w-4" /> Blend <span className="ml-auto text-xs opacity-60">B</span></Button>
                <Button onClick={() => setTool("fill")} aria-pressed={tool === "fill"} variant={tool === "fill" ? "default" : "outline"} className="h-11 w-full justify-start gap-2 rounded-xl"><PaintBucket className="h-4 w-4" /> Fill <span className="ml-auto text-xs opacity-60">F</span></Button>
                <Button onClick={doUndo} variant="outline" className="h-11 w-full justify-start gap-2 rounded-xl">
                  <Undo2 className="h-4 w-4" /> Undo last line
                </Button>
                <Button onClick={() => { room.clearMine(); narrate("Cleared your lines."); }} variant="outline" className="h-11 w-full justify-start gap-2 rounded-xl">
                  <Eraser className="h-4 w-4" /> Clear my lines
                </Button>
                {isPrivate && (
                  <Button onClick={clearAll} variant="outline" className="h-11 w-full justify-start gap-2 rounded-xl">
                    <Trash2 className="h-4 w-4" /> Clear everyone's
                  </Button>
                )}
              </div>
              {(tool === "eraser" || tool === "blend") && <label className="mt-4 block text-sm font-medium text-muted-foreground">{tool === "eraser" ? "Eraser" : "Blend"} size <span className="text-foreground">{tool === "eraser" ? eraserSize : blendSize}px</span><input aria-label={`${tool} size`} type="range" min="4" max="100" value={tool === "eraser" ? eraserSize : blendSize} onChange={(e) => tool === "eraser" ? setEraserSize(Number(e.target.value)) : setBlendSize(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" /></label>}
              <label htmlFor="collab-width" className="mt-5 flex items-center justify-between gap-2 text-sm font-medium text-muted-foreground">Brush size <span className="text-foreground">{width}px</span></label>
              <input id="collab-width" type="range" min={1} max={40} value={width} onChange={(e) => setWidth(Number(e.target.value))} className="mt-3 w-full accent-[var(--primary)]" />
              <label className="mt-4 block text-sm font-medium text-muted-foreground">Opacity <span className="text-foreground">{Math.round(opacity * 100)}%</span><input type="range" min="0.1" max="1" step="0.1" value={opacity} onChange={(e) => setOpacity(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" /></label>
              <div className="mt-4 grid grid-cols-2 gap-2">{TEXTURES.map((t) => <button key={t} onClick={() => setTexture(t)} aria-pressed={texture === t} className={`rounded-xl px-2 py-2 text-sm font-medium ring-1 ${texture === t ? "bg-primary/15 ring-primary/50" : "ring-border/70 hover:bg-primary/10"}`}><Paintbrush className="mr-1 inline h-3.5 w-3.5" />{TEXTURE_LABELS[t]}</button>)}</div>
              <div className="mt-4 border-t border-border/70 pt-4"><button type="button" onClick={() => setShortcutOpen((v) => !v)} aria-expanded={shortcutOpen} className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary"><Keyboard className="h-4 w-4" /> {shortcutOpen ? "Hide shortcuts" : "Show shortcuts"}<ChevronRight className={`h-4 w-4 transition-transform ${shortcutOpen ? "rotate-90" : ""}`} /></button>{shortcutOpen && <ul className="mt-3 space-y-1 text-xs text-muted-foreground"><li>Arrows: move cursor (Shift = bigger steps)</li><li>Space / Enter: pen down/up</li><li>V / R / B / F: draw, erase, blend, fill</li><li>Q / E: cycle color · T: cycle brush texture</li><li>[ / ]: brush size · , / .: opacity</li><li>M / S: toggle sound · Ctrl+Z: undo</li><li>G: shapes · X: visual aids · H: explain studio · Esc: stop guide</li></ul>}</div>
            </section>

            <section aria-labelledby="colors-heading" className="p-5">
              <h2 id="colors-heading" className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">02 / Color</h2>
              <div className="mt-4 grid grid-cols-6 gap-2.5" role="group" aria-label="Brush color">
                {SWATCHES.map((s) => (
                  <button key={s.value} type="button" onClick={() => setColor(s.value)} aria-label={s.name} aria-pressed={color === s.value}
                    className={`aspect-square w-full max-w-10 justify-self-center rounded-full shadow-sm ring-2 ring-offset-2 ring-offset-card transition-all hover:scale-110 ${color === s.value ? "scale-105 ring-foreground" : "ring-border/60"}`}
                    style={{ background: s.value }} />
                ))}
              </div>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{SWATCHES.find((s) => s.value === color)?.name ?? "Selected color"}</p>
            </section>
          </aside>

          {/* CENTER: canvas first, with save/share grouped directly below like regular Studio */}
          <section aria-label="Canvas" className="order-1 min-w-0 p-5 pb-3 xl:col-start-2 xl:row-start-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3 text-[11px] font-bold uppercase tracking-[0.18em]">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[oklch(0.58_0.13_150)]" />
                <span className="truncate text-foreground">Shared canvas</span>
                <span className="hidden font-medium normal-case tracking-normal text-muted-foreground sm:inline">{CANVAS_W} × {CANVAS_H}</span>
              </div>
              <div className="flex flex-wrap gap-2"><Button onClick={explainStudio} variant="outline" size="sm" className="gap-2 rounded-full"><Keyboard className="h-4 w-4" /> Explain (H)</Button><Button onClick={() => void copy("link")} variant="outline" size="sm" className="gap-2 rounded-full">
                {copied === "link" ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} Invite
              </Button></div>
            </div>

            <div tabIndex={0} role="group"
              aria-label="Shared canvas. Use the arrow keys to move, Space to put the pen down or lift it, Shift for bigger steps, Control Z to undo, M to toggle sound."
              onKeyDown={onKeyDown} onBlur={onBlur}
              className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-primary/20 via-card/75 to-accent/20 p-1.5 shadow-2xl shadow-primary/20 ring-1 ring-white/50 backdrop-blur-xl outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-2">
              <svg ref={svgRef} viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`} className="w-full touch-none select-none rounded-[1.65rem] border border-white/60 bg-white shadow-inner dark:brightness-[0.92]" style={{ cursor: "crosshair" }}
                onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={endPointer} onPointerCancel={endPointer}
                role="img" aria-label={`Canvas with ${strokes.length} ${strokes.length === 1 ? "line" : "lines"} from ${peers.length} ${peers.length === 1 ? "person" : "people"}.`}>
                <defs><filter id="collab-soften"><feGaussianBlur stdDeviation="1.2" /></filter></defs>
                <rect width={CANVAS_W} height={CANVAS_H} fill="#ffffff" />
                {visualAids && activeGuide && <polyline points={SHAPE_GUIDES[activeGuide].points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#54c9b0" strokeWidth="3" strokeDasharray="9 8" opacity="0.65" pointerEvents="none" />}
                {strokes.map((s) => s.fillPath ? (
                  <path key={s.id} d={s.fillPath} fill={s.color} />
                ) : (
                  <polyline key={s.id} points={s.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={s.color} strokeWidth={s.width} strokeOpacity={s.opacity ?? 1} strokeLinecap={s.texture === "highlighter" ? "square" : "round"} strokeLinejoin={s.texture === "highlighter" ? "miter" : "round"} style={s.mode === "blend" || s.texture === "highlighter" ? { mixBlendMode: "multiply" } : undefined} filter={s.mode === "blend" || s.texture === "paintbrush" ? "url(#collab-soften)" : undefined} />
                ))}
                {Object.entries(cursors).map(([key, c]) => {
                  const peer = peerByKey.get(key);
                  if (!peer || key === me.key) return null;
                  const flip = c.x > CANVAS_W - 130;
                  return <g key={key} transform={`translate(${c.x} ${c.y})`} pointerEvents="none">
                    <circle r={7} fill={peer.color} stroke="#ffffff" strokeWidth={2} />
                    <text x={flip ? -12 : 12} y={-10} textAnchor={flip ? "end" : "start"} fontSize={15} fontWeight={700} fill={peer.color} stroke="#ffffff" strokeWidth={4} paintOrder="stroke">{peer.name}</text>
                  </g>;
                })}
                {visualAids && <circle cx={pos.x} cy={pos.y} r={tool === "eraser" ? eraserSize / 2 : tool === "blend" ? blendSize / 2 : width / 2 + 5} fill={tool === "eraser" ? "#ffffff" : color} fillOpacity={tool === "eraser" ? 0.45 : 0.18} stroke={color} strokeWidth={2} strokeDasharray={tool === "eraser" ? "5 4" : undefined} pointerEvents="none" />}
                <circle cx={pos.x} cy={pos.y} r={penDown ? 6 : 4} fill={color} stroke="#111111" strokeWidth={1.5} pointerEvents="none" />
              </svg>
            </div>
            <p className="mt-2 px-1 text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Your lines this session: {lineCount} · {strokes.length} shared marks total</p>
            <p className="mt-4 px-1 text-sm leading-relaxed text-muted-foreground">
              Draw with a mouse, finger, or pen. Focus the canvas and use the arrow keys with Space to draw by keyboard. Left and right pans the tone; up and down changes its pitch.
            </p>
          </section>

          {/* RIGHT: sound settings, matching the regular Studio's right rail */}
          <aside aria-label="Sound and room options" className="order-3 divide-y divide-border/70 border-t border-border/70 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:border-l xl:border-t-0">
            <section aria-labelledby="sound-heading" className="p-5">
              <h2 id="sound-heading" className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">03 / Sound</h2>
              <h3 className="mt-4 text-2xl font-black leading-tight tracking-tight">Give it a <span className={`${ACCENT} text-[1.15em]`}>voice.</span></h3>
              <p className="mt-1 text-sm text-muted-foreground">Your brush can make music as you move.</p>
              <Button onClick={() => setSoundOn((v) => !v)} aria-pressed={soundOn} variant={soundOn ? "default" : "outline"} className="mt-4 h-12 w-full justify-start gap-3 rounded-xl">
                {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                {soundOn ? "Sound on" : "Sound off"}
                <span className="ml-auto text-xs opacity-70">M</span>
              </Button>
              <label className="mt-4 block text-sm font-medium text-muted-foreground">Sound type<select value={soundStyle} onChange={(e) => setSoundStyle(e.target.value as OscillatorType)} className="mt-2 h-10 w-full rounded-xl border border-border bg-background px-3 text-foreground"><option value="sine">Sine</option><option value="triangle">Triangle</option><option value="square">Square</option><option value="sawtooth">Sawtooth</option></select></label>
              <label className="mt-3 block text-sm font-medium text-muted-foreground">Volume <span className="text-foreground">{Math.round(soundVolume * 100)}%</span><input type="range" min="0" max="1" step="0.05" value={soundVolume} onChange={(e) => setSoundVolume(Number(e.target.value))} className="mt-2 w-full accent-[var(--primary)]" /></label>
              <div className="mt-4 border-t border-border/70 pt-4"><h3 className="text-sm font-semibold">Guide voice</h3><div className="mt-2 grid grid-cols-2 gap-2"><button onClick={() => setVoicePersona("bear")} aria-pressed={voicePersona === "bear"} className={`rounded-xl px-2 py-2 text-sm ring-1 ${voicePersona === "bear" ? "bg-primary/15 ring-primary/50" : "ring-border/70"}`}>Friendly bear</button><button onClick={() => setVoicePersona("guide")} aria-pressed={voicePersona === "guide"} className={`rounded-xl px-2 py-2 text-sm ring-1 ${voicePersona === "guide" ? "bg-primary/15 ring-primary/50" : "ring-border/70"}`}>Calm guide</button></div><button onClick={() => setVoiceOn((v) => !v)} aria-pressed={voiceOn} className={`mt-2 w-full rounded-xl px-3 py-2 text-sm ring-1 ${voiceOn ? "bg-primary/15 ring-primary/50" : "ring-border/70"}`}>{voiceOn ? "Narration on" : "Narration off"}</button></div>
              <div className="mt-4 flex items-center justify-between gap-3 text-sm"><span className="flex items-center gap-2"><Eye className="h-4 w-4" /> Visual aids</span><button onClick={() => setVisualAids((v) => !v)} aria-pressed={visualAids} className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${visualAids ? "bg-primary/15 ring-primary/40" : "ring-border"}`}>{visualAids ? "On" : "Off"} · X</button></div>
              <div className="mt-4"><button type="button" onClick={() => setGuidesOpen((v) => !v)} aria-expanded={guidesOpen} className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-primary"><Map className="h-4 w-4" /> {guidesOpen ? "Hide shapes" : "Inspiration shapes"} · G <ChevronRight className={`h-4 w-4 transition-transform ${guidesOpen ? "rotate-90" : ""}`} /></button>{guidesOpen && <div className="mt-3 grid grid-cols-2 gap-2">{Object.entries(SHAPE_GUIDES).map(([key, guide]) => <button key={key} onClick={() => setActiveGuide((v) => v === key ? null : key)} aria-pressed={activeGuide === key} className={`rounded-xl px-3 py-2 text-sm ring-1 ${activeGuide === key ? "bg-primary/15 ring-primary/50" : "ring-border/70"}`}>{guide.name}</button>)}</div>}{activeGuide && <p className="mt-2 text-xs text-muted-foreground">{SHAPE_GUIDES[activeGuide].name} guide active. Select it again to turn it off.</p>}</div>
            </section>
            <section aria-labelledby="room-heading" className="p-5">
              <h2 id="room-heading" className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">04 / Room</h2>
              <h3 className="mt-4 text-xl font-black tracking-tight">Make it <span className={`${ACCENT} text-[1.15em]`}>together.</span></h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Everyone in the room can draw on the same canvas in real time.</p>
              {isPrivate && <div className="mt-4 grid gap-2">
                <Button onClick={() => void copy("code")} variant="outline" className="w-full justify-start gap-2 rounded-xl">
                  {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy room code
                </Button>
                <Button onClick={() => void copy("link")} variant="outline" className="w-full justify-start gap-2 rounded-xl">
                  {copied === "link" ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} Copy invite link
                </Button>
              </div>}
              <Button onClick={onLeave} variant="outline" className="mt-4 w-full justify-start gap-2 rounded-xl">
                <LogOut className="h-4 w-4" /> Leave room
              </Button>
            </section>
          </aside>

          {/* BOTTOM: export/share actions stay together beneath the canvas, as in Studio */}
          <div className="order-4 grid gap-4 border-t border-border/70 p-5 md:grid-cols-2 xl:col-start-2 xl:row-start-2 xl:border-t-0 xl:pt-2">
            <section aria-labelledby="export-heading" className="flex flex-col rounded-2xl p-5 ring-1 ring-border/70">
              <h2 id="export-heading" className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">05 / Export</h2>
              <h3 className="mt-4 text-xl font-black tracking-tight">Keep your <span className={`${ACCENT} text-[1.15em]`}>art.</span></h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Save a copy of the shared canvas to your device.</p>
              <div className="mt-auto grid gap-2 pt-4">
                <Button onClick={download} variant="outline" className="h-11 w-full justify-center gap-2 rounded-xl"><Download className="h-4 w-4" /> Save as SVG</Button>
                <Button onClick={() => downloadSvgVariant(true)} variant="secondary" className="h-11 w-full justify-center gap-2 rounded-xl"><Waves className="h-4 w-4" /> Swell Paper SVG</Button>
                <Button onClick={() => downloadSvgVariant(false)} variant="outline" className="h-11 w-full justify-center gap-2 rounded-xl"><Palette className="h-4 w-4" /> Colour SVG</Button>
                <Button onClick={downloadStl} variant="outline" className="h-11 w-full justify-center gap-2 rounded-xl"><Box className="h-4 w-4" /> 3D Print (STL)</Button>
              </div>
            </section>
            <section aria-labelledby="share-heading" className="flex flex-col rounded-2xl p-5 ring-1 ring-border/70">
              <h2 id="share-heading" className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">06 / Share</h2>
              <h3 className="mt-4 text-xl font-black tracking-tight">Let the world <span className={`${ACCENT} text-[1.15em]`}>see it.</span></h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">Send the shared artwork to the gallery for review. Check with the room first.</p>
              <div className="mt-auto grid gap-2 pt-4">
                <Button onClick={requestShare} disabled={sharing} className="h-11 w-full justify-center gap-2 rounded-xl"><Share2 className="h-4 w-4" /> {sharing ? "Sending…" : "Send to gallery"}</Button>
                <Button asChild variant="outline" className="h-11 w-full rounded-xl"><Link to="/gallery" className="gap-2"><Globe className="h-4 w-4" /> View Gallery</Link></Button>
              </div>
            </section>
          </div>
        </div>
      </div>
      {shareConfirmOpen && (
        <div role="dialog" aria-modal="true" aria-labelledby="collab-share-confirm" className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl bg-card p-6 shadow-xl ring-1 ring-primary/20">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20"><Share2 className="h-6 w-6" /></div>
            <h2 id="collab-share-confirm" className="mt-4 text-lg font-bold text-foreground">Send this shared artwork to the gallery?</h2>
            <p className="mt-2 text-sm text-muted-foreground">The artwork will be submitted for review before it appears publicly. Make sure everyone in the room is happy to share it.</p>
            <div className="mt-5 flex gap-2"><Button onClick={() => setShareConfirmOpen(false)} variant="outline" className="flex-1 rounded-full">Cancel</Button><Button onClick={() => void share()} className="flex-1 gap-2 rounded-full"><Share2 className="h-4 w-4" /> Send for review</Button></div>
          </div>
        </div>
      )}
    </section>
  );
}
