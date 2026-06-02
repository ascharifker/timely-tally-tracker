# Rediseño Intake + POs estilo planilla de Peter

Engineering queda como está (confirmado). Foco: hacer que `/intake` y `/purchase-orders` se vean y se sientan como la planilla `Halliburton-COE PO's.xlsx`.

## Lectura de la planilla de Peter

Una sola hoja, ~9.000 filas, **una fila = una línea de PO**. Sin agrupación visual por PO; Peter ordena y filtra. Columnas relevantes en orden:

```
MEX PO | LOCATION | x | PART No. | SIZE | DESCRIPTION | REV | DRAWING |
NOSE P/N | Type | Valve | THREAD | GRADE |
HB DELV. DATE | MEX DELV. DATE | DATE SHIPPED | # DAYS |
QUANTITY ORDERED | PEND | PRICE PER UNIT | MUSA | TOTAL PRICE |
Pending $ Amount | MUSA Total | MUSA Pending |
Date Issued | HB PO | NOTES
```

Insight clave: para Peter el grano es la **línea**, no el PO. Por eso el master-detail que había planeado antes es la abstracción equivocada — lo cambio por **una sola grilla plana de líneas** que imita su Excel.

## Nuevo layout — Intake y POs

```text
┌───────────────────────────────────────────────────────────────┐
│ [+ Subir PO]  [Cliente ▾] [Estado ▾] [🔍 PIR / PO / nota…]    │
│ Chips: Pendientes (12) · Cambios sin ver (3) · Atrasados (5)  │
├───────────────────────────────────────────────────────────────┤
│ MEX │ HB PO │ Loc │ Sh │ PIR │ Size │ Descripción │ Thr │ Gr  │
│ HB date │ MEX date │ Shipped │ #d │ Qty │ Pend │ ODF │ Notas  │
│ ───── densas, mono 12px, bordes celda, header sticky ─────── │
│ 1743 │ 451288.. │ EL RENO│ ✓ │ 102587573 │ 5.5 │ SHOE,FLT… │…│
│ ▍ celda con borde amber + tooltip = cambió hace 2h           │
└───────────────────────────────────────────────────────────────┘
```

- **Una sola tabla plana de líneas** en ambas pestañas. Mismo componente.
- `/intake` arranca filtrado por "cargados por mí / pendientes" + chip de cambios sin ver.
- `/purchase-orders` arranca sin filtro (todas las líneas). Es la "vista Excel" completa.
- Diferencia: la ficha PO `/purchase-orders/$id` con tabs queda accesible vía click en `MEX` o `HB PO` (link), pero no es la vista primaria.

## Columnas (mapeo a nuestro modelo)

| Columna planilla | Origen en DB |
|---|---|
| MEX PO | `purchase_orders.po_number` cuando customer = Musa, sino mostrar `—` |
| HB PO | `purchase_orders.po_number` cuando customer = Halliburton |
| LOCATION | nuevo campo opcional en `po_line_items.location` (o derivar de notas por ahora; ver "fuera de alcance") |
| Sh (shipped) | derivado: existe job con status `SHIPPED` para esa línea |
| PIR | `po_line_items.pir` |
| Size / Thread / Grade | derivar parseando `tube_spec` ahora, sin migración; mostrar como subtexto |
| Descripción | `po_line_items.tube_spec` |
| HB DELV. DATE | `po_line_items.committed_date` (cliente) |
| MEX DELV. DATE | `jobs.customer_date` o `planned_end` agregada por línea |
| DATE SHIPPED | de la job (`status_events` SHIPPED) |
| # días | calculado `HB date - hoy` |
| Qty | `qty_ordered` |
| Pend | `qty_ordered - sum(pieces_completed)` |
| ODF | `jobs.odf` (lista si hay varias) |
| Notas | `po_line_items.notes` |

Edición inline: PIR, Descripción, Qty, HB date, MEX date, Notas (mismo patrón que Excel: click → input → guarda en blur).

## Resaltar cambios (decisión: celda + tooltip)

- Cada celda cuyo valor difiere del anterior conocido (de `date_change_log` y de `updated_at` cuando aplique) → fondo `bg-amber-500/10`, borde izquierdo `border-l-2 border-amber-500`, indicador `•` arriba a la derecha.
- Hover → tooltip: `Antes: 2026-05-10 · Ahora: 2026-05-14 · +4d · hace 2h por Peter`.
- En la barra superior: chip `Cambios sin ver (3)`. Click → filtra la grilla a sólo líneas con cambios pendientes. Botón "Marcar todo visto" en la barra y por celda (click en `•`) — escribe `acknowledged_by_peter=true`.
- Para campos no-fecha (PIR/Spec/Qty/Notas) reutilizamos `date_change_log` (su columna `field` es texto libre).

## Archivos

- **`src/components/fact/PoLinesSpreadsheet.tsx`** (nuevo) — la grilla densa con todas las columnas, edición inline, highlight de cambios, filtros y búsqueda. Recibe `lines: PoLineRow[]`, `mode: "intake" | "browse"`.
- **`src/hooks/usePoLinesSpreadsheet.ts`** (nuevo) — query que devuelve todas las líneas con joins planos (PO, customer, jobs agregadas, last_change). Una sola llamada para la pantalla entera.
- **`src/hooks/usePoLineHistory.ts`** (nuevo) — mapa `{lineId+field → {old, new, when, acked}}` desde `date_change_log`, para alimentar el highlight.
- **`src/lib/po-workflow.functions.ts`** — agregar `updatePoLineField({id, field, value})` que registra el cambio anterior en `date_change_log` antes de escribir.
- **`src/routes/intake.tsx`** — reemplazar la tabla actual por `PoLinesSpreadsheet mode="intake"`. Conservar `UploadPoDialog` arriba. Sacar el banner grande de "cambios de fecha" — pasa a chip + filtro.
- **`src/routes/purchase-orders.index.tsx`** — reemplazar tabla de POs por `PoLinesSpreadsheet mode="browse"`. Conservar link a ficha PO `$id`.
- **`/purchase-orders/$id`** — sin cambios estructurales; agregar breadcrumb desde la grilla.

## Densidad y look (para que se sienta Excel)

- Filas 26px, fuente mono 12px en datos, sans 11px en headers.
- Bordes 1px entre todas las celdas (`divide-x divide-y`), no solo entre filas.
- Header sticky en top del panel, primera columna (MEX) sticky a la izquierda en scroll horizontal.
- Filas alternadas muy sutiles (`even:bg-muted/20`).
- Hover de fila resalta toda la fila.
- Columnas redimensionables (mínimo viable: anchos fijos sensatos por columna).

## Fuera de alcance (este pase)

- Migración para columnas nuevas (`location`, parsear `tube_spec` a size/thread/grade en columnas separadas). Por ahora derivar en cliente. Si Peter lo pide, hacemos una migración aparte.
- Engineering (pedido del usuario).
- Importar la planilla histórica de Peter.
- Edición masiva (fill-down, copiar/pegar rango). Si lo pide después, se evalúa.
