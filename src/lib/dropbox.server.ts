/**
 * Server-only Dropbox client.
 *
 * Auth model: one team account. A refresh token obtained once by an admin is
 * stored in public.dropbox_config (server-only table) and exchanged for
 * short-lived access tokens on demand. No token ever reaches the browser.
 */
import { createHmac, timingSafeEqual } from "crypto";

const DEFAULT_REDIRECT_URI =
  "https://mego-produccion.lovable.app/api/public/dropbox-callback";

export interface DropboxConfigRow {
  refresh_token: string | null;
  account_name: string | null;
  account_email: string | null;
  root_folder: string;
  connected_at: string | null;
}

export interface DropboxFile {
  id: string;
  name: string;
  path_lower: string;
  path_display: string;
  size: number | null;
  server_modified: string | null;
  rev_from_name: string | null;
}

function appKey(): string {
  const v = process.env["DROPBOX_APP_KEY"];
  if (!v) throw new Error("Dropbox no está configurado (falta DROPBOX_APP_KEY)");
  return v;
}

function appSecret(): string {
  const v = process.env["DROPBOX_APP_SECRET"];
  if (!v) throw new Error("Dropbox no está configurado (falta DROPBOX_APP_SECRET)");
  return v;
}

export function redirectUri(): string {
  return process.env["DROPBOX_REDIRECT_URI"] || DEFAULT_REDIRECT_URI;
}

// ---------------------------------------------------------------- config I/O

/**
 * dropbox_config is a server-only table that is intentionally absent from the
 * generated Data API types, so we talk to it through an untyped client.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

export async function readConfig(): Promise<DropboxConfigRow> {
  const db = await admin();
  const { data, error } = await db
    .from("dropbox_config")
    .select("refresh_token, account_name, account_email, root_folder, connected_at")
    .eq("id", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (
    (data as DropboxConfigRow | null) ?? {
      refresh_token: null,
      account_name: null,
      account_email: null,
      root_folder: "",
      connected_at: null,
    }
  );
}

export async function writeConfig(
  patch: Partial<DropboxConfigRow> & { connected_by?: string | null },
): Promise<void> {
  const db = await admin();
  const { error } = await db.from("dropbox_config").update(patch).eq("id", true);
  if (error) throw new Error(error.message);
}

// ------------------------------------------------------------- OAuth helpers

/** Signed, short-lived state so the callback can't be forged or replayed. */
export function signState(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  const sig = createHmac("sha256", appSecret()).update(payload).digest("hex");
  return `${Buffer.from(payload).toString("base64url")}.${sig}`;
}

export function verifyState(state: string): { userId: string } {
  const [encoded, sig] = state.split(".");
  if (!encoded || !sig) throw new Error("Estado inválido");
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = createHmac("sha256", appSecret()).update(payload).digest("hex");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    throw new Error("Estado inválido");
  }
  const [userId, tsRaw] = payload.split(".");
  const ts = Number(tsRaw);
  if (!userId || !Number.isFinite(ts)) throw new Error("Estado inválido");
  if (Date.now() - ts > 15 * 60 * 1000)
    throw new Error("El enlace expiró, vuelve a intentar");
  return { userId };
}

export function authorizeUrl(state: string): string {
  const p = new URLSearchParams({
    client_id: appKey(),
    response_type: "code",
    token_access_type: "offline",
    redirect_uri: redirectUri(),
    state,
  });
  return `https://www.dropbox.com/oauth2/authorize?${p.toString()}`;
}

async function tokenRequest(body: URLSearchParams): Promise<Record<string, unknown>> {
  const basic = Buffer.from(`${appKey()}:${appSecret()}`).toString("base64");
  const res = await fetch("https://api.dropbox.com/oauth2/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Dropbox token request failed [${res.status}]: ${text}`);
    throw new Error(`Dropbox rechazó la autenticación [${res.status}]: ${text}`);
  }
  return JSON.parse(text) as Record<string, unknown>;
}

/** Exchange the authorization code for a long-lived refresh token. */
export async function exchangeCode(code: string): Promise<string> {
  const json = await tokenRequest(
    new URLSearchParams({
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
    }),
  );
  const refresh = json["refresh_token"];
  if (typeof refresh !== "string") {
    throw new Error(
      "Dropbox no devolvió refresh token — revisa token_access_type=offline",
    );
  }
  return refresh;
}

let cachedToken: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.token;
  }
  const cfg = await readConfig();
  if (!cfg.refresh_token) throw new Error("Dropbox no está conectado");
  const json = await tokenRequest(
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: cfg.refresh_token,
    }),
  );
  const token = json["access_token"];
  const expiresIn = Number(json["expires_in"] ?? 14400);
  if (typeof token !== "string") throw new Error("Dropbox no devolvió access token");
  cachedToken = { token, expiresAt: Date.now() + expiresIn * 1000 };
  return token;
}

export function resetTokenCache(): void {
  cachedToken = null;
}

// ------------------------------------------------------------------ RPC core

async function rpc<T>(path: string, body: unknown): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`https://api.dropboxapi.com/2/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body === null ? "null" : JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    console.error(`Dropbox ${path} failed [${res.status}]: ${text}`);
    throw new Error(`Dropbox ${path} falló [${res.status}]: ${text}`);
  }
  return (text ? JSON.parse(text) : null) as T;
}

// ------------------------------------------------------------------ Wrappers

export interface DropboxAccount {
  name: string;
  email: string;
}

export async function getCurrentAccount(): Promise<DropboxAccount> {
  const json = await rpc<{
    name?: { display_name?: string };
    email?: string;
  }>("users/get_current_account", null);
  return {
    name: json.name?.display_name ?? "Dropbox",
    email: json.email ?? "",
  };
}

/** Pull a revision token out of a filename, e.g. `..._REV_C_...` -> `C`. */
export function revFromName(name: string): string | null {
  const m =
    name.match(/\brev[\s._-]*([A-Z0-9]{1,3})\b/i) ??
    name.match(/\bR([0-9]{1,3})\b/);
  return m ? m[1].toUpperCase() : null;
}

interface SearchMatch {
  metadata?: {
    metadata?: {
      ".tag"?: string;
      id?: string;
      name?: string;
      path_lower?: string;
      path_display?: string;
      size?: number;
      server_modified?: string;
    };
  };
}

export async function searchFiles(
  query: string,
  opts: { root?: string; limit?: number } = {},
): Promise<DropboxFile[]> {
  const root = (opts.root ?? "").trim();
  const json = await rpc<{ matches?: SearchMatch[] }>("files/search_v2", {
    query,
    options: {
      path: root ? root : undefined,
      max_results: Math.min(opts.limit ?? 25, 100),
      file_status: "active",
      filename_only: false,
    },
  });
  const files: DropboxFile[] = [];
  for (const m of json.matches ?? []) {
    const md = m.metadata?.metadata;
    if (!md || md[".tag"] !== "file" || !md.path_lower) continue;
    files.push({
      id: md.id ?? md.path_lower,
      name: md.name ?? md.path_lower.split("/").pop() ?? "archivo",
      path_lower: md.path_lower,
      path_display: md.path_display ?? md.path_lower,
      size: md.size ?? null,
      server_modified: md.server_modified ?? null,
      rev_from_name: revFromName(md.name ?? ""),
    });
  }
  return files;
}

export async function temporaryLink(path: string): Promise<string> {
  const json = await rpc<{ link?: string }>("files/get_temporary_link", { path });
  if (!json.link) throw new Error("Dropbox no devolvió un enlace");
  return json.link;
}

export interface DropboxFolder {
  name: string;
  path_lower: string;
  path_display: string;
}

export async function listFolders(path: string): Promise<DropboxFolder[]> {
  const json = await rpc<{
    entries?: Array<{
      ".tag"?: string;
      name?: string;
      path_lower?: string;
      path_display?: string;
    }>;
  }>("files/list_folder", {
    path: path.trim() === "/" ? "" : path.trim(),
    limit: 500,
  });
  return (json.entries ?? [])
    .filter((e) => e[".tag"] === "folder" && e.path_lower)
    .map((e) => ({
      name: e.name ?? "",
      path_lower: e.path_lower!,
      path_display: e.path_display ?? e.path_lower!,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}