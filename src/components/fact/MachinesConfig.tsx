import { useState } from "react";
import type { Machine } from "@/lib/fact-types";
import { useUpdateMachineHoursPerShift } from "@/hooks/useFactData";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";

export function MachinesConfig({ machines }: { machines: Machine[] }) {
  const update = useUpdateMachineHoursPerShift();
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const commit = (m: Machine) => {
    const raw = drafts[m.id];
    if (raw === undefined) return;
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0 || n > 24) return;
    if (n === m.hours_per_shift) return;
    update.mutate({ id: m.id, hours_per_shift: n });
    setDrafts((d) => {
      const next = { ...d };
      delete next[m.id];
      return next;
    });
  };

  return (
    <Card className="border-zinc-800 bg-[#121214] p-0 overflow-hidden">
      <div className="border-b border-zinc-800 bg-[#18181b]/60 px-4 py-3">
        <h3 className="text-sm font-bold text-white tracking-tight">Máquinas — capacidad por turno</h3>
        <p className="text-[11px] text-zinc-500 mt-0.5">
          Horas productivas reales que rinde cada máquina en un turno de 8h. Afecta el cálculo del cronograma.
        </p>
      </div>
      <div className="divide-y divide-zinc-800/60">
        <div className="grid grid-cols-[1fr_120px_120px_140px] gap-3 px-4 py-2 text-[10px] uppercase tracking-widest font-bold text-zinc-500 bg-zinc-900/40">
          <span>Máquina</span>
          <span>Tipo</span>
          <span>h / turno</span>
          <span>Capacidad diaria</span>
        </div>
        {machines.map((m) => {
          const draft = drafts[m.id] ?? String(m.hours_per_shift);
          const daily = (Number(draft) || 0) * 3;
          return (
            <div key={m.id} className="grid grid-cols-[1fr_120px_120px_140px] gap-3 px-4 py-2.5 items-center">
              <div className="flex flex-col">
                <span className="text-sm font-bold text-white">{m.name}</span>
                {m.type === "external_shop" && (
                  <span className="text-[10px] font-bold text-yellow-500/80 uppercase italic">Taller externo</span>
                )}
              </div>
              <span className="text-[11px] font-mono uppercase text-zinc-400">
                {m.type === "internal" ? "interna" : "externo"}
              </span>
              <Input
                type="number"
                step="0.5"
                min="0.5"
                max="24"
                value={draft}
                onChange={(e) => setDrafts((d) => ({ ...d, [m.id]: e.target.value }))}
                onBlur={() => commit(m)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                }}
                className="h-8 bg-zinc-900 border-zinc-700 text-white font-mono"
              />
              <span className="text-[11px] font-mono text-zinc-400">
                <span className="text-white font-bold">{daily.toFixed(1)}h</span> / día (3 turnos)
              </span>
            </div>
          );
        })}
      </div>
    </Card>
  );
}