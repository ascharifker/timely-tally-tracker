import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { useState } from "react";
import { AppShell } from "@/components/fact/AppShell";
import { usePoLinesByStatus, type PoLineWithContext } from "@/hooks/usePoQueues";
import { useMachines } from "@/hooks/useFactData";
import { createJobFromPoLine } from "@/lib/po-workflow.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Calendar } from "lucide-react";

export const Route = createFileRoute("/production")({
  ssr: false,
  head: () => ({ meta: [{ title: "Producción · FACT" }] }),
  component: ProductionPage,
});

function ProductionPage() {
  const { data: lines = [], isLoading } = usePoLinesByStatus(["ready_for_production"]);
  const { data: machines = [] } = useMachines();
  const createFn = useServerFn(createJobFromPoLine);
  const qc = useQueryClient();

  const [active, setActive] = useState<PoLineWithContext | null>(null);

  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Producción · Luis Angel</h2>
        <p className="text-sm text-muted-foreground">
          Convertí cada línea aprobada en una ODF asignándole máquina, operador y fechas.
        </p>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente / PO</TableHead>
              <TableHead>Línea</TableHead>
              <TableHead>PIR</TableHead>
              <TableHead>Spec</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Comprometida</TableHead>
              <TableHead className="w-32" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  Sin líneas listas. Esperando que Alexis apruebe.
                </TableCell>
              </TableRow>
            )}
            {lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-sm">
                  {l.purchase_order?.customer?.name ?? "—"}
                  <div className="font-mono text-xs text-muted-foreground">
                    {l.purchase_order?.po_number}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">L{l.line_number}</TableCell>
                <TableCell className="font-mono text-xs">{l.pir ?? "—"}</TableCell>
                <TableCell className="text-sm">{l.tube_spec ?? "—"}</TableCell>
                <TableCell className="text-right font-mono">{l.qty_ordered}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {l.committed_date ?? "—"}
                </TableCell>
                <TableCell>
                  <Button size="sm" onClick={() => setActive(l)}>
                    <Calendar className="h-3.5 w-3.5 mr-1" /> Crear ODF
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <CreateOdfDialog
        line={active}
        machines={machines}
        onClose={() => setActive(null)}
        onDone={async () => {
          setActive(null);
          await qc.invalidateQueries({ queryKey: ["po_lines_by_status"] });
          await qc.invalidateQueries({ queryKey: ["jobs"] });
        }}
        createFn={createFn}
      />
    </AppShell>
  );
}

function CreateOdfDialog({
  line,
  machines,
  onClose,
  onDone,
  createFn,
}: {
  line: PoLineWithContext | null;
  machines: { id: string; name: string }[];
  onClose: () => void;
  onDone: () => Promise<void>;
  createFn: (args: unknown) => Promise<{ job_id: string }>;
}) {
  const [machineId, setMachineId] = useState<string | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);

  if (!line) return null;

  const defaultOdf = `${line.purchase_order?.po_number ?? "PO"}-L${line.line_number}`;
  const defaultPlannedEnd = line.committed_date ?? "";

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const v = (k: string) => {
      const x = (fd.get(k) as string | null)?.trim();
      return x && x.length > 0 ? x : null;
    };
    setSubmitting(true);
    try {
      await createFn({
        data: {
          po_line_item_id: line.id,
          odf: v("odf") ?? defaultOdf,
          machine_id: machineId ?? null,
          operator_name: v("operator_name"),
          planned_start: v("planned_start"),
          planned_end: v("planned_end"),
          notes: v("notes"),
        },
      });
      toast.success("ODF creada y agendada");
      await onDone();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={!!line} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl bg-card">
        <DialogHeader>
          <DialogTitle>
            Crear ODF — {line.purchase_order?.po_number} · L{line.line_number}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 text-sm">
          <div className="col-span-1">
            <Label>ODF *</Label>
            <Input name="odf" required defaultValue={defaultOdf} />
          </div>
          <div className="col-span-1">
            <Label>Operador</Label>
            <Input name="operator_name" placeholder="Nombre del operador" />
          </div>
          <div className="col-span-2">
            <Label>Máquina</Label>
            <Select value={machineId} onValueChange={setMachineId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Inicio planificado</Label>
            <Input name="planned_start" type="datetime-local" />
          </div>
          <div>
            <Label>Fin planificado</Label>
            <Input
              name="planned_end"
              type="datetime-local"
              defaultValue={defaultPlannedEnd ? `${defaultPlannedEnd}T17:00` : ""}
            />
          </div>
          <div className="col-span-2 text-xs text-muted-foreground">
            Fecha comprometida al cliente: <span className="font-mono">{line.committed_date ?? "—"}</span>.
            No se modifica desde acá.
          </div>
          <div className="col-span-2">
            <Label>Notas</Label>
            <Textarea name="notes" rows={2} />
          </div>
          <DialogFooter className="col-span-2">
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Creando…" : "Crear ODF"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}