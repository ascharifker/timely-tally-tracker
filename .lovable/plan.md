
# Rediseño del Gantt — Precision industrial grid

El Gantt actual amontona barras superpuestas, los turnos M/T/N se ven débiles y la jerarquía visual se pierde. Lo reemplazamos por una grilla industrial precisa donde **el turno es la unidad primaria** y los ODFs nunca se superponen.

## Principios

1. **Cada turno (M/T/N) es una columna real** con sombreado vertical propio que se ve desde el header hasta el fondo de cada fila.
2. **Cero superposición**: si dos ODFs comparten tiempo en una máquina, se apilan en sub-lanes dentro de la fila (la fila crece en alto). No más cards montadas una sobre otra.
3. **Día seleccionado/hoy** se resalta con una banda azul vertical continua a todo lo alto.
4. **Modo turno-foco**: al elegir un solo turno en el filtro (M, T o N), las columnas de los otros dos turnos colapsan visualmente (8px) y solo se ven las barras del turno activo a tamaño grande.

## Cambios visuales (MachineGantt.tsx)

### Grid
- Reemplazar las "sub-bandas" actuales por columnas reales M/T/N con `background-color` tintado por turno (amber/sky/indigo a ~5% opacidad, ~10% en el día actual).
- Líneas verticales más fuertes en el borde de día (border-zinc-700) y suaves entre turnos (border-zinc-800/40).
- Header de 2 filas: día (MAR 26) + sub-header de turno (M/T/N) con color de turno.
- Banda azul vertical continua sobre el día "hoy" (no solo en el header).

### Barras de ODF — sin overlaps
- Algoritmo de lane-packing por máquina: ordenar jobs por `planned_start`, asignar cada uno al primer lane libre (cuyo último `planned_end` ≤ nuevo `planned_start`).
- `ROW_HEIGHT` se vuelve dinámico: `baseHeight + lanes * (barHeight + gap)`. Una máquina con 1 lane mantiene altura compacta; máquinas con conflictos crecen y muestran todos los ODFs sin tapar.
- Card de ODF rediseñada según el prototipo: fondo `bg-slate-800`, borde lateral izquierdo de 4px en color del turno principal, header con badge EST + nombre ODF, footer con material. Hover sube el borde a amber.

### Modo turno-foco
- Cuando `shiftFilter.size === 1`:
  - Las columnas de los otros dos turnos se renderizan con `width: 8px` y opacidad 0.3 (siguen visibles como "separadores" pero ceden el espacio).
  - El turno activo ocupa el ancho restante del día → barras 3× más grandes y legibles.
  - Barras cuyo span no toca el turno activo se ocultan (ya existe la lógica, ajustar para que no consuman lane).

### Header / toolbar
- Mantener funcionalidad actual (Redistribuir, 14d/Mes/Trimestre, Hoy, Carga M/T/N, Filtro Turnos) pero con la jerarquía del prototipo: título grande, chip de rango, pills de turno con color saturado.
- Quitar el indicador de "soloShift" textual redundante: el colapso visual lo comunica.

### Fila "sin programar"
- Mover a un drawer plegable al pie de la grilla en lugar de fila inline (ocupa espacio y no aporta info temporal).

## Archivos a tocar

- **Editar**: `src/components/fact/MachineGantt.tsx` — toda la sección de grid + render de barras + lane packing. Header se conserva con ajustes menores.
- **Nuevo helper**: `src/lib/scheduling/lanes.ts` — función pura `packLanes(jobs: Job[]): Map<jobId, laneIndex>` + `lanesPerMachine(jobs): Map<machineId, number>`.
- **Sin cambios** en lógica de scheduling, drag&drop, pending moves, ApproveMovesDialog, hooks de data, ni en `shifts.ts`.

## Qué NO incluye

- Cambios al motor de scheduling por horas (ya implementado).
- Cambios al modelo de datos.
- Sub-vista por turno individual como ruta separada (el modo turno-foco lo cubre con un click).
- Footer de stats / "próximo cambio" del prototipo (no hay datos reales para eso aún; lo dejo para otra iteración si lo querés).
