
# Hacer turnos claros e intuitivos

Hoy los turnos son apenas tres bandas de color tenues dentro de cada día. Cuesta ver dónde empieza cada turno, no se puede aislar uno, y al arrastrar una ODF no queda claro a qué turno cae.

## 1. Filtro de turno (arriba del Gantt)

Agregar un selector en el header del `MachineGantt`, junto a "14 días / Mes / Trimestre":

```text
Turnos:  [Todos] [M Mañana] [T Tarde] [N Noche]
         06–14    14–22       22–06
```

- Multi-toggle (se pueden activar 1, 2 o 3).
- Al elegir un solo turno, el Gantt entra en **modo turno**: cada día muestra solo esa franja horaria, las barras de ODF se recortan a ese turno, y las celdas de otros turnos desaparecen. Esto responde directo a "ver un turno específico".
- En vistas Mes / Trimestre el filtro sigue actuando sobre qué ODFs se muestran (las que caen en ese turno), aunque no haya sub-columnas.

## 2. Turnos visualmente obvios en la vista 14 días

- Separadores verticales más fuertes entre M / T / N (línea sólida, no `border/20`).
- Encabezado de día rediseñado: en lugar de tres letras chiquitas debajo del número, una fila dedicada con tres "chips" `M 06` · `T 14` · `N 22` usando el color del turno, sticky cuando se hace scroll horizontal.
- Etiqueta de hora visible al hacer hover sobre cualquier celda de turno (tooltip ya existe, hacerlo más prominente).
- Leyenda actual de la columna "Máquina" se reemplaza por la barra de filtro del punto 1, así no se duplica.

## 3. Asignación explícita de turno al arrastrar

Hoy el drop infiere el turno por la sub-celda. Mejoras:

- **Indicador de turno durante el drag**: mientras se arrastra, la celda destino muestra un overlay grande con la letra del turno (`M`, `T`, `N`) y el rango horario, no solo un ring de color.
- **Snap visible**: cuando el cursor entra en una sub-celda, resaltar el día entero con borde tenue y el turno destino con el color sólido del turno + label "Mañana 06:00–14:00".
- En el `ApproveMovesDialog`, mostrar el turno destino en texto (`Lun 28 · Tarde 14:00`) además de la hora ISO actual.

## 4. Turno en el card de ODF

- Cada barra del Gantt muestra una mini-insignia con la inicial del turno en la esquina (M/T/N con el color del turno), así de un vistazo se sabe en qué turno corre sin contar celdas.
- En el `JobDetailDialog` agregar fila "Turno: Mañana (06–14)" derivada de `planned_start`.

## 5. Asignación de turno desde el Kanban

En `StatusBoard`, al hacer click en una ODF sin programar (o con menú contextual), permitir asignar turno + día rápidamente vía un pequeño popover con tres botones M/T/N — útil cuando no se quiere arrastrar al Gantt.

(Opcional, lo marco como "fase 2" si el alcance se siente grande.)

## Archivos a tocar

- `src/components/fact/MachineGantt.tsx` — filtro de turnos, header rediseñado, overlay de drag, recorte de barras en modo turno único, insignia M/T/N en cards.
- `src/components/fact/ApproveMovesDialog.tsx` — etiqueta de turno destino.
- `src/components/fact/JobDetailDialog.tsx` — fila de turno.
- `src/lib/fact-types.ts` (o un nuevo `src/lib/shifts.ts`) — helper `getShiftForDate(date)` reutilizable.
- `src/components/fact/StatusBoard.tsx` — (fase 2) popover de asignación rápida.

## Detalles técnicos

- Helper único `SHIFTS` y `getShiftIndex(date)` movido a `src/lib/shifts.ts` para evitar duplicación.
- Estado de filtro: `const [shiftFilter, setShiftFilter] = useState<Set<0|1|2>>(new Set([0,1,2]))`.
- En modo turno único (filter.size === 1), `range` se recalcula a `dayCount * 8h` y las barras se clipan: si `planned_start` cae fuera del turno, no se renderizan (o se renderizan al borde con opacidad reducida).
- El overlay de drag se monta en la sub-celda hovered con `position: absolute; inset: 0` y un `<div>` con el nombre completo del turno + horario.

¿Te parece bien arrancar con puntos 1–4 y dejar el 5 (popover en kanban) para una segunda vuelta?
