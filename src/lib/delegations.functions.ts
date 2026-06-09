import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(userId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Forbidden: admin role required");
}

const TrackSchema = z.enum(["coe", "third_party", "internal"]);

export interface DelegationRow {
  id: string;
  from_user_id: string;
  to_user_id: string;
  from_email: string | null;
  to_email: string | null;
  track: "coe" | "third_party" | "internal";
  start_date: string;
  end_date: string;
  note: string | null;
  active: boolean;
}

export const listDelegations = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DelegationRow[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("review_delegations")
      .select("*")
      .order("start_date", { ascending: false });
    if (error) throw new Error(error.message);
    const rows = (data ?? []) as Array<{
      id: string;
      from_user_id: string;
      to_user_id: string;
      track: "coe" | "third_party" | "internal";
      start_date: string;
      end_date: string;
      note: string | null;
    }>;
    const ids = Array.from(new Set(rows.flatMap((r) => [r.from_user_id, r.to_user_id])));
    const emailById = new Map<string, string>();
    if (ids.length > 0) {
      const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
      for (const u of list?.users ?? []) {
        if (u.email) emailById.set(u.id, u.email);
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    return rows.map((r) => ({
      ...r,
      from_email: emailById.get(r.from_user_id) ?? null,
      to_email: emailById.get(r.to_user_id) ?? null,
      active: r.start_date <= today && today <= r.end_date,
    }));
  });

export const createDelegation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        from_user_id: z.string().uuid(),
        to_user_id: z.string().uuid(),
        track: TrackSchema,
        start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        note: z.string().max(500).nullable().optional(),
      })
      .refine((v) => v.from_user_id !== v.to_user_id, { message: "from and to must differ" })
      .refine((v) => v.start_date <= v.end_date, { message: "end_date must be ≥ start_date" })
      .parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("review_delegations").insert({
      from_user_id: data.from_user_id,
      to_user_id: data.to_user_id,
      track: data.track,
      start_date: data.start_date,
      end_date: data.end_date,
      note: data.note ?? null,
      created_by: context.userId,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteDelegation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("review_delegations")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });