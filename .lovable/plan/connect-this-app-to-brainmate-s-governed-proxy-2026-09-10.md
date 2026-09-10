# Connect this app to BrainMate's governed proxy

Today the "Resumen del día" feature calls a small backend function that *tries* BrainMate first and silently falls back to Lovable's own AI. The BrainMate attempt has never worked, because it sends a message format BrainMate doesn't accept and no key is configured. This plan makes the BrainMate path real, so every AI summary this app produces is governed, logged and cost-tracked inside BrainMate Workspace.

## What BrainMate expects

BrainMate's governed proxy is an OpenAI-compatible endpoint:

- URL: the `governed-proxy` function on the BrainMate project (`https://<brainmate>.supabase.co/functions/v1/governed-proxy`), or the public `https://api.brainmate.dev/v1/proxy` alias.
- Auth: a BrainMate API key (`bm_live_…`) sent as `Authorization: Bearer bm_…` or `x-api-key`.
- Body: `{ model, messages: [{role, content}], temperature?, max_tokens? }`.
- Response: standard `choices[0].message.content`.

The key carries the tenant/project scope, so no extra ids are needed in the request.

## What we need on this side

1. **A BrainMate API key.** You create it in BrainMate under Settings → Developer → API Keys, pick the tenant/project this app should report into, and copy the `bm_live_…` value. I'll then request it securely as `BRAINMATE_API_KEY`, plus `BRAINMATE_URL` for the endpoint.
2. **Rewrite the BrainMate call** in the existing backend function so it sends the OpenAI-compatible shape above instead of the current `{ system, prompt }` payload, and reads the reply from `choices[0].message.content`.
3. **Attribution headers** so this app's usage is identifiable in the BrainMate dashboard: `x-agent-name: mego-fact`, `x-bm-surface: lovable_project`, and a per-request conversation id.
4. **Honest error handling.** Right now any BrainMate failure is swallowed and quietly replaced by the fallback, which is why nothing surfaced. Keep the fallback, but log the real status/body and return the source so the panel shows whether the answer came from BrainMate or the fallback (the panel already displays "fuente").
5. **Verify with a real call** from the app's "Generar" button and confirm the request lands in BrainMate's request log.

## Technical detail

- File: `supabase/functions/brainmate-proxy/index.ts`, function `callBrainmate`.
  - POST to `${BRAINMATE_URL}` with headers `Authorization: Bearer ${BRAINMATE_API_KEY}`, `Content-Type: application/json`, `x-agent-name`, `x-bm-surface`, `x-conversation-id`.
  - Body: `{ model: "google/gemini-2.5-pro", messages: [{role:"system", content: SYSTEM}, {role:"user", content: prompt}], temperature: 0.3 }`.
  - Parse `data.choices?.[0]?.message?.content`; on non-2xx log `status` + body text and return `null` so the Lovable fallback still answers.
  - Map BrainMate 401/403 (invalid or revoked key) to a distinct error surfaced in the UI rather than a silent fallback, so misconfiguration is visible.
- No database or schema changes. No frontend logic changes; `src/lib/ai/brainmate.ts` and `BriefingPanel.tsx` already carry `source` through.
- Secrets: `BRAINMATE_API_KEY`, `BRAINMATE_URL` (both already read by the function, currently unset).

## Out of scope for now

- BrainMate memory recall/remember (`@brainmate/sdk` `recall`/`remember`) — a later step if you want this app's production decisions written into BrainMate memory.
- Routing the PO-parsing AI through BrainMate; that stays on the current path until the summary path is proven.
