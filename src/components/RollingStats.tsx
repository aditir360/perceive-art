import { useEffect, useRef, useState } from "react";
import { Sparkles, Users, Eye, Zap, ArrowUpRight } from "lucide-react";

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
  const displayViews = useCountUp(20000, inView, 2200);

  return (
    <div
      ref={sectionRef}
      className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-card/70 to-accent/20 p-1.5 shadow-2xl shadow-primary/25 ring-1 ring-white/40 backdrop-blur-xl sm:p-2"
    >
      <div className="relative flex flex-col divide-y divide-white/40 overflow-hidden rounded-[1.35rem] sm:flex-row sm:divide-x sm:divide-y-0">
        {/* Drawings Created */}
        <div className="group relative flex flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary/25 via-primary/10 to-transparent p-6 backdrop-blur-md sm:p-7">
          <div className="flex items-center justify-between">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-card/60 ring-1 ring-white/50 backdrop-blur-sm">
              <Sparkles className="h-5 w-5 text-primary" />
            </div>
            <span className="flex items-center gap-1 rounded-full bg-card/60 px-2.5 py-1 text-[10px] font-bold text-primary ring-1 ring-white/50 backdrop-blur-sm">
              <ArrowUpRight className="h-3 w-3" /> Live
            </span>
          </div>
          <div className="mt-8">
            <div className="text-4xl font-black leading-none tracking-tight text-foreground sm:text-5xl">
              {drawingCount === null || drawingCount === undefined ? "—" : displayCount.toLocaleString()}
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/40 pt-3">
              <span className="text-xs font-bold uppercase tracking-widest text-foreground/70">Drawings</span>
              <span className="text-xs font-medium text-muted-foreground">created worldwide</span>
            </div>
          </div>
        </div>

        {/* People Reached */}
        <div className="group relative flex flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-accent/30 via-accent/10 to-transparent p-6 backdrop-blur-md sm:p-7">
          <div className="flex items-center justify-between">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-card/60 ring-1 ring-white/50 backdrop-blur-sm">
              <Users className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="rounded-full bg-card/60 px-2.5 py-1 text-[10px] font-bold text-accent-foreground ring-1 ring-white/50 backdrop-blur-sm">
              +9.4% MoM
            </span>
          </div>
          <div className="mt-8">
            <div className="text-4xl font-black leading-none tracking-tight text-foreground sm:text-5xl">
              {displayReach.toLocaleString()}+
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/40 pt-3">
              <span className="text-xs font-bold uppercase tracking-widest text-foreground/70">Reach</span>
              <span className="text-xs font-medium text-muted-foreground">people impacted</span>
            </div>
          </div>
        </div>

        {/* Social Media Views */}
        <div className="group relative flex flex-1 flex-col justify-between overflow-hidden bg-gradient-to-br from-secondary/40 via-secondary/15 to-transparent p-6 backdrop-blur-md sm:p-7">
          <div className="flex items-center justify-between">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-card/60 ring-1 ring-white/50 backdrop-blur-sm">
              <Eye className="h-5 w-5 text-secondary-foreground" />
            </div>
            <span className="rounded-full bg-card/60 px-2.5 py-1 text-[10px] font-bold text-primary ring-1 ring-white/50 backdrop-blur-sm">
              +2.1k this week
            </span>
          </div>
          <div className="mt-8">
            <div className="text-4xl font-black leading-none tracking-tight text-foreground sm:text-5xl">
              {displayViews.toLocaleString()}+
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-white/40 pt-3">
              <span className="text-xs font-bold uppercase tracking-widest text-foreground/70">Views</span>
              <span className="text-xs font-medium text-muted-foreground">on social media</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mx-auto flex items-center gap-3 px-5 py-4 sm:px-6">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-card/50">
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
