
## Problem

1. Peter's screenshot is the Lovable project access wall, not the app. He clicked a Lovable editor/preview URL (`lovable.dev/...` or `id-preview--...lovable.app`) instead of the published app (`https://mego-produccion.lovable.app`).
2. The Users panel has an **"Invite link"** button for pending users, but it's not obvious that this is how you resend an invite. There's no explicit **"Resend invite"** action.

## Plan

### 1. Improve the Users panel actions

In `src/components/settings/UsersPanel.tsx`:

- For users with status **"Invited"** (never signed in), replace the ambiguous **"Invite link"** button with two clear actions:
  - **"Resend invite"** — calls the existing `inviteUser` server function again, which sends a fresh Supabase invite email to the same address with the same role.
  - **"Copy link"** — keeps the current fallback for cases where email is blocked.
- For users with status **"Active"**, keep **"Reset link"** as-is.
- Add a small inline note under the Users heading: "Invited users must open the link in their email, not the Lovable editor URL."

### 2. Make `inviteUser` idempotent and safe to re-run

In `src/lib/admin-users.functions.ts`:

- If the email already has an auth user but has **never signed in**, treat re-invite as a fresh invite: generate a new invite/recovery link and optionally re-send via Supabase Auth. Currently it falls through to `generateLink({ type: "recovery" })`, which works but is labeled confusingly in the UI.
- Keep role assignment unchanged (it already deletes and re-inserts the role row).
- Ensure the returned payload clearly distinguishes `email_sent: true` vs `action_link` so the UI can show the right toast.

### 3. Add a visible help banner on the Users tab

Add a short info box at the top of `UsersPanel` explaining:

- New users get an email from the app with a "Set your password" link.
- They must click that link and set a password; then they sign in at `https://mego-produccion.lovable.app`.
- The Lovable editor/preview URLs are only for project editors; app users should never use them.

### 4. Verify the published app URL is correct

Confirm `https://mego-produccion.lovable.app` is the live published URL and that the `/reset-password` route handles the invite token correctly. No code changes expected here — the existing flow already redirects invite emails to `/reset-password`.

## Outcome

- You can delete Peter, re-add him, and click **"Resend invite"** as many times as needed.
- The UI will clearly tell you whether an email was sent or a manual link was generated.
- Peter will know to use the app URL, not the Lovable editor URL.

## No-go items (not in this plan)

- Changing Lovable workspace/project sharing — that stays a manual Share-button action in the Lovable editor.
- Adding email-domain setup — app invites already use Supabase Auth emails; if they stop arriving we troubleshoot deliverability separately.
