import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

/**
 * Reads the current number of approved drawings.
 * The count comes directly from the artworks table,
 * so it stays in sync with the public gallery.
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
