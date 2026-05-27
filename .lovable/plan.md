# Fix: delays don't move the Gantt

## What's broken today

The "Job Detail" dialog has a **Simulador de cascada** with a number input and an "Aplicar a N trabajos" button. Two things go wrong:

1. **It's a simulator, not a log action.** Typing a number just previews the cascade. The Gantt only moves if the user explicitly clicks "Aplicar" — and even then nothing is recorded in `status_events`, so there's no audit trail of "ODF 347 got delayed 4h on 5/27 because…".
2. **Even when applied, the visual shift is invisible.** A 4-hour delay on a 14-day Gantt is ~1% of the row width. The bar moves a couple of pixels and looks identical. There's no "before/after" indicator, no badge, no toast detail.
3. **No optimistic update.** The mutation waits for Supabase round-trip + invalidate + refetch before the bar moves. On a slow link it feels like nothing happened.

## What we'll build

Replace the simulator pattern with a real **Registrar retraso** flow that does four things in one click:

1. Write a row to `status_events` (job_id, delay_hours, reason, timestamp) — the audit trail.
2. Run the deterministic cascade engine (already exists in `src/lib/scheduling/cascade.ts`).
3. Update `planned_start` / `planned_end` for the anchor + every downstream job on the same machine in a single transaction.
4. Optimistically patch the React Query cache so the Gantt bars slide **immediately**, then reconcile with the DB result.

### Dialog redesign (`JobDetailDialog.tsx`)

- Rename section to **Registrar retraso de producción**.
- Inputs: delay amount (with **unit selector: horas / días / turnos**, default días since 4h shifts are invisible), free-text **motivo** (required, e.g. "se rompió herramienta MAZAK 2").
- Live preview list stays — shows "ODF 347/26 +2d → nueva entrega 30/05 16:00" for each affected job, with old date struck through and new date highlighted.
- Single primary button: **Registrar y reprogramar (N ODFs)**. No more two-step "simulate then apply".
- After success: toast with summary, dialog closes, Gantt animates the shift.

### Gantt visual feedback (`MachineGantt.tsx`)

- When a job was recently shifted (last 5s), render a faint **ghost bar** at the old position + an arrow to the new position, then fade out. This makes the movement perceivable even for small delays.
- Add a small red corner badge on any job that has a `status_events` row with `delay_hours > 0` in the last 24h — so users can see at a glance which ODFs slipped.

### Data layer (`useFactData.ts`)

- New `useLogDelay` mutation:
  - Computes cascade preview client-side (deterministic, already built).
  - Calls a single TanStack server function `logDelayAndCascade` (new file `src/lib/scheduling/log-delay.functions.ts`) that wraps the status_events insert + jobs bulk update in one server roundtrip, returning the new job rows.
  - `onMutate`: optimistically patches the `["jobs"]` query cache with the predicted new dates.
  - `onSuccess`: replaces with server response.
  - `onError`: rolls back + toast.
- Existing `useApplyCascade` is removed (folded into the above).

### Scope of cascade — confirmation needed

Today cascade only shifts **other jobs on the same machine** whose `planned_start ≥ anchor.planned_end`. That's correct for Phase 1 because `job_steps` is empty (no multi-step routing in the DB yet). When we wire job_steps in a later phase, we'll extend cascade to also push the same ODF's downstream steps (CEMENTACION → EXPO). Out of scope for this fix.

## Files touched

- `src/components/fact/JobDetailDialog.tsx` — redesign the delay section, add unit selector + motivo, single action button.
- `src/components/fact/MachineGantt.tsx` — ghost-bar animation for recently shifted jobs, delay badge.
- `src/hooks/useFactData.ts` — replace `useApplyCascade` with `useLogDelay` (optimistic + status_event insert).
- `src/lib/scheduling/log-delay.functions.ts` — new TanStack server function that atomically inserts status_event + updates affected jobs.
- `src/lib/fact-types.ts` — add `DelayUnit` type + helper `toHours(amount, unit)`.

## Out of scope

- Multi-step routing cascade through `job_steps` (table is empty).
- AI summarization of the delay (Phase 1.5, already separate).
- Editing customer_date / export_date — those are commitments to the customer, only `planned_*` shifts.
- Undoing a logged delay (could add later; for now the audit row in status_events is permanent and re-logging a negative delay would reverse it).

## Approval

If this matches what you meant by "everything should readjust according to the delay", approve and I'll switch to build mode and ship it.
