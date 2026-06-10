# Engineering Verification Funnel — Waves & Phases

Goal: turn today's single-button "Aprobar / Flag" engineering screen into a 4-step verification funnel (PO Info → PIR Verification → Part Component List → Quality Matrix Check), data-driven, with per-step cycle-time capture. Production code untouched.

Source of truth: artifact `26baa1a7-e1fa-4bfa-88ac-c11c88403453`.

Clarifications applied:
- Step 4 (Matrix Check): scaffold a placeholder panel + "Done" button only. Real content defined later with the team.
- Step 3 (Part Component List): the Master PIR list is an Excel file. v1 = upload-once + link-out from the panel. No parsing yet.
- Flag-then-unflag behavior: I'll default to "resume on the step it was flagged on" (no reset). Can revisit if it feels wrong in use.

---

## Wave 0 — Foundations

No user-visible change. Lays the rails.

**Phase 0.1 — Step config** (`src/lib/engineering-steps.ts`)
- `EngStep` type + `ENGINEERING_STEPS` array (4 entries: `po_info`, `pir_verify`, `components`, `matrix_check`), each with `key`, `label`, `optional`.
- Helpers: `firstStep()`, `nextStep(current)`, `getStep(key)`.

**Phase 0.2 — DB migration**
- `po_line_items`: add `eng_step text null`, `eng_step_started_at timestamptz null`.
- Create `status_events` (id, entity_type, entity_id uuid, from_status text, to_status text, actor uuid, occurred_at timestamptz default now(), metadata jsonb). GRANTs to `authenticated` + `service_role`; RLS authenticated-only (matches security memory).
- Backfill: rows with `status='pending_engineering'` → `eng_step='po_info'`, `eng_step_started_at=now()`.
- Index `(status, eng_step)`.

Exit: build green, columns present, backfilled.

---

## Wave 1 — Server functions

Extend `src/lib/po-workflow.functions.ts`. All use `.middleware([requireSupabaseAuth])`; `actor = context.userId` (no more hardcoded "Alexis").

**1.1 `advanceEngStep({ id })`** — read current `eng_step`, compute `nextStep`, write `status_events` (with elapsed ms in metadata), set new `eng_step` + `eng_step_started_at`. If no next step → set `status='ready_for_production'`, clear `eng_step`.

**1.2 `setEngStep({ id, step })`** — jump to a specific step. Writes `status_events` with `metadata.kind='jump'`.

**1.3 `flagPoLine`** — keep behavior, also write a `status_events` row for symmetry.

Exit: rows appear in `status_events` as steps advance.

---

## Wave 2 — UI: stepper on engineering queue

Rework `src/routes/engineering.tsx`.

**2.1** Replace per-row inline PIR/Spec inputs + Aprobar button with a compact 4-dot stepper showing current step + "Time in step" (e.g. `2h 14m`).

**2.2** Primary row CTA: "Complete step →" (calls `advanceEngStep`). Secondary: dropdown to jump (`setEngStep`). Flag dialog unchanged.

**2.3** Translate the screen to English per the artifact (rest of app stays Spanish).

Exit: lines flow through 4 steps; last step transitions to `ready_for_production`.

---

## Wave 3 — Per-step detail panels

Each step opens a side drawer. Independent, shippable per phase.

**3.1 — Step 1: PO Info** — read-only summary (customer, PO#, line, qty, committed date, source PDF link).

**3.2 — Step 2: PIR Verification** — PIR + tube_spec editable fields (the ones removed from the row); save via existing `updatePoLineField`.

**3.3 — Step 3: Part Component List** — upload the Master PIR Excel to the existing `po-documents` bucket under a fixed path (e.g. `master-pir/current.xlsx`); panel shows "Download Master PIR" + last-uploaded timestamp + a "Replace" button. No parsing in v1.

**3.4 — Step 4: Matrix Check (placeholder)** — drawer with title + a note "Matrix workflow TBD" + a single "Mark complete" button. Real UI lands later; no auto-email per artifact guardrail.

Exit: every step has a working panel.

---

## Wave 4 — Validation & polish

**4.1 Data-driven proof** — temporarily add a 5th step to `ENGINEERING_STEPS`, verify UI + advance logic pick it up with no other changes, then revert.

**4.2 Cycle-time footer** — small read-only chip on the page: "Avg time per step (last 30d)" from `status_events`.

**4.3 Regression sweep** — load `/production`, `/intake`, `/purchase-orders`; confirm flag-back-to-Peter still works.

---

## Build order

Wave 0 → 1 → 2 first (this gives a working funnel end-to-end with placeholder panels). Then 3.1 → 3.2 → 3.3 → 3.4 as separate shippable steps. Wave 4 last.

Approve and I'll start with Wave 0.
