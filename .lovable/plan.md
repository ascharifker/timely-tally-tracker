## Ship 1 — ODT rollout (input layer + label rename only)

Scheduling engine stays untouched. `schedule.ts`, `duration.ts`, `cascade.ts`, `lanes.ts`, `impact.ts`, `otd.ts` — no edits.

### Task 1 — Hours-per-piece in `CreateJobDialog.tsx`
- Replace `turnos` state with `hoursPerPiece` (decimal, `min=0.1`, `step=0.1`, placeholder `"ej: 2.5"`).
- Relabel field to **"Tiempo de maquinado por pieza (horas)"**.
- Compute `hours_override = hoursPerPiece × qty` (read qty from form). Continue passing `hours_override` to `scheduleJob(...)` unchanged.
- Helper text: "Total = horas/pieza × cantidad. El calendario reparte ese total sobre los turnos disponibles de la máquina."
- Remove the "1 turno = X h" helper and all per-shift conversion logic.
- Add comment: `// v1 = pure ODT. ODF parent layer deferred; future bridge = PO line item → ODT.`

### Task 2 — Rename ODF → ODT in production UI only
Visible label rename, Spanish preserved. DB columns, `jobs` table, and `odf` payload key all unchanged.

Files to touch (text-only):
- `CreateJobDialog.tsx`: trigger "Nuevo ODF" → "Nuevo ODT"; title "Crear ODF" → "Crear ODT"; label "ODF *" → "ODT *"; toast "ODF creado" → "ODT creado"; submit "Crear ODF" → "Crear ODT".
- `MachineGantt.tsx`: block labels and tooltips `ODF ${j.odf}` → `ODT ${j.odf}`; "ODFs programadas" → "ODTs programadas"; tooltip "todos los ODFs" → "todas las ODTs".
- `StatusBoard.tsx`: card label `ODF {j.odf}` → `ODT {j.odf}`; helper copy "Arrastrá una ODF…" + "Total: N ODFs" → ODT; missing-machine tooltip "abrí la ODF" → "abrí la ODT".

Out of scope for the rename in this ship: PO/intake/spreadsheet/OTD-tracker/admin/route files — those are non-production surfaces (PO layer, dashboards, risk page). Keeping the rename strictly to the three production surfaces above matches the prompt and avoids label drift in the PO domain. If you also want PO/dashboard surfaces renamed, say so and I'll extend.

### Task 3 — Loosen create-form validation
- Keep `required` only on the `odf` (ODT number) field. Remove any other required attributes (currently only `odf` is required, confirm during edit).
- qty already defaults to 1 — leave as-is.
- ODT with no machine + no turnos → no `planned_start`/`planned_end` → already excluded from the calendar. No code change needed; verify after edit.

### Acceptance
1. qty=3, hours/pc=2.5, machine 8h/turno → `hours_override=7.5` → Gantt block ≈ one shift.
2. ODT with only number saves successfully and does not appear on calendar.
3. All "ODF" text in `CreateJobDialog`, `MachineGantt`, `StatusBoard` reads "ODT".
4. No diff in `src/lib/scheduling/*`.

### Not in this ship
Auth reconciliation, tube_spec decomposition, ODF parent hierarchy, Excel ingest, Raquel report, taller list.
