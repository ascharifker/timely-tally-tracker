# Quality Matrix v2 — PAUSED pending Catalina process mapping

## Status
Hold implementation until after Alex meets with Catalina (tomorrow) to understand her actual QC review process.

## Why
Catalina's two uploaded files are just one example part sheet and one blank form. The correct generic data model — who fills what, when, how forms tie to PIR revisions, how many pieces and sub-readings, and how out-of-tolerance is handled — depends on the real process. We should not build against these specific files and then discover the workflow is different.

## After the meeting
1. Update this plan with the real process flow.
2. Design a form/part-spec/inspection data model that matches how Catalina works, not the two example files.
3. Only then implement the Quality Matrix panel, importers, role gating, and seed data.

## In the meantime
- Keep the existing Quality Matrix placeholder as-is (reference document + generic checklist) so Engineering still has a sign-off step to demo.
- Do not delete the old `quality_matrix_*` tables or rewrite `QualityMatrixPanel` until the new model is confirmed.
- Use the meeting notes to fill in a revised plan, then get user approval before coding.
