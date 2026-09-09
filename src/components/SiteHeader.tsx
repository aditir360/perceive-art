import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

const scrollLinks = [
  { label: "Mission", hash: "mission" },
  { label: "How it works", hash: "how" },
  { label: "Studio", hash: "studio" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 px-4 pt-4 sm:px-6">
      <div className="mx-auto max-w-6xl rounded-[2rem] bg-card/80 px-4 py-3 shadow-lg ring-1 ring-primary/15 backdrop-blur-md sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="group flex items-center gap-2.5 transition-transform duration-150 hover:scale-[1.02] sm:gap-3">
            <img
              src="/bear-logo-new.png"
              alt="Perceive logo"
              className="h-11 w-11 rounded-full bg-card object-cover shadow-md ring-2 ring-primary/40 transition-shadow group-hover:ring-primary/60 sm:h-12 sm:w-12"
            />
            <span className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
              Perceive
            </span>
          </Link>

          {/* Desktop navigation */}
          <nav aria-label="Primary" className="hidden items-center gap-1 sm:flex">
            {scrollLinks.map((link) => (
              <Link
                key={link.label}
                to="/"
                hash={link.hash}
                className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/gallery"
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
              activeProps={{ className: "!bg-primary/12 font-semibold !text-foreground" }}
              activeOptions={{ exact: true }}
            >
              Gallery
            </Link>
            <Link
              to="/team"
              className="rounded-full px-3.5 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-primary/10 hover:text-foreground"
              activeProps={{ className: "!bg-primary/12 font-semibold !text-foreground" }}
              activeOptions={{ exact: true }}
            >
              Team
            </Link>
          </nav>

          {/* Desktop CTA */}
          <Button asChild className="hidden rounded-full shadow-md sm:inline-flex">
            <Link to="/" hash="studio" className="group gap-2">
              Open studio
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
          </Button>

          {/* Mobile CTA (visible next to logo, since mobile nav row is a separate scroller below) */}
          <Button asChild size="sm" className="rounded-full shadow-sm sm:hidden">
            <Link to="/" hash="studio" className="gap-1.5">
              Studio <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        {/* Mobile navigation — always visible, horizontally scrollable */}
        <nav
          aria-label="Primary mobile"
          className="mt-3 flex gap-2 overflow-x-auto pb-0.5 sm:hidden"
        >
          {scrollLinks.map((link) => (
            <Link
              key={link.label}
              to="/"
              hash={link.hash}
              className="shrink-0 rounded-full bg-background/60 px-3.5 py-1.5 text-sm font-medium text-muted-foreground ring-1 ring-primary/10 transition-colors hover:bg-primary/10 hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/gallery"
            className="shrink-0 rounded-full bg-background/60 px-3.5 py-1.5 text-sm font-medium text-muted-foreground ring-1 ring-primary/10 transition-colors hover:bg-primary/10 hover:text-foreground"
            activeProps={{ className: "!bg-primary/12 font-semibold !text-foreground" }}
            activeOptions={{ exact: true }}
          >
            Gallery
          </Link>
          <Link
            to="/team"
            className="shrink-0 rounded-full bg-background/60 px-3.5 py-1.5 text-sm font-medium text-muted-foreground ring-1 ring-primary/10 transition-colors hover:bg-primary/10 hover:text-foreground"
            activeProps={{ className: "!bg-primary/12 font-semibold !text-foreground" }}
            activeOptions={{ exact: true }}
          >
            Team
          </Link>
        </nav>
      </div>
    </header>
  );
}
