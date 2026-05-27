
# Distribución realista en 3 turnos + asignación más fácil

## Por qué se ve "todo en un turno"

Confirmado en DB: 46/54 ODFs arrancan a las 08:00, 4 a las 16:00, 1 a las 21:00. Causas:

1. `nextShiftStart()` en `useFactData.ts` usa límites legacy 00 / 08 / 16, pero los turnos reales son **06 / 14 / 22**. Por eso casi todo cae a las 08:00.
2. `useBackfillSchedules` encadena ODFs cabeza-cola por máquina con duración fija de 48h, así que cada ODF arranca exactamente donde terminó el anterior → la cadena entera "hereda" el primer horario.
3. La insignia de turno (M/T/N) en cada barra usa solo `planned_start`, así que aunque la barra cruce los 3 turnos visualmente, todas muestran el mismo turno y el ojo lee "todo es del mismo turno".

## 1. Programación realista por turnos (datos)

Reescribir el backfill + el helper `nextShiftStart` para que reflejen producción 24h:

- `nextShiftStart()` → próximo límite de **06 / 14 / 22** (no 00/08/16). Centralizar reusando `SHIFTS` de `src/lib/shifts.ts`.
- En `useBackfillSchedules`: en vez de duración fija de 48h, usar **1–3 turnos** (8h, 16h o 24h) por ODF según prioridad/cantidad. ODFs grandes ocupan 2–3 turnos; ODFs chicos uno solo. Esto crea bandas visibles M/T/N en vez de barras enormes.
- Llenado por máquina: arrancar en el próximo turno libre y avanzar turno por turno (`startMs + n*8h`). Distribuye automáticamente.
- Botón opcional **"Redistribuir cronograma"** en el header del Gantt que dispara un re-spread: para cada máquina recalcula starts en bloques de 8h consecutivos desde "ahora", respetando duración estimada. Esto arregla los datos actuales sin necesidad de borrar.

## 2. Insignia de turno por ODF más honesta

Cuando un ODF cruza más de un turno, mostrar **rango**: `M→T` (ej. arranca 06h, termina 22h del día) o `M→N+1`. La sub-pieza en la esquina pasa a ser dos chips chiquitos: `M T` o `M T N`. Así de un vistazo se entiende "ocupa toda Mañana y Tarde".

## 3. Asignación / movimiento más fácil

Tres mejoras concretas:

**a) Mini-controles M/T/N en cada barra del Gantt (al hacer hover)**
Aparece una mini-toolbar flotante sobre la barra con `← M T N →`:
- Click en M/T/N: mueve el start al turno elegido del **mismo día**, manteniendo duración. Crea un pending move (igual que el drag).
- `←` / `→`: nudge ±1 turno (8h).
No reemplaza el drag, lo complementa para movimientos pequeños sin precisión.

**b) Asignar turno desde el card del kanban / sin programar**
En `StatusBoard` y en la barra "Sin programar", click derecho (o un pequeño botón `⋯`) abre un popover con:
- Selector de máquina (4 Mazak)
- Día (date picker)
- 3 botones grandes M / T / N con sus colores
- Botón "Programar"

Esto resuelve "asignar sin tener que arrastrar al Gantt", útil cuando no se sabe a qué fila ir.

**c) En el JobDetailDialog: bloque "Cambiar turno"**
Agregar arriba del bloque "Reprogramar ODF" tres botones grandes M/T/N que mueven el ODF al turno elegido del mismo día con un solo click + un selector de día para mover de día sin tocar el turno. Esto es el camino más directo cuando ya hiciste click en una barra y querés moverla.

## 4. Indicador "Carga por turno" en el Gantt header

Una mini barra de 3 segmentos por encima del cronograma que muestra `M: 12 · T: 18 · N: 9` ODFs activos visibles. Así se ve si los turnos están desbalanceados y se sabe a qué turno mandar los próximos.

## Archivos a tocar

- `src/hooks/useFactData.ts` — fix `nextShiftStart` (usar 06/14/22), reescribir `useBackfillSchedules` para spread por turnos, agregar `useRedistributeSchedules`.
- `src/lib/shifts.ts` — agregar helpers `nextShiftBoundary(from)`, `shiftSpan(start, end)` (devuelve `[idx0, idx1, ...]`), `addShifts(date, n)`.
- `src/components/fact/MachineGantt.tsx` — mini-toolbar de turnos en hover, insignia multi-turno (`M T`), botón "Redistribuir", indicador de carga por turno.
- `src/components/fact/JobDetailDialog.tsx` — bloque "Cambiar turno" con M/T/N + date picker.
- `src/components/fact/StatusBoard.tsx` — popover de asignación rápida en card.
- (opcional) `src/components/fact/QuickAssignPopover.tsx` — componente compartido entre kanban y "Sin programar".

## Detalles técnicos

- Helper central:
  ```ts
  // shifts.ts
  export function nextShiftBoundary(from = new Date()): Date {
    const d = new Date(from); d.setMinutes(0,0,0);
    const h = d.getHours();
    const boundaries = [6, 14, 22];
    const next = boundaries.find(b => h < b);
    if (next !== undefined) d.setHours(next);
    else { d.setDate(d.getDate()+1); d.setHours(6); }
    return d;
  }
  export function addShifts(d: Date, n: number): Date {
    return new Date(d.getTime() + n * 8 * 3600 * 1000);
  }
  export function shiftSpan(startISO: string, endISO: string): number[] {
    // returns unique shift indices touched, e.g. [0,1] = M+T
  }
  ```
- Backfill spread: por máquina mantener `cursor = max(tails[m], nextShiftBoundary())`. Para cada ODF: `duration = ({low:1, normal:2, urgent:3}[priority]) * 8h`, escribir `start=cursor, end=cursor+duration`, `cursor=end`.
- "Redistribuir cronograma": idéntico pero arrancando todos los `cursor` desde `nextShiftBoundary(now)`, sobrescribiendo `planned_start/end` de todos los ODFs en estados MAZAK+.
- Mini-toolbar de turnos: aparece sobre la barra con `position: absolute; top: -22px`, solo en `viewMode === "14d"`. Click llama a `setPending` igual que `onCellDrop`.

## Fuera de scope (por ahora)

- Capacidad por turno (cuántos operarios por turno). Lo agregamos cuando definamos el modelo de operarios.
- Turnos diferentes por máquina (todas usan M/T/N idénticos).

¿Avanzo con los 4 puntos? Si querés sacar alguno (ej. el indicador de carga), avisame.
