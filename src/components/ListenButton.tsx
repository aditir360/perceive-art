import { useEffect, useRef, useState } from "react";
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