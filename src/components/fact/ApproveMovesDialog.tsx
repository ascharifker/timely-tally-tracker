import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useState } from "react";
import { X } from "lucide-react";
import type { EventKind, Machine } from "@/lib/fact-types";
import { EVENT_KIND_LABEL, EVENT_KIND_COLOR } from "@/lib/fact-types";
import { useApplyReschedules } from "@/hooks/useFactData";

export interface PendingMove {
  jobId: string;
  odf: string;
  planned_start: string;
  planned_end: string;
  machine_id: string;
  original_start: string | null;
  original_end: string | null;
  original_machine_id: string | null;
  eventKind: EventKind;
}

interface Props {
  open: boolean;
  onClose: () => void;
  moves: PendingMove[];
  machines: Machine[];
  onApplied: () => void;
  onUpdateKind: (jobId: string, kind: EventKind) => void;
  onRemove: (jobId: string) => void;
}

const KINDS: EventKind[] = ["delay", "priority_shift", "absence", "change_order", "breakdown"];

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ApproveMovesDialog({
  open,
  onClose,
  moves,
  machines,
  onApplied,
  onUpdateKind,
  onRemove,
}: Props) {
  const apply = useApplyReschedules();
  const [reason, setReason] = useState("");
  const machineName = (id: string | null) =>
    machines.find((m) => m.id === id)?.name ?? "—";

  const onConfirm = async () => {
    await apply.mutateAsync({
      reason: reason.trim(),
      moves: moves.map((m) => ({
        jobId: m.jobId,
        planned_start: m.planned_start,
        planned_end: m.planned_end,
        machine_id: m.machine_id,
        eventKind: m.eventKind,
      })),
    });
    setReason("");
    onApplied();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl bg-card">
        <DialogHeader>
          <DialogTitle>Aprobar reprogramación</DialogTitle>
        </DialogHeader>

        <p className="text-xs text-muted-foreground">
          Asigná una categoría a cada movimiento. La cascada empuja a los ODFs siguientes en la misma máquina.
        </p>

        <div className="rounded border border-border divide-y divide-border max-h-[50vh] overflow-auto">
          {moves.map((m) => {
            const movedMachine = m.machine_id !== m.original_machine_id;
            return (
              <div key={m.jobId} className="grid grid-cols-[1fr,160px,28px] items-center gap-3 px-3 py-2">
                <div>
                  <div className="font-mono text-sm font-semibold">ODF {m.odf}</div>
                  <div className="text-[11px] text-muted-foreground font-mono">
                    {fmt(m.original_start)} → {fmt(m.original_end)}
                  </div>
                  <div className="text-[11px] font-mono text-amber-600 dark:text-amber-400">
                    → {fmt(m.planned_start)} → {fmt(m.planned_end)}
                  </div>
                  {movedMachine && (
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground mt-0.5">
                      Máquina: {machineName(m.original_machine_id)} → <span className="text-foreground">{machineName(m.machine_id)}</span>
                    </div>
                  )}
                </div>
                <Select value={m.eventKind} onValueChange={(v) => onUpdateKind(m.jobId, v as EventKind)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {KINDS.map((k) => (
                      <SelectItem key={k} value={k}>
                        <span className="inline-flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: EVENT_KIND_COLOR[k] }} />
                          {EVENT_KIND_LABEL[k]}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => onRemove(m.jobId)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>

        <div>
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Motivo (opcional)</Label>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="ej. ausencia operario turno tarde · prioridad PIR-456"
            rows={2}
            className="resize-none"
          />
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={onConfirm} disabled={apply.isPending || moves.length === 0}>
            {apply.isPending ? "Aplicando…" : `Aplicar ${moves.length} movimiento${moves.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}