## Goal
Add a "Tiempo de maquinado (turnos)" input to the **Crear ODF** dialog so the user enters how many shifts (turnos) the job will take, and the calendar/Gantt immediately reflects that duration.

## Approach
Reuse the existing `hours_override` column on `jobs` (already used by `jobDurationHours` as the highest-priority duration source). Convert turnos → hours using the selected machine's `hours_per_shift` (default 8 if none selected). Also pre-schedule `planned_start` / `planned_end` at creation time when both a machine and turnos are provided, so the new ODF lands on the calendar without a second action.

## Changes

### `src/components/fact/CreateJobDialog.tsx`
- Add a new field next to **Cantidad**:
  - Label: `Tiempo de maquinado (turnos)`
  - `Input type="number" min={0.5} step={0.5}` (allow half-shifts)
  - Helper text under it: `1 turno = X h` where X is the selected machine's `hours_per_shift` (fallback "8 h por defecto" when no machine selected).
- On submit:
  - Look up the selected machine from the existing `machines` list to get `hours_per_shift` (default 8).
  - If turnos > 0: `hours_override = turnos * hoursPerShift`. Pass it on the insert payload.
  - If a machine is selected AND turnos > 0: compute `planned_start` / `planned_end` via `scheduleJob(Date.now(), hours_override, machine)` from `src/lib/scheduling/schedule.ts` and include them in the insert.
  - If no machine selected, only persist `hours_override` (calendar will place it once the user assigns a machine — existing `useUpdateJobStatus` already uses `jobDurationHours` which honors `hours_override`).

### `src/hooks/useFactData.ts`
- No schema change. `useCreateJob` already accepts `Partial<Job>`; just ensure `hours_override`, `planned_start`, `planned_end` flow through (they already do via `Partial<Job>`).

## Out of scope
- No DB migration — `hours_override` already exists on `jobs`.
- No changes to `PartTime` catalog or cascade logic.
- Not changing the unit shown elsewhere (turnos stays as an input convenience; storage remains hours).

## Acceptance
- Creating an ODF with machine = MAZAK-1 and turnos = 3 saves `hours_override = 3 × hours_per_shift` and the Gantt shows the block starting at the next shift boundary with a 3-shift length.
- Creating an ODF without a machine still records the chosen turnos as `hours_override`; the bar appears once the job is assigned to a machine.
- Existing ODFs without turnos input behave exactly as before (heuristic / catalog).