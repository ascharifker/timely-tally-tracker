## Goal

1. Bootstrap **alex.scharifker@mego-afek.com** as admin with a one‑time recovery link you'll receive in chat.
2. Add an admin‑only **`/admin/users`** page with MISH‑style invite‑only user management (copy‑link invites, role changes, full delete on revoke).

Signup stays disabled — accounts only exist via this flow.

---

## Part A — Bootstrap your admin account (one-time)

A throw‑away server script that:
1. `admin.createUser({ email: 'alex.scharifker@mego-afek.com', email_confirm: true })` with a random password.
2. Inserts `(user_id, 'admin')` into `public.user_roles`.
3. `admin.generateLink({ type: 'recovery' })` and prints the link.
4. I paste the link back to you here. You open it → set a password → you're in as admin.

(Single‑use, expires in ~1 hour.)

---

## Part B — `/admin/users` (invite‑only management)

### Route & gating
- New `src/routes/_authenticated/admin.users.tsx`, child of the managed `_authenticated` layout.
- Server fns gated by `requireSupabaseAuth` + `assertAdmin(userId)` (uses existing `has_role`).
- Sidebar link in `AppShell`, visible only when current user has `admin`.

### UI
Table of users with: email · role badge · status (`invited` / `active` / `never signed in`) · last sign‑in · actions menu.

Actions:
- **Copy invite link** (for users who haven't signed in yet) — generates a fresh `invite` link.
- **Copy reset link** (for active users who lost access) — generates a `recovery` link.
- **Change role** — dropdown of the 7 roles.
- **Delete user** — confirm dialog → fully removes from `auth.users` (cascades `user_roles`).

**Invite user** button → dialog (email + role) → on submit returns the action_link, shown with a one‑click Copy button. You paste it into email/WhatsApp/Slack yourself.

### Server functions (`src/lib/admin-users.functions.ts`)
All wrapped in `requireSupabaseAuth` + admin check; `supabaseAdmin` loaded inside each handler via `await import(...)`.

- `listUsers()` — joins `auth.users` (admin API) with `user_roles`.
- `inviteUser({ email, role })` — `createUser` + role insert + `generateLink({ type: 'invite' })` → `{ action_link }`.
- `copyLinkForUser({ userId, type: 'invite' | 'recovery' })` — `generateLink` for existing user.
- `changeUserRole({ userId, role })` — upsert into `user_roles`.
- `deleteUser({ userId })` — `admin.deleteUser` (cascades roles via FK).

### Migration
- Ensure `user_roles.user_id` FK has `ON DELETE CASCADE` (so delete auth user cleans up roles).
- No new tables.

### Out of scope (Sprint 3+)
- No `invite_audit` table, no email auto‑send, no resend throttling, no bulk import, no profile fields. Add when vacation delegation lands.

---

## Decisions confirmed
1. Revoke = **hard delete** ✅
2. **Copy‑link only**, no auto‑email ✅
3. Run bootstrap now, paste recovery link in chat ✅
