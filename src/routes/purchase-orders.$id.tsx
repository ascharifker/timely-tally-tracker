import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/fact/AppShell";
import { usePurchaseOrder } from "@/hooks/usePurchaseOrders";
import { getPoDocumentUrl } from "@/lib/po-intake.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ExternalLink } from "lucide-react";

export const Route = createFileRoute("/purchase-orders/$id")({
  ssr: false,
  head: () => ({
    meta: [{ title: "PO · FACT" }],
  }),
  component: PurchaseOrderDetailPage,
});

function PurchaseOrderDetailPage() {
  const { id } = Route.useParams();
  const { data: po, isLoading } = usePurchaseOrder(id);
  const getUrl = useServerFn(getPoDocumentUrl);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!po?.source_document_url) {
      setPdfUrl(null);
      return;
    }
    let cancelled = false;
    getUrl({ data: { storagePath: po.source_document_url } })
      .then((r) => {
        if (!cancelled) setPdfUrl(r.url);
      })
      .catch(() => {
        if (!cancelled) setPdfUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [po?.source_document_url, getUrl]);

  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4">
        <Link
          to="/purchase-orders"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" /> Purchase Orders
        </Link>
      </div>

      {isLoading && <p className="text-muted-foreground">Cargando…</p>}
      {!isLoading && !po && (
        <p className="text-muted-foreground">No encontramos este PO.</p>
      )}

      {po && (
        <>
          <div className="mb-6 flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-2xl font-semibold tracking-tight">
                  PO {po.po_number}
                </h2>
                <Badge variant="outline">{po.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {po.customer?.name ?? "—"}
                {po.customer?.code ? ` · ${po.customer.code}` : ""}
              </p>
            </div>
            {pdfUrl && (
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Ver PDF original
              </a>
            )}
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6 text-sm">
            <Field label="Fecha de emisión" value={po.issued_date} />
            <Field label="Fecha comprometida" value={po.committed_date} />
            <Field
              label="Creado"
              value={new Date(po.created_at).toLocaleDateString()}
            />
          </div>

          {po.notes && (
            <div className="mb-6 p-3 rounded border bg-muted/30 text-sm whitespace-pre-wrap">
              {po.notes}
            </div>
          )}

          <h3 className="text-sm font-semibold mb-2 uppercase tracking-wider text-muted-foreground">
            Líneas
          </h3>
          <div className="rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>PIR</TableHead>
                  <TableHead>Spec</TableHead>
                  <TableHead className="text-right">Cantidad</TableHead>
                  <TableHead>F. Comprometida</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.line_items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                      Sin líneas.
                    </TableCell>
                  </TableRow>
                )}
                {po.line_items.map((li) => (
                  <TableRow key={li.id}>
                    <TableCell className="font-mono text-xs">{li.line_number}</TableCell>
                    <TableCell className="font-mono text-xs">{li.pir ?? "—"}</TableCell>
                    <TableCell className="text-sm">{li.tube_spec ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono">{li.qty_ordered}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {li.committed_date ?? "—"}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {li.unit_price != null
                        ? `${li.unit_price.toLocaleString()} ${li.currency ?? ""}`
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </AppShell>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-mono">{value ?? "—"}</p>
    </div>
  );
}