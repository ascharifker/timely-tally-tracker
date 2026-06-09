## Audit: Ship 1 (ODT rollout) vs Fernando's brief

I pulled the artifact (`otd-hub-lovable-build-prompt-ship-1-odt-rollout-jun-9-2026.md`) and diffed it against current code.

### What's already done ✅
- **Task 1 — hours-per-piece input**: `CreateJobDialog.tsx` uses `hoursPerPiece` decimal state, `hours_override = hoursPerPiece × qty`, helper text rewritten, turnos/percent-of-shift logic removed, `// v1 = pure ODT…` comment present.
- **Task 2 (partial) — ODF→ODT rename**: clean in `CreateJobDialog.tsx`, `MachineGantt.tsx`, `StatusBoard.tsx`, `routes/production.tsx`, `OdfBreakdownDialog.tsx`.
- **Task 3 — loosened validation**: only `odf` is `required`; qty defaults to 1.
- **Scheduling engine untouched**: no diff in `schedule.ts`, `duration.ts`, `cascade.ts`, `lanes.ts`, `impact.ts`, `otd.ts`.

### Gaps before sharing with Fernando ⚠️

**1. Residual "ODF" in surfaces Fernando WILL navigate to** (brief says "any nav/header text in production"):
- `src/components/fact/OTDTracker.tsx` — "ODF…requieren atención", "Todos los ODFs al día"
- `src/components/fact/JobDetailDialog.tsx` — 9 occurrences (title bar, reprogramar copy, toasts, cascade preview)
- `src/components/fact/JobHistorySheet.tsx` — sheet title "Historial · ODF …"
- `src/routes/maquina.$id.tsx` — "ODFs activas", "ODFs asignadas", empty state
- `src/routes/riesgo.tsx` — page copy, table header, count, meta description
- `src/routes/index.tsx` — dashboard subtitle "N ODFs activos · M máquinas"

→ Rename all six files' user-visible "ODF/ODFs" → "ODT/ODTs". DB keys (`job.odf`) and code identifiers stay.

**2. Publish metadata is still template default**:
- `src/routes/__root.tsx` still has `title: "Lovable App"`, `description: "Lovable Generated Project"`, and the same on og:title/og:description.
→ Set real title (e.g. "OTD Hub · MEGO Producción"), real description, matching og:* and twitter:* tags before publish.

**3. Auth reconciliation — your call, not a code change**:
The brief flags Alex promised Fernando a self-signup link, but the app is locked-down (`disable_signup`). Recommended path from the brief: provision Fernando's account directly, seed role = `manager`, send him ready credentials instead of a signup link. **I won't touch auth in this pass — confirm how you want to handle it.**

### Acceptance re-check (manual, after edits)
1. ODT qty=3, hours/pc=2.5, 8h machine → Gantt block ≈ one shift.
2. ODT with only number saves and stays off the calendar.
3. No "ODF" text visible anywhere in production navigation.
4. Scheduling engine git-clean (already confirmed).

---

## Plan for this pass

### Step 1 — Finish ODF→ODT label sweep (production-adjacent surfaces)
Edit the six files above, replacing visible "ODF"/"ODFs" with "ODT"/"ODTs". Keep `j.odf` field reads, route names, DB columns, and the `// ODF parent layer deferred` comment in `CreateJobDialog.tsx`.

### Step 2 — Publish metadata
In `src/routes/__root.tsx`, replace the four "Lovable App"/"Lovable Generated Project" head entries with:
- title: `OTD Hub · MEGO Producción`
- description: `Planificación de producción Mego Afek — ODTs, OTD determinístico y cascada de impacto.`
- og:title / og:description / twitter:title / twitter:description: same values
- og:type stays `website`

### Step 3 — You decide on auth, then I publish
Two options for Fernando's account — tell me which:
- **A. Stay locked-down (recommended by brief):** I leave auth alone; you/Alex create Fernando's user in the backend with role `manager` and send him creds out-of-band. Then I publish.
- **B. Open self-signup temporarily:** enable signups + email verification, optionally restrict to his email domain, manually promote to `manager` after first login. Riskier; not what the brief recommends.

### Out of scope (deferred, per brief)
tube_spec decomposition, ODF parent hierarchy, Excel ingest, Raquel report, taller list additions.

### Acceptance for this pass
- `rg "ODF" src/components/fact src/routes` returns only the deferred-layer code comment.
- Root head() shows real OTD Hub metadata.
- Auth path decided and (for option A) Fernando's account exists before I hit publish.

Answer Step 3 (A or B) and I'll execute Steps 1–2 immediately.
