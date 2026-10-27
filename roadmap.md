# ODT field corrections
- [x] Separate manually entered tube number from the source PO specification.
- [x] Provide independent customer and export dates and persist both.
- [x] Test field mapping and verify the production form (authenticated; no operational ODT created).

# Gantt overlap rescheduling
- [x] Compute collision-driven insertion cascades without changing unrelated machines.
- [x] Preview affected ODTs, stage together, and retain approval/discard/undo controls.
- [x] Save exactly the approved positions without a second hidden cascade.
- [x] Test scheduling rules and verify the authenticated calendar drag, cascade preview, approval dialog, and discard (no live production changes saved).

# Production Kanban
- [x] Separate internal machine columns and assign the selected machine on drop using previewed schedule moves.
- [x] Expand each column with searchable ODT details and external workshop filters.
- [x] Show complete workshop names and missing assignments; 15 tests passed; authenticated expanded views verified. Calendar remains empty, so live ODT moves were not saved or tested.