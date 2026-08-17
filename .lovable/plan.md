# What we still need from Engineering (Alexis / Lendris)

Cross-referenced against Alexis's process as captured earlier in this project (Peter uploads PO -> Engineering validates PIR + specs against the Master PIR list in E-Dash -> Production creates the ODT and assigns machine/operator -> date changes flow back to Peter with an audit trail) and against the 4-step Engineering funnel we built (PO Info -> PIR Verification -> Part Component List -> Quality Matrix Check).

Steps 1-3 are functional today. Step 4 is still a placeholder, and two inputs are missing that only Engineering can supply.

## Ask list (what to request in the meeting)

1. **Master PIR file (Excel)** — the current revision of the master parts/PIR list.
   - Needed to load into the Part Component List step so lines can be cross-checked in-app instead of in E-Dash.
   - Ask: who owns it, how often it is re-issued, and who should be allowed to replace it.

2. **Quality Matrix definition** — the open item flagged earlier ("the Matrix is not a static checklist, will clarify with the team").
   - Needed: what the matrix actually checks, where the source data lives (Excel? E-Dash? per-customer?), what a pass/fail looks like, and whether it is per PO line or per part number.
   - Without this, Step 4 stays a "Done" button with no verification value.

3. **Flag / rejection reasons** — the standard list of reasons Engineering sends a line back to Peter (wrong PIR, missing revision, spec mismatch, missing drawing, etc.).
   - Turns the free-text flag into a consistent, reportable dropdown.

4. **Spec fields that matter** — which fields inside tube spec they actually verify (OD, ID, wall, thread, material, length, heat treat...).
   - This unblocks the decomposition of `tube_spec` into real columns and makes engineering review checkable rather than eyeballed.

5. **Queue ownership rules** — confirm the COE vs Third-Party split (Alexis vs Lendris), who covers vacations, and whether a line can be reassigned mid-review.

6. **Target review SLA** — how long a line should sit in each step before it is late.
   - The funnel already timestamps every step; an SLA turns that into an alert instead of just a clock.

7. **Sample completed line** — one real PO line walked end to end with the correct PIR, correct spec, and matrix outcome, to use as the validation reference.

## What we build once each item lands

| Input received | Change in the app |
| --- | --- |
| Master PIR Excel | Load into Step 3, auto-match PIR from the file, show mismatch warning |
| Matrix definition | Replace the Step 4 placeholder with a real check + pass/fail record |
| Flag reasons | Reason dropdown on flag, reason breakdown in Pending Review |
| Spec fields | Split `tube_spec` into columns; per-field verify checkboxes in Step 2 |
| Queue rules | Role-scoped defaults and delegation coverage confirmed in Settings |
| SLA targets | Overdue badges in Engineering and Pending Review |
| Sample line | End-to-end acceptance test before wider rollout |

## Not blocking

Orders intake, PO grouping/pricing, ODT creation, Gantt scheduling, undo, and Kanban execution are all live and do not depend on Engineering input.
