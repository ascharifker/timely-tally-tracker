## Mejoras al StatusBoard (kanban)

Todo se concentra en `src/components/fact/StatusBoard.tsx` más un par de helpers. No cambia el esquema BD ni la lógica de mutaciones.

### 1. Chip de máquina en la card

Dentro de MAZAK y TALLER_EXTERNO, cada card muestra un chip compacto (`M1`…`M5`, `GMAC`) con el color de la máquina como fondo, junto al `ODF`.

- Necesita `machines` en `StatusBoard` (hoy solo recibe `jobs`). Pasarlo desde `src/routes/index.tsx` y `src/routes/riesgo.tsx` (ambos lugares que lo renderizan).
- Etiqueta corta: para "MAZAK N" → `MN`, para externos → primeras 4 letras del nombre (`GMAC`).
- Color: nuevo campo opcional `color` no existe en `machines`; uso `STATUS_COLOR[job.status]` con leve variación por `display_order` (tinte HSL) para distinguirlas. Alternativa simple: paleta fija de 6 colores indexada por `display_order`.

### 2. Agrupación por máquina dentro de columna

Dentro de las columnas MAZAK y TALLER_EXTERNO, las cards se agrupan por `machine_id` con un mini-header `── MAZAK 3 (4) ──` colapsable (estado local en el componente, `useState<Record<string, boolean>>`).

- Sin máquina asignada → grupo `Sin asignar` arriba con estilo de warning.
- Otras columnas (PLANNED, CEMENTACION, etc.) sin cambios.
- Orden de grupos: por `display_order` de la máquina.

### 3. Filtro rápido por máquina

Barra de chips arriba del board (encima del grid actual), uno por máquina (`M1 M2 M3 M4 M5 GMAC`) más `Todas`. Multi-toggle.

- Estado local `selectedMachines: Set<string>` (vacío = todas).
- Las cards de máquinas no seleccionadas se renderizan con `opacity-30` (no se ocultan, para no mover layout). Los contadores de columna siguen mostrando el total real, pero suman `(X visibles)` al lado cuando hay filtro activo.

### 4. Badge de urgencia/atraso visible

En la card, debajo del ODF:

- Si `priority === "urgent"` → badge `URG` (ya está).
- Si `customer_date` existe y faltan ≤ 3 días → badge `Vence Xd` rojo.
- Si `customer_date < hoy` y status ≠ `YA_SE_ENVIO` → badge `ATRASO Xd` rojo intenso.
- Helper nuevo `src/lib/job-urgency.ts` con `getUrgency(job): { kind, label, days } | null` — testeable y reusable en `OTDTracker` / `riesgo.tsx`.

### 5. Contador de horas restantes por columna

En el header de cada columna, junto al contador de ODFs:

- Suma de horas estimadas pendientes de las cards en esa columna.
- Reusa el cálculo de duración existente (`src/lib/scheduling/duration.ts`, que conoce `hours_override` y `part_times`).
- Formato: `4 ODF · 32h`.
- Solo aplica a MAZAK y TALLER_EXTERNO (las otras etapas no tienen horas-máquina); en el resto sigue solo `N ODF`.

### 6. Indicador visual: MAZAK sin máquina

Card en columna MAZAK con `machine_id === null` → borde izquierdo rojo punteado + ícono ⚠ + tooltip "Asigná una máquina o devolvé a Planificado". Click no abre el detalle común sino que sugiere la acción (o simplemente abre el detalle con foco en el selector de máquina — más simple). Va dentro del grupo "Sin asignar" del punto 2.

### Archivos

- **Edit** `src/components/fact/StatusBoard.tsx` — toda la UI.
- **Edit** `src/routes/index.tsx` y `src/routes/riesgo.tsx` — pasar `machines` al `StatusBoard`.
- **New** `src/lib/job-urgency.ts` — helper `getUrgency(job)`.
- **Edit** `src/lib/fact-types.ts` (opcional) — exportar paleta de colores de máquina si no usamos derivada.

### Fuera de alcance

- Cambios al Gantt o a las mutaciones (kanban ↔ Gantt ya están sincronizados).
- Persistir filtro/colapso entre sesiones (es UI efímera).
- Nueva columna física por máquina (descartado en la discusión previa).
