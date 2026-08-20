import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const STATUS = ["documented", "new_rev_pending", "not_documented", "requested_from_customer"] as const;

async function rolesOf(supabase: unknown, userId: string | null | undefined): Promise<string[]> {
  if (!userId) throw new Error("No autenticado");
  const client = supabase as {
    from: (t: string) => {
      select: (c: string) => { eq: (a: string, b: string) => Promise<{ data: Array<{ role: string }> | null; error: { message: string } | null }> };
    };
  };
  const { data, error } = await client.from("user_roles").select("role").eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => r.role);
}

/** Engineering may flag / attach / request documents. */
async function assertCanFlag(supabase: unknown, userId: string | null | undefined) {
  const list = await rolesOf(supabase, userId);
  if (!list.some((r) => ["admin", "manager", "engineer", "quality"].includes(r))) {
    throw new Error("Prohibido — se requiere rol de Ingeniería o Calidad");
  }
}

/** Only Calidad (or admin/manager) sets the controlled revision. */
async function assertCanDocument(supabase: unknown, userId: string | null | undefined) {
  const list = await rolesOf(supabase, userId);
  if (!list.some((r) => ["admin", "manager", "quality"].includes(r))) {
    throw new Error("Prohibido — se requiere rol de Calidad");
  }
}

const matrixSelect =
  "id, pir, part_description, documented_rev, status, dropbox_path, dropbox_name, source, requested_at, documented_at, documented_by, notes, created_at, updated_at";

export const getMatrixEntryForPir = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ pir: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const pir = data.pir.trim();
    const { data: entry, error } = await context.supabase
      .from("qc_document_matrix")
      .select(matrixSelect)
      .eq("pir", pir)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!entry) return { entry: null, events: [] };

    const { data: events, error: eErr } = await context.supabase
      .from("qc_document_events")
      .select("id, kind, from_status, to_status, from_rev, to_rev, note, occurred_at")
      .eq("matrix_id", entry.id)
      .order("occurred_at", { ascending: false })
      .limit(30);
    if (eErr) throw new Error(eErr.message);
    return { entry, events: events ?? [] };
  });

export const listMatrix = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ search: z.string().optional(), status: z.enum(STATUS).optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }) => {
    let q = context.supabase.from("qc_document_matrix").select(matrixSelect).order("pir");
    if (data.status) q = q.eq("status", data.status);
    if (data.search?.trim()) q = q.ilike("pir", `%${data.search.trim()}%`);
    const { data: rows, error } = await q.limit(500);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

export const listPendingQualityActions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: rows, error } = await context.supabase
      .from("qc_document_matrix")
      .select(matrixSelect)
      .in("status", ["new_rev_pending", "not_documented", "requested_from_customer"])
      .order("updated_at", { ascending: false })
      .limit(300);
    if (error) throw new Error(error.message);
    return { rows: rows ?? [] };
  });

type MatrixRow = { id: string; status: string; documented_rev: string | null };

async function ensureEntry(
  admin: typeof import("@/integrations/supabase/client.server")["supabaseAdmin"],
  pir: string,
  partDescription?: string | null,
): Promise<MatrixRow> {
  const { data: existing, error } = await admin
    .from("qc_document_matrix")
    .select("id, status, documented_rev")
    .eq("pir", pir)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (existing) return existing as MatrixRow;
  const { data: created, error: cErr } = await admin
    .from("qc_document_matrix")
    .insert({ pir, part_description: partDescription ?? null, status: "not_documented" })
    .select("id, status, documented_rev")
    .single();
  if (cErr) throw new Error(cErr.message);
  return created as MatrixRow;
}

const actionInput = z.object({
  pir: z.string().min(1),
  poLineItemId: z.string().uuid().nullable().optional(),
  rev: z.string().nullable().optional(),
  note: z.string().nullable().optional(),
  partDescription: z.string().nullable().optional(),
});

export const requestRevisionUpdate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => actionInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCanFlag(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entry = await ensureEntry(supabaseAdmin, data.pir.trim(), data.partDescription);
    const { error } = await supabaseAdmin
      .from("qc_document_matrix")
      .update({ status: "new_rev_pending", notes: data.note ?? null })
      .eq("id", entry.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("qc_document_events").insert({
      matrix_id: entry.id,
      po_line_item_id: data.poLineItemId ?? null,
      kind: "revision_update_requested",
      from_status: entry.status,
      to_status: "new_rev_pending",
      from_rev: entry.documented_rev,
      to_rev: data.rev ?? null,
      actor: context.userId,
      note: data.note ?? null,
    });
    return { ok: true };
  });

export const markRequestedFromCustomer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => actionInput.parse(input))
  .handler(async ({ data, context }) => {
    await assertCanFlag(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entry = await ensureEntry(supabaseAdmin, data.pir.trim(), data.partDescription);
    const { error } = await supabaseAdmin
      .from("qc_document_matrix")
      .update({
        status: "requested_from_customer",
        requested_at: new Date().toISOString(),
        notes: data.note ?? null,
      })
      .eq("id", entry.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("qc_document_events").insert({
      matrix_id: entry.id,
      po_line_item_id: data.poLineItemId ?? null,
      kind: "requested_from_customer",
      from_status: entry.status,
      to_status: "requested_from_customer",
      actor: context.userId,
      note: data.note ?? null,
    });
    return { ok: true };
  });

export const attachPlanToMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    actionInput
      .extend({ dropboxPath: z.string().min(1), dropboxName: z.string().min(1) })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanFlag(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entry = await ensureEntry(supabaseAdmin, data.pir.trim(), data.partDescription);
    const { error } = await supabaseAdmin
      .from("qc_document_matrix")
      .update({
        dropbox_path: data.dropboxPath,
        dropbox_name: data.dropboxName,
        source: "dropbox",
        status: entry.status === "documented" ? "documented" : "new_rev_pending",
      })
      .eq("id", entry.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("qc_document_events").insert({
      matrix_id: entry.id,
      po_line_item_id: data.poLineItemId ?? null,
      kind: "plan_attached",
      from_status: entry.status,
      to_status: entry.status === "documented" ? "documented" : "new_rev_pending",
      to_rev: data.rev ?? null,
      actor: context.userId,
      note: data.dropboxName,
    });
    return { ok: true };
  });

export const markDocumented = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    actionInput.extend({ rev: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanDocument(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const entry = await ensureEntry(supabaseAdmin, data.pir.trim(), data.partDescription);
    const { error } = await supabaseAdmin
      .from("qc_document_matrix")
      .update({
        status: "documented",
        documented_rev: data.rev,
        documented_at: new Date().toISOString(),
        documented_by: context.userId,
        notes: data.note ?? null,
      })
      .eq("id", entry.id);
    if (error) throw new Error(error.message);
    await supabaseAdmin.from("qc_document_events").insert({
      matrix_id: entry.id,
      po_line_item_id: data.poLineItemId ?? null,
      kind: "documented",
      from_status: entry.status,
      to_status: "documented",
      from_rev: entry.documented_rev,
      to_rev: data.rev,
      actor: context.userId,
      note: data.note ?? null,
    });
    return { ok: true };
  });

export const upsertMatrixEntry = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        pir: z.string().min(1),
        partDescription: z.string().nullable().optional(),
        documentedRev: z.string().nullable().optional(),
        status: z.enum(STATUS),
        notes: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanDocument(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("qc_document_matrix").upsert(
      {
        pir: data.pir.trim(),
        part_description: data.partDescription ?? null,
        documented_rev: data.documentedRev ?? null,
        status: data.status,
        notes: data.notes ?? null,
        documented_at: data.status === "documented" ? new Date().toISOString() : null,
        documented_by: data.status === "documented" ? context.userId : null,
      },
      { onConflict: "pir" },
    );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const importMatrixRows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        rows: z
          .array(
            z.object({
              pir: z.string().min(1),
              partDescription: z.string().nullable().optional(),
              documentedRev: z.string().nullable().optional(),
            }),
          )
          .min(1)
          .max(5000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanDocument(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const now = new Date().toISOString();
    const seen = new Set<string>();
    const payload: Array<{
      pir: string;
      part_description: string | null;
      documented_rev: string | null;
      status: string;
      documented_at: string | null;
      documented_by: string | null;
      source: string;
    }> = [];
    for (const r of data.rows) {
      const pir = r.pir.trim();
      if (!pir || seen.has(pir)) continue;
      seen.add(pir);
      const rev = r.documentedRev?.trim() || null;
      payload.push({
        pir,
        part_description: r.partDescription?.trim() || null,
        documented_rev: rev,
        status: rev ? "documented" : "not_documented",
        documented_at: rev ? now : null,
        documented_by: rev ? context.userId : null,
        source: "internal",
      });
    }
    if (payload.length === 0) return { imported: 0 };
    const { error } = await supabaseAdmin
      .from("qc_document_matrix")
      .upsert(payload, { onConflict: "pir" });
    if (error) throw new Error(error.message);
    return { imported: payload.length };
  });

export const deleteMatrixEntries = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ ids: z.array(z.string().uuid()).min(1).max(500) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertCanDocument(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("qc_document_events").delete().in("matrix_id", data.ids);
    const { error } = await supabaseAdmin.from("qc_document_matrix").delete().in("id", data.ids);
    if (error) throw new Error(error.message);
    return { deleted: data.ids.length };
  });
