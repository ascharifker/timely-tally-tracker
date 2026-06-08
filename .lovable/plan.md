## Sprint 1 (revised per v2 roadmap + role correction)

Three P0 items. Order layer goes English; Production stays Spanish. Dates renamed. RBAC stood up with **Alex as the only admin** — Peter is not an admin, he's a scoped editor for the PO/Order process.

---

### 1. English on the Order layer (P0)

Files touched (UI strings only, no logic):
- `src/routes/purchase-orders.index.tsx`
- `src/routes/purchase-orders.$id.tsx`
- `src/components/po/PoLinesSpreadsheet.tsx`
- `src/components/po/UploadPoDialog.tsx`
- `src/components/po/PoDetailDialog.tsx`
- `src/components/layout/AppShell.tsx` (Order-side nav only)

Production routes/components/dialogs untouched — Luis Angel + floor keep Spanish.

A new `PO_LINE_STATUS_LABEL_EN` map lives in `src/lib/fact-types.ts` so the existing Spanish `PO_LINE_STATUS_LABEL` stays as the source of truth for Production.

### 2. Rename dates → **Export date** / **Customer date** (P0)

Pure labeling pass. Schema already has `committed_date` and `export_date`.
- "Compromiso" / "Committed" → **Customer date**
- "Mexico date" / "Fecha export" / "Export" → **Export date**

Production-side dialogs keep current Spanish labels.

### 3. RBAC (P0) — corrected role model

**Roles (Postgres enum `app_role`):**

| Role | Person | What they can do |
|---|---|---|
| `admin` | **Alex (you)** | Everything, incl. assigning roles |
| `manager` | Fernando Q | Read everything across Order + Production; edit Production |
| `po_editor` | Peter | Create / edit / delete POs and PO lines |
| `coe_reviewer` | Alexis | Edit POs flagged `review_track = coe` |
| `third_party_reviewer` | Lendris | Edit POs flagged `review_track = third_party` |
| `production_editor` | Luis Angel | Edit `jobs`, `job_steps`, `machine_runs` |
| `viewer` | everyone else | Read-only on Order + Production |

Two engineering roles (not one + flag) — Alexis literally cannot touch third-party POs, Lendris literally cannot touch COE. Vacation/delegation deferred to Sprint 3.

**Auth:** Email/password only (no Google, no magic link). Signup disabled — Alex creates accounts.

**Provisioning:** No admin UI in Sprint 1. After each person signs up, I hand you a one-line SQL snippet to insert their role. Admin UI ships with delegation in Sprint 3.

**Sprint 1 demo:** sign in as a viewer (edit controls hidden/disabled) vs sign in as Peter (creates and edits a PO). That's the proof Peter asked for.

---

## Technical section

### Migration (single file)

1. `create type public.app_role as enum ('admin','manager','po_editor','coe_reviewer','third_party_reviewer','production_editor','viewer');`
2. `create table public.user_roles (id uuid pk, user_id uuid → auth.users on delete cascade, role app_role, unique(user_id, role));` + GRANTs (`authenticated`, `service_role`) + RLS + read-own policy + admin-manage policy via `has_role`.
3. `create type public.review_track as enum ('coe','third_party','internal');` + `alter table public.purchase_orders add column review_track review_track not null default 'coe';`
4. Security-definer fns: `public.has_role(uuid, app_role)`, `public.current_user_can_edit_po(po_id uuid)` (true if admin / po_editor / matching reviewer for the PO's track).
5. Replace RLS on `purchase_orders`, `po_line_items`, `jobs`, `job_steps`, `machine_runs`:
   - SELECT: any authenticated user
   - INSERT/UPDATE/DELETE on PO tables: `current_user_can_edit_po(...)`
   - INSERT/UPDATE/DELETE on Production tables: `admin` / `manager` / `production_editor`
6. Backfill existing rows: `review_track = 'coe'` (matches Peter's main book).

### Client

- `src/integrations/supabase/client.ts` already exists.
- New `src/hooks/useUserRole.ts` — fetches role(s) once per session via authenticated server fn.
- New `src/lib/rbac.ts` — `canEditPo(role, reviewTrack)`, `canEditProduction(role)`, `isAdmin(role)`, `isViewer(role)`.
- `src/routes/_authenticated/route.tsx` (managed gate) — confirm exists; if not, ship in same edit as first protected route.
- `src/routes/auth.tsx` — email/password sign-in form (no signup tab, no Google button).
- `AppShell` — show current user + role badge; hide edit affordances based on role.
- Gate edit buttons in `PoLinesSpreadsheet`, `PoDetailDialog`, `UploadPoDialog`, and the production dialogs based on `useUserRole` + RBAC helpers.

### Auth config

`supabase--configure_auth`: `disable_signup: true`, `auto_confirm_email: true` (so Alex-provisioned accounts work without inbox round-trips), `external_anonymous_users_enabled: false`, `password_hibp_enabled: true`.

### Order of execution

1. Save memory: Lendris spelling + Alex-only-admin + role table.
2. Run migration (single approval).
3. Configure auth.
4. Write `auth.tsx`, `useUserRole`, `rbac.ts`, role badge in `AppShell`.
5. English pass + date rename across the six Order files in one batch.
6. Gate edit affordances.
7. Verify: sign in as seeded viewer, confirm edits blocked; sign in as Peter, confirm PO edit works; sign in as Alexis, confirm third-party PO is read-only; sign in as Lendris, confirm COE PO is read-only.

### Explicitly out of scope (Sprint 2/3)

`tube_spec` decomposition, Raquel filterable report, Orders-received view, COE vs Third-party split views, historical Excel ingest (MIG), export-to-email, vacation delegation, admin role-assignment UI, COE-NAL Stock ingest.
