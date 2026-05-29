# Integración completa de máquinas + captura de runs

Continuar los 5 puntos pendientes para cerrar el ciclo de detalle de máquina y captura de tiempo real.

## 1. Start/Stop en cards del Kanban
En `src/components/fact/StatusBoard.tsx`, dentro de cada card de las columnas `MAZAK` y `TALLER_EXTERNO`:
- Renderizar `<StartStopRunButton jobId machineId />` compacto (icono ▶/⏹) al lado del chip de máquina.
- Solo visible si la card tiene `machine_id` asignado.
- Si no hay máquina asignada en MAZAK/TALLER_EXTERNO → badge "⚠ Sin máquina" en lugar del botón.

## 2. MachineRunsTable en JobDetailDialog
En `src/components/fact/JobDetailDialog.tsx`:
- Nueva sección "Producción real" después de los datos del ODF.
- Lista de runs del job (todas las máquinas por las que pasó), con start/end/pieces/operador.
- Botón "Registrar run pasado" → form retroactivo (machine, started_at, ended_at, pieces, operator).
- Mostrar resumen: total horas reales acumuladas vs `hours_override` planificado.

## 3. Gantt → detalle de máquina
En `src/components/fact/MachineGantt.tsx`:
- Labels de fila de máquina (columna izquierda) envueltos en `<Link to="/maquina/$id">`.
- Hover con `bg-accent` y cursor pointer.

## 4. Configuración: vendors + ficha
En `src/components/fact/MachinesConfig.tsx`:
- Nueva tab/sección "Talleres externos" usando `useVendors`.
- CRUD básico de vendors (nombre, CUIT, contacto, hourly_rate, lead_time_days_avg, activo).
- En cada fila de máquina interna y externa: botón "Ver ficha" → `/maquina/$id`.
- Para crear máquina tipo `external`, dropdown opcional de vendor.

## 5. Tab Eventos en /maquina/$id
En `src/routes/maquina.$id.tsx`:
- Nueva tab "Eventos" con sub-filtros: Producción / Mantenimiento / Todos.
- Producción = `status_events` de jobs que pasaron por esta máquina (kind: `delay`, `status_change`).
- Mantenimiento = `status_events` con kind `maintenance_preventive` | `maintenance_corrective` (sin `job_id` o ligados a la máquina vía notes/futuro `machine_id`).
- Botón "Registrar mantenimiento" → form (tipo, fecha inicio/fin, costo opcional, descripción) que inserta en `status_events`.
- Solo visible para máquinas internas (no vendors).

## Detalles técnicos

**Nuevos archivos:**
- `src/components/fact/RunBackfillForm.tsx` — form para run retroactivo (usado en JobDetailDialog).
- `src/components/fact/VendorsConfig.tsx` — sección de talleres externos.
- `src/components/fact/MaintenanceEventForm.tsx` — registro de mantenimiento.
- `src/components/fact/MachineEventsTab.tsx` — tab con filtros.

**Editados:**
- `StatusBoard.tsx`, `JobDetailDialog.tsx`, `MachineGantt.tsx`, `MachinesConfig.tsx`, `maquina.$id.tsx`.

**Sin migración nueva** — todo el esquema necesario ya existe (machine_runs, vendors, event_kind extendido).

**Nota sobre eventos de mantenimiento:** `status_events` requiere `job_id NOT NULL` actualmente. Para mantenimiento sin job, hay dos opciones:
- (a) hacer `job_id` nullable y agregar `machine_id` nullable a `status_events` (mini-migración).
- (b) diferir mantenimiento a una tabla `maintenance_events` dedicada en una fase futura, y por ahora la tab Eventos solo muestra producción.

Recomiendo **(a)** porque es 1 migración chica y desbloquea MTBF/MTTR sin tabla nueva. Confirmá antes de ejecutar.
