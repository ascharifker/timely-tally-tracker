import { useState } from "react";
import { Play, Square } from "lucide-react";
import type { Job, MachineRun } from "@/lib/fact-types";
import { useStartRun, useStopRun } from "@/hooks/useMachineRuns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface Props {
  job: Job;
  openRun: MachineRun | null;
}

/** Compact run-control button to drop inside a Kanban card. */
export function StartStopRunButton({ job, openRun }: Props) {
  const start = useStartRun();
  const stop = useStopRun();
  const [stopOpen, setStopOpen] = useState(false);
  const [pieces, setPieces] = useState(String(job.qty));
  const [notes, setNotes] = useState("");

  if (openRun) {
    return (
      <>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            e.preventDefault();
            setStopOpen(true);
          }}
          className="inline-flex items-center gap-1 rounded border border-[color:var(--status-risk)] bg-[color:var(--status-risk)]/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-[color:var(--status-risk)] hover:bg-[color:var(--status-risk)]/30 transition-colors"
          title="Cerrar corrida en curso"
        >
          <Square className="h-2.5 w-2.5 fill-current" />
          Cerrar
        </button>
        <Dialog open={stopOpen} onOpenChange={setStopOpen}>
          <DialogContent onClick={(e) => e.stopPropagation()}>
            <DialogHeader>
              <DialogTitle>Cerrar corrida · ODF {job.odf}</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Piezas completadas
                </Label>
                <Input
                  type="number"
                  min="0"
                  value={pieces}
                  onChange={(e) => setPieces(e.target.value)}
                />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Notas (opcional)
                </Label>
                <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setStopOpen(false)}>
                Cancelar
              </Button>
              <Button
                disabled={stop.isPending}
                onClick={async () => {
                  await stop.mutateAsync({
                    id: openRun.id,
                    pieces_completed: Number(pieces) || 0,
                    notes: notes || null,
                  });
                  setStopOpen(false);
                  setNotes("");
                }}
              >
                {stop.isPending ? "Cerrando…" : "Cerrar corrida"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  if (!job.machine_id) return null;
  return (
    <button
      type="button"
      disabled={start.isPending}
      onClick={(e) => {
        e.stopPropagation();
        e.preventDefault();
        start.mutate({ job_id: job.id, machine_id: job.machine_id! });
      }}
      className="inline-flex items-center gap-1 rounded border border-emerald-500/60 bg-emerald-500/15 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-emerald-400 hover:bg-emerald-500/30 transition-colors disabled:opacity-50"
      title="Iniciar corrida real"
    >
      <Play className="h-2.5 w-2.5 fill-current" />
      Iniciar
    </button>
  );
}