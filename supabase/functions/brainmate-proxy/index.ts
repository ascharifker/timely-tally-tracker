// BrainMate proxy — the ONLY path the FACT frontend uses to talk to AI.
//
// Hard rules enforced here:
//   1. Only narrative-summary kinds are accepted (allow-list).
//   2. Payload is a pre-computed snapshot from the deterministic core.
//      The model NEVER computes schedules, OTD %, or cascade decisions.
//   3. Returns Spanish narrative text only.
//
// If BRAINMATE_API_KEY / BRAINMATE_URL are not configured, we fall back to
// Lovable AI Gateway with the same prompt contract so the demo always works.

import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

type Kind = "daily_briefing" | "delay_explanation" | "otd_commentary";
const ALLOWED: Kind[] = ["daily_briefing", "delay_explanation", "otd_commentary"];

interface ProxyRequest {
  kind: Kind;
  snapshot: unknown;
}

const SYSTEM = `Eres un asistente de producción para Mego Afek.
Hablas español neutro, conciso, técnico de planta.
SOLO redactas resúmenes y análisis narrativos sobre datos YA calculados.
NUNCA inventas números, fechas, ODFs ni tomas decisiones de programación.
Si un dato falta, di "sin dato" en vez de inventarlo.`;

function userPromptFor(kind: Kind, snapshot: unknown): string {
  const json = JSON.stringify(snapshot, null, 2);
  switch (kind) {
    case "daily_briefing":
      return `Resumen del día de producción. Datos ya calculados por el sistema:\n${json}\n\nEscribe un resumen breve (4-6 frases) cubriendo: trabajos activos por máquina, riesgos OTD, próximos hitos. No agregues recomendaciones a menos que el dato sea inequívoco.`;
    case "delay_explanation":
      return `Un trabajo se retrasó. Datos ya calculados (cascade engine):\n${json}\n\nExplica en 2-3 frases el impacto aguas abajo en lenguaje claro para el supervisor.`;
    case "otd_commentary":
      return `Métricas OTD ya calculadas por el sistema:\n${json}\n\nEscribe 2-3 frases comentando la salud OTD y señalando los trabajos en riesgo por ODF.`;
  }
}

async function callBrainmate(prompt: string): Promise<string | null> {
  const url = Deno.env.get("BRAINMATE_URL");
  const key = Deno.env.get("BRAINMATE_API_KEY");
  if (!url || !key) return null;
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ system: SYSTEM, prompt }),
    });
    if (!r.ok) return null;
    const data = await r.json();
    return data.text ?? data.content ?? data.message ?? null;
  } catch {
    return null;
  }
}

async function callLovableAi(prompt: string): Promise<string> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: prompt },
      ],
    }),
  });
  if (r.status === 429) throw new Error("rate_limited");
  if (r.status === 402) throw new Error("credits_exhausted");
  if (!r.ok) throw new Error(`AI gateway error: ${r.status}`);
  const data = await r.json();
  return data.choices?.[0]?.message?.content ?? "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Require an authenticated Supabase user. Edge functions deploy with
  // verify_jwt = false by default in Lovable, so enforce auth in code to
  // prevent unauthenticated callers from burning AI credits.
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnon =
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY");
  if (!supabaseUrl || !supabaseAnon) {
    return new Response(JSON.stringify({ error: "server_misconfigured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const authClient = createClient(supabaseUrl, supabaseAnon, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await authClient.auth.getUser(
    authHeader.replace("Bearer ", ""),
  );
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let body: ProxyRequest;
  try {
    body = (await req.json()) as ProxyRequest;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!body.kind || !ALLOWED.includes(body.kind)) {
    return new Response(
      JSON.stringify({
        error: "kind_not_allowed",
        allowed: ALLOWED,
        note: "AI is summary-only. Calculations stay in the deterministic core.",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const prompt = userPromptFor(body.kind, body.snapshot ?? {});

  try {
    const viaBrainmate = await callBrainmate(prompt);
    const text = viaBrainmate ?? (await callLovableAi(prompt));
    return new Response(
      JSON.stringify({
        text,
        source: viaBrainmate ? "brainmate" : "lovable_ai_fallback",
        kind: body.kind,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    const status = msg === "rate_limited" ? 429 : msg === "credits_exhausted" ? 402 : 500;
    return new Response(JSON.stringify({ error: msg }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});