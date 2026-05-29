# Detalle por Máquina + Captura de Producción Real

Convertir cada MAZAK / Taller Externo en una entidad navegable con ficha propia, y cerrar el gap entre "planificado" y "real" capturando inicio/fin/piezas por corrida. La métrica de desvío real-vs-catálogo es el output central — todo lo demás (cuello de botella, reasignación, in-house vs externo) depende de tener datos medidos, no estimaciones.

---

## Decisiones tomadas

1. **Sí se registra real hoy (papel/planilla)** → `machine_runs` entra en Fase 1, no Fase 2. La métrica de desvío se calcula sobre datos medidos.
2. **Taxonomía de eventos cerrada ahora** → extender enum `event_kind` con `maintenance_preventive` y `maintenance_corrective`. Tabla `maintenance_events` dedicada queda para más adelante; mientras tanto los eventos quedan correctamente clasificados desde el día uno (no hay que migrar nada después).
3. **Talleres externos son vendors, no máquinas** → nueva tabla `vendors` + `machines.vendor_id` opcional. La ficha tiene dos layouts según sea máquina interna o externa.
4. **`hourly_cost` es first-class** → se trata como núcleo del entregable. Cada máquina interna tiene `hourly_cost`; cada vendor externo tiene `hourly_rate` + `lead_time_days_avg`. Habilita costeo de ODF y comparación in-house vs externo desde el día uno.

---

## Cambios de DB (una sola migración)

### 1. Extender `machines` (máquinas internas)
Campos nuevos, todos nullable salvo donde indicado:
- `model`, `serial_number`, `year`, `purchase_date`, `location`, `image_url`, `notes`
- `hourly_cost` (numeric) — **no nullable, default 0** — costo operativo/hora
- `vendor_id` (uuid, nullable) — apunta a `vendors` cuando la máquina representa un taller externo

### 2. Nueva tabla `vendors` (talleres externos)
- `name` (razón social), `tax_id` (CUIT), `contact_name`, `contact_email`, `contact_phone`
- `hourly_rate` (numeric, no nullable, default 0) — tarifa acordada
- `lead_time_days_avg` (numeric, nullable) — lead time histórico declarado
- `notes`, `active` (bool, default true)
- Cuando se crea un vendor, se crea automáticamente un registro en `machines` con `type='external_shop'` y `vendor_id` apuntando a él (un vendor = una "máquina virtual" en el Gantt/Kanban).

### 3. Nueva tabla `machine_runs` (corridas reales) — **núcleo de la captura**
- `job_id` (no nullable), `machine_id` (no nullable)
- `started_at` (timestamptz, no nullable)
- `ended_at` (timestamptz, nullable) — null = corrida en curso
- `pieces_completed` (int, default 0)
- `operator_name` (text, nullable)
- `notes` (text, nullable)
- Índices por `machine_id`, `job_id`, `started_at desc`
- Trigger `updated_at`

Una ODF puede tener varias corridas (pausa, cambio de turno, reanudación). `hours_real = sum(ended_at - started_at)` cuando todas las corridas están cerradas.

### 4. Extender enum `event_kind`
Agregar valores: `maintenance_preventive`, `maintenance_corrective`.
Esto deja preparado el camino para `maintenance_events` dedicada en el futuro sin migrar historia.

### Grants y RLS
Mismo patrón que tablas existentes (`anon` read+write, `authenticated` full, `service_role` all) para mantener consistencia con el resto del proyecto.

---

## UX — Navegación

### Entry points clicables
- **Kanban** (`StatusBoard.tsx`): chips de máquina (M1, M3, GMAC) y sub-headers de grupo → Link a `/maquina/$id`. `stopPropagation` para no romper drag.
- **Gantt** (`MachineGantt.tsx`): label de fila → Link.
- **Configuración**: botón "Ver ficha" en cada fila.

### Nueva ruta `/maquina/$id` (interna) vs `/vendor/$id` (externo)
La ruta única `/maquina/$id` resuelve y renderiza un layout u otro según `machine.vendor_id`:

**Layout interna (MAZAK)** — pestañas:
1. **Resumen** — KPIs: ODFs activas, horas plan próximas 7d, **% utilización última semana (real, no plan)**, ODFs completadas mes, **h/pieza promedio real vs catálogo (desvío %)**, próxima ventana libre, **costo acumulado del mes** (`hourly_cost × horas reales`).
2. **Specs** — form editable: modelo, serie, año, ubicación, vendor (fabricante), manual_url, foto, `hourly_cost`.
3. **Producción** — tabla de ODFs + corridas históricas, filtros por status/fecha.
4. **Tiempos** — tabla por PIR: catálogo vs **real medido** (n corridas, h/pieza promedio, desvío %, σ). Cuando no hay corridas todavía, muestra "Sin datos medidos · n estimaciones" con badge claro. **No mezcla "real medido" con "override planificado"** — son columnas distintas.
5. **Eventos** — `status_events` filtrados, separados visualmente en "Producción" (delay/breakdown/etc) y "Mantenimiento" (preventive/corrective).

**Layout vendor (Taller Externo)** — pestañas:
1. **Resumen** — KPIs: ODFs activas, lead time promedio real (de `machine_runs`), lead time declarado, ODFs completadas mes, **costo acumulado del mes** (`vendor.hourly_rate × horas reales`), comparador rápido vs costo equivalente in-house.
2. **Vendor** — form: razón social, CUIT, contactos, `hourly_rate`, `lead_time_days_avg`, notas.
3. **Producción** — mismas columnas que interna.
4. **Eventos** — solo eventos de producción (no aplica mantenimiento).

### Captura de corridas reales — UI nueva
- **En la card del Kanban (cuando status = MAZAK o TALLER_EXTERNO)**: botón "▶ Iniciar" si no hay corrida abierta, "■ Cerrar" si hay una. Cerrar pide `pieces_completed`.
- **En el detalle de ODF** (`JobDetailDialog.tsx`): nueva sección "Corridas" con tabla de runs históricas + botón "Registrar corrida retroactiva" (start, end, pieces, operator) para cargar lo que está en papel.
- **En la ficha de máquina, tab Producción**: misma tabla de runs editable.

Esto es lo que cierra el círculo: hoy registran en papel, esta UI les da donde tipearlo, y a partir de ese momento `h/pieza real` deja de ser un proxy del override y pasa a ser dato medido.

---

## Archivos

### Nuevos
- `src/routes/maquina.$id.tsx` — ficha con pestañas, dispatch interna/vendor.
- `src/components/fact/MachineSpecsForm.tsx` — form de specs internas.
- `src/components/fact/VendorForm.tsx` — form de vendor externo.
- `src/components/fact/MachineRunsTable.tsx` — tabla + registro de corridas (reutilizable en ficha y en JobDetailDialog).
- `src/components/fact/StartStopRunButton.tsx` — botón Iniciar/Cerrar corrida, usado en Kanban card.
- `src/lib/machine-metrics.ts` — funciones puras: `utilization()`, `realHoursPerPiece()`, `catalogDeviation()`, `monthlyCost()`, `vendorComparison()`. Toma `MachineRun[]` + `Job[]` + `PartTime[]` + `Machine`/`Vendor`.
- `src/hooks/useMachineRuns.ts` — queries + mutations (`useStartRun`, `useStopRun`, `useCreateRunRetroactive`).
- `src/hooks/useVendors.ts` — CRUD vendors.

### Editados
- `src/lib/fact-types.ts` — agregar campos a `Machine`, nuevos types `Vendor`, `MachineRun`, ampliar `EventKind`.
- `src/components/fact/StatusBoard.tsx` — chips/headers clicables + botón Start/Stop en cards MAZAK/TALLER_EXTERNO.
- `src/components/fact/MachineGantt.tsx` — labels linkeables.
- `src/components/fact/MachinesConfig.tsx` — botón "Ver ficha" + sección nueva "Vendors externos" (CRUD básico).
- `src/components/fact/JobDetailDialog.tsx` — sección "Corridas".
- `src/hooks/useFactData.ts` — agregar `useMachine(id)` (single) si simplifica, sino reusar.

### No se toca
- Lógica de scheduling/cascade/lanes.
- Drag&drop del Kanban (clicks usan stopPropagation).
- Tabla `briefings`, lógica de OTD, IA.

---

## Métricas que quedan habilitadas (sin código adicional)

Con `machine_runs` cargado, `machine-metrics.ts` ya entrega:
- **Desvío real vs catálogo** por PIR×máquina — con n, promedio, σ.
- **Utilización real** (horas con corrida abierta / horas disponibles).
- **Throughput** (ODFs completadas / semana).
- **Lead time real** por vendor (avg(ended_at − started_at) sobre ODFs externas).
- **Costo por ODF** (sum de horas por corrida × hourly_cost/rate).
- **Comparador in-house vs externo**: para cada PIR, costo promedio real interno vs externo.

Esto desbloquea las decisiones que Fase 3 prometía — sin esperar Fase 3.

---

## Riesgos y notas

- **Adopción de la captura**: si los operarios no usan los botones Start/Stop, machine_runs queda vacía y volvemos al problema original. El flujo retroactivo (cargar lo del papel a fin de turno) es el mínimo no-negociable para que la métrica funcione desde semana uno.
- **Backfill histórico**: las ODFs ya completadas no tienen runs. La UI muestra honestamente "n=0 medidas, n=X estimaciones" hasta que se acumule histórico medido. No inventa números.
- **Corridas abiertas eternas**: si nadie cierra un run, contamina utilización. Agrego en el Resumen un warning "X corridas abiertas hace > 48h" como sanity check visual (no auto-cierre — eso lo decide el usuario).
- **Vendors sin Machine espejo**: para que el Kanban/Gantt sigan funcionando sin cambios, cada vendor genera automáticamente una fila en `machines` (type=external_shop, vendor_id=...). Si después querés que un vendor tenga varias "líneas" virtuales, eso es Fase 2.
