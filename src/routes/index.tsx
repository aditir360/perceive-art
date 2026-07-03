import { createFileRoute } from "@tanstack/react-router";
import { Sketchpad } from "@/components/Sketchpad";
import bearLogo from "@/assets/bear-logo.jpg.asset.json";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  return (
    <div className="min-h-screen bg-background">
      <header className="mx-auto flex max-w-6xl items-center gap-4 px-6 pt-8">
        <img
          src={bearLogo.url}
          alt="Sonic Bear Studio logo — a cute bear wearing headphones drawing on a tablet"
          className="h-20 w-20 rounded-full shadow-md ring-4 ring-primary/30"
        />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            Sonic Bear Studio
          </h1>
          <p className="text-sm text-muted-foreground">
            A cute audio-tactile sketchpad. Draw with sound. Export for swell paper or 3D printing.
          </p>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Sketchpad />
      </main>
      <footer className="mx-auto max-w-6xl px-6 pb-10 text-center text-xs text-muted-foreground">
        Made with 🩷 for accessible creativity.
      </footer>
    </div>
  );
}
