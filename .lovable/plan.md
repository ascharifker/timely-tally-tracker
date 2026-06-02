ns# Plan B — Alineado con el proceso real de Fron

Objetivo: que `/production` y las ODFs reflejen exactamente cómo Fron (y Luis Ángel a diario) piensan el trabajo, no una abstracción genérica.

## 1. Numeración de ODF estilo Fron (`nnn/yy`)

- Nueva tabla `odf_sequences(year int pk, last_number int)` para emitir secuenciales por año.
- Función `next_odf_number(year)` (SECURITY DEFINER) que devuelve `lpad(n,3,'0') || '/' || (yy)` y avanza el contador atómicamente.
- `createJobFromPoLine` deja de usar `PO-Lx` como default: genera `347/26`, `820/26`, etc.
- En el diálogo "Crear ODF" el campo ODF se prellena con el siguiente número del año pero queda editable (Luis Ángel a veces fuerza un número específico).

## 2. Split de PO line en múltiples ODFs (parcial por cantidad)

- Una línea con `qty_ordered = 200` puede generar varias ODFs (ej. 80 + 80 + 40) con fechas escalonadas (Maqyro / safety stock / staggered delivery como en el spreadsheet de Fron).
- En `/production`, cada línea aprobada muestra: `qty_ordered`, `qty_planeada` (suma de jobs hijos), `qty_pendiente`.
- El diálogo "Crear ODF" pide `qty_parcial` (default = pendiente). El status de la PO line pasa a `scheduled` solo cuando `qty_pendiente = 0`; mientras tanto queda `in_progress` con badge "parcial".
- Validación: no permitir `qty_parcial > pendiente`.

## 3. ODF multi-paso (ruta de producción real)

Cada ODF es una ruta, no un solo estado. Usamos la tabla `job_steps` (ya existe, hoy sin uso) y dejamos el `jobs.status` como agregado de "paso actual".

Pasos estándar generados al crear la ODF:
```text
1. MAZAK n           (máquina interna asignada)
2. MAQUINADO_LISTO   (hito)
3. CEMENTACION       (taller externo Reynosa)
4. CEMENTACION_LISTO (hito)
5. EXPO              (export MX → MEGO USA)
6. YA_SE_ENVIO       (entregado a cliente final)
```

- Cada paso tiene `planned_start/planned_end`, `actual_start/actual_end`, `machine_id` (cuando aplica) y `vendor_id` (para cementación).
- `jobs.status` se deriva del primer paso no completado; los enums `MAQUINADO_LISTO`, `CEMENTACION`, `EXPO`, `YA_SE_ENVIO` ya existen — sumamos `EN_ESPERA`, `ON_HOLD`, `MAQYRO`, `EN_GEMAK`, `CEMENTACION_LISTO` al enum `job_status`.
- Una vista nueva `v_job_current_step` simplifica los JOINs para la UI.

## 4. Atomic unit = TURNO (no datetime libre)

- El diálogo "Crear ODF" reemplaza `planned_start/planned_end datetime-local` por:
  - Selector de **fecha de inicio**.
  - Selector de **turno** (`mañana / tarde / noche`).
  - Número de **turnos requeridos** (calculado por `part_times.hours_per_piece * qty / hours_per_shift`, editable).
- Backend reserva filas en `shifts` (ya existe) por cada turno asignado al paso MAZAK; las fechas planificadas del job se derivan de la primera y última `shift`.
- Para partes complejas se acepta `0.5` piezas/turno (mantener `numeric` en `part_times`).

## 5. Dos fechas separadas (export vs cliente)

- En la UI de la PO line y de la ODF se muestran lado a lado:
  - `export_date` (MX → MEGO USA) — ya existe en `jobs`, lo subimos también a `po_line_items`.
  - `committed_date` (MEGO USA → cliente final) — ya existe.
- Ambas editables; cada edición se loguea en `date_change_log` (ya hay trigger para `committed_date`; agregamos para `export_date`).

## 6. Retraso en cascada (killer feature)

- Botón "Reportar retraso" en cualquier paso → diálogo: amount + unit (`hours/shifts/days`, ya hay helper `toHours`).
- Server fn `applyCascadingDelay(job_step_id, hours)`:
  1. Suma el delay al `planned_end` del paso afectado.
  2. Recalcula `planned_start/end` de TODOS los pasos posteriores del mismo job manteniendo duraciones.
  3. Si el `planned_end` del último paso supera `export_date` o `committed_date`, marca el job con badge "en riesgo" y crea un `status_events` con `event_kind = 'delay'`.
  4. Re-acomoda las `shifts` reservadas (libera las viejas, reserva nuevas a partir del nuevo inicio).
- Default sugerido = 3 días (mencionado por Fron), pero editable.
- Cada cascada queda en `date_change_log` para que Peter las vea en su feed.

## 7. UI `/production` (Luis Ángel como usuario primario)

- Tabla actual de líneas listas conserva el flujo, pero:
  - Columna "Pendiente" (qty_pendiente).
  - Botón "Crear ODF" abre el diálogo nuevo (numeración nnn/yy + turnos + qty parcial).
- Nueva sección debajo: **Mis ODFs activas** — lista de jobs no completados con su paso actual, turno en curso, badge de riesgo y acciones rápidas (`Avanzar paso`, `Reportar retraso`, `Poner ON_HOLD`).
- Vista compacta tipo "shop floor": densa, monoespaciada, pensada para Luis Ángel mirándola todo el día.

## Detalles técnicos (resumen)

- **Migraciones**:
  - `odf_sequences` + función `next_odf_number`.
  - Extender enum `job_status` con `EN_ESPERA, ON_HOLD, MAQYRO, EN_GEMAK, CEMENTACION_LISTO`.
  - `po_line_items.export_date date`; trigger de log.
  - `job_steps.planned_start/end timestamptz, vendor_id uuid`.
  - Vista `v_job_current_step`.
  - GRANTs estándar (`anon/authenticated/service_role`) en tablas nuevas + RLS abierta como el resto del proyecto.
- **Server fns nuevas** (en `src/lib/po-workflow.functions.ts` o nuevo `odf.functions.ts`):
  - `splitPoLineIntoOdf` (reemplaza `createJobFromPoLine`).
  - `advanceJobStep`, `holdJob`, `resumeJob`.
  - `applyCascadingDelay`.
- **Frontend**:
  - Reescritura del diálogo "Crear ODF" en `/production`.
  - Componente `JobStepsTimeline` reutilizable (lista de 6 pasos con estado).
  - Hook `useActiveJobs` para la sección "Mis ODFs activas".

## Fuera de alcance (próxima iteración)

- Integración real con calendario Maqyro / safety stock automático.
- Vista para Peter consolidando todos los retrasos en cascada.
- Notificación a MEGO USA cuando se mueve `export_date`.

## Validación con Fron antes de codear

Tres puntos a confirmar antes de implementar:
1. ¿La numeración `nnn/yy` reinicia el 1 de enero o sigue de corrido?
2. ¿El paso `CEMENTACION` siempre es Reynosa o hay otros talleres? (afecta `vendor_id` requerido vs opcional).
3. ¿El delay por defecto es 3 días fijos o configurable por tipo de evento?
