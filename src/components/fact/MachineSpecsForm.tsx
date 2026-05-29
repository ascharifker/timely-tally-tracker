import { useEffect, useState } from "react";
import type { Machine } from "@/lib/fact-types";
import { useUpdateMachine } from "@/hooks/useMachineRuns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function MachineSpecsForm({ machine }: { machine: Machine }) {
  const update = useUpdateMachine();
  const [form, setForm] = useState({
    model: machine.model ?? "",
    serial_number: machine.serial_number ?? "",
    year: machine.year ? String(machine.year) : "",
    purchase_date: machine.purchase_date ?? "",
    location: machine.location ?? "",
    image_url: machine.image_url ?? "",
    hourly_cost: String(machine.hourly_cost ?? 0),
    notes: machine.notes ?? "",
  });

  useEffect(() => {
    setForm({
      model: machine.model ?? "",
      serial_number: machine.serial_number ?? "",
      year: machine.year ? String(machine.year) : "",
      purchase_date: machine.purchase_date ?? "",
      location: machine.location ?? "",
      image_url: machine.image_url ?? "",
      hourly_cost: String(machine.hourly_cost ?? 0),
      notes: machine.notes ?? "",
    });
  }, [machine.id, machine.model, machine.serial_number, machine.year, machine.purchase_date, machine.location, machine.image_url, machine.hourly_cost, machine.notes]);

  const submit = () => {
    update.mutate({
      id: machine.id,
      model: form.model || null,
      serial_number: form.serial_number || null,
      year: form.year ? Number(form.year) : null,
      purchase_date: form.purchase_date || null,
      location: form.location || null,
      image_url: form.image_url || null,
      hourly_cost: Number(form.hourly_cost) || 0,
      notes: form.notes || null,
    });
  };

  return (
    <Card className="border-border bg-card p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <Field label="Modelo" value={form.model} onChange={(v) => setForm((f) => ({ ...f, model: v }))} />
        <Field label="N° de serie" value={form.serial_number} onChange={(v) => setForm((f) => ({ ...f, serial_number: v }))} />
        <Field label="Año" type="number" value={form.year} onChange={(v) => setForm((f) => ({ ...f, year: v }))} />
        <Field label="Fecha de compra" type="date" value={form.purchase_date} onChange={(v) => setForm((f) => ({ ...f, purchase_date: v }))} />
        <Field label="Ubicación" value={form.location} onChange={(v) => setForm((f) => ({ ...f, location: v }))} />
        <Field
          label="Costo / hora (ARS)"
          type="number"
          value={form.hourly_cost}
          onChange={(v) => setForm((f) => ({ ...f, hourly_cost: v }))}
        />
        <div className="col-span-2">
          <Field label="Foto (URL)" value={form.image_url} onChange={(v) => setForm((f) => ({ ...f, image_url: v }))} />
        </div>
        <div className="col-span-2">
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">Notas</Label>
          <Textarea
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            rows={3}
          />
        </div>
      </div>
      <div className="flex justify-end">
        <Button onClick={submit} disabled={update.isPending}>
          {update.isPending ? "Guardando…" : "Guardar specs"}
        </Button>
      </div>
    </Card>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}