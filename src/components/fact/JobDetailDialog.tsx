import { useMemo, useState } from "react";
import type { Job } from "@/lib/fact-types";
import { STATUS_LABEL, toHours, type DelayUnit, type EventKind, EVENT_KIND_LABEL, EVENT_KIND_COLOR } from "@/lib/fact-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLogDelay, useJobs, useRescheduleJob } from "@/hooks/useFactData";
import { cascade } from "@/lib/scheduling/cascade";
import { toast } from "sonner";
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
import { JobHistorySheet } from "./JobHistorySheet";
import { History } from "lucide-react";
import { SHIFTS, shiftIndexFromDate, snapToShift } from "@/lib/shifts";
import { MachineRunsTable } from "./MachineRunsTable";
import { useMachineRuns } from "@/hooks/useMachineRuns";
import { runDurationHours } from "@/lib/machine-metrics";

interface Props {
  job: Job | null;
  onClose: () => void;
}

export function JobDetailDialog({ job, onClose }: Props) {
  const { data: jobs = [] } = useJobs();
  const { data: allRuns = [] } = useMachineRuns();
  const logDelay = useLogDelay();
  const reschedule = useRescheduleJob();
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState<DelayUnit>("days");
  const [reason, setReason] = useState("");
  const [eventKind, setEventKind] = useState<EventKind>("delay");
  const [historyOpen, setHistoryOpen] = useState(false);

  const delayHours = toHours(amount, unit);

  const jobRuns = useMemo(
    () => (job ? allRuns.filter((r) => r.job_id === job.id) : []),
    [allRuns, job],
  );
  const realHoursAcum = jobRuns.reduce((acc, r) => acc + (r.ended_at ? runDurationHours(r) : 0), 0);

  const preview = useMemo(() => {
    if (!job) return [];
    return cascade({ jobs, delayedJobId: job.id, delayHours });
  }, [job, jobs, delayHours]);

  const onSubmit = async () => {
    if (!job) return;
    if (!reason.trim()) {
      toast.error("Indica el motivo del retraso");
      return;
    }
    if (preview.length === 0) {
      toast.error("El ODF no tiene fecha planificada — no hay nada que reprogramar");
      return;
    }
    try {
      await logDelay.mutateAsync({ jobId: job.id, delayHours, reason: reason.trim(), eventKind });
      toast.success(
        `Retraso registrado · ${preview.length} ODF${preview.length > 1 ? "s" : ""} reprogramado${preview.length > 1 ? "s" : ""}`,
      );
      setReason("");
      onClose();
    } catch (e) {
      toast.error("Error: " + (e instanceof Error ? e.message : "desconocido"));
    }
  };

  if (!job) return null;

  const moveToShift = async (targetShiftIdx: number, dayDelta = 0) => {
    if (!job.planned_start || !job.planned_end) {
      toast.error("El ODF no tiene fecha planificada — no se puede mover a un turno");
      return;
    }
    const oldStart = new Date(job.planned_start);
    const durMs = new Date(job.planned_end).getTime() - oldStart.getTime();
    const baseDay = new Date(oldStart);
    baseDay.setDate(baseDay.getDate() + dayDelta);
    const newStart = snapToShift(baseDay, targetShiftIdx);
    const newEnd = new Date(newStart.getTime() + durMs);
    await reschedule.mutateAsync({
      id: job.id,
      planned_start: newStart.toISOString(),
      planned_end: newEnd.toISOString(),
    });
  };

  const currentShiftIdx = job.planned_start ? shiftIndexFromDate(job.planned_start) : null;

  return (
    <>
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl bg-card">
        <DialogHeader>
          <DialogTitle className="font-mono flex items-center justify-between">
            <span>ODF {job.odf} · {STATUS_LABEL[job.status]}</span>
            <Button variant="ghost" size="sm" className="h-7 gap-1.5" onClick={() => setHistoryOpen(true)}>
              <History className="h-3.5 w-3.5" />
              <span className="text-xs">Historial</span>
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 text-sm">
          <Field label="PIR" value={job.pir} />
          <Field label="Tubo" value={job.tube_spec} />
          <Field label="PO MUSA" value={job.po_musa} />
          <Field label="PO Halliburton" value={job.po_halliburton} />
          <Field label="Cantidad" value={String(job.qty)} />
          <Field label="Prioridad" value={job.priority} />
          <Field label="Fecha exportación" value={job.export_date} />
          <Field label="Fecha cliente" value={job.customer_date} />
          <Field label="Operador" value={job.operator_name} />
        </div>

        {job.planned_start && (() => {
          const s = SHIFTS[shiftIndexFromDate(job.planned_start)];
          const d = new Date(job.planned_start);
          return (
            <div className="mt-3 flex items-center gap-2 rounded border border-border bg-sidebar/30 px-2.5 py-1.5 text-xs">
              <span
                className="inline-flex h-5 w-5 items-center justify-center rounded text-[11px] font-bold text-white"
                style={{ backgroundColor: s.color }}
              >
                {s.label}
              </span>
              <span className="font-medium">Turno {s.name}</span>
              <span className="text-muted-foreground font-mono">
                {String(s.startHour).padStart(2, "0")}:00–{String((s.startHour + s.hours) % 24).padStart(2, "0")}:00 ·
                inicio {d.toLocaleString("es", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          );
        })()}

        {job.notes && (
          <div className="mt-3 rounded border border-border bg-sidebar/30 p-2 text-xs text-muted-foreground">
            {job.notes}
          </div>
        )}

        <div className="mt-4">
          <div className="flex items-baseline justify-between mb-1.5">
            <h3 className="text-sm font-semibold">Producción real</h3>
            <span className="text-[10px] font-mono text-muted-foreground">
              {realHoursAcum.toFixed(1)}h reales
              {job.hours_override !== null && ` · ${job.hours_override}h planificadas`}
            </span>
          </div>
          <MachineRunsTable runs={jobRuns} jobs={jobs} fixedJob={job} />
        </div>

        {job.planned_start && (
          <div className="mt-4 rounded border border-border bg-sidebar/20 p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-semibold">Cambiar turno</h3>
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                mismo día · 1 click
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2"
                onClick={() => currentShiftIdx !== null && moveToShift(currentShiftIdx, -1)}
                disabled={reschedule.isPending}
                title="Día anterior, mismo turno"
              >
                ← Día
              </Button>
              <div className="flex-1 grid grid-cols-3 gap-1.5">
                {SHIFTS.map((s, sIdx) => {
                  const active = currentShiftIdx === sIdx;
                  return (
                    <button
                      key={s.key}
                      onClick={() => moveToShift(sIdx)}
                      disabled={reschedule.isPending || active}
                      className={`flex flex-col items-center gap-0.5 rounded-md px-2 py-2 text-xs font-semibold transition-all ${
                        active ? "text-white shadow-md" : "text-foreground hover:scale-[1.02]"
                      } disabled:cursor-default`}
                      style={{
                        backgroundColor: active ? s.color : s.tint,
                        boxShadow: active ? `0 0 0 2px ${s.color}` : `inset 0 0 0 1px ${s.color}40`,
                      }}
                      title={`Mover a turno ${s.name}`}
                    >
                      <span className="text-base leading-none">{s.label}</span>
                      <span className="text-[10px] opacity-90 font-mono">
                        {String(s.startHour).padStart(2, "0")}:00
                      </span>
                      <span className="text-[9px] opacity-80">{s.name}</span>
                    </button>
                  );
                })}
              </div>
              <Button
                variant="ghost"
                size="sm"
                className="h-9 px-2"
                onClick={() => currentShiftIdx !== null && moveToShift(currentShiftIdx, 1)}
                disabled={reschedule.isPending}
                title="Día siguiente, mismo turno"
              >
                Día →
              </Button>
            </div>
          </div>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-sm font-semibold mb-1">Reprogramar ODF</h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Empuja este ODF + todos los siguientes en la misma máquina. Horas negativas = adelantar.
          </p>

          <div className="grid grid-cols-[1fr,1fr] gap-2 mb-2">
            <div className="col-span-2">
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Categoría</Label>
              <Select value={eventKind} onValueChange={(v) => setEventKind(v as EventKind)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["delay","priority_shift","absence","change_order","breakdown"] as EventKind[]).map((k) => (
                    <SelectItem key={k} value={k}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EVENT_KIND_COLOR[k] }} />
                        {EVENT_KIND_LABEL[k]}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Shift (+/−)</Label>
              <Input
                type="number"
                step="0.5"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Unidad</Label>
              <Select value={unit} onValueChange={(v) => setUnit(v as DelayUnit)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">Horas</SelectItem>
                  <SelectItem value="shifts">Turnos (8h)</SelectItem>
                  <SelectItem value="days">Días</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-3">
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Motivo</Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="ej. se rompió herramienta en MAZAK 2"
              rows={2}
              className="resize-none"
            />
          </div>

          {preview.length > 0 ? (
            <div className="rounded border border-border mb-3">
              <div className="bg-sidebar/30 px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                Reprogramación prevista · {preview.length} ODF{preview.length > 1 ? "s" : ""}
              </div>
              <div className="divide-y divide-border max-h-48 overflow-auto">
                {preview.map((c) => (
                  <div key={c.job_id} className="grid grid-cols-[80px,1fr,1fr] items-center gap-2 px-2 py-1.5 text-[11px] font-mono">
                    <span className="font-semibold">ODF {c.odf}</span>
                    <span className="text-muted-foreground line-through">
                      {c.old_end ? new Date(c.old_end).toLocaleString("es", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "—"}
                    </span>
                    <span className="text-[color:var(--status-risk)]">
                      → {new Date(c.new_end).toLocaleString("es", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground mb-3">Sin reprogramación posible — este ODF no tiene fecha planificada.</p>
          )}

          <Button
            onClick={onSubmit}
            disabled={logDelay.isPending || preview.length === 0 || !reason.trim()}
            className="w-full"
          >
            {logDelay.isPending
              ? "Aplicando…"
              : `Aplicar y reprogramar ${preview.length} ODF${preview.length > 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
    <JobHistorySheet
      jobId={job.id}
      odf={job.odf}
      open={historyOpen}
      onClose={() => setHistoryOpen(false)}
    />
    </>
  );
}

function Field({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="font-mono text-sm">{value ?? "—"}</div>
    </div>
  );
}