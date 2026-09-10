# Rotate BrainMate API Key

## Goal
Update the production BrainMate API key used by the `brainmate-proxy` edge function in this project, since the key was rotated on the BrainMate side.

## What will change
- Replace the existing `BRAINMATE_API_KEY` runtime secret with the new key.
- `BRAINMATE_URL` remains unchanged (`https://api.brainmate.dev/v1/proxy`).
- No code changes are required; the `brainmate-proxy` function already reads the secret at runtime.

## Verification
- After the secret is updated, deploy the `brainmate-proxy` edge function so the new key is live.
- Run a test "Generar resumen" call from the app and confirm the response source is `brainmate`.
