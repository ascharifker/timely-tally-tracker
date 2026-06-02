import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

const STEPS_TEMPLATE = [
  { step_order: 1, step_name: "MAZAK" },
  { step_order: 2, step_name: "MAQUINADO_LISTO" },
  { step_order: 3, step_name: "CEMENTACION" },
  { step_order: 4, step_name: "CEMENTACION_LISTO" },
  { step_order: 5, step_name: "EXPO" },
  { step_order: 6, step_name: "YA_SE_ENVIO" },
] as const;

const SHIFT_HOURS = { manana: 7, tarde: 15, noche: 23 } as const;

function startDatetimeFromShift(date: string, slot: keyof typeof SHIFT_HOURS): Date {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, (m ?? 1) - 1, d ?? 1, SHIFT_HOURS[slot], 0, 0, 0);
  return dt;
}

// ---------------------------------------------------------------
// Split a PO line into an ODF (nnn/yy + multi-step + shifts).
// ---------------------------------------------------------------

export const splitPoLineIntoOdf = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        po_line_item_id: z.string().uuid(),
        odf: z.string().min(1).nullable(),
        qty_parcial: z.number().int().positive(),
        machine_id: z.string().uuid().nullable(),
        vendor_id: z.string().uuid().nullable(),
        operator_name: z.string().nullable(),
        start_date: z.string().min(1),
        start_shift: z.enum(["manana", "tarde", "noche"]),
        shifts_required: z.number().positive(),
        export_date: z.string().nullable(),
        notes: z.string().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    // 1. Load line + parent PO.
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
      export_date: string | null;
      purchase_order: {
        po_number: string;
        customer: { name: string | null } | null;
      } | null;
    };

    // 2. Compute already-planned qty for this line.
    const { data: siblings, error: sErr } = await supabaseAdmin
      .from("jobs" as never)
      .select("qty")
      .eq("po_line_item_id", data.po_line_item_id);
    if (sErr) throw new Error(sErr.message);
    const planned = ((siblings as { qty: number }[]) ?? []).reduce(
      (acc, j) => acc + (j.qty ?? 0),
      0,
    );
    const pending = row.qty_ordered - planned;
    if (data.qty_parcial > pending) {
      throw new Error(`Pediste ${data.qty_parcial} pero solo quedan ${pending} pendientes`);
    }

    // 3. Resolve ODF number (nnn/yy) if caller didn't force one.
    let odfNumber = data.odf?.trim() ?? "";
    if (!odfNumber) {
      const year = new Date().getFullYear();
      const { data: numRes, error: nErr } = await supabaseAdmin.rpc(
        "next_odf_number" as never,
        { p_year: year } as never,
      );
      if (nErr) throw new Error(nErr.message);
      odfNumber = numRes as unknown as string;
    }

    // 4. Compute planned start/end from shift selection.
    const startDt = startDatetimeFromShift(data.start_date, data.start_shift);
    const endDt = new Date(startDt.getTime() + data.shifts_required * 8 * 60 * 60 * 1000);

    const customerName = row.purchase_order?.customer?.name?.toLowerCase() ?? "";
    const poNumber = row.purchase_order?.po_number ?? null;
    const isHalliburton = customerName.includes("halliburton");
    const isMusa = customerName.includes("musa");

    // 5. Insert job.
    const { data: job, error: jErr } = await supabaseAdmin
      .from("jobs" as never)
      .insert({
        odf: odfNumber,
        pir: row.pir,
        tube_spec: row.tube_spec,
        qty: data.qty_parcial,
        customer_date: row.committed_date,
        export_date: data.export_date ?? row.export_date,
        machine_id: data.machine_id,
        operator_name: data.operator_name,
        planned_start: startDt.toISOString(),
        planned_end: endDt.toISOString(),
        notes: data.notes,
        po_line_item_id: data.po_line_item_id,
        po_halliburton: isHalliburton ? poNumber : null,
        po_musa: isMusa ? poNumber : null,
        status: "EN_ESPERA",
        priority: "normal",
      } as never)
      .select("id")
      .single();
    if (jErr) throw new Error(jErr.message);
    const jobId = (job as { id: string }).id;

    // 6. Insert the 6 standard steps. MAZAK gets planned dates + machine; CEMENTACION gets vendor.
    const stepRows = STEPS_TEMPLATE.map((s) => ({
      job_id: jobId,
      step_order: s.step_order,
      step_name: s.step_name,
      status: "PLANNED" as const,
      machine_id: s.step_name === "MAZAK" ? data.machine_id : null,
      vendor_id: s.step_name === "CEMENTACION" ? data.vendor_id : null,
      planned_start: s.step_name === "MAZAK" ? startDt.toISOString() : null,
      planned_end: s.step_name === "MAZAK" ? endDt.toISOString() : null,
    }));
    const { error: stepErr } = await supabaseAdmin
      .from("job_steps" as never)
      .insert(stepRows as never);
    if (stepErr) throw new Error(stepErr.message);

    // 7. Update PO line status: scheduled if fully planned, otherwise in_progress.
    const newStatus = data.qty_parcial === pending ? "scheduled" : "in_progress";
    const { error: uErr } = await supabaseAdmin
      .from("po_line_items" as never)
      .update({ status: newStatus } as never)
      .eq("id", data.po_line_item_id);
    if (uErr) throw new Error(uErr.message);

    return { job_id: jobId, odf: odfNumber, pending_remaining: pending - data.qty_parcial };
  });

// ---------------------------------------------------------------
// Advance a job to the next step. Marks current step complete, derives
// jobs.status from the next pending step.
// ---------------------------------------------------------------

const STATUS_FROM_STEP: Record<string, string> = {
  MAZAK: "MAZAK",
  MAQUINADO_LISTO: "MAQUINADO_LISTO",
  CEMENTACION: "CEMENTACION",
  CEMENTACION_LISTO: "CEMENTACION_LISTO",
  EXPO: "EXPO",
  YA_SE_ENVIO: "YA_SE_ENVIO",
};

export const advanceJobStep = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ job_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: steps, error } = await supabaseAdmin
      .from("job_steps" as never)
      .select("*")
      .eq("job_id", data.job_id)
      .order("step_order", { ascending: true });
    if (error) throw new Error(error.message);
    const list = (steps as { id: string; step_order: number; step_name: string; completed_at: string | null }[]) ?? [];
    const current = list.find((s) => !s.completed_at);
    if (!current) throw new Error("La ODF ya está completa");

    const nowIso = new Date().toISOString();
    const { error: cErr } = await supabaseAdmin
      .from("job_steps" as never)
      .update({ completed_at: nowIso, status: "YA_SE_ENVIO" } as never)
      .eq("id", current.id);
    if (cErr) throw new Error(cErr.message);

    const next = list.find((s) => s.step_order > current.step_order);
    const nextStatus = next ? STATUS_FROM_STEP[next.step_name] ?? "MAZAK" : "YA_SE_ENVIO";
    if (next) {
      await supabaseAdmin
        .from("job_steps" as never)
        .update({ started_at: nowIso, status: nextStatus } as never)
        .eq("id", next.id);
    }
    const { error: jErr } = await supabaseAdmin
      .from("jobs" as never)
      .update({ status: nextStatus } as never)
      .eq("id", data.job_id);
    if (jErr) throw new Error(jErr.message);
    return { ok: true, next_status: nextStatus };
  });

// ---------------------------------------------------------------
// Hold / resume a job.
// ---------------------------------------------------------------

export const holdJob = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ job_id: z.string().uuid(), reason: z.string().nullable() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { error } = await supabaseAdmin
      .from("jobs" as never)
      .update({ status: "ON_HOLD", notes: data.reason ?? undefined } as never)
      .eq("id", data.job_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const resumeJob = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ job_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data }) => {
    const { data: steps, error } = await supabaseAdmin
      .from("job_steps" as never)
      .select("step_name, completed_at, step_order")
      .eq("job_id", data.job_id)
      .order("step_order", { ascending: true });
    if (error) throw new Error(error.message);
    const next = ((steps as { step_name: string; completed_at: string | null }[]) ?? []).find(
      (s) => !s.completed_at,
    );
    const status = next ? STATUS_FROM_STEP[next.step_name] ?? "EN_ESPERA" : "YA_SE_ENVIO";
    const { error: uErr } = await supabaseAdmin
      .from("jobs" as never)
      .update({ status } as never)
      .eq("id", data.job_id);
    if (uErr) throw new Error(uErr.message);
    return { ok: true, status };
  });

// ---------------------------------------------------------------
// Cascading delay — push a step's planned_end by N hours; shift every
// later step by the same amount; if the last step's planned_end now
// exceeds committed_date or export_date, log a delay event.
// ---------------------------------------------------------------

export const applyCascadingDelay = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        job_step_id: z.string().uuid(),
        delay_hours: z.number().positive(),
        reason: z.string().nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { data: step, error } = await supabaseAdmin
      .from("job_steps" as never)
      .select("id, job_id, step_order, planned_start, planned_end")
      .eq("id", data.job_step_id)
      .single();
    if (error || !step) throw new Error(error?.message ?? "Paso no encontrado");
    const s = step as {
      id: string;
      job_id: string;
      step_order: number;
      planned_start: string | null;
      planned_end: string | null;
    };
    const delayMs = data.delay_hours * 60 * 60 * 1000;

    const { data: allSteps, error: aErr } = await supabaseAdmin
      .from("job_steps" as never)
      .select("id, step_order, planned_start, planned_end")
      .eq("job_id", s.job_id)
      .order("step_order", { ascending: true });
    if (aErr) throw new Error(aErr.message);
    const list = (allSteps as {
      id: string;
      step_order: number;
      planned_start: string | null;
      planned_end: string | null;
    }[]) ?? [];

    for (const st of list) {
      if (st.step_order < s.step_order) continue;
      const newStart =
        st.id === s.id
          ? st.planned_start
          : st.planned_start
            ? new Date(new Date(st.planned_start).getTime() + delayMs).toISOString()
            : null;
      const newEnd = st.planned_end
        ? new Date(new Date(st.planned_end).getTime() + delayMs).toISOString()
        : null;
      await supabaseAdmin
        .from("job_steps" as never)
        .update({ planned_start: newStart, planned_end: newEnd } as never)
        .eq("id", st.id);
    }

    // Propagate to job.planned_end (= last step planned_end).
    const last = list[list.length - 1];
    const newJobEnd = last?.planned_end
      ? new Date(new Date(last.planned_end).getTime() + delayMs).toISOString()
      : null;
    if (newJobEnd) {
      await supabaseAdmin
        .from("jobs" as never)
        .update({ planned_end: newJobEnd } as never)
        .eq("id", s.job_id);
    }

    await supabaseAdmin.from("status_events" as never).insert({
      job_id: s.job_id,
      event_kind: "delay",
      delay_hours: data.delay_hours,
      reason: data.reason,
      to_status: "EN_ESPERA",
    } as never);

    return { ok: true, new_job_end: newJobEnd };
  });