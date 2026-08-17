# Backtrack / Undo in the Engineering funnel

Right now a line can only move forward ("Complete step") or be jumped manually from a dropdown. There is no way to step back or take back a completion. This adds explicit backtracking.

## What you get

1. **Back one step** — a "Back" button next to "Complete step" in the queue row and in the step drawer. Moves the line to the previous step and restarts that step's clock.
2. **Undo toast** — after every "Complete step" (and after a completion to Ready for production), a toast appears for ~10 seconds with an **Undo** action that restores the previous step exactly.
3. **Reopen a finished line** — a line already sent to Ready for production can be pulled back into engineering at the last step (Quality Matrix). Blocked once an ODT exists for it, with a clear message ("already scheduled in production").
4. **Restart from step 1** — an option in the row dropdown ("Start over") with a confirm prompt.
5. **History** — every backtrack is written to the step-event log as `back`, `undo`, or `reopen`, so time-in-step reporting stays honest.

## Technical notes

- `src/lib/po-workflow.functions.ts`: new auth-protected server fns
  - `revertEngStep({ id })` — moves to previous step; if the line is `ready_for_production` with no job, sets status back to `in_engineering` and step to the last step, clearing `engineering_reviewed_at/by`; refuses if a `jobs` row references the line.
  - `restartEngStep({ id })` — resets to first step.
  - Both log to `po_line_step_events` with the new kinds; `advanceEngStep` returns the previous step so the client can offer a precise Undo.
- `src/lib/engineering-steps.ts`: add `prevStep(current)` helper.
- `src/routes/engineering.tsx`: Back button, "Start over" dropdown item, undo toast wired through the existing `src/lib/undo-toast.ts` sonner helper.
- `src/components/fact/EngStepDrawer.tsx`: Back button in the footer, disabled on step 1.
- Reopen entry point: the Ready-for-production list gets a "Reopen in engineering" action so a completed line can come back without a DB edit.
- No schema change needed; `kind` on `po_line_step_events` accepts the new values (text column).
