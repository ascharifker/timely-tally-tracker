## What I found

- Peter’s account exists in the app backend.
- His email is confirmed.
- He has a password set.
- He has already successfully signed in once.
- His role is `PO Editor`, so he should have app access.

That means this is likely **not** an invite creation problem anymore. The most likely causes are:
1. Peter is still opening the wrong URL — a Lovable editor/preview URL instead of the live app URL.
2. He is signing into the app but getting stuck because the current route guard/auth state handling is fragile.
3. He is using an old invite/reset link after already setting his password.

## Plan

### 1. Make the login page clearer for already-invited users
Update the sign-in screen to clearly say:
- Use this live app URL: `https://mego-produccion.lovable.app`
- If you already created a password, sign in normally — do not reuse the invite link.
- If you forgot the password, use “Forgot password?”

### 2. Harden the auth session check
Update the app auth hook to use the backend-validated user check for deciding whether someone is logged in, instead of relying only on the cached browser session. This should make login state more reliable after invite/password setup.

### 3. Improve the reset/invite link page
Update `/reset-password` so if a user opens an old or already-used invite link, it shows a clear message:
- “This link was already used or expired.”
- Button to go sign in.
- Button to request a password reset.

This prevents the confusing “validating link” or “invalid link” dead end.

### 4. Add admin-facing status clarity in Users
In the Users panel, show clearer status details for invited users:
- “Invited” if never signed in.
- “Active” if they signed in.
- For active users like Peter, show that they should use normal sign-in or password reset, not resend invite.

### 5. Verify after implementation
After changes, verify:
- `/auth` renders correctly.
- Peter’s status appears as Active in Users.
- The live app URL guidance is visible.
- The reset page no longer leaves users stuck on a vague validation state.