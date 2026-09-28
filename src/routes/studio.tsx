import { useCallback } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Sketchpad } from "@/components/Sketchpad";
import { SiteHeader } from "@/components/SiteHeader";
import { saveArtwork } from "@/lib/gallery-storage";
import {
  Heart,
  Palette,
  Mail,
  Instagram,
  Linkedin,
  Play,
  ArrowDown,
  Headphones,
  Move,
  PenLine,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/*
  ─────────────────────────────────────────────────────────────────────
  TUTORIAL VIDEO

  Paste your link between the quotes and it will show up.

  Works with:
  - YouTube link
  - Vimeo link
  - Direct video file, for example "/tutorial.mp4"
    placed in the /public folder

  Leave it empty to show the "coming soon" placeholder.
  ─────────────────────────────────────────────────────────────────────
*/
const TUTORIAL_VIDEO_URL = "";

function toEmbed(
  url: string,
): { kind: "iframe" | "file"; src: string } {
  try {
    const u = new URL(url, "https://perceive.local");
    const host = u.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      const id = u.pathname.slice(1);

      if (id) {
        return {
          kind: "iframe",
          src: `https://www.youtube-nocookie.com/embed/${id}`,
        };
      }
    }

    if (host.endsWith("youtube.com")) {
      const id =
        u.searchParams.get("v") ??
        u.pathname.split("/").filter(Boolean).pop();

      if (id) {
        return {
          kind: "iframe",
          src: `https://www.youtube-nocookie.com/embed/${id}`,
        };
      }
    }

    if (host.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();

      if (id) {
        return {
          kind: "iframe",
          src: `https://player.vimeo.com/video/${id}`,
        };
      }
    }
  } catch {
    // Fall through to a plain video file.
  }

  return {
    kind: "file",
    src: url,
  };
}

const TUTORIAL_STEPS = [
  {
    icon: Headphones,
    title: "Turn on sound",
    body: "Put on headphones and press S. You will hear a tone that follows your brush.",
  },
  {
    icon: Move,
    title: "Move around",
    body: "Left and right pans the sound. Up and down changes the pitch. Use the arrow keys or your mouse.",
  },
  {
    icon: PenLine,
    title: "Start drawing",
    body: "Press Space to start a line and Space again to stop. Try a new texture or color any time.",
  },
  {
    icon: Download,
    title: "Keep your art",
    body: "Export a swell paper SVG or a 3D print file, or send it to the gallery.",
  },
];

function TutorialVideo() {
  if (!TUTORIAL_VIDEO_URL) {
    return (
      <div className="relative mx-auto grid aspect-video w-full max-w-3xl place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary/25 via-card to-accent/25 ring-1 ring-primary/20">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute -left-10 -top-16 h-56 w-56 rounded-full bg-primary/25 blur-3xl" />
          <div className="absolute -bottom-16 -right-10 h-56 w-56 rounded-full bg-accent/30 blur-3xl" />
        </div>

        <div className="relative text-center">
          <span className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-card text-primary shadow-lg ring-1 ring-primary/20">
            <Play
              className="h-7 w-7 translate-x-0.5"
              fill="currentColor"
            />
          </span>

          <p className="mt-4 text-base font-semibold text-foreground">
            Tutorial video coming soon
          </p>

          <p className="mt-1 text-sm text-muted-foreground">
            Until then, the four steps below are all you need.
          </p>
        </div>
      </div>
    );
  }

  const { kind, src } = toEmbed(TUTORIAL_VIDEO_URL);

  return (
    <div className="mx-auto aspect-video w-full max-w-3xl overflow-hidden rounded-2xl bg-black shadow-lg ring-1 ring-primary/20">
      {kind === "iframe" ? (
        <iframe
          src={src}
          title="Perceive studio tutorial"
          className="h-full w-full"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
          allowFullScreen
        />
      ) : (
        <video
          src={src}
          controls
          playsInline
          preload="metadata"
          className="h-full w-full"
          aria-label="Perceive studio tutorial"
        />
      )}
    </div>
  );
}

export const Route = createFileRoute("/studio")({
  head: () => ({
    meta: [
      {
        title: "Studio — Perceive",
      },
      {
        name: "description",
        content:
          "Draw with sound in the Perceive studio. Pitch, pan, and rhythm become your canvas, then export to swell paper or a 3D print.",
      },
      {
        property: "og:title",
        content: "Studio — Perceive",
      },
      {
        property: "og:description",
        content:
          "Draw with sound in the Perceive studio. Pitch, pan, and rhythm become your canvas, then export to swell paper or a 3D print.",
      },
      {
        property: "og:type",
        content: "website",
      },
    ],
  }),
  component: StudioPage,
});

function StudioPage() {
  const handlePost = useCallback(
    async ({ svg }: { svg: string }) => {
      await saveArtwork(svg);
    },
    [],
  );

  return (
    <div className="min-h-screen">
      {/* Soft blush background glows */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-32 -top-40 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute -right-32 top-1/3 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-secondary/30 blur-3xl" />
      </div>

      <SiteHeader wide />

      <main className="mx-auto max-w-7xl px-6 pb-20 pt-8 sm:pt-10">
        {/* Tutorial */}
        <section
          aria-labelledby="tutorial-heading"
          className="mx-auto mb-12 w-full max-w-4xl rounded-3xl bg-gradient-to-br from-primary/10 via-card/80 to-accent/10 p-5 shadow-sm ring-1 ring-primary/15 sm:p-8"
        >
          <div className="text-center">
            {/* Tutorial label */}
            <div className="mb-6 flex justify-center">
              <span className="inline-flex items-center gap-2 rounded-full bg-card px-3.5 py-1.5 text-xs font-medium text-primary shadow-sm ring-1 ring-primary/20">
                <Play className="h-3.5 w-3.5" />
                Tutorial
              </span>
            </div>

            {/* Demo video */}
            <TutorialVideo />

            {/* Heading + description */}
            <div className="mx-auto mt-7 max-w-2xl">
              <h1
                id="tutorial-heading"
                className="text-3xl font-bold tracking-tight sm:text-4xl"
              >
                New here? Start with this.
              </h1>

              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                A quick walkthrough of how to draw with sound. It works with
                or without a screen.
              </p>
            </div>

            {/* Tutorial steps */}
            <ol className="mx-auto mt-7 grid max-w-2xl gap-3 text-left sm:grid-cols-2">
              {TUTORIAL_STEPS.map(
                ({ icon: Icon, title, body }, i) => (
                  <li
                    key={title}
                    className="flex items-start gap-3 rounded-2xl bg-card/80 p-4 ring-1 ring-primary/10 transition-colors hover:bg-card"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/15">
                      <Icon className="h-5 w-5" />
                    </span>

                    <div>
                      <p className="text-sm font-semibold text-foreground">
                        {i + 1}. {title}
                      </p>

                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {body}
                      </p>
                    </div>
                  </li>
                ),
              )}
            </ol>

            {/* Skip button */}
            <Button
              asChild
              size="lg"
              variant="outline"
              className="mt-7 h-11 rounded-full px-6 text-sm"
            >
              <a href="#studio" className="gap-2">
                Skip to the canvas
                <ArrowDown className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </section>

        {/* Studio */}
        <section
          id="studio"
          aria-labelledby="studio-heading"
          className="scroll-mt-28"
        >
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 rounded-3xl bg-gradient-to-br from-primary/10 via-transparent to-accent/10 p-6 ring-1 ring-primary/10 sm:p-8">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-card px-3 py-1 text-xs font-medium text-primary shadow-sm ring-1 ring-primary/20">
                <Palette className="h-3.5 w-3.5" />
                Live audio canvas
              </span>

              <h2
                id="studio-heading"
                className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl"
              >
                The Studio
              </h2>

              <p className="mt-2 max-w-xl text-sm text-muted-foreground">
                Turn on sound, pick a color, and start a line. Every move
                plays back to you.
              </p>
            </div>
          </div>

          <Sketchpad onPost={handlePost} />
        </section>
      </main>

      <footer className="border-t border-primary/10 bg-card/50 py-8">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 text-xs text-muted-foreground sm:flex-row">
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

          <Link
            to="/gallery"
            className="font-medium text-primary underline-offset-2 hover:underline"
          >
            Browse the gallery
          </Link>
        </div>
      </footer>
    </div>
  );
}
