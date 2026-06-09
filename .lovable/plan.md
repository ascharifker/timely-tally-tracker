## Invite-only auth (mego-afek.com only)

Lock signups, send real invite emails from `/admin/users`, restrict to `@mego-afek.com`.

### 1. Disable public signup (backend) — already done
`configure_auth`: `disable_signup: true`, `auto_confirm_email: false`, `password_hibp_enabled: true`. Done as part of this pass.

### 2. Rewrite `inviteUser` in `src/lib/admin-users.functions.ts`
- Add `ALLOWED_INVITE_DOMAINS = ["mego-afek.com"]` + `assertAllowedDomain(email)` helper that throws `"Only @mego-afek.com emails can be invited."`.
- Call `assertAllowedDomain` at the top of the handler.
- Look up the user via `auth.admin.listUsers`.
- If new → `supabaseAdmin.auth.admin.inviteUserByEmail(email, { redirectTo: <origin>/reset-password })`. Supabase sends the email.
- If existing → `generateLink({ type: "recovery" })` and return the link as a fallback.
- Replace role rows (delete + insert) so role is always exactly what admin picked.
- Return `{ user_id, email_sent, action_link? }`.

### 3. Strip signup UI from `src/routes/auth.tsx`
- Remove `<Tabs>`, the "Sign up" tab, `handleSignUp`, `confirm` state, and the "Check your inbox" screen.
- Keep only sign-in form (email + password).
- Add a small line: "Access is invite-only. Contact your administrator if you need an account."

### 4. Polish `/admin/users` invite dialog
- Default invite role = `manager` (instead of `viewer`).
- After invite: if `email_sent` → toast "Invite emailed to {email}", don't open link dialog. If `action_link` returned → open the existing copy-link dialog as today.
- Update header subtitle from "Send the generated link manually" → "Invite-only. New invites are emailed automatically."
- Button label: "Send invite" instead of "Create & generate link".

### Out of scope
Branded auth email templates, invite audit log, bulk invites. Touching `bootstrapFirstAdmin` / `claimAdminIfEligible` / `resetAllowlistedUser`.

### Acceptance
1. `/auth` shows only Sign in.
2. `supabase.auth.signUp` from console → error.
3. Admin invites `fernando@mego-afek.com` (role: manager) → Fernando gets email, sets password at `/reset-password`, lands in as manager.
4. Inviting `x@gmail.com` → "Only @mego-afek.com emails can be invited."

Approve to execute steps 2–4 (step 1 already applied).
