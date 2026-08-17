# Add an "Engineering" role

Today the role list is: admin, manager, po_editor, coe_reviewer, third_party_reviewer, production_editor, viewer. There is no role that specifically owns the engineering verification queue — anyone authenticated can open `/engineering`, and PO line edits are gated by the PO-editor/reviewer rules.

## What we'll add

A new `engineer` role (label "Engineering") that:
- Can be assigned when inviting a user or from the role dropdown in Settings > Users.
- Can advance, flag, approve, back-track and reopen steps in the Engineering funnel, and edit PIR revision / body-tube specs on PO lines — regardless of COE vs third-party track.
- Sees the Engineering nav item and the engineering queue; non-engineers keep read-only access (no advance/flag/back buttons).
- Does not gain PO creation/deletion or production scheduling rights (admins still have everything).

## Technical details

- Migration: `ALTER TYPE app_role ADD VALUE 'engineer'`, then update `current_user_can_edit_po` so it also returns true for `has_role(uid,'engineer')` (engineering owns line-level review fields). Keep existing policies otherwise unchanged.
- `src/hooks/useUserRole.ts`: add `engineer` to the `AppRole` union.
- `src/lib/rbac.ts`: add `ROLE_LABEL.engineer = "Engineering"`, include it in `primaryRoleLabel` ordering (after po_editor), and add `canReviewEngineering(roles)` = admin || manager || engineer.
- `src/components/settings/UsersPanel.tsx`: add `engineer` to `ROLE_OPTIONS`.
- `src/routes/engineering.tsx` and `src/components/fact/EngStepDrawer.tsx`: gate mutating controls (advance / flag / approve / back / reopen) behind `canReviewEngineering`; keep the queue viewable by everyone.
- `src/components/fact/AppShell.tsx`: show the Engineering nav item for engineers (and keep it visible for others as read-only).
- `src/lib/po-workflow.functions.ts`: server-side check that the caller has admin, manager, or engineer before mutating step state, so the gate isn't UI-only.
