// ── Gallery storage ──────────────────────────────────────────────────────
// Shared by the "/" route (Studio, where artwork is made) and the
// "/gallery" route (where it's displayed). Deliberately lives outside
// src/routes/ — route files are meant to mostly just export `Route`, and
// having one route import another can confuse the file-based router's
// route-tree crawler at build time and drag an entire other page's
// dependencies into the wrong chunk.
//
// NOTE: this is a localStorage-backed store, so posted art currently only
// persists per-browser/device — it is not yet synced to a real server, so
// "everyone around the world" seeing it only holds true for people sharing
// this browser profile. The function names/shapes below are written so they
// can be swapped for real API calls later without touching gallery.tsx or
// Sketchpad.tsx.

const GALLERY_STORAGE_KEY = "perceive:gallery-artworks";
const DEVICE_ID_KEY = "perceive:device-id";

export type GalleryArtwork = {
  id: string;
  svg: string;
  authorId: string;
  createdAt: number;
};

function makeId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/** A stable, anonymous per-browser id — no account required. Used only to
 * tell "posted by me" apart from everyone else's work in the gallery filter. */
export function getDeviceId(): string {
  if (typeof window === "undefined") return "server";
  let id = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = makeId();
    window.localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

/** All posted artwork, newest first. Safe to call during SSR (returns []). */
export function getArtworks(): GalleryArtwork[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(GALLERY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as GalleryArtwork[];
    return Array.isArray(parsed) ? parsed.sort((a, b) => b.createdAt - a.createdAt) : [];
  } catch {
    return [];
  }
}

/** Persists a new piece of artwork and returns the saved record. */
export function saveArtwork(svg: string): GalleryArtwork {
  const artwork: GalleryArtwork = {
    id: makeId(),
    svg,
    authorId: getDeviceId(),
    createdAt: Date.now(),
  };
  if (typeof window !== "undefined") {
    const next = [artwork, ...getArtworks()];
    window.localStorage.setItem(GALLERY_STORAGE_KEY, JSON.stringify(next));
  }
  return artwork;
}
