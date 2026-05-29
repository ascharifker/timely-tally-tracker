import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Link } from "@tanstack/react-router";
import { Plus, ExternalLink } from "lucide-react";
import { useVendors, useCreateVendor, useUpdateVendor } from "@/hooks/useVendors";
import { useMachines } from "@/hooks/useFactData";

export function VendorsConfig() {
  const { data: vendors = [] } = useVendors();
  const { data: machines = [] } = useMachines();
  const create = useCreateVendor();
  const update = useUpdateVendor();
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [rate, setRate] = useState("");

  const mirrorByVendorId = new Map(
    machines.filter((m) => m.vendor_id).map((m) => [m.vendor_id!, m]),
  );

  return (
    <Card className="border-zinc-800 bg-[#121214] p-0 overflow-hidden">
      <div className="border-b border-zinc-800 bg-[#18181b]/60 px-4 py-3 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">Talleres externos</h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Vendors con tarifa y lead time. Cada vendor genera una entrada en Kanban/Gantt automáticamente.
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-7" onClick={() => setFormOpen((o) => !o)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Nuevo
        </Button>
      </div>

      {formOpen && (
        <div className="border-b border-zinc-800 p-3 bg-zinc-900/30">
          <div className="grid grid-cols-[1fr_140px_auto] gap-2 items-end">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-zinc-500">Nombre</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ej. GEMAK SRL" className="bg-zinc-900 border-zinc-700 text-white" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-zinc-500">$/h</Label>
              <Input type="number" value={rate} onChange={(e) => setRate(e.target.value)} className="bg-zinc-900 border-zinc-700 text-white font-mono" />
            </div>
            <Button
              size="sm"
              disabled={!name.trim() || create.isPending}
              onClick={async () => {
                await create.mutateAsync({ name: name.trim(), hourly_rate: Number(rate) || 0 });
                setName("");
                setRate("");
                setFormOpen(false);
              }}
            >
              {create.isPending ? "Guardando…" : "Crear"}
            </Button>
          </div>
        </div>
      )}

      <div className="divide-y divide-zinc-800/60">
        <div className="grid grid-cols-[1fr_120px_100px_100px_120px_90px] gap-3 px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-zinc-500 bg-zinc-900/40">
          <span>Vendor</span>
          <span>CUIT</span>
          <span>$/h</span>
          <span>Lead time</span>
          <span>Contacto</span>
          <span />
        </div>
        {vendors.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-zinc-500">
            Sin talleres externos cargados.
          </div>
        ) : (
          vendors.map((v) => {
            const mirror = mirrorByVendorId.get(v.id);
            return (
              <div key={v.id} className="grid grid-cols-[1fr_120px_100px_100px_120px_90px] gap-3 px-4 py-2.5 items-center text-sm">
                <span className="font-bold text-white">{v.name}</span>
                <EditableCell value={v.tax_id ?? ""} onSave={(val) => update.mutate({ id: v.id, tax_id: val || null })} placeholder="—" />
                <EditableCell
                  value={String(v.hourly_rate)}
                  type="number"
                  onSave={(val) => update.mutate({ id: v.id, hourly_rate: Number(val) || 0 })}
                />
                <EditableCell
                  value={v.lead_time_days_avg !== null ? String(v.lead_time_days_avg) : ""}
                  type="number"
                  onSave={(val) => update.mutate({ id: v.id, lead_time_days_avg: val ? Number(val) : null })}
                  placeholder="—"
                />
                <EditableCell value={v.contact_name ?? ""} onSave={(val) => update.mutate({ id: v.id, contact_name: val || null })} placeholder="—" />
                {mirror ? (
                  <Link
                    to="/maquina/$id"
                    params={{ id: mirror.id }}
                    className="inline-flex items-center gap-1 text-[11px] font-bold uppercase tracking-wider text-yellow-500 hover:text-yellow-300"
                  >
                    Ver ficha <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : (
                  <span className="text-[10px] text-zinc-500 font-mono">sin mirror</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
}

function EditableCell({
  value,
  onSave,
  type = "text",
  placeholder,
}: {
  value: string;
  onSave: (val: string) => void;
  type?: "text" | "number";
  placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  return (
    <Input
      type={type}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => draft !== value && onSave(draft)}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
      className="h-8 bg-zinc-900 border-zinc-700 text-white font-mono text-xs"
    />
  );
}