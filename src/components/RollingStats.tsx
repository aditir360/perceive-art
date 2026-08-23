import { useEffect, useRef, useState } from "react";
import { Sparkles, Users, Zap } from "lucide-react";

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

  return (
    <div
      ref={sectionRef}
      className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 shadow-sm ring-1 ring-primary/20 sm:p-8"
    >
      <div className="relative mx-auto grid max-w-xl grid-cols-2 gap-4 sm:gap-6">
        {/* Drawings Created */}
        <div className="flex flex-col items-center rounded-2xl bg-card p-5 text-center shadow-sm ring-1 ring-primary/15 transition-shadow hover:shadow-md sm:p-6">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Drawings
            </span>
          </div>
          <div className="mt-3">
            <div className="bg-gradient-to-br from-[oklch(0.42_0.19_10)] to-[oklch(0.32_0.13_340)] bg-clip-text text-4xl font-black leading-none text-transparent sm:text-5xl">
              {drawingCount === null || drawingCount === undefined ? "—" : displayCount.toLocaleString()}
            </div>
            <p className="mt-1.5 text-xs font-medium text-muted-foreground">created worldwide</p>
          </div>
        </div>

        {/* People Reached */}
        <div className="flex flex-col items-center rounded-2xl bg-card p-5 text-center shadow-sm ring-1 ring-accent/40 transition-shadow hover:shadow-md sm:p-6">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/40">
              <Users className="h-4 w-4 text-accent-foreground" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reach
            </span>
          </div>
          <div className="mt-3">
            <div className="bg-gradient-to-br from-[oklch(0.38_0.12_300)] to-[oklch(0.3_0.1_260)] bg-clip-text text-4xl font-black leading-none text-transparent sm:text-5xl">
              {displayReach.toLocaleString()}+
            </div>
            <p className="mt-1.5 text-xs font-medium text-muted-foreground">people impacted</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mx-auto mt-6 flex max-w-xl items-center gap-3">
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
