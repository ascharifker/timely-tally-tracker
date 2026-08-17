import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertEngineeringReviewer(userId: string | null | undefined) {
  if (!userId) throw new Error("Not authenticated");
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const allowed = (data ?? []).some((r) =>
    ["admin", "manager", "engineer"].includes(r.role as string),
  );
  if (!allowed) throw new Error("Forbidden — Engineering role required");
}

export const getQualityMatrixTemplate = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: template, error: tErr } = await context.supabase
      .from("quality_matrix_templates")
      .select("id, name, version, is_default")
      .eq("is_default", true)
      .maybeSingle();
    if (tErr) throw new Error(tErr.message);
    if (!template) throw new Error("No default quality matrix template found");

    const { data: items, error: iErr } = await context.supabase
      .from("quality_matrix_items")
      .select("id, category, label, description, sort_order, is_active")
      .eq("template_id", template.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (iErr) throw new Error(iErr.message);

    return { template, items: items ?? [] };
  });

export const getPoLineQualityChecks = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ poLineItemId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: checks, error } = await context.supabase
      .from("po_line_quality_checks")
      .select("id, item_id, status, notes, checked_by, checked_at")
      .eq("po_line_item_id", data.poLineItemId);
    if (error) throw new Error(error.message);
    return { checks: checks ?? [] };
  });

export const saveQualityMatrixCheck = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        poLineItemId: z.string().uuid(),
        itemId: z.string().uuid(),
        status: z.enum(["pass", "fail", "n_a"]),
        notes: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertEngineeringReviewer(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("po_line_quality_checks")
      .upsert(
        {
          po_line_item_id: data.poLineItemId,
          item_id: data.itemId,
          status: data.status,
          notes: data.notes ?? null,
          checked_by: context.userId,
          checked_at: new Date().toISOString(),
        },
        { onConflict: "po_line_item_id,item_id" },
      );
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const signOffQualityMatrix = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        poLineItemId: z.string().uuid(),
        notes: z.string().nullable().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertEngineeringReviewer(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("po_line_items")
      .update({
        quality_matrix_signed_off_by: context.userId,
        quality_matrix_signed_off_at: new Date().toISOString(),
        quality_matrix_notes: data.notes ?? null,
      })
      .eq("id", data.poLineItemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const attachQualityMatrixDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        poLineItemId: z.string().uuid(),
        storagePath: z.string().min(1),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    await assertEngineeringReviewer(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("po_line_items")
      .update({ quality_matrix_document_url: data.storagePath })
      .eq("id", data.poLineItemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getQualityMatrixDocumentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ storagePath: z.string().min(1) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: signed, error } = await supabaseAdmin.storage
      .from("po-documents")
      .createSignedUrl(data.storagePath, 60);
    if (error || !signed) throw new Error("Could not generate document URL");
    return { url: signed.signedUrl };
  });
