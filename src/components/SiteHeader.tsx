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
    <header className="mx-auto max-w-6xl px-6 pt-6">
      <div className="flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3">
          <img
            src="/bear-logo.jpeg"
            alt="Perceive logo"
            className="h-14 w-14 rounded-full bg-card object-cover shadow-md ring-2 ring-primary/40 sm:h-16 sm:w-16"
          />
          <span className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Perceive
          </span>
        </Link>

        {/* Desktop navigation */}
        <div className="hidden items-center gap-6 text-sm text-muted-foreground sm:flex">
          {scrollLinks.map((link) => (
            <Link
              key={link.label}
              to="/"
              hash={link.hash}
              className="transition-colors hover:text-foreground"
            >
              {link.label}
            </Link>
          ))}
          <Link
            to="/team"
            className="transition-colors hover:text-foreground"
            activeProps={{ className: "font-semibold text-foreground" }}
            activeOptions={{ exact: true }}
          >
            Team
          </Link>
        </div>

        {/* Desktop CTA */}
        <Button asChild className="hidden rounded-full sm:inline-flex">
          <Link to="/" hash="studio" className="gap-2">
            Open studio <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </div>

      {/* Mobile navigation — always visible, horizontally scrollable */}
      <nav
        aria-label="Primary"
        className="mt-4 flex gap-3 overflow-x-auto pb-2 sm:hidden"
      >
        {scrollLinks.map((link) => (
          <Link
            key={link.label}
            to="/"
            hash={link.hash}
            className="shrink-0 rounded-full bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm ring-1 ring-primary/15 transition-colors hover:bg-primary/10 hover:text-foreground"
          >
            {link.label}
          </Link>
        ))}
        <Link
          to="/team"
          className="shrink-0 rounded-full bg-card px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm ring-1 ring-primary/15 transition-colors hover:bg-primary/10 hover:text-foreground"
          activeProps={{ className: "bg-primary/10 font-semibold text-foreground" }}
          activeOptions={{ exact: true }}
        >
          Team
        </Link>
        <Link
          to="/"
          hash="studio"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
        >
          Studio <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </nav>
    </header>
  );
}
