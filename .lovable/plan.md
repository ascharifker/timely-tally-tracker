
# Paso 2.5 (revisado) — Workflow por colas con roles + audit trail de fechas

Tu descripción del workflow es correcta y coincide con la transcripción. Reemplazo el plan anterior de "auto-crear ODFs" por un flujo de **colas con handoff entre roles**, que es lo que Peter y vos acordaron.

## Flujo end-to-end

```text
┌──────────────┐   ┌──────────────────┐   ┌─────────────────────┐   ┌──────────────┐
│ 1. INTAKE    │ → │ 2. INGENIERÍA    │ → │ 3. PRODUCCIÓN       │ → │ 4. CALENDAR  │
│ Peter sube   │   │ Alexis valida    │   │ Luis Angel crea ODF │   │ Gantt + OTD  │
│ PDF del PO   │   │ PIRs vs master   │   │ asigna máquina/op   │   │              │
└──────────────┘   └──────────────────┘   └─────────────────────┘   └──────────────┘
                                                                            │
                                                                            ▼
                                                                  ┌─────────────────┐
                                                                  │ 5. CAMBIO FECHA │
                                                                  │ → Notif a Peter │
                                                                  │ → Audit trail   │
                                                                  └─────────────────┘
```

Cada paso es una **cola visible** con la línea de PO esperando acción del rol correspondiente.

## Parte A — Wipe de datos demo

Borrar (TRUNCATE ... CASCADE en transacción): `status_events`, `machine_runs`, `shifts`, `job_steps`, `jobs`, `po_line_items`, `purchase_orders`, `customers`, `briefings`. Mantener `machines`, `vendors`, `part_times`.

## Parte B — Modelo de estados por línea (no por PO)

Agregar columna `status` a `po_line_items` con enum:
- `pending_engineering` — recién extraída del PDF, esperando a Alexis
- `engineering_approved` — Alexis validó el PIR contra master
- `engineering_flagged` — Alexis encontró problema (rev desactualizada, falta info, etc.) + `flag_reason text`
- `ready_for_production` — pasa a la cola de Luis Angel (manual o automático tras approve)
- `scheduled` — Luis Angel creó la ODF y la metió al calendario
- `in_progress` — ODF arrancó
- `completed` — entregada
- `cancelled`

El `purchase_orders.status` queda como vista derivada (computado, no editable manual).

## Parte C — Tres vistas / colas nuevas

Reemplazan / complementan `/purchase-orders`:

### 1. `/intake` (Peter)
- Botón "Cargar PO" (igual que hoy) → sube PDF → extrae con AI → review form → al confirmar inserta `purchase_orders` + `po_line_items` con `status='pending_engineering'`.
- Tabla "Mis POs" con filtros por cliente/fecha/status agregado. Su "spreadsheet".

### 2. `/engineering` (Alexis)
- Cola: todas las líneas con `status='pending_engineering'`, agrupadas por PO.
- Por cada línea, Alexis ve PIR, tube_spec, qty, link al PDF original. Acciones:
  - **Aprobar** → status pasa a `engineering_approved` y automáticamente a `ready_for_production`.
  - **Flagear** → status `engineering_flagged` + textarea con motivo (ej: "PIR 102882625 rev C desactualizada, usar rev D"). Vuelve a la cola de Peter para resolver con el cliente.
- Campo opcional para Alexis: corregir PIR / tube_spec si el AI los extrajo mal.

### 3. `/production` (Luis Angel)
- Cola: líneas con `status='ready_for_production'`.
- Por cada línea, botón "Crear ODF" → abre dialog tipo `CreateJobDialog` pre-llenado con PIR/qty/customer_date de la línea, y campos para: máquina, operador, planned_start, planned_end (sugiere fecha por part_times si existe). Al guardar:
  - Inserta `jobs` con `po_line_item_id` apuntando a la línea
  - Línea pasa a `status='scheduled'`
  - Aparece en el calendario/Gantt existente

## Parte D — Audit trail de fechas + notificaciones a Peter

Nueva tabla `date_change_log`:
- `id`, `po_line_item_id`, `job_id` (nullable)
- `field` (ej `customer_date`, `planned_end`, `committed_date`)
- `old_value date`, `new_value date`
- `changed_by text`, `changed_at timestamptz`
- `reason text` (opcional, lo escribe quien edita)
- `acknowledged_by_peter boolean default false`, `acknowledged_at`

Trigger en `jobs` y `po_line_items`: cuando cambia `planned_end`, `customer_date` o `committed_date`, inserta una fila en `date_change_log`.

Nueva sección en `/intake` (vista de Peter): **"Cambios de fecha pendientes de revisar"** — bandeja arriba de su spreadsheet con todas las filas de `date_change_log` con `acknowledged_by_peter=false`. Cada fila muestra:
- ODF / PO / cliente
- Fecha original → fecha nueva (diff en días, rojo si se atrasa)
- Quién y cuándo cambió
- Botones "Marcar como visto" y "Llamar cliente" (este último solo registra la acción, no llama).

En el detalle de cada línea/ODF, tab "Historial de fechas" con toda la cronología.

## Parte E — Workflow en código

- Migración: enum `po_line_status`, columna en `po_line_items`, tabla `date_change_log`, triggers.
- 3 nuevas rutas (`/intake`, `/engineering`, `/production`) en `src/routes/`.
- Reutilizar `UploadPoDialog` para `/intake`. Crear `EngineeringQueue.tsx` y `ProductionQueue.tsx`.
- Hook `useDateChanges()` para la bandeja de Peter.
- Server functions: `approvePoLine`, `flagPoLine`, `createJobFromPoLine`, `acknowledgeDateChange`.
- Nav `AppShell`: tabs por rol (sin auth aún, solo navegación). Cuando llegue auth (Paso 5), cada rol ve solo su cola.

## Lo que NO hace este paso

- **Auth/roles reales**: las 3 vistas son visibles para todos. La separación por rol es organizativa, no enforced. (Paso 5 lo arregla con Lovable Cloud Auth + tabla `user_roles`.)
- **Notificaciones por email/SMS**: la bandeja de cambios es in-app. Email sale en paso siguiente con Lovable Emails.
- **Visibilidad de terceros (Schlumberger, acero)**: Peter mencionó que es su mayor dolor pero no hay sistema upstream que consultar. Lo dejamos para un módulo "Vendors" donde Peter manualmente registre status (futuro paso).
- **Integración con E-Dash**: Alexis sigue cargando en E-Dash en paralelo. La app no se sincroniza con E-Dash (no hay API). Es una decisión a tomar más adelante (¿migrar fuera de E-Dash o integrar?).
- **OR report de Halliburton/COE**: Peter dijo que sigue tirando de ahí. No lo replicamos por ahora.

## Criterio de éxito

1. Wipe → base limpia.
2. Peter (vos haciéndote pasar) sube `4518744487.pdf` en `/intake` → quedan 4 líneas en `pending_engineering`.
3. Cambiando de tab a `/engineering`, las 4 aparecen. Aprobás 3, flageás 1 con motivo "PIR rev desactualizada".
4. En `/production`, las 3 aprobadas aparecen. Creás 3 ODFs asignando máquina y fechas.
5. Las 3 ODFs aparecen en el calendario `/` con las fechas que pusiste.
6. Cambiás `planned_end` de una ODF → en `/intake` Peter ve la bandeja con fecha vieja → nueva.
7. La línea flageada sigue visible para Peter en `/intake` con el motivo de Alexis.

## Decisiones pendientes para arrancar

1. **¿Implementar todo de una?** Es grande. Sugiero dividir en dos commits: (B) wipe + estados + 3 colas básicas; luego (D) audit trail + bandeja de Peter.
2. **Línea flageada por Alexis**: ¿vuelve a Peter o queda visible para ambos sin status especial?
3. **Cuando Luis Angel crea la ODF, ¿la fecha "comprometida con cliente" (`customer_date`) viene del PDF y queda inmutable, o Luis Angel puede sobreescribirla?** Lo correcto operativamente sería: `customer_date` viene del PDF y NO se toca (es lo prometido al cliente); `planned_end` es lo que producción cree que va a entregar, y si `planned_end > customer_date` el sistema lo marca en rojo como "atrasado contra promesa".

Si confirmás, arranco con la migración + Parte A + B.
