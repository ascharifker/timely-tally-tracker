import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { Job } from "@/lib/fact-types";
import { useUpdateJobStatus } from "@/hooks/useFactData";

function todayISO() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface Props {
  job: Job | null;
  onClose: () => void;
}

export function ShippedDateDialog({ job, onClose }: Props) {
  const update = useUpdateJobStatus();
  const [date, setDate] = useState<string>(todayISO());

  useEffect(() => {
    if (job) setDate(job.export_date ?? todayISO());
  }, [job?.id]);

  if (!job) return null;

  const onConfirm = async () => {
    if (!date) return;
    await update.mutateAsync({ id: job.id, status: "YA_SE_ENVIO", export_date: date });
    onClose();
  };

  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm bg-card">
        <DialogHeader>
          <DialogTitle className="font-mono">ODT {job.odf} · Marcar como enviada</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Fecha de envío
          </Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            autoFocus
          />
          <p className="text-[11px] text-muted-foreground">
            Se registrará en la ficha de la ODT como fecha de exportación.
          </p>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={update.isPending}>
            Cancelar
          </Button>
          <Button onClick={onConfirm} disabled={update.isPending || !date}>
            {update.isPending ? "Guardando…" : "Confirmar envío"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}