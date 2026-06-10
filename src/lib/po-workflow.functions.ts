import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  ENGINEERING_STEPS,
  nextStep,
  getStep,
} from "@/lib/engineering-steps";

async function logStepEvent(opts: {
  po_line_item_id: string;
  from_step: string | null;
  to_step: string | null;
  kind: "advance" | "jump" | "flag" | "unflag" | "complete";
  actor: string | null;
  elapsed_ms: number | null;
  metadata?: Record<string, unknown>;
}) {
  await supabaseAdmin.from("po_line_step_events" as never).insert({
    po_line_item_id: opts.po_line_item_id,
    from_step: opts.from_step,
    to_step: opts.to_step,
    kind: opts.kind,
    actor: opts.actor,
    elapsed_ms: opts.elapsed_ms,
    metadata: opts.metadata ?? {},
  } as never);
}

function elapsedMs(startedAt: string | null): number | null {
  if (!startedAt) return null;
  const t = new Date(startedAt).getTime();
  if (Number.isNaN(t)) return null;
  return Date.now() - t;
}

/**
 * Advance a PO line to the next engineering step.
 * If already on the last step, the line transitions to `ready_for_production`.
 */
export const advanceEngStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error: rErr } = await supabaseAdmin
      .from("po_line_items" as never)
      .select("eng_step, eng_step_started_at, status")
      .eq("id", data.id)
      .single();
    if (rErr || !row) throw new Error(rErr?.message ?? "Line not found");
    const line = row as {
      eng_step: string | null;
      eng_step_started_at: string | null;
      status: string;
    };
    const current = line.eng_step ?? ENGINEERING_STEPS[0].key;
    const next = nextStep(current);
    const now = new Date().toISOString();
    const actor = context.userId ?? null;
    const elapsed = elapsedMs(line.eng_step_started_at);

    if (next === null) {
      // Finished last step → ready for production.
      const { error } = await supabaseAdmin
        .from("po_line_items" as never)
        .update({
          status: "ready_for_production",
          eng_step: null,
          eng_step_started_at: null,
          engineering_reviewed_at: now,
          engineering_reviewed_by: actor,
          flag_reason: null,
        } as never)
        .eq("id", data.id);
      if (error) throw new Error(error.message);
      await logStepEvent({
        po_line_item_id: data.id,
        from_step: current,
        to_step: null,
        kind: "complete",
        actor,
        elapsed_ms: elapsed,
      });
      return { ok: true, completed: true };
    }

    const { error } = await supabaseAdmin
      .from("po_line_items" as never)
      .update({
        eng_step: next.key,
        eng_step_started_at: now,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logStepEvent({
      po_line_item_id: data.id,
      from_step: current,
      to_step: next.key,
      kind: "advance",
      actor,
      elapsed_ms: elapsed,
    });
    return { ok: true, completed: false, to_step: next.key };
  });

/**
 * Jump a PO line to a specific engineering step (manual override).
 */
export const setEngStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        step: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const target = getStep(data.step);
    if (!target) throw new Error(`Unknown engineering step: ${data.step}`);
    const { data: row, error: rErr } = await supabaseAdmin
      .from("po_line_items" as never)
      .select("eng_step, eng_step_started_at")
      .eq("id", data.id)
      .single();
    if (rErr || !row) throw new Error(rErr?.message ?? "Line not found");
    const line = row as {
      eng_step: string | null;
      eng_step_started_at: string | null;
    };
    const now = new Date().toISOString();
    const actor = context.userId ?? null;
    const elapsed = elapsedMs(line.eng_step_started_at);

    const { error } = await supabaseAdmin
      .from("po_line_items" as never)
      .update({
        eng_step: target.key,
        eng_step_started_at: now,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    await logStepEvent({
      po_line_item_id: data.id,
      from_step: line.eng_step,
      to_step: target.key,
      kind: "jump",
      actor,
      elapsed_ms: elapsed,
    });
    return { ok: true };
  });

// Approve a PO line (engineering OK). Moves directly to ready_for_production.
export const approvePoLine = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reviewer: z.string().nullable().optional(),
        pir: z.string().nullable().optional(),
        tube_spec: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const patch: Record<string, unknown> = {
      status: "ready_for_production",
      flag_reason: null,
      engineering_reviewed_at: new Date().toISOString(),
      engineering_reviewed_by: data.reviewer ?? null,
    };
    if (data.pir !== undefined) patch.pir = data.pir;
    if (data.tube_spec !== undefined) patch.tube_spec = data.tube_spec;
    const { error } = await supabaseAdmin
      .from("po_line_items" as never)
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const flagPoLine = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        reason: z.string().min(1),
        reviewer: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("po_line_items" as never)
      .update({
        status: "engineering_flagged",
        flag_reason: data.reason,
        engineering_reviewed_at: new Date().toISOString(),
        engineering_reviewed_by: data.reviewer ?? null,
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Create an ODF from a PO line (production planning step).
export const createJobFromPoLine = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        po_line_item_id: z.string().uuid(),
        odf: z.string().min(1),
        machine_id: z.string().uuid().nullable(),
        operator_name: z.string().nullable(),
        planned_start: z.string().nullable(),
        planned_end: z.string().nullable(),
        notes: z.string().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // Load line + parent PO to copy fields.
    const { data: line, error: lErr } = await supabaseAdmin
      .from("po_line_items" as never)
      .select("*, purchase_order:purchase_orders(po_number, customer:customers(name))")
      .eq("id", data.po_line_item_id)
      .single();
    if (lErr || !line) throw new Error(lErr?.message ?? "Línea no encontrada");
    const row = line as unknown as {
      pir: string | null;
      tube_spec: string | null;
      qty_ordered: number;
      committed_date: string | null;
      purchase_order: {
        po_number: string;
        customer: { name: string | null } | null;
      } | null;
    };
    const customerName = row.purchase_order?.customer?.name?.toLowerCase() ?? "";
    const poNumber = row.purchase_order?.po_number ?? null;
    const isHalliburton = customerName.includes("halliburton");
    const isMusa = customerName.includes("musa");

    const jobInsert = {
      odf: data.odf,
      pir: row.pir,
      tube_spec: row.tube_spec,
      qty: row.qty_ordered,
      customer_date: row.committed_date,
      machine_id: data.machine_id,
      operator_name: data.operator_name,
      planned_start: data.planned_start,
      planned_end: data.planned_end,
      notes: data.notes,
      po_line_item_id: data.po_line_item_id,
      po_halliburton: isHalliburton ? poNumber : null,
      po_musa: isMusa ? poNumber : null,
      status: "PLANNED",
      priority: "normal",
    };
    const { data: job, error: jErr } = await supabaseAdmin
      .from("jobs" as never)
      .insert(jobInsert as never)
      .select("id")
      .single();
    if (jErr) throw new Error(jErr.message);

    const { error: uErr } = await supabaseAdmin
      .from("po_line_items" as never)
      .update({ status: "scheduled" } as never)
      .eq("id", data.po_line_item_id);
    if (uErr) throw new Error(uErr.message);

    return { job_id: (job as { id: string }).id };
  });

export const acknowledgeDateChange = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("date_change_log" as never)
      .update({
        acknowledged_by_peter: true,
        acknowledged_at: new Date().toISOString(),
      } as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// Acknowledge ALL pending date changes (Peter clicks "Marcar todo visto").
export const acknowledgeAllDateChanges = createServerFn({ method: "POST" }).handler(
  async () => {
    const { error } = await supabaseAdmin
      .from("date_change_log" as never)
      .update({
        acknowledged_by_peter: true,
        acknowledged_at: new Date().toISOString(),
      } as never)
      .eq("acknowledged_by_peter", false);
    if (error) throw new Error(error.message);
    return { ok: true };
  },
);

// Inline edit a single PO-line field (PIR, tube_spec, qty_ordered,
// committed_date, notes). For non-date fields we log the previous value into
// date_change_log too — `field` is free text, so we reuse the same table.
const EDITABLE_FIELDS = [
  "pir",
  "tube_spec",
  "qty_ordered",
  "committed_date",
  "notes",
] as const;

export const updatePoLineField = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        id: z.string().uuid(),
        field: z.enum(EDITABLE_FIELDS),
        value: z.union([z.string(), z.number(), z.null()]),
        changed_by: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // Load the prior value so we can log the diff for non-date fields. The DB
    // trigger already logs committed_date changes, so we skip those here.
    const { data: prev, error: prevErr } = await supabaseAdmin
      .from("po_line_items" as never)
      .select(data.field)
      .eq("id", data.id)
      .single();
    if (prevErr || !prev) {
      throw new Error(prevErr?.message ?? "Línea no encontrada");
    }
    const prevValue = (prev as Record<string, unknown>)[data.field] ?? null;

    const patch: Record<string, unknown> = { [data.field]: data.value };
    const { error } = await supabaseAdmin
      .from("po_line_items" as never)
      .update(patch as never)
      .eq("id", data.id);
    if (error) throw new Error(error.message);

    if (data.field !== "committed_date") {
      // committed_date is logged by the DB trigger already.
      const oldStr = prevValue === null ? null : String(prevValue);
      const newStr = data.value === null ? null : String(data.value);
      if (oldStr !== newStr) {
        await supabaseAdmin.from("date_change_log" as never).insert({
          po_line_item_id: data.id,
          field: data.field,
          // old_value/new_value are date columns; we coerce text into reason
          // for non-date fields so the diff still travels through the log.
          old_value: null,
          new_value: null,
          changed_by: data.changed_by ?? null,
          reason: `${oldStr ?? "—"} → ${newStr ?? "—"}`,
        } as never);
      }
    }
    return { ok: true };
  });