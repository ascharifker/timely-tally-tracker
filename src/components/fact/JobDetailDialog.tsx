import { useMemo, useState } from "react";
import type { Job } from "@/lib/fact-types";
import { STATUS_LABEL } from "@/lib/fact-types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useApplyCascade, useJobs } from "@/hooks/useFactData";
import { cascade } from "@/lib/scheduling/cascade";
import { downstreamImpact } from "@/lib/scheduling/impact";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  job: Job | null;
  onClose: () => void;
}

export function JobDetailDialog({ job, onClose }: Props) {
  const { data: jobs = [] } = useJobs();
  const apply = useApplyCascade();
  const [delay, setDelay] = useState(4);

  const preview = useMemo(() => {
    if (!job) return [];
    return cascade({ jobs, delayedJobId: job.id, delayHours: delay });
  }, [job, jobs, delay]);

  const impacted = useMemo(() => {
    if (!job) return [];
    return downstreamImpact(jobs, job.id, delay);
  }, [job, jobs, delay]);

  const onApply = async () => {
    if (!job || preview.length === 0) return;
    try {
      await apply.mutateAsync(preview);
      toast.success(`Cascada aplicada · ${preview.length} trabajos reprogramados`);
      onClose();
    } catch (e) {
      toast.error("Error: " + (e instanceof Error ? e.message : "unknown"));
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
          <h3 className="text-sm font-semibold mb-2">Simulador de cascada</h3>
          <p className="text-[11px] text-muted-foreground mb-2">
            Motor determinístico. Calcula el impacto aguas abajo en la misma máquina.
          </p>
          <div className="flex items-end gap-2 mb-3">
            <div className="flex-1">
              <Label>Retraso (horas)</Label>
              <Input type="number" value={delay} onChange={(e) => setDelay(Number(e.target.value))} />
            </div>
            <Button onClick={onApply} disabled={apply.isPending || preview.length === 0}>
              {apply.isPending ? "Aplicando…" : `Aplicar a ${preview.length} trabajos`}
            </Button>
          </div>

          {impacted.length > 0 ? (
            <div className="rounded border border-border">
              <div className="bg-sidebar/30 px-2 py-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
                Trabajos aguas abajo afectados
              </div>
              <div className="divide-y divide-border">
                {impacted.map((i) => (
                  <div key={i.job.id} className="flex items-center justify-between px-2 py-1.5 text-xs font-mono">
                    <span>ODF {i.job.odf}</span>
                    <span className="text-muted-foreground">{i.job.tube_spec}</span>
                    <span className="text-[color:var(--status-risk)]">+{i.delay_hours}h</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Sin trabajos aguas abajo en esta máquina.</p>
          )}
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