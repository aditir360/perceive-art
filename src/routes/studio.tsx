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
  ArrowUpRight,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";

/*
  ─────────────────────────────────────────────────────────────────────
  TUTORIAL VIDEO

  Paste your link between the quotes.

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
    number: "01",
    icon: Headphones,
    title: "Turn on sound",
    body: "Put on headphones and press S. You will hear a tone that follows your brush.",
  },
  {
    number: "02",
    icon: Move,
    title: "Move around",
    body: "Left and right pans the sound. Up and down changes the pitch.",
  },
  {
    number: "03",
    icon: PenLine,
    title: "Start drawing",
    body: "Press Space to start a line and Space again to stop. Try different textures or colors.",
  },
  {
    number: "04",
    icon: Download,
    title: "Keep your art",
    body: "Export your work as swell paper SVG or a 3D print file, or send it to the gallery.",
  },
];

function TutorialVideo() {
  if (!TUTORIAL_VIDEO_URL) {
    return (
      <div className="relative mx-auto grid aspect-video w-full max-w-4xl place-items-center overflow-hidden rounded-[1.5rem] border border-primary/15 bg-card shadow-[0_20px_60px_-30px_hsl(var(--primary)/0.35)]">
        {/* subtle editorial background */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
        >
          <div className="absolute -left-24 -top-24 h-64 w-64 rounded-full bg-primary/10 blur-3xl" />
          <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-accent/15 blur-3xl" />

          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,hsl(var(--primary)/0.06),transparent_55%)]" />
        </div>

        <div className="relative z-10 px-6 text-center">
          <div className="mx-auto grid h-16 w-16 place-items-center rounded-full border border-primary/20 bg-background shadow-lg">
            <Play
              className="ml-0.5 h-7 w-7 text-primary"
              fill="currentColor"
            />
          </div>

          <p className="mt-5 text-base font-semibold tracking-tight text-foreground sm:text-lg">
            Tutorial video coming soon
          </p>

          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Until then, the four steps below are all you need to start
            creating.
          </p>
        </div>
      </div>
    );
  }

  const { kind, src } = toEmbed(TUTORIAL_VIDEO_URL);

  return (
    <div className="mx-auto aspect-video w-full max-w-4xl overflow-hidden rounded-[1.5rem] border border-primary/15 bg-black shadow-[0_20px_60px_-30px_hsl(var(--primary)/0.4)]">
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
    <div className="min-h-screen overflow-x-clip bg-background">
      {/* Background atmosphere */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 h-[32rem] w-[32rem] rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-40 top-[35%] h-[28rem] w-[28rem] rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-[40rem] -translate-x-1/2 rounded-full bg-secondary/15 blur-3xl" />
      </div>

      <SiteHeader wide />

      <main className="mx-auto w-full max-w-7xl min-w-0 px-4 pb-24 pt-8 sm:px-6 sm:pt-12 lg:px-8">
        {/* ─────────────────────────────────────────────────────────────
            INTRO / TUTORIAL
        ───────────────────────────────────────────────────────────── */}
        <section
          aria-labelledby="tutorial-heading"
          className="mx-auto w-full max-w-6xl min-w-0"
        >
          {/* Small editorial header */}
          <div className="mb-7 flex min-w-0 flex-col gap-4 sm:mb-9 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="mb-4 flex items-center gap-3">
                <span className="h-px w-8 shrink-0 bg-primary" />

                <span className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary sm:text-[11px]">
                  Getting started
                </span>
              </div>

              <h1
                id="tutorial-heading"
                className="max-w-3xl text-3xl font-black tracking-[-0.035em] text-foreground sm:text-4xl lg:text-5xl"
              >
                New here? Start with this.
              </h1>

              <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                A quick introduction to drawing with sound. You can use the
                Studio with or without a screen.
              </p>
            </div>

            <div className="hidden shrink-0 pb-1 text-right sm:block">
              <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/50">
                Perceive Studio
              </span>
              <p className="mt-1 text-xs text-muted-foreground/60">
                Hear · Draw · Feel
              </p>
            </div>
          </div>

          {/* Video */}
          <TutorialVideo />

          {/* Steps */}
          <ol className="mt-8 grid w-full min-w-0 grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
            {TUTORIAL_STEPS.map(
              ({ number, icon: Icon, title, body }) => (
                <li
                  key={number}
                  className="group min-w-0 rounded-2xl border border-primary/10 bg-card/70 p-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/20 hover:shadow-md"
                >
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-[10px] font-bold tracking-[0.2em] text-primary/60">
                      {number}
                    </span>

                    <Icon className="h-4 w-4 shrink-0 text-primary/60 transition-transform duration-300 group-hover:scale-110" />
                  </div>

                  <h2 className="mt-7 text-sm font-bold tracking-tight text-foreground">
                    {title}
                  </h2>

                  <p className="mt-2 text-xs leading-6 text-muted-foreground">
                    {body}
                  </p>
                </li>
              ),
            )}
          </ol>

          <div className="mt-7 flex justify-center">
            <Button
              asChild
              variant="ghost"
              className="h-10 rounded-full px-5 text-sm font-medium text-muted-foreground hover:bg-primary/5 hover:text-primary"
            >
              <a href="#studio" className="gap-2">
                Skip to the canvas
                <ArrowDown className="h-4 w-4" />
              </a>
            </Button>
          </div>
        </section>

        {/* ─────────────────────────────────────────────────────────────
            DIVIDER
        ───────────────────────────────────────────────────────────── */}
        <div
          aria-hidden
          className="mx-auto my-16 flex max-w-6xl items-center gap-4 sm:my-20"
        >
          <span className="h-px flex-1 bg-border/70" />
          <Sparkles className="h-4 w-4 shrink-0 text-primary/40" />
          <span className="h-px flex-1 bg-border/70" />
        </div>

        {/* ─────────────────────────────────────────────────────────────
            STUDIO
        ───────────────────────────────────────────────────────────── */}
        <section
          id="studio"
          aria-labelledby="studio-heading"
          className="mx-auto w-full max-w-6xl min-w-0 scroll-mt-28"
        >
          {/* Studio header */}
          <div className="mb-8 flex min-w-0 flex-col gap-6 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0">
              <div className="mb-4 flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-primary/15 bg-primary/5 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  <Palette className="h-3.5 w-3.5" />
                  The Studio
                </span>

                <span className="rounded-full bg-foreground/[0.035] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Live audio canvas
                </span>
              </div>

              <h2
                id="studio-heading"
                className="text-4xl font-black tracking-[-0.045em] text-foreground sm:text-5xl lg:text-6xl"
              >
                Make something
                <br className="hidden sm:block" /> you can hear.
              </h2>

              <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground sm:text-base">
                Turn on sound, choose a color, and draw. Your movement becomes
                pitch, position becomes space, and every line becomes part of
                the composition.
              </p>
            </div>

            <div className="shrink-0 sm:pb-1">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-primary" />
                Ready to create
              </div>
            </div>
          </div>

          {/* Canvas container */}
          <div className="w-full min-w-0 rounded-[1.75rem] border border-primary/15 bg-card p-2 shadow-[0_20px_60px_-35px_hsl(var(--primary)/0.4)] sm:p-3">
            <div className="w-full min-w-0 overflow-hidden rounded-[1.35rem] border border-border/60 bg-background">
              <div className="w-full min-w-0 p-2 sm:p-3 lg:p-4">
                <Sketchpad onPost={handlePost} />
              </div>
            </div>
          </div>

          {/* Bottom studio note */}
          <div className="mt-5 flex min-w-0 flex-col gap-3 rounded-2xl border border-border/60 bg-card/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
                <Headphones className="h-4 w-4" />
              </div>

              <p className="min-w-0 text-xs leading-5 text-muted-foreground">
                For the full experience, we recommend headphones.
              </p>
            </div>

            <Link
              to="/gallery"
              className="inline-flex shrink-0 items-center gap-1.5 text-xs font-semibold text-primary transition-colors hover:text-primary/70"
            >
              Explore the gallery
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-border/60 bg-card/30 py-8">
        <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col items-center justify-between gap-5 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-2 text-center sm:text-left">
            <Heart className="h-3.5 w-3.5 shrink-0 text-primary" />

            <span>Made with care for accessible creativity.</span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <a
              href="mailto:contact.perceive.art@gmail.com"
              aria-label="Email Perceive"
              className="grid h-8 w-8 place-items-center rounded-full bg-primary/5 text-primary transition-colors hover:bg-primary/10"
            >
              <Mail className="h-4 w-4" />
            </a>

            <a
              href="https://www.instagram.com/perceive.art_/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Perceive on Instagram"
              className="grid h-8 w-8 place-items-center rounded-full bg-primary/5 text-primary transition-colors hover:bg-primary/10"
            >
              <Instagram className="h-4 w-4" />
            </a>

            <a
              href="https://www.linkedin.com/company/perceive-art/"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Perceive on LinkedIn"
              className="grid h-8 w-8 place-items-center rounded-full bg-primary/5 text-primary transition-colors hover:bg-primary/10"
            >
              <Linkedin className="h-4 w-4" />
            </a>
          </div>

          <Link
            to="/gallery"
            className="inline-flex items-center gap-1.5 font-medium text-primary underline-offset-2 hover:underline"
          >
            Browse the gallery
            <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </footer>
    </div>
  );
}
