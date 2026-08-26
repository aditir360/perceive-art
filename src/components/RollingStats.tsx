import { useEffect, useRef, useState } from "react";
import { Sparkles, Users, Eye, Zap } from "lucide-react";

interface RollingStatsProps {
  drawingCount: number | null | undefined;
}

function useCountUp(target: number | null | undefined, active: boolean, duration = 1500) {
  const [value, setValue] = useState(0);
  const frameRef = useRef<number | null>(null);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || target === null || target === undefined || startedRef.current) return;
    startedRef.current = true;

    const startTime = Date.now();
    const animate = () => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      const eased = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;
      setValue(Math.floor(eased * target));
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(animate);
      } else {
        setValue(target);
      }
    };
    frameRef.current = requestAnimationFrame(animate);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
  }, [active, target, duration]);

  return value;
}

export function RollingStats({ drawingCount }: RollingStatsProps) {
  const sectionRef = useRef<HTMLDivElement | null>(null);
  const [inView, setInView] = useState(false);

  // Only start counting once the section has actually scrolled into view,
  // and only once — re-scrolling past it shouldn't replay the animation.
  useEffect(() => {
    const el = sectionRef.current;
    if (!el || inView) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [inView]);

  const displayCount = useCountUp(drawingCount, inView, 1500);
  const displayReach = useCountUp(1000, inView, 2000);
  const displayViews = useCountUp(16000, inView, 2200);

  return (
    <div
      ref={sectionRef}
      className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-card to-accent/15 p-6 shadow-2xl shadow-primary/20 ring-1 ring-primary/20 backdrop-blur-sm sm:p-8"
    >
      <div className="relative mx-auto grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3 sm:gap-5">
        {/* Drawings Created */}
        <div className="group relative flex flex-col items-center overflow-hidden rounded-2xl bg-card p-5 text-center shadow-sm ring-1 ring-primary/15 transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[oklch(0.58_0.19_25)] to-[oklch(0.42_0.12_340)]" />
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/10 ring-1 ring-primary/20">
              <Sparkles className="h-4.5 w-4.5 text-primary" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Drawings
            </span>
          </div>
          <div className="mt-3.5">
            <div className="bg-gradient-to-br from-[oklch(0.42_0.19_25)] to-[oklch(0.34_0.1_340)] bg-clip-text text-4xl font-black leading-none tracking-tight text-transparent sm:text-5xl">
              {drawingCount === null || drawingCount === undefined ? "—" : displayCount.toLocaleString()}
            </div>
            <p className="mt-2 text-xs font-medium text-muted-foreground">created worldwide</p>
          </div>
        </div>

        {/* People Reached */}
        <div className="group relative flex flex-col items-center overflow-hidden rounded-2xl bg-card p-5 text-center shadow-sm ring-1 ring-accent/40 transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[oklch(0.5_0.09_320)] to-[oklch(0.38_0.06_30)]" />
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-accent/50 to-accent/25 ring-1 ring-accent/40">
              <Users className="h-4.5 w-4.5 text-accent-foreground" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Reach
            </span>
          </div>
          <div className="mt-3.5">
            <div className="bg-gradient-to-br from-[oklch(0.4_0.08_320)] to-[oklch(0.3_0.05_30)] bg-clip-text text-4xl font-black leading-none tracking-tight text-transparent sm:text-5xl">
              {displayReach.toLocaleString()}+
            </div>
            <p className="mt-2 text-xs font-medium text-muted-foreground">people impacted</p>
          </div>
        </div>

        {/* Social Media Views */}
        <div className="group relative flex flex-col items-center overflow-hidden rounded-2xl bg-card p-5 text-center shadow-sm ring-1 ring-secondary/50 transition-all hover:-translate-y-0.5 hover:shadow-lg sm:p-6">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-[oklch(0.62_0.16_35)] to-[oklch(0.46_0.12_10)]" />
          <div className="flex items-center gap-2.5">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[oklch(0.62_0.16_35)]/25 to-[oklch(0.62_0.16_35)]/10 ring-1 ring-[oklch(0.62_0.16_35)]/30">
              <Eye className="h-4.5 w-4.5 text-[oklch(0.5_0.14_25)]" />
            </div>
            <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Views
            </span>
          </div>
          <div className="mt-3.5">
            <div className="bg-gradient-to-br from-[oklch(0.5_0.14_35)] to-[oklch(0.38_0.1_10)] bg-clip-text text-4xl font-black leading-none tracking-tight text-transparent sm:text-5xl">
              {displayViews.toLocaleString()}+
            </div>
            <p className="mt-2 text-xs font-medium text-muted-foreground">on social media</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mx-auto mt-7 flex max-w-2xl items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-primary/15">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
            style={{
              width: drawingCount && drawingCount > 0 ? `${Math.min((displayCount / drawingCount) * 100, 100)}%` : "0%",
              transition: "width 0.1s ease-out",
            }}
          />
        </div>
        <Zap className="h-4 w-4 shrink-0 text-primary/70" />
      </div>
    </div>
  );
}
