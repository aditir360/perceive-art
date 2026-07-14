"use client";

import * as React from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from "@/components/ui/sheet";
import { Menu, ArrowRight } from "lucide-react";

const navLinks = [
  { label: "Mission", hash: "mission" },
  { label: "How it works", hash: "how" },
  { label: "Studio", hash: "studio" },
];

export function SiteHeader() {
  const [open, setOpen] = React.useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isHome = pathname === "/";

  return (
    <nav className="mx-auto flex max-w-6xl items-center justify-between px-6 pt-6">
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
        {navLinks.map((link) => (
          <a
            key={link.label}
            href={isHome ? `#${link.hash}` : `/#${link.hash}`}
            className="transition-colors hover:text-foreground"
          >
            {link.label}
          </a>
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
      <div className="hidden sm:block">
        <Button asChild className="rounded-full">
          <a
            href={isHome ? "#studio" : "/#studio"}
            className="gap-2"
          >
            Open studio <ArrowRight className="h-4 w-4" />
          </a>
        </Button>
      </div>

      {/* Mobile menu */}
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild className="sm:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Open navigation menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-[260px] bg-card">
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <div className="mt-10 flex flex-col gap-5">
            {navLinks.map((link) => (
              <SheetClose asChild key={link.label}>
                <a
                  href={isHome ? `#${link.hash}` : `/#${link.hash}`}
                  className="text-lg font-medium text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                </a>
              </SheetClose>
            ))}
            <SheetClose asChild>
              <Link
                to="/team"
                className="text-lg font-medium text-muted-foreground transition-colors hover:text-foreground"
                activeProps={{ className: "font-semibold text-foreground" }}
                activeOptions={{ exact: true }}
              >
                Team
              </Link>
            </SheetClose>
            <SheetClose asChild>
              <Button asChild className="mt-2 rounded-full">
                <a
                  href={isHome ? "#studio" : "/#studio"}
                  className="gap-2"
                >
                  Open studio <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </SheetClose>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
