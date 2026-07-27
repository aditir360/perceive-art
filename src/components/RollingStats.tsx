import { useEffect, useRef, useState } from "react";
import { Sparkles, Users, Zap } from "lucide-react";

interface RollingStatsProps {
  drawingCount: number | null | undefined;
}

export function RollingStats({ drawingCount }: RollingStatsProps) {
  const [displayCount, setDisplayCount] = useState(0);
  const [displayReach, setDisplayReach] = useState(0);
  const animationRef = useRef<number | null>(null);
  const reachAnimationRef = useRef<number | null>(null);
  const prevCountRef = useRef<number | null>(null);
  const reachAnimatedRef = useRef(false);

  // Animate drawings count
  useEffect(() => {
    if (drawingCount === null || drawingCount === undefined || drawingCount === prevCountRef.current) {
      return;
    }

    const startTime = Date.now();
    const duration = 1500;
    const previousValue = prevCountRef.current ?? 0;
    prevCountRef.current = drawingCount;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easeProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const current = Math.floor(previousValue + easeProgress * (drawingCount - previousValue));
      setDisplayCount(current);

      if (progress < 1) {
        animationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayCount(drawingCount);
      }
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [drawingCount]);

  // Animate reach count (0 to 300)
  useEffect(() => {
    if (reachAnimatedRef.current) return;
    reachAnimatedRef.current = true;

    const startTime = Date.now();
    const duration = 2000;
    const targetReach = 300;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      const easeProgress = progress < 0.5
        ? 4 * progress * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 3) / 2;

      const current = Math.floor(easeProgress * targetReach);
      setDisplayReach(current);

      if (progress < 1) {
        reachAnimationRef.current = requestAnimationFrame(animate);
      } else {
        setDisplayReach(targetReach);
      }
    };

    reachAnimationRef.current = requestAnimationFrame(animate);

    return () => {
      if (reachAnimationRef.current) {
        cancelAnimationFrame(reachAnimationRef.current);
      }
    };
  }, []);

  return (
    <div className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-card to-accent/10 p-6 shadow-sm ring-1 ring-primary/20 sm:p-8">
      <div className="relative grid grid-cols-2 gap-4 sm:gap-6">
        {/* Drawings Created */}
        <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-primary/15 transition-shadow hover:shadow-md sm:p-6">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/15">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Drawings
            </span>
          </div>
          <div className="mt-3">
            <div className="text-4xl font-black leading-none text-foreground sm:text-5xl">
              {drawingCount === null || drawingCount === undefined ? "—" : displayCount.toLocaleString()}
            </div>
            <p className="mt-1.5 text-xs font-medium text-muted-foreground">created worldwide</p>
          </div>
        </div>

        {/* People Reached */}
        <div className="rounded-2xl bg-card p-5 shadow-sm ring-1 ring-accent/40 transition-shadow hover:shadow-md sm:p-6">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-accent/40">
              <Users className="h-4 w-4 text-accent-foreground" />
            </div>
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Reach
            </span>
          </div>
          <div className="mt-3">
            <div className="text-4xl font-black leading-none text-foreground sm:text-5xl">
              {displayReach.toLocaleString()}+
            </div>
            <p className="mt-1.5 text-xs font-medium text-muted-foreground">people impacted</p>
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mt-6 flex items-center gap-3">
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
