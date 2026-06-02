## Objetivo

Unificar Intake y Purchase Orders en un solo tab llamado **"Purchase Orders"**, manteniendo el comportamiento del modo `intake` (todas las líneas, editable, foco en pendientes).

## Cambios

### 1. `src/routes/purchase-orders.index.tsx`
- Reemplazar el contenido por la versión de `intake.tsx`: título "Purchase Orders · Peter", subtítulo de la planilla, `UploadPoDialog`, y `<PoLinesSpreadsheet mode="intake" />`.
- Quitar el link "Volver" (ya está la nav superior).

### 2. `src/routes/intake.tsx`
- Eliminar el archivo. La ruta `/intake` deja de existir.

### 3. `src/components/fact/AppShell.tsx`
- Quitar el `<Link to="/intake">` (Inbox icon).
- Dejar solo `<Link to="/purchase-orders">` con label "Purchase Orders" (en vez de "POs") y el icono `FileText`. Opcionalmente cambiar icono a `Inbox` para conservar la metáfora de "bandeja de entrada".

### 4. `src/components/fact/PoLinesSpreadsheet.tsx`
- Verificar si el prop `mode="browse"` se sigue usando en algún otro lado. Si no, simplificar quitando el prop (siempre comporta como `intake`). Si todavía se usa internamente para algo, dejarlo y solo pasar `intake` desde la única ruta.

### 5. Redirect (opcional, recomendado)
- Cambiar `intake.tsx` en vez de borrar: convertirlo en una redirección a `/purchase-orders` por si Peter tiene bookmarks. Una línea con `beforeLoad: () => { throw redirect({ to: "/purchase-orders" }) }`.

## Detalle técnico

```tsx
// src/routes/intake.tsx — opción redirect
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/intake")({
  beforeLoad: () => { throw redirect({ to: "/purchase-orders" }); },
});
```

```tsx
// AppShell.tsx — link único
<Link to="/purchase-orders" ...>
  <Inbox className="h-3.5 w-3.5" />
  <span className="uppercase tracking-widest">Purchase Orders</span>
</Link>
```

No se toca backend, schema, ni los flujos de Ingeniería / Producción / Calendario.

## Resultado

Nav final: **Calendario · Purchase Orders · Ingeniería · Producción · Config**, reflejando exactamente el workflow: PO entra → ingeniería aprueba → producción crea ODF → ODF vive en calendario y máquinas.