// FACT frontend AI boundary. The ONLY function exported is `summarize`.
// No compute / no decide / no schedule. All inputs are already-computed snapshots.

import { supabase } from "@/integrations/supabase/client";

export type SummaryKind = "daily_briefing" | "delay_explanation" | "otd_commentary";

export interface SummaryResult {
  text: string;
  source: "brainmate" | "lovable_ai_fallback";
}

export async function summarize(
  kind: SummaryKind,
  snapshot: unknown,
): Promise<SummaryResult> {
  const { data, error } = await supabase.functions.invoke("brainmate-proxy", {
    body: { kind, snapshot },
  });
  if (error) throw error;
  return data as SummaryResult;
}