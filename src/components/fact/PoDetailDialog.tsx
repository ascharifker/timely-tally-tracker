import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { usePoDetail } from "@/hooks/usePoDetail";
import { ExternalLink } from "lucide-react";

export function PoDetailDialog({
  poId,
  onClose,
}: {
  poId: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = usePoDetail(poId);
  const po = data?.po;
  const changes = data?.changes ?? [];

  return (
    <Dialog open={!!poId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {po ? `PO ${po.po_number}` : "Detalle de PO"}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="text-center text-muted-foreground py-8">Cargando…</div>
        )}

        {po && (
          <div className="space-y-5 text-sm">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-3 rounded-md border bg-muted/30 p-3">
              <div>
                <div className="text-xs text-muted-foreground">Cliente</div>
                <div className="font-medium">{po.customer?.name ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Status</div>
                <Badge variant="outline">{po.status}</Badge>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Fecha emisión</div>
                <div className="font-mono">{po.issued_date ?? "—"}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Comprometida</div>
                <div className="font-mono">{po.committed_date ?? "—"}</div>
              </div>
              {po.source_document_url && (
                <div className="col-span-2">
                  <a
                    href={po.source_document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline text-xs"
                  >
                    <ExternalLink className="h-3 w-3" /> Documento original
                  </a>
                </div>
              )}
              {po.notes && (
                <div className="col-span-2">
                  <div className="text-xs text-muted-foreground">Notas PO</div>
                  <div className="whitespace-pre-wrap">{po.notes}</div>
                </div>
              )}
            </div>

            {/* Lines */}
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Líneas ({po.lines?.length ?? 0})
              </h3>
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">L#</TableHead>
                      <TableHead>PIR</TableHead>
                      <TableHead>Spec</TableHead>
                      <TableHead className="text-right">Qty</TableHead>
                      <TableHead>Comprometida</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Notas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {po.lines?.map((l) => (
                      <TableRow key={l.id}>
                        <TableCell className="font-mono text-xs">L{l.line_number}</TableCell>
                        <TableCell className="font-mono text-xs">{l.pir ?? "—"}</TableCell>
                        <TableCell>{l.tube_spec ?? "—"}</TableCell>
                        <TableCell className="text-right font-mono">{l.qty_ordered}</TableCell>
                        <TableCell className="font-mono text-xs">{l.committed_date ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {l.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {l.notes ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>

            {/* Change history */}
            <div>
              <h3 className="text-sm font-semibold mb-2">
                Historial de cambios ({changes.length})
              </h3>
              {changes.length === 0 ? (
                <div className="text-xs text-muted-foreground py-3 px-2 rounded-md border bg-muted/20">
                  Sin cambios registrados.
                </div>
              ) : (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Línea</TableHead>
                        <TableHead>Campo</TableHead>
                        <TableHead>Antes</TableHead>
                        <TableHead>Ahora</TableHead>
                        <TableHead>Cuándo</TableHead>
                        <TableHead>Quién</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {changes.map((c) => {
                        const line = po.lines?.find((l) => l.id === c.po_line_item_id);
                        return (
                          <TableRow key={c.id}>
                            <TableCell className="font-mono text-xs">
                              {line ? `L${line.line_number}` : "—"}
                            </TableCell>
                            <TableCell className="text-xs">{c.field}</TableCell>
                            <TableCell className="font-mono text-xs">{c.old_value ?? "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{c.new_value ?? "—"}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {new Date(c.changed_at).toLocaleString()}
                            </TableCell>
                            <TableCell className="text-xs">{c.changed_by ?? "—"}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}