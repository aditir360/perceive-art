import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

/* ──────────────────────────────────────────────────────────────────────────
   Realtime collaboration, built on Supabase Realtime (Broadcast + Presence).
   No database tables are needed: a "room" is just a named channel.

   • Private rooms: a 6-character code names the channel. Anyone who has the
     code can join, up to PRIVATE_CAP people. :D
   • Public rooms: public-1, public-2, … The first room with space is joined,
     so strangers are grouped automatically, up to PUBLIC_CAP people each.

   Supabase can't enforce a member limit by itself, so the limit is enforced
   by the clients through Presence (each person marks themselves "admitted"
   only if there's space). That's fine for a friendly studio; it is not a
   security boundary.
   ────────────────────────────────────────────────────────────────────────── */

export const PRIVATE_CAP = 5;
export const PUBLIC_CAP = 8;
const MAX_PUBLIC_ROOMS = 30;

export const CANVAS_W = 900;
export const CANVAS_H = 560;

export type Pt = { x: number; y: number };
export type CStroke = {
  id: string;
  owner: string;
  color: string;
  width: number;
  points: Pt[];
  fillPath?: string;
};
export type Peer = {
  key: string;
  name: string;
  color: string;
  joinedAt: number;
  admitted: boolean;
};
export type RoomRequest = { kind: "public" } | { kind: "private"; code: string };
export type RoomStatus = "idle" | "connecting" | "ready" | "full" | "error";
export type Cursor = { x: number; y: number; t: number };

// No 0/O/1/I so codes are easy to read out loud or type from a screenshot.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

export function makeRoomCode(): string {
  const bytes = new Uint8Array(CODE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CODE_ALPHABET[b % CODE_ALPHABET.length]).join("");
}

export function normalizeCode(input: string): string {
  return input
    .toUpperCase()
    .split("")
    .filter((c) => CODE_ALPHABET.includes(c))
    .join("")
    .slice(0, CODE_LENGTH);
}

const ADJECTIVES = ["Amber", "Coral", "Mint", "Plum", "Sunny", "Velvet", "Misty", "Golden", "Quiet", "Bright", "Gentle", "Lucky"];
const ANIMALS = ["Bear", "Fox", "Otter", "Finch", "Panda", "Heron", "Koala", "Lynx", "Robin", "Seal", "Wren", "Hare"];
export const PEER_COLORS = ["#e88aab", "#4da6ff", "#48b376", "#f5a623", "#9b72cf", "#3fb8af", "#c2385a", "#d98324"];

const pick = <T,>(list: T[]): T => list[Math.floor(Math.random() * list.length)];

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const byJoin = (a: Peer, b: Peer) => a.joinedAt - b.joinedAt || a.key.localeCompare(b.key);
const round1 = (n: number) => Math.round(n * 10) / 10;

const STROKE_FLUSH_MS = 120; // ≈8 messages/second while drawing
const CURSOR_MS = 150; // ≈6 messages/second while idle-moving (never both at once)
const CURSOR_TTL_MS = 6000;
// Realtime messages are size-limited; keep each state chunk well under it.
const SYNC_CHUNK_CHARS = 40_000;

export function useCollabRoom(req: RoomRequest | null) {
  const reqKey = req ? `${req.kind}:${req.kind === "private" ? req.code : ""}` : "";

  const [status, setStatus] = useState<RoomStatus>("idle");
  const [roomLabel, setRoomLabel] = useState("");
  const [peers, setPeers] = useState<Peer[]>([]);
  const [cursors, setCursors] = useState<Record<string, Cursor>>({});
  const [notice, setNotice] = useState("");
  const [rev, setRev] = useState(0);
  const [attempt, setAttempt] = useState(0);

  // Stable identity for this tab.
  const meRef = useRef<{ key: string; name: string; color: string } | null>(null);
  if (!meRef.current) {
    meRef.current = {
      key: newId(),
      name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`,
      color: pick(PEER_COLORS),
    };
  }
  const me = meRef.current;

  const channelRef = useRef<RealtimeChannel | null>(null);
  const admittedRef = useRef(false);
  const peersRef = useRef<Peer[]>([]);
  const strokesRef = useRef<Map<string, CStroke>>(new Map());
  const cursorsRef = useRef<Record<string, Cursor>>({});
  const rafRef = useRef(0);

  const localRef = useRef<{ id: string; queue: Pt[]; timer: ReturnType<typeof setInterval> | null } | null>(null);
  const counterRef = useRef(0);
  const lastCursorSentRef = useRef(0);

  const schedule = useCallback(() => {
    if (rafRef.current) return;
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = 0;
      setRev((r) => r + 1);
      setCursors({ ...cursorsRef.current });
    });
  }, []);

  const send = useCallback((event: string, payload: unknown) => {
    const ch = channelRef.current;
    if (!ch || !admittedRef.current) return;
    void ch.send({ type: "broadcast", event, payload });
  }, []);

  // ── Joining a room ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!req) {
      setStatus("idle");
      return;
    }

    let disposed = false;
    let publicIndex = 1;
    let syncTimer: ReturnType<typeof setTimeout> | null = null;
    let gotState = false;
    let prevAdmitted = new Set<string>();

    strokesRef.current = new Map();
    cursorsRef.current = {};
    peersRef.current = [];
    setPeers([]);
    setCursors({});
    setNotice("");
    setStatus("connecting");

    const closeChannel = (ch: RealtimeChannel | null) => {
      if (!ch) return;
      try {
        void ch.untrack();
      } catch {
        /* noop */
      }
      void supabase.removeChannel(ch);
    };

    const open = (roomId: string, cap: number, label: string) => {
      if (disposed) return;
      admittedRef.current = false;
      gotState = false;
      prevAdmitted = new Set();
      setRoomLabel(label);
      setStatus("connecting");

      const ch = supabase.channel(`perceive-collab:${roomId}`, {
        config: { broadcast: { self: false }, presence: { key: me.key } },
      });
      channelRef.current = ch;
      const joinedAt = Date.now();
      const meta = { key: me.key, name: me.name, color: me.color, joinedAt };

      const isCurrent = () => !disposed && channelRef.current === ch;

      const requestSync = () => {
        void ch.send({ type: "broadcast", event: "sync-request", payload: { from: me.key } });
      };

      const onFull = () => {
        closeChannel(ch);
        channelRef.current = null;
        admittedRef.current = false;
        if (req.kind === "public" && publicIndex < MAX_PUBLIC_ROOMS) {
          publicIndex += 1;
          open(`public-${publicIndex}`, PUBLIC_CAP, `Public room ${publicIndex}`);
        } else {
          setStatus("full");
        }
      };

      const handleSync = () => {
        if (!isCurrent()) return;
        const state = ch.presenceState<Peer>();
        const all: Peer[] = Object.values(state)
          .map((metas) => metas[0])
          .filter(Boolean)
          .map((m) => ({ key: m.key, name: m.name, color: m.color, joinedAt: m.joinedAt, admitted: !!m.admitted }));
        if (!all.some((p) => p.key === me.key)) return; // our own track hasn't round-tripped yet

        if (!admittedRef.current) {
          const admittedOthers = all.filter((p) => p.admitted && p.key !== me.key);
          const slots = cap - admittedOthers.length;
          const pending = all.filter((p) => !p.admitted).sort(byJoin);
          const rank = pending.findIndex((p) => p.key === me.key);
          if (slots <= 0 || rank < 0 || rank >= slots) {
            onFull();
            return;
          }
          admittedRef.current = true;
          void ch.track({ ...meta, admitted: true });
          setStatus("ready");
          requestSync();
          syncTimer = setTimeout(() => {
            if (isCurrent() && !gotState) requestSync();
          }, 2500);
        }

        const admitted = all.filter((p) => p.admitted || p.key === me.key).map((p) => (p.key === me.key ? { ...p, admitted: true } : p)).sort(byJoin);
        const prevPeers = peersRef.current;
        peersRef.current = admitted;
        setPeers(admitted);

        const nowSet = new Set(admitted.map((p) => p.key));
        if (prevAdmitted.size > 0) {
          for (const p of admitted) if (!prevAdmitted.has(p.key) && p.key !== me.key) setNotice(`${p.name} joined the room.`);
          for (const key of prevAdmitted) {
            if (!nowSet.has(key)) {
              const gone = prevPeers.find((p) => p.key === key);
              setNotice(`${gone?.name ?? "Someone"} left the room.`);
              delete cursorsRef.current[key];
            }
          }
        }
        prevAdmitted = nowSet;
        schedule();
      };

      ch.on("presence", { event: "sync" }, handleSync)
        .on("broadcast", { event: "stroke" }, ({ payload }) => {
          if (!isCurrent() || !admittedRef.current) return;
          const p = payload as { id: string; owner: string; color: string; width: number; pts?: Pt[]; fillPath?: string };
          if (!p?.id || (!Array.isArray(p.pts) && !p.fillPath)) return;
          if (p.fillPath) {
            strokesRef.current.set(p.id, { id: p.id, owner: p.owner, color: p.color, width: 0, points: [], fillPath: p.fillPath });
            schedule();
            return;
          }
          let s = strokesRef.current.get(p.id);
          if (!s) {
            s = { id: p.id, owner: p.owner, color: p.color, width: p.width, points: [] };
            strokesRef.current.set(p.id, s);
          }
          s.points.push(...p.pts);
          const last = p.pts[p.pts.length - 1];
          if (last) cursorsRef.current[p.owner] = { x: last.x, y: last.y, t: Date.now() };
          schedule();
        })
        .on("broadcast", { event: "cursor" }, ({ payload }) => {
          const p = payload as { key: string; x: number; y: number };
          if (!isCurrent() || !p?.key) return;
          cursorsRef.current[p.key] = { x: p.x, y: p.y, t: Date.now() };
          schedule();
        })
        .on("broadcast", { event: "undo" }, ({ payload }) => {
          const p = payload as { id: string };
          strokesRef.current.delete(p?.id);
          schedule();
        })
        .on("broadcast", { event: "clear" }, ({ payload }) => {
          const p = payload as { owner: string };
          if (p?.owner === "*") strokesRef.current.clear();
          else for (const [id, s] of strokesRef.current) if (s.owner === p?.owner) strokesRef.current.delete(id);
          schedule();
        })
        .on("broadcast", { event: "sync-request" }, ({ payload }) => {
          if (!isCurrent() || !admittedRef.current) return;
          const from = (payload as { from: string })?.from;
          // The longest-standing member (other than the requester) answers.
          const responder = peersRef.current.find((p) => p.key !== from);
          if (!responder || responder.key !== me.key) return;
          let chunk: CStroke[] = [];
          let size = 0;
          const flushChunk = () => {
            if (chunk.length) void ch.send({ type: "broadcast", event: "sync-state", payload: { to: from, strokes: chunk } });
            chunk = [];
            size = 0;
          };
          for (const s of strokesRef.current.values()) {
            const len = s.points.length * 14 + 80;
            if (size + len > SYNC_CHUNK_CHARS) flushChunk();
            chunk.push(s);
            size += len;
          }
          flushChunk();
        })
        .on("broadcast", { event: "sync-state" }, ({ payload }) => {
          const p = payload as { to: string; strokes: CStroke[] };
          if (!isCurrent() || p?.to !== me.key) return;
          gotState = true;
          for (const s of p.strokes ?? []) {
            const have = strokesRef.current.get(s.id);
            if (!have || have.points.length < s.points.length) strokesRef.current.set(s.id, s);
          }
          schedule();
        })
        .subscribe((s) => {
          if (!isCurrent()) return;
          if (s === "SUBSCRIBED") {
            void ch.track({ ...meta, admitted: false });
          } else if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") {
            setStatus("error");
          }
        });
    };

    if (req.kind === "private") {
      open(`private-${req.code}`, PRIVATE_CAP, `Private room ${req.code}`);
    } else {
      open("public-1", PUBLIC_CAP, "Public room 1");
    }

    // Fade out cursors of people who've stopped moving.
    const prune = setInterval(() => {
      const now = Date.now();
      let changed = false;
      for (const [k, c] of Object.entries(cursorsRef.current)) {
        if (now - c.t > CURSOR_TTL_MS) {
          delete cursorsRef.current[k];
          changed = true;
        }
      }
      if (changed) schedule();
    }, 2000);

    return () => {
      disposed = true;
      clearInterval(prune);
      if (syncTimer) clearTimeout(syncTimer);
      const local = localRef.current;
      if (local?.timer) clearInterval(local.timer);
      localRef.current = null;
      closeChannel(channelRef.current);
      channelRef.current = null;
      admittedRef.current = false;
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reqKey, attempt]);

  // ── Drawing API ─────────────────────────────────────────────────────────
  const flushLocal = useCallback(
    (done = false) => {
      const local = localRef.current;
      const stroke = local ? strokesRef.current.get(local.id) : null;
      if (!local || !stroke) return;
      if (local.queue.length === 0 && !done) return;
      const pts = local.queue;
      local.queue = [];
      send("stroke", { id: stroke.id, owner: me.key, color: stroke.color, width: stroke.width, pts });
    },
    [me.key, send],
  );

  const begin = useCallback(
    (color: string, width: number, pt: Pt) => {
      if (!admittedRef.current) return;
      const prev = localRef.current;
      if (prev?.timer) clearInterval(prev.timer);
      counterRef.current += 1;
      const id = `${me.key.slice(0, 8)}-${counterRef.current}`;
      const p = { x: round1(pt.x), y: round1(pt.y) };
      strokesRef.current.set(id, { id, owner: me.key, color, width, points: [p] });
      localRef.current = { id, queue: [p], timer: setInterval(() => flushLocal(false), STROKE_FLUSH_MS) };
      schedule();
    },
    [flushLocal, me.key, schedule],
  );

  const extend = useCallback(
    (pt: Pt) => {
      const local = localRef.current;
      const stroke = local ? strokesRef.current.get(local.id) : null;
      if (!local || !stroke) return;
      const p = { x: round1(pt.x), y: round1(pt.y) };
      stroke.points.push(p);
      local.queue.push(p);
      schedule();
    },
    [schedule],
  );

  const end = useCallback(() => {
    const local = localRef.current;
    if (!local) return;
    if (local.timer) clearInterval(local.timer);
    flushLocal(true);
    localRef.current = null;
  }, [flushLocal]);

  const addFill = useCallback((color: string, fillPath: string) => {
    if (!admittedRef.current || !fillPath) return;
    if (localRef.current?.timer) clearInterval(localRef.current.timer);
    localRef.current = null;
    counterRef.current += 1;
    const id = `${me.key.slice(0, 8)}-${counterRef.current}`;
    const fill = { id, owner: me.key, color, width: 0, points: [] as Pt[], fillPath };
    strokesRef.current.set(id, fill);
    send("stroke", { id, owner: me.key, color, width: 0, pts: [], fillPath });
    schedule();
  }, [me.key, schedule, send]);

  const moveCursor = useCallback(
    (pt: Pt) => {
      if (localRef.current) return; // while drawing, stroke messages carry the cursor
      const now = Date.now();
      if (now - lastCursorSentRef.current < CURSOR_MS) return;
      lastCursorSentRef.current = now;
      send("cursor", { key: me.key, x: round1(pt.x), y: round1(pt.y) });
    },
    [me.key, send],
  );

  const undoMine = useCallback((): boolean => {
    let lastId: string | null = null;
    for (const s of strokesRef.current.values()) if (s.owner === me.key) lastId = s.id;
    if (!lastId) return false;
    strokesRef.current.delete(lastId);
    send("undo", { id: lastId });
    schedule();
    return true;
  }, [me.key, schedule, send]);

  const clearMine = useCallback(() => {
    for (const [id, s] of strokesRef.current) if (s.owner === me.key) strokesRef.current.delete(id);
    send("clear", { owner: me.key });
    schedule();
  }, [me.key, schedule, send]);

  const clearAll = useCallback(() => {
    strokesRef.current.clear();
    send("clear", { owner: "*" });
    schedule();
  }, [schedule, send]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const strokes = useMemo(() => Array.from(strokesRef.current.values()), [rev]);

  return {
    me,
    status,
    roomLabel,
    peers,
    cursors,
    strokes,
    notice,
    begin,
    extend,
    addFill,
    end,
    moveCursor,
    undoMine,
    clearMine,
    clearAll,
    retry,
  };
}
