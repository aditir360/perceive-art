import { useEffect, useRef, useState } from "react";
import { Sparkles, Users, Heart } from "lucide-react";

interface RollingStatsProps {
  drawingCount: number | null | undefined;
}

interface TilePosition {
  id: string;
  x: number;
  y: number;
}

const TILE_POSITIONS: TilePosition[] = [
  { id: "drawings", x: 15, y: 30 },
  { id: "reach", x: 85, y: 25 },
  { id: "heart", x: 50, y: 65 },
  { id: "free", x: 30, y: 75 },
];

export function RollingStats({ drawingCount }: RollingStatsProps) {
  const [displayCount, setDisplayCount] = useState(0);
  const [displayReach, setDisplayReach] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);
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
    <div className="relative w-full aspect-video max-w-4xl mx-auto rounded-3xl overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5" />
      
      {/* SVG for connecting lines */}
      <svg
        ref={svgRef}
        className="absolute inset-0 w-full h-full"
        style={{ filter: "drop-shadow(0 0 20px rgba(159, 106, 154, 0.3))" }}
      >
        <defs>
          <linearGradient id="lineGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="rgb(var(--color-primary))" stopOpacity="0.4" />
            <stop offset="50%" stopColor="rgb(var(--color-accent))" stopOpacity="0.6" />
            <stop offset="100%" stopColor="rgb(var(--color-secondary))" stopOpacity="0.4" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Connecting lines - creating constellation pattern */}
        <line x1="15%" y1="30%" x2="85%" y2="25%" stroke="url(#lineGradient)" strokeWidth="2" filter="url(#glow)" opacity="0.5" />
        <line x1="85%" y1="25%" x2="50%" y2="65%" stroke="url(#lineGradient)" strokeWidth="2" filter="url(#glow)" opacity="0.5" />
        <line x1="50%" y1="65%" x2="30%" y2="75%" stroke="url(#lineGradient)" strokeWidth="2" filter="url(#glow)" opacity="0.5" />
        <line x1="30%" y1="75%" x2="15%" y2="30%" stroke="url(#lineGradient)" strokeWidth="2" filter="url(#glow)" opacity="0.5" />
        <line x1="15%" y1="30%" x2="50%" y2="65%" stroke="url(#lineGradient)" strokeWidth="1.5" filter="url(#glow)" opacity="0.3" />
        
        {/* Connection nodes */}
        <circle cx="15%" cy="30%" r="4" fill="url(#lineGradient)" opacity="0.6" />
        <circle cx="85%" cy="25%" r="4" fill="url(#lineGradient)" opacity="0.6" />
        <circle cx="50%" cy="65%" r="4" fill="url(#lineGradient)" opacity="0.6" />
        <circle cx="30%" cy="75%" r="4" fill="url(#lineGradient)" opacity="0.6" />
      </svg>

      {/* Floating metric tiles */}
      <div className="absolute inset-0 w-full h-full pointer-events-none">
        {/* Drawings - Top Left */}
        <div className="absolute top-[30%] left-[15%] -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative rounded-2xl bg-gradient-to-br from-white/30 to-white/10 dark:from-slate-800/50 dark:to-slate-900/30 backdrop-blur-xl border border-primary/40 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110">
              <div className="text-center">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Drawings</p>
                <p className="text-3xl font-black bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {displayCount}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Reach - Top Right */}
        <div className="absolute top-[25%] right-[15%] translate-x-1/2 -translate-y-1/2 pointer-events-auto">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/40 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative rounded-2xl bg-gradient-to-br from-white/30 to-white/10 dark:from-slate-800/50 dark:to-slate-900/30 backdrop-blur-xl border border-accent/40 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110">
              <div className="text-center">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Reach</p>
                <p className="text-3xl font-black bg-gradient-to-r from-accent to-secondary bg-clip-text text-transparent">
                  {displayReach}+
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Heart - Bottom Center */}
        <div className="absolute bottom-[35%] left-1/2 -translate-x-1/2 pointer-events-auto">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative rounded-2xl bg-gradient-to-br from-white/30 to-white/10 dark:from-slate-800/50 dark:to-slate-900/30 backdrop-blur-xl border border-primary/40 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110">
              <div className="text-center">
                <Heart className="h-8 w-8 text-primary mx-auto mb-2" />
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Accessible</p>
              </div>
            </div>
          </div>
        </div>

        {/* Free - Bottom Left */}
        <div className="absolute bottom-[25%] left-[30%] -translate-x-1/2 pointer-events-auto">
          <div className="group relative">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/40 to-transparent rounded-2xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative rounded-2xl bg-gradient-to-br from-white/30 to-white/10 dark:from-slate-800/50 dark:to-slate-900/30 backdrop-blur-xl border border-secondary/40 p-6 shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-110">
              <div className="text-center">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Forever</p>
                <p className="text-2xl font-black bg-gradient-to-r from-secondary to-primary bg-clip-text text-transparent">
                  100% Free
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
