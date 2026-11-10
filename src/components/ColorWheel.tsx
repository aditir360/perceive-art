import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";

/* ── colour maths ─────────────────────────────────────────────────────────── */
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  let h = 0;
  if (d) {
    if (max === r) h = 60 * (((g - b) / d) % 6);
    else if (max === g) h = 60 * ((b - r) / d + 2);
    else h = 60 * ((r - g) / d + 4);
  }
  if (h < 0) h += 360;
  return [h, max ? d / max : 0, max];
}
const toHex = (r: number, g: number, b: number) =>
  "#" + [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
function parseHex(input: string): string | null {
  let t = input.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(t)) t = t.split("").map((c) => c + c).join("");
  return /^[0-9a-fA-F]{6}$/.test(t) ? "#" + t.toLowerCase() : null;
}
function hexToHsv(hex: string): [number, number, number] | null {
  const p = parseHex(hex);
  if (!p) return null;
  return rgbToHsv(parseInt(p.slice(1, 3), 16), parseInt(p.slice(3, 5), 16), parseInt(p.slice(5, 7), 16));
}

const SIZE = 168;

interface ColorWheelProps {
  /** Current colour as a hex string. */
  value: string;
  /** Called with a lowercase #rrggbb string whenever the user picks a colour. */
  onChange: (hex: string) => void;
  /** Start expanded. */
  defaultOpen?: boolean;
}

export function ColorWheel({ value, onChange, defaultOpen = false }: ColorWheelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(value) ?? [0, 0, 0]);
  const [hexText, setHexText] = useState(value);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const dragging = useRef(false);
  const lastEmitted = useRef(value.toLowerCase());

  // Sync from outside (swatch click, cycling) without losing hue on greys/black.
  useEffect(() => {
    const v = value.toLowerCase();
    if (v === lastEmitted.current) return;
    lastEmitted.current = v;
    const next = hexToHsv(v);
    if (!next) return;
    setHsv((prev) => [next[1] === 0 || next[2] === 0 ? prev[0] : next[0], next[1], next[2]]);
    setHexText(v);
  }, [value]);

  const emit = useCallback(
    (h: number, s: number, v: number) => {
      const hex = toHex(...hsvToRgb(h, s, v));
      setHsv([h, s, v]);
      setHexText(hex);
      lastEmitted.current = hex;
      onChange(hex);
    },
    [onChange],
  );

  // Draw wheel (hue by angle, saturation by radius, dimmed by brightness).
  useEffect(() => {
    if (!open) return;
    const cv = canvasRef.current;
    if (!cv) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const px = SIZE * dpr;
    if (cv.width !== px) { cv.width = px; cv.height = px; }
    const ctx = cv.getContext("2d");
    if (!ctx) return;
    const img = ctx.createImageData(px, px);
    const r0 = px / 2;
    const val = hsv[2];
    for (let y = 0; y < px; y++) {
      for (let x = 0; x < px; x++) {
        const dx = x - r0 + 0.5, dy = y - r0 + 0.5;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const i = (y * px + x) * 4;
        if (dist > r0) { img.data[i + 3] = 0; continue; }
        let h = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (h < 0) h += 360;
        const [r, g, b] = hsvToRgb(h, Math.min(1, dist / r0), val);
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b;
        img.data[i + 3] = dist > r0 - 1 ? 180 : 255;
      }
    }
    ctx.putImageData(img, 0, 0);
  }, [open, hsv[2]]); // eslint-disable-line react-hooks/exhaustive-deps

  const pick = (e: React.PointerEvent) => {
    const cv = canvasRef.current;
    if (!cv) return;
    const rect = cv.getBoundingClientRect();
    const rad = rect.width / 2;
    const dx = e.clientX - rect.left - rad;
    const dy = e.clientY - rect.top - rad;
    let h = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (h < 0) h += 360;
    const s = Math.min(1, Math.sqrt(dx * dx + dy * dy) / rad);
    emit(h, s, hsv[2] === 0 ? 1 : hsv[2]);
  };

  const commitHex = () => {
    const p = parseHex(hexText);
    if (!p) { setHexText(toHex(...hsvToRgb(...hsv))); return; }
    const next = hexToHsv(p)!;
    setHsv((prev) => [next[1] === 0 || next[2] === 0 ? prev[0] : next[0], next[1], next[2]]);
    setHexText(p);
    lastEmitted.current = p;
    onChange(p);
  };

  const current = toHex(...hsvToRgb(...hsv));
  const markerR = hsv[1] * (SIZE / 2);
  const mx = SIZE / 2 + Math.cos((hsv[0] * Math.PI) / 180) * markerR;
  const my = SIZE / 2 + Math.sin((hsv[0] * Math.PI) / 180) * markerR;
  const stop = (e: React.KeyboardEvent) => e.stopPropagation();

  return (
    <div className="mt-4 rounded-xl border border-border/60 bg-card/40">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="color-wheel-panel"
        className="flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-2">
          <span
            aria-hidden
            className="inline-block h-4 w-4 rounded-full ring-1 ring-border"
            style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }}
          />
          Custom color
        </span>
        <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div id="color-wheel-panel" className="space-y-3 px-3 pb-3" onKeyDown={stop}>
          <div className="flex justify-center">
            <div className="relative touch-none select-none" style={{ width: SIZE, height: SIZE }}>
              <canvas
                ref={canvasRef}
                aria-hidden
                className="cursor-crosshair rounded-full"
                style={{ width: SIZE, height: SIZE }}
                onPointerDown={(e) => {
                  dragging.current = true;
                  (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
                  pick(e);
                }}
                onPointerMove={(e) => { if (dragging.current) pick(e); }}
                onPointerUp={() => { dragging.current = false; }}
                onPointerCancel={() => { dragging.current = false; }}
              />
              <span
                aria-hidden
                className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.6)]"
                style={{ left: mx, top: my, backgroundColor: current }}
              />
            </div>
          </div>

          <Slider
            label="Hue"
            min={0} max={360} value={Math.round(hsv[0])}
            onChange={(n) => emit(n, hsv[1], hsv[2] === 0 ? 1 : hsv[2])}
            track="linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)"
          />
          <Slider
            label="Saturation"
            min={0} max={100} value={Math.round(hsv[1] * 100)}
            onChange={(n) => emit(hsv[0], n / 100, hsv[2] === 0 ? 1 : hsv[2])}
            track={`linear-gradient(to right, ${toHex(...hsvToRgb(hsv[0], 0, Math.max(hsv[2], 0.3)))}, ${toHex(...hsvToRgb(hsv[0], 1, Math.max(hsv[2], 0.3)))})`}
          />
          <Slider
            label="Brightness"
            min={0} max={100} value={Math.round(hsv[2] * 100)}
            onChange={(n) => emit(hsv[0], hsv[1], n / 100)}
            track={`linear-gradient(to right, #000, ${toHex(...hsvToRgb(hsv[0], hsv[1], 1))})`}
          />

          <div className="flex items-center gap-2">
            <span
              aria-hidden
              className="h-9 w-9 shrink-0 rounded-lg ring-1 ring-border"
              style={{ backgroundColor: current }}
            />
            <label className="sr-only" htmlFor="color-hex-input">Hex color</label>
            <input
              id="color-hex-input"
              value={hexText}
              onChange={(e) => setHexText(e.target.value)}
              onBlur={commitHex}
              onKeyDown={(e) => { e.stopPropagation(); if (e.key === "Enter") { e.preventDefault(); commitHex(); } }}
              maxLength={7}
              spellCheck={false}
              autoComplete="off"
              placeholder="#a855f7"
              className="h-9 w-full rounded-lg border border-border bg-background px-3 font-mono text-sm uppercase tracking-wider focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Slider({
  label, min, max, value, onChange, track,
}: {
  label: string; min: number; max: number; value: number; onChange: (n: number) => void; track: string;
}) {
  return (
    <label className="block">
      <span className="flex justify-between text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}<span className="font-mono normal-case tracking-normal">{value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 h-2.5 w-full cursor-pointer appearance-none rounded-full ring-1 ring-border accent-foreground"
        style={{ background: track }}
      />
    </label>
  );
}

export default ColorWheel;
