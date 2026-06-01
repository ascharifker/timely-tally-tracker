import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { useState } from "react";
import { AppShell } from "@/components/fact/AppShell";
import { UploadPoDialog } from "@/components/fact/UploadPoDialog";
import { usePurchaseOrders } from "@/hooks/usePurchaseOrders";
import { useDateChanges } from "@/hooks/usePoQueues";
import { acknowledgeDateChange } from "@/lib/po-workflow.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Check, FileText } from "lucide-react";

export const Route = createFileRoute("/intake")({
  ssr: false,
  head: () => ({ meta: [{ title: "Intake · FACT" }] }),
  component: IntakePage,
});

function IntakePage() {
  const { data: pos = [], isLoading } = usePurchaseOrders();
  const { data: changes = [] } = useDateChanges({ onlyUnacknowledged: true });
  const ackFn = useServerFn(acknowledgeDateChange);
  const qc = useQueryClient();
  const [acking, setAcking] = useState<string | null>(null);

  const ack = async (id: string) => {
    setAcking(id);
    try {
      await ackFn({ data: { id } });
      await qc.invalidateQueries({ queryKey: ["date_changes"] });
    } catch (e) {
      toast.error("No se pudo marcar: " + (e instanceof Error ? e.message : "error"));
    } finally {
      setAcking(null);
    }
  };

  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Intake · Peter</h2>
          <p className="text-sm text-muted-foreground">
            Cargá el PDF del PO. Pasa a la cola de ingeniería para que Alexis valide los PIRs.
          </p>
        </div>
        <UploadPoDialog />
      </div>

      {changes.length > 0 && (
        <div className="mb-6 rounded-md border border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center gap-2 px-4 py-2 border-b border-amber-500/30 text-amber-300">
            <AlertTriangle className="h-4 w-4" />
            <span className="text-sm font-medium">
              Cambios de fecha pendientes ({changes.length})
            </span>
          </div>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente / PO</TableHead>
                <TableHead>ODF / Línea</TableHead>
                <TableHead>Campo</TableHead>
                <TableHead>Original → Nueva</TableHead>
                <TableHead>Cuándo</TableHead>
                <TableHead className="w-24" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {changes.map((c) => {
                const old = c.old_value ? new Date(c.old_value) : null;
                const nu = c.new_value ? new Date(c.new_value) : null;
                const diffDays =
                  old && nu
                    ? Math.round((nu.getTime() - old.getTime()) / 86400000)
                    : null;
                const customer = c.po_line_item?.purchase_order?.customer?.name;
                const po = c.po_line_item?.purchase_order?.po_number;
                return (
                  <TableRow key={c.id}>
                    <TableCell className="text-sm">
                      {customer ?? "—"}
                      {po && (
                        <div className="font-mono text-xs text-muted-foreground">{po}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {c.job?.odf ?? (c.po_line_item ? `L${c.po_line_item.line_number}` : "—")}
                      {c.po_line_item?.pir && (
                        <div className="text-muted-foreground">{c.po_line_item.pir}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-xs">{c.field}</TableCell>
                    <TableCell className="text-sm">
                      <span className="text-muted-foreground">{c.old_value ?? "—"}</span>
                      {" → "}
                      <span className="font-medium">{c.new_value ?? "—"}</span>
                      {diffDays !== null && diffDays !== 0 && (
                        <Badge
                          variant="outline"
                          className={
                            "ml-2 " +
                            (diffDays > 0
                              ? "border-red-500/50 text-red-300"
                              : "border-emerald-500/50 text-emerald-300")
                          }
                        >
                          {diffDays > 0 ? `+${diffDays}d` : `${diffDays}d`}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(c.changed_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        disabled={acking === c.id}
                        onClick={() => ack(c.id)}
                      >
                        <Check className="h-3.5 w-3.5 mr-1" /> Visto
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <h3 className="text-sm font-semibold mb-2 uppercase tracking-wider text-muted-foreground">
        Mis POs
      </h3>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente</TableHead>
              <TableHead>PO #</TableHead>
              <TableHead>Emisión</TableHead>
              <TableHead>Comprometida</TableHead>
              <TableHead className="text-right">Líneas</TableHead>
              <TableHead className="w-16" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && pos.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  Sin POs todavía. Cargá el primer PDF.
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