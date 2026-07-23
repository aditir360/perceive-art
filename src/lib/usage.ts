import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STAT = "canvas_clicks";

let pending = 0;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

async function flush() {
  flushTimer = null;
  const n = pending;
  if (n <= 0) return;
  pending = 0;
  const { error } = await supabase.rpc("increment_stat", { _name: STAT, _by: n });
  if (error) {
    // put them back so we don't lose the count on transient failure
    pending += n;
    console.warn("[usage] failed to flush", error);
  }
}

/** Fire-and-forget: increments the global site counter, batched every 1.5s. */
export function trackClick() {
  if (typeof window === "undefined") return;
  pending += 1;
  if (flushTimer == null) flushTimer = setTimeout(flush, 1500);
}

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    if (pending > 0) flush();
  });
}

/** Reads the current global click count, refreshing every 10s. */
export function useCanvasClicks() {
  const query = useQuery({
    queryKey: ["site_stats", STAT],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("site_stats")
        .select("count")
        .eq("name", STAT)
        .maybeSingle();
      if (error) throw error;
      return Number(data?.count ?? 0);
    },
    refetchInterval: 10_000,
  });
  // start counter live from mount even without interactions
  const mounted = useRef(false);
  useEffect(() => { mounted.current = true; }, []);
  return query;
}