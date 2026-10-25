import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { CollabStudio } from "@/components/CollabStudio";

export const Route = createFileRoute("/collab")({
  // /collab?code=ABC123 opens straight into that private room (invite links).
  validateSearch: (search: Record<string, unknown>): { code?: string } => ({
    code: typeof search.code === "string" ? search.code : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Collab Studio — Perceive" },
      {
        name: "description",
        content:
          "Draw together in real time. Join a public room with other creators, or make a private room and share a code with up to five friends.",
      },
      { property: "og:title", content: "Collab Studio — Perceive" },
      {
        property: "og:description",
        content:
          "Draw together in real time. Join a public room with other creators, or make a private room and share a code with up to five friends.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: CollabPage,
});

function CollabPage() {
  const { code } = Route.useSearch();

  return (
    <div className="min-h-screen">
      {/* Background atmosphere, matching the other pages */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute bottom-0 left-1/2 h-80 w-[42rem] -translate-x-1/2 rounded-full bg-secondary/20 blur-3xl" />
      </div>

      <SiteHeader />
      <main>
        <CollabStudio initialCode={code} />
      </main>
    </div>
  );
}
