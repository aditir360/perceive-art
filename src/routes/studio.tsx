import { useCallback, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Sketchpad } from "@/components/Sketchpad";
import { SiteHeader } from "@/components/SiteHeader";
import { saveArtwork } from "@/lib/gallery-storage";
import {
  Heart,
  Play,
  ArrowDown,
  Mail,
  Instagram,
  Linkedin,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

const TUTORIAL_VIDEO_URL = "https://youtu.be/Jj1eap0iMVA";

// Italic serif accent for the occasional cursive word in headings.
const ACCENT = "font-['Instrument_Serif',Georgia,serif] font-normal italic tracking-tight";

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
    // Fall through to direct video.
  }

  return {
    kind: "file",
    src: url,
  };
}

const TUTORIAL_STEPS = [
  {
    number: "01",
    title: "Turn on sound",
    body: "Put on headphones and press S. Your brush becomes a tone.",
  },
  {
    number: "02",
    title: "Move around",
    body: "Left and right pans. Up and down changes pitch.",
  },
  {
    number: "03",
    title: "Start drawing",
    body: "Press Space or draw directly on the canvas.",
  },
  {
    number: "04",
    title: "Keep your art",
    body: "Export your drawing or send it to the public gallery.",
  },
];

function TutorialVideo() {
  if (!TUTORIAL_VIDEO_URL) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-[1.25rem] bg-gradient-to-br from-primary/20 via-card to-accent/20 ring-1 ring-border/70">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary)/0.18),transparent_35%),radial-gradient(circle_at_80%_80%,hsl(var(--accent)/0.22),transparent_35%)]" />

        <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
          <span className="grid h-16 w-16 place-items-center rounded-full bg-card/90 text-primary shadow-lg ring-1 ring-border">
            <Play className="ml-0.5 h-7 w-7" fill="currentColor" />
          </span>

          <p className="mt-5 text-base font-semibold text-foreground sm:text-lg">
            Tutorial video coming soon
          </p>

          <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Follow the four quick steps below to start drawing with sound.
          </p>
        </div>
      </div>
    );
  }

  const { kind, src } = toEmbed(TUTORIAL_VIDEO_URL);

  return (
    <div className="aspect-video w-full overflow-hidden rounded-[1.25rem] bg-black ring-1 ring-border/70">
      {kind === "iframe" ? (
        <iframe
          src={src}
          title="Perceive Studio tutorial"
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
          aria-label="Perceive Studio tutorial"
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
  const [showIntro, setShowIntro] = useState(true);
  const handlePost = useCallback(
    async ({ svg }: { svg: string }) => {
      await saveArtwork(svg);
    },
    [],
  );

  return (
    <div className="min-h-screen">
      {/* Background atmosphere only. No enclosing Studio rim. */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-secondary/20 blur-3xl" />
      </div>

      <SiteHeader />

      <main className="mx-auto w-full max-w-[1440px] px-4 pb-20 pt-6 sm:px-6 sm:pt-8 lg:px-8">
        {/* ─────────────────────────────────────────
            EDITORIAL TUTORIAL / MEDIA FEATURE
        ───────────────────────────────────────── */}
        <section
          aria-labelledby="tutorial-heading"
          className="mb-12 overflow-hidden border-y border-border/70"
        >
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
            {/* Media */}
            <div className="relative min-w-0 py-5 lg:border-r lg:border-border/70 lg:pr-8">
              <div className="mb-4 flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />
                  <span className="truncate text-xs font-bold uppercase tracking-[0.18em] text-primary">
                    Perceive Studio
                  </span>
                </div>

                <span className="shrink-0 text-xs text-muted-foreground">
                  01 / Getting started
                </span>
              </div>

              <TutorialVideo />
            </div>

            {/* Editorial information */}
            <div className="flex min-w-0 flex-col justify-between py-6 lg:pl-8">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  A quick introduction
                </p>

                <h1
                  id="tutorial-heading"
                  className="mt-3 max-w-xl text-3xl font-black tracking-[-0.035em] text-foreground sm:text-4xl"
                >
                  New here?
                  <br />
                  Start <span className={`${ACCENT} text-[1.12em]`}>with this.</span>
                </h1>

                <p className="mt-4 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
                  Learn how Perceive turns movement into sound, then use the
                  canvas however feels natural to you.
                </p>
              </div>

              <div className="mt-8 divide-y divide-border/70 border-y border-border/70">
                {TUTORIAL_STEPS.map((step) => (
                  <div
                    key={step.number}
                    className="grid grid-cols-[42px_minmax(0,1fr)] gap-3 py-4"
                  >
                    <span className="text-xs font-bold tracking-widest text-primary">
                      {step.number}
                    </span>

                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        {step.title}
                      </p>
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {step.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                asChild
                variant="outline"
                className="mt-6 h-11 w-fit rounded-full px-5"
              >
                <a href="#studio" className="gap-2">
                  Skip to Studio
                  <ArrowDown className="h-4 w-4" />
                </a>
              </Button>
            </div>
          </div>
        </section>

        {/* ─────────────────────────────────────────
            STUDIO
        ───────────────────────────────────────── */}
        <section
          id="studio"
          aria-labelledby="studio-heading"
          className="scroll-mt-24"
        >
          {/* Editorial header */}
          <div className="mb-8">
            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-primary">
              <span aria-hidden className="h-px w-8 bg-primary/60" />
              An open creative space
              <span className="text-muted-foreground">/ 01</span>
            </div>

            <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
              <div className="min-w-0">
                <h2
                  id="studio-heading"
                  className="text-5xl font-black tracking-[-0.04em] text-foreground sm:text-7xl"
                >
                  The <span className={`${ACCENT} text-[1.12em]`}>Studio.</span>
                </h2>
                <p className="mt-3 text-base text-muted-foreground sm:text-lg">
                  Draw a line. Hear what happens.
                </p>
              </div>

              <span className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                <span aria-hidden className="h-2 w-2 rounded-full bg-[oklch(0.58_0.13_150)]" />
                Your canvas is ready
              </span>
            </div>
          </div>

          {showIntro && (
            <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-4 rounded-2xl bg-secondary/40 px-5 py-4 ring-1 ring-border/70">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-card text-primary shadow-sm ring-1 ring-border/70">
                <Sparkles className="h-5 w-5" />
              </span>
              <div className="min-w-[200px] flex-1">
                <p className="text-base font-semibold text-foreground">First time here?</p>
                <p className="text-sm text-muted-foreground">
                  Start with a blank canvas. The rest is up to you.
                </p>
              </div>
              <ol className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-foreground">
                {["Pick a color", "Make a mark", "Turn on sound"].map((t, i) => (
                  <li key={t}>
                    <span className="mr-2 text-xs font-bold text-primary">0{i + 1}</span>
                    {t}
                  </li>
                ))}
              </ol>
              <button
                type="button"
                onClick={() => setShowIntro(false)}
                aria-label="Dismiss intro"
                className="grid h-10 w-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          )}

          {/* Sketchpad owns its own layout. */}
          <Sketchpad onPost={handlePost} />
        </section>
      </main>

      <footer className="border-t border-primary/10 bg-card/40 py-8">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-6 text-xs text-muted-foreground sm:flex-row">
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
