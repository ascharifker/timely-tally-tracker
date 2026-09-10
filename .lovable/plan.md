# BrainMate Status Endpoint

## Goal
Give BrainMate a public `/api/brainmate-status` URL it can ping to confirm this Lovable Cloud project is reachable and its BrainMate proxy is healthy.

## What we'll build
1. New public TanStack server route: `src/routes/api/public/brainmate-status.ts`
2. `GET /api/brainmate-status` returns a small JSON payload:
   - `status: "ok"`
   - `project: "mego-produccion"`
   - `brainmate_proxy: "reachable" | "unreachable"` — a lightweight health check against the existing `brainmate-proxy` edge function using the service role
   - `timestamp` ISO string
3. No sensitive data exposed; no auth required (public endpoint).

## URL to paste into BrainMate
```
https://mego-produccion.lovable.app/api/brainmate-status
```
Use the preview URL only for testing drafts:
```
https://id-preview--7b0b25dd-0985-4bfb-94d5-5e8534369226.lovable.app/api/brainmate-status
```

## Technical details
- Route lives under `src/routes/api/public/` so it bypasses published-site auth.
- Handler reads `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` inside the handler.
- Health check calls the local `brainmate-proxy` edge function with a tiny test payload (or just checks the function URL returns a non-auth response); we avoid burning AI credits.
- CORS headers included so BrainMate's dashboard can fetch it directly if needed.
- Add a simple test after deploy to confirm 200 + JSON.
