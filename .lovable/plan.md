# Mejorar la vista de detalle del PO

Hoy `Ver` te lleva a `/purchase-orders/:id` pero la página es muy plana: muestra cabecera + tabla de líneas y un link al PDF. Vamos a convertirla en un panel de inspección real.

## Qué vamos a agregar

**1. Cabecera con métricas vivas**
- "Cargado hace X días" (a partir de `created_at`)
- "Comprometido en X días" (a partir de `committed_date` — rojo si vencido)
- Resumen de líneas por estado: `pending_engineering · approved · flagged · scheduled · in_progress · completed` (chips con conteo)
- % de progreso (líneas completed / total)

**2. Tabs**
- **Resumen** — métricas + notas + datos del cliente
- **Líneas** — la tabla actual, pero con columna `status` por línea, badge de flag_reason si existe, y un link "Ir a ODF" si la línea ya tiene un job creado
- **ODFs vinculados** — lista de jobs creados desde este PO (odf, máquina, operador, planned_start/end, status). Click → abre `JobDetailDialog`
- **Historial de cambios de fecha** — registros de `date_change_log` para este PO y sus jobs (campo, valor anterior → nuevo, quién, cuándo, si Peter ya lo vio)
- **PDF** — visor embebido del PDF en un `<iframe>` con la signed URL (no solo un link "Ver PDF"). Botón "Abrir en nueva pestaña" + "Descargar"

**3. Acciones en la cabecera**
- "Abrir PDF" (nueva pestaña)
- "Re-procesar con AI" (opcional, lo dejamos para más adelante — no en este paso)

## Cambios técnicos

- **`src/hooks/usePurchaseOrders.ts`** — extender `usePurchaseOrder(id)` para traer también:
  - `jobs` vinculados via `po_line_item_id IN (líneas del PO)` (con machine.name, status)
  - `date_change_log` entries vinculadas via `po_line_item_id IN (líneas) OR job_id IN (jobs)`
- **`src/routes/purchase-orders.$id.tsx`** — refactor completo a layout con `Tabs`:
  - Header con métricas (componentes nuevos pequeños inline)
  - 5 tabs (Resumen / Líneas / ODFs / Historial / PDF)
  - Reusar `JobDetailDialog` para abrir ODFs
- **No tocamos**: schema de DB, server functions, otras rutas.

## Lo que NO hace este paso

- No agrega edición inline de líneas (eso vive en `/engineering`)
- No agrega "crear ODF" desde acá (vive en `/production`)
- No agrega notificaciones push a Peter (separado)

## Criterio de éxito

Entrás a `/purchase-orders/:id` y de un vistazo ves: cuántas líneas hay en cada estado, qué ODFs ya se crearon, si hubo cambios de fecha, y podés leer el PDF embebido sin salir de la página.
