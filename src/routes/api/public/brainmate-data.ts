import { createFileRoute } from "@tanstack/react-router";
import { createHash, timingSafeEqual } from "crypto";

// Private read-only data feed for BrainMate. Caller must send
// Authorization: Bearer <BRAINMATE_READ_KEY>. Only allow-listed tables, SELECT only.
const TABLES = [
  "purchase_orders", "po_line_items", "po_line_quality_checks", "po_line_step_events",
  "jobs", "job_steps", "machine_runs", "machines", "part_times", "shifts",
  "status_events", "customers", "vendors", "briefings", "date_change_log",
  "quality_matrix_items", "quality_matrix_templates",
] as const;
type Table = (typeof TABLES)[number];

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

function keyMatches(provided: string, expected: string) {
  const a = createHash("sha256").update(provided).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

export const Route = createFileRoute("/api/public/brainmate-data")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: cors }),
      GET: async ({ request }) => {
        const expected = process.env.BRAINMATE_READ_KEY;
        if (!expected) return json({ error: "not_configured" }, 503);
        const auth = request.headers.get("authorization") ?? "";
        const provided = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
        if (!provided || !keyMatches(provided, expected)) {
          return json({ error: "unauthorized" }, 401);
        }

        const url = new URL(request.url);
        const table = url.searchParams.get("table");
        if (!table) return json({ tables: TABLES });
        if (!(TABLES as readonly string[]).includes(table)) {
          return json({ error: "table_not_allowed", tables: TABLES }, 400);
        }
        const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 500) || 500, 1), 5000);
        const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin
          .from(table as Table)
          .select("*")
          .range(offset, offset + limit - 1);
        if (error) return json({ error: "query_failed" }, 500);
        return json({ table, offset, limit, count: data?.length ?? 0, rows: data ?? [] });
      },
    },
  },
});
