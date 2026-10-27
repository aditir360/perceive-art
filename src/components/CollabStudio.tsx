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
  ArrowRight,
  Check,
  Copy,
  Download,
  Eraser,
  Eye,
  EyeOff,
  Flag,
  Globe,
  Hand,
  Keyboard,
  KeyRound,
  Link2,
  Loader2,
  Lock,
  LogOut,
  MessageSquare,
  PaintBucket,
  Palette,
  Paintbrush,
  Pencil,
  Sparkles,
  Send,
  Share2,
  Trash2,
  Undo2,
  Users,
  Volume2,
  VolumeX,
} from "lucide-react";

const ACCENT = "font-['Instrument_Serif',Georgia,serif] font-normal italic tracking-tight";

function SectionLabel({ id, n, title, Icon }: { id: string; n: string; title: string; Icon: typeof Globe }) {
  return (
    <h2 id={id} className="flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
      <span><span className="text-primary">{n}</span> / {title}</span>
      <Icon className="h-4 w-4 opacity-70" aria-hidden />
    </h2>
  );
}

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
  { name: "white", value: "#ffffff" },
];

const KEY_STEP = 14;
const KEY_STEP_BIG = 56;

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
      return `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="${s.width}" stroke-linecap="round" stroke-linejoin="round" />`;
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

function useBrushTone(enabled: boolean) {
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
        osc.type = "sine";
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
      a.osc.frequency.setTargetAtTime(freqForY(p.y), t, 0.05);
      a.pan.pan.setTargetAtTime(clamp((p.x / CANVAS_W) * 2 - 1, -1, 1), t, 0.03);
      a.gain.gain.setTargetAtTime(drawing ? 0.14 : 0.06, t, 0.04);
      if (a.timer) clearTimeout(a.timer);
      const node = a;
      a.timer = setTimeout(() => node.gain.gain.setTargetAtTime(0, node.ctx.currentTime, 0.2), 220);
    },
    [enabled],
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
  say,
}: {
  req: RoomRequest;
  room: RoomApi;
  onLeave: () => void;
  say: (m: string) => void;
}) {
  const { me, peers, cursors } = room;
  const isPrivate = req.kind === "private";
  const cap = isPrivate ? PRIVATE_CAP : PUBLIC_CAP;

  const [color, setColor] = useState(SWATCHES[1].value);
  const [width, setWidth] = useState(6);
  const [tool, setTool] = useState<"draw" | "fill">("draw");
  const [soundOn, setSoundOn] = useState(true);
  const [pos, setPos] = useState<Pt>({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
  const [penDown, setPenDown] = useState(false);
  const [copied, setCopied] = useState<"" | "code" | "link">("");
  const [sharing, setSharing] = useState(false);
  const [muted, setMuted] = useState<Set<string>>(() => new Set());
  const [reportTarget, setReportTarget] = useState<Peer | null>(null);

  // Muting is local: you stop seeing that person's lines, cursor and chat.
  // Saving and sharing also leave out their lines, so you never send on
  // something you chose not to see.
  const strokes = room.strokes.filter((s) => !muted.has(s.owner));

  const svgRef = useRef<SVGSVGElement | null>(null);
  const fillAt = (p: Pt) => {
    const path = makeBucketFillPath(strokes, CANVAS_W, CANVAS_H, p);
    if (path && room.addFill(colorRef.current, path)) say("Filled.");
    else say("Nothing to fill there. Click an empty area enclosed by lines.");
  };
  const posRef = useRef(pos);
  const penDownRef = useRef(false);
  const pointerDrawingRef = useRef(false);
  const colorRef = useRef(color);
  const widthRef = useRef(width);
  const toolRef = useRef(tool);
  useEffect(() => { toolRef.current = tool; }, [tool]);
  useEffect(() => { colorRef.current = color; }, [color]);
  useEffect(() => { widthRef.current = width; }, [width]);

  const tone = useBrushTone(soundOn);

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
    if (toolRef.current === "fill") {
      fillAt(p);
      return;
    }
    pointerDrawingRef.current = true;
    room.begin(colorRef.current, widthRef.current, p);
    tone.play(p, true);
  };
  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const p = toPt(e);
    setPosition(p);
    if (pointerDrawingRef.current) {
      room.extend(p);
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
  };

  // Keyboard drawing: arrows move, Space lowers/lifts the pen.
  const togglePen = useCallback(() => {
    if (toolRef.current === "fill") {
      fillAt(posRef.current);
      return;
    }
    if (penDownRef.current) {
      penDownRef.current = false;
      setPenDown(false);
      room.end();
      tone.silence();
      say("Pen up.");
    } else {
      penDownRef.current = true;
      setPenDown(true);
      room.begin(colorRef.current, widthRef.current, posRef.current);
      tone.play(posRef.current, true);
      say("Pen down. Use the arrow keys to draw.");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room, say, tone, strokes]);

  const doUndo = useCallback(() => {
    say(room.undoMine() ? "Undid your last line." : "You have nothing to undo.");
  }, [room, say]);

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
        e.preventDefault();
        togglePen();
        return;
      case "m":
      case "M":
        setSoundOn((v) => !v);
        return;
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
    say(ok ? (what === "code" ? "Room code copied." : "Invite link copied.") : "Couldn't copy. Select the code and copy it by hand.");
    if (ok) setTimeout(() => setCopied(""), 2000);
  };

  const download = () => {
    if (!strokes.length) return say("There's nothing drawn yet to save.");
    const blob = new Blob([buildSvg(strokes)], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "perceive-collab-drawing.svg";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    say("Saved your drawing as an SVG.");
  };

  const share = async () => {
    if (!strokes.length) return say("There's nothing drawn yet to share.");
    setSharing(true);
    try {
      await saveArtwork(buildSvg(strokes));
      say("Sent to the gallery for review.");
    } catch {
      say("Something went wrong sending that to the gallery.");
    } finally {
      setSharing(false);
    }
  };

  const clearAll = () => {
    if (window.confirm("Clear the whole canvas for everyone in this room?")) {
      room.clearAll();
      say("Cleared the canvas for everyone.");
    }
  };

  const peerByKey = new Map(peers.map((p) => [p.key, p]));

  const toggleMute = (p: Peer) => {
    const nowMuted = !muted.has(p.key);
    setMuted((prev) => {
      const next = new Set(prev);
      if (nowMuted) next.add(p.key);
      else next.delete(p.key);
      return next;
    });
    say(nowMuted ? `Muted ${p.name}. You won't see their lines or messages.` : `Unmuted ${p.name}.`);
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
    say(`Report sent. ${target.name} is muted for you.`);
  };

  const sectionBase = "p-5";
  const ROW = "flex h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition-colors";
  const ROW_OFF = "text-foreground hover:bg-primary/10";
  const statusText = penDown ? "Drawing" : strokes.length === 0 ? "A fresh start" : `${strokes.length} ${strokes.length === 1 ? "line" : "lines"} drawn`;
  const colorName = SWATCHES.find((s) => s.value === color)?.name ?? "";

  return (
    <section aria-label="Collaborative canvas">
      <div className="overflow-hidden rounded-[2rem] bg-card/70 shadow-2xl shadow-primary/15 ring-1 ring-white/60 backdrop-blur-xl">
        <div className="grid xl:grid-cols-[264px_minmax(0,1fr)_316px] xl:grid-rows-[auto_1fr]">
          {/* ───────── LEFT: people, color, brush, shortcuts ───────── */}
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

            {/* 02 / Color */}
            <section aria-labelledby="colors-heading" className={sectionBase}>
              <SectionLabel id="colors-heading" n="02" title="Color" Icon={Palette} />
              <div className="mt-4 grid grid-cols-6 gap-2.5" role="group" aria-label="Brush color">
                {SWATCHES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => setColor(s.value)}
                    aria-label={s.name}
                    aria-pressed={color === s.value}
                    className={`relative aspect-square w-full rounded-full shadow-sm ring-2 ring-offset-2 ring-offset-card transition-all duration-150 hover:scale-110 ${
                      color === s.value ? "scale-105 ring-foreground" : "ring-border/60"
                    }`}
                    style={{ backgroundColor: s.value }}
                  >
                    {color === s.value && (
                      <Check
                        className="absolute inset-0 m-auto h-4 w-4 drop-shadow"
                        style={{ color: ["#f5a623", "#e0b04f", "#ffffff"].includes(s.value) ? "#3a1f2b" : "#fff" }}
                      />
                    )}
                  </button>
                ))}
              </div>
              <p className="mt-4 text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{colorName}</p>
            </section>

            {/* 03 / Brush */}
            <section aria-labelledby="brush-heading" className={sectionBase}>
              <SectionLabel id="brush-heading" n="03" title="Brush" Icon={Paintbrush} />
              <div className="mt-4 grid grid-cols-2 gap-2">
                {([["draw", "Draw", Pencil], ["fill", "Fill", PaintBucket]] as const).map(([id, label, Icon]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => { setTool(id); say(id === "fill" ? "Fill tool. Click an enclosed area, or press Space to fill at the pen." : "Draw tool."); }}
                    aria-pressed={tool === id}
                    className={`flex h-11 min-w-0 items-center justify-center gap-2 rounded-xl px-2 text-sm font-medium transition-colors ${
                      tool === id ? "bg-primary/15 text-foreground ring-1 ring-primary/40" : "text-foreground ring-1 ring-border/70 hover:bg-primary/10"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" /> {label}
                  </button>
                ))}
              </div>
              <label htmlFor="collab-width" className="mt-5 flex items-center justify-between text-sm">
                <span className="font-medium">Size</span>
                <span className="text-muted-foreground">{width} px</span>
              </label>
              <input
                id="collab-width"
                type="range"
                min={2}
                max={28}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
                className="mt-2 w-full accent-primary"
              />
              <div className="mt-4 space-y-1.5 border-t border-border/70 pt-4">
                <button type="button" onClick={togglePen} aria-pressed={penDown} className={`${ROW} ${penDown ? "bg-primary/15 text-foreground ring-1 ring-primary/40" : ROW_OFF}`}>
                  {penDown ? <Pencil className="h-4 w-4 shrink-0 text-primary" /> : <Hand className="h-4 w-4 shrink-0" />}
                  {penDown ? "Pen down" : "Pen up"} <span className="ml-auto text-xs opacity-60">Space</span>
                </button>
                <button type="button" onClick={doUndo} className={`${ROW} ${ROW_OFF}`}>
                  <Undo2 className="h-4 w-4 shrink-0" /> Undo mine <span className="ml-auto text-xs opacity-60">Ctrl Z</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    room.clearMine();
                    say("Cleared your lines.");
                  }}
                  className={`${ROW} ${ROW_OFF}`}
                >
                  <Eraser className="h-4 w-4 shrink-0" /> Clear mine
                </button>
                {isPrivate && (
                  <button type="button" onClick={clearAll} className={`${ROW} text-destructive hover:bg-destructive/10`}>
                    <Trash2 className="h-4 w-4 shrink-0" /> Clear everyone's
                  </button>
                )}
              </div>
            </section>

            {/* 04 / Shortcuts */}
            <section aria-labelledby="kbd-heading" className={sectionBase}>
              <SectionLabel id="kbd-heading" n="04" title="Shortcuts" Icon={Keyboard} />
              <h3 className="mt-4 text-xl font-black tracking-tight">
                Keys for <span className={`${ACCENT} text-[1.15em]`}>speed.</span>
              </h3>
              <ul className="mt-3 space-y-1.5 text-sm text-muted-foreground">
                <li>Arrows: move (Shift = bigger steps)</li>
                <li>Space / Enter: pen down or up (fills at the pen with Fill)</li>
                <li>Ctrl Z: undo your last line</li>
                <li>M: toggle your brush sound</li>
              </ul>
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
              <button
                type="button"
                onClick={onLeave}
                className="flex h-10 items-center gap-2 rounded-full px-3.5 text-sm font-medium text-foreground ring-1 ring-border/70 transition-colors hover:bg-primary/10"
              >
                <LogOut className="h-4 w-4" /> Leave room
              </button>
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

            <div
              tabIndex={0}
              role="group"
              aria-label="Shared canvas. Use the arrow keys to move, Space to put the pen down or lift it, Shift for bigger steps, Control Z to undo, M to toggle sound."
              onKeyDown={onKeyDown}
              onBlur={onBlur}
              className="relative rounded-2xl bg-card/60 p-2 shadow-inner ring-1 ring-border/70 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <svg
                ref={svgRef}
                viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
                className="w-full touch-none select-none rounded-xl bg-white dark:brightness-[0.92]"
                style={{ cursor: "crosshair" }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={endPointer}
                onPointerCancel={endPointer}
                role="img"
                aria-label={`Canvas with ${strokes.length} ${strokes.length === 1 ? "line" : "lines"} from ${peers.length} ${peers.length === 1 ? "person" : "people"}.`}
              >
                <rect width={CANVAS_W} height={CANVAS_H} fill="#ffffff" />
                {strokes.map((s) => s.fillPath ? (
                  <path key={s.id} d={s.fillPath} fill={s.color} />
                ) : (
                  <polyline
                    key={s.id}
                    points={s.points.map((p) => `${p.x},${p.y}`).join(" ")}
                    fill="none"
                    stroke={s.color}
                    strokeWidth={s.width}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))}

                {Object.entries(cursors).map(([key, c]) => {
                  const peer = peerByKey.get(key);
                  if (!peer || key === me.key || muted.has(key)) return null;
                  const flip = c.x > CANVAS_W - 130;
                  return (
                    <g key={key} transform={`translate(${c.x} ${c.y})`} pointerEvents="none">
                      <circle r={7} fill={peer.color} stroke="#ffffff" strokeWidth={2} />
                      <text
                        x={flip ? -12 : 12}
                        y={-10}
                        textAnchor={flip ? "end" : "start"}
                        fontSize={15}
                        fontWeight={700}
                        fill={peer.color}
                        stroke="#ffffff"
                        strokeWidth={4}
                        paintOrder="stroke"
                      >
                        {peer.name}
                      </text>
                    </g>
                  );
                })}

                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={penDown ? 10 : 8}
                  fill={color}
                  stroke="#111111"
                  strokeWidth={2}
                  pointerEvents="none"
                />
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
                  src={penDown ? bearDrawing : bearSleeping}
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

          {/* ───────── CENTER, ROW 2: session, how it sounds, keep your art ───────── */}
          <div className="order-4 flex min-w-0 flex-col gap-4 p-5 pt-2 xl:col-start-2 xl:row-start-2">
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl bg-secondary/40 px-4 py-3 text-sm ring-1 ring-border/70">
              <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Session</span>
              <span className="flex items-center gap-2">
                <span aria-hidden className="h-4 w-4 rounded-full ring-1 ring-border" style={{ backgroundColor: color }} />
                {colorName}
              </span>
              <span>{width}px brush</span>
              <span>Sound {soundOn ? "on" : "off"}</span>
              <span>{muted.size > 0 ? `${muted.size} muted` : "Nobody muted"}</span>
              <span className="ml-auto text-muted-foreground">{statusText}</span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 px-1">
              <p className="text-2xl font-black leading-tight tracking-tight sm:text-3xl">
                Left and right <span className={`${ACCENT} text-[1.15em]`}>pans.</span>{" "}
                Up and down <span className={`${ACCENT} text-[1.15em]`}>sings.</span>
              </p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Move across the canvas to sweep the sound between your ears. Move higher for a higher note.
              </p>
            </div>

            <div className="grid flex-1 items-stretch gap-4 md:grid-cols-2">
              <section aria-labelledby="export-heading" className="flex flex-col rounded-2xl p-5 ring-1 ring-border/70">
                <SectionLabel id="export-heading" n="07" title="Keep" Icon={Download} />
                <h3 className="mt-4 text-xl font-black tracking-tight">
                  Take it <span className={`${ACCENT} text-[1.15em]`}>with you.</span>
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Saves the shared canvas as it looks to you, without anyone you've muted.
                </p>
                <div className="mt-auto grid gap-2 pt-4">
                  <Button onClick={download} variant="outline" className="h-12 justify-start gap-3 rounded-2xl bg-background/60 px-4 text-sm font-medium ring-1 ring-primary/15">
                    <Download className="h-4 w-4 shrink-0" /> Save as SVG
                  </Button>
                </div>
              </section>

              <section aria-labelledby="share-heading" className="flex flex-col rounded-2xl p-5 ring-1 ring-border/70">
                <SectionLabel id="share-heading" n="08" title="Share" Icon={Globe} />
                <h3 className="mt-4 text-xl font-black tracking-tight">
                  Let the world <span className={`${ACCENT} text-[1.15em]`}>see it.</span>
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  The gallery gets the whole shared canvas, so check with the room first. Pieces are reviewed before they appear.
                </p>
                <div className="mt-auto grid gap-2 pt-4">
                  <Button onClick={() => void share()} disabled={sharing} className="h-12 w-full justify-center gap-2 rounded-2xl text-sm font-medium">
                    <Share2 className="h-4 w-4" /> {sharing ? "Sending…" : "Send to Gallery"}
                  </Button>
                  <Button asChild variant="outline" className="h-12 w-full rounded-2xl bg-card/60 text-sm font-medium">
                    <Link to="/gallery" className="gap-2"><Globe className="h-4 w-4" /> View Gallery</Link>
                  </Button>
                </div>
              </section>
            </div>
          </div>

          {/* ───────── RIGHT: chat, sound ───────── */}
          <aside
            aria-label="Chat and sound"
            className="order-3 divide-y divide-border/70 border-t border-border/70 xl:col-start-3 xl:row-span-2 xl:row-start-1 xl:border-l xl:border-t-0"
          >
            <section aria-labelledby="chat-heading" className={sectionBase}>
              <SectionLabel id="chat-heading" n="05" title="Chat" Icon={MessageSquare} />
              <h3 className="mt-4 text-xl font-black tracking-tight">
                Say <span className={`${ACCENT} text-[1.15em]`}>hello.</span>
              </h3>
              <ChatPanel
                messages={room.messages}
                muted={muted}
                meKey={me.key}
                isPublic={!isPrivate}
                onSend={room.sendChat}
              />
            </section>

            <section aria-labelledby="sound-heading" className={sectionBase}>
              <SectionLabel id="sound-heading" n="06" title="Sound" Icon={Volume2} />
              <h3 className="mt-4 text-xl font-black tracking-tight">
                Give it a <span className={`${ACCENT} text-[1.15em]`}>voice.</span>
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                You hear your own brush only. Everyone else's lines are silent, so the room stays calm.
              </p>
              <button
                type="button"
                onClick={() => setSoundOn((v) => !v)}
                aria-pressed={soundOn}
                className={`${ROW} mt-4 ${soundOn ? "bg-primary/15 text-foreground ring-1 ring-primary/40" : ROW_OFF}`}
              >
                {soundOn ? <Volume2 className="h-4 w-4 shrink-0 text-primary" /> : <VolumeX className="h-4 w-4 shrink-0" />}
                {soundOn ? "My brush sound: on" : "My brush sound: off"} <span className="ml-auto text-xs opacity-60">M</span>
              </button>
            </section>
          </aside>
        </div>
      </div>

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
