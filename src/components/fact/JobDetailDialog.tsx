import { useMemo, useState } from "react";
import type { Job } from "@/lib/fact-types";
import { STATUS_LABEL, toHours, type DelayUnit } from "@/lib/fact-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useLogDelay, useJobs } from "@/hooks/useFactData";
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

interface Props {
  job: Job | null;
  onClose: () => void;
}

export function JobDetailDialog({ job, onClose }: Props) {
  const { data: jobs = [] } = useJobs();
  const logDelay = useLogDelay();
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState<DelayUnit>("days");
  const [reason, setReason] = useState("");

  const delayHours = toHours(amount, unit);

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
      await logDelay.mutateAsync({ jobId: job.id, delayHours, reason: reason.trim() });
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

  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl bg-card">
        <DialogHeader>
          <DialogTitle className="font-mono">
            ODF {job.odf} · {STATUS_LABEL[job.status]}
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
        </div>

        {job.notes && (
          <div className="mt-3 rounded border border-border bg-sidebar/30 p-2 text-xs text-muted-foreground">
            {job.notes}
          </div>
        )}

        <div className="mt-4 border-t border-border pt-4">
          <h3 className="text-sm font-semibold mb-1">Registrar retraso de producción</h3>
          <p className="text-[11px] text-muted-foreground mb-3">
            Motor determinístico · empuja este ODF y todos los trabajos posteriores en la misma máquina.
          </p>

          <div className="grid grid-cols-[1fr,140px] gap-2 mb-2">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Retraso</Label>
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
              ? "Registrando…"
              : `Registrar y reprogramar ${preview.length} ODF${preview.length > 1 ? "s" : ""}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
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