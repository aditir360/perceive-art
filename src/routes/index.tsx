import { createFileRoute } from "@tanstack/react-router";
import { Sketchpad } from "@/components/Sketchpad";
import { ListenButton } from "@/components/ListenButton";
import { SiteHeader } from "@/components/SiteHeader";
import bearPeek from "@/assets/bear-peek-cropped.png";
import { Ear, Hand, Printer, Heart, Sparkles, ArrowRight, Music, Music2, Star, Palette, Headphones, Mail, Instagram, Linkedin } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen">
      {/* Soft blush background glows */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -top-40 -left-32 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
        <div className="absolute top-1/3 -right-32 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-72 w-[36rem] -translate-x-1/2 rounded-full bg-secondary/30 blur-3xl" />
      </div>

      {/* Bouncing cute symbols */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {[
          { Icon: Music, top: "8%", left: "6%", size: 28, dur: "5s", delay: "0s", rot: "-12deg", color: "text-primary/40" },
          { Icon: Heart, top: "14%", left: "88%", size: 24, dur: "6s", delay: "0.6s", rot: "10deg", color: "text-accent-foreground/30" },
          { Icon: Sparkles, top: "28%", left: "3%", size: 22, dur: "7s", delay: "1.2s", rot: "8deg", color: "text-primary/50" },
          { Icon: Star, top: "36%", left: "92%", size: 26, dur: "5.5s", delay: "0.3s", rot: "-6deg", color: "text-primary/40" },
          { Icon: Music2, top: "52%", left: "7%", size: 30, dur: "6.5s", delay: "1s", rot: "14deg", color: "text-primary/45" },
          { Icon: Headphones, top: "60%", left: "90%", size: 28, dur: "7s", delay: "0.8s", rot: "-10deg", color: "text-primary/40" },
          { Icon: Palette, top: "74%", left: "5%", size: 26, dur: "5.8s", delay: "1.5s", rot: "6deg", color: "text-accent-foreground/35" },
          { Icon: Heart, top: "82%", left: "85%", size: 22, dur: "6.2s", delay: "0.4s", rot: "-14deg", color: "text-primary/45" },
          { Icon: Sparkles, top: "92%", left: "50%", size: 24, dur: "5.4s", delay: "1.8s", rot: "12deg", color: "text-primary/40" },
          { Icon: Music, top: "44%", left: "48%", size: 20, dur: "6.8s", delay: "2s", rot: "-8deg", color: "text-primary/25" },
        ].map(({ Icon, top, left, size, dur, delay, rot, color }, i) => (
          <Icon
            key={i}
            className={`absolute animate-float-bounce ${color}`}
            style={{ top, left, width: size, height: size, ["--dur" as never]: dur, ["--delay" as never]: delay, ["--rot" as never]: rot }}
            strokeWidth={2.2}
          />
        ))}
      </div>

      {/* Nav */}
      <SiteHeader />

      {/* Hero */}
      <header id="top" className="mx-auto max-w-6xl px-6 pt-10 pb-0 text-center sm:pt-12">
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
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full">
            <a href="#studio" className="gap-2">Start creating <ArrowRight className="h-4 w-4" /></a>
          </Button>
          <Button asChild size="lg" variant="secondary" className="rounded-full">
            <a href="#mission">Our mission</a>
          </Button>
        </div>
      </header>

      {/* Mission */}
      <section id="mission" className="mx-auto mt-10 max-w-5xl px-6 pb-16 sm:mt-16">
        <div className="relative pt-40 sm:pt-52">
          <img
            src={bearPeek}
            alt=""
            aria-hidden="true"
            className="pointer-events-none absolute left-1/2 top-0 z-10 h-56 w-56 -translate-x-1/2 -translate-y-8 select-none object-contain object-bottom drop-shadow-xl sm:h-72 sm:w-72 sm:-translate-y-10"
          />
          <div className="rounded-3xl bg-card px-8 pb-8 pt-10 shadow-sm ring-1 ring-primary/15 sm:px-12 sm:pb-12 sm:pt-12">
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
            <div className="mt-5">
              <ListenButton
                label="Listen to our mission"
                text="Our mission. Creativity shouldn't require sight. Most drawing tools assume you can see the canvas. We disagree. Perceive was built so that 3.4 million blind and low-vision people in the US, and millions more worldwide, can express themselves visually through the senses they already trust: hearing and touch. Our goal is a world where making art is a right, not a privilege granted by vision."
              />
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl px-6 pb-16">
        <h2 className="text-center text-3xl font-bold tracking-tight sm:text-4xl">How Perceive works</h2>
        <p className="mx-auto mt-3 max-w-2xl text-center text-muted-foreground">
          Three senses, one canvas. Move, listen, and print.
        </p>
        <div className="mt-6 flex justify-center">
          <ListenButton
            label="Listen to how it works"
            text="How Perceive works. Three senses, one canvas. Move, listen, and print. First: hear the canvas. Your cursor's horizontal position pans the sound left and right. Vertical position raises or lowers the pitch. You always know where you are. Second: draw with intention. Tap space to start a line and tap again to connect it. A soft chime confirms every choice, and edges buzz gently so you never get lost. Third: hold your art. Export a high-contrast SVG for swell paper, or a ready-to-print STL, and turn what you heard into something you can run your fingers across."
          />
        </div>
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
            <div key={title} className="group rounded-3xl bg-card p-6 shadow-sm ring-1 ring-primary/15 transition-all hover:-translate-y-1 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Icon className="h-6 w-6" />
              </div>
              <h3 className="mt-4 text-lg font-semibold">{title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{body}</p>
              <div className="mt-4">
                <ListenButton label={`Listen`} text={`${title}. ${body}`} />
              </div>
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
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <Heart className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="whitespace-pre-line">
              Made with care for accessible creativity.{"\u00a0"}{"\n"}
              contact.perceive@gmail.com{"\u00a0"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="mailto:contact.perceive@gmail.com"
              aria-label="Email Perceive"
              className="grid h-8 w-8 place-items-center rounded-full bg-primary/10 text-primary transition-colors hover:bg-primary/20"
            >
              <Mail className="h-4 w-4" />
            </a>
            <a
              href="https://www.instagram.com/perceive.art.or"
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
