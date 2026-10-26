import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import type { PendingMove } from "./ApproveMovesDialog";

const fmt = (value: string | null) => value
  ? new Date(value).toLocaleString("es", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })
  : "Sin programar";

export function CascadePreviewDialog({ moves, machineName, onClose, onStage }: {
  moves: PendingMove[] | null;
  machineName: string;
  onClose: () => void;
  onStage: () => void;
}) {
  return (
    <Dialog open={moves !== null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-auto bg-card">
        <DialogHeader>
          <DialogTitle>Reprogramar ODTs en {machineName}</DialogTitle>
          <DialogDescription>
            ODT {moves?.[0]?.odf} ocuparía este horario. Se deben reprogramar {Math.max(0, (moves?.length ?? 1) - 1)} ODTs siguientes.
          </DialogDescription>
        </DialogHeader>
        <div className="divide-y divide-border border-y border-border">
          {moves?.map((move, index) => (
            <div key={move.jobId} className="py-3 space-y-1">
              <div className="font-mono text-sm font-semibold">ODT {move.odf} <span className="font-sans font-normal text-muted-foreground">· {index === 0 ? "Movimiento solicitado" : "Reprogramación"}</span></div>
              <div className="text-xs text-muted-foreground">{fmt(move.original_start)} → {fmt(move.original_end)}</div>
              <div className="text-xs font-medium">{fmt(move.planned_start)} → {fmt(move.planned_end)}</div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={onStage}>Previsualizar {moves?.length ?? 0} movimientos</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}