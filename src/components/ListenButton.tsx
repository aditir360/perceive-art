import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Volume2, Square } from "lucide-react";

type Props = {
  text: string;
  label?: string;
  className?: string;
};

export function ListenButton({ text, label = "Listen", className }: Props) {
  const [speaking, setSpeaking] = useState(false);
  const utterRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    return () => {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const toggle = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.pitch = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    utterRef.current = u;
    synth.speak(u);
    setSpeaking(true);
  };

  return (
    <Button
      type="button"
      onClick={toggle}
      variant="secondary"
      size="sm"
      aria-pressed={speaking}
      aria-label={speaking ? `Stop listening to ${label}` : `Listen to ${label}`}
      className={`gap-2 rounded-full ${className ?? ""}`}
    >
      {speaking ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
      {speaking ? "Stop" : label}
    </Button>
  );
}

// ── HoverListen ──────────────────────────────────────────────────────────
// Wraps a block of visible text so the text itself is the "listen" control:
// hovering for a short dwell (default 1.3s) triggers speech automatically,
// with no separate button. Click and Enter/Space bypass the dwell and speak
// immediately — that keeps the block fully usable for touch and for
// keyboard/screen-reader users, who never get a hover event and shouldn't
// have audio auto-start on focus (that would fight with a real screen
// reader already narrating the page).
const DEFAULT_DWELL_MS = 1300; // within the requested 1–1.5s window

type HoverListenProps = {
  text: string;
  label?: string;
  children: ReactNode;
  className?: string;
  dwellMs?: number;
};

export function HoverListen({ text, label, children, className, dwellMs = DEFAULT_DWELL_MS }: HoverListenProps) {
  const [speaking, setSpeaking] = useState(false);
  const [pending, setPending] = useState(false);
  const dwellTimer = useRef<number | null>(null);

  const clearDwell = () => {
    if (dwellTimer.current !== null) {
      window.clearTimeout(dwellTimer.current);
      dwellTimer.current = null;
    }
    setPending(false);
  };

  const speak = () => {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1;
    u.pitch = 1;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    synth.speak(u);
    setSpeaking(true);
  };

  const stop = () => {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
  };

  useEffect(() => {
    return () => {
      clearDwell();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onMouseEnter = () => {
    if (speaking) return;
    clearDwell();
    setPending(true);
    dwellTimer.current = window.setTimeout(() => {
      dwellTimer.current = null;
      setPending(false);
      speak();
    }, dwellMs);
  };

  const onMouseLeave = () => {
    clearDwell();
  };

  const activateNow = () => {
    clearDwell();
    if (speaking) {
      stop();
    } else {
      speak();
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      activateNow();
    }
  };

  const describedLabel = label ? `Listen: ${label}` : "Listen to this section";

  return (
    <div
      role="button"
      tabIndex={0}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      onClick={activateNow}
      onKeyDown={onKeyDown}
      aria-pressed={speaking}
      aria-label={speaking ? `Stop — ${describedLabel}` : `${describedLabel}. Hover to listen, or press Enter.`}
      className={`group relative -m-2 cursor-pointer select-none rounded-2xl p-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-primary ${
        speaking
          ? "bg-primary/10 ring-1 ring-primary/40"
          : pending
          ? "bg-primary/5 ring-1 ring-primary/25"
          : "hover:bg-primary/5"
      } ${className ?? ""}`}
    >
      {children}
      <span
        aria-hidden
        className={`pointer-events-none absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary/15 text-primary transition-opacity duration-200 ${
          speaking
            ? "opacity-100"
            : pending
            ? "opacity-80"
            : "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60"
        }`}
      >
        {speaking ? <Square className="h-3 w-3" /> : <Volume2 className="h-3 w-3" />}
      </span>
    </div>
  );
}
