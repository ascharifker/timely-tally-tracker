
# Rediseño del Cronograma por Máquina

Reemplazo visual del `MachineGantt` siguiendo la dirección elegida: cada día se sub-divide en 3 sub-columnas M/T/N siempre visibles con color de fondo fuerte, header reorganizado en 2 filas con zonas claras, columna sticky de máquinas con jerarquía, y barras de ODF con borde-izquierdo de color de turno + chip de turno.

## Cambios visuales

**Header (2 filas)**
- Fila 1: título + pill de rango de fechas · derecha: botón "Redistribuir" amarillo sólido, segmented control 14d/Mes/Trimestre, navegación ‹ Hoy ›
- Fila 2 (separada por divider): izquierda "Carga: M:Xh T:Xh N:Xh" en mono · derecha "Filtro Turnos:" con 3 pills redondeadas grandes (M amarillo, T celeste, N violeta). Click para solo / volver a ver todos.

**Grid**
- Columna sticky izquierda 160px con fondo más oscuro y sombra a la derecha. Cada máquina: nombre en blanco bold + ID en mono gris. Filas alternadas zebra suave. Taller externo con estilo italic acento amarillo.
- Headers de día: 2 sub-filas. Arriba `mar 26` (uppercase mono). Abajo 3 sub-columnas iguales con tints `M #eab308/15`, `T #38bdf8/8`, `N #8b5cf6/8` y letra grande de turno. Hoy: ring amarillo + tint extra.
- Filas de máquina: 96px alto. Overlay de sub-bandas M/T/N que se prolonga verticalmente desde los headers (mismas tints atenuadas a /5) — esto crea las "columnas de turno" que dominan visualmente. Borde divisor entre días más visible que entre sub-turnos.

**Barras de ODF**
- Fondo `bg-card` oscuro + border-left de 4px con color del turno donde arranca. Altura 48px, redondeo solo a la derecha. ODF en blanco font-black + sub-spec en gris uppercase. Chip a la derecha con el turno (`M`/`T`/`N`) tintado. Sombra al hover, cursor grab.

**Filtro de turno solo**
- Cuando un turno queda solo, las sub-bandas de los otros 2 turnos colapsan a opacidad muy baja y las barras que no tocan ese turno se atenúan a 30%. El turno foco intensifica su tint a /25.

**Footer**
- Leyenda de 3 turnos con horarios + capacidad total mono a la derecha.

## Lo que NO cambia (preservar)

- Lógica de drag-and-drop, `pending` moves, `ApproveMovesDialog`
- `useRedistributeSchedules`, `useRecentDelays`
- Cálculo de `shiftLoad`, `shiftSpan`, `effectiveJobs`
- `viewMode` (14d/Mes/Trimestre) y navegación de fechas
- Sub-toolbar de turno on-hover (`moveJobToShift`)
- Click → `onJobClick` abre `JobDetailDialog`
- Ghosts de delay
- En modo Mes/Trimestre las sub-bandas M/T/N se ocultan (no caben), solo aplica a 14d

## Archivos a tocar

- `src/components/fact/MachineGantt.tsx` — rewrite estructural del JSX manteniendo todos los hooks/handlers existentes. Sin cambios de comportamiento.
- `src/styles.css` — agregar tokens si hace falta para tints de turno (probablemente no, los colores ya están en `SHIFTS`).

## Detalle técnico

- Layout cambia de `grid` global a `flex` con columna sticky + timeline scrollable, exactamente como el prototipo (`<div class="flex overflow-x-auto">` + `<div class="sticky left-0">`).
- Cada día = `w-[180px]` en modo 14d (`w-[80px]` en Mes, `w-[120px]` en Trimestre). Sub-bandas M/T/N dentro del día con `flex-1` cada una.
- Barras de ODF se posicionan absolutas usando los mismos cálculos actuales (`(startMs - rangeStart) / range * timelineWidth`). El ancho del timeline pasa a ser `dayCount * dayWidthPx` en vez de fracción del contenedor — necesario para sub-bandas pixel-perfect.
- Drop targets: una grilla invisible de `dayCount * 3` celdas (sub-turnos) en modo 14d, `dayCount` celdas (día entero) en Mes/Trimestre. Reusa `onCellDrop(machineId, dayIdx, shiftIdx)`.
- Border color de la barra: `SHIFTS[shiftIndexFromDate(planned_start)].color`.
- Chip de turno en la barra: misma lógica + `bg-{color}/10 text-{color}`.

## Fuera de scope

- No tocar `StatusBoard`, `OTDTracker`, `BriefingPanel` ni el resto del shell.
- No cambiar el modelo de datos ni los hooks de Supabase.
- No agregar el modo "solo M ó T ó N gigante" como vista separada — el filtro existente cumple esa función con el rediseño.

¿Avanzo con la implementación?
