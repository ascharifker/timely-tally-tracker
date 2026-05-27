# Phase 1 — Mego Afek Production Planning (FACT Platform)

Build a Lovable Cloud app that replaces the current Excel-based MAZAK schedule for Luis Ángel's team. All scheduling math is deterministic. AI is used **only** for narrative summaries / analysis and routed through a BrainMate proxy edge function — never for calculations, recalcs, OTD %, or cascade logic.

## Architecture principle (load-bearing)

```text
┌─ Deterministic core (TypeScript, no AI) ──────────────┐
│  • Cascade recalc on delay                            │
│  • Shift availability math                            │
│  • OTD % calculation                                  │
│  • Part-time (hrs/piece) lookups                      │
│  • Status pipeline transitions                        │
│  • Change-impact dependency graph                     │
└────────────────────────────────────────────────────────┘
                         │
                         ▼ (read-only feed)
┌─ AI narrative layer (BrainMate proxy edge fn) ────────┐
│  • Daily briefing in Spanish                          │
│  • "Explain this delay" summaries                     │
│  • OTD risk commentary                                │
│  NO writes, NO calculations, NO scheduling decisions  │
└────────────────────────────────────────────────────────┘
```

Hard rule enforced in code review: anything under `src/lib/scheduling/` is pure TS with unit-testable functions. AI calls live only in `src/lib/ai/` and only consume already-computed values.

## Scope

### Data model (Lovable Cloud / Supabase)

- `machines` — MAZAK 1-4, Gemak, Maqyro, TecMac (rows on the Gantt). Type: internal | external_shop.
- `shifts` — atomic unit: date + machine + slot (mañana/tarde/noche), availability flag.
- `jobs` — ODF, PO MUSA, PO Halliburton, PIR, tube spec, qty, export_date, customer_date, machine_id, priority, notes, status.
- `job_steps` — multi-step routing (MAZAK → MAQUINADO LISTO → CEMENTACION → EXPO → YA SE ENVIO), incl. external shop steps.
- `part_times` — hrs/piece per PIR per machine (lookup table).
- `status_events` — append-only log of status changes + delay reasons (feeds cascade + AI summaries).
- `briefings` — cached AI-generated daily narratives (Spanish), with source snapshot.

All tables: RLS enabled, `authenticated` role grants, `service_role` full.

### Features

1. **Gantt per machine** — shift-aware rows (MAZAK 1-4 + external shops), color-coded by status, drag to reschedule.
2. **Create Job form** — all real fields (ODF, POs, PIR, tube spec, qty, dates, machine, priority, notes).
3. **Auto-cascade recalc** — pure function: entering a delay on job X reshuffles downstream shifts on the same machine; visualizes the domino.
4. **Machine availability calendar** — shifts as atomic blocks; mark unavailable (maintenance, no operator).
5. **Part-time lookup UI** — view/edit hrs/piece per PIR per machine.
6. **Status pipeline board** — Kanban: MAZAK → MAQUINADO LISTO → CEMENTACION → EXPO → YA SE ENVIO.
7. **Job cards** — full routing incl. external shop legs (Gemak/Maqyro/TecMac).
8. **OTD tracker** — deterministic % weekly/monthly (export_date vs customer_date), red flags for at-risk jobs.
9. **Change-impact alerts** — when a job slips, show downstream affected ODFs (graph traversal, no AI).
10. **Seed data** — the 47 active orders incl. ODF 347/26, 121/26, 043/26, 623/26, 820/26, 713/26, 680/26.

### AI layer (Phase 1.5, via BrainMate proxy)

- Single edge function `brainmate-proxy` that:
  - Accepts `{ type: "daily_briefing" | "delay_explanation" | "otd_commentary", payload: <pre-computed snapshot> }`.
  - Forwards to BrainMate MCP endpoint with `BRAINMATE_API_KEY` server-side.
  - Returns narrative Spanish text.
  - Never receives a "compute X" request — only "summarize this already-computed data".
- Frontend: a "Resumen del día" panel that calls the proxy with today's snapshot and renders the response. Read-only.
- Cached in `briefings` table to avoid re-billing.

### Visual design

Dark industrial theme matching v2 prototype:
- IBM Plex Mono (data, ODF numbers, Gantt labels) + IBM Plex Sans (UI chrome).
- Semantic status colors via design tokens (HSL in `index.css`).
- Dense, information-first layout (this is a tool, not a marketing page).

## Technical details

- **Stack**: existing Lovable template + Lovable Cloud (Supabase) + Lovable AI Gateway (proxied through BrainMate edge fn).
- **Cascade engine**: `src/lib/scheduling/cascade.ts` — pure function `(jobs, shifts, delayedJobId, newStart) => updatedShifts[]`. Unit-tested.
- **OTD engine**: `src/lib/scheduling/otd.ts` — pure function over jobs in date range.
- **Dependency graph**: `src/lib/scheduling/impact.ts` — BFS over downstream jobs on the same machine.
- **AI boundary**: `src/lib/ai/brainmate.ts` — only function exported is `summarize(type, snapshot)`. No `compute`, no `decide`, no `schedule`.
- **Edge function**: `supabase/functions/brainmate-proxy/index.ts` — validates payload type is one of the 3 allow-listed summary types, rejects anything else.
- **Secret**: `BRAINMATE_API_KEY` (will request via add_secret once Cloud is enabled).
- **Auth**: email/password login; jobs scoped per workspace (single tenant for now, Luis Ángel + team).

## Out of scope for Phase 1

- Mobile app (web responsive only).
- Halliburton/MUSA portal integration (manual PO entry for now).
- Inventory / safety stock automation (read-only display from seed).
- Writes from AI (Phase 2+).

## Deliverable for Friday demo

Working Gantt + Create Job + cascade + status pipeline + seeded with real ODFs. OTD tracker and AI briefing panel as stretch — both built on the same deterministic core so they're safe to ship if time allows.

Confirm and I'll switch to build mode, enable Lovable Cloud, scaffold the schema + seed, and ask for the BrainMate proxy URL + API key when needed.