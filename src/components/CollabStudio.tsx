import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { saveArtwork } from "@/lib/gallery-storage";
import bearSleeping from "@/assets/bear_sleeping.png";
import bearDrawing from "@/assets/bear_drawing.png";
import {
  CANVAS_H,
  CANVAS_W,
  CHAT_MAX_CHARS,
  CODE_LENGTH,
  PRIVATE_CAP,
  PUBLIC_CAP,
  REPORT_REASONS,
  makeRoomCode,
  normalizeCode,
  submitReport,
  useCollabRoom,
  type ChatMsg,
  type CStroke,
  type Peer,
  type Pt,
  type ReportReason,
  type RoomRequest,
} from "@/lib/collab";
import {
  COLORS,
  CHECKPOINT_PRAISE,
  BACK_ON_TRACK_LINES,
  DEFAULT_TEXTURE_SETTINGS,
  HEIGHT,
  MAX_PEN_WIDTH,
  MIN_PEN_WIDTH,
  OFF_COURSE_ENTER,
  OFF_COURSE_EXIT,
  OFF_COURSE_INTROS,
  OPACITY_RANGE,
  OPACITY_STEP,
  SHAPE_GUIDES,
  SOUND_STYLE_LABELS,
  SOUND_STYLE_ORDER,
  TEXTURE_LABELS,
  TEXTURE_ORDER,
  TEXTURE_TONES,
  VOICE_PERSONA_LABELS,
  VOICE_PERSONA_ORDER,
  WIDTH,
  describeDirection,
  describeDistance,
  getBrushDabs,
  nearestOnGuide,
  pickVaried,
  playSineNote,
  textureVisualProps,
  useNarrator,
  useStudioAudio,
  type SoundStyle,
  type Stroke,
  type Texture,
} from "@/lib/studio-features";
import {
  ArrowRight,
  Bell,
  Box,
  Check,
  ChevronRight,
  Circle,
  Copy,
  Eraser,
  Eye,
  EyeOff,
  Flag,
  Flower2,
  Globe,
  Hand,
  Heart,
  HelpCircle,
  Highlighter,
  Home,
  Infinity as InfinityIcon,
  Keyboard,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  LogOut,
  Map as MapIcon,
  MessageSquare,
  Mic,
  MicOff,
  Minus,
  Music2,
  Orbit,
  PaintBucket,
  Paintbrush,
  Palette,
  PenLine,
  Pencil,
  Plus,
  Send,
  Share2,
  Sparkles,
  Square,
  Star,
  Trash2,
  TrendingUp,
  Triangle,
  Undo2,
  Users,
  Volume2,
  VolumeX,
  Waves,
  Wind,
  X,
  Zap,
} from "lucide-react";

const ACCENT = "font-['Instrument_Serif',Georgia,serif] font-normal italic tracking-tight";

type ToolId = "draw" | "eraser" | "blend" | "fill";

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));

// Shared control sizes (same scale as the Sketchpad).
const STEP_BTN = "h-11 w-11 shrink-0 rounded-full bg-card/60 ring-1 ring-white/50 backdrop-blur-sm";
const SLIDER_CLASS =
  "h-3 min-w-0 flex-1 cursor-pointer appearance-none rounded-full [&::-webkit-slider-thumb]:h-6 [&::-webkit-slider-thumb]:w-6 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary [&::-webkit-slider-thumb]:shadow-md [&::-webkit-slider-thumb]:ring-2 [&::-webkit-slider-thumb]:ring-card [&::-moz-range-thumb]:h-6 [&::-moz-range-thumb]:w-6 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-primary";
const ACTION_BTN = "h-12 justify-start gap-3 rounded-2xl px-4 text-sm font-medium";

const TEXTURE_ICONS: Record<Texture, typeof PenLine> = {
  pen: PenLine,
  pencil: Pencil,
  highlighter: Highlighter,
  paintbrush: Paintbrush,
};
const SOUND_STYLE_ICONS: Record<SoundStyle, typeof Bell> = {
  sine: Waves,
  pad: Wind,
  chime: Bell,
  marimba: Music2,
};
const GUIDE_ICONS: Record<string, { Icon: typeof Circle; color: string }> = {
  circle:   { Icon: Circle,       color: "#c9a0dc" },
  square:   { Icon: Square,       color: "#5c6b7a" },
  heart:    { Icon: Heart,        color: "#e88aab" },
  star:     { Icon: Star,         color: "#e0b04f" },
  triangle: { Icon: Triangle,     color: "#ff7f6b" },
  wave:     { Icon: Waves,        color: "#4da6ff" },
  spiral:   { Icon: Orbit,        color: "#9b72cf" },
  house:    { Icon: Home,         color: "#48b376" },
  infinity: { Icon: InfinityIcon, color: "#5b5ea6" },
  lightning:{ Icon: Zap,          color: "#f5a623" },
  flower:   { Icon: Flower2,      color: "#f9a8a8" },
  staircase:{ Icon: TrendingUp,   color: "#3fb8af" },
};

function SectionLabel({ id, n, title, Icon }: { id: string; n: string; title: string; Icon: typeof Globe }) {
  return (
    <h2 id={id} className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
      <span><span className="text-primary">{n}</span> / {title}</span>
      <Icon className="h-4 w-4 opacity-70" aria-hidden />
    </h2>
  );
}

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
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8 sm:px-6">
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
        <div className="flex flex-col rounded-3xl bg-card/70 p-7 shadow-xl shadow-primary/10 ring-1 ring-white/60 backdrop-blur-xl">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
            <Globe className="h-6 w-6" />
          </span>
          <h2 className="mt-5 text-2xl font-bold text-foreground">Public room</h2>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
            Drop into a shared canvas with other creators. You'll be matched into a room with space (up to {PUBLIC_CAP}{" "}
            people) and given a friendly random name. Chat is on, links are blocked, and nobody sees who you are.
          </p>
          <Button onClick={props.onJoinPublic} size="lg" className="mt-6 w-full gap-2 rounded-full shadow-md sm:w-fit">
            Join a public room <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Private */}
        <div className="flex flex-col rounded-3xl bg-card/70 p-7 shadow-xl shadow-primary/10 ring-1 ring-white/60 backdrop-blur-xl">
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
    <div className="mx-auto mt-16 max-w-md rounded-3xl bg-card/70 p-10 text-center shadow-xl shadow-primary/10 ring-1 ring-white/60 backdrop-blur-xl">
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
  say: announceText,
}: {
  req: RoomRequest;
  room: RoomApi;
  onLeave: () => void;
  say: (m: string) => void;
}) {
  const { me, peers, cursors } = room;
  const isPrivate = req.kind === "private";
  const cap = isPrivate ? PRIVATE_CAP : PUBLIC_CAP;

  // Narrator: every message is both announced to screen readers (live region)
  // and, when narration is on, spoken aloud by Bennett or the lady guide.
  const narrator = useNarrator(announceText);
  const say = narrator.say;

  const [colorIndex, setColorIndex] = useState(2);
  const color = COLORS[colorIndex].value;
  const [texture, setTexture] = useState<Texture>("pen");
  const [textureSettings, setTextureSettings] = useState(DEFAULT_TEXTURE_SETTINGS);
  const penWidth = textureSettings[texture].width;
  const penOpacity = textureSettings[texture].opacity;
  const [tool, setTool] = useState<ToolId>("draw");
  const [eraserSize, setEraserSize] = useState(28);
  const [blendSize, setBlendSize] = useState(36);
  const [soundOn, setSoundOn] = useState(true);
  const [soundStyle, setSoundStyle] = useState<SoundStyle>("sine");
  const [soundVolume, setSoundVolume] = useState(0.7);
  const [visualAids, setVisualAids] = useState(true);
  const [guideKey, setGuideKey] = useState<string | null>(null);
  const [guidesOpen, setGuidesOpen] = useState(true);
  const [kbdOpen, setKbdOpen] = useState(true);
  const [pos, setPos] = useState<Pt>({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
  const [penDown, setPenDown] = useState(false);
  const [copied, setCopied] = useState<"" | "code" | "link">("");
  const [sharing, setSharing] = useState(false);
  const [justPosted, setJustPosted] = useState(false);
  const [postConfirmOpen, setPostConfirmOpen] = useState(false);
  const [muted, setMuted] = useState<Set<string>>(() => new Set());
  const [reportTarget, setReportTarget] = useState<Peer | null>(null);

  // Muting is local: you stop seeing that person's lines, cursor and chat.
  // Saving and sharing also leave out their lines, so you never send on
  // something you chose not to see.
  const strokes = room.strokes.filter((s) => !muted.has(s.owner));

  const audio = useStudioAudio(soundOn, soundStyle, soundVolume);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const posRef = useRef(pos);
  const penDownRef = useRef(false);
  const pointerDrawingRef = useRef(false);
  const trailRef = useRef<Pt[]>([]);
  const lineCountRef = useRef(0);
  // Guide-voice bookkeeping (same behaviour as the Sketchpad guides).
  const lastCheckpoint = useRef(-1);
  const offCourseRef = useRef(false);
  const lastOffCourseSayAt = useRef(0);
  const lastOffCourseIntro = useRef("");
  const lastBackOnTrackLine = useRef("");
  const lastPraiseLine = useRef("");
  const guideCompletedRef = useRef(false);

  const setPosition = (p: Pt) => {
    posRef.current = p;
    setPos(p);
  };

  const toPt = (e: { clientX: number; clientY: number }): Pt => {
    const r = svgRef.current!.getBoundingClientRect();
    return {
      x: clamp(((e.clientX - r.left) * CANVAS_W) / r.width, 0, CANVAS_W),
      y: clamp(((e.clientY - r.top) * CANVAS_H) / r.height, 0, CANVAS_H),
    };
  };

  // ── Colour / brush settings ─────────────────────────────────────────────
  const pickColor = (i: number) => {
    setColorIndex(i);
    audio.note(COLORS[i].tone, 0.2, 0.11, true);
    say(`Color: ${COLORS[i].name}`);
  };
  const cycleColor = (dir: 1 | -1) => pickColor((colorIndex + dir + COLORS.length) % COLORS.length);

  const changePenWidth = (next: number) => {
    const w = clamp(Math.round(next), MIN_PEN_WIDTH, MAX_PEN_WIDTH);
    if (w === penWidth) return;
    audio.note(300 + (MAX_PEN_WIDTH - w) * 6, 0.12, 0.09);
    say(`${TEXTURE_LABELS[texture]} thickness ${w}`);
    setTextureSettings((prev) => ({ ...prev, [texture]: { ...prev[texture], width: w } }));
  };
  const changePenOpacity = (next: number) => {
    const { min, max } = OPACITY_RANGE[texture];
    const stepped = Math.round(next / OPACITY_STEP) * OPACITY_STEP;
    const o = Math.round(clamp(stepped, min, max) * 100) / 100;
    if (o === penOpacity) return;
    audio.note(500, 0.12, 0.04 + o * 0.08);
    say(`${TEXTURE_LABELS[texture]} opacity ${Math.round(o * 100)} percent`);
    setTextureSettings((prev) => ({ ...prev, [texture]: { ...prev[texture], opacity: o } }));
  };
  const changeTexture = (next: Texture) => {
    if (next === texture) return;
    audio.note(TEXTURE_TONES[next], 0.16, 0.11, true);
    say(`${TEXTURE_LABELS[next]} selected`);
    setTexture(next);
  };
  const cycleTexture = () => changeTexture(TEXTURE_ORDER[(TEXTURE_ORDER.indexOf(texture) + 1) % TEXTURE_ORDER.length]);

  const changeToolSize = (next: number) => {
    const v = clamp(Math.round(next), 4, 100);
    if (tool === "eraser") setEraserSize(v);
    else if (tool === "blend") setBlendSize(v);
    else changePenWidth(v);
  };

  const releasePen = () => {
    if (penDownRef.current) {
      penDownRef.current = false;
      setPenDown(false);
      room.end();
      audio.silence();
    }
  };

  const selectTool = (next: ToolId) => {
    releasePen();
    setTool(next);
    say(
      next === "draw" ? "Drawing tool selected"
      : next === "eraser" ? `Eraser selected, size ${eraserSize}. It only erases your own lines.`
      : next === "blend" ? `Blend tool selected, size ${blendSize}`
      : "Fill tool. Click an enclosed area, or press Space to fill at the pen.",
    );
  };

  // ── Fill / blend / erase ────────────────────────────────────────────────
  const fillAt = (p: Pt) => {
    const path = makeBucketFillPath(strokes, CANVAS_W, CANVAS_H, p);
    if (path && room.addFill(color, path)) {
      audio.note(587, 0.15, 0.1);
      say("Filled.");
    } else say("Nothing to fill there. Click an empty area enclosed by lines.");
  };

  const hexRgb = (hex: string) => {
    const n = parseInt(hex.replace("#", ""), 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
  };
  const rgbHex = (r: number, g: number, b: number) =>
    `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0")).join("")}`;
  const segDist = (p: Pt, a: Pt, b: Pt) => {
    const dx = b.x - a.x, dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) return Math.hypot(p.x - a.x, p.y - a.y);
    const t = clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / len2, 0, 1);
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  };
  const blendColorAt = (p: Pt): string => {
    const radius = blendSize / 2 + 12;
    const found: { r: number; g: number; b: number; weight: number }[] = [];
    for (const s of strokes) {
      if (s.fillPath) continue;
      for (let i = 1; i < s.points.length; i++) {
        const d = segDist(p, s.points[i - 1], s.points[i]);
        if (d <= radius + s.width / 2) {
          found.push({ ...hexRgb(s.color), weight: Math.max(0.1, 1 - d / radius) });
          break;
        }
      }
    }
    if (!found.length) return color;
    const total = found.reduce((sum, c) => sum + c.weight, 0);
    return rgbHex(
      found.reduce((sum, c) => sum + c.r * c.weight, 0) / total,
      found.reduce((sum, c) => sum + c.g * c.weight, 0) / total,
      found.reduce((sum, c) => sum + c.b * c.weight, 0) / total,
    );
  };

  const praiseLine = () => {
    lineCountRef.current += 1;
    if (lineCountRef.current % 10 === 0) say("Great line! Saved it.");
  };

  const strokeStyle = () => ({ texture, opacity: penOpacity });

  // ── Shape guides (traced locally; nobody else sees your guide) ──────────
  const trackGuide = (p: Pt) => {
    if (!guideKey || !soundOn) return;
    const guide = SHAPE_GUIDES[guideKey];
    const { distance, progress, point: nearestPt } = nearestOnGuide(p, guide);
    const now = Date.now();
    if (!offCourseRef.current && distance > OFF_COURSE_ENTER) {
      offCourseRef.current = true;
      lastOffCourseSayAt.current = now;
      const intro = pickVaried(OFF_COURSE_INTROS, lastOffCourseIntro.current);
      lastOffCourseIntro.current = intro;
      say(`${intro} Move ${describeDirection(p, nearestPt)}, ${describeDistance(distance)}, and you'll be right back on the ${guide.name.toLowerCase()} line.`);
      audio.bump();
    } else if (offCourseRef.current && distance < OFF_COURSE_EXIT) {
      offCourseRef.current = false;
      const line = pickVaried(BACK_ON_TRACK_LINES, lastBackOnTrackLine.current);
      lastBackOnTrackLine.current = line;
      say(line);
    } else if (offCourseRef.current && now - lastOffCourseSayAt.current > 4000) {
      lastOffCourseSayAt.current = now;
      say(`I'm still with you — head ${describeDirection(p, nearestPt)}, ${describeDistance(distance)}.`);
    }
    audio.guideProximity(distance);

    const cps = guide.checkpoints;
    for (let i = cps.length - 1; i >= 0; i--) {
      if (progress >= cps[i].at && i > lastCheckpoint.current) {
        lastCheckpoint.current = i;
        if (i > 0 && !offCourseRef.current) {
          const praise = pickVaried(CHECKPOINT_PRAISE, lastPraiseLine.current);
          lastPraiseLine.current = praise;
          say(`${praise} ${cps[i].say}`);
        } else say(cps[i].say);
        audio.note([523, 587, 659, 698, 784][i % 5], 0.2, 0.08);
        break;
      }
    }
    if (!guideCompletedRef.current && progress >= 0.97 && distance < OFF_COURSE_EXIT) {
      guideCompletedRef.current = true;
      say(`You did it! That's a perfect ${guide.name.toLowerCase()}. Press stop guide, or trace it again with me.`);
      audio.complete();
    }
  };

  const startGuide = (key: string) => {
    audio.stopGuideTone();
    setGuideKey(key);
    lastCheckpoint.current = -1;
    offCourseRef.current = false;
    guideCompletedRef.current = false;
    lastOffCourseSayAt.current = 0;
    lastOffCourseIntro.current = "";
    lastBackOnTrackLine.current = "";
    lastPraiseLine.current = "";
    setGuidesOpen(false);
    if (soundOn) {
      audio.startGuideTone();
      audio.guideStart(392);
    }
    const guide = SHAPE_GUIDES[key];
    say(
      `Let's trace a ${guide.name.toLowerCase()} together! ${guide.checkpoints[0].say} ` +
        (soundOn
          ? "Get close to the glowing line and I'll hum louder the closer you get."
          : "Turn sound on and I'll talk you through it as you draw."),
    );
  };
  const stopGuide = () => {
    if (!guideKey) return;
    audio.stopGuideTone();
    offCourseRef.current = false;
    say("Guide stopped — nice tracing!");
    setGuideKey(null);
  };

  // ── Pointer (mouse / touch / pen) ───────────────────────────────────────
  const onPointerDown = (e: React.PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 && e.pointerType === "mouse") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = toPt(e);
    setPosition(p);
    audio.update(p, true);
    if (tool === "fill") {
      fillAt(p);
      return;
    }
    pointerDrawingRef.current = true;
    if (tool === "eraser") room.eraseOwn(p, eraserSize / 2);
    else if (tool === "blend") room.begin(blendColorAt(p), blendSize, p, { texture: "paintbrush", opacity: 0.42, mode: "blend" });
    else room.begin(color, penWidth, p, strokeStyle());
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toPt(e);
    setPosition(p);
    audio.update(p, pointerDrawingRef.current);
    trackGuide(p);
    if (pointerDrawingRef.current) {
      if (tool === "eraser") room.eraseOwn(p, eraserSize / 2);
      else room.extend(p);
    } else room.moveCursor(p);
  };
  const endPointer = () => {
    if (!pointerDrawingRef.current) return;
    pointerDrawingRef.current = false;
    audio.silence();
    if (tool === "eraser") {
      say("Erased that part of your lines.");
      return;
    }
    room.end();
    if (tool === "blend") say("Colors blended together.");
    else praiseLine();
  };

  // ── Keyboard drawing: arrows move, Space lowers/lifts the pen ───────────
  const togglePen = () => {
    if (tool === "fill") return fillAt(posRef.current);
    if (tool === "blend") return say("Blend works with a mouse, finger or pen. Switch to Draw or Eraser for keyboard use.");
    if (penDownRef.current) {
      releasePen();
      audio.note(392, 0.18, 0.1);
      say(tool === "eraser" ? "Eraser up." : "Pen up.");
    } else {
      penDownRef.current = true;
      setPenDown(true);
      audio.note(659, 0.15, 0.12);
      if (tool === "eraser") {
        room.eraseOwn(posRef.current, eraserSize / 2);
        say("Eraser down. Move with the arrow keys to erase your lines.");
      } else {
        room.begin(color, penWidth, posRef.current, strokeStyle());
        say("Drawing on. Use the arrow keys to draw.");
      }
      audio.update(posRef.current, true);
    }
  };

  const moveTo = (next: Pt) => {
    const p = { x: clamp(next.x, 0, CANVAS_W), y: clamp(next.y, 0, CANVAS_H) };
    const hitBorder = p.x !== next.x || p.y !== next.y;
    setPosition(p);
    audio.update(p, penDownRef.current);
    trackGuide(p);
    if (hitBorder) {
      audio.bump();
      say("Whoa, that's the edge!");
    }
    if (penDownRef.current) {
      if (tool === "eraser") room.eraseOwn(p, eraserSize / 2);
      else room.extend(p);
    } else room.moveCursor(p);
  };

  const doUndo = () => {
    audio.note(330, 0.18, 0.09);
    say(room.undoMine() ? "Oops, undone! Let's try that again." : "You have nothing to undo.");
  };
  const clearMine = () => {
    room.clearMine();
    audio.note(262, 0.2, 0.08);
    say("Cleared your lines.");
  };
  const clearEveryone = () => {
    if (window.confirm("Clear the whole canvas for everyone in this room?")) {
      room.clearAll();
      say("Cleared the canvas for everyone.");
    }
  };

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    if (next) {
      const a = audio.ensure();
      playSineNote(a.ctx, 440, 0.2, 0.1, true);
      say("Sound on! Move around and I'll turn it into music.");
    } else {
      audio.silence();
      audio.stopGuideTone();
      say("Sound's off.");
    }
  };
  const toggleVisualAids = () => {
    const next = !visualAids;
    setVisualAids(next);
    say(next ? "Visual aids are on! I've got you." : "Visual aids off — I'll guide you by sound.");
  };

  const explainStudio = () => {
    narrator.sayForced(
      [
        "Here's a tour of the collab studio.",
        "In the middle is the shared canvas. Everyone in the room draws on it at once. Drag anywhere to draw, or use the arrow keys to move your brush and Space or D to start and stop drawing.",
        "On the left: People lists who is here, and you can mute or report anyone. Tools has Draw, Eraser, Blend and Fill. Your eraser and blend only change your own lines. Color has eighteen swatches, and Q or E cycles through them. Brush lets you pick pen, pencil, highlighter or paintbrush, with its own size and opacity.",
        "On the right: Chat talks to the room. Sound plays music as you move, where left and right pans it and up and down changes the pitch. Guide voice switches the narrator between Bennett the bear and a lady voice. Inspiration has shape guides that talk you through drawing a circle, heart, star and more. Guides are just for you, nobody else sees them.",
        "Below the canvas: Keep saves your drawing as swell paper, a colour SVG, or a 3D printable file. Share sends the whole shared canvas to the gallery for review.",
        "Press H any time to hear this again.",
      ].join(" "),
    );
  };

  // ── Window shortcuts (ignored while typing in chat or a dialog) ─────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (postConfirmOpen) {
        if (e.key === "Escape") { e.preventDefault(); cancelPost(); }
        else if (e.key === "Enter") { e.preventDefault(); void confirmPost(); }
        return;
      }
      if (reportTarget) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.isContentEditable)) return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); doUndo(); return; }
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const step = e.shiftKey ? 30 : 10;
      const k = e.key.toLowerCase();
      const pos0 = posRef.current;
      if (e.key === "ArrowLeft") { e.preventDefault(); moveTo({ x: pos0.x - step, y: pos0.y }); }
      else if (e.key === "ArrowRight") { e.preventDefault(); moveTo({ x: pos0.x + step, y: pos0.y }); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveTo({ x: pos0.x, y: pos0.y - step }); }
      else if (e.key === "ArrowDown") { e.preventDefault(); moveTo({ x: pos0.x, y: pos0.y + step }); }
      else if (e.key === " " || k === "d") { e.preventDefault(); togglePen(); }
      else if (k === "s" || k === "m") { e.preventDefault(); toggleSound(); }
      else if (k === "c") { e.preventDefault(); clearMine(); }
      else if (k === "x") { e.preventDefault(); toggleVisualAids(); }
      else if (k === "h") { e.preventDefault(); explainStudio(); }
      else if (k === "g") {
        e.preventDefault();
        const next = !guidesOpen;
        setGuidesOpen(next);
        say(next ? "Here are the audio guides — pick one and I'll walk you through it." : "Closing the guides panel.");
      }
      else if (k === "q") { e.preventDefault(); cycleColor(-1); }
      else if (k === "e") { e.preventDefault(); cycleColor(1); }
      else if (e.key === "[") { e.preventDefault(); changePenWidth(penWidth - 1); }
      else if (e.key === "]") { e.preventDefault(); changePenWidth(penWidth + 1); }
      else if (e.key === ",") { e.preventDefault(); changePenOpacity(penOpacity - OPACITY_STEP); }
      else if (e.key === ".") { e.preventDefault(); changePenOpacity(penOpacity + OPACITY_STEP); }
      else if (k === "t") { e.preventDefault(); cycleTexture(); }
      else if (k === "r") { e.preventDefault(); selectTool("eraser"); }
      else if (k === "b") { e.preventDefault(); selectTool("blend"); }
      else if (k === "v") { e.preventDefault(); selectTool("draw"); }
      else if (k === "f") { e.preventDefault(); selectTool("fill"); }
      else if (k === "escape" && guideKey) { e.preventDefault(); stopGuide(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // If the page loses focus mid-line, lift the pen so no line gets stuck.
  useEffect(() => {
    const lift = () => releasePen();
    window.addEventListener("blur", lift);
    return () => window.removeEventListener("blur", lift);
  });

  // ── Invite / copy ───────────────────────────────────────────────────────
  const code = req.kind === "private" ? req.code : "";
  const inviteLink = () => {
    const url = new URL(window.location.href);
    url.searchParams.set("code", code);
    return url.toString();
  };
  const copy = async (what: "code" | "link") => {
    const ok = await copyText(what === "code" ? code : inviteLink());
    setCopied(ok ? what : "");
    announceText(ok ? (what === "code" ? "Room code copied." : "Invite link copied.") : "Couldn't copy. Select the code and copy it by hand.");
    if (ok) setTimeout(() => setCopied(""), 2000);
  };

  // ── Export ──────────────────────────────────────────────────────────────
  const toStroke = (s: CStroke): Stroke => ({
    color: s.color,
    width: s.width,
    opacity: s.opacity ?? 1,
    texture: s.texture ?? "pen",
    points: s.points,
    mode: s.mode,
  });

  const buildSvgString = (highContrast: boolean) => {
    const bg = highContrast ? "#ffffff" : "#fff5f8";
    const defsExtra = highContrast
      ? ""
      : `<defs><filter id="pencilTexture" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves="3" seed="7" result="grain"/><feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.33 0.33 0.33 0 0" result="grainAlpha"/><feComponentTransfer in="grainAlpha" result="grainMask"><feFuncA type="discrete" tableValues="0 0 0.15 0.35 0.55 0.7 0.82 0.92 1 1"/></feComponentTransfer><feComposite in="SourceGraphic" in2="grainMask" operator="in" result="speckled"/><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="edgeNoise"/><feDisplacementMap in="speckled" in2="edgeNoise" scale="1.5" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="brushSoften" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="0.6"/></filter><filter id="blendSoften" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="5"/></filter></defs>`;
    const paths = strokes
      .map((cs) => {
        if (cs.fillPath) return `<path d="${cs.fillPath}" fill="${highContrast ? "#000" : cs.color}" />`;
        if (cs.points.length === 0) return "";
        const s = toStroke(cs);
        const d = s.points.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
        const w = highContrast ? Math.max(4, s.width + 1) : s.width;
        const op = highContrast ? 1 : s.opacity;
        const cap = !highContrast && s.texture === "highlighter" ? "square" : "round";
        const join = !highContrast && s.texture === "highlighter" ? "miter" : "round";
        const filterAttr = !highContrast
          ? s.mode === "blend" ? ` filter="url(#blendSoften)"`
          : s.texture === "pencil" ? ` filter="url(#pencilTexture)"`
          : s.texture === "paintbrush" ? ` filter="url(#brushSoften)"` : ""
          : "";
        const blendStyle = !highContrast && (s.texture === "highlighter" || s.mode === "blend") ? ` style="mix-blend-mode:multiply"` : "";
        const pathStr = `<path d="${d}" fill="none" stroke="${highContrast ? "#000" : s.color}" stroke-width="${w}" stroke-opacity="${op}" stroke-linecap="${cap}" stroke-linejoin="${join}"${filterAttr}${blendStyle}/>`;
        const dabs = getBrushDabs(s)
          .map((dab) => `<ellipse cx="${dab.cx.toFixed(1)}" cy="${dab.cy.toFixed(1)}" rx="${dab.rx.toFixed(1)}" ry="${dab.ry.toFixed(1)}" transform="rotate(${dab.rotation.toFixed(1)} ${dab.cx.toFixed(1)} ${dab.cy.toFixed(1)})" fill="${highContrast ? "#000" : s.color}" fill-opacity="${op}"${highContrast ? "" : ` filter="url(#brushSoften)"`}/>`)
          .join("");
        return pathStr + dabs;
      })
      .join("");
    return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS_W} ${CANVAS_H}" width="${CANVAS_W}" height="${CANVAS_H}">${defsExtra}<rect width="100%" height="100%" fill="${bg}"/>${paths}</svg>`;
  };

  const dl = (name: string, content: string, type: string) => {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const a = Object.assign(document.createElement("a"), { href: url, download: name });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const needArt = (what: string) => {
    if (strokes.length > 0) return false;
    say(`There's nothing drawn yet to ${what}.`);
    return true;
  };
  const exportSwell = () => {
    if (needArt("save")) return;
    dl("perceive-collab-swell.svg", buildSvgString(true), "image/svg+xml");
    say("There you go — your swell paper SVG is downloading.");
  };
  const exportColor = () => {
    if (needArt("save")) return;
    dl("perceive-collab-color.svg", buildSvgString(false), "image/svg+xml");
    say("Nice! Your color SVG is downloading.");
  };
  const exportStl = () => {
    if (needArt("save")) return;
    const H = 3, W = 1.5, scale = 150 / CANVAS_W;
    const facets: string[] = [];
    const f3 = (n: number[], v1: number[], v2: number[], v3: number[]) =>
      `facet normal ${n.join(" ")}\nouter loop\nvertex ${v1.join(" ")}\nvertex ${v2.join(" ")}\nvertex ${v3.join(" ")}\nendloop\nendfacet`;
    const box = (x1: number, y1: number, x2: number, y2: number) => {
      const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1;
      const nx = (-dy / len) * W, ny = (dx / len) * W;
      const a = [x1 + nx, y1 + ny, 0], b = [x1 - nx, y1 - ny, 0], c = [x2 + nx, y2 + ny, 0], d = [x2 - nx, y2 - ny, 0];
      const A = [a[0], a[1], H], B = [b[0], b[1], H], C = [c[0], c[1], H], D = [d[0], d[1], H];
      facets.push(f3([0, 0, 1], A, C, D), f3([0, 0, 1], A, D, B));
      facets.push(f3([0, 0, -1], a, d, c), f3([0, 0, -1], a, b, d));
      [[a, c, C, A], [b, B, D, d], [a, A, B, b], [c, d, D, C]].forEach(([p1, p2, p3, p4]) => {
        facets.push(f3([0, 0, 0], p1, p2, p3), f3([0, 0, 0], p1, p3, p4));
      });
    };
    for (const s of strokes) {
      for (let i = 1; i < s.points.length; i++) {
        box(s.points[i - 1].x * scale, (CANVAS_H - s.points[i - 1].y) * scale, s.points[i].x * scale, (CANVAS_H - s.points[i].y) * scale);
      }
    }
    dl("perceive-collab.stl", `solid sb\n${facets.join("\n")}\nendsolid sb`, "model/stl");
    say("Your 3D file is ready — happy printing!");
  };

  // ── Share to gallery (with a deliberate second step) ────────────────────
  const requestPost = () => {
    if (strokes.length === 0) return say("Let's draw something first — then I can send it for you!");
    setPostConfirmOpen(true);
  };
  const cancelPost = () => {
    setPostConfirmOpen(false);
    say("No worries — I kept it just for you.");
  };
  const confirmPost = async () => {
    setPostConfirmOpen(false);
    setSharing(true);
    try {
      await saveArtwork(buildSvgString(false));
      setJustPosted(true);
      setTimeout(() => setJustPosted(false), 2200);
      audio.complete();
      say("Yay! Sent it in for review — it'll go live on the gallery once approved.");
    } catch {
      say("Something went wrong sending that to the gallery.");
    } finally {
      setSharing(false);
    }
  };

  // ── People: mute / report ───────────────────────────────────────────────
  const peerByKey = new Map(peers.map((p) => [p.key, p]));

  const toggleMute = (p: Peer) => {
    const nowMuted = !muted.has(p.key);
    setMuted((prev) => {
      const next = new Set(prev);
      if (nowMuted) next.add(p.key);
      else next.delete(p.key);
      return next;
    });
    announceText(nowMuted ? `Muted ${p.name}. You won't see their lines or messages.` : `Unmuted ${p.name}.`);
  };

  const handleReport = async (reason: ReportReason, note: string) => {
    const target = reportTarget;
    if (!target) return;
    await submitReport({
      room: req.kind === "private" ? `private-${req.code}` : room.roomLabel,
      target,
      reason,
      note,
      strokes: room.strokes,
      chat: room.messages,
    });
    setMuted((prev) => new Set(prev).add(target.key));
    setReportTarget(null);
    announceText(`Report sent. ${target.name} is muted for you.`);
  };

  // ── Derived display values ──────────────────────────────────────────────
  trailRef.current = [...trailRef.current.slice(-14), pos];
  const activeGuide = guideKey ? SHAPE_GUIDES[guideKey] : null;
  const colorName = COLORS[colorIndex].name;
  const drawingNow = penDown && tool !== "fill";
  const statusText = drawingNow
    ? tool === "eraser" ? "Erasing" : "Drawing"
    : strokes.length === 0 ? "A fresh start" : `${strokes.length} ${strokes.length === 1 ? "line" : "lines"} drawn`;
  const sectionBase = "p-5";
  const ROW = "flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors";
  const ROW_ON = "bg-foreground text-background shadow-md";
  const ROW_OFF = "text-foreground hover:bg-primary/10";
  const ROW_SOFT = "bg-primary/15 text-foreground ring-1 ring-primary/40";
  const sizeValue = tool === "eraser" ? eraserSize : blendSize;
  const pct = (v: number, lo: number, hi: number) => ((v - lo) / (hi - lo)) * 100;
  const sliderBg = (v: number, lo: number, hi: number) => ({
    background: `linear-gradient(to right, oklch(0.58 0.15 20) ${pct(v, lo, hi)}%, oklch(0.58 0.15 20 / 0.18) ${pct(v, lo, hi)}%)`,
  });
  const cursorRadius = tool === "eraser" ? eraserSize / 2 : tool === "blend" ? blendSize / 2 : tool === "fill" ? 10 : 12;

  return (
    <section aria-label="Collaborative canvas">
      <div className="overflow-hidden rounded-[2rem] bg-card/70 shadow-2xl shadow-primary/15 ring-1 ring-white/60 backdrop-blur-xl">
        <div className="grid xl:grid-cols-[264px_minmax(0,1fr)_316px] xl:grid-rows-[auto_1fr]">
          {/* ───────── LEFT: people, tools, color, brush, shortcuts ───────── */}
          <aside
            aria-label="Room and drawing tools"
            className="order-2 divide-y divide-border/70 border-t border-border/70 xl:col-start-1 xl:row-span-2 xl:row-start-1 xl:border-r xl:border-t-0"
          >
            {/* 01 / People */}
            <section aria-labelledby="people-heading" className={sectionBase}>
              <h2 id="people-heading" className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                <span><span className="text-primary">01</span> / People</span>
                <span className="rounded-full bg-background/60 px-2.5 py-0.5 text-[11px] font-medium normal-case tracking-normal">{peers.length} of {cap}</span>
              </h2>
              <ul className="mt-4 space-y-1">
                {peers.map((p) => {
                  const isMe = p.key === me.key;
                  const isMuted = muted.has(p.key);
                  return (
                    <li key={p.key} className="flex items-center gap-2.5 text-sm text-foreground">
                      <span aria-hidden className="h-3 w-3 shrink-0 rounded-full ring-1 ring-border" style={{ background: p.color }} />
                      <span className={`min-w-0 flex-1 truncate ${isMuted ? "text-muted-foreground line-through" : ""}`}>
                        {p.name}
                        {isMe && <span className="ml-1.5 text-xs text-muted-foreground">(you)</span>}
                      </span>
                      {!isMe && (
                        <span className="flex shrink-0 items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => toggleMute(p)}
                            aria-pressed={isMuted}
                            aria-label={isMuted ? `Unmute ${p.name}` : `Mute ${p.name}`}
                            title={isMuted ? "Unmute" : "Mute"}
                            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {isMuted ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                          </button>
                          <button
                            type="button"
                            onClick={() => setReportTarget(p)}
                            aria-label={`Report ${p.name}`}
                            title="Report"
                            className="grid h-9 w-9 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            <Flag className="h-4 w-4" />
                          </button>
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>

            {/* 02 / Tools :D */}
            <section aria-labelledby="tools-heading" className={sectionBase}>
              <SectionLabel id="tools-heading" n="02" title="Tools" Icon={Hand} />
              <div className="mt-4 space-y-1.5">
                {([
                  ["draw", "Draw", Pencil, "V"],
                  ["eraser", "Eraser", Eraser, "R"],
                  ["blend", "Blend", Waves, "B"],
                  ["fill", "Fill", PaintBucket, "F"],
                ] as const).map(([id, label, Icon, key]) => (
                  <button key={id} type="button" onClick={() => selectTool(id)} aria-pressed={tool === id} className={`${ROW} ${tool === id ? ROW_ON : ROW_OFF}`}>
                    <Icon className="h-4 w-4 shrink-0" /> {label} <span className="ml-auto text-xs opacity-60">{key}</span>
                  </button>
                ))}
              </div>
              {(tool === "eraser" || tool === "blend") && (
                <label className="mt-3 flex items-center gap-3 text-sm font-medium text-muted-foreground">
                  <span className="shrink-0">{tool === "eraser" ? "Eraser" : "Blend"} size</span>
                  <input
                    type="range" min="4" max="100" step="1" value={sizeValue}
                    onChange={(e) => changeToolSize(Number(e.target.value))}
                    className="min-w-0 flex-1 accent-primary"
                    aria-label={`${tool === "eraser" ? "Eraser" : "Blend"} size`}
                  />
                  <span className="w-8 text-right text-foreground">{sizeValue}</span>
                </label>
              )}
              <div className="mt-4 space-y-1.5 border-t border-border/70 pt-4">
                <button type="button" onClick={togglePen} aria-pressed={penDown} className={`${ROW} ${penDown ? ROW_SOFT : ROW_OFF}`}>
                  {penDown ? <Pencil className="h-4 w-4 shrink-0 text-primary" /> : <Hand className="h-4 w-4 shrink-0" />}
                  {penDown ? "Pen down" : "Pen up"} <span className="ml-auto text-xs opacity-60">Space</span>
                </button>
                <button type="button" onClick={toggleVisualAids} aria-pressed={visualAids} className={`${ROW} ${visualAids ? ROW_SOFT : ROW_OFF}`}>
                  <Eye className="h-4 w-4 shrink-0" /> Visual aids <span className="ml-auto text-xs opacity-60">X</span>
                </button>
                {guideKey && (
                  <button type="button" onClick={stopGuide} className={`${ROW} bg-destructive text-destructive-foreground shadow-sm`}>
                    <X className="h-4 w-4 shrink-0" /> Stop guide <span className="ml-auto text-xs opacity-70">Esc</span>
                  </button>
                )}
                <button type="button" onClick={doUndo} className={`${ROW} ${ROW_OFF}`}>
                  <Undo2 className="h-4 w-4 shrink-0" /> Undo mine <span className="ml-auto text-xs opacity-60">Ctrl Z</span>
                </button>
                <button type="button" onClick={clearMine} className={`${ROW} ${ROW_OFF}`}>
                  <Eraser className="h-4 w-4 shrink-0" /> Clear mine <span className="ml-auto text-xs opacity-60">C</span>
                </button>
                {isPrivate && (
                  <button type="button" onClick={clearEveryone} className={`${ROW} text-destructive hover:bg-destructive/10`}>
                    <Trash2 className="h-4 w-4 shrink-0" /> Clear everyone's
                  </button>
                )}
              </div>
            </section>

            {/* 03 / Color */}
            <section aria-labelledby="colors-heading" className={sectionBase}>
              <SectionLabel id="colors-heading" n="03" title="Color" Icon={Palette} />
              <div className="mt-4 grid grid-cols-6 gap-2.5" role="group" aria-label="Brush color">
                {COLORS.map((c, i) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => pickColor(i)}
                    aria-label={`Color ${c.name}`}
                    aria-pressed={colorIndex === i}
                    className={`relative aspect-square w-full rounded-full shadow-sm ring-2 ring-offset-2 ring-offset-card transition-all duration-150 hover:scale-110 ${
                      colorIndex === i ? "scale-105 ring-foreground" : "ring-border/60"
                    }`}
                    style={{ backgroundColor: c.value }}
                  >
                    {colorIndex === i && (
                      <Check
                        className="absolute inset-0 m-auto h-4 w-4 drop-shadow"
                        style={{ color: ["#f5a623", "#e0b04f", "#f9a8a8", "#ffffff"].includes(c.value) ? "#3a1f2b" : "#fff" }}
                      />
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {colorName} <span className="font-medium normal-case tracking-normal">· Q / E to cycle</span>
              </p>
            </section>

            {/* 04 / Brush */}
            <section aria-labelledby="brush-heading" className={sectionBase}>
              <SectionLabel id="brush-heading" n="04" title="Brush" Icon={Paintbrush} />
              <div className="mt-4 grid grid-cols-2 gap-2">
                {TEXTURE_ORDER.map((t) => {
                  const TextureIcon = TEXTURE_ICONS[t];
                  const active = texture === t;
                  return (
                    <button
                      key={t}
                      type="button"
                      onClick={() => changeTexture(t)}
                      aria-pressed={active}
                      className={`flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-sm font-medium transition-colors ${
                        active ? ROW_SOFT : "ring-1 ring-border/70 text-foreground hover:bg-primary/10"
                      }`}
                    >
                      <TextureIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{TEXTURE_LABELS[t]}</span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">T to cycle textures</p>

              <div className="mt-5 flex items-center justify-between text-sm">
                <span className="font-medium">Size</span>
                <span className="text-muted-foreground">{penWidth} px <span className="ml-1 text-xs">[ / ]</span></span>
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                <Button type="button" onClick={() => changePenWidth(penWidth - 1)} variant="outline" size="icon" className={STEP_BTN} aria-label={`Decrease ${TEXTURE_LABELS[texture].toLowerCase()} thickness`}>
                  <Minus className="h-4 w-4" />
                </Button>
                <input
                  type="range" min={MIN_PEN_WIDTH} max={MAX_PEN_WIDTH} step={1} value={penWidth}
                  onChange={(e) => changePenWidth(Number(e.target.value))}
                  aria-label={`${TEXTURE_LABELS[texture]} thickness`}
                  className={SLIDER_CLASS}
                  style={sliderBg(penWidth, MIN_PEN_WIDTH, MAX_PEN_WIDTH)}
                />
                <Button type="button" onClick={() => changePenWidth(penWidth + 1)} variant="outline" size="icon" className={STEP_BTN} aria-label={`Increase ${TEXTURE_LABELS[texture].toLowerCase()} thickness`}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>

              <div className="mt-5 flex items-center justify-between text-sm">
                <span className="font-medium">Opacity</span>
                <span className="text-muted-foreground">{Math.round(penOpacity * 100)}% <span className="ml-1 text-xs">, / .</span></span>
              </div>
              <div className="mt-2 flex items-center gap-2.5">
                <Button type="button" onClick={() => changePenOpacity(penOpacity - OPACITY_STEP)} variant="outline" size="icon" className={STEP_BTN} aria-label={`Decrease ${TEXTURE_LABELS[texture].toLowerCase()} opacity`}>
                  <Minus className="h-4 w-4" />
                </Button>
                <input
                  type="range" min={OPACITY_RANGE[texture].min} max={OPACITY_RANGE[texture].max} step={OPACITY_STEP} value={penOpacity}
                  onChange={(e) => changePenOpacity(Number(e.target.value))}
                  aria-label={`${TEXTURE_LABELS[texture]} opacity`}
                  className={SLIDER_CLASS}
                  style={sliderBg(penOpacity, OPACITY_RANGE[texture].min, OPACITY_RANGE[texture].max)}
                />
                <Button type="button" onClick={() => changePenOpacity(penOpacity + OPACITY_STEP)} variant="outline" size="icon" className={STEP_BTN} aria-label={`Increase ${TEXTURE_LABELS[texture].toLowerCase()} opacity`}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </section>

            {/* 05 / Shortcuts */}
            <section aria-labelledby="kbd-heading" className={sectionBase}>
              <SectionLabel id="kbd-heading" n="05" title="Shortcuts" Icon={Keyboard} />
              <h3 className="mt-4 text-xl font-black tracking-tight">
                Keys for <span className={`${ACCENT} text-[1.15em]`}>speed.</span>
              </h3>
              <button
                type="button"
                onClick={() => setKbdOpen((o) => !o)}
                aria-expanded={kbdOpen}
                aria-controls="kbd-list"
                className="mt-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"
              >
                {kbdOpen ? "Hide shortcuts" : "Show shortcuts"}
                <ChevronRight className={`h-4 w-4 transition-transform ${kbdOpen ? "rotate-90" : ""}`} />
              </button>
              {kbdOpen && (
                <ul id="kbd-list" className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                  <li>Arrows: move brush (Shift = x3)</li>
                  <li>Space / D: pen down or up (or fill)</li>
                  <li>S / M: toggle sound</li>
                  <li>C: clear my lines</li>
                  <li>Ctrl Z: undo my last line</li>
                  <li>Q / E: cycle colour</li>
                  <li>[ / ]: thickness</li>
                  <li>, / .: opacity</li>
                  <li>T: cycle texture</li>
                  <li>V / R / B / F: draw, eraser, blend, fill</li>
                  <li>G: open / close guides</li>
                  <li>Esc: stop active guide</li>
                  <li>H: explain this page out loud</li>
                  <li>X: toggle visual aids</li>
                </ul>
              )}
            </section>
          </aside>

          {/* ───────── CENTER: the shared canvas ───────── */}
          <section aria-label="Canvas" className="order-1 min-w-0 p-5 pb-3 xl:col-start-2 xl:row-start-1">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-center gap-3 text-[11px] font-bold uppercase tracking-[0.18em]">
                <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-[oklch(0.58_0.13_150)]" />
                <span className="flex items-center gap-1.5 truncate text-foreground">
                  {isPrivate ? <Lock className="h-3.5 w-3.5" /> : <Globe className="h-3.5 w-3.5" />}
                  {isPrivate ? "Private room" : room.roomLabel}
                </span>
                {isPrivate && <span className="font-mono text-sm normal-case tracking-[0.2em] text-primary">{code}</span>}
                <span className="hidden font-medium normal-case tracking-normal text-muted-foreground sm:inline">{CANVAS_W} × {CANVAS_H}</span>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={explainStudio}
                  className="flex h-10 items-center gap-2 rounded-full bg-primary/15 px-3.5 text-sm font-semibold text-foreground ring-1 ring-primary/40 transition-colors hover:bg-primary/25"
                  aria-label="Explain this page out loud: what every feature is and how to use it"
                >
                  <HelpCircle className="h-4 w-4 text-primary" /> Explain this page <span className="text-xs opacity-60">H</span>
                </button>
                <button type="button" onClick={doUndo} className="flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-foreground ring-1 ring-border/70 transition-colors hover:bg-primary/10">
                  <Undo2 className="h-4 w-4" /> Undo
                </button>
                <button type="button" onClick={clearMine} className="flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-foreground ring-1 ring-border/70 transition-colors hover:bg-primary/10">
                  <Eraser className="h-4 w-4" /> Clear mine <span className="text-xs opacity-60">C</span>
                </button>
                <button type="button" onClick={onLeave} className="flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-foreground ring-1 ring-border/70 transition-colors hover:bg-primary/10">
                  <LogOut className="h-4 w-4" /> Leave room
                </button>
              </div>
            </div>

            {isPrivate && (
              <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl bg-secondary/40 px-4 py-3 ring-1 ring-border/70">
                <p className="min-w-[14rem] flex-1 text-sm text-foreground">
                  Share this code with up to {PRIVATE_CAP - 1} friends. Anyone who has it can join.
                </p>
                <button type="button" onClick={() => void copy("code")} className="flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium ring-1 ring-border/70 transition-colors hover:bg-primary/10">
                  {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy code
                </button>
                <button type="button" onClick={() => void copy("link")} className="flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium ring-1 ring-border/70 transition-colors hover:bg-primary/10">
                  {copied === "link" ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} Copy invite link
                </button>
              </div>
            )}

            <div className="relative rounded-2xl bg-card/60 p-2 shadow-inner ring-1 ring-border/70">
              <svg
                ref={svgRef}
                viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                tabIndex={0}
                className={`w-full touch-none select-none rounded-xl bg-white outline-none dark:brightness-[0.92] ${
                  visualAids ? "ring-4 ring-primary/60 focus-visible:ring-primary" : "ring-2 ring-primary/40"
                }`}
                style={{ cursor: "crosshair", aspectRatio: `${CANVAS_W} / ${CANVAS_H}` }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endPointer}
                onPointerCancel={endPointer}
                role="img"
                aria-label={`Shared canvas with ${strokes.length} ${strokes.length === 1 ? "line" : "lines"} from ${peers.length} ${peers.length === 1 ? "person" : "people"}. Use the arrow keys to move and Space to draw. Press H for a spoken tour.`}
              >
                <defs>
                  <filter id="glow">
                    <feGaussianBlur stdDeviation="3" result="blur" />
                    <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="pencilTexture" x="-20%" y="-20%" width="140%" height="140%">
                    <feTurbulence type="fractalNoise" baseFrequency="0.4" numOctaves="3" seed="7" result="grain" />
                    <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.33 0.33 0.33 0 0" result="grainAlpha" />
                    <feComponentTransfer in="grainAlpha" result="grainMask">
                      <feFuncA type="discrete" tableValues="0 0 0.15 0.35 0.55 0.7 0.82 0.92 1 1" />
                    </feComponentTransfer>
                    <feComposite in="SourceGraphic" in2="grainMask" operator="in" result="speckled" />
                    <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="edgeNoise" />
                    <feDisplacementMap in="speckled" in2="edgeNoise" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
                  </filter>
                  <filter id="brushSoften" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="0.6" />
                  </filter>
                  <filter id="blendSoften" x="-60%" y="-60%" width="220%" height="220%">
                    <feGaussianBlur stdDeviation="5" />
                  </filter>
                </defs>
                <rect width={CANVAS_W} height={CANVAS_H} fill="#ffffff" />

                {/* Your shape guide (local only) */}
                {activeGuide && (
                  <>
                    <polyline
                      points={activeGuide.points.map((p) => `${p.x * WIDTH},${p.y * HEIGHT}`).join(" ")}
                      fill="none" stroke="oklch(0.75 0.18 170)" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" strokeOpacity={0.12}
                    />
                    <polyline
                      points={activeGuide.points.map((p) => `${p.x * WIDTH},${p.y * HEIGHT}`).join(" ")}
                      fill="none" stroke="oklch(0.72 0.18 170)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"
                      strokeDasharray="8 6" strokeOpacity={0.55} filter="url(#glow)"
                    />
                    {activeGuide.checkpoints.map((cp, i) => {
                      const pt = activeGuide.points[Math.round(cp.at * (activeGuide.points.length - 1))];
                      return (
                        <circle
                          key={i} cx={pt.x * WIDTH} cy={pt.y * HEIGHT} r={i === 0 ? 10 : 6}
                          fill="oklch(0.72 0.18 170)" fillOpacity={i === 0 ? 0.7 : 0.45}
                          stroke="white" strokeWidth={1.5} strokeOpacity={0.6}
                        />
                      );
                    })}
                  </>
                )}

                {/* Everyone's strokes */}
                {strokes.map((cs) => {
                  if (cs.fillPath) return <path key={cs.id} d={cs.fillPath} fill={cs.color} />;
                  const s = toStroke(cs);
                  const tv = textureVisualProps(s.texture);
                  return (
                    <g key={cs.id}>
                      <polyline
                        points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
                        fill="none" stroke={s.color} strokeWidth={s.width} strokeOpacity={s.opacity}
                        strokeLinecap={tv.strokeLinecap} strokeLinejoin={tv.strokeLinejoin}
                        filter={s.mode === "blend" ? "url(#blendSoften)" : tv.filter}
                        style={s.mode === "blend" ? { mixBlendMode: "multiply" } : tv.style}
                      />
                      {getBrushDabs(s).map((d, j) => (
                        <ellipse
                          key={j} cx={d.cx} cy={d.cy} rx={d.rx} ry={d.ry}
                          transform={`rotate(${d.rotation} ${d.cx} ${d.cy})`}
                          fill={s.color} fillOpacity={s.opacity} filter="url(#brushSoften)"
                        />
                      ))}
                    </g>
                  );
                })}

                {/* Other people's cursors */}
                {Object.entries(cursors).map(([key, c]) => {
                  const peer = peerByKey.get(key);
                  if (!peer || key === me.key || muted.has(key)) return null;
                  const flip = c.x > CANVAS_W - 130;
                  return (
                    <g key={key} transform={`translate(${c.x} ${c.y})`} pointerEvents="none">
                      <circle r={7} fill={peer.color} stroke="#ffffff" strokeWidth={2} />
                      <text
                        x={flip ? -12 : 12} y={-10} textAnchor={flip ? "end" : "start"}
                        fontSize={15} fontWeight={700} fill={peer.color} stroke="#ffffff" strokeWidth={4} paintOrder="stroke"
                      >
                        {peer.name}
                      </text>
                    </g>
                  );
                })}

                {/* Your cursor trail (visual aids) */}
                {visualAids && trailRef.current.map((p, i) => (
                  <circle
                    key={i} cx={p.x} cy={p.y}
                    r={1.5 + (i / trailRef.current.length) * 4}
                    fill={color} fillOpacity={(i / trailRef.current.length) * 0.28}
                  />
                ))}

                {/* Your brush */}
                <circle
                  cx={pos.x} cy={pos.y} r={cursorRadius}
                  fill={tool === "eraser" ? "white" : color}
                  fillOpacity={tool === "eraser" ? 0.5 : 0.18}
                  stroke={tool === "eraser" ? "oklch(0.55 0.08 20)" : color}
                  strokeWidth={2} strokeDasharray={tool === "eraser" ? "5 4" : undefined}
                  pointerEvents="none"
                />
                {tool === "draw" && (
                  <circle cx={pos.x} cy={pos.y} r={Math.max(2, penWidth / 2)} fill={color} fillOpacity={penOpacity} stroke="#111111" strokeWidth={penDown ? 2 : 1} pointerEvents="none" />
                )}
              </svg>
              {strokes.length === 0 && (
                <div aria-hidden className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
                  <Sparkles className="h-6 w-6 text-primary" />
                  <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.2em] text-neutral-700">This space is shared</p>
                  <p className={`${ACCENT} mt-2 text-3xl text-neutral-500 sm:text-4xl`}>Make the first mark together.</p>
                </div>
              )}
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              <span className="flex items-center gap-2.5">
                <img
                  src={drawingNow ? bearDrawing : bearSleeping}
                  alt=""
                  aria-hidden="true"
                  className="h-10 w-10 select-none object-contain drop-shadow-[0_4px_6px_rgba(58,31,43,0.2)]"
                />
                <span aria-hidden className="h-2 w-2 rounded-full bg-[oklch(0.58_0.13_150)]" />
                <span className="text-[oklch(0.42_0.1_150)] dark:text-[oklch(0.78_0.12_150)]">{statusText}</span>
              </span>
              <span>Drag to draw <span aria-hidden>·</span> Every line has a sound</span>
            </div>
          </section>

          {/* ───────── CENTER, ROW 2: session, how it sounds, keep, share ───────── */}
          <div className="order-4 flex min-w-0 flex-col gap-4 p-5 pt-2 xl:col-start-2 xl:row-start-2">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-secondary/40 px-4 py-3 text-sm ring-1 ring-border/70">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Session</span>
              <span className="flex items-center gap-2">
                <span aria-hidden className="h-4 w-4 rounded-full ring-1 ring-border" style={{ backgroundColor: color }} />
                {colorName}
              </span>
              <span>
                {tool === "draw" ? `${TEXTURE_LABELS[texture]} · ${penWidth}px · ${Math.round(penOpacity * 100)}%`
                  : tool === "eraser" ? `Eraser · ${eraserSize}px`
                  : tool === "blend" ? `Blend · ${blendSize}px`
                  : "Fill"}
              </span>
              <span>Sound {soundOn ? "on" : "off"}</span>
              <span>{narrator.voiceOn ? `${VOICE_PERSONA_LABELS[narrator.persona]} guiding` : "Narration off"}</span>
              <span>{muted.size > 0 ? `${muted.size} muted` : "Nobody muted"}</span>
              <span className="ml-auto text-muted-foreground">{statusText}</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 px-1">
              <p className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                Left and right <span className={`${ACCENT} text-[1.15em]`}>pans.</span>{" "}
                Up and down <span className={`${ACCENT} text-[1.15em]`}>sings.</span>
              </p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Move across the canvas to sweep the sound between your ears. Move higher for a higher note. You hear only your own brush.
              </p>
            </div>

            <div className="grid flex-1 items-stretch gap-4 md:grid-cols-2">
              <section aria-labelledby="export-heading" className="flex flex-col rounded-2xl p-5 ring-1 ring-border/70">
                <SectionLabel id="export-heading" n="10" title="Export" Icon={Box} />
                <h3 className="mt-4 text-xl font-black tracking-tight">
                  Hold it in your <span className={`${ACCENT} text-[1.15em]`}>hands.</span>
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Saves the shared canvas as it looks to you, without anyone you've muted.
                </p>
                <div className="mt-4 grid gap-2">
                  <Button type="button" onClick={exportSwell} className={`${ACTION_BTN} shadow-md`}>
                    <Waves className="h-4 w-4 shrink-0" /> Swell Paper SVG
                  </Button>
                  <Button type="button" onClick={exportColor} variant="secondary" className={`${ACTION_BTN} shadow-sm`}>
                    <Palette className="h-4 w-4 shrink-0" /> Colour SVG
                  </Button>
                  <Button type="button" onClick={exportStl} variant="outline" className={`${ACTION_BTN} bg-background/60 ring-1 ring-primary/15`}>
                    <Box className="h-4 w-4 shrink-0" /> 3D Print (STL)
                  </Button>
                </div>
              </section>

              <section aria-labelledby="share-heading" className="flex flex-col rounded-2xl p-5 ring-1 ring-border/70">
                <SectionLabel id="share-heading" n="11" title="Share" Icon={Globe} />
                <h3 className="mt-4 text-xl font-black tracking-tight">
                  Let the world <span className={`${ACCENT} text-[1.15em]`}>see it.</span>
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The gallery gets the whole shared canvas, so check with the room first. Pieces are reviewed before they appear.
                </p>
                <div className="mt-auto grid gap-2 pt-4">
                  <Button type="button" onClick={requestPost} disabled={sharing} variant={justPosted ? "secondary" : "default"} className="h-12 w-full justify-center gap-2 rounded-2xl text-sm font-medium">
                    {justPosted ? <Check className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
                    {sharing ? "Sending…" : justPosted ? "Sent for review!" : "Send to Gallery"}
                  </Button>
                  <Button asChild variant="outline" className="h-12 w-full rounded-2xl bg-card/60 text-sm font-medium">
                    <Link to="/gallery" className="gap-2"><Globe className="h-4 w-4" /> View Gallery</Link>
                  </Button>
                </div>
              </section>
            </div>
          </div>

          {/* ───────── RIGHT: chat, sound, guide voice, inspiration ───────── */}
          <aside
            aria-label="Chat, sound and inspiration"
            className="order-3 divide-y divide-border/70 border-t border-border/70 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:border-l xl:border-t-0"
          >
            <section aria-labelledby="chat-heading" className={sectionBase}>
              <SectionLabel id="chat-heading" n="06" title="Chat" Icon={MessageSquare} />
              <h3 className="mt-4 text-xl font-black tracking-tight">
                Say <span className={`${ACCENT} text-[1.15em]`}>hello.</span>
              </h3>
              <ChatPanel messages={room.messages} muted={muted} meKey={me.key} isPublic={!isPrivate} onSend={room.sendChat} />
            </section>

            <section aria-labelledby="sound-heading" className={sectionBase}>
              <SectionLabel id="sound-heading" n="07" title="Sound" Icon={Volume2} />
              <h3 className="mt-4 text-2xl font-black leading-tight tracking-tight">
                Give it a <span className={`${ACCENT} text-[1.15em]`}>voice.</span>
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">Every movement can make music.</p>
              <button
                type="button"
                onClick={toggleSound}
                aria-pressed={soundOn}
                className={`mt-4 flex h-12 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition-colors ${
                  soundOn ? "bg-primary text-primary-foreground shadow-md" : "bg-card text-foreground ring-1 ring-border hover:bg-primary/10"
                }`}
              >
                {soundOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}
                {soundOn ? "Sound on" : "Sound off"}
                <span className="ml-auto text-xs opacity-70">S</span>
              </button>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {SOUND_STYLE_ORDER.map((st) => {
                  const StyleIcon = SOUND_STYLE_ICONS[st];
                  const active = soundStyle === st;
                  return (
                    <button
                      key={st}
                      type="button"
                      onClick={() => { setSoundStyle(st); say(`${SOUND_STYLE_LABELS[st]} sound.`); }}
                      aria-pressed={active}
                      className={`flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-sm font-medium transition-colors ${
                        active ? "bg-primary/15 ring-1 ring-primary/40" : "ring-1 ring-border/70 hover:bg-primary/10"
                      }`}
                    >
                      <StyleIcon className="h-4 w-4 shrink-0" />
                      <span className="truncate">{SOUND_STYLE_LABELS[st]}</span>
                    </button>
                  );
                })}
              </div>
              <div className="mt-4 flex items-center gap-2.5">
                <Button type="button" onClick={() => setSoundVolume((v) => Math.max(0, +(v - 0.1).toFixed(2)))} variant="outline" size="icon" className={STEP_BTN} aria-label="Decrease canvas sound volume">
                  <Minus className="h-4 w-4" />
                </Button>
                <input
                  type="range" min={0} max={1} step={0.05} value={soundVolume}
                  onChange={(e) => setSoundVolume(Number(e.target.value))}
                  aria-label="Canvas sound volume"
                  className={SLIDER_CLASS}
                  style={sliderBg(soundVolume, 0, 1)}
                />
                <Button type="button" onClick={() => setSoundVolume((v) => Math.min(1, +(v + 0.1).toFixed(2)))} variant="outline" size="icon" className={STEP_BTN} aria-label="Increase canvas sound volume">
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-right text-sm text-muted-foreground">{Math.round(soundVolume * 100)}%</p>
            </section>

            <section aria-labelledby="voice-heading" className={sectionBase}>
              <SectionLabel id="voice-heading" n="08" title="Guide voice" Icon={Mic} />
              <h3 className="mt-4 text-2xl font-black leading-tight tracking-tight">
                Pick your <span className={`${ACCENT} text-[1.15em]`}>guide.</span>
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">Who talks you through the canvas.</p>
              <div role="group" aria-label="Guide voice" className="mt-4 grid grid-cols-2 gap-2">
                {VOICE_PERSONA_ORDER.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => narrator.choosePersona(v)}
                    aria-pressed={narrator.persona === v}
                    className={`flex h-11 items-center justify-center rounded-xl px-3 text-sm font-medium transition-colors ${
                      narrator.persona === v ? ROW_ON : "ring-1 ring-border/70 text-foreground hover:bg-primary/10"
                    }`}
                  >
                    {VOICE_PERSONA_LABELS[v]}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={narrator.toggleVoice}
                aria-pressed={narrator.voiceOn}
                aria-label={narrator.voiceOn ? "Turn narration voice off" : "Turn narration voice on"}
                className={`mt-2 flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors ${
                  narrator.voiceOn ? "bg-primary/15 ring-1 ring-primary/40" : "bg-muted text-muted-foreground ring-1 ring-border"
                }`}
              >
                {narrator.voiceOn ? <Mic className="h-4 w-4 text-primary" /> : <MicOff className="h-4 w-4" />}
                {narrator.voiceOn ? "Narration on" : "Narration off"}
              </button>
            </section>

            <section aria-labelledby="guides-heading" className={sectionBase}>
              <SectionLabel id="guides-heading" n="09" title="Inspiration" Icon={MapIcon} />
              <h3 className="mt-4 text-2xl font-black leading-tight tracking-tight">
                Need a place <span className={`${ACCENT} text-[1.15em]`}>to start?</span>
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">Try following a shape. The guide is only visible to you.</p>
              <button
                type="button"
                onClick={() => setGuidesOpen((o) => !o)}
                aria-expanded={guidesOpen}
                aria-controls="guide-list"
                className="mt-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.16em] text-primary"
              >
                {guidesOpen ? "Hide shapes" : "Show shapes"} <span className="font-medium normal-case tracking-normal text-muted-foreground">· G</span>
                <ChevronRight className={`h-4 w-4 transition-transform ${guidesOpen ? "rotate-90" : ""}`} />
              </button>
              {guideKey && (
                <p className="mt-3 rounded-xl bg-primary/10 px-3 py-2 text-xs text-primary ring-1 ring-primary/20">
                  Active: <strong>{SHAPE_GUIDES[guideKey].name}</strong>. Move near the glowing path to hear the guide tone.
                </p>
              )}
              {guidesOpen && (
                <div id="guide-list" className="mt-3 grid grid-cols-2 gap-2">
                  {Object.entries(SHAPE_GUIDES).map(([key, guide]) => {
                    const { Icon, color: gColor } = GUIDE_ICONS[key];
                    const active = guideKey === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => (active ? stopGuide() : startGuide(key))}
                        aria-pressed={active}
                        title={guide.description}
                        className={`flex min-h-12 min-w-0 items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-medium transition-colors ${
                          active ? "bg-primary/15 text-foreground ring-1 ring-primary/50" : "ring-1 ring-border/70 hover:bg-primary/10"
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" style={{ color: gColor }} />
                        <span className="min-w-0 leading-tight">
                          {guide.name}
                          {active && <span className="block text-[10px] font-normal text-muted-foreground">Active. Press to stop</span>}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          </aside>
        </div>
      </div>

      {/* Send-to-gallery confirmation: a deliberate second step before anything goes public */}
      <Dialog open={postConfirmOpen} onOpenChange={(open) => !open && cancelPost()}>
        <DialogContent className="max-w-sm rounded-3xl">
          <DialogHeader>
            <DialogTitle>Send this to the gallery?</DialogTitle>
            <DialogDescription>
              This is the whole shared canvas, including everyone's lines. Our team reviews every submission before it goes live.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4 gap-2">
            <Button type="button" variant="outline" onClick={cancelPost} className="rounded-full">Cancel</Button>
            <Button type="button" onClick={() => void confirmPost()} className="gap-2 rounded-full">
              <Globe className="h-4 w-4" /> Yes, send for review
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} onSubmit={handleReport} />
    </section>
  );
}

// ───────────────────────────── Chat ───────────────────────────────────────

function ChatPanel({
  messages,
  muted,
  meKey,
  isPublic,
  onSend,
}: {
  messages: ChatMsg[];
  muted: Set<string>;
  meKey: string;
  isPublic: boolean;
  onSend: (text: string, isPublic: boolean) => "ok" | "empty" | "slow" | "links";
}) {
  const [text, setText] = useState("");
  const [hint, setHint] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);
  const visible = messages.filter((m) => !muted.has(m.key));

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [visible.length]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const result = onSend(text, isPublic);
    if (result === "ok") {
      setText("");
      setHint("");
    } else if (result === "slow") setHint("Slow down a little.");
    else if (result === "links") setHint("Links aren't allowed in public rooms.");
  };

  return (
    <div>
      <div
        ref={listRef}
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label="Room chat"
        className="mt-3 max-h-72 min-h-[6rem] space-y-2 overflow-y-auto rounded-2xl bg-background/60 p-3 text-sm"
      >
        {visible.length === 0 ? (
          <p className="text-xs text-muted-foreground">No messages yet. Say hi.</p>
        ) : (
          visible.map((m) => (
            <p key={m.id} className="break-words leading-snug text-foreground">
              <span className="font-semibold" style={{ color: m.color }}>
                {m.key === meKey ? "You" : m.name}
              </span>
              <span className="sr-only">: </span>
              <span aria-hidden> </span>
              {m.text}
            </p>
          ))
        )}
      </div>

      <form onSubmit={submit} className="mt-3 flex gap-2">
        <label htmlFor="collab-chat" className="sr-only">
          Message
        </label>
        <input
          id="collab-chat"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (hint) setHint("");
          }}
          maxLength={CHAT_MAX_CHARS}
          placeholder="Write a message"
          autoComplete="off"
          className="h-10 min-w-0 flex-1 rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none ring-primary/30 placeholder:text-muted-foreground/60 focus:ring-2"
        />
        <Button type="submit" size="sm" className="h-10 gap-1.5 rounded-xl px-3" aria-label="Send message">
          <Send className="h-4 w-4" />
        </Button>
      </form>
      <p className="mt-2 min-h-[1rem] text-[11px] text-muted-foreground" aria-live="polite">
        {hint || (isPublic ? "Public chat: be kind, and no links." : "Only people in this room can see messages.")}
      </p>
    </div>
  );
}

// ───────────────────────────── Report ─────────────────────────────────────

function ReportDialog({
  target,
  onClose,
  onSubmit,
}: {
  target: Peer | null;
  onClose: () => void;
  onSubmit: (reason: ReportReason, note: string) => Promise<void>;
}) {
  const [reason, setReason] = useState<ReportReason | "">("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (target) {
      setReason("");
      setNote("");
      setError("");
      setSending(false);
    }
  }, [target]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason) return;
    setSending(true);
    setError("");
    try {
      await onSubmit(reason, note);
    } catch {
      setError("Couldn't send the report. Please try again.");
      setSending(false);
    }
  };

  return (
    <Dialog open={!!target} onOpenChange={(open) => !open && !sending && onClose()}>
      <DialogContent className="max-w-md rounded-3xl">
        <form onSubmit={submit}>
          <DialogHeader>
            <DialogTitle>Report {target?.name}</DialogTitle>
            <DialogDescription>
              We'll send their lines and recent messages to the Perceive team to review. You won't see them again in this room.
            </DialogDescription>
          </DialogHeader>

          <fieldset className="mt-4 space-y-2">
            <legend className="sr-only">Reason for report</legend>
            {REPORT_REASONS.map((r) => (
              <label
                key={r.value}
                className="flex cursor-pointer items-center gap-3 rounded-xl px-3 py-2 text-sm text-foreground ring-1 ring-border transition-colors hover:bg-primary/5 has-[:checked]:bg-primary/10 has-[:checked]:ring-primary/40"
              >
                <input
                  type="radio"
                  name="report-reason"
                  value={r.value}
                  checked={reason === r.value}
                  onChange={() => setReason(r.value)}
                  className="h-4 w-4 accent-[var(--primary)]"
                />
                {r.label}
              </label>
            ))}
          </fieldset>

          <label htmlFor="report-note" className="mt-4 block text-sm font-medium text-foreground">
            Anything else we should know? <span className="font-normal text-muted-foreground">(optional)</span>
          </label>
          <textarea
            id="report-note"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            maxLength={500}
            rows={3}
            className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
          />

          {error && (
            <p role="alert" className="mt-3 text-sm text-destructive">
              {error}
            </p>
          )}

          <DialogFooter className="mt-5 gap-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={sending} className="rounded-full">
              Cancel
            </Button>
            <Button type="submit" disabled={!reason || sending} className="rounded-full">
              {sending ? "Sending…" : "Send report"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
