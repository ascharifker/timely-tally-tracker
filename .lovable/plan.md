## Hacer que ODF PRUEBA (y cualquier MAZAK sin fechas) aparezca en el Gantt + drag para mover

### Diagnóstico
Hay 2 ODFs `PRUEBA` en estado `MAZAK` con `machine_id` asignada pero `planned_start`/`planned_end` en NULL. Por eso caen en la fila "Sin programar" y no como barras. El auto-asignar de fechas que agregamos solo dispara cuando el status **transiciona** a MAZAK — no toca ODFs que ya estaban ahí antes del cambio.

Además, hoy solo se puede reprogramar abriendo el diálogo. Para que sea "seamless" hace falta poder arrastrar la barra en el cronograma.

### Cambios

**1. Auto-asignar fechas también para ODFs ya en MAZAK+ sin programar (`useFactData.ts`)**
- En `useJobs`, después del fetch, detectar jobs con `status ∈ {MAZAK, EXTERNAL, INSPECTION, READY}` + `machine_id` no nulo + sin `planned_start`/`planned_end`.
- Para cada uno, hacer un update con fechas default (`nextShiftStart()` + 2 días, escalonado por máquina para no superponer): primer hueco libre en esa máquina después de las barras existentes.
- Hacerlo una sola vez por sesión (flag en `useRef` o `useEffect` con guard) para no spamear updates.
- Patch optimista en cache para que aparezcan al toque.
- Toast resumen: "Programadas 2 ODFs sin fecha en MAZAK".

**2. Drag-to-reschedule en el Gantt (`MachineGantt.tsx`)**
- Hacer cada barra `draggable` (HTML5 drag, mismo patrón que el Kanban).
- Drop targets: las celdas de día de cualquier fila de máquina.
- Al soltar:
  - Calcular nueva `planned_start` = día de drop a la misma hora actual (o al `nextShiftStart` si era null).
  - Mantener la **duración** original (`planned_end - planned_start`).
  - Si se soltó en otra máquina, también actualizar `machine_id`.
  - Disparar nueva mutación `useRescheduleJob({ id, planned_start, planned_end, machine_id })` con patch optimista.
- Cursor `grab`/`grabbing`, ring de highlight en la celda hovered.
- Las barras de "Sin programar" también se pueden arrastrar al cronograma → asigna fechas + máquina en un solo gesto.

**3. Nueva mutación `useRescheduleJob` (`useFactData.ts`)**
- Update directo de `planned_start`, `planned_end`, `machine_id`.
- Optimista + rollback en error.
- Toast: "ODF X movido a [máquina] · 28/05 → 30/05".

### Archivos tocados
- `src/hooks/useFactData.ts` — backfill al cargar + `useRescheduleJob`.
- `src/components/fact/MachineGantt.tsx` — drag handlers en barras y chips, drop zones en celdas.

### Fuera de alcance
- Resize de barra (cambiar duración arrastrando los bordes) — próxima iteración.
- Detección de conflictos / superposición entre ODFs en la misma máquina.
- Vista anual / heatmap.
