## Objetivo

Dejar el OTD Hub completamente en blanco, borrando toda la data operativa acumulada, pero conservando la configuración maestra (clientes, vendors, máquinas, usuarios/roles, delegaciones, part_times, shifts, secuencias ODF).

## Qué se borra

Vía el tool de inserts (DELETE), en este orden para respetar FKs:

1. `date_change_log`
2. `status_events`
3. `machine_runs`
4. `job_steps`
5. `jobs`
6. `po_line_step_events`
7. `po_line_items`
8. `purchase_orders`
9. `briefings`

## Qué se conserva

- `customers`, `vendors`, `machines`
- `user_roles`, `review_delegations`
- `part_times`, `shifts`
- `odf_sequences` (se mantiene la numeración; si prefieres reiniciarla a 0, dilo y la incluyo)

## Fuera de alcance

- Storage bucket `po-documents` (los PDFs subidos permanecen; puedo limpiarlos también si lo pides).
- Cambios de esquema o de código — sólo borrado de datos.
