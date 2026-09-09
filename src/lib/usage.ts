import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

const STAT = "canvas_clicks";

let pending = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  flushTimer = null;

  const n = pending;
  if (n <= 0) return;

  pending = 0;

  console.log("[usage] flushing", n, "canvas click(s)");

  const { data, error } = await supabase.rpc("increment_stat", {
    _name: STAT,
    _by: n,
  });

  if (error) {
    pending += n;
    console.error("[usage] failed to flush:", error);
    return;
  }

  console.log("[usage] counter updated:", data);
}

export function trackClick() {
  if (typeof window === "undefined") return;

  pending += 1;

  console.log("[usage] trackClick()", pending);

  if (flushTimer == null) {
    flushTimer = setTimeout(() => {
      void flush();
    }, 1500);
  }
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (pending > 0) {
      void flush();
    }
  });
}

export function useCanvasClicks() {
  const query = useQuery({
    queryKey: ["site_stats", STAT],

    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_stats")
        .select("count")
        .eq("name", STAT)
        .maybeSingle();

      if (error) {
        console.error("[usage] failed to read counter:", error);
        throw error;
      }

      return Number(data?.count ?? 0);
    },

    refetchInterval: 10_000,
  });

  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
  }, []);

  return query;
}
