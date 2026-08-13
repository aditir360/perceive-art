import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { SiteHeader } from "@/components/SiteHeader";
import { getArtworks, getDeviceId, type GalleryArtwork } from "@/routes/index";
import { Globe, Users, User, RefreshCw, Sparkles, Palette } from "lucide-react";

export const Route = createFileRoute("/gallery")({
  head: () => ({
    meta: [
      { title: "Gallery — Perceive" },
      { name: "description", content: "Artwork posted by the Perceive community — sonic-tactile drawings made to be heard and felt." },
      { property: "og:title", content: "Gallery — Perceive" },
      { property: "og:description", content: "Artwork posted by the Perceive community — sonic-tactile drawings made to be heard and felt." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: GalleryPage,
});

type Filter = "all" | "mine" | "others";

function formatRelativeTime(ts: number): string {
  const diffMs = Date.now() - ts;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} day${day === 1 ? "" : "s"} ago`;
  return new Date(ts).toLocaleDateString();
}

function GalleryPage() {
  const [artworks, setArtworks] = useState<GalleryArtwork[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [loaded, setLoaded] = useState(false);

  const refresh = () => {
    setArtworks(getArtworks());
    setDeviceId(getDeviceId());
    setLoaded(true);
  };

  // localStorage only exists client-side, so load after mount rather than
  // during render — avoids a server/client hydration mismatch.
  useEffect(() => {
    refresh();
  }, []);

  const visible = useMemo(() => {
    if (filter === "mine") return artworks.filter((a) => a.authorId === deviceId);
    if (filter === "others") return artworks.filter((a) => a.authorId !== deviceId);
    return artworks;
  }, [artworks, filter, deviceId]);

  const mineCount = useMemo(
    () => artworks.filter((a) => a.authorId === deviceId).length,
    [artworks, deviceId]
  );

  return (
    <div className="min-h-screen">
      {/* Soft blush background glows, matching the rest of the site */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-secondary/30 blur-3xl" />
      </div>

      <SiteHeader />

      <header className="mx-auto max-w-6xl px-6 pt-12 pb-6 text-center sm:pt-16">
        <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-xs font-medium text-primary shadow-sm ring-1 ring-primary/20">
          <Globe className="h-3.5 w-3.5" /> Made by the community
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
          The <span className="text-primary">Gallery</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Artwork posted from the Studio, made to be heard and felt as much as seen.
        </p>
      </header>

      {/* Filter + refresh */}
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-2 px-6 pb-2">
        <div
          role="group"
          aria-label="Filter gallery"
          className="inline-flex items-center gap-1 rounded-full bg-card p-1 shadow-sm ring-1 ring-primary/15"
        >
          <Button
            onClick={() => setFilter("all")}
            variant={filter === "all" ? "default" : "ghost"}
            aria-pressed={filter === "all"}
            size="sm"
            className="gap-1.5 rounded-full"
          >
            <Sparkles className="h-3.5 w-3.5" /> All
          </Button>
          <Button
            onClick={() => setFilter("mine")}
            variant={filter === "mine" ? "default" : "ghost"}
            aria-pressed={filter === "mine"}
            size="sm"
            className="gap-1.5 rounded-full"
          >
            <User className="h-3.5 w-3.5" /> Mine
          </Button>
          <Button
            onClick={() => setFilter("others")}
            variant={filter === "others" ? "default" : "ghost"}
            aria-pressed={filter === "others"}
            size="sm"
            className="gap-1.5 rounded-full"
          >
            <Users className="h-3.5 w-3.5" /> Everyone else's
          </Button>
        </div>
        <Button onClick={refresh} variant="outline" size="sm" className="gap-1.5 rounded-full">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <p className="mx-auto max-w-6xl px-6 pb-6 text-center text-xs text-muted-foreground">
        {loaded && `${artworks.length} posted in total`}
        {loaded && filter === "mine" && ` · ${mineCount} of them are yours`}
      </p>

      {/* Gallery grid */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        {!loaded ? (
          <p className="py-16 text-center text-sm text-muted-foreground">Loading gallery…</p>
        ) : visible.length === 0 ? (
          <div className="mx-auto max-w-md rounded-3xl bg-card p-8 text-center shadow-sm ring-1 ring-primary/15">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Palette className="h-6 w-6" />
            </div>
            <h2 className="mt-4 text-lg font-semibold">
              {filter === "mine"
                ? "You haven't posted anything yet"
                : filter === "others"
                ? "No one else has posted yet"
                : "The gallery is empty so far"}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {filter === "mine"
                ? "Head to the Studio, make something, and post it here."
                : "Be the first — head to the Studio and post your artwork."}
            </p>
            <Button asChild className="mt-5 rounded-full">
              <Link to="/#studio">Go to the Studio</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((art) => {
              const mine = art.authorId === deviceId;
              return (
                <article
                  key={art.id}
                  className="overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-primary/15 transition-all hover:-translate-y-1 hover:shadow-md"
                >
                  <div
                    className="aspect-[900/560] w-full bg-[oklch(0.98_0.02_15)] [&_svg]:h-full [&_svg]:w-full"
                    // Safe: this markup is generated by our own Sketchpad export, not
                    // arbitrary user-supplied HTML.
                    dangerouslySetInnerHTML={{ __html: art.svg }}
                  />
                  <div className="flex items-center justify-between gap-2 p-3 text-xs text-muted-foreground">
                    <span>{formatRelativeTime(art.createdAt)}</span>
                    {mine && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                        By you
                      </span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <footer className="border-t border-primary/10 bg-card/50 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-muted-foreground sm:flex-row">
          <span>© {new Date().getFullYear()} Perceive</span>
          <Link to="/" className="font-medium text-primary underline-offset-2 hover:underline">
            Back to the studio
          </Link>
        </div>
      </footer>
    </div>
  );
}
