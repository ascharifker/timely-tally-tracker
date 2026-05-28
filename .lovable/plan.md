# Scheduling alineado a la realidad de producción

Hoy el cronograma es ficticio: cada ODF dura "1–4 turnos" según prioridad y todo arranca al próximo borde de turno sin considerar la capacidad real. Vamos a reemplazarlo por un motor basado en horas reales.

## Modelo de datos

### 1. `machines` — nueva columna
- `hours_per_shift NUMERIC NOT NULL DEFAULT 8` — horas productivas por turno para esa máquina (ej. MAZAK1 = 7, externa = 6). Un valor único cubre M/T/N (según tu elección).

### 2. `part_times` — extender catálogo existente
- Ya tiene `pir + machine_id + hours_per_piece`. Perfecto: cada combinación PIR×máquina define cuánto tarda una pieza ahí.
- Agregar `UNIQUE (pir, machine_id)` para evitar duplicados.

### 3. `jobs` — overrides opcionales
- `hours_override NUMERIC NULL` — si el usuario quiere fijar duración total manual, ignora el cálculo automático.

## Lógica de duración (nuevo helper `src/lib/scheduling/duration.ts`)

```text
duracionHoras(job, machine, partTimes) =
  job.hours_override                          // si está seteado
  ?? (lookup(part_times, job.pir, job.machine_id)?.hours_per_piece * job.qty)
  ?? fallback heurístico actual (priority+qty)  // para ODFs sin PIR cargado
```

## Motor de scheduling (reemplaza `addShifts(start, durationShifts)`)

Nuevo `scheduleJob(startMs, hoursNeeded, machine)`:
1. Snap `startMs` al próximo borde de turno (06/14/22) — ya existe `nextShiftBoundary`.
2. Mientras queden horas, consumir `machine.hours_per_shift` por turno:
   - Si la ODF necesita 10h y la máquina rinde 7h/turno → ocupa turno 1 completo + 3h del turno 2.
   - El bloque visual arranca en el borde y termina en `start + (turnosEnteros·8h) + horasRestantesProporcional`.
3. Devuelve `{ planned_start, planned_end }` con horas reales (no múltiplos de 8).

Esto reemplaza la lógica en:
- `useUpdateJobStatus` (cuando pasa a MAZAK)
- `computeSpreadSchedule` (backfill)
- `useRedistributeSchedules` (botón Redistribuir)
- `cascade` en `src/lib/scheduling/cascade.ts` — al recalcular downstream, usar el nuevo motor en vez de delta horario fijo.

## Gantt

- Las barras ya se posicionan por `planned_start`/`planned_end` reales, así que se alinean naturalmente con las sub-bandas M/T/N del rediseño anterior.
- Agregar tooltip: `"10h · 7h/turno · MAZAK1 → M completo + 3h T"` para que el operario entienda el cálculo.
- Badge cuando se usa `hours_override` o cuando falta cargar `part_times` (fallback heurístico) — visibilidad de "datos faltantes".

## Pantalla de configuración (nueva ruta `/configuracion`)

Dos secciones, link desde el AppShell:

**1. Máquinas** — tabla editable inline:
- Columnas: Nombre · Tipo · h/turno · Capacidad diaria (3×h/turno, calculado)
- Edit directo en celda h/turno → mutación a `machines.hours_per_shift`.

**2. Catálogo PIR×Máquina** — tabla con buscador:
- Columnas: PIR · Máquina · h/pieza · Última edición
- Botón "+ Agregar entrada" → dialog (PIR autocomplete desde jobs existentes, Máquina select, h/pieza number)
- Edit inline de h/pieza, delete con confirm.
- Indicador "N PIRs sin tiempo cargado" arriba, listando los PIRs usados en jobs activos sin entrada en catálogo.

## Archivos a tocar

- **Migración**: `ALTER machines ADD hours_per_shift`, `ALTER jobs ADD hours_override`, `UNIQUE` en `part_times`.
- **Nuevo**: `src/lib/scheduling/duration.ts`, `src/lib/scheduling/schedule.ts`, `src/routes/configuracion.tsx`, `src/components/fact/MachinesConfig.tsx`, `src/components/fact/PartTimesConfig.tsx`.
- **Editar**: `src/hooks/useFactData.ts` (scheduling hooks usan nuevo motor + queries para machines/part_times mutations), `src/lib/scheduling/cascade.ts`, `src/components/fact/MachineGantt.tsx` (tooltip + badge fallback), `src/components/fact/AppShell.tsx` (link "Configuración"), `src/lib/fact-types.ts` (campos nuevos).

## Backfill / compatibilidad

- ODFs existentes mantienen sus `planned_start/end` actuales; el nuevo motor solo se aplica al crear/mover/redistribuir.
- Botón "Redistribuir" del Gantt va a recalcular todo con horas reales — ideal para alinear el estado actual una vez que cargues el catálogo.
- Si una ODF no tiene PIR o no hay entrada en `part_times` para esa máquina, se usa el heurístico actual y se muestra badge "estimado".

## Qué NO incluye este plan

- Multi-turno con h/turno distinto por M/T/N (elegiste un valor único por máquina).
- Override por ODF desde detalle (lo dejo preparado en schema con `hours_override` pero sin UI; lo agrego si lo querés).
- Calendario de paros / mantenimiento por máquina (siguiente iteración).