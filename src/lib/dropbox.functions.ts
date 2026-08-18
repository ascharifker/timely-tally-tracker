import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getDropboxStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { readConfig } = await import("./dropbox.server");
    const cfg = await readConfig();
    const hasKeys =
      !!process.env["DROPBOX_APP_KEY"] && !!process.env["DROPBOX_APP_SECRET"];
    return {
      hasKeys,
      connected: !!cfg.refresh_token,
      accountName: cfg.account_name,
      accountEmail: cfg.account_email,
      rootFolder: cfg.root_folder ?? "",
      connectedAt: cfg.connected_at,
    };
  });

export const startDropboxOAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./dropbox-guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { signState, authorizeUrl, redirectUri } = await import("./dropbox.server");
    return {
      url: authorizeUrl(signState(context.userId!)),
      redirectUri: redirectUri(),
    };
  });

export const disconnectDropbox = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./dropbox-guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { writeConfig, resetTokenCache } = await import("./dropbox.server");
    await writeConfig({
      refresh_token: null,
      account_name: null,
      account_email: null,
      connected_at: null,
      connected_by: null,
    });
    resetTokenCache();
    return { ok: true };
  });

export const testDropboxConnection = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { assertAdmin } = await import("./dropbox-guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { getCurrentAccount, writeConfig } = await import("./dropbox.server");
    const account = await getCurrentAccount();
    await writeConfig({ account_name: account.name, account_email: account.email });
    return account;
  });

export const setDropboxRootFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ rootFolder: z.string().max(400) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./dropbox-guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { writeConfig } = await import("./dropbox.server");
    const clean = data.rootFolder.trim().replace(/\/+$/, "");
    await writeConfig({ root_folder: clean });
    return { rootFolder: clean };
  });

export const listDropboxFolder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ path: z.string().max(400) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertAdmin } = await import("./dropbox-guards.server");
    await assertAdmin(context.supabase, context.userId);
    const { listFolders } = await import("./dropbox.server");
    return { folders: await listFolders(data.path) };
  });

export const searchDesignPlans = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        query: z.string().trim().min(2).max(200),
        limit: z.number().int().min(1).max(50).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data }) => {
    const { readConfig, searchFiles } = await import("./dropbox.server");
    const cfg = await readConfig();
    if (!cfg.refresh_token) return { connected: false as const, files: [] };
    const files = await searchFiles(data.query, {
      root: cfg.root_folder,
      limit: data.limit ?? 25,
    });
    return { connected: true as const, files };
  });

export const getPlanTemporaryLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ path: z.string().min(1).max(400) }).parse(input),
  )
  .handler(async ({ data }) => {
    const { temporaryLink } = await import("./dropbox.server");
    return { url: await temporaryLink(data.path) };
  });

export const attachPlanToLine = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        poLineItemId: z.string().uuid(),
        path: z.string().max(400).nullable(),
        name: z.string().max(300).nullable(),
        rev: z.string().max(20).nullable(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { assertEngineeringReviewer } = await import("./dropbox-guards.server");
    await assertEngineeringReviewer(context.supabase, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("po_line_items")
      .update({
        plan_dropbox_path: data.path,
        plan_dropbox_name: data.name,
        plan_dropbox_rev: data.rev,
      })
      .eq("id", data.poLineItemId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });