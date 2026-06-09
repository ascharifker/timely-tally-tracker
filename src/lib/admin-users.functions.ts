import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getRequest } from "@tanstack/react-start/server";

function redirectFromRequest(path: string): string {
  try {
    const req = getRequest();
    const url = new URL(req.url);
    return `${url.origin}${path}`;
  } catch {
    return path;
  }
}

const APP_ROLES = [
  "admin",
  "manager",
  "po_editor",
  "coe_reviewer",
  "third_party_reviewer",
  "production_editor",
  "viewer",
] as const;
const AppRoleSchema = z.enum(APP_ROLES);

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

export interface AdminUserRow {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  roles: string[];
}

export const listUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserRow[]> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(error.message);
    const ids = list.users.map((u) => u.id);
    const { data: roleRows, error: rErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id, role")
      .in("user_id", ids.length > 0 ? ids : ["00000000-0000-0000-0000-000000000000"]);
    if (rErr) throw new Error(rErr.message);
    const byUser = new Map<string, string[]>();
    for (const r of roleRows ?? []) {
      const arr = byUser.get(r.user_id) ?? [];
      arr.push(r.role);
      byUser.set(r.user_id, arr);
    }
    return list.users.map((u) => ({
      id: u.id,
      email: u.email ?? null,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
      roles: byUser.get(u.id) ?? [],
    }));
  });

export const inviteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ email: z.string().email(), role: AppRoleSchema }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ user_id: string; action_link: string }> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.trim().toLowerCase();

    // Create user (email-confirmed; they'll set password via invite link).
    const tempPassword = crypto.randomUUID() + "Aa1!";
    const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: tempPassword,
      email_confirm: true,
    });
    if (cErr || !created.user) throw new Error(cErr?.message ?? "createUser failed");
    const userId = created.user.id;

    const { error: rErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: data.role });
    if (rErr) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      throw new Error(rErr.message);
    }

    const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirectFromRequest("/reset-password") },
    });
    if (lErr || !link.properties?.action_link) {
      throw new Error(lErr?.message ?? "generateLink failed");
    }
    return { user_id: userId, action_link: link.properties.action_link };
  });

export const copyLinkForUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({ email: z.string().email(), type: z.enum(["invite", "recovery"]).default("recovery") })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ action_link: string }> => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: link, error } = await supabaseAdmin.auth.admin.generateLink({
      type: data.type,
      email: data.email,
      options: { redirectTo: redirectFromRequest("/reset-password") },
    });
    if (error || !link.properties?.action_link) {
      throw new Error(error?.message ?? "generateLink failed");
    }
    return { action_link: link.properties.action_link };
  });

export const changeUserRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ user_id: z.string().uuid(), role: AppRoleSchema }).parse(input),
  )
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Replace all roles with the single chosen role (Sprint 1 keeps it one-role-per-user).
    const { error: delErr } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.user_id);
    if (delErr) throw new Error(delErr.message);
    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.user_id, role: data.role });
    if (insErr) throw new Error(insErr.message);
    return { ok: true };
  });

export const deleteUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ user_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }) => {
    await assertAdmin(context.userId);
    if (data.user_id === context.userId) {
      throw new Error("Refusing to delete your own admin account.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.user_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// One-off bootstrap: creates the first admin if none exists.
// Safe because it refuses to run when an admin already exists.
export const bootstrapFirstAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data }): Promise<{ user_id: string; action_link: string }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { count, error: countErr } = await supabaseAdmin
      .from("user_roles")
      .select("user_id", { count: "exact", head: true })
      .eq("role", "admin");
    if (countErr) throw new Error(countErr.message);
    if ((count ?? 0) > 0) throw new Error("Admin already exists; bootstrap disabled.");

    const email = data.email.trim().toLowerCase();

    // Check if user already exists; create if not.
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    let userId = list.users.find((u) => u.email?.toLowerCase() === email)?.id;
    if (!userId) {
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: created, error: cErr } = await supabaseAdmin.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
      });
      if (cErr || !created.user) throw new Error(cErr?.message ?? "createUser failed");
      userId = created.user.id;
    }

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: userId, role: "admin" }, { onConflict: "user_id,role" });
    if (insErr) throw new Error(insErr.message);

    const { data: link, error: lErr } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email,
      options: { redirectTo: redirectFromRequest("/reset-password") },
    });
    if (lErr || !link.properties?.action_link) {
      throw new Error(lErr?.message ?? "generateLink failed");
    }
    return { user_id: userId, action_link: link.properties.action_link };
  });

// Hard-coded allowlist of emails that should automatically receive the admin
// role on first sign-in. Keep this small.
const ADMIN_ALLOWLIST = new Set<string>(["alex.scharifker@mego-afek.com"]);

// Auth'd: if the signed-in user's email is on the allowlist, ensure they
// have the admin role. Safe to call repeatedly.
export const claimAdminIfEligible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ admin: boolean }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: u, error: uErr } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    if (uErr || !u.user) return { admin: false };
    const email = u.user.email?.toLowerCase() ?? "";
    if (!ADMIN_ALLOWLIST.has(email)) return { admin: false };
    await supabaseAdmin
      .from("user_roles")
      .upsert({ user_id: context.userId, role: "admin" }, { onConflict: "user_id,role" });
    return { admin: true };
  });

// One-off reset: delete an allowlisted user (and their role rows) so they
// can sign up fresh. Unauthenticated but locked to the allowlist.
export const resetAllowlistedUser = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => z.object({ email: z.string().email() }).parse(input))
  .handler(async ({ data }): Promise<{ deleted: boolean }> => {
    const email = data.email.trim().toLowerCase();
    if (!ADMIN_ALLOWLIST.has(email)) throw new Error("Not allowed");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error) throw new Error(error.message);
    const u = list.users.find((x) => x.email?.toLowerCase() === email);
    if (!u) return { deleted: false };
    await supabaseAdmin.from("user_roles").delete().eq("user_id", u.id);
    const { error: dErr } = await supabaseAdmin.auth.admin.deleteUser(u.id);
    if (dErr) throw new Error(dErr.message);
    return { deleted: true };
  });