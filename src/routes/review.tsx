import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Lock, RefreshCw, X } from "lucide-react";

export const Route = createFileRoute("/review")({
  component: ReviewPage,
});

type Artwork = {
  id: number;
  svg: string;
  author_id: string;
  created_at: string;
  status: string;
};

function ReviewPage() {
  const [password, setPassword] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const loadPending = async () => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/review");

      if (response.status === 401) {
        setLoggedIn(false);
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load artwork");
      }

      const data = await response.json();

      setArtworks(data.artworks ?? []);
      setLoggedIn(true);
    } catch (error) {
      console.error(error);
      setMessage("Could not load pending artwork.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadPending();
  }, []);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      if (!response.ok) {
  const data = await response.json().catch(() => null);
  setMessage(data?.error ?? `Server error (${response.status})`);
  return;
}

      setLoggedIn(true);
      setPassword("");

      await loadPending();
    } catch (error) {
      console.error(error);
      setMessage("Could not connect to the review server.");
    } finally {
      setLoading(false);
    }
  };

  const moderate = async (
    id: number,
    status: "approved" | "rejected",
  ) => {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/review", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id, status }),
      });

      if (response.status === 401) {
        setLoggedIn(false);
        setMessage("Your review session expired.");
        return;
      }

      if (!response.ok) {
        throw new Error("Moderation failed");
      }

      setArtworks((current) =>
        current.filter((art) => art.id !== id),
      );
    } catch (error) {
      console.error(error);
      setMessage("Could not update that artwork.");
    } finally {
      setLoading(false);
    }
  };

  if (!loggedIn) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-6">
        <div className="w-full max-w-sm rounded-3xl bg-card p-8 shadow-lg ring-1 ring-primary/15">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Lock className="h-6 w-6" />
          </div>

          <h1 className="mt-5 text-center text-2xl font-bold">
            Perceive Review
          </h1>

          <p className="mt-2 text-center text-sm text-muted-foreground">
            Enter the reviewer password to manage pending artwork.
          </p>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Review password"
              autoComplete="current-password"
              className="w-full rounded-xl border border-border bg-background px-4 py-3 text-sm outline-none ring-primary/20 focus:ring-2"
              required
            />

            <Button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl"
            >
              {loading ? "Checking…" : "Sign in"}
            </Button>
          </form>

          {message && (
            <p className="mt-4 text-center text-sm text-destructive">
              {message}
            </p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b border-primary/10 bg-card/60">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <h1 className="text-2xl font-bold">
              Artwork Review
            </h1>

            <p className="text-sm text-muted-foreground">
              {artworks.length} pending submission
              {artworks.length === 1 ? "" : "s"}
            </p>
          </div>

          <Button
            onClick={() => void loadPending()}
            variant="outline"
            size="sm"
            disabled={loading}
            className="gap-2 rounded-full"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8">
        {message && (
          <div className="mb-6 rounded-2xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {message}
          </div>
        )}

        {artworks.length === 0 ? (
          <div className="rounded-3xl bg-card p-12 text-center shadow-sm ring-1 ring-primary/10">
            <Check className="mx-auto h-10 w-10 text-primary" />

            <h2 className="mt-4 text-xl font-semibold">
              Nothing waiting for review
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              New Studio submissions will appear here.
            </p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {artworks.map((art) => (
              <article
                key={art.id}
                className="overflow-hidden rounded-3xl bg-card shadow-sm ring-1 ring-primary/15"
              >
                <div
                  className="aspect-[900/560] w-full bg-white [&_svg]:h-full [&_svg]:w-full"
                  dangerouslySetInnerHTML={{
                    __html: art.svg,
                  }}
                />

                <div className="p-4">
                  <p className="mb-4 text-xs text-muted-foreground">
                    Submitted{" "}
                    {new Date(
                      art.created_at,
                    ).toLocaleString()}
                  </p>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      onClick={() =>
                        void moderate(art.id, "approved")
                      }
                      disabled={loading}
                      className="gap-2 rounded-xl"
                    >
                      <Check className="h-4 w-4" />
                      Approve
                    </Button>

                    <Button
                      onClick={() =>
                        void moderate(art.id, "rejected")
                      }
                      disabled={loading}
                      variant="outline"
                      className="gap-2 rounded-xl"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
 
