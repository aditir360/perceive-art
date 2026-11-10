import { useCallback, useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

export const THEME_STORAGE_KEY = "perceive-theme";

type Theme = "light" | "dark";

/**
 * Runs before first paint (injected into <head> by the root route) so the
 * page never flashes the wrong theme. Uses the saved choice if there is one,
 * otherwise the visitor's system preference.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");var d=t?t==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;var r=document.documentElement;r.classList.toggle("dark",d);r.style.colorScheme=d?"dark":"light";}catch(e){}})();`;

function applyTheme(theme: Theme) {
  const root = document.documentElement;
  root.classList.toggle("dark", theme === "dark");
  root.style.colorScheme = theme;
}

function readTheme(): Theme {
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/**
 * Light/dark switch. The choice lives on <html> (so every page shares it
 * during navigation) and in localStorage (so it survives reloads and syncs
 * to other open tabs through the `storage` event).
 */
export function ThemeToggle({ className = "" }: { className?: string }) {
  // null until mounted, so server and first client render match.
  const [theme, setTheme] = useState<Theme | null>(null);

  useEffect(() => {
    setTheme(readTheme());
    // Enable colour transitions only after first paint.
    const raf = requestAnimationFrame(() =>
      document.documentElement.classList.add("theme-ready"),
    );

    const onStorage = (e: StorageEvent) => {
      if (e.key !== THEME_STORAGE_KEY) return;
      const next: Theme = e.newValue === "dark" ? "dark" : "light";
      applyTheme(next);
      setTheme(next);
    };
    window.addEventListener("storage", onStorage);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const toggle = useCallback(() => {
    const next: Theme = readTheme() === "dark" ? "light" : "dark";
    applyTheme(next);
    setTheme(next);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* private mode: the choice just won't persist */
    }
  }, []);

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      aria-label="Dark mode"
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`group relative inline-flex h-10 w-[4.5rem] shrink-0 items-center rounded-full bg-background/60 p-1 shadow-sm ring-1 ring-primary/20 transition-colors hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${className}`}
    >
      <Sun
        aria-hidden
        className={`absolute left-2.5 h-4 w-4 transition-opacity ${isDark ? "opacity-40" : "text-primary opacity-100"}`}
      />
      <Moon
        aria-hidden
        className={`absolute right-2.5 h-4 w-4 transition-opacity ${isDark ? "text-primary opacity-100" : "opacity-40"}`}
      />
      <span
        aria-hidden
        className={`pointer-events-none h-8 w-8 rounded-full bg-card shadow-md ring-1 ring-primary/25 transition-transform duration-200 ${isDark ? "translate-x-8" : "translate-x-0"}`}
      />
    </button>
  );
}
