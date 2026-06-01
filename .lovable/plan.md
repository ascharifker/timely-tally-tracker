
# Paso 1 — Modelo de Purchase Order y Line Items

Cimiento del "Order Lifecycle Hub". Hoy un `job` mezcla tres cosas distintas: el pedido del cliente (PO), la línea del pedido (qué item/PIR y cuántas piezas), y la orden de fabricación interna (ODF). Las separamos sin romper lo que ya funciona.

## Modelo conceptual

```text
customers (1) ──< purchase_orders (1) ──< po_line_items (1) ──< jobs (N)
                                                              (jobs = ODFs internas)
```

- **customer**: Musa, Halliburton, futuros. Hoy implícito en qué columna está llena.
- **purchase_order**: el PO real del cliente. Un número, una fecha de emisión, fechas comprometidas a nivel PO, un cliente.
- **po_line_item**: cada línea del PO — un PIR + cantidad + fecha comprometida de esa línea (puede diferir del PO).
- **job**: la orden de fabricación interna (ODF). Una línea puede generar 1+ ODFs (split de lotes, reprocesos). Hoy la relación es 1:1 implícita.

## Tablas nuevas

### `customers`
- `name` (único), `code` (corto: MUSA, HAL), `active`, `notes`
- Seed inicial: Musa Argentina, Halliburton (desde los datos actuales)

### `purchase_orders`
- `customer_id` → customers
- `po_number` (texto, el número del PO del cliente)
- `issued_date`, `committed_date` (fecha comprometida a nivel PO, opcional — la real vive en line_items)
- `status`: `received` | `in_production` | `partial_shipped` | `completed` | `cancelled` (derivado de los jobs, pero cacheable)
- `source_document_url` (storage, para el PDF original — preparamos el campo aunque la captura AI sea otro paso)
- `notes`
- Único: `(customer_id, po_number)`

### `po_line_items`
- `purchase_order_id` → purchase_orders (cascade delete)
- `line_number` (orden dentro del PO)
- `pir` (texto, igual que hoy en jobs)
- `tube_spec` (sube desde job — pertenece a la línea, no a la ODF)
- `qty_ordered` (lo que pidió el cliente)
- `committed_date` (fecha comprometida de esta línea — la que mueve OTD)
- `unit_price`, `currency` (opcional, lo dejamos preparado)
- `notes`

## Cambios en tablas existentes

### `jobs`
- **Agregar**: `po_line_item_id` (nullable inicialmente, para permitir migración gradual)
- **Mantener temporalmente**: `po_musa`, `po_halliburton`, `pir`, `tube_spec`, `customer_date` (deprecados pero no borrados — los lee la UI hasta que migremos consumidores)
- **Semántica nueva**: `qty` en un job sigue siendo "piezas de esta ODF" (puede ser menor que `qty_ordered` si la línea se parte en varias ODFs)
- No tocamos status, planned_start/end, machine_id, etc.

## Migración de datos

Script idempotente dentro de la misma migración SQL:

1. Crear customer "Musa" y "Halliburton".
2. Por cada `jobs.po_musa` distinto no nulo → crear `purchase_order` (customer=Musa, po_number=valor).
3. Idem `po_halliburton` → customer=Halliburton.
4. Por cada job con PO → crear un `po_line_item` con `line_number=1`, `pir`, `tube_spec`, `qty_ordered=qty`, `committed_date=customer_date`.
5. Setear `jobs.po_line_item_id` apuntando al line_item recién creado.
6. Jobs sin PO (si los hay) quedan con `po_line_item_id = null` — son ODFs huérfanas legítimas (trabajo interno, prototipos).

Edge case: si dos jobs comparten el mismo `po_musa` (es decir, el PO tenía 2 líneas), hoy no podemos distinguir si son la misma línea partida o líneas distintas. Decisión: **una línea por job en la migración** (line_number incremental por PO). El usuario podrá fusionar líneas después desde la UI si fuese necesario.

## RLS y permisos

Las tres tablas nuevas siguen el patrón actual del proyecto (lectura pública, escritura anon+authenticated). No se introduce auth en este paso — eso es Paso 5 del roadmap.

## Cambios de código (mínimos en este paso)

Este paso es **schema + migración de datos + tipos**. La UI sigue funcionando contra los campos viejos de `jobs`. Cambios estrictos:

- `src/lib/fact-types.ts`: agregar interfaces `Customer`, `PurchaseOrder`, `POLineItem`. Marcar campos deprecados en `Job` con comentario.
- `src/hooks/useFactData.ts`: nada todavía (sigue leyendo jobs como hoy).
- Sin tocar componentes en este paso.

Los siguientes pasos del roadmap (PO intake con AI, vista Customer agrupada por PO, forecast dates) ya tendrán dónde colgarse.

## Detalles técnicos

- Todas las FKs con `ON DELETE` explícito: `purchase_orders.customer_id` → RESTRICT (no borrar cliente con POs); `po_line_items.purchase_order_id` → CASCADE; `jobs.po_line_item_id` → SET NULL (no perder la ODF si se borra la línea — preserva historial real de fábrica).
- Trigger `touch_updated_at` (ya existe en el proyecto) en las 3 tablas nuevas.
- Índices: `po_line_items(purchase_order_id)`, `jobs(po_line_item_id)`, `purchase_orders(customer_id, issued_date DESC)`.
- GRANTs explícitos para `anon`, `authenticated`, `service_role` siguiendo el patrón del resto de las tablas del proyecto.

## Qué NO hace este paso

- No cambia la UI (Kanban, Gantt, Job dialog siguen como están).
- No agrega captura de PO por PDF.
- No agrega vista Customer.
- No borra `po_musa`/`po_halliburton`/`customer_date` de jobs (queda como deprecación pendiente para cuando todos los consumidores migren).
- No agrega auth.

## Criterio de éxito

1. Migración corre sin errores y sin pérdida de datos: `count(jobs)` antes = `count(jobs)` después, y `count(po_line_items)` = `count(jobs with po)`.
2. La app sigue funcionando exactamente igual (kanban, gantt, dialogs no se rompen).
3. `select * from purchase_orders join po_line_items join jobs` devuelve la jerarquía esperada para inspección manual.

Cuando esto esté verde, el siguiente paso (PO intake con AI sobre Gemini) tiene un destino claro donde escribir.
