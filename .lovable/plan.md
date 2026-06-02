## Goal

Hacer que **Purchase Orders** se comporte como la planilla viva de Peter: cada línea aparece desde que entra y **permanece visible** mientras avanza (ingeniería → producción → cementación → export → enviado). Nada desaparece — solo cambia su columna `Estado` / `ODF` / `Shipped`.

## Diagnóstico

La consulta ya trae **todas** las líneas (`usePoLinesSpreadsheet` no filtra por estado en la DB). El problema está en la UI:

- En modo `intake`, el filtro de estado arranca en `"pending_engineering"` (`PoLinesSpreadsheet.tsx` línea 82-84). Por eso, en cuanto Alexis aprueba una línea, "desaparece" de la vista de Peter.
- Falta ordenar de forma estable para una bitácora (hoy ordena por `committed_date`, las líneas sin fecha caen al final y las enviadas se mezclan con las activas).

## Cambios

### 1. Vista por defecto = todo, como la planilla
- `PoLinesSpreadsheet.tsx`: el filtro de estado arranca en `"all"` también en modo `intake`.
- Agregar **chips rápidos** arriba de la tabla para que Peter cambie de lente sin perder el “todo”:
  - `Todos` (default)
  - `Pendiente ingeniería`
  - `En producción` (ready_for_production + in_progress + scheduled)
  - `Enviados` (completed / YA_SE_ENVIO)
  - `Atrasados` (reusa el cálculo `lateCount`)
- Los chips son filtros visuales; el dataset sigue siendo el completo.

### 2. Orden estilo bitácora
Orden por defecto:
1. Activos primero (no `completed` / no `cancelled`), por `committed_date` ascendente, nulls al final.
2. Después los `completed` / enviados, por `shipped_at` descendente (los más recientes arriba).

### 3. Indicador visual de “cerradas pero visibles”
- Las filas `completed` / `cancelled` se muestran con texto en `text-muted-foreground` y un punto verde de “shipped” cuando `shipped_at` está presente.
- La columna `Shipped` ya existe pero se completa solo cuando un job pasa a `YA_SE_ENVIO` — confirmamos que sigue funcionando para que la fila quede con su fecha histórica.

### 4. Contador en el header
Reemplazar el subtítulo actual por uno que muestre la naturaleza de bitácora:

> “Una fila por línea de PO. Las líneas no desaparecen al avanzar — ves todo el ciclo (ingeniería → producción → export → enviado).”

Y al pie: `X activas · Y enviadas · Z atrasadas · N total`.

## Detalles técnicos

Archivos tocados:
- `src/components/fact/PoLinesSpreadsheet.tsx` — default filter, chips, sort, footer stats, estilo fila cerrada.
- `src/routes/purchase-orders.index.tsx` — copy del subtítulo.

No se requieren cambios de DB ni de server functions. La data ya está toda ahí; solo cambiamos cómo se presenta.

## Fuera de alcance

- No tocamos las pestañas de Ingeniería ni Producción (ahí sí queremos colas filtradas por estado, esa lógica se queda igual).
- No agregamos export a Excel todavía — si Peter lo necesita, lo sumamos en una próxima iteración.
