import { createFileRoute } from "@tanstack/react-router";
import { Sketchpad } from "@/components/Sketchpad";
import bearLogo from "@/assets/bear-logo.jpeg.asset.json";
import bearPeek from "@/assets/bear-peek.png";
import { Ear, Hand, Printer, Heart, Sparkles, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      {/* Soft blush background glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-secondary/30 blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
        <a href="#top" className="flex items-center gap-3">
          <img
            src={bearLogo.url}
            alt="Perceive logo"
            className="h-14 w-14 rounded-full bg-card object-cover shadow-md ring-2 ring-primary/40 sm:h-16 sm:w-16"
          />
          <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Perceive</span>
        </a>
        <div className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          <a href="#mission" className="transition-colors hover:text-foreground">Mission</a>
          <a href="#how" className="transition-colors hover:text-foreground">How it works</a>
          <a href="#studio" className="transition-colors hover:text-foreground">Studio</a>
        </div>
        <Button asChild className="rounded-full">
          <a href="#studio" className="gap-2">Open studio <ArrowRight className="h-4 w-4" /></a>
        </Button>
      </nav>

      {/* Hero */}
      <header id="top" className="mx-auto max-w-6xl px-6 pt-16 pb-10 text-center">
        <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-xs font-medium text-primary shadow-sm ring-1 ring-primary/20">
          <Sparkles className="h-3.5 w-3.5" /> A sonic-tactile art studio
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold leading-tight tracking-tight text-foreground sm:text-6xl">
          Draw with <span className="text-primary">sound</span>.
          <br /> Feel with <span className="text-primary">touch</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Perceive is a browser studio where blind and sighted creators sketch together —
          using pitch, pan, and rhythm as a canvas. Every drawing can be exported to swell
          paper or a 3D print, so art you hear becomes art you can hold.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full">
            <a href="#studio" className="gap-2">Start creating <ArrowRight className="h-4 w-4" /></a>
          </Button>
          <Button asChild size="lg" variant="secondary" className="rounded-full">
            <a href="#mission">Our mission</a>
          </Button>
        </div>
      </header>

      {/* Mission */}
      <section id="mission" className="mx-auto max-w-5xl px-6 pt-20 pb-16 sm:pt-24">
        <div className="relative pt-24 sm:pt-28">
          <img
            src={bearPeek}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 z-10 h-40 w-40 -translate-x-1/2 select-none object-contain drop-shadow-xl sm:h-48 sm:w-48"
          />
          <div className="rounded-3xl bg-card p-8 shadow-sm ring-1 ring-primary/15 sm:p-12">
          <div className="flex items-center gap-3">
            <Heart className="h-5 w-5 text-primary" />
            <span className="text-sm font-semibold uppercase tracking-widest text-primary">Our mission</span>
          </div>
          <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Creativity shouldn't require sight.
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground sm:text-lg">
            Most drawing tools assume you can see the canvas. We disagree. Perceive was built
            so that <strong className="text-foreground">3.4 million blind and low-vision people</strong> in
            the US — and millions more worldwide — can express themselves visually through the
            senses they already trust: hearing and touch. Our goal is a world where making art
            is a right, not a privilege granted by vision.
          </p>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">How Perceive works</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Three senses, one canvas. Move, listen, and print.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
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
            <div key={title} className="group rounded-3xl bg-card p-6 shadow-sm ring-1 ring-primary/15 transition-all hover:-translate-y-1 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Studio */}
      <section id="studio" className="mx-auto max-w-6xl px-6 pb-20">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">The Studio</h2>
            <p className="mt-2 max-w-xl text-sm text-muted-foreground">
              Turn on sound, pick a color, and start a line. Every move plays back to you.
            </p>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary ring-1 ring-primary/20">
            <Sparkles className="h-3.5 w-3.5" /> Live audio canvas
          </span>
        </div>
        <div>
          <Sketchpad />
        </div>
      </section>

      <footer className="border-t border-primary/10 bg-card/50 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2">
            <Heart className="h-3.5 w-3.5 text-primary" />
            <span>Made with care for accessible creativity.</span>
          </div>
          <span>© {new Date().getFullYear()} Perceive</span>
        </div>
      </footer>
    </div>
  );
}
