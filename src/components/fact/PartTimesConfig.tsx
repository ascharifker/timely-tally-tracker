import { useMemo, useState } from "react";
import type { Job, Machine, PartTime } from "@/lib/fact-types";
import { useDeletePartTime, useUpsertPartTime } from "@/hooks/useFactData";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, AlertCircle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function PartTimesConfig({
  machines,
  partTimes,
  jobs,
}: {
  machines: Machine[];
  partTimes: PartTime[];
  jobs: Job[];
}) {
  const upsert = useUpsertPartTime();
  const del = useDeletePartTime();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newRow, setNewRow] = useState({ pir: "", machine_id: "", hours_per_piece: "" });
  const [hoursDraft, setHoursDraft] = useState<Record<string, string>>({});

  const machineName = (id: string) => machines.find((m) => m.id === id)?.name ?? "—";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return partTimes;
    return partTimes.filter(
      (p) => p.pir.toLowerCase().includes(q) || machineName(p.machine_id).toLowerCase().includes(q),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partTimes, search, machines]);

  // PIRs used in active jobs that have no catalog entry for their assigned machine.
  const missing = useMemo(() => {
    const idx = new Set(partTimes.map((p) => `${p.pir}::${p.machine_id}`));
    const out: { pir: string; machine_id: string; odf: string }[] = [];
    const seen = new Set<string>();
    for (const j of jobs) {
      if (!j.pir || !j.machine_id) continue;
      const k = `${j.pir}::${j.machine_id}`;
      if (idx.has(k) || seen.has(k)) continue;
      seen.add(k);
      out.push({ pir: j.pir, machine_id: j.machine_id, odf: j.odf });
    }
    return out;
  }, [jobs, partTimes]);

  const submitNew = () => {
    const hours = Number(newRow.hours_per_piece);
    if (!newRow.pir || !newRow.machine_id || !Number.isFinite(hours) || hours <= 0) return;
    upsert.mutate(
      { pir: newRow.pir.trim(), machine_id: newRow.machine_id, hours_per_piece: hours },
      {
        onSuccess: () => {
          setNewRow({ pir: "", machine_id: "", hours_per_piece: "" });
          setAdding(false);
        },
      },
    );
  };

  return (
    <Card className="border-zinc-800 bg-[#121214] p-0 overflow-hidden">
      <div className="border-b border-zinc-800 bg-[#18181b]/60 px-4 py-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-white tracking-tight">
            Catálogo de tiempos · PIR × Máquina
          </h3>
          <p className="text-[11px] text-zinc-500 mt-0.5">
            Horas por pieza para cada combinación. Total ODT = h/pieza × cantidad.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Input
            placeholder="Buscar PIR o máquina…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 w-48 bg-zinc-900 border-zinc-700 text-white"
          />
          <Button
            size="sm"
            onClick={() => setAdding((v) => !v)}
            className="h-8 bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
          >
            <Plus className="h-3.5 w-3.5 mr-1" />
            {adding ? "Cancelar" : "Agregar"}
          </Button>
        </div>
      </div>

      {missing.length > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-[11px] text-amber-200 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-px shrink-0" />
          <div>
            <span className="font-bold">{missing.length} combinación{missing.length === 1 ? "" : "es"} PIR×máquina sin tiempo cargado.</span>{" "}
            Esas ODTs usan duración estimada heurística.{" "}
            <span className="text-amber-100/70">
              Ej: {missing.slice(0, 3).map((m) => `${m.pir} en ${machineName(m.machine_id)}`).join(" · ")}
              {missing.length > 3 ? ` · +${missing.length - 3}` : ""}
            </span>
          </div>
        </div>
      )}

      <div className="divide-y divide-zinc-800/60">
        <div className="grid grid-cols-[1.2fr_1.5fr_140px_100px] gap-3 px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-zinc-500 bg-zinc-900/40">
          <span>PIR</span>
          <span>Máquina</span>
          <span>h / pieza</span>
          <span>Acción</span>
        </div>

        {adding && (
          <div className="grid grid-cols-[1.2fr_1.5fr_140px_100px] gap-3 px-4 py-2.5 items-center bg-yellow-500/[0.04]">
            <Input
              placeholder="ej: PIR-1234"
              value={newRow.pir}
              onChange={(e) => setNewRow((r) => ({ ...r, pir: e.target.value }))}
              className="h-8 bg-zinc-900 border-zinc-700 text-white font-mono"
              list="pir-suggestions"
            />
            <datalist id="pir-suggestions">
              {Array.from(new Set(jobs.map((j) => j.pir).filter(Boolean))).map((p) => (
                <option key={p as string} value={p as string} />
              ))}
            </datalist>
            <Select
              value={newRow.machine_id}
              onValueChange={(v) => setNewRow((r) => ({ ...r, machine_id: v }))}
            >
              <SelectTrigger className="h-8 bg-zinc-900 border-zinc-700 text-white">
                <SelectValue placeholder="Seleccionar máquina" />
              </SelectTrigger>
              <SelectContent>
                {machines.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input
              type="number"
              step="0.1"
              min="0.1"
              placeholder="2.5"
              value={newRow.hours_per_piece}
              onChange={(e) => setNewRow((r) => ({ ...r, hours_per_piece: e.target.value }))}
              className="h-8 bg-zinc-900 border-zinc-700 text-white font-mono"
            />
            <Button
              size="sm"
              onClick={submitNew}
              disabled={upsert.isPending}
              className="h-8 bg-yellow-500 hover:bg-yellow-400 text-black font-bold"
            >
              Guardar
            </Button>
          </div>
        )}

        {filtered.length === 0 && !adding && (
          <div className="px-4 py-8 text-center text-[12px] text-zinc-500">
            {partTimes.length === 0
              ? "Sin entradas todavía. Agregá la primera combinación PIR × máquina."
              : "No hay coincidencias."}
          </div>
        )}

        {filtered.map((p) => {
          const draft = hoursDraft[p.id] ?? String(p.hours_per_piece);
          return (
            <div
              key={p.id}
              className="grid grid-cols-[1.2fr_1.5fr_140px_100px] gap-3 px-4 py-2 items-center"
            >
              <span className="text-sm font-mono font-bold text-white">{p.pir}</span>
              <span className="text-sm text-zinc-300">{machineName(p.machine_id)}</span>
              <Input
                type="number"
                step="0.1"
                min="0.1"
                value={draft}
                onChange={(e) => setHoursDraft((d) => ({ ...d, [p.id]: e.target.value }))}
                onBlur={() => {
                  const n = Number(draft);
                  if (!Number.isFinite(n) || n <= 0 || n === p.hours_per_piece) {
                    setHoursDraft((d) => {
                      const next = { ...d };
                      delete next[p.id];
                      return next;
                    });
                    return;
                  }
                  upsert.mutate({
                    id: p.id,
                    pir: p.pir,
                    machine_id: p.machine_id,
                    hours_per_piece: n,
                  });
                  setHoursDraft((d) => {
                    const next = { ...d };
                    delete next[p.id];
                    return next;
                  });
                }}
                className="h-8 bg-zinc-900 border-zinc-700 text-white font-mono"
              />
              <button
                onClick={() => {
                  if (confirm(`¿Eliminar entrada ${p.pir} → ${machineName(p.machine_id)}?`)) {
                    del.mutate(p.id);
                  }
                }}
                className="text-zinc-500 hover:text-red-400 transition-colors p-1.5 rounded hover:bg-red-500/10 w-fit"
                title="Eliminar"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}