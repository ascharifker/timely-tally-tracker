import { createFileRoute, Link } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/fact/AppShell";
import { UploadPoDialog } from "@/components/fact/UploadPoDialog";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileText } from "lucide-react";

export const Route = createFileRoute("/purchase-orders/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Purchase Orders · FACT" },
      {
        name: "description",
        content: "Pedidos del cliente. Cargá un PDF y dejá que la AI extraiga las líneas.",
      },
    ],
  }),
  component: PurchaseOrdersPage,
});

function PurchaseOrdersPage() {
  const { data: pos = [], isLoading } = usePurchaseOrders();

  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Volver
          </Link>
          <h2 className="text-2xl font-semibold tracking-tight mt-1">Purchase Orders</h2>
          <p className="text-sm text-muted-foreground">
            Pedidos del cliente. Subí el PDF y revisá la extracción antes de guardar.
          </p>
        </div>
        <UploadPoDialog />
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>PO #</TableHead>
              <TableHead>Emisión</TableHead>
              <TableHead>Comprometida</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="text-right">Líneas</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && pos.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No hay POs cargados todavía.
                </TableCell>
              </TableRow>
            )}
            {pos.map((po) => (
              <TableRow key={po.id}>
                <TableCell className="font-medium">{po.customer?.name ?? "—"}</TableCell>
                <TableCell className="font-mono text-xs">{po.po_number}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {po.issued_date ?? "—"}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {po.committed_date ?? "—"}
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{po.status}</Badge>
                </TableCell>
                <TableCell className="text-right font-mono text-xs">{po.line_count}</TableCell>
                <TableCell>
                  <Link
                    to="/purchase-orders/$id"
                    params={{ id: po.id }}
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                  >
                    <FileText className="h-3 w-3" /> Ver
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </AppShell>
  );
}