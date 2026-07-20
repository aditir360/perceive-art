import { createFileRoute, Link } from "@tanstack/react-router";
import { ListenButton } from "@/components/ListenButton";
import { Sparkles, ArrowRight, Music, Heart, Star, Palette, Headphones, Users, Megaphone, Crown, Handshake } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Our Team — Perceive" },
      { name: "description", content: "Meet the people behind Perceive, the sonic-tactile art studio building accessible creativity for blind and sighted creators." },
      { property: "og:title", content: "Our Team — Perceive" },
      { property: "og:description", content: "Meet the people behind Perceive, the sonic-tactile art studio building accessible creativity for blind and sighted creators." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TeamPage,
});

function TeamPage() {
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
          { Icon: Music, top: "52%", left: "7%", size: 30, dur: "6.5s", delay: "1s", rot: "14deg", color: "text-primary/45" },
          { Icon: Headphones, top: "60%", left: "90%", size: 28, dur: "7s", delay: "0.8s", rot: "-10deg", color: "text-primary/40" },
          { Icon: Palette, top: "74%", left: "5%", size: 26, dur: "5.8s", delay: "1.5s", rot: "6deg", color: "text-accent-foreground/35" },
          { Icon: Heart, top: "82%", left: "85%", size: 22, dur: "6.2s", delay: "0.4s", rot: "-14deg", color: "text-primary/45" },
          { Icon: Sparkles, top: "92%", left: "50%", size: 24, dur: "5.4s", delay: "1.8s", rot: "12deg", color: "text-primary/40" },
          { Icon: Users, top: "44%", left: "48%", size: 20, dur: "6.8s", delay: "2s", rot: "-8deg", color: "text-primary/25" },
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
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/bear-logo.jpeg"
            alt="Perceive logo"
            className="h-14 w-14 rounded-full bg-card object-cover shadow-md ring-2 ring-primary/40 sm:h-16 sm:w-16"
          />
          <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Perceive</span>
        </Link>
        <div className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          <Link to="/" className="transition-colors hover:text-foreground">Home</Link>
          <Link to="/" search={{}} className="transition-colors hover:text-foreground">Mission</Link>
          <Link to="/" search={{}} className="transition-colors hover:text-foreground">How it works</Link>
          <Link to="/" search={{}} className="transition-colors hover:text-foreground">Studio</Link>
          <Link to="/team" className="font-medium text-foreground transition-colors">Team</Link>
        </div>
        <Button asChild className="rounded-full">
          <Link to="/" className="gap-2">Open studio <ArrowRight className="h-4 w-4" /></Link>
        </Button>
      </nav>

      {/* Hero */}
      <header className="mx-auto max-w-6xl px-6 pt-10 pb-0 text-center sm:pt-12">
        <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-xs font-medium text-primary shadow-sm ring-1 ring-primary/20">
          <Sparkles className="h-3.5 w-3.5" /> The humans behind the mission
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-5xl font-bold leading-tight tracking-tight text-foreground sm:text-6xl">
          Meet our <span className="text-primary">team</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Perceive is built by a small, passionate crew who believe art belongs to everyone.
          We are artists, advocates, and accessibility nerds working to make creativity a right — not a privilege.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button asChild size="lg" className="rounded-full">
            <Link to="/" className="gap-2">Start creating <ArrowRight className="h-4 w-4" /></Link>
          </Button>
        </div>
      </header>

      {/* Team grid */}
      <section className="mx-auto mt-10 max-w-6xl px-6 pb-20 sm:mt-16">
        <div className="grid gap-6 md:grid-cols-3">
          {[
            {
              icon: Crown,
              name: "Aditi Ranjan",
              role: "Founder & Executive Director",
              body: "Aditi leads Perceive's vision and strategy, using art for social good and building a world where creativity does not require sight. She guides product direction, partnerships, and the heart of our mission.",
            },
            {
              icon: Handshake,
              name: "Haasini Arunachalam",
              role: "Director of Outreach & Partnerships",
              body: "Haasini leads our social media platforms and collaborates with other organizations to build partnerships toward our mission. She makes sure the world hears about accessible creativity.",
            },
            {
              icon: Megaphone,
              name: "Social Media Team",
              role: "Opening positions soon",
              body: "We are expanding! Soon we will be opening social media positions to help grow the Perceive community and share our story with more creators, advocates, and partners.",
            },
          ].map(({ icon: Icon, name, role, body }) => (
            <div key={name} className="group flex flex-col rounded-3xl bg-card p-6 shadow-sm ring-1 ring-primary/15 transition-all hover:-translate-y-1 hover:shadow-md">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
                <Icon className="h-6 w-6" />
              </div>
              <h2 className="mt-4 text-xl font-semibold">{name}</h2>
              <p className="text-sm font-medium text-primary">{role}</p>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
              <div className="mt-4">
                <ListenButton label={`Listen to ${name}`} text={`${name}, ${role}. ${body}`} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-primary/10 bg-card/50 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <Heart className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="whitespace-pre-line">
              Made with care for accessible creativity.{"\n"}
              Founded and developed by Aditi Ranjan
            </span>
          </div>
          <span>© {new Date().getFullYear()} Perceive</span>
        </div>
      </footer>
    </div>
  );
}
