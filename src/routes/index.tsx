import { createFileRoute, Link } from "@tanstack/react-router";
import { RollingStats } from "@/components/RollingStats";
import { StudioPreviewCards } from "@/components/StudioPreviewCards";
import { HoverListen } from "@/components/ListenButton";
import { SiteHeader } from "@/components/SiteHeader";
import { useCanvasClicks } from "@/lib/usage";
import bearPeek from "@/assets/bear-peek-cropped.png";
import {
  Ear,
  Hand,
  Printer,
  Heart,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Music,
  Music2,
  Star,
  Palette,
  Headphones,
  Mail,
  Instagram,
  Linkedin,
  Rocket,
  Users2,
  Smartphone,
  Wand2,
  Handshake,
  MessageSquare,
  Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

const communityFeatures = [
  {
    title: "Raq the Boat Show",
    type: "Video",
    meta: "Featured conversation",
    href: "https://www.youtube.com/watch?v=HCa1G3bUBLY&t=1621s",
    image: "https://img.youtube.com/vi/HCa1G3bUBLY/maxresdefault.jpg",
  },
  {
    title: "Professor Kev Show",
    type: "Video",
    meta: "Featured conversation",
    href: "https://www.youtube.com/watch?v=rpw-0-8PfTI&t=51s",
    image: "https://img.youtube.com/vi/rpw-0-8PfTI/maxresdefault.jpg",
  },
  {
    title: "Innovation Insider",
    type: "Publication",
    meta: "September 2026 edition",
    href: "https://innovationworld.org/books/innovation-insider-september-2026/",
    image: null,
  },
];

function Index() {
  const stats = useCanvasClicks();

  return (
    <div className="min-h-screen">
      {/* Soft blush background glows */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-secondary/30 blur-3xl" />
      </div>

      {/* Bouncing cute symbols */}
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      >
        {[
          {
            Icon: Music,
            top: "8%",
            left: "6%",
            size: 28,
            dur: "5s",
            delay: "0s",
            rot: "-12deg",
            color: "text-primary/40",
          },
          {
            Icon: Heart,
            top: "14%",
            left: "88%",
            size: 24,
            dur: "6s",
            delay: "0.6s",
            rot: "10deg",
            color: "text-accent-foreground/30",
          },
          {
            Icon: Sparkles,
            top: "28%",
            left: "3%",
            size: 22,
            dur: "7s",
            delay: "1.2s",
            rot: "8deg",
            color: "text-primary/50",
          },
          {
            Icon: Star,
            top: "36%",
            left: "92%",
            size: 26,
            dur: "5.5s",
            delay: "0.3s",
            rot: "-6deg",
            color: "text-primary/40",
          },
          {
            Icon: Music2,
            top: "52%",
            left: "7%",
            size: 30,
            dur: "6.5s",
            delay: "1s",
            rot: "14deg",
            color: "text-primary/45",
          },
          {
            Icon: Headphones,
            top: "60%",
            left: "90%",
            size: 28,
            dur: "7s",
            delay: "0.8s",
            rot: "-10deg",
            color: "text-primary/40",
          },
          {
            Icon: Palette,
            top: "74%",
            left: "5%",
            size: 26,
            dur: "5.8s",
            delay: "1.5s",
            rot: "6deg",
            color: "text-accent-foreground/35",
          },
          {
            Icon: Heart,
            top: "82%",
            left: "85%",
            size: 22,
            dur: "6.2s",
            delay: "0.4s",
            rot: "-14deg",
            color: "text-primary/45",
          },
          {
            Icon: Sparkles,
            top: "92%",
            left: "50%",
            size: 24,
            dur: "5.4s",
            delay: "1.8s",
            rot: "12deg",
            color: "text-primary/40",
          },
          {
            Icon: Music,
            top: "44%",
            left: "48%",
            size: 20,
            dur: "6.8s",
            delay: "2s",
            rot: "-8deg",
            color: "text-primary/25",
          },
        ].map(
          ({ Icon, top, left, size, dur, delay, rot, color }, i) => (
            <Icon
              key={i}
              className={`absolute animate-float-bounce ${color}`}
              style={{
                top,
                left,
                width: size,
                height: size,
                ["--dur" as never]: dur,
                ["--delay" as never]: delay,
                ["--rot" as never]: rot,
              }}
              strokeWidth={2.2}
            />
          ),
        )}
      </div>

      {/* Nav */}
      <SiteHeader />

      {/* Cute preview cards */}
      <StudioPreviewCards />

      {/* Hero */}
      <header
        id="top"
        className="mx-auto max-w-6xl px-6 pt-10 pb-0 text-center sm:pt-12"
      >
        <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-xs font-medium text-primary shadow-sm ring-1 ring-primary/20">
          <Sparkles className="h-3.5 w-3.5" /> A sonic-tactile art studio
        </span>

        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold leading-tight tracking-tight text-foreground sm:text-6xl">
          Draw with{" "}
          <span className="bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
            sound
          </span>
          .
          <br /> Feel with{" "}
          <span className="bg-gradient-to-r from-primary to-accent-foreground bg-clip-text text-transparent">
            touch
          </span>
          .
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Perceive is a browser studio where blind and sighted creators sketch
          together — using pitch, pan, and rhythm as a canvas. Every drawing
          can be exported to swell paper or a 3D print, so art you hear becomes
          art you can hold.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/studio" className="gap-2">
              Start creating <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>

          <Button
            asChild
            size="lg"
            variant="secondary"
            className="rounded-full"
          >
            <a href="#mission">Our mission</a>
          </Button>

          <Button asChild size="lg" variant="outline" className="rounded-full">
            <Link to="/gallery">Browse the gallery</Link>
          </Button>
        </div>
      </header>

      {/* Impact Stats */}
      <section className="mx-auto mt-10 max-w-4xl px-6">
        <RollingStats drawingCount={stats.data} />
      </section>

      {/* Mission */}
      <section
        id="mission"
        className="mx-auto mt-10 max-w-5xl px-6 pb-16 sm:mt-16"
      >
        <div className="relative pt-52">
          <img
            src={bearPeek}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-3 z-10 h-56 w-56 -translate-x-1/2 select-none object-contain object-bottom drop-shadow-xl sm:top-4 sm:h-72 sm:w-72"
          />

          <div className="rounded-3xl bg-card px-8 pb-8 pt-10 shadow-sm ring-1 ring-primary/15 sm:px-12 sm:pb-12 sm:pt-12">
            <div className="flex items-center gap-3">
              <Heart className="h-5 w-5 text-primary" />
              <span className="text-sm font-semibold uppercase tracking-widest text-primary">
                Our mission
              </span>
            </div>

            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
              Creativity shouldn't require sight.
            </h2>

            <HoverListen
              text="Our mission. Creativity shouldn't require sight. Most drawing tools assume you can see the canvas. We disagree. Perceive was built so that 3.4 million blind and low-vision people in the US, and millions more worldwide, can express themselves visually through the senses they already trust: hearing and touch. Our goal is a world where making art is a right, not a privilege granted by vision."
              label="our mission"
              className="mt-4"
            >
              <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
                Art has always been about expression, but most creative tools
                are designed around vision. Perceive reimagines the canvas by
                making drawing accessible through hearing, touch, and spatial
                interaction — empowering blind and low-vision artists while
                inviting every creator to explore a new way of making art. We
                believe creativity belongs to everyone, and the ability to
                create should never depend on how you see the world.
              </p>
            </HoverListen>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">
          How Perceive works
        </h2>

        <HoverListen
          text="How Perceive works. Three senses, one canvas. Move, listen, and print. First: hear the canvas. Your cursor's horizontal position pans the sound left and right. Vertical position raises or lowers the pitch. You always know where you are. Second: draw with intention. Tap space to start a line and tap again to connect it. A soft chime confirms every choice, and edges buzz gently so you never get lost. Third: hold your art. Export a high-contrast SVG for swell paper, or a ready-to-print STL, and turn what you heard into something you can run your fingers across."
          label="how it works"
          className="mx-auto mt-3 block max-w-2xl"
        >
          <p className="text-center text-muted-foreground">
            Three senses, one canvas. Move, listen, and print.
          </p>
        </HoverListen>

        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Ear,
              title: "Hear the canvas",
              body: "Your cursor's horizontal position pans the sound left and right. Vertical position raises or lowers the pitch. You always know where you are.",
            },
            {
              icon: Hand,
              title: "Draw with intention",
              body: "Tap space to start a line and tap again to connect it. A soft chime confirms every choice, and edges buzz gently so you never get lost.",
            },
            {
              icon: Printer,
              title: "Hold your art",
              body: "Export a high-contrast SVG for swell paper — or a ready-to-print STL — and turn what you heard into something you can run your fingers across.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <div
              key={title}
              className="rounded-3xl bg-card p-6 shadow-sm ring-1 ring-primary/15 transition-all hover:-translate-y-1 hover:shadow-md"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Icon className="h-6 w-6" />
              </div>

              <HoverListen
                text={`${title}. ${body}`}
                label={title}
                className="mt-4 block"
              >
                <h3 className="text-lg font-semibold">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </HoverListen>
            </div>
          ))}
        </div>
      </section>

      {/* Studio: entry point to the /studio page */}
      <section id="studio" className="mx-auto max-w-6xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary/30 via-card to-accent/25 p-2 shadow-xl ring-2 ring-primary/30 sm:p-3">
          <div className="relative overflow-hidden rounded-[2.15rem] bg-background/90 p-7 backdrop-blur-sm sm:p-11">
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
            >
              <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
              <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
            </div>

            <div className="relative grid items-center gap-10 lg:grid-cols-[1.1fr_1fr]">
              <div className="rounded-[2rem] border border-primary/25 bg-card p-6 shadow-lg ring-1 ring-primary/10 sm:p-8">
                <div className="mb-5 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground shadow-sm">
                    <Palette className="h-3.5 w-3.5" /> Our main product
                  </span>

                  <span className="inline-flex items-center rounded-full bg-primary/10 px-3 py-1.5 text-xs font-medium text-primary ring-1 ring-primary/20">
                    Live audio canvas
                  </span>
                </div>

                <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                  Step into the Studio
                </h2>

                <HoverListen
                  text="Step into the Studio. The Studio is where Perceive comes to life. Turn on sound, pick a color, and start a line. Every move you make plays back to you as pitch and pan, so you can hear exactly where your brush is. When you're done, export your piece for swell paper or a 3D print, or send it to the gallery. Headphones recommended."
                  label="the studio"
                  className="mt-4 block"
                >
                  <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
                    The Studio is where Perceive comes to life. Turn on sound,
                    pick a color, and start a line. Every move you make plays
                    back to you as pitch and pan, so you can hear exactly where
                    your brush is. When you're done, export your piece for
                    swell paper or a 3D print, or send it to the gallery for
                    others to see.
                  </p>
                </HoverListen>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Button
                    asChild
                    size="lg"
                    className="group rounded-full shadow-md"
                  >
                    <Link to="/studio" className="gap-2">
                      Go to the Studio
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                    </Link>
                  </Button>

                  <Button
                    asChild
                    size="lg"
                    variant="outline"
                    className="rounded-full"
                  >
                    <Link to="/gallery">Browse the gallery</Link>
                  </Button>
                </div>

                <p className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
                  <Headphones className="h-3.5 w-3.5 text-primary" />
                  Best with headphones. No account or download needed.
                </p>
              </div>

              <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {[
                  {
                    icon: Ear,
                    title: "Hear where you are",
                    body: "Left and right pans the sound. Up and down changes the pitch.",
                  },
                  {
                    icon: Hand,
                    title: "Keyboard friendly",
                    body: "Arrow keys to move, Space to draw, S for sound. No mouse needed.",
                  },
                  {
                    icon: Printer,
                    title: "Make it real",
                    body: "Export a swell paper SVG or a ready-to-print STL.",
                  },
                ].map(({ icon: Icon, title, body }) => (
                  <li
                    key={title}
                    className="flex items-start gap-4 rounded-2xl bg-card/80 p-4 shadow-sm ring-1 ring-primary/15 backdrop-blur-sm transition-transform hover:-translate-y-0.5"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
                      <Icon className="h-5 w-5" />
                    </span>

                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {title}
                      </h3>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {body}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Community / featured showcase */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-primary/25 via-card to-accent/25 p-1.5 shadow-2xl shadow-primary/10 ring-1 ring-white/40 sm:p-2">
          <div className="relative overflow-hidden rounded-[2.15rem] bg-background/90 py-10 backdrop-blur-xl sm:py-14">
            {/* Decorative background */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="absolute -left-32 top-0 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
              <div className="absolute -right-32 bottom-0 h-80 w-80 rounded-full bg-accent/20 blur-3xl" />

              <span className="absolute -right-8 top-0 select-none text-[7rem] font-black tracking-tighter text-foreground/[0.025] sm:text-[10rem]">
                FEATURED
              </span>

              <span className="absolute -bottom-10 left-8 select-none text-[5rem] font-black tracking-tighter text-primary/[0.035] sm:text-[8rem]">
                PERCEIVE
              </span>
            </div>

            {/* Heading */}
            <div className="relative z-10 px-7 sm:px-12">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="mb-4 flex items-center gap-3">
                    <span className="h-px w-8 bg-primary" />
                    <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary">
                      In the community
                    </span>
                  </div>

                  <h2 className="max-w-2xl text-3xl font-bold tracking-tight sm:text-5xl">
                    Perceive, out in the world.
                  </h2>

                  <p className="mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                    From podcasts and conversations to publications and
                    community features, here are a few places Perceive has
                    been shared.
                  </p>
                </div>

                <div className="hidden shrink-0 sm:block">
                  <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground/60">
                    2026 · Selected features
                  </span>
                </div>
              </div>
            </div>

            {/* Scrolling showcase */}
            <div className="relative z-10 mt-10 overflow-hidden sm:mt-12">
              {/* Edge fades */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 left-0 z-20 w-16 bg-gradient-to-r from-background via-background/80 to-transparent sm:w-28"
              />

              <div
                aria-hidden
                className="pointer-events-none absolute inset-y-0 right-0 z-20 w-16 bg-gradient-to-l from-background via-background/80 to-transparent sm:w-28"
              />

              <div className="group flex w-max animate-marquee">
                {[...communityFeatures, ...communityFeatures].map(
                  ({ title, type, meta, href, image }, i) => (
                    <a
                      key={`${title}-${i}`}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group/card mx-2 w-[290px] shrink-0 sm:w-[360px]"
                    >
                      <article className="overflow-hidden rounded-[1.5rem] border border-white/60 bg-card/75 shadow-lg shadow-black/[0.04] ring-1 ring-primary/10 backdrop-blur-xl transition-all duration-300 group-hover/card:-translate-y-1 group-hover/card:shadow-xl group-hover/card:ring-primary/25">
                        {/* Media */}
                        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
                          {image ? (
                            <img
                              src={image}
                              alt={`${title} thumbnail`}
                              className="h-full w-full object-cover transition-transform duration-700 group-hover/card:scale-[1.04]"
                            />
                          ) : (
                            <div className="relative h-full w-full overflow-hidden bg-gradient-to-br from-primary/20 via-background to-accent/20">
                              <div
                                aria-hidden
                                className="absolute -right-10 -top-10 h-40 w-40 rounded-full border border-primary/20"
                              />

                              <div
                                aria-hidden
                                className="absolute -bottom-16 -left-8 h-44 w-44 rounded-full border border-accent/20"
                              />

                              <div className="absolute inset-0 flex flex-col justify-between p-6">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">
                                    Innovation World
                                  </span>

                                  <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                    09 / 2026
                                  </span>
                                </div>

                                <div>
                                  <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                                    Innovation Insider
                                  </p>
                                  <p className="mt-1 text-2xl font-bold tracking-tight text-foreground">
                                    September
                                  </p>
                                  <p className="text-2xl font-bold tracking-tight text-primary">
                                    2026
                                  </p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Image gradient */}
                          <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent opacity-70" />

                          {/* Type badge */}
                          <div className="absolute left-4 top-4">
                            <span className="inline-flex items-center rounded-full border border-white/60 bg-white/75 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground shadow-sm backdrop-blur-md">
                              {type}
                            </span>
                          </div>

                          {/* Video play button */}
                          {type === "Video" && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="grid h-14 w-14 place-items-center rounded-full border border-white/70 bg-white/80 text-foreground shadow-xl backdrop-blur-md transition-all duration-300 group-hover/card:scale-110 group-hover/card:bg-white">
                                <Play className="ml-0.5 h-5 w-5 fill-current" />
                              </div>
                            </div>
                          )}

                          {/* Publication arrow */}
                          {type === "Publication" && (
                            <div className="absolute bottom-4 right-4 grid h-10 w-10 place-items-center rounded-full border border-white/60 bg-white/75 text-foreground shadow-lg backdrop-blur-md transition-transform duration-300 group-hover/card:scale-110">
                              <ArrowUpRight className="h-4 w-4" />
                            </div>
                          )}
                        </div>

                        {/* Card content */}
                        <div className="p-5 sm:p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0">
                              <h3 className="text-base font-semibold tracking-tight text-foreground sm:text-lg">
                                {title}
                              </h3>

                              <p className="mt-1.5 text-xs text-muted-foreground sm:text-sm">
                                {meta}
                              </p>
                            </div>

                            <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground/40 transition-all duration-300 group-hover/card:translate-x-0.5 group-hover/card:-translate-y-0.5 group-hover/card:text-primary" />
                          </div>
                        </div>
                      </article>
                    </a>
                  ),
                )}
              </div>
            </div>

            {/* Bottom detail */}
            <div className="relative z-10 mt-9 flex items-center justify-between px-7 sm:px-12">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-primary" />
                More features coming soon
              </div>

              <span className="hidden text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground/50 sm:block">
                Discover · Watch · Read
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Coming soon */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/15 via-card to-accent/15 p-10 text-center shadow-sm ring-1 ring-primary/20 sm:p-14">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-0"
          >
            <div className="absolute -top-24 -left-20 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
            <div className="absolute -bottom-24 -right-16 h-72 w-72 rounded-full bg-accent/25 blur-3xl" />
          </div>

          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-xs font-medium text-primary shadow-sm ring-1 ring-primary/20">
              <Rocket className="h-3.5 w-3.5" /> Coming soon
            </span>

            <h2 className="mx-auto mt-5 max-w-xl bg-gradient-to-br from-[oklch(0.42_0.19_10)] to-[oklch(0.32_0.13_340)] bg-clip-text text-3xl font-bold tracking-tight text-transparent sm:text-4xl">
              More features coming soon
            </h2>

            <p className="mx-auto mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
              We're just getting started. Here's a taste of what's next for
              Perceive.
            </p>

            <div className="mx-auto mt-8 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: Ear,
                  title: "Autonomous sound guide",
                  body: "A fully hands-free audio guide for blind users, plus a sighted mode with visual aids — two ways to create.",
                },
                {
                  icon: Users2,
                  title: "Collaborative canvas",
                  body: "Draw together with someone else in real time.",
                },
                {
                  icon: Smartphone,
                  title: "Mobile studio",
                  body: "The full sonic canvas, right in your pocket.",
                },
                {
                  icon: Wand2,
                  title: "More audio guides",
                  body: "New shapes, patterns, and freeform templates.",
                },
              ].map(({ icon: Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-2xl bg-card/70 p-5 text-left shadow-sm ring-1 ring-primary/15 backdrop-blur-sm transition-transform hover:-translate-y-1"
                >
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/15">
                    <Icon className="h-5 w-5 text-primary" />
                  </div>

                  <h3 className="mt-3 text-sm font-semibold">{title}</h3>

                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Partnerships & Feedback */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid gap-6 sm:grid-cols-2">
          <div className="rounded-3xl bg-card p-8 text-center shadow-sm ring-1 ring-primary/15 transition-all hover:-translate-y-1 hover:shadow-md">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Handshake className="h-6 w-6" />
            </div>

            <h3 className="mt-4 text-base font-semibold text-foreground">
              Want to partner with us?
            </h3>

            <p className="mt-2 text-sm text-muted-foreground">
              Interested in partnering with Perceive?{" "}
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSf_OkgdZOlep14jdmhITfNYSM1wQno_i6vTizwocXpr5AG0Bg/viewform?usp=dialog"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Submit this form here
              </a>
              .
            </p>
          </div>

          <div className="rounded-3xl bg-card p-8 text-center shadow-sm ring-1 ring-primary/15 transition-all hover:-translate-y-1 hover:shadow-md">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <MessageSquare className="h-6 w-6" />
            </div>

            <h3 className="mt-4 text-base font-semibold text-foreground">
              Have feedback for us?
            </h3>

            <p className="mt-2 text-sm text-muted-foreground">
              Have recommendations for new features or improvements?{" "}
              <a
                href="https://docs.google.com/forms/d/e/1FAIpQLSdG2YExqtuXOD8MGkRUPJpYgdbs3wpZNALVpLXo1SRCWK15Ng/viewform?usp=header"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                Submit this form here
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* Newsletter */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <div className="relative overflow-hidden rounded-[2.25rem] bg-gradient-to-br from-primary/25 via-card/70 to-accent/25 p-1.5 shadow-2xl shadow-primary/20 ring-1 ring-white/40 backdrop-blur-xl sm:p-2">
          <div className="rounded-[1.85rem] bg-card/40 p-8 text-center backdrop-blur-md sm:p-12">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-card/60 text-primary ring-1 ring-white/50 backdrop-blur-sm">
              <Mail className="h-7 w-7" />
            </div>

            <h2 className="mt-4 text-2xl font-bold text-foreground sm:text-3xl">
              Stay in the loop
            </h2>

            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
              Sign up for our newsletter to hear about new features, audio
              guides, and community art drops as they launch.
            </p>

            <Button
              asChild
              className="mt-6 rounded-full shadow-md"
              size="lg"
            >
              <a
                href="https://forms.gle/TwF7RfXNysUPA28YA"
                target="_blank"
                rel="noopener noreferrer"
              >
                Sign up for our newsletter
              </a>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-primary/10 bg-card/50 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <Heart className="h-3.5 w-3.5 shrink-0 text-primary" />

            <span className="whitespace-pre-line">
              Made with care for accessible creativity.{"\u00a0"}
              {"\n"}
              contact.perceive.art@gmail.com{"\u00a0"}
            </span>
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

          <span>© {new Date().getFullYear()} Perceive</span>
        </div>
      </footer>
    </div>
  );
}
