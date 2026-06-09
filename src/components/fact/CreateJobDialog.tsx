import { useState } from "react";
import { useCreateJob, useMachines } from "@/hooks/useFactData";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import type { JobPriority } from "@/lib/fact-types";
import { scheduleJob } from "@/lib/scheduling/schedule";

// v1 = pure ODT. ODF parent layer deferred; future bridge = PO line item → ODT.
export function CreateJobDialog() {
  const [open, setOpen] = useState(false);
  const [machineId, setMachineId] = useState<string | undefined>(undefined);
  const [priority, setPriority] = useState<JobPriority>("normal");
  const [hoursPerPiece, setHoursPerPiece] = useState<string>("");
  const { data: machines = [] } = useMachines();
  const create = useCreateJob();

  const selectedMachine = machines.find((m) => m.id === machineId);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => {
      const v = (fd.get(k) as string | null)?.trim();
      return v && v.length > 0 ? v : null;
    };
    try {
      const qtyNum = Number(get("qty") ?? 1) || 1;
      const hppNum = Number(hoursPerPiece);
      const hasHpp = Number.isFinite(hppNum) && hppNum > 0;
      const hours_override = hasHpp ? hppNum * qtyNum : null;
      let planned_start: string | null = null;
      let planned_end: string | null = null;
      if (hasHpp && selectedMachine) {
        const span = scheduleJob(Date.now(), hours_override!, selectedMachine);
        planned_start = span.planned_start;
        planned_end = span.planned_end;
      }
      await create.mutateAsync({
        odf: get("odf") ?? "",
        po_musa: get("po_musa"),
        po_halliburton: get("po_halliburton"),
        pir: get("pir"),
        tube_spec: get("tube_spec"),
        qty: qtyNum,
        machine_id: machineId ?? null,
        priority,
        export_date: get("export_date"),
        customer_date: get("customer_date"),
        notes: get("notes"),
        operator_name: get("operator_name"),
        hours_override,
        planned_start,
        planned_end,
      });
      toast.success("ODT creado");
      setOpen(false);
      setHoursPerPiece("");
    } catch (err) {
      toast.error("Error: " + (err instanceof Error ? err.message : "unknown"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-1 h-4 w-4" /> Nuevo ODT
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl bg-card">
        <DialogHeader>
          <DialogTitle>Crear ODT</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-1">
            <Label>ODT *</Label>
            <Input name="odf" required placeholder="123/26" />
          </div>
          <div className="col-span-1">
            <Label>Cantidad</Label>
            <Input name="qty" type="number" defaultValue={1} min={1} />
          </div>
          <div className="col-span-2">
            <Label>Tiempo de maquinado por pieza (horas)</Label>
            <Input
              type="number"
              min={0.1}
              step={0.1}
              value={hoursPerPiece}
              onChange={(e) => setHoursPerPiece(e.target.value)}
              placeholder="ej: 2.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Total = horas/pieza × cantidad. El calendario reparte ese total sobre los turnos disponibles de la máquina.
            </p>
          </div>
          <div>
            <Label>PO MUSA</Label>
            <Input name="po_musa" />
          </div>
          <div>
            <Label>PO Halliburton</Label>
            <Input name="po_halliburton" />
          </div>
          <div>
            <Label>PIR</Label>
            <Input name="pir" placeholder="PIR-A12" />
          </div>
          <div>
            <Label>Especificación de tubo</Label>
            <Input name="tube_spec" placeholder='2-7/8" L80' />
          </div>
          <div className="col-span-2">
            <Label>Operador asignado</Label>
            <Input name="operator_name" placeholder="Nombre del operador (ej: Juan Pérez)" />
          </div>
          <div>
            <Label>Máquina</Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Prioridad</Label>
            <Select value={priority} onValueChange={(v) => setPriority(v as JobPriority)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Baja</SelectItem>
                <SelectItem value="normal">Normal</SelectItem>
                <SelectItem value="high">Alta</SelectItem>
                <SelectItem value="urgent">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Fecha exportación</Label>
            <Input name="export_date" type="date" />
          </div>
          <div>
            <Label>Fecha cliente</Label>
            <Input name="customer_date" type="date" />
          </div>
          <div className="col-span-2">
            <Label>Notas</Label>
            <Textarea name="notes" rows={2} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="submit" disabled={create.isPending}>
              {create.isPending ? "Creando…" : "Crear ODT"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}