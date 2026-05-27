## Hacer visibles las ODFs sin fecha + navegación temporal por mes

### Problema
1. ODF PRUEBA (y cualquier ODF con `planned_start`/`planned_end` en NULL) desaparece del Gantt — el filtro `j.planned_start && j.planned_end` la excluye.
2. La ventana fija de 14 días desde "hoy − 2" oculta ODFs futuras (121/26 apenas se ve, cualquier cosa de fin de junio invisible).

### Cambios

**1. Fila "Sin programar" en el Gantt (`MachineGantt.tsx`)**
- Nueva fila al final del cronograma, ancho completo (sin grilla de días).
- Renderiza chips con cada ODF que tenga `planned_start` o `planned_end` en NULL.
- Click en chip → dispara `onJobClick(job)` (igual que las barras), abriendo `JobDetailDialog` para que el usuario asigne fechas y/o máquina.
- Color del chip = color del status; misma tipografía monoespaciada que las barras.
- Si no hay ninguna sin programar, la fila se oculta.

**2. Auto-asignar fechas al pasar a MAZAK (`useFactData.ts` → `useUpdateJobStatus`)**
- Cuando la mutación entra y el destino es `MAZAK` y el job no tiene `planned_start`/`planned_end`:
  - `planned_start = now()` redondeado al inicio del próximo turno
  - `planned_end = planned_start + 2 días` (duración default; misma heurística que usa `cascade.ts` hoy)
  - Si tampoco tiene `machine_id`, NO auto-asignamos máquina — abrimos el diálogo después del drop para que el usuario elija (toast "Asigná máquina para ver en el cronograma").
- Patch optimista incluye las nuevas fechas → la barra aparece de inmediato en el Gantt.
- Toast: "ODF X → MAZAK · programado 28/05 → 30/05".

**3. Navegación temporal: vista por mes (`MachineGantt.tsx`)**
- Reemplazar la constante `DAYS = 14` por estado `viewMode: "14d" | "month" | "quarter"` y `anchorDate` (fecha base).
- Toggle en el header del Gantt: `[14 días] [Mes] [Trimestre]` + flechas `← →` + botón `Hoy`.
  - 14 días: comportamiento actual (hoy − 2 a hoy + 11)
  - Mes: muestra el mes completo del `anchorDate` (1º al último día), grilla de días
  - Trimestre: 90 días desde `anchorDate`, grilla por semana (cabecera "S22 · 25 may") para que no se aplaste
- Flechas avanzan/retroceden 1 unidad de la vista actual (14d, 1 mes, 1 trimestre).
- "Hoy" resetea `anchorDate` al día actual.
- El highlight de "hoy" sigue funcionando cuando cae dentro de la ventana visible.

### Archivos tocados
- `src/components/fact/MachineGantt.tsx` — vista por mes/trimestre, controles de navegación, fila "Sin programar".
- `src/hooks/useFactData.ts` — auto-asignar `planned_start`/`planned_end` en `useUpdateJobStatus` cuando faltan y el destino es MAZAK.

### Fuera de alcance
- Drag para reprogramar arrastrando la barra en el Gantt (próxima iteración).
- Vista anual / heatmap de carga.
- Cambios de schema en `jobs` (no hace falta — las columnas ya existen y son nullables).
