
# Paso 2 — Intake de PO por PDF con Lovable AI

Objetivo: Peter sube el PDF del PO del cliente, la app extrae cliente, número, fecha, y líneas (PIR, cantidad, fecha comprometida), muestra el resultado para revisar/editar, y al confirmar crea el `purchase_order` + `po_line_items` que ya tenemos modelados en el Paso 1.

## Flujo del usuario

1. En una nueva sección "Purchase Orders" (ruta `/purchase-orders`), botón "Cargar PO".
2. Dialog: subir PDF (drag-and-drop o file picker).
3. PDF se sube a Storage bucket privado `po-documents`.
4. Server function manda el PDF a Lovable AI (Gemini, soporta PDFs nativos vía base64/URL en `messages`) con un schema estructurado.
5. UI muestra el resultado pre-llenado en un form editable:
   - Cliente (dropdown con los existentes + "crear nuevo")
   - Número de PO
   - Fecha de emisión, fecha comprometida del PO
   - Tabla editable de líneas: PIR, descripción/tube_spec, cantidad, fecha comprometida, precio unitario
6. Botón "Confirmar y crear PO" → inserta `purchase_order` (con `source_document_url` apuntando al PDF) + `po_line_items`.
7. Toast de éxito, redirige a `/purchase-orders/$id` (lista de líneas y, eventualmente, jobs vinculados).

## Backend

### Storage
- Nuevo bucket `po-documents` (privado).
- Política: lectura/escritura para anon y authenticated (mismo patrón que el resto del proyecto, sin auth aún).
- Path convention: `po-documents/{uuid}.pdf`.

### Server function: `extractPoFromPdf`
- Archivo: `src/lib/po-intake.functions.ts` (client-safe, lo invoca el dialog).
- Input: `{ storagePath: string }` (path en el bucket, no el archivo crudo — el client sube primero a Storage y manda la ruta).
- Handler:
  1. Descarga el PDF del bucket con `supabaseAdmin` (service role, lee bucket privado).
  2. Lo manda como `file` (base64) a Lovable AI Gateway usando el helper `createLovableAiGatewayProvider`.
  3. Usa `generateText` + `Output.object(schema)` con un schema Zod estricto:
     ```
     {
       customer_name: string,
       po_number: string,
       issued_date: string | null,   // ISO yyyy-mm-dd
       committed_date: string | null,
       line_items: Array<{
         line_number: number,
         pir: string | null,
         tube_spec: string | null,
         qty_ordered: number,
         committed_date: string | null,
         unit_price: number | null,
         currency: string | null
       }>
     }
     ```
  4. Devuelve el JSON estructurado + el `storagePath` para que el client lo guarde junto al PO.

Modelo: `google/gemini-3-flash-preview` (rápido, soporta PDFs nativos, default del stack).

### Server function: `commitPo`
- Input: el JSON validado del form (después de la edición del usuario) + `storagePath`.
- Handler: crea/encuentra el customer, inserta `purchase_order` y `po_line_items` en transacción manual (RPC) o en serie con rollback manual si falla.
- Devuelve el `id` del PO creado.

### Helper compartido
- `src/lib/ai-gateway.server.ts` con el provider de Lovable AI Gateway (copiar el helper canónico del knowledge `ai-sdk-lovable-gateway`).

## Frontend

### Nueva ruta `src/routes/purchase-orders.tsx`
- Layout: header "Purchase Orders" + botón "Cargar PO" + tabla de POs existentes (lee `useQuery` desde `purchase_orders` joinado con `customers`, count de líneas).
- Por cada fila: cliente, número, fecha emisión, fecha comprometida, status, # líneas, link a detalle.

### Nueva ruta `src/routes/purchase-orders.$id.tsx`
- Detalle de un PO: header con datos del cliente + PO, lista de line items (tabla), link al PDF original, sección "ODFs vinculadas" (jobs cuyo `po_line_item_id` esté en este PO — preparado pero puede quedar vacío hasta que migremos creación de jobs).

### Componente `<UploadPoDialog />`
- Estados: `idle` → `uploading` (subiendo a Storage) → `extracting` (esperando AI) → `reviewing` (form editable) → `committing` → `done`.
- Maneja errores 429/402 del gateway con toasts claros ("Reintentá en un momento" / "Sin créditos, agregalos en Workspace > Usage").
- Form de revisión usa los componentes shadcn ya en el proyecto (Input, Select, Table, Button).

### Hook `useCustomers`
- Lee `customers` desde Supabase (analogo a `useVendors`).

### Hook `usePurchaseOrders`
- Lee POs con su customer y count de líneas.

### Navegación
- Agregar "Purchase Orders" al `AppShell` sidebar (entre la home y "Configuración").

## Lo que NO hace este paso

- No vincula automáticamente jobs nuevos a líneas de PO. Eso es un paso futuro (UI para "crear ODF desde línea").
- No agrega vista Customer agrupada por PO (Paso 3 del roadmap).
- No agrega forecast dates derivadas (Paso 4).
- No agrega auth ni notificaciones (Paso 5).
- No borra/migra el flujo viejo de creación de jobs (sigue funcionando contra `po_musa`/`po_halliburton`).

## Detalles técnicos

- El bucket es privado → el AI extractor usa `supabaseAdmin` para descargarlo; el browser nunca toca el archivo después de subirlo.
- El PDF se sube con `supabase.storage.from('po-documents').upload(...)` desde el browser (anon key, política abierta — mismo patrón del proyecto). En un futuro con auth, se restringe a `authenticated`.
- Para mostrar el link al PDF en el detalle, generamos una signed URL (`createSignedUrl`, 1h) en una server function al renderizar.
- Lovable AI Gateway acepta PDFs en `messages` como `{ type: "file", data: <base64>, mimeType: "application/pdf" }`. Confirmamos formato exacto al implementar (ver docs del gateway).
- Validación Zod del output del AI antes de mostrarlo al usuario — si falla, mensaje "No pudimos extraer el PO automáticamente, ingresalo manualmente" + form vacío.
- Si el customer extraído por AI no matchea exactamente (ej: "Halliburton Argentina" vs "Halliburton"), el dropdown del review form pre-selecciona por fuzzy match (lowercase + contains) y permite "crear nuevo cliente" inline.

## Criterio de éxito

1. Subir un PDF de Musa o Halliburton real (de los que Peter ya tiene) y ver el form pre-llenado con cliente, número, fechas y al menos una línea.
2. Editar campos, confirmar, y verificar en la base que `purchase_orders` y `po_line_items` se crearon correctamente y `source_document_url` apunta al PDF subido.
3. Abrir `/purchase-orders/$id` y ver el detalle + link funcional al PDF.
4. El flujo viejo de creación de jobs sigue funcionando sin cambios.

## Riesgos

- **Calidad de extracción**: depende del formato del PDF. Si Musa/Halliburton mandan PDFs muy distintos entre sí, puede que el schema no capture bien. Mitigación: el form es editable, el AI es una sugerencia, no un commit automático.
- **Costos AI Gateway**: cada PDF cuesta créditos. Gemini Flash es barato pero conviene mostrar al usuario cuándo se está extrayendo y no permitir double-clicks.
- **PDFs escaneados**: si el PDF no tiene texto (es una imagen), Gemini igual lo OCRea, pero la fidelidad baja. Aceptable para v1.
