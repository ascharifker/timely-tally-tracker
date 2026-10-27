import type { Job, Machine, JobStatus } from "@/lib/fact-types";
import { useApplyReschedules, useUpdateJobStatus, usePartTimes } from "@/hooks/useFactData";
import { useMachineRuns } from "@/hooks/useMachineRuns";
import { useState } from "react";
import { Maximize2, AlertTriangle, Factory } from "lucide-react";
import { toast } from "sonner";
import { getUrgency } from "@/lib/job-urgency";
import { jobDurationHours } from "@/lib/scheduling/duration";
import { productionColumns, belongsToColumn, planBoardAssignment, type BoardColumn } from "@/lib/production-board";
import type { InsertionMove } from "@/lib/scheduling/insertion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ProductionColumnDialog } from "./ProductionColumnDialog";
import { ShippedDateDialog } from "./ShippedDateDialog";

const ACCENTS: Partial<Record<JobStatus, string>> = {
  MAZAK: "border-t-[color:var(--status-mazak)]", TALLER_EXTERNO: "border-t-[color:var(--status-taller)]",
  MAQUINADO_LISTO: "border-t-[color:var(--status-listo)]", CEMENTACION: "border-t-[color:var(--status-cementacion)]",
  EXPO: "border-t-[color:var(--status-expo)]", YA_SE_ENVIO: "border-t-[color:var(--status-enviado)]",
};
const hours = (value: number) => `${value.toLocaleString("es", { maximumFractionDigits: 1 })} h`;
const dateTime = (value: string | null) => value ? new Date(value).toLocaleString("es", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "Sin programar";

export function StatusBoard({ jobs, machines = [], onJobClick }: { jobs: Job[]; machines?: Machine[]; onJobClick?: (job: Job) => void }) {
  const update = useUpdateJobStatus();
  const apply = useApplyReschedules();
  const { data: partTimes = [] } = usePartTimes();
  const { data: runs = [] } = useMachineRuns();
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [shipJob, setShipJob] = useState<Job | null>(null);
  const [proposal, setProposal] = useState<{ column: BoardColumn; moves: InsertionMove[] } | null>(null);
  const [selectedMachines, setSelectedMachines] = useState<Set<string>>(new Set());
  const columns = productionColumns(machines, jobs);
  const activeRunIds = new Set(runs.filter((r) => !r.ended_at).map((r) => r.job_id));
  const visible = (j: Job) => !selectedMachines.size || !!j.machine_id && selectedMachines.has(j.machine_id);
  const expandedColumn = columns.find((c) => c.id === expanded) ?? null;
  const busy = update.isPending || apply.isPending;

  const drop = (id: string, column: BoardColumn) => {
    const job = jobs.find((j) => j.id === id);
    if (!job || busy || belongsToColumn(job, column, machines)) return;
    if (column.status === "YA_SE_ENVIO") { setShipJob(job); return; }
    if (column.machine) {
      try { setProposal({ column, moves: planBoardAssignment(jobs, job, column.machine, partTimes, Date.now()) }); }
      catch (error) { toast.error(error instanceof Error ? error.message : "No se pudo asignar la máquina"); }
      return;
    }
    if (column.unassigned) return;
    update.mutate({ id, status: column.status });
  };

  return <section className="min-w-0 border-t border-border pt-4">
    <div className="mb-3 flex items-baseline justify-between gap-3"><h2 className="font-semibold">Flujo de Producción</h2><span className="text-xs text-muted-foreground">{jobs.length} ODTs</span></div>
    <div className="mb-3 flex items-center gap-1.5 flex-wrap">
      <Button size="sm" variant={!selectedMachines.size ? "secondary" : "ghost"} onClick={() => setSelectedMachines(new Set())}>Todas</Button>
      {machines.map((m) => <Button key={m.id} size="sm" variant={selectedMachines.has(m.id) ? "secondary" : "ghost"} aria-pressed={selectedMachines.has(m.id)} onClick={() => setSelectedMachines((prev) => { const next = new Set(prev); if (next.has(m.id)) next.delete(m.id); else next.add(m.id); return next; })}>{m.name}</Button>)}
    </div>
    <div className="flex gap-3 overflow-x-auto pb-4 items-stretch" aria-label="Columnas de producción">
      {columns.map((column) => {
        const cards = jobs.filter((j) => belongsToColumn(j, column, machines));
        const shown = cards.filter(visible);
        return <div key={column.id} data-column={column.label} className={`w-60 shrink-0 min-h-64 border border-t-2 rounded-md flex flex-col ${ACCENTS[column.status] ?? "border-t-muted-foreground"} ${dragOver === column.id ? "bg-primary/10 ring-2 ring-primary" : "bg-sidebar/30"}`}
          onDragOver={(e) => { if (busy || column.unassigned) return; e.preventDefault(); setDragOver(column.id); }}
          onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDragOver(null); }}
          onDrop={(e) => { e.preventDefault(); const id = e.dataTransfer.getData("text/plain") || dragId; setDragOver(null); setDragId(null); if (id) drop(id, column); }}>
          <Button variant="ghost" className="h-auto w-full rounded-none border-b border-border p-3 justify-between gap-2 whitespace-normal text-left" aria-label={`Expandir ${column.label}`} title={`Expandir ${column.label}`} onClick={() => setExpanded(column.id)}>
            <span className="min-w-0"><span className="block font-semibold break-words">{column.label}</span><span className="block text-xs text-muted-foreground font-normal mt-1">{shown.length} ODTs · {hours(shown.reduce((sum, j) => sum + jobDurationHours(j, partTimes).hours, 0))}</span></span><Maximize2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          </Button>
          <div className="space-y-2 p-2 flex-1">
            {!shown.length && <p className="py-8 text-center text-xs text-muted-foreground">{cards.length ? "Sin ODTs para este filtro" : "Sin ODTs"}</p>}
            {shown.map((j) => {
              const external = column.status === "TALLER_EXTERNO";
              const shop = machines.find((m) => m.id === j.machine_id && m.type === "external_shop");
              return <div key={j.id} draggable={!busy} onDragStart={(e) => { e.dataTransfer.setData("text/plain", j.id); setDragId(j.id); }} onDragEnd={() => { setDragId(null); setDragOver(null); }} className={`rounded border border-border bg-card p-2 space-y-2 ${dragId === j.id ? "opacity-40" : ""}`}>
                <Button variant="link" className="p-0 h-auto text-foreground font-mono" onClick={() => onJobClick?.(j)}>ODT {j.odf}</Button>
                <div className="text-xs text-muted-foreground break-words">PIR {j.pir ?? "—"} · Tubo {j.tube_spec ?? "—"}</div>
                <div className="text-xs flex justify-between gap-2"><span>{j.qty} piezas</span><span>{hours(jobDurationHours(j, partTimes).hours)}</span></div>
                {external && <div className={`flex gap-1.5 items-start text-xs rounded p-1.5 ${shop ? "bg-secondary text-secondary-foreground" : "bg-destructive/10 text-destructive"}`}>{shop ? <Factory className="h-3.5 w-3.5 shrink-0" /> : <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}<span className="break-words">{shop ? `Taller: ${shop.name}` : "Sin taller asignado"}</span></div>}
                <div className="text-[11px] text-muted-foreground">Cliente: {j.customer_date ?? "—"}</div>
                {(getUrgency(j) || activeRunIds.has(j.id)) && <div className="text-[11px] text-primary">{getUrgency(j)?.label}{activeRunIds.has(j.id) && " · Corrida en curso"}</div>}
              </div>;
            })}
          </div>
        </div>;
      })}
    </div>
    <ProductionColumnDialog key={expanded ?? "closed"} column={expandedColumn} jobs={jobs.filter((j) => expandedColumn && belongsToColumn(j, expandedColumn, machines) && visible(j))} machines={machines} partTimes={partTimes} activeRunIds={activeRunIds} onClose={() => setExpanded(null)} onJobClick={onJobClick} />
    <ShippedDateDialog job={shipJob} onClose={() => setShipJob(null)} />
    <Dialog open={!!proposal} onOpenChange={(open) => { if (!open && !apply.isPending) setProposal(null); }}>
      <DialogContent className="max-w-2xl max-h-[85dvh] overflow-auto">
        <DialogHeader><DialogTitle>Asignar a {proposal?.column.label}</DialogTitle><DialogDescription>{proposal && proposal.moves.length > 1 ? `Se reprogramarán ${proposal.moves.length - 1} ODTs siguientes.` : "Confirmar máquina y horario de producción."}</DialogDescription></DialogHeader>
        <div className="divide-y divide-border">{proposal?.moves.map((move) => { const original = jobs.find((j) => j.id === move.jobId); return <div key={move.jobId} className="py-3 space-y-1"><div className="font-mono font-semibold">ODT {move.odf}</div><div className="text-xs text-muted-foreground">{dateTime(original?.planned_start ?? null)} → {dateTime(original?.planned_end ?? null)}</div><div className="text-sm">{dateTime(move.planned_start)} → {dateTime(move.planned_end)}</div></div>; })}</div>
        <DialogFooter><Button variant="ghost" disabled={apply.isPending} onClick={() => setProposal(null)}>Cancelar</Button><Button disabled={apply.isPending} onClick={async () => { if (!proposal) return; try { await apply.mutateAsync({ moves: proposal.moves.map((move, i) => ({ ...move, eventKind: "change_order", ...(i === 0 ? { status: proposal.column.status } : {}) })), reason: `Asignación desde Flujo de Producción a ${proposal.column.label}` }); setProposal(null); } catch { /* Mutation reports errors; retain the preview. */ } }}>{apply.isPending ? "Guardando…" : "Aprobar movimientos"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  </section>;
}
