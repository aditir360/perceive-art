import { useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Sketchpad } from "@/components/Sketchpad";
import { SiteHeader } from "@/components/SiteHeader";
import { saveArtwork } from "@/lib/gallery-storage";
import { Heart, Palette, Mail, Instagram, Linkedin } from "lucide-react";

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      { title: "Studio — Perceive" },
      { name: "description", content: "Draw with sound in the Perceive studio. Pitch, pan, and rhythm become your canvas, then export to swell paper or a 3D print." },
      { property: "og:title", content: "Studio — Perceive" },
      { property: "og:description", content: "Draw with sound in the Perceive studio. Pitch, pan, and rhythm become your canvas, then export to swell paper or a 3D print." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: StudioPage,
});

function StudioPage() {
  const handlePost = useCallback(async ({ svg }: { svg: string }) => {
    await saveArtwork(svg);
  }, []);

  return (
    <div className="min-h-screen">
      {/* Soft blush background glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-secondary/30 blur-3xl" />
      </div>

      <SiteHeader />

      <main id="studio" className="mx-auto max-w-6xl px-6 pb-20 pt-8 sm:pt-10">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-accent/10 p-6 ring-1 ring-primary/10 sm:p-8">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-medium text-primary shadow-sm ring-1 ring-primary/20">
              <Palette className="h-3.5 w-3.5" /> Live audio canvas
            </span>
            <h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">The Studio</h1>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Turn on sound, pick a color, and start a line. Every move plays back to you.
            </p>
          </div>
        </div>
        <div>
          <Sketchpad onPost={handlePost} />
        </div>
      </main>

      <footer className="border-t border-primary/10 bg-card/50 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <Heart className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span>Made with care for accessible creativity.</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="mailto:contact.perceive.art@gmail.com"
              aria-label="Email Perceive"
              className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
            >
              <Mail className="h-4 w-4" />
            </a>
            <a
              href="https://www.instagram.com/perceive.art_/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Perceive on Instagram"
              className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
            >
              <Instagram className="h-4 w-4" />
            </a>
            <a
              href="https://www.linkedin.com/company/perceive-art/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Perceive on LinkedIn"
              className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
            >
              <Linkedin className="h-4 w-4" />
            </a>
          </div>
          <Link to="/gallery" className="font-medium text-primary underline-offset-2 hover:underline">
            Browse the gallery
          </Link>
        </div>
      </footer>
    </div>
  );
}
