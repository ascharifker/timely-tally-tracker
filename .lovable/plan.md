# Portfolio Case Study: Architecture & Applied AI Story

Produce a written deliverable (not app changes) that extracts the architecture and product-systems story of this production/on-time-delivery platform.

## Deliverable

A single markdown document saved as an artifact you can copy into your portfolio:
`/mnt/documents/mego-fact-case-study.md`

No source files in the app will be modified.

## Structure of the document

1. Executive summary (short, non-technical)
2. Technical summary (one paragraph, engineer-facing)
3. Product summary — what the system does, who uses it (Peter/orders, Alexis-Lendris/engineering, Catalina/quality, Fernando/production), which decisions it improves
4. Business problem — pre-system state: PO data trapped in PDFs and spreadsheets, revision control by memory and Dropbox folders, scheduling on whiteboards, no OTD truth, no audit trail
5. System architecture
   - Frontend: TanStack Start routes, role-driven navigation, React Query cache, drag-to-reschedule Gantt, kanban, undo layer
   - Backend: server functions on the edge runtime, Postgres with row-level security, storage for PO PDFs, Dropbox OAuth server module
   - Entities: customers, purchase_orders, po_line_items, jobs, job_steps, machines, machine_runs, shifts, part_times, vendors, status_events, qc_document_matrix, qc_document_events, po_line_step_events, date_change_log, user_roles, review_delegations
   - Permissions: role table + security-definer checks, track-based routing (COE vs third party), vacation delegation
6. Data ingestion model — PO PDF parse, manual line entry, MAQUINADOS Excel bulk import, quality-matrix Excel import, Dropbox plan search, shop-floor run start/stop; normalization into line items and work orders; ODT numbering
7. Business logic — deterministic core: shift-aware scheduling, cascade recalculation, OTD classification (on_time / at_risk / late), ODF-level OTD scoring with early/late day deltas, engineering step state machine with backtracking, document revision comparison (PO rev vs documented rev vs Dropbox rev), status pipeline, date-change logging
8. Applied AI architecture — where AI is used today (PO extraction, narrative briefings through a summary-only proxy with an allow-list) and where it is deliberately excluded (schedules, OTD math, status truth, sign-off); proposed agents: delay-risk explainer, exception triage, revision-drift watcher, vendor/customer comms drafts, weekly ops digest; required context and guardrails
9. Decision loop — input → deterministic analysis → human decision → action → measured outcome, with the feedback signals each layer emits
10. Metrics & impact — adoption, operational, business outcome metrics, plus portfolio proof points and how to phrase them honestly
11. My role — product architecture, data modelling, business-rule design, workflow mapping, applied-AI use-case design, stakeholder alignment, implementation leadership
12. Polished portfolio rewrite — Problem / Architecture / Applied AI Role / Decision Loop / Metrics / My Role / What I'd improve next
13. Five resume bullets
14. Mermaid diagrams: system architecture, data flow, status workflow, AI opportunity map, decision loop

## Notes

- Everything is grounded in what actually exists in the codebase and database; speculative items are labelled as proposals, not shipped work.
- Metrics are framed as instrumentation targets unless you supply real numbers.
