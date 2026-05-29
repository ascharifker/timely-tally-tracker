import { useEffect, useState } from "react";
import type { Vendor } from "@/lib/fact-types";
import { useUpdateVendor } from "@/hooks/useVendors";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export function VendorForm({ vendor }: { vendor: Vendor }) {
  const update = useUpdateVendor();
  const [form, setForm] = useState({
    name: vendor.name,
    tax_id: vendor.tax_id ?? "",
    contact_name: vendor.contact_name ?? "",
    contact_email: vendor.contact_email ?? "",
    contact_phone: vendor.contact_phone ?? "",
    hourly_rate: String(vendor.hourly_rate ?? 0),
    lead_time_days_avg: vendor.lead_time_days_avg ? String(vendor.lead_time_days_avg) : "",
    notes: vendor.notes ?? "",
    active: vendor.active,
  });

  useEffect(() => {
    setForm({
      name: vendor.name,
      tax_id: vendor.tax_id ?? "",
      contact_name: vendor.contact_name ?? "",
      contact_email: vendor.contact_email ?? "",
      contact_phone: vendor.contact_phone ?? "",
      hourly_rate: String(vendor.hourly_rate ?? 0),
      lead_time_days_avg: vendor.lead_time_days_avg ? String(vendor.lead_time_days_avg) : "",
      notes: vendor.notes ?? "",
      active: vendor.active,
    });
  }, [vendor]);

  const submit = () => {
    update.mutate({
      id: vendor.id,
      name: form.name,
      tax_id: form.tax_id || null,
      contact_name: form.contact_name || null,
      contact_email: form.contact_email || null,
      contact_phone: form.contact_phone || null,
      hourly_rate: Number(form.hourly_rate) || 0,
      lead_time_days_avg: form.lead_time_days_avg ? Number(form.lead_time_days_avg) : null,
      notes: form.notes || null,
      active: form.active,
    });
  };

  return (
    <Card className="border-border bg-card p-4 space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <F label="Razón social" v={form.name} on={(v) => setForm((f) => ({ ...f, name: v }))} />
        <F label="CUIT" v={form.tax_id} on={(v) => setForm((f) => ({ ...f, tax_id: v }))} />
        <F label="Contacto" v={form.contact_name} on={(v) => setForm((f) => ({ ...f, contact_name: v }))} />
        <F label="Email" type="email" v={form.contact_email} on={(v) => setForm((f) => ({ ...f, contact_email: v }))} />
        <F label="Teléfono" v={form.contact_phone} on={(v) => setForm((f) => ({ ...f, contact_phone: v }))} />
        <F label="Tarifa / hora (ARS)" type="number" v={form.hourly_rate} on={(v) => setForm((f) => ({ ...f, hourly_rate: v }))} />
        <F label="Lead time declarado (días)" type="number" v={form.lead_time_days_avg} on={(v) => setForm((f) => ({ ...f, lead_time_days_avg: v }))} />
        <div className="flex items-end gap-2">
          <label className="inline-flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.active}
              onChange={(e) => setForm((f) => ({ ...f, active: e.target.checked }))}
            />
            Activo
          </label>
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
          {update.isPending ? "Guardando…" : "Guardar vendor"}
        </Button>
      </div>
    </Card>
  );
}

function F({
  label,
  v,
  on,
  type = "text",
}: {
  label: string;
  v: string;
  on: (s: string) => void;
  type?: string;
}) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">{label}</Label>
      <Input type={type} value={v} onChange={(e) => on(e.target.value)} />
    </div>
  );
}