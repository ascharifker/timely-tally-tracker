import { useMemo, useState } from "react";
import { useCreateJob, useJobs, useMachines } from "@/hooks/useFactData";
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
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import type { JobPriority } from "@/lib/fact-types";
import { scheduleJob } from "@/lib/scheduling/schedule";
import { findOverlap } from "@/lib/scheduling/overlap";
import { SHIFTS, isWorkday, shiftStartMs } from "@/lib/shifts";
import { cn } from "@/lib/utils";

const SHIFT_MS = 8 * 3_600_000;
const DAYS_SHOWN = 14;

export function CreateJobDialog() {
  const [open, setOpen] = useState(false);
  const [machineId, setMachineId] = useState<string | undefined>(undefined);
  const [priority, setPriority] = useState<JobPriority>("normal");
  const [hoursPerPiece, setHoursPerPiece] = useState<string>("");
  const [qty, setQty] = useState<string>("1");
  const [slotStart, setSlotStart] = useState<number | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);
  const { data: machines = [] } = useMachines();
  const { data: jobs = [] } = useJobs();
  const create = useCreateJob();

  const selectedMachine = machines.find((m) => m.id === machineId);
  const qtyNum = Math.max(1, Number(qty) || 1);
  const hppNum = Number(hoursPerPiece);
  const totalHours = Number.isFinite(hppNum) && hppNum > 0 ? hppNum * qtyNum : 0;

  const days = useMemo(() => {
    const out: Date[] = [];
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + weekOffset * 7);
    while (out.length < DAYS_SHOWN) {
      if (isWorkday(d)) out.push(new Date(d));
      d.setDate(d.getDate() + 1);
    }
    return out;
  }, [weekOffset]);

  const span = useMemo(() => {
    if (slotStart == null || !selectedMachine || totalHours <= 0) return null;
    return scheduleJob(slotStart - 1, totalHours, selectedMachine);
  }, [slotStart, selectedMachine, totalHours]);

  const clash = span && machineId
    ? findOverlap(jobs, machineId, new Date(span.planned_start).getTime(), new Date(span.planned_end).getTime())
    : null;

  const reset = () => {
    setHoursPerPiece("");
    setQty("1");
    setSlotStart(null);
    setMachineId(undefined);
    setWeekOffset(0);
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const get = (k: string) => {
      const v = (fd.get(k) as string | null)?.trim();
      return v && v.length > 0 ? v : null;
    };
    if (!get("tube_spec")) return toast.error("Agrega el número de tubo");
    if (slotStart != null && totalHours <= 0) return toast.error("Agrega horas por pieza para programar");
    if (clash) return toast.error(`Choca con ODT ${clash.odf} en esa máquina`);
    try {
      await create.mutateAsync({
        odf: get("odf") ?? "",
        po_musa: get("po_musa"),
        pir: get("pir"),
        pir_rev: get("pir_rev"),
        tube_spec: get("tube_spec"),
        qty: qtyNum,
        machine_id: machineId ?? null,
        priority,
        export_date: get("export_date"),
        customer_date: get("customer_date"),
        notes: get("notes"),
        hours_override: totalHours > 0 ? totalHours : null,
        planned_start: span?.planned_start ?? null,
        planned_end: span?.planned_end ?? null,
      });
      toast.success("ODT creado");
      setOpen(false);
      reset();
    } catch (err) {
      toast.error("Error: " + (err instanceof Error ? err.message : "unknown"));
    }
  };

  const machineJobs = jobs.filter((j) => j.machine_id === machineId && j.planned_start && j.planned_end);
  const cellBusy = (startMs: number) =>
    machineJobs.find((j) => {
      const s = new Date(j.planned_start!).getTime();
      const en = new Date(j.planned_end!).getTime();
      return s < startMs + SHIFT_MS && startMs < en;
    });
  const inSpan = (startMs: number) =>
    span && startMs < new Date(span.planned_end).getTime() && new Date(span.planned_start).getTime() < startMs + SHIFT_MS;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90">
          <Plus className="mr-1 h-4 w-4" /> Nueva ODT
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto bg-card">
        <DialogHeader>
          <DialogTitle>Crear ODT</DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <Label>ODT *</Label>
            <Input name="odf" required placeholder="123/26" />
          </div>
          <div>
            <Label>Número de Tubo *</Label>
            <Input name="tube_spec" required placeholder="Número de tubo" />
          </div>
          <div>
            <Label>PO #</Label>
            <Input name="po_musa" />
          </div>
          <div>
            <Label>Cantidad</Label>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
          </div>
          <div>
            <Label>PIR</Label>
            <Input name="pir" placeholder="PIR-A12" />
            <Label className="mt-2 block">Nivel de revisión</Label>
            <Input name="pir_rev" placeholder="ej: C" />
          </div>
          <div>
            <Label>Horas de maquinado por pieza</Label>
            <Input
              type="number"
              min={0.1}
              step={0.1}
              value={hoursPerPiece}
              onChange={(e) => setHoursPerPiece(e.target.value)}
              placeholder="ej: 2.5"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Total: <strong>{totalHours > 0 ? `${totalHours.toFixed(1)} h` : "—"}</strong> (horas/pieza × cantidad)
            </p>
          </div>
          <div>
            <Label>Máquina</Label>
            <Select value={machineId} onValueChange={(v) => { setMachineId(v); setSlotStart(null); }}>
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

          <div className="col-span-2 rounded-md border border-border p-3">
            <div className="mb-2 flex items-center justify-between">
              <Label>Fecha de producción y turno</Label>
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" disabled={weekOffset <= 0} onClick={() => setWeekOffset((w) => w - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button type="button" size="icon" variant="ghost" onClick={() => setWeekOffset((w) => w + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
            {!selectedMachine ? (
              <p className="text-xs text-muted-foreground">Elige una máquina para ver sus espacios libres.</p>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <div className="grid gap-1" style={{ gridTemplateColumns: `56px repeat(${days.length}, minmax(44px, 1fr))` }}>
                    <div />
                    {days.map((d) => (
                      <div key={d.toISOString()} className="text-center text-[10px] text-muted-foreground">
                        {d.toLocaleDateString("es", { weekday: "short" })}<br />{d.getDate()}/{d.getMonth() + 1}
                      </div>
                    ))}
                    {SHIFTS.map((s, si) => (
                      <div key={s.key} className="contents">
                        <div className="flex items-center text-[11px] text-muted-foreground">{s.name}</div>
                        {days.map((d) => {
                          const startMs = shiftStartMs(d, si);
                          const busy = cellBusy(startMs);
                          const past = startMs < Date.now();
                          const inactive = selectedMachine.active_shifts?.length && !selectedMachine.active_shifts.includes(s.key);
                          const disabled = !!busy || past || !!inactive;
                          const selected = inSpan(startMs);
                          return (
                            <button
                              type="button"
                              key={startMs}
                              disabled={disabled}
                              title={busy ? `Ocupado: ODT ${busy.odf}` : past ? "Pasado" : inactive ? "Turno inactivo" : "Libre"}
                              onClick={() => setSlotStart(startMs)}
                              className={cn(
                                "h-7 truncate rounded px-0.5 text-[9px]",
                                busy ? "cursor-not-allowed bg-destructive/25 text-destructive" :
                                disabled ? "cursor-not-allowed bg-muted/40" :
                                selected ? (clash ? "bg-destructive text-destructive-foreground" : "bg-primary text-primary-foreground") :
                                "bg-secondary hover:bg-primary/30",
                              )}
                            >
                              {busy ? busy.odf : ""}
                            </button>
                          );
                        })}
                      </div>
                    ))}
                  </div>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {slotStart == null
                    ? "Sin programar — haz clic en un turno libre para asignar la fecha de inicio."
                    : totalHours <= 0
                      ? "Agrega horas por pieza para calcular el fin."
                      : clash
                        ? `No cabe: choca con ODT ${clash.odf}. Elige otro turno.`
                        : span && `Inicio ${new Date(span.planned_start).toLocaleString("es", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} → fin ${new Date(span.planned_end).toLocaleString("es", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })} (${totalHours.toFixed(1)} h)`}
                  {slotStart != null && (
                    <button type="button" className="ml-2 underline" onClick={() => setSlotStart(null)}>quitar</button>
                  )}
                </p>
              </>
            )}
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
            <Button type="submit" disabled={create.isPending || !!clash}>
              {create.isPending ? "Creando…" : "Crear ODT"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
