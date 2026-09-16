// Public health-check endpoint for BrainMate Cloud.
// GET /api/brainmate-status → { status, project, brainmate_proxy, timestamp }
//
// BrainMate pings this to confirm the project is reachable and that the
// brainmate-proxy edge function is deployed and running. The health check uses
// an OPTIONS preflight against the edge function: the deployed function answers
// 200 "ok" before any auth or AI work, so the check is cheap and burns no
// AI credits. No sensitive data is exposed here.

import { createFileRoute } from "@tanstack/react-router";

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

export const Route = createFileRoute("/api/public/brainmate-status")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS_HEADERS }),
      GET: async () => {
        const payload: Record<string, unknown> = {
          status: "ok",
          project: "mego-produccion",
          timestamp: new Date().toISOString(),
        };

        const supabaseUrl = process.env.SUPABASE_URL;
        if (!supabaseUrl) {
          payload.brainmate_proxy = "unknown";
          payload.detail = "backend not configured";
          return Response.json(payload, { headers: CORS_HEADERS });
        }

        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5000);
          const r = await fetch(`${supabaseUrl}/functions/v1/brainmate-proxy`, {
            method: "OPTIONS",
            signal: controller.signal,
          });
          clearTimeout(timer);
          payload.brainmate_proxy = r.ok ? "reachable" : "unreachable";
        } catch {
          payload.brainmate_proxy = "unreachable";
        }

        return Response.json(payload, { headers: CORS_HEADERS });
      },
    },
  },
});
