## 1. Undo for calendar movements

**Goal:** After any reschedule (drag on `MachineGantt`, shift-change buttons in `JobDetailDialog`, or a cascading delay via `useLogDelay`), show a toast with an **Undo** button that restores the previous `planned_start` / `planned_end` for every affected job.

### Approach

- New lightweight in-memory undo stack in `src/lib/undo-stack.ts`:
  - `pushUndo(label, snapshots: { id, planned_start, planned_end }[])` — keeps last 10 entries; returns an id.
  - `popUndo(id)` — returns snapshots.
- New server function `revertScheduleSnapshots` in `src/lib/odf.functions.ts` that takes `{ id, planned_start, planned_end }[]` and writes them back in one call (auth-gated).
- Wire capture points (snapshot BEFORE mutating):
  1. `MachineGantt.tsx` drag-drop reschedule (single job + any cascaded jobs it already computes).
  2. `JobDetailDialog.tsx` `moveToShift` (single job).
  3. `useLogDelay` cascade path — snapshot every job in the `cascade()` preview before calling the server fn.
- After each mutation resolves, call `toast.success("…", { action: { label: "Deshacer", onClick: () => revert(id) } })` (sonner supports action). Duration ~8s.
- `revert()` calls `revertScheduleSnapshots`, then `refreshAll()` to update Gantt/table/kanban.

### Scope note

Undo covers **schedule times only** (planned_start/end). Status changes (kanban drop) and shipped-date are out of scope for this pass — can be added later using the same pattern.

## 2. Slimmer MAZAK / TALLER_EXTERNO kanban cards

The card currently shows: machine chip + ODT + urgency badge + `tube_spec` + `StartStopRunButton`. In grouped MAZAK columns this makes the column extremely tall.

### Changes in `src/components/fact/StatusBoard.tsx`

- **Remove** `StartStopRunButton` from `renderCard` entirely (drop the `showRunControl` / `openRun` props + related plumbing and the `useMachineRuns` hook usage).
- **Remove** the `tube_spec` line from the card. Replace with a compact right-aligned run indicator: a small dot (`•` colored green with pulse) when `openRun` exists for the job, plus the elapsed hours in mono (e.g. `▶ 2.3h`). Non-clickable — just status.
- Keep card to a single row: `[machine chip] ODT 1234   [▶ 2.3h] [urgency]`.
- Group headers unchanged.

### Move controls into `JobDetailDialog.tsx`

- Add a new "Ejecución en máquina" section near the top (above "Asignar / Editar") that renders `<StartStopRunButton job={job} openRun={openRun} />` — only when `job.status` is `MAZAK` or `TALLER_EXTERNO` and a machine is assigned.
- Look up `openRun` locally from the existing `useMachineRuns()` call already in the dialog.

## Technical details

- Files touched:
  - New: `src/lib/undo-stack.ts`
  - Edit: `src/lib/odf.functions.ts` (add `revertScheduleSnapshots`)
  - Edit: `src/components/fact/MachineGantt.tsx`, `src/components/fact/JobDetailDialog.tsx`, `src/components/fact/StatusBoard.tsx`
  - Edit: `src/hooks/useFactData.ts` (`useLogDelay` — snapshot cascade preview before mutation, expose returned undo id via toast helper or accept an `onUndoReady` callback).
- Sonner action toast API: `toast.success(msg, { action: { label, onClick }, duration: 8000 })`.
- No schema changes; `revertScheduleSnapshots` reuses existing `jobs` update path with `requireSupabaseAuth`.

## Out of scope

- Undo for status changes, shipped-date, or job creation.
- Persistent multi-session undo (in-memory only).
- Redo.
