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

export function CreateJobDialog() {
  const [open, setOpen] = useState(false);
  const [machineId, setMachineId] = useState<string | undefined>(undefined);
  const [priority, setPriority] = useState<JobPriority>("normal");
  const { data: machines = [] } = useMachines();
  const create = useCreateJob();

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => {
      const v = (fd.get(k) as string | null)?.trim();
      return v && v.length > 0 ? v : null;
    };
    try {
      await create.mutateAsync({
        odf: get("odf") ?? "",
        po_musa: get("po_musa"),
        po_halliburton: get("po_halliburton"),
        pir: get("pir"),
        tube_spec: get("tube_spec"),
        qty: Number(get("qty") ?? 1),
        machine_id: machineId ?? null,
        priority,
        export_date: get("export_date"),
        customer_date: get("customer_date"),
        notes: get("notes"),
      });
      toast.success("ODF creado");
      setOpen(false);
    } catch (err) {
      toast.error("Error: " + (err instanceof Error ? err.message : "unknown"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-1 h-4 w-4" /> Nuevo ODF
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl bg-card">
        <DialogHeader>
          <DialogTitle>Crear ODF</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-1">
            <Label>ODF *</Label>
            <Input name="odf" required placeholder="123/26" />
          </div>
          <div className="col-span-1">
            <Label>Cantidad</Label>
            <Input name="qty" type="number" defaultValue={1} min={1} />
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
              {create.isPending ? "Creando…" : "Crear ODF"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}