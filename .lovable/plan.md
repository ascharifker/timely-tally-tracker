# Digital Twin tab for machines

Short answer: yes — but as a **data-driven twin**, not a physics simulator. You already capture everything a useful first version needs (`machine_runs`, `jobs`, `part_times`, `status_events` with breakdown/maintenance kinds, machine specs and hourly cost). A twin built on that gives Fernando real value on day one and gets more accurate as runs accumulate. A CNC physics/G-code simulation would need machine telemetry you don't have yet, so that stays out of scope.

## What gets added

A new **Gemelo Digital** tab on the machine page (`/maquina/:id`), next to Resumen / Especificaciones / Producción / Tiempos / Eventos.

### 1. Health score
A single 0-100 score per machine with the drivers shown underneath:
- Speed drift: real h/pieza vs catalog (already computed in `catalogDeviation`)
- Variability: run-to-run standard deviation trend (rising σ = the machine or setup is degrading)
- Breakdown load: unplanned `breakdown` / `maintenance_corrective` hours in the last 90 days
- Utilization vs available shift hours

### 2. Maintenance prediction
- Cumulative run hours since the last preventive maintenance event, versus a per-machine service interval
- Projected date the interval is hit, based on the machine's recent hours/week
- Alert states: OK / Due soon / Overdue
- A "drift alarm" when the last N runs of a PIR are consistently slower than that PIR's own baseline — the earliest honest signal of tool or spindle wear

### 3. Performance simulator
"What if" panel with sliders, no data written:
- Shifts per day and hours per shift
- Speed factor (e.g. -10% if degrading, +5% after service)
- Queue of pending ODTs for this machine
Outputs projected completion date for the queue, throughput in pieces/week, projected monthly cost, and the delta vs the current baseline. It reuses the existing `scheduleJob` engine so results match the real calendar.

### 4. Run history chart
h/pieza per run over time per PIR, with the catalog line and a trend line, so degradation is visible instead of inferred.

Empty states everywhere: with zero closed runs the tab explains what to record instead of showing fake numbers.

## Technical notes

- New pure module `src/lib/digital-twin.ts` alongside `machine-metrics.ts`: health score, maintenance projection, drift detection, simulation. No new dependencies; charts use the recharts setup already in the project.
- New component `src/components/fact/DigitalTwinTab.tsx`, wired into the existing tab switch in `src/routes/maquina.$id.tsx`.
- One small migration: add `service_interval_hours` (default 500) and `last_service_at` to `public.machines`, editable from the specs form. Everything else is derived from existing tables — no new tables, no new writes.
- Simulation is read-only; it never touches `jobs.planned_start/planned_end`.

## Out of scope for now

Live CNC telemetry / MTConnect ingestion, G-code cycle simulation, and ML-based failure prediction. Those need machine-side connectivity and a much larger run history; the tab is structured so telemetry can feed the same score later.
