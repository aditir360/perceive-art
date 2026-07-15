import { createFileRoute, Link } from "@tanstack/react-router";
import { ListenButton } from "@/components/ListenButton";
import { SiteHeader } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { Heart, Sparkles, Music, Music2, Star, Headphones, Palette, Lightbulb, Mail, Instagram, Linkedin } from "lucide-react";

export const Route = createFileRoute("/team")({
  head: () => ({
    meta: [
      { title: "Our Team — Perceive" },
      { name: "description", content: "Meet the people behind Perceive: a student-led mission making art accessible through sound and touch." },
      { property: "og:title", content: "Our Team — Perceive" },
      { property: "og:description", content: "Meet the people behind Perceive: a student-led mission making art accessible through sound and touch." },
      { property: "og:type", content: "website" },
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
      <header className="mx-auto max-w-6xl px-6 pt-12 pb-6 text-center sm:pt-16">
        <span className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-1.5 text-xs font-medium text-primary shadow-sm ring-1 ring-primary/20">
          <Sparkles className="h-3.5 w-3.5" /> The people behind the mission
        </span>
        <h1 className="mx-auto mt-6 max-w-3xl text-4xl font-bold leading-tight tracking-tight text-foreground sm:text-5xl">
          Meet the <span className="text-primary">team</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
          Perceive is built by students who believe creativity belongs to everyone.
          We combine art, sound, and advocacy to open new doors for blind and low-vision creators.
        </p>
        <div className="mt-6 flex justify-center">
          <ListenButton
            label="Listen to our team story"
            text="Meet the team behind Perceive. Perceive is built by students who believe creativity belongs to everyone. We combine art, sound, and advocacy to open new doors for blind and low-vision creators. Our founder and executive director is Aditi Ranjan. She leads our vision and uses art for social good. Our director of outreach and partnerships is Haasini Arunachalam. She leads our social media platforms and collaborates with other organizations for partnerships toward our mission. We are also opening social media positions soon, so we can expand and share our mission with even more people."
          />
        </div>
      </header>

      {/* Team grid */}
      <section className="mx-auto max-w-6xl px-6 py-8">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {/* Aditi Ranjan */}
          <article className="group rounded-3xl bg-card p-6 shadow-sm ring-1 ring-primary/15 transition-all hover:-translate-y-1 hover:shadow-md">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Sparkles className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-foreground">Aditi Ranjan</h2>
            <p className="mt-1 text-sm font-semibold text-primary">Founder & Executive Director</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Aditi leads Perceive's vision and mission. She believes in using art for social good,
              building tools by leveraging technology, that let blind and sighted creators express themselves together.
            </p>
            <div className="mt-4">
              <ListenButton
                label="Listen"
                text="Aditi Ranjan, Founder and Executive Director. Aditi leads Perceive's vision and mission. She believes in using art for social good, building tools by leveraging technology, that let blind and sighted creators express themselves together."
              />
            </div>
          </article>

          {/* Haasini Arunachalam */}
          <article className="group rounded-3xl bg-card p-6 shadow-sm ring-1 ring-primary/15 transition-all hover:-translate-y-1 hover:shadow-md">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Heart className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-foreground">Haasini Arunachalam</h2>
            <p className="mt-1 text-sm font-semibold text-primary">Director of Outreach & Partnerships</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Haasini leads our social media platforms and collaborates with other organizations
              for partnerships that push our mission forward.
            </p>
            <div className="mt-4">
              <ListenButton
                label="Listen"
                text="Haasini Arunachalam, Director of Outreach and Partnerships. Haasini leads our social media platforms and collaborates with other organizations for partnerships that push our mission forward."
              />
            </div>
          </article>

          {/* Chelsea Hung */}
          <article className="group rounded-3xl bg-card p-6 shadow-sm ring-1 ring-primary/15 transition-all hover:-translate-y-1 hover:shadow-md">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Lightbulb className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-foreground">Chelsea Hung</h2>
            <p className="mt-1 text-sm font-semibold text-primary">Director of Product Development</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Chelsea helps shape the Perceive experience by turning ideas into
              accessible, thoughtfully designed features that make sonic-tactile creation
              feel intuitive for every user.
            </p>
            <div className="mt-4">
              <ListenButton
                label="Listen"
                text="Chelsea Hung, Director of Product Development. Chelsea helps shape the Perceive experience by turning ideas into accessible, thoughtfully designed features that make sonic-tactile creation feel intuitive for every user."
              />
            </div>
          </article>

          {/* Social media positions coming soon */}
          <article className="group rounded-3xl bg-card p-6 shadow-sm ring-1 ring-primary/15 transition-all hover:-translate-y-1 hover:shadow-md">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Music className="h-7 w-7" />
            </div>
            <h2 className="mt-5 text-xl font-bold text-foreground">Social Media Team</h2>
            <p className="mt-1 text-sm font-semibold text-primary">Opening positions soon</p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              We're expanding! Soon we'll be looking for passionate storytellers to help grow
              Perceive's voice and share accessible creativity with the world.
            </p>
            <div className="mt-4">
              <ListenButton
                label="Listen"
                text="Social Media Team. Opening positions soon. We're expanding! Soon we'll be looking for passionate storytellers to help grow Perceive's voice and share accessible creativity with the world."
              />
            </div>
          </article>
        </div>
      </section>

      {/* Join CTA */}
      <section className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-3xl bg-gradient-to-br from-primary/10 via-secondary/20 to-accent/20 p-8 text-center ring-1 ring-primary/15 sm:p-12">
          <h2 className="text-2xl font-bold text-foreground sm:text-3xl">Want to join the mission?</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground sm:text-base">
            We're always looking for kind, creative people who want to make art accessible for everyone.
          </p>
          <Button asChild className="mt-6 rounded-full" size="lg">
            <Link to="/">Back to the studio</Link>
          </Button>
        </div>
      </section>

      <footer className="border-t border-primary/10 bg-card/50 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 text-xs text-muted-foreground sm:flex-row">
          <div className="flex items-center gap-2 text-center sm:text-left">
            <Heart className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="whitespace-pre-line">
              Made with care for accessible creativity.{"\u00a0"}{"\n"}
              contact.perceive@gmail.com{"\n"}
              {"\u00a0"}
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
