## Sprint 2 — Reporting value (revised)

Holding **#4 (decompose `tube_spec`)** until Raquel confirms her column list. Shipping **#5** and **#3** now.

---

### #5 — "Orders received" / pending-review view

A dedicated landing surface for engineering reviewers (Alexis / Lendris) and Peter to see what's waiting on them.

- New route `src/routes/pending-review.tsx` (under `_authenticated`).
- Reuses `PoLinesSpreadsheet` with a new `mode="pending"` that pre-filters to lines where `status = 'pending_engineering'` (and optionally `engineering_flagged` for re-review).
- Top KPI strip: counts by track (COE, Third-Party, Internal) + "oldest waiting" age in days.
- Row click → existing `PoDetailDialog`.
- Sidebar/header nav link "Pending review", visible to: `admin`, `po_editor`, `coe_reviewer`, `third_party_reviewer`. Reviewers' link auto-scopes to their own track via search param.

### #3 — COE vs Third-Party split (filter tabs)

Filter tabs on `/purchase-orders` — no new routes.

- Tabs: **All · COE · Third-Party · Internal**, backed by URL search param `?track=all|coe|third_party|internal` (Zod-validated via `@tanstack/zod-adapter`, default `all`).
- `PoLinesSpreadsheet` accepts a `track` prop and filters lines by joined `purchase_orders.review_track`.
- Same tabs reused inside the Pending-review view.
- Default tab per role: `coe_reviewer` → COE, `third_party_reviewer` → Third-Party, others → All. Reviewer tabs not matching their role are still visible (read-only) so handovers work.

---

### Technical details

**New / changed files**
- `src/routes/pending-review.tsx` (new)
- `src/hooks/usePendingReviewLines.ts` (new) — single query joining `po_line_items` + `purchase_orders` filtered by status/track.
- `src/components/fact/PoLinesSpreadsheet.tsx` — add `mode: "intake" | "pending"` and `track?: ReviewTrack | "all"` props; existing call sites keep current behavior.
- `src/routes/purchase-orders.index.tsx` — add Tabs + `validateSearch` for `?track=`.
- `src/components/fact/AppShell.tsx` — add "Pending review" nav link, role-gated.
- `src/lib/rbac.ts` — add `defaultTrackForRoles(roles)` helper.

**No schema changes.** `review_track` already exists on `purchase_orders` from Sprint 1. RLS already scopes edits via `current_user_can_edit_po`; viewing across tracks stays open to all authenticated users (read-only outside your track).

**Out of scope (Sprint 3)**: #4 tube_spec decomposition. Re-open once Raquel sends her column list.

---

## Sprint 3 — shipped

- **#7 Export to email** — `ExportLinesDialog` on `PoLinesSpreadsheet`: downloads filtered CSV and opens `mailto:` with the formatted line summary in the body. Zero backend dep so it works before Lovable Emails is attached to this project; swap to server-side send later via Lovable Emails when the domain is wired.
- **Bilingual toggle (EN/ES)** — `src/lib/i18n.tsx` provides `I18nProvider` + `useI18n()`. Persists in `localStorage` (`mego.lang`), defaults from `navigator.language`. Header toggle in `AppShell`. Covers Order-layer chrome (nav, page titles, track tabs, export dialog). Production layer stays Spanish.
- **Vacation delegation** — `review_delegations` table + `has_active_delegation()` + extended `current_user_can_edit_po()`. Admin UI at `/admin/delegations` (list / add / remove). An active delegation grants the delegate edit rights on the chosen track for the date window without touching their role assignments.

---

### Order of execution
1. Search-param + tabs on `/purchase-orders`.
2. `PoLinesSpreadsheet` track prop.
3. `usePendingReviewLines` hook + `pending-review.tsx` route.
4. Nav link + role-defaulted track.
5. Manual verification: log in as admin, switch tabs, hit Pending review, confirm reviewer-scoped defaults.
