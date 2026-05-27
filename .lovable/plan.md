
## Qué pasa hoy (por qué confunde)

- El diálogo se llama "Registrar retraso" y sólo acepta horas positivas → no sirve si querés adelantar un ODF.
- El motivo es texto libre → no se puede filtrar/leer después por causa.
- Arrastrar una barra en el Gantt **mueve sólo ese ODF** y se guarda al instante. Si caés encima de otro, se solapan en silencio.
- No hay forma de "probar" varios movimientos antes de confirmar — cada drag es definitivo.
- El historial de eventos existe en la tabla `status_events` pero no se ve en la UI.

## Qué vamos a construir

### 1. Tipos de evento (reemplaza "retraso" libre)

Nueva categoría obligatoria al reprogramar. Cada una determina cómo se aplica la cascada:

| Categoría | Comportamiento de cascada |
|---|---|
| **Retraso de producción** | Empuja ODF + todos los siguientes en la misma máquina |
| **Prioridad cambiada** (orden urgente entra) | Inserta el ODF en una posición/fecha y empuja los desplazados hacia adelante |
| **Ausencia de personal** | Selecciona un turno (mañana/tarde/noche) en una fecha → empuja todos los ODFs activos de ese turno en TODAS las máquinas internas |
| **Cambio de orden del cliente** | Recalcula duración (qty × hours_per_piece de `part_times`) y reprograma sólo ese ODF + cascada normal |
| **Avería de máquina** | Selecciona máquina + horas fuera de servicio → empuja todo lo de esa máquina |

Migración DB: agregar columna `event_kind` a `status_events` (enum: `delay`, `priority_shift`, `absence`, `change_order`, `breakdown`).

### 2. Pull-in (adelantar) + Push (retrasar)

El campo de horas acepta negativos. La cascada con shift negativo sólo se aplica si no genera solapamiento con ODFs anteriores; si genera conflicto, se avisa antes de confirmar.

### 3. Modo borrador con botón "Aprobar movimientos"

Cambio importante en UX del Gantt. Hoy cada drag es instantáneo → reemplazar por:

- Arrastrar marca el movimiento como **pendiente** (barra con borde punteado dorado, posición nueva visible, posición vieja como ghost).
- Aparece una **barra de acciones flotante** abajo del Gantt: `3 movimientos pendientes · [Descartar] [Aprobar movimientos]`.
- Cada movimiento pendiente puede tener su propia categoría (default "Retraso de producción", editable en un mini popover sobre la barra pendiente).
- "Aprobar" abre un único diálogo con resumen: lista de cambios + selector global de categoría (si todos comparten) + motivo opcional + preview de cascada combinada → confirma todo en una transacción.
- "Descartar" revierte las posiciones visuales sin tocar la DB.

Estado de pendientes vive en React (no en DB) — `Map<jobId, { planned_start, planned_end, machine_id, event_kind }>`.

### 4. Historial lateral por ODF

Nuevo panel deslizable (Sheet de shadcn) accesible desde el `JobDetailDialog` con botón "Ver historial". Lista cronológica de `status_events` para ese ODF mostrando:
- Icono + color por `event_kind`
- Fecha/hora del evento
- Shift en horas (+/-)
- Motivo
- Diff de fechas (de X a Y)

### 5. Renombrar y clarificar

- Diálogo: "Registrar retraso" → **"Reprogramar ODF"**
- Toast del drag: explica qué pasó ("Movido a MAZAK 2 · pendiente de aprobar")
- Tooltip permanente en barra Gantt explicando: arrastrá para mover, click para editar, los movimientos se aprueban en lote.

## Detalles técnicos

**Archivos:**
- `supabase/migrations/<ts>_event_kind.sql` — agrega enum `event_kind` y columna en `status_events` (default `'delay'` para filas existentes).
- `src/lib/fact-types.ts` — `EventKind` type + `EVENT_KIND_LABEL` + `EVENT_KIND_COLOR`.
- `src/lib/scheduling/cascade.ts` — nuevas funciones `cascadeAbsence(jobs, machineIds, shiftDate, slot, hours)` y `cascadePriorityInsert(jobs, jobId, targetMachine, targetDate)`. La `cascade` existente sigue siendo el motor común (suma horas en máquinas relevantes).
- `src/hooks/useFactData.ts`:
  - `useApplyReschedule({ moves: PendingMove[], event_kind, reason })` — reemplaza el patrón actual de `useRescheduleJob` directo; itera moves, calcula cascada por tipo, escribe `status_events` + `jobs` en bloque.
  - Mantener `useRescheduleJob` sólo para uso interno (drag inicial / optimistic preview).
- `src/components/fact/MachineGantt.tsx`:
  - Estado `pendingMoves: Map<string, PendingMove>` (no se persiste).
  - Drag handler ya no llama mutación — sólo actualiza `pendingMoves` y posición visual.
  - Barras renderizan posición pendiente si existe, con borde dorado punteado + ghost en posición original.
  - Footer flotante con `PendingMovesBar` (componente nuevo).
- `src/components/fact/PendingMovesBar.tsx` (nuevo) — contador + descartar + aprobar.
- `src/components/fact/ApproveMovesDialog.tsx` (nuevo) — selector de categoría, inputs específicos por tipo (turno/máquina/etc.), preview de cascada, confirmar.
- `src/components/fact/JobHistorySheet.tsx` (nuevo) — Sheet con `status_events` filtrados por job_id.
- `src/components/fact/JobDetailDialog.tsx` — botón "Ver historial" abre el sheet; el bloque de "Registrar retraso" se reemplaza por el nuevo flujo de reprogramación con categoría.

**Fuera de alcance (lo dejamos para después):**
- Detección de conflictos visuales en tiempo real durante drag (sólo se muestra al aprobar).
- Resize de barras desde los extremos.
- Drag multi-selección.
- Notificaciones a operarios.

## Resultado esperado

El usuario ve el Gantt, arrastra 2-3 ODFs por urgencia + marca un turno sin personal, revisa la cascada combinada, elige categorías, aprueba todo de una vez. Después puede abrir cualquier ODF y ver exactamente qué pasó y por qué.
