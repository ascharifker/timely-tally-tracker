## What’s happening
Peter is not failing inside the MEGO app login. He is being sent to Lovable’s project access wall, which means the invite/reset link is resolving to the editor/preview environment instead of the published app URL.

## Fix plan

1. **Make invite links always target the published app**
   - Update the invite, resend invite, reset-link, and bootstrap admin flows so their password setup redirect always points to:
     `https://mego-produccion.lovable.app/reset-password`
   - Do not derive this from the current browser/editor URL anymore.

2. **Harden the Users panel**
   - Make “Resend invite” and “Copy link” generate links for the published app only.
   - Add a clearer warning that invites copied from the Lovable preview/editor will not work for external users.

3. **Harden the reset-password page**
   - Keep the set-password flow public and resilient.
   - If a user lands there without a valid auth token, show a clear “request a fresh invite/reset” path instead of getting stuck.

4. **Auth settings check**
   - Ensure the backend auth redirect allow-list accepts the published app reset URL.
   - Keep public signup disabled so this remains invite-only for MEGO Afek users.

5. **Verification**
   - Generate a fresh invite/reset link and confirm its redirect target is the published app domain.
   - Verify `/reset-password` loads publicly and does not hit the Lovable access wall.

## Immediate workaround until the fix is applied
If you need to send Peter something right now, resend/copy the invite from the **published app** only:
`https://mego-produccion.lovable.app`

Do not send him links from the Lovable editor, preview, or any `supabase.co` preview card that resolves to the internal project wall.