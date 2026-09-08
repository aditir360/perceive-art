import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const reviewPassword = process.env.REVIEW_PASSWORD;

function getAdminClient() {
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Missing Supabase server environment variables");
  }

  return createClient(supabaseUrl, serviceRoleKey);
}

function isAuthenticated(request: Request): boolean {
  if (!reviewPassword) return false;

  const cookie = request.headers.get("cookie") ?? "";
  const expected = `perceive_review=${encodeURIComponent(reviewPassword)}`;

  return cookie.split(";").some((part) => part.trim() === expected);
}

export const Route = createFileRoute("/api/review")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        try {
          const supabase = getAdminClient();

          const { data, error } = await supabase
            .from("artworks")
            .select("id, svg, author_id, created_at, status")
            .eq("status", "pending")
            .order("created_at", { ascending: true });

          if (error) {
            console.error("Failed to load pending artwork:", error);
            return Response.json(
              { error: "Failed to load pending artwork" },
              { status: 500 },
            );
          }

          return Response.json({ artworks: data ?? [] });
        } catch (error) {
          console.error(error);
          return Response.json(
            { error: "Server configuration error" },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const body = await request.json();

          if (body.password !== reviewPassword || !reviewPassword) {
            return Response.json(
              { error: "Invalid password" },
              { status: 401 },
            );
          }

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: {
              "Content-Type": "application/json",
              "Set-Cookie": `perceive_review=${encodeURIComponent(reviewPassword)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`,
            },
          });
        } catch {
          return Response.json(
            { error: "Invalid request" },
            { status: 400 },
          );
        }
      },

      PATCH: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        try {
          const body = await request.json();
          const id = Number(body.id);
          const status = body.status;

          if (!Number.isInteger(id) || !["approved", "rejected"].includes(status)) {
            return Response.json(
              { error: "Invalid artwork update" },
              { status: 400 },
            );
          }

          const supabase = getAdminClient();

          if (status === "approved") {
            const { error } = await supabase
              .from("artworks")
              .update({ status: "approved" })
              .eq("id", id);

            if (error) {
              console.error(error);
              return Response.json(
                { error: "Failed to approve artwork" },
                { status: 500 },
              );
            }
          } else {
            const { error } = await supabase
              .from("artworks")
              .delete()
              .eq("id", id);

            if (error) {
              console.error(error);
              return Response.json(
                { error: "Failed to reject artwork" },
                { status: 500 },
              );
            }
          }

          return Response.json({ success: true });
        } catch (error) {
          console.error(error);
          return Response.json(
            { error: "Invalid request" },
            { status: 400 },
          );
        }
      },
    },
  },
});
