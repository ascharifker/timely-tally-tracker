import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateMaintenanceEvent } from "@/hooks/useMachineEvents";

interface Props {
  machineId: string;
  onDone?: () => void;
}

export function MaintenanceEventForm({ machineId, onDone }: Props) {
  const create = useCreateMaintenanceEvent();
  const today = new Date().toISOString().slice(0, 16);
  const [kind, setKind] = useState<"maintenance_preventive" | "maintenance_corrective">("maintenance_preventive");
  const [started, setStarted] = useState(today);
  const [ended, setEnded] = useState(today);
  const [cost, setCost] = useState("");
  const [reason, setReason] = useState("");

  const submit = async () => {
    if (!reason.trim()) return;
    await create.mutateAsync({
      machine_id: machineId,
      kind,
      started_at: new Date(started).toISOString(),
      ended_at: ended ? new Date(ended).toISOString() : null,
      cost: cost ? Number(cost) : null,
      reason: reason.trim(),
    });
    setReason("");
    setCost("");
    onDone?.();
  };

  return (
    <div className="space-y-2 rounded border border-border bg-sidebar/20 p-3">
      <div className="grid grid-cols-2 gap-2">
        <div className="col-span-2">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Tipo</Label>
          <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="maintenance_preventive">Mantenimiento preventivo</SelectItem>
              <SelectItem value="maintenance_corrective">Mantenimiento correctivo</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Inicio</Label>
          <Input type="datetime-local" value={started} onChange={(e) => setStarted(e.target.value)} />
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Fin (opcional)</Label>
          <Input type="datetime-local" value={ended} onChange={(e) => setEnded(e.target.value)} />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Costo (opcional)</Label>
          <Input type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} placeholder="0" />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Descripción</Label>
          <Textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="ej. cambio de filtro, reemplazo de husillo" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {onDone && <Button variant="ghost" size="sm" onClick={onDone}>Cancelar</Button>}
        <Button size="sm" onClick={submit} disabled={create.isPending || !reason.trim()}>
          {create.isPending ? "Guardando…" : "Registrar mantenimiento"}
        </Button>
      </div>
    </div>
  );
}