import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface BulkImportResult {
  inserted: number;
  skipped: number;
  errors: Array<{ rowIndex: number; message: string }>;
}

export const bulkImportMaquinados = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { rows: Array<Record<string, unknown>> }) => {
    if (!input || !Array.isArray(input.rows)) {
      throw new Error("Invalid payload");
    }
    return input;
  })
  .handler(async ({ data, context }): Promise<BulkImportResult> => {
    const { supabase, userId } = context;
    // role check
    const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    if (roleErr) throw new Error(`Role check failed: ${roleErr.message}`);
    if (!isAdmin) throw new Error("Forbidden: admin role required");

    const { data: result, error } = await supabase.rpc(
      "bulk_import_maquinados" as never,
      { payload: data.rows } as never,
    );
    if (error) throw new Error(error.message);
    return result as unknown as BulkImportResult;
  });