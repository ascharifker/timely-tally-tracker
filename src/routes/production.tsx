import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { useState, Fragment } from "react";
import { AppShell } from "@/components/fact/AppShell";
import { usePoLinesByStatus, type PoLineWithContext } from "@/hooks/usePoQueues";
import { useMachines } from "@/hooks/useFactData";
import { useVendors } from "@/hooks/useVendors";
import { useActiveJobs, useCompletedJobs, type ActiveJob } from "@/hooks/useActiveJobs";
import {
  splitPoLineIntoOdf,
  advanceJobStep,
  holdJob,
  resumeJob,
  applyCascadingDelay,
} from "@/lib/odf.functions";
import { JobStepsTimeline } from "@/components/fact/JobStepsTimeline";
import { PoDetailDialog } from "@/components/fact/PoDetailDialog";
import { OdfBreakdownDialog } from "@/components/fact/OdfBreakdownDialog";
import { computeOdfOtd, OTD_TONE } from "@/lib/scheduling/odf-otd";
import { supabase } from "@/integrations/supabase/client";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar, Pause, Play, ChevronRight, AlertTriangle } from "lucide-react";

function renderOtdBadge(j: ActiveJob) {
  const otd = computeOdfOtd(j);
  const tone = OTD_TONE[otd.score];
  return (
    <span
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-semibold"
      style={{ color: tone.color, backgroundColor: tone.bg }}
      title={
        otd.shipped_at && otd.customer_date
          ? `Enviado ${otd.shipped_at.slice(0,10)} · cliente ${otd.customer_date}`
          : "Sin fecha cliente o envío"
      }
    >
      {tone.label}
      {otd.days_diff !== null && (
        <span className="font-mono">
          {otd.days_diff > 0 ? `+${otd.days_diff}d` : otd.days_diff < 0 ? `${otd.days_diff}d` : "0d"}
        </span>
      )}
    </span>
  );
}

export const Route = createFileRoute("/production")({
  ssr: false,
  head: () => ({ meta: [{ title: "Producción · MEGO Produccion" }] }),
  component: ProductionPage,
});

function usePlannedQtyByLine(lineIds: string[]) {
  return useQuery({
    queryKey: ["planned_qty_by_line", lineIds.slice().sort().join(",")],
    enabled: lineIds.length > 0,
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("jobs")
        .select("po_line_item_id, qty")
        .in("po_line_item_id", lineIds);
      if (error) throw error;
      const acc: Record<string, number> = {};
      for (const r of (data ?? []) as { po_line_item_id: string | null; qty: number }[]) {
        if (!r.po_line_item_id) continue;
        acc[r.po_line_item_id] = (acc[r.po_line_item_id] ?? 0) + (r.qty ?? 0);
      }
      return acc;
    },
  });
}

function ProductionPage() {
  const { data: lines = [], isLoading } = usePoLinesByStatus([
    "ready_for_production",
    "in_progress",
  ]);
  const { data: machines = [] } = useMachines();
  const { data: vendors = [] } = useVendors();
  const { data: activeJobs = [] } = useActiveJobs();
  const { data: completedJobs = [] } = useCompletedJobs();
  const { data: plannedByLine = {} } = usePlannedQtyByLine(lines.map((l) => l.id));
  const qc = useQueryClient();

  const [active, setActive] = useState<PoLineWithContext | null>(null);
  const [detailPoId, setDetailPoId] = useState<string | null>(null);
  const [detailJob, setDetailJob] = useState<ActiveJob | null>(null);

  const refreshAll = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["po_lines_by_status"] }),
      qc.invalidateQueries({ queryKey: ["jobs"] }),
      qc.invalidateQueries({ queryKey: ["active_jobs"] }),
      qc.invalidateQueries({ queryKey: ["completed_jobs"] }),
      qc.invalidateQueries({ queryKey: ["planned_qty_by_line"] }),
      qc.invalidateQueries({ queryKey: ["po_lines_spreadsheet"] }),
      qc.invalidateQueries({ queryKey: ["po_line_history"] }),
    ]);
  };

  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Producción</h2>
        <p className="text-sm text-muted-foreground">
          Partí cada línea en una o más ODTs (numeración nnn/yy) asignándoles máquina, turno y vendor de cementación.
        </p>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente / PO</TableHead>
              <TableHead>Línea</TableHead>
              <TableHead>PIR</TableHead>
              <TableHead>Spec</TableHead>
              <TableHead className="text-right">Pedido</TableHead>
              <TableHead className="text-right">Pendiente</TableHead>
              <TableHead>Comprometida</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Sin líneas listas. Esperando que Alexis apruebe.
                </TableCell>
              </TableRow>
            )}
            {lines.map((l) => {
              const planned = plannedByLine[l.id] ?? 0;
              const pending = Math.max(0, l.qty_ordered - planned);
              return (
              <TableRow key={l.id}>
                <TableCell className="text-sm">
                  {l.purchase_order?.customer?.name ?? "—"}
                  {l.purchase_order && (
                    <button
                      type="button"
                      onClick={() => setDetailPoId(l.purchase_order!.id)}
                      className="block font-mono text-xs text-primary hover:underline text-left"
                      title="Ver detalle de la PO"
                    >
                      {l.purchase_order.po_number}
                    </button>
                  )}
                </TableCell>
                <TableCell className="font-mono text-xs">L{l.line_number}</TableCell>
                <TableCell className="font-mono text-xs">{l.pir ?? "—"}</TableCell>
                <TableCell className="text-sm">{l.tube_spec ?? "—"}</TableCell>
                <TableCell className="text-right font-mono">{l.qty_ordered}</TableCell>
                <TableCell className="text-right font-mono">
                  <span className={pending === 0 ? "text-muted-foreground" : "text-primary"}>
                    {pending}
                  </span>
                  {planned > 0 && pending > 0 && (
                    <span className="text-muted-foreground text-[10px]"> /{planned}p</span>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {l.committed_date ?? "—"}
                </TableCell>
                <TableCell>
                  <Button size="sm" disabled={pending === 0} onClick={() => setActive(l)}>
                    <Calendar className="h-3.5 w-3.5 mr-1" /> Crear ODT
                  </Button>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="mt-8 mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Mis ODTs activas</h2>
        <p className="text-sm text-muted-foreground">
          Pasos en curso, retrasos y acciones rápidas (avanzar, pausar, reportar retraso).
        </p>
      </div>
      <ActiveJobsTable
        jobs={activeJobs}
        machines={machines}
        onChange={refreshAll}
        onOpenPo={setDetailPoId}
        onOpenOdf={setDetailJob}
      />

      <div className="mt-8 mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">ODTs completadas</h2>
        <p className="text-sm text-muted-foreground">
          Histórico de ODTs enviadas. Filtrá por PO o cliente para revisar lo entregado.
        </p>
      </div>
      <CompletedJobsTable
        jobs={completedJobs}
        machines={machines}
        onOpenPo={setDetailPoId}
        onOpenOdf={setDetailJob}
      />

      <CreateOdfDialog
        line={active}
        pending={active ? Math.max(0, active.qty_ordered - (plannedByLine[active.id] ?? 0)) : 0}
        machines={machines}
        vendors={vendors}
        onClose={() => setActive(null)}
        onDone={async () => {
          setActive(null);
          await refreshAll();
        }}
      />
      <PoDetailDialog poId={detailPoId} onClose={() => setDetailPoId(null)} />
      <OdfBreakdownDialog
        job={detailJob}
        machines={machines}
        onClose={() => setDetailJob(null)}
      />
    </AppShell>
  );
}

function CompletedJobsTable({
  jobs,
  machines,
  onOpenPo,
  onOpenOdf,
}: {
  jobs: ActiveJob[];
  machines: { id: string; name: string }[];
  onOpenPo: (poId: string) => void;
  onOpenOdf: (job: ActiveJob) => void;
}) {
  const [filter, setFilter] = useState("");
  const [groupByPo, setGroupByPo] = useState(true);
  const mById = Object.fromEntries(machines.map((m) => [m.id, m.name]));

  const filtered = jobs.filter((j) => {
    if (!filter.trim()) return true;
    const q = filter.toLowerCase();
    return (
      j.odf.toLowerCase().includes(q) ||
      (j.po?.po_number ?? "").toLowerCase().includes(q) ||
      (j.po?.customer_name ?? "").toLowerCase().includes(q) ||
      (j.pir ?? "").toLowerCase().includes(q)
    );
  });

  if (jobs.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        Aún no hay ODTs enviadas.
      </div>
    );
  }

  const groups = new Map<string, { po_number: string; customer: string | null; jobs: ActiveJob[] }>();
  if (groupByPo) {
    for (const j of filtered) {
      const key = j.po?.id ?? "__none__";
      const g = groups.get(key) ?? {
        po_number: j.po?.po_number ?? "Sin PO",
        customer: j.po?.customer_name ?? null,
        jobs: [],
      };
      g.jobs.push(j);
      groups.set(key, g);
    }
  }

  const renderRow = (j: ActiveJob) => (
    <TableRow key={j.id} className="text-muted-foreground">
      <TableCell>
        <button
          type="button"
          onClick={() => onOpenOdf(j)}
          className="inline-flex items-center gap-1.5 group"
          title="Ver desglose de la ODT"
        >
          <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-primary font-mono">
            ODT
          </span>
          <span className="font-mono font-semibold text-foreground group-hover:underline">{j.odf}</span>
        </button>
      </TableCell>
      <TableCell className="text-xs">
        {j.po ? (
          <>
            <button
              type="button"
              onClick={() => onOpenPo(j.po!.id)}
              className="inline-flex items-center gap-1.5"
              title="Ver detalle de la PO"
            >
              <span className="rounded bg-[color:var(--status-mazak)]/15 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-[color:var(--status-mazak)] font-mono">
                PO
              </span>
              <span className="font-mono text-primary hover:underline">{j.po.po_number}</span>
            </button>
            <div>{j.po.customer_name ?? "—"}</div>
          </>
        ) : (
          "—"
        )}
      </TableCell>
      <TableCell className="text-xs">{j.machine_id ? mById[j.machine_id] ?? "—" : "—"}</TableCell>
      <TableCell className="text-right font-mono">{j.qty}</TableCell>
      <TableCell className="font-mono text-xs">{j.pir ?? "—"}</TableCell>
      <TableCell className="font-mono text-xs">{j.export_date ?? "—"}</TableCell>
      <TableCell className="font-mono text-xs">{j.customer_date ?? "—"}</TableCell>
      <TableCell>{renderOtdBadge(j)}</TableCell>
      <TableCell className="text-xs">
        <span className="inline-flex items-center gap-1 rounded bg-[color:var(--status-ok)]/15 px-1.5 py-0.5 text-[10px] uppercase text-[color:var(--status-ok)]">
          Enviado
        </span>
      </TableCell>
    </TableRow>
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Buscar ODT, PO, cliente o PIR…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="max-w-xs"
        />
        <Button
          variant={groupByPo ? "secondary" : "ghost"}
          size="sm"
          onClick={() => setGroupByPo((v) => !v)}
        >
          {groupByPo ? "Agrupado por PO" : "Lista plana"}
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {filtered.length} de {jobs.length} ODTs
        </span>
      </div>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ODT #</TableHead>
              <TableHead>PO # / Cliente</TableHead>
              <TableHead>Máquina</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>PIR</TableHead>
              <TableHead>Export</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>OTD</TableHead>
              <TableHead>Estado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-6">
                  Sin resultados.
                </TableCell>
              </TableRow>
            )}
            {groupByPo
              ? Array.from(groups.entries()).map(([key, g]) => (
                  <Fragment key={key}>
                    <TableRow className="bg-muted/30">
                      <TableCell colSpan={9} className="text-xs font-mono">
                        <span className="rounded bg-[color:var(--status-mazak)]/15 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-[color:var(--status-mazak)] mr-1.5">
                          PO
                        </span>
                        <span className="text-primary">{g.po_number}</span>
                        {g.customer && <span className="text-muted-foreground"> · {g.customer}</span>}
                        <span className="text-muted-foreground"> · {g.jobs.length} ODT{g.jobs.length === 1 ? "" : "s"}</span>
                      </TableCell>
                    </TableRow>
                    {g.jobs.map(renderRow)}
                  </Fragment>
                ))
              : filtered.map(renderRow)}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ActiveJobsTable({
  jobs,
  machines,
  onChange,
  onOpenPo,
  onOpenOdf,
}: {
  jobs: ActiveJob[];
  machines: { id: string; name: string }[];
  onChange: () => Promise<void>;
  onOpenPo: (poId: string) => void;
  onOpenOdf: (job: ActiveJob) => void;
}) {
  const advance = useServerFn(advanceJobStep);
  const hold = useServerFn(holdJob);
  const resume = useServerFn(resumeJob);
  const [delayFor, setDelayFor] = useState<ActiveJob | null>(null);
  const mById = Object.fromEntries(machines.map((m) => [m.id, m.name]));

  if (jobs.length === 0) {
    return (
      <div className="rounded-md border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">
        Sin ODTs activas. Creá una arriba para empezar.
      </div>
    );
  }

  const wrap = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      await onChange();
      toast.success(ok);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <>
      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>ODT #</TableHead>
              <TableHead>PO # / Cliente</TableHead>
              <TableHead>Máquina</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Pasos</TableHead>
              <TableHead>Export</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="w-[280px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {jobs.map((j) => {
              const onHold = j.status === "ON_HOLD";
              return (
                <TableRow key={j.id}>
                  <TableCell>
                    <button
                      type="button"
                      onClick={() => onOpenOdf(j)}
                      className="inline-flex items-center gap-1.5 group"
                      title="Ver desglose de la ODT"
                    >
                      <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-primary font-mono">
                        ODT
                      </span>
                      <span className="font-mono font-semibold group-hover:underline">{j.odf}</span>
                    </button>
                    {onHold && (
                      <span className="ml-2 inline-flex items-center gap-1 rounded bg-[color:var(--status-risk)]/15 px-1.5 py-0.5 text-[10px] uppercase text-[color:var(--status-risk)]">
                        <AlertTriangle className="h-3 w-3" /> on hold
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {j.po ? (
                      <>
                        <button
                          type="button"
                          onClick={() => onOpenPo(j.po!.id)}
                          className="inline-flex items-center gap-1.5"
                          title="Ver detalle de la PO"
                        >
                          <span className="rounded bg-[color:var(--status-mazak)]/15 px-1.5 py-0.5 text-[9px] uppercase tracking-widest text-[color:var(--status-mazak)] font-mono">
                            PO
                          </span>
                          <span className="font-mono text-primary hover:underline">{j.po.po_number}</span>
                        </button>
                        <div className="text-muted-foreground">{j.po.customer_name ?? "—"}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {j.machine_id ? mById[j.machine_id] ?? "—" : "—"}
                  </TableCell>
                  <TableCell className="text-right font-mono">{j.qty}</TableCell>
                  <TableCell>
                    <JobStepsTimeline steps={j.steps} />
                  </TableCell>
                  <TableCell className="font-mono text-xs">{j.export_date ?? "—"}</TableCell>
                  <TableCell className="font-mono text-xs">{j.customer_date ?? "—"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1 justify-end">
                      {!onHold && j.current_step && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            wrap(() => advance({ data: { job_id: j.id } }), `${j.odf} avanzada`)
                          }
                        >
                          <ChevronRight className="h-3 w-3 mr-1" /> Avanzar
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => setDelayFor(j)}>
                        Retraso
                      </Button>
                      {onHold ? (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            wrap(() => resume({ data: { job_id: j.id } }), `${j.odf} reanudada`)
                          }
                        >
                          <Play className="h-3 w-3 mr-1" /> Reanudar
                        </Button>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            wrap(
                              () => hold({ data: { job_id: j.id, reason: null } }),
                              `${j.odf} en hold`,
                            )
                          }
                        >
                          <Pause className="h-3 w-3 mr-1" /> Hold
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
      <DelayDialog job={delayFor} onClose={() => setDelayFor(null)} onDone={onChange} />
    </>
  );
}

function DelayDialog({
  job,
  onClose,
  onDone,
}: {
  job: ActiveJob | null;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const applyDelay = useServerFn(applyCascadingDelay);
  const [amount, setAmount] = useState(3);
  const [unit, setUnit] = useState<"hours" | "shifts" | "days">("days");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (!job || !job.current_step) return null;

  const submit = async () => {
    const hours = unit === "hours" ? amount : unit === "shifts" ? amount * 8 : amount * 24;
    setSubmitting(true);
    try {
      await applyDelay({
        data: {
          job_step_id: job.current_step!.id,
          delay_hours: hours,
          reason: reason.trim() || null,
        },
      });
      toast.success(`Retraso aplicado en cascada (${amount} ${unit})`);
      await onDone();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md bg-card">
        <DialogHeader>
          <DialogTitle>Reportar retraso — ODT {job.odf}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Paso actual: <span className="font-mono">{job.current_step.step_name}</span>. El
            retraso se propaga a todos los pasos siguientes.
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label>Cantidad</Label>
              <Input
                type="number"
                min={0.5}
                step={0.5}
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Unidad</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as typeof unit)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="shifts">Turnos</SelectItem>
                  <SelectItem value="days">Días</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Motivo</Label>
            <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={submitting}>
            {submitting ? "Aplicando…" : "Aplicar en cascada"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateOdfDialog({
  line,
  pending,
  machines,
  vendors,
  onClose,
  onDone,
}: {
  line: PoLineWithContext | null;
  pending: number;
  machines: { id: string; name: string }[];
  vendors: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const splitFn = useServerFn(splitPoLineIntoOdf);
  const [machineId, setMachineId] = useState<string | undefined>(undefined);
  const [vendorId, setVendorId] = useState<string | undefined>(undefined);
  const [shift, setShift] = useState<"manana" | "tarde" | "noche">("manana");
  const [submitting, setSubmitting] = useState(false);

  if (!line) return null;

  const today = new Date().toISOString().slice(0, 10);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = (k: string) => {
      const x = (fd.get(k) as string | null)?.trim();
      return x && x.length > 0 ? x : null;
    };
    const num = (k: string) => Number(fd.get(k));
    setSubmitting(true);
    try {
      const res = await splitFn({
        data: {
          po_line_item_id: line.id,
          odf: v("odf"),
          qty_parcial: num("qty_parcial") || pending,
          machine_id: machineId ?? null,
          vendor_id: vendorId ?? null,
          operator_name: v("operator_name"),
          start_date: v("start_date") ?? today,
          start_shift: shift,
          shifts_required: Number(fd.get("shifts_required")) || 1,
          export_date: v("export_date"),
          notes: v("notes"),
        },
      });
      toast.success(`ODT ${res.odf} creada · pendiente ${res.pending_remaining}`);
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!line} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl bg-card">
        <DialogHeader>
          <DialogTitle>
            Crear ODF — {line.purchase_order?.po_number} · L{line.line_number}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-1">
            <Label>ODF (vacío = auto nnn/yy)</Label>
            <Input name="odf" placeholder="auto" />
          </div>
          <div className="col-span-1">
            <Label>Qty parcial (pendiente: {pending})</Label>
            <Input
              name="qty_parcial"
              type="number"
              min={1}
              max={pending}
              required
              defaultValue={pending}
            />
          </div>
          <div className="col-span-1">
            <Label>Máquina MAZAK</Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="col-span-1">
            <Label>Vendor cementación</Label>
            <Select value={vendorId} onValueChange={setVendorId}>
              <SelectTrigger>
                <SelectValue placeholder="Reynosa / otro" />
              </SelectTrigger>
              <SelectContent>
                {vendors.map((vd) => (
                  <SelectItem key={vd.id} value={vd.id}>
                    {vd.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Operador</Label>
            <Input name="operator_name" placeholder="Nombre" />
          </div>
          <div>
            <Label>Fecha inicio</Label>
            <Input name="start_date" type="date" defaultValue={today} required />
          </div>
          <div>
            <Label>Turno inicio</Label>
            <Select value={shift} onValueChange={(v) => setShift(v as typeof shift)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manana">Mañana</SelectItem>
                <SelectItem value="tarde">Tarde</SelectItem>
                <SelectItem value="noche">Noche</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Turnos requeridos</Label>
            <Input
              name="shifts_required"
              type="number"
              min={0.5}
              step={0.5}
              defaultValue={1}
              required
            />
          </div>
          <div>
            <Label>Export MX→USA</Label>
            <Input name="export_date" type="date" />
          </div>
          <div className="col-span-2 text-xs text-muted-foreground">
            Cliente: <span className="font-mono">{line.committed_date ?? "—"}</span> · Export PO:{" "}
            <span className="font-mono">{line.export_date ?? "—"}</span>. Los pasos
            CEMENTACION/EXPO se crean en automático.
          </div>
          <div className="col-span-2">
            <Label>Notas</Label>
            <Textarea name="notes" rows={2} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creando…" : "Crear ODF"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}