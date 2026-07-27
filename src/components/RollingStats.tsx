import { useEffect, useRef, useState } from "react";
import { Sparkles, Users } from "lucide-react";

interface RollingStatsProps {
  drawingCount: number | null | undefined;
}

export function RollingStats({ drawingCount }: RollingStatsProps) {
  const [displayCount, setDisplayCount] = useState(0);
  const animationRef = useRef<number | null>(null);
  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    // Only animate if we have a valid number and it's different from before
    if (drawingCount === null || drawingCount === undefined || drawingCount === prevCountRef.current) {
      return;
    }

    const startTime = Date.now();
    const duration = 1500; // 1.5 seconds animation
    const previousValue = prevCountRef.current ?? 0;
    prevCountRef.current = drawingCount;

    const animate = () => {
      const now = Date.now();
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function for faster start, slower end (ease-out)
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

  return (
    <div className="w-full rounded-3xl bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5 p-6 shadow-lg ring-1 ring-primary/20 backdrop-blur-sm border border-primary/10">
      <div className="grid grid-cols-2 gap-6">
        {/* Drawings Created */}
        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl bg-white/40 dark:bg-slate-800/40 p-4 backdrop-blur-md border border-primary/20">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-primary/20 p-2">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Drawings</span>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              {drawingCount === null || drawingCount === undefined ? "—" : displayCount.toLocaleString()}
            </div>
            <p className="text-[10px] text-muted-foreground/70">created worldwide</p>
          </div>
        </div>

        {/* People Reached */}
        <div className="flex flex-col items-center justify-center space-y-2 rounded-2xl bg-white/40 dark:bg-slate-800/40 p-4 backdrop-blur-md border border-accent/20">
          <div className="flex items-center gap-2">
            <div className="rounded-full bg-accent/20 p-2">
              <Users className="h-4 w-4 text-accent" />
            </div>
            <span className="text-xs font-medium text-muted-foreground">Reach</span>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
              300+
            </div>
            <p className="text-[10px] text-muted-foreground/70">people impacted</p>
          </div>
        </div>
      </div>

      {/* Animated bar beneath */}
      <div className="mt-4 flex items-center gap-2">
        <div className="flex-1 h-1 bg-gradient-to-r from-primary via-accent to-secondary rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-primary via-accent to-secondary rounded-full animate-pulse"
            style={{
              width: drawingCount && drawingCount > 0 ? `${Math.min((displayCount / drawingCount) * 100, 100)}%` : "0%",
              transition: "width 0.1s ease-out",
            }}
          />
        </div>
      </div>
    </div>
  );
}
