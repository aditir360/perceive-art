import { supabase } from "@/lib/supabase";

const DEVICE_ID_KEY = "perceive:device-id";

export type GalleryArtwork = {
  id: number;
  svg: string;
  authorId: string;
  createdAt: number;
};

function makeDeviceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Anonymous, stable ID for this browser. Used only for the "Mine" filter. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";

  let id = window.localStorage.getItem(DEVICE_ID_KEY);

  if (!id) {
    id = makeDeviceId();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }

  return id;
}

/** Gets only artwork that has been approved by the Perceive reviewer. */
export async function getArtworks(): Promise<GalleryArtwork[]> {
  const { data, error } = await supabase
    .from("artworks")
    .select("id, svg, author_id, created_at")
    .eq("status", "approved")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to load gallery:", error);
    throw error;
  }

  return (data ?? []).map((row) => ({
    id: row.id,
    svg: row.svg,
    authorId: row.author_id,
    createdAt: new Date(row.created_at).getTime(),
  }));
}

/**
 * Submits artwork for moderation.
 * New artwork is ALWAYS inserted as pending.
 */
export async function saveArtwork(svg: string): Promise<GalleryArtwork> {
  const authorId = getDeviceId();

  const { data, error } = await supabase
    .from("artworks")
    .insert({
      svg,
      author_id: authorId,
      status: "pending",
    })
    .select("id, svg, author_id, created_at")
    .single();

  if (error) {
    console.error("Failed to submit artwork:", error);
    throw error;
  }

  return {
    id: data.id,
    svg: data.svg,
    authorId: data.author_id,
    createdAt: new Date(data.created_at).getTime(),
  };
}
