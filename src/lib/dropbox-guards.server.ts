import type { SupabaseClient } from "@supabase/supabase-js";

type AnyClient = SupabaseClient<never, never, never>;

async function roles(
  supabase: unknown,
  userId: string | null | undefined,
): Promise<string[]> {
  if (!userId) throw new Error("No autenticado");
  const client = supabase as AnyClient;
  const { data, error } = await client
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return ((data ?? []) as Array<{ role: string }>).map((r) => r.role);
}

export async function assertAdmin(
  supabase: unknown,
  userId: string | null | undefined,
): Promise<void> {
  const list = await roles(supabase, userId);
  if (!list.includes("admin")) throw new Error("Prohibido — se requiere rol admin");
}

export async function assertEngineeringReviewer(
  supabase: unknown,
  userId: string | null | undefined,
): Promise<void> {
  const list = await roles(supabase, userId);
  const ok = list.some((r) => ["admin", "manager", "engineer"].includes(r));
  if (!ok) throw new Error("Prohibido — se requiere rol de Ingeniería");
}