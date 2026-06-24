# Make ODTs feel alive on /production

Goal: when Fer opens **Producción**, he should immediately see *where* every active ODT sits on the calendar, and edit it in one or two clicks.

## What changes

### 1. Gantt strip above "Mis ODTs activas"
- Reuse `MachineGantt` (already used on `/`) and mount it directly above the active-jobs table on `/production`, filtered to active ODTs only (excludes `YA_SE_ENVIO` and `EN_ESPERA` with no `planned_start`).
- Default window: today − 1 day → max(committed_date) + 3 days, with prev/next week buttons + "Hoy" reset.
- Shift bands (mañana/tarde/noche) visible as background tints so you can read shift placement at a glance.
- Click a bar → opens the same ODT breakdown dialog the table opens (single source of truth).
- Bars colour-coded by OTD score (on time / at risk / late) reusing `computeOdfOtd` + `OTD_TONE`.

### 2. "Editar" button on the breakdown
- `OdfBreakdownDialog` stays the default click target (read-only summary — Fer's current mental model).
- Add a primary **Editar ODT** button in the dialog header that swaps the body to the full `JobDetailDialog` content (machine/operator reassign, 1-click shift swap, cascading reschedule with reason).
- "← Volver al resumen" returns to the breakdown without closing.
- Both modes share the same dialog frame, so it never feels like two separate things.

### 3. Drag-to-reschedule on the Gantt
- Make ODT bars `draggable`; on drop, snap to the nearest shift boundary of the target machine lane and call `useRescheduleJob` (already exists) with the new `planned_start` / `planned_end` (duration preserved).
- If the drop crosses a downstream ODT on the same machine, run the existing `cascade()` preview and show a small confirm popover ("Empuja 3 ODTs siguientes — confirmar?") before committing — same logic the dialog uses today, just triggered visually.
- Visual feedback: ghost bar follows cursor, target shift band highlights, invalid drops (machine with no `hours_per_shift`, past dates) flash red and revert.

### 4. Row-level calendar hint (small polish)
- Add a compact chip on each active-jobs row: shift colour dot + "lun 24 jun · M" or "+2d tarde" — so even without scrolling to the Gantt you know when each ODT runs.
- Uses `SHIFTS` + `shiftIndexFromDate` from `src/lib/shifts.ts`.

## Out of scope
- Multi-day drag selection / resize the bar to change duration (still done via the dialog's reschedule form).
- New "Calendario" top-level page — the Gantt strip on `/production` covers the need.
- Changing the breakdown's data shape.

## Technical notes
- New files: none required. Edits to `src/routes/production.tsx` (mount Gantt + chips), `src/components/fact/MachineGantt.tsx` (drag handlers + cascade confirm), `src/components/fact/OdfBreakdownDialog.tsx` (mode toggle hosting `JobDetailDialog` body).
- Reschedule path already exists (`useRescheduleJob`, `applyCascadingDelay`, `cascade()`); no new server fns or migrations.
- All edits are presentation + wiring — no schema, no RLS, no new data model.
