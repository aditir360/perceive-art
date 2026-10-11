import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/SiteHeader";
import { BlindStudio } from "@/components/BlindStudio";

export const Route = createFileRoute("/blind")({
  head: () => ({
    meta: [
      { title: "Voice Studio — Perceive" },
      {
        name: "description",
        content:
          "A fully voice-controlled drawing studio for people who can't see the screen at all — move, draw, change colour and sound, trace shape guides, and save your art, all by speaking.",
      },
      { property: "og:title", content: "Voice Studio — Perceive" },
      {
        property: "og:description",
        content:
          "A fully voice-controlled drawing studio for people who can't see the screen at all — everything happens by speaking and listening.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: BlindPage,
});

function BlindPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main>
        <BlindStudio />
      </main>
    </div>
  );
}
