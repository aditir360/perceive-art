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
    <div className="relative w-full overflow-hidden rounded-3xl bg-gradient-to-br from-primary/10 via-accent/10 to-secondary/10 p-8 shadow-xl ring-2 ring-primary/30 backdrop-blur-xl border border-primary/20">
      {/* Background animation elements */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-accent/20 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
      </div>

      <div className="relative z-10 grid grid-cols-2 gap-8">
        {/* Drawings Created */}
        <div className="group">
          <div className="relative rounded-3xl bg-gradient-to-br from-white/50 to-white/30 dark:from-slate-800/60 dark:to-slate-900/40 p-6 shadow-lg backdrop-blur-md border border-primary/30 transition-all duration-300 hover:shadow-xl hover:border-primary/50">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative z-10 flex items-center gap-2 mb-3">
              <div className="rounded-xl bg-gradient-to-br from-primary/30 to-primary/20 p-2.5 shadow-md">
                <Sparkles className="h-4 w-4 text-primary" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Drawings</span>
            </div>
            
            <div className="relative">
              <div className="text-4xl font-black bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-pulse">
                {drawingCount === null || drawingCount === undefined ? "—" : displayCount.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground/80 mt-1 font-medium">created worldwide</p>
            </div>
          </div>
        </div>

        {/* People Reached */}
        <div className="group">
          <div className="relative rounded-3xl bg-gradient-to-br from-white/50 to-white/30 dark:from-slate-800/60 dark:to-slate-900/40 p-6 shadow-lg backdrop-blur-md border border-accent/30 transition-all duration-300 hover:shadow-xl hover:border-accent/50">
            <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            
            <div className="relative z-10 flex items-center gap-2 mb-3">
              <div className="rounded-xl bg-gradient-to-br from-accent/30 to-accent/20 p-2.5 shadow-md">
                <Users className="h-4 w-4 text-accent" />
              </div>
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Reach</span>
            </div>
            
            <div className="relative">
              <div className="text-4xl font-black bg-gradient-to-r from-accent/75 via-secondary/75 to-accent/75 bg-clip-text text-transparent animate-pulse">
                {displayReach.toLocaleString()}+
              </div>
              <p className="text-xs text-muted-foreground/80 mt-1 font-medium">people impacted</p>
            </div>
          </div>
        </div>
      </div>

      {/* Animated progress bar */}
      <div className="relative z-10 mt-6 flex items-center gap-3">
        <div className="flex-1 h-2 bg-gradient-to-r from-primary/20 via-accent/20 to-secondary/20 rounded-full overflow-hidden backdrop-blur-sm border border-primary/30">
          <div 
            className="h-full bg-gradient-to-r from-primary via-accent to-secondary rounded-full shadow-lg shadow-primary/40"
            style={{
              width: drawingCount && drawingCount > 0 ? `${Math.min((displayCount / drawingCount) * 100, 100)}%` : "0%",
              transition: "width 0.1s ease-out",
              boxShadow: "0 0 20px rgba(var(--color-primary, 159, 106, 154), 0.6)",
            }}
          />
        </div>
        <Zap className="h-4 w-4 text-primary opacity-60 animate-pulse" />
      </div>

      {/* Sparkle accents */}
      <div className="absolute top-4 right-8 z-0 opacity-20">
        <Sparkles className="h-6 w-6 text-primary animate-spin" style={{ animationDuration: "4s" }} />
      </div>
    </div>
  );
}
