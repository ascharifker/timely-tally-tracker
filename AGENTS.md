# Project conventions
- Line-level ODT creation uses a client-safe field mapping helper shared with its tests; this keeps manually entered tube identity and independent delivery dates explicit.
- The existing jobs.tube_spec field holds the production tube identifier; the original specification remains on the linked po_line_items row and must not be overwritten or used to prefill that identifier.
- Gantt insertion cascades use a pure client-safe planner shared with tests, and batch approval persists only explicit previewed moves; this prevents hidden downstream changes and double cascading.