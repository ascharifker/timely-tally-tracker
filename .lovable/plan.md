## Objetivo

Permitir a Luis Angel (Producción) abrir el detalle completo de una PO desde la tabla de líneas listas, sin salir del tab.

## Cambios

### 1. Nuevo componente `src/components/fact/PoDetailDialog.tsx`
Diálogo reutilizable que recibe un `purchase_order_id` y muestra:
- **Header**: PO number, cliente, status, fecha emisión, fecha comprometida.
- **Todas las líneas de la PO** (no solo la actual): L#, PIR, Spec, Qty, fecha comprometida, status, notas.
- **Historial de cambios** (`date_change_log`) de esa PO: campo, antes → ahora, fecha, quién.
- **Notas** de la PO.
- Botón cerrar. Solo lectura (no edita — para eso ya existe Intake).

Datos vía un nuevo hook `usePoDetail(poId)` que hace un solo query a `purchase_orders` con `customer`, `po_line_items` y `date_change_log` (filtrado por los line ids).

### 2. `src/routes/production.tsx`
- Convertir el `po_number` mostrado en cada fila en un botón link (estilo `underline text-primary cursor-pointer`).
- Al hacer click, abrir `<PoDetailDialog poId={...} />`.
- Mantener intacta la columna "Crear ODF".

## Detalle técnico

```tsx
// En la celda Cliente/PO:
<button
  type="button"
  onClick={() => setDetailPoId(l.purchase_order!.id)}
  className="font-mono text-xs text-primary hover:underline"
>
  {l.purchase_order?.po_number}
</button>
```

```ts
// src/hooks/usePoDetail.ts
export function usePoDetail(poId: string | null) {
  return useQuery({
    enabled: !!poId,
    queryKey: ["po_detail", poId],
    queryFn: async () => {
      const { data: po } = await supabase
        .from("purchase_orders")
        .select("*, customer:customers(*), lines:po_line_items(*)")
        .eq("id", poId!)
        .single();
      const lineIds = po?.lines?.map(l => l.id) ?? [];
      const { data: changes } = await supabase
        .from("date_change_log")
        .select("*")
        .in("po_line_item_id", lineIds)
        .order("changed_at", { ascending: false });
      return { po, changes: changes ?? [] };
    },
  });
}
```

No se modifica backend ni schema. Solo lectura.