import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Tracks a canvas interaction locally.
 *
 * Kept for Sketchpad compatibility. The old implementation sent
 * these events to the removed site_stats/increment_stat system.
 */
export function trackClick() {
  // Intentionally left as a no-op.
  // Drawing count is now based directly on approved artworks.
}

/**
 * Reads the current number of approved drawings directly from
 * the artworks table.
 */
export function useCanvasClicks() {
  return useQuery({
    queryKey: ["artworks_count"],
    queryFn: async () => {
      const { count, error } = await supabase
        .from("artworks")
        .select("id", { count: "exact", head: true })
        .eq("status", "approved");

      if (error) {
        console.error("Failed to load artwork count:", error);
        throw error;
      }

      return count ?? 0;
    },
    refetchInterval: 10_000,
  });
}
