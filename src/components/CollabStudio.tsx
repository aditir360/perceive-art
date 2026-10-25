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
  Eraser,
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
  const [tool, setTool] = useState<"draw" | "fill">("draw");
  const [soundOn, setSoundOn] = useState(true);
  const [pos, setPos] = useState<Pt>({ x: CANVAS_W / 2, y: CANVAS_H / 2 });
  const [penDown, setPenDown] = useState(false);
  const [copied, setCopied] = useState<"" | "code" | "link">("");
  const [sharing, setSharing] = useState(false);

  const svgRef = useRef<SVGSVGElement | null>(null);
  const posRef = useRef(pos);
  const penDownRef = useRef(false);
  const pointerDrawingRef = useRef(false);
  const colorRef = useRef(color);
  const widthRef = useRef(width);
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
    if (tool === "fill") {
      const path = makeBucketFillPath(room.strokes, CANVAS_W, CANVAS_H, p);
      if (path) room.addFill(colorRef.current, path);
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
  }, [room, say, tone]);

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
        <Button onClick={onLeave} variant="outline" className="gap-2 rounded-full shadow-sm backdrop-blur-md">
          <LogOut className="h-4 w-4" /> Leave room
        </Button>
      </div>

      {isPrivate && (
        <div className="relative mb-6 flex flex-wrap items-center gap-3 overflow-hidden rounded-2xl border border-white/30 bg-gradient-to-br from-primary/15 via-card/70 to-accent/15 px-5 py-4 shadow-xl shadow-primary/10 ring-1 ring-white/40 backdrop-blur-xl">
          <p className="min-w-[14rem] flex-1 text-sm text-foreground">
            Share this code with up to {PRIVATE_CAP - 1} friends. Anyone who has it can join.
          </p>
          <Button onClick={() => void copy("code")} variant="outline" size="sm" className="gap-2 rounded-full">
            {copied === "code" ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} Copy code
          </Button>
          <Button onClick={() => void copy("link")} variant="outline" size="sm" className="gap-2 rounded-full">
            {copied === "link" ? <Check className="h-4 w-4" /> : <Link2 className="h-4 w-4" />} Copy invite link
          </Button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* Canvas */}
        <div className="min-w-0">
          <div
            tabIndex={0}
            role="group"
            aria-label="Shared canvas. Use the arrow keys to move, Space to put the pen down or lift it, Shift for bigger steps, Control Z to undo, M to toggle sound."
            onKeyDown={onKeyDown}
            onBlur={onBlur}
            className="relative overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-primary/20 via-card/75 to-accent/20 p-1.5 shadow-2xl shadow-primary/20 ring-1 ring-white/40 backdrop-blur-xl outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-2"
          >
            <svg
              ref={svgRef}
              viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
              className="w-full touch-none select-none rounded-[1.85rem] border border-white/60 bg-white shadow-inner dark:brightness-[0.92]"
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
                <polyline key={s.id} points={s.points.map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke={s.color} strokeWidth={s.width} strokeLinecap="round" strokeLinejoin="round" />
              ))}

              {/* Other people's cursors */}
              {Object.entries(cursors).map(([key, c]) => {
                const peer = peerByKey.get(key);
                if (!peer || key === me.key) return null;
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

              {/* Your pen */}
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
          </div>

          <p className="mt-4 px-2 text-sm leading-relaxed text-muted-foreground">
            Draw with a mouse, finger, or pen. Or focus the canvas and use the arrow keys with Space to draw by keyboard —
            moving left and right pans the tone, and up and down changes its pitch.
          </p>
        </div>

        {/* Side panel */}
        <div className="space-y-4">
          {/* People */}
          <div className="rounded-[1.75rem] border border-white/40 bg-gradient-to-br from-card/90 via-card/75 to-primary/10 p-5 shadow-xl shadow-primary/10 ring-1 ring-primary/15 backdrop-blur-xl">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Users className="h-4 w-4 text-primary" /> In this room
              <span className="ml-auto rounded-full bg-background/60 px-2.5 py-0.5 text-xs font-normal text-muted-foreground">
                {peers.length} of {cap}
              </span>
            </h2>
            <ul className="mt-3 space-y-2">
              {peers.map((p) => (
                <li key={p.key} className="flex items-center gap-2.5 text-sm text-foreground">
                  <span aria-hidden className="h-3 w-3 shrink-0 rounded-full" style={{ background: p.color }} />
                  <span className="truncate">{p.name}</span>
                  {p.key === me.key && <span className="text-xs text-muted-foreground">(you)</span>}
                </li>
              ))}
            </ul>
          </div>

          {/* Tools */}
          <div className="rounded-[1.75rem] border border-white/40 bg-gradient-to-br from-card/90 via-card/75 to-primary/10 p-5 shadow-xl shadow-primary/10 ring-1 ring-primary/15 backdrop-blur-xl">
            <h2 className="text-sm font-semibold text-foreground">Tools</h2>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button onClick={() => setTool("draw")} variant={tool === "draw" ? "default" : "outline"} size="sm" className="gap-2 rounded-full"><Pencil className="h-4 w-4" /> Draw</Button>
              <Button onClick={() => setTool("fill")} variant={tool === "fill" ? "default" : "outline"} size="sm" className="gap-2 rounded-full"><PaintBucket className="h-4 w-4" /> Fill</Button>
            </div>
            <h2 className="mt-5 text-sm font-semibold text-foreground">Color</h2>
            <div className="mt-3 grid grid-cols-6 gap-2" role="group" aria-label="Brush color">
              {SWATCHES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setColor(s.value)}
                  aria-label={s.name}
                  aria-pressed={color === s.value}
                  className={`h-8 w-8 rounded-full ring-1 ring-border transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                    color === s.value ? "scale-110 ring-2 ring-primary ring-offset-2 ring-offset-card" : ""
                  }`}
                  style={{ background: s.value }}
                />
              ))}
            </div>

            <label htmlFor="collab-width" className="mt-5 flex items-center justify-between text-sm font-semibold text-foreground">
              Brush size <span className="text-xs font-normal text-muted-foreground">{width}px</span>
            </label>
            <input
              id="collab-width"
              type="range"
              min={2}
              max={28}
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="mt-2 w-full accent-[var(--primary)]"
            />

            <div className="mt-5 grid grid-cols-2 gap-2">
              <Button onClick={doUndo} variant="outline" size="sm" className="gap-1.5 rounded-full">
                <Undo2 className="h-3.5 w-3.5" /> Undo
              </Button>
              <Button
                onClick={() => {
                  room.clearMine();
                  say("Cleared your lines.");
                }}
                variant="outline"
                size="sm"
                className="gap-1.5 rounded-full"
              >
                <Eraser className="h-3.5 w-3.5" /> Clear mine
              </Button>
              {isPrivate && (
                <Button onClick={clearAll} variant="outline" size="sm" className="col-span-2 gap-1.5 rounded-full">
                  <Trash2 className="h-3.5 w-3.5" /> Clear everyone's
                </Button>
              )}
              <Button
                onClick={() => setSoundOn((v) => !v)}
                variant="outline"
                size="sm"
                aria-pressed={soundOn}
                className="col-span-2 gap-1.5 rounded-full"
              >
                {soundOn ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                {soundOn ? "My brush sound: on" : "My brush sound: off"}
              </Button>
            </div>
          </div>

          {/* Keep */}
          <div className="rounded-[1.75rem] border border-white/40 bg-gradient-to-br from-card/90 via-card/75 to-primary/10 p-5 shadow-xl shadow-primary/10 ring-1 ring-primary/15 backdrop-blur-xl">
            <h2 className="text-sm font-semibold text-foreground">Keep your art</h2>
            <div className="mt-3 grid gap-2">
              <Button onClick={download} variant="outline" size="sm" className="gap-2 rounded-full">
                <Download className="h-4 w-4" /> Save as SVG
              </Button>
              <Button onClick={() => void share()} disabled={sharing} size="sm" className="gap-2 rounded-full">
                <Share2 className="h-4 w-4" /> {sharing ? "Sending…" : "Send to gallery"}
              </Button>
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
              The gallery gets the whole shared canvas, so check with the room first.{" "}
              <Link to="/gallery" className="font-medium text-primary underline-offset-2 hover:underline">
                See the gallery
              </Link>
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
