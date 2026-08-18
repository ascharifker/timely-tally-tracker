# Dropbox integration — Phase A (search & open design plans)

## Parked: QC Matrix
The Quality Matrix v2 work stays parked until after tomorrow's meeting with Catalina. Nothing from the QC plan gets built in this pass; we revisit it with her real process (who fills which form, how specs version against PIR/drawing revisions, out-of-tolerance disposition, and whether the app or the signed Excel is the legal record).

## Dropbox: how we connect

There is no managed Dropbox connector available, so we register a **Dropbox app** on Mego's account and talk to the Dropbox API from server functions using a long-lived refresh token. This is a one-time setup:

1. You create a Dropbox app (scoped access) in the Dropbox App Console and grant it `files.metadata.read`, `files.content.read`, and `sharing.write`.
2. You do the OAuth authorize step once from an admin screen in the platform; we exchange the code for a refresh token.
3. We store `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`, and the resulting `DROPBOX_REFRESH_TOKEN` as backend secrets. Access tokens are minted server-side on demand and never touch the browser.

This is a team-account connection (one Mego Dropbox), not per-user login — which matches how Engineering shares design plans today.

## What Phase A delivers

### Design plans panel in the Engineering drawer
- New **Planos** panel visible in the engineering drawer for a PO line.
- Auto-searches Dropbox using the line's PIR (and revision when present) as the query, scoped to a configured root folder.
- Results list: file name, folder path, size, modified date, and revision guessed from the filename (e.g. `REV_C`).
- Actions per result:
  - **Abrir** — opens a short-lived temporary link (Dropbox `get_temporary_link`) in a new tab.
  - **Vista previa** — inline PDF/image preview in a dialog for the common cases.
  - **Adjuntar a la línea** — saves the Dropbox path + rev on the PO line so the same plan opens instantly next time without searching.
- Manual search box so Engineering can query by drawing number or free text when the PIR match misses.
- Revision mismatch hint: if the best-matching file's filename revision differs from the line's `pir_rev`, show an amber "Dropbox tiene REV X" note.

### Dropbox settings tab
- New **Dropbox** tab in Settings (admin only): connect/disconnect, show connection status and account name, set the **root folder** for design-plan searches, and a "Probar conexión" button.
- A folder browser so you pick the root folder instead of typing a path.

### Caching
- Search results cached briefly (per PIR) so repeated drawer opens don't re-hit Dropbox.
- Attached plan links resolve straight to a temporary link — no search needed.

## Technical notes

- `src/lib/dropbox.server.ts` — token minting (refresh-token grant, cached in memory until expiry) and thin wrappers for `files/search_v2`, `files/get_metadata`, `files/get_temporary_link`, `files/list_folder`, `users/get_current_account`.
- `src/lib/dropbox.functions.ts` — thin `createServerFn` wrappers only: `getDropboxStatus`, `startDropboxOAuth`, `completeDropboxOAuth`, `searchDesignPlans`, `getPlanTemporaryLink`, `listDropboxFolder`, `attachPlanToLine`. Admin-gated for setup functions; engineering-gated for attach.
- OAuth callback as a server route at `src/routes/api/public/dropbox-callback.ts`, verifying a signed state parameter before exchanging the code.
- Migration: `dropbox_config` table (single row: root folder, connected account, connected_at) plus `plan_dropbox_path` and `plan_dropbox_rev` columns on `po_line_items`. GRANTs + RLS: read for authenticated, write for admin (config) and engineer/admin/manager (line columns).
- New component `src/components/fact/DesignPlansPanel.tsx` used by `EngStepDrawer`; new `src/components/settings/DropboxPanel.tsx` wired into the Settings tabs.
- Secrets requested via the secrets tool at build time: `DROPBOX_APP_KEY`, `DROPBOX_APP_SECRET`.

## Phase B (not in this pass)

Master PIR sync — index the ~10k-line MASTER PIR from Dropbox into a searchable table and auto-verify a line's PIR + revision against it. Needs the actual file's column headers first, and a decision on whether we ever write back into that shared workbook or only emit a change report.

## Acceptance criteria

- Admin can connect Dropbox from Settings and see the connected account plus chosen root folder.
- Opening a PO line in engineering lists matching design plans for its PIR without leaving the app.
- Opening a plan works (temporary link) and does not expose any Dropbox token to the browser.
- A plan can be attached to a line and reopens directly on the next visit.
- A revision mismatch between the line and the Dropbox filename is visibly flagged.
