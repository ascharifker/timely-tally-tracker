import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/fact/AppShell";
import { usePurchaseOrder } from "@/hooks/usePurchaseOrders";
import { useJobs } from "@/hooks/useFactData";
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
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { JobDetailDialog } from "@/components/fact/JobDetailDialog";
import {
  ArrowLeft,
  Download,
  ExternalLink,
  FileText,
  AlertTriangle,
} from "lucide-react";
import {
  PO_LINE_STATUS_LABEL,
  STATUS_LABEL,
  type Job,
  type POLineStatus,
} from "@/lib/fact-types";

export const Route = createFileRoute("/purchase-orders/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "PO · FACT" }] }),
  component: PurchaseOrderDetailPage,
});

function daysBetween(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function PurchaseOrderDetailPage() {
  const { id } = Route.useParams();
  const { data: po, isLoading } = usePurchaseOrder(id);
  const { data: allJobs = [] } = useJobs();
  const getUrl = useServerFn(getPoDocumentUrl);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [openJob, setOpenJob] = useState<Job | null>(null);

  useEffect(() => {
    if (!po?.source_document_url) {
      setPdfUrl(null);
      return;
    }
    let cancelled = false;
    getUrl({ data: { storagePath: po.source_document_url } })
      .then((r) => !cancelled && setPdfUrl(r.url))
      .catch(() => !cancelled && setPdfUrl(null));
    return () => {
      cancelled = true;
    };
  }, [po?.source_document_url, getUrl]);

  const statusCounts = useMemo(() => {
    const map: Partial<Record<POLineStatus, number>> = {};
    for (const li of po?.line_items ?? []) {
      map[li.status] = (map[li.status] ?? 0) + 1;
    }
    return map;
  }, [po?.line_items]);

  const totalLines = po?.line_items.length ?? 0;
  const completedLines = statusCounts.completed ?? 0;
  const progressPct = totalLines ? Math.round((completedLines / totalLines) * 100) : 0;

  const now = new Date();
  const ageDays = po ? daysBetween(now, new Date(po.created_at)) : 0;
  const committedInDays = po?.committed_date
    ? daysBetween(new Date(po.committed_date), now)
    : null;

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
          {/* Header */}
          <div className="mb-4 flex items-start justify-between gap-4">
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
            <div className="flex items-center gap-2">
              {pdfUrl && (
                <>
                  <Button asChild variant="outline" size="sm">
                    <a href={pdfUrl} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-3.5 w-3.5 mr-1.5" /> Abrir PDF
                    </a>
                  </Button>
                  <Button asChild variant="outline" size="sm">
                    <a href={pdfUrl} download>
                      <Download className="h-3.5 w-3.5 mr-1.5" /> Descargar
                    </a>
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Metrics row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Metric label="Cargado hace" value={`${ageDays} d`} />
            <Metric
              label="Fecha comprometida"
              value={po.committed_date ?? "—"}
              hint={
                committedInDays == null
                  ? null
                  : committedInDays < 0
                    ? `vencido hace ${Math.abs(committedInDays)} d`
                    : `en ${committedInDays} d`
              }
              danger={committedInDays != null && committedInDays < 0}
            />
            <Metric
              label="Progreso"
              value={`${completedLines}/${totalLines}`}
              hint={`${progressPct}% completado`}
            />
            <Metric label="Líneas" value={String(totalLines)} />
          </div>

          {/* Status chips */}
          {totalLines > 0 && (
            <div className="mb-6 flex flex-wrap gap-1.5">
              {(Object.keys(statusCounts) as POLineStatus[]).map((s) => (
                <Badge key={s} variant="secondary" className="text-xs">
                  {PO_LINE_STATUS_LABEL[s]} · {statusCounts[s]}
                </Badge>
              ))}
            </div>
          )}

          <Tabs defaultValue="resumen">
            <TabsList>
              <TabsTrigger value="resumen">Resumen</TabsTrigger>
              <TabsTrigger value="lineas">Líneas ({totalLines})</TabsTrigger>
              <TabsTrigger value="odfs">ODFs ({po.jobs.length})</TabsTrigger>
              <TabsTrigger value="historial">
                Historial ({po.date_changes.length})
              </TabsTrigger>
              <TabsTrigger value="pdf">PDF</TabsTrigger>
            </TabsList>

            <TabsContent value="resumen" className="space-y-4 mt-4">
              <div className="grid grid-cols-3 gap-4 text-sm">
                <Field label="Cliente" value={po.customer?.name ?? "—"} />
                <Field label="Código cliente" value={po.customer?.code ?? "—"} />
                <Field label="PO número" value={po.po_number} />
                <Field label="Fecha de emisión" value={po.issued_date} />
                <Field label="Fecha comprometida" value={po.committed_date} />
                <Field
                  label="Creado"
                  value={new Date(po.created_at).toLocaleString()}
                />
              </div>
              {po.notes && (
                <div className="p-3 rounded border bg-muted/30 text-sm whitespace-pre-wrap">
                  {po.notes}
                </div>
              )}
              {po.customer?.notes && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-1">
                    Notas del cliente
                  </p>
                  <p className="text-sm whitespace-pre-wrap">{po.customer.notes}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="lineas" className="mt-4">
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>PIR</TableHead>
                      <TableHead>Spec</TableHead>
                      <TableHead className="text-right">Cant.</TableHead>
                      <TableHead>F. Comprometida</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead>ODF</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {po.line_items.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground py-6">
                          Sin líneas.
                        </TableCell>
                      </TableRow>
                    )}
                    {po.line_items.map((li) => {
                      const linkedJob = po.jobs.find((j) => j.po_line_item_id === li.id);
                      return (
                        <TableRow key={li.id}>
                          <TableCell className="font-mono text-xs">{li.line_number}</TableCell>
                          <TableCell className="font-mono text-xs">{li.pir ?? "—"}</TableCell>
                          <TableCell className="text-sm">{li.tube_spec ?? "—"}</TableCell>
                          <TableCell className="text-right font-mono">{li.qty_ordered}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {li.committed_date ?? "—"}
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-0.5">
                              <Badge variant="outline" className="text-[10px] w-fit">
                                {PO_LINE_STATUS_LABEL[li.status]}
                              </Badge>
                              {li.flag_reason && (
                                <span className="text-[11px] text-destructive inline-flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3" /> {li.flag_reason}
                                </span>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {linkedJob ? (
                              <button
                                onClick={() => {
                                  const full = allJobs.find((j) => j.id === linkedJob.id);
                                  setOpenJob(full ?? linkedJob);
                                }}
                                className="font-mono text-xs text-primary hover:underline"
                              >
                                {linkedJob.odf}
                              </button>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="odfs" className="mt-4">
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>ODF</TableHead>
                      <TableHead>Máquina</TableHead>
                      <TableHead>Operador</TableHead>
                      <TableHead>Inicio</TableHead>
                      <TableHead>Fin</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {po.jobs.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                          Todavía no hay ODFs creadas desde este PO.
                        </TableCell>
                      </TableRow>
                    )}
                    {po.jobs.map((j) => (
                      <TableRow
                        key={j.id}
                        className="cursor-pointer hover:bg-muted/40"
                        onClick={() => {
                          const full = allJobs.find((x) => x.id === j.id);
                          setOpenJob(full ?? j);
                        }}
                      >
                        <TableCell className="font-mono text-xs text-primary">{j.odf}</TableCell>
                        <TableCell className="text-sm">
                          {j.machine_name ?? <span className="text-muted-foreground">Sin asignar</span>}
                        </TableCell>
                        <TableCell className="text-sm">
                          {j.operator_name ?? <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {j.planned_start ? new Date(j.planned_start).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {j.planned_end ? new Date(j.planned_end).toLocaleString() : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px]">
                            {STATUS_LABEL[j.status]}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="historial" className="mt-4">
              <div className="rounded-md border bg-card">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cuándo</TableHead>
                      <TableHead>Campo</TableHead>
                      <TableHead>Anterior</TableHead>
                      <TableHead>Nuevo</TableHead>
                      <TableHead>Por</TableHead>
                      <TableHead>Visto por Peter</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {po.date_changes.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-6">
                          Sin cambios de fecha registrados.
                        </TableCell>
                      </TableRow>
                    )}
                    {po.date_changes.map((dc) => (
                      <TableRow key={dc.id}>
                        <TableCell className="text-xs text-muted-foreground">
                          {new Date(dc.changed_at).toLocaleString()}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{dc.field}</TableCell>
                        <TableCell className="text-sm">{dc.old_value ?? "—"}</TableCell>
                        <TableCell className="text-sm font-medium">{dc.new_value ?? "—"}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {dc.changed_by ?? "sistema"}
                        </TableCell>
                        <TableCell>
                          {dc.acknowledged_by_peter ? (
                            <Badge variant="outline" className="text-[10px]">Sí</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[10px]">Pendiente</Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="pdf" className="mt-4">
              {!po.source_document_url && (
                <p className="text-sm text-muted-foreground">
                  Este PO no tiene PDF adjunto.
                </p>
              )}
              {po.source_document_url && !pdfUrl && (
                <p className="text-sm text-muted-foreground inline-flex items-center gap-2">
                  <FileText className="h-4 w-4" /> Generando vista previa…
                </p>
              )}
              {pdfUrl && (
                <div className="rounded-md border bg-card overflow-hidden">
                  <iframe
                    src={pdfUrl}
                    title={`PO ${po.po_number} PDF`}
                    className="w-full"
                    style={{ height: "75vh" }}
                  />
                </div>
              )}
            </TabsContent>
          </Tabs>

          <JobDetailDialog job={openJob} onClose={() => setOpenJob(null)} />
        </>
      )}
    </AppShell>
  );
}

function Metric({
  label,
  value,
  hint,
  danger,
}: {
  label: string;
  value: string;
  hint?: string | null;
  danger?: boolean;
}) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`font-mono text-lg ${danger ? "text-destructive" : ""}`}>
        {value}
      </p>
      {hint && (
        <p className={`text-[11px] ${danger ? "text-destructive" : "text-muted-foreground"}`}>
          {hint}
        </p>
      )}
    </div>
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