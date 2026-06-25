## Why the Gantt doesn't move

`useRescheduleJob` (and the related delay/update mutations in `useFactData.ts`) only invalidate the `["jobs"]` query. But `/production` reads from `useActiveJobs` (`["active_jobs"]`), so after you reschedule from the Editar dialog the table refreshes but the Gantt above it keeps showing the old position. Same root cause for `useUpdateJob` and `applyCascadingDelay`.

## Fix (small, surgical)

1. In `src/hooks/useFactData.ts`, extend the `onSettled` of `useRescheduleJob` and `useUpdateJob` to also invalidate `["active_jobs"]` and `["completed_jobs"]`.
2. In `src/routes/production.tsx`, after `JobDetailDialog` closes, run `refreshAll()` (same helper used elsewhere) so cascading delays logged inside the dialog also refresh the Gantt.
3. Add a lightweight optimistic patch in `onMutate` of `useRescheduleJob` for the `["active_jobs"]` cache too — that way the bar visibly snaps the moment you confirm, before the round-trip.

## Make /production simpler to navigate

Today the page stacks 4 big sections with no anchor and a lot of repeated chrome. Restructure it as a single top-down flow that matches Fer's actual process: **decide → schedule → track → archive**.

### New layout

```text
┌─────────────────────────────────────────────────────────────┐
│  Producción                       [Hoy ▸ Semana ▸ Mes]      │   <- single date scope
├─────────────────────────────────────────────────────────────┤
│  Tabs:  [1. Crear ODT] [2. Calendario] [3. En curso] [Histórico] │
└─────────────────────────────────────────────────────────────┘
```

- **Tab 1 — Crear ODT**: the current "líneas listas" table, nothing else. Badge on the tab shows pending count (e.g. `Crear ODT · 4`). Empty state = "Sin líneas listas".
- **Tab 2 — Calendario**: the `MachineGantt` full-width, no table below. Clicking a bar still opens the breakdown. This is where rescheduling lives.
- **Tab 3 — En curso**: the active-jobs table only, with the per-row shift chip we already added. No Gantt above it (it's now in tab 2 — one source of truth).
- **Tab 4 — Histórico**: completed jobs.

### Why this is simpler

- One section visible at a time = no scrolling past the Gantt to reach the table.
- The Gantt has its own tab, so reschedules feel like the main action there, not a side-effect of the list.
- Tab badges (`Crear ODT · 4`, `En curso · 12`) replace the long descriptive paragraphs currently under each H2.
- The "Crear ODT" CTA is no longer competing visually with the Gantt or the active list.

### Smaller polish in the same pass

- Drop the redundant intro paragraphs under each section header (the tab label + a 1-line subtitle is enough).
- Keep the dialogs (`OdfBreakdownDialog`, `JobDetailDialog`, `PoDetailDialog`, `CreateOdfDialog`) exactly as they are — only the page chrome changes.
- Default landing tab = `Calendario` if there are active jobs, else `Crear ODT`.

## Out of scope

- No changes to the dialogs, server functions, or the Gantt internals beyond the cache-invalidation fix.
- No new routes — still `/production`, just tabbed.
- No schema / RLS changes.

## Files touched

- `src/hooks/useFactData.ts` — broaden invalidations on reschedule/update mutations.
- `src/routes/production.tsx` — wrap the four existing blocks in `<Tabs>` from `@/components/ui/tabs`, trim intros, add count badges, call `refreshAll()` on `JobDetailDialog` close.
