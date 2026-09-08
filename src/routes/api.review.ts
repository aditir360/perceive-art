import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { createHmac, timingSafeEqual } from "node:crypto";

const SESSION_COOKIE = "perceive_review_session";

function getEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }

  return value;
}

function createSessionToken(): string {
  const secret = getEnv("SESSION_SECRET");

  return createHmac("sha256", secret)
    .update("perceive-review-session")
    .digest("hex");
}

function isAuthenticated(request: Request): boolean {
  const cookieHeader = request.headers.get("cookie") ?? "";

  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${SESSION_COOKIE}=`))
    ?.slice(`${SESSION_COOKIE}=`.length);

  if (!token) return false;

  const expected = createSessionToken();

  if (token.length !== expected.length) return false;

  return timingSafeEqual(
    Buffer.from(token),
    Buffer.from(expected),
  );
}

function getAdminClient() {
  return createClient(
    getEnv("VITE_SUPABASE_URL"),
    getEnv("SUPABASE_SERVICE_ROLE_KEY"),
  );
}

function sessionCookie() {
  return [
    `${SESSION_COOKIE}=${createSessionToken()}`,
    "HttpOnly",
    "Secure",
    "SameSite=Strict",
    "Path=/",
    "Max-Age=86400",
  ].join("; ");
}

export const Route = createFileRoute("/api/review")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return Response.json(
            { error: "Unauthorized" },
            { status: 401 },
          );
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

          return Response.json({
            artworks: data ?? [],
          });
        } catch (error) {
          console.error("Review GET error:", error);

          return Response.json(
            { error: "Server configuration error" },
            { status: 500 },
          );
        }
      },

      POST: async ({ request }) => {
        try {
          const body = await request.json();
          const reviewPassword = getEnv("REVIEW_PASSWORD");

          if (
            typeof body.password !== "string" ||
            body.password !== reviewPassword
          ) {
            return Response.json(
              { error: "Invalid password" },
              { status: 401 },
            );
          }

          return Response.json(
            { success: true },
            {
              headers: {
                "Set-Cookie": sessionCookie(),
              },
            },
          );
        } catch (error) {
          console.error("Review login error:", error);

          return Response.json(
            { error: "Invalid request" },
            { status: 400 },
          );
        }
      },

      PATCH: async ({ request }) => {
        if (!isAuthenticated(request)) {
          return Response.json(
            { error: "Unauthorized" },
            { status: 401 },
          );
        }

        try {
          const body = await request.json();
          const id = Number(body.id);
          const status = body.status;

          if (
            !Number.isInteger(id) ||
            !["approved", "rejected"].includes(status)
          ) {
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
              console.error("Approve error:", error);

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
              console.error("Reject error:", error);

              return Response.json(
                { error: "Failed to reject artwork" },
                { status: 500 },
              );
            }
          }

          return Response.json({ success: true });
        } catch (error) {
          console.error("Review PATCH error:", error);

          return Response.json(
            { error: "Invalid request" },
            { status: 400 },
          );
        }
      },
    },
  },
});
