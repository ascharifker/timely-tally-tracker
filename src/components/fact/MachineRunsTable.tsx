import { useState } from "react";
import type { Job, MachineRun } from "@/lib/fact-types";
import {
  useCreateRunRetroactive,
  useDeleteRun,
} from "@/hooks/useMachineRuns";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { runDurationHours } from "@/lib/machine-metrics";

interface Props {
  runs: MachineRun[];
  jobs: Job[];
  /** Pass a single job to force inserts to that job (in JobDetailDialog). */
  fixedJob?: Job;
  /** Pass a machine_id to force inserts to that machine (in machine detail). */
  fixedMachineId?: string;
}

export function MachineRunsTable({ runs, jobs, fixedJob, fixedMachineId }: Props) {
  const create = useCreateRunRetroactive();
  const del = useDeleteRun();
  const [open, setOpen] = useState(false);

  const jobsById = new Map(jobs.map((j) => [j.id, j]));

  const today = new Date().toISOString().slice(0, 16);
  const [form, setForm] = useState({
    job_id: fixedJob?.id ?? "",
    started_at: today,
    ended_at: today,
    pieces_completed: "1",
    operator_name: "",
    notes: "",
  });

  const submit = async () => {
    if (!form.job_id) return;
    const job = jobsById.get(form.job_id);
    const machine_id = fixedMachineId ?? job?.machine_id;
    if (!machine_id) return;
    await create.mutateAsync({
      job_id: form.job_id,
      machine_id,
      started_at: new Date(form.started_at).toISOString(),
      ended_at: new Date(form.ended_at).toISOString(),
      pieces_completed: Number(form.pieces_completed) || 0,
      operator_name: form.operator_name || null,
      notes: form.notes || null,
    });
    setOpen(false);
    setForm({
      job_id: fixedJob?.id ?? "",
      started_at: today,
      ended_at: today,
      pieces_completed: "1",
      operator_name: "",
      notes: "",
    });
  };

  return (
    <Card className="border-border bg-card p-0 overflow-hidden">
      <div className="border-b border-border/60 bg-sidebar/40 px-3 py-2 flex items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">Corridas reales</h3>
          <p className="text-[10px] text-muted-foreground">
            {runs.length === 0
              ? "Sin corridas registradas todavía"
              : `${runs.length} corrida${runs.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <Button size="sm" variant="outline" className="h-7" onClick={() => setOpen((o) => !o)}>
          <Plus className="h-3.5 w-3.5 mr-1" />
          Registrar
        </Button>
      </div>

      {open && (
        <div className="border-b border-border/60 bg-sidebar/20 p-3 space-y-2">
          {!fixedJob && (
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                ODT
              </Label>
              <select
                value={form.job_id}
                onChange={(e) => setForm((f) => ({ ...f, job_id: e.target.value }))}
                className="w-full h-9 rounded border border-border bg-background px-2 text-sm"
              >
                <option value="">— Elegí ODT —</option>
                {jobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.odf} · {j.tube_spec ?? ""}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Inicio
              </Label>
              <Input
                type="datetime-local"
                value={form.started_at}
                onChange={(e) => setForm((f) => ({ ...f, started_at: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Fin
              </Label>
              <Input
                type="datetime-local"
                value={form.ended_at}
                onChange={(e) => setForm((f) => ({ ...f, ended_at: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Piezas
              </Label>
              <Input
                type="number"
                min="0"
                value={form.pieces_completed}
                onChange={(e) => setForm((f) => ({ ...f, pieces_completed: e.target.value }))}
              />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
                Operario
              </Label>
              <Input
                value={form.operator_name}
                onChange={(e) => setForm((f) => ({ ...f, operator_name: e.target.value }))}
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-widest text-muted-foreground">
              Notas
            </Label>
            <Input
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={submit} disabled={create.isPending || !form.job_id}>
              {create.isPending ? "Guardando…" : "Guardar corrida"}
            </Button>
          </div>
        </div>
      )}

      {runs.length === 0 ? (
        <div className="px-3 py-6 text-center text-xs text-muted-foreground">
          Cargá lo que está en papel para empezar a medir h/pieza real.
        </div>
      ) : (
        <div className="divide-y divide-border/40">
          <div className="grid grid-cols-[80px_1fr_1fr_60px_70px_30px] gap-2 px-3 py-1.5 text-[9px] uppercase tracking-widest font-mono text-muted-foreground bg-sidebar/30">
            <span>ODT</span>
            <span>Inicio</span>
            <span>Fin</span>
            <span className="text-right">Piezas</span>
            <span className="text-right">Horas</span>
            <span />
          </div>
          {runs.map((r) => {
            const j = jobsById.get(r.job_id);
            const hrs = runDurationHours(r);
            return (
              <div
                key={r.id}
                className="grid grid-cols-[80px_1fr_1fr_60px_70px_30px] gap-2 px-3 py-1.5 text-[11px] items-center"
              >
                <span className="font-mono font-semibold">{j?.odf ?? "—"}</span>
                <span className="font-mono text-muted-foreground">
                  {new Date(r.started_at).toLocaleString("es", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <span className="font-mono text-muted-foreground">
                  {r.ended_at ? (
                    new Date(r.ended_at).toLocaleString("es", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  ) : (
                    <span className="text-emerald-400 font-bold">EN CURSO</span>
                  )}
                </span>
                <span className="text-right font-mono">{r.pieces_completed}</span>
                <span className="text-right font-mono">{hrs.toFixed(1)}h</span>
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("¿Eliminar corrida?")) del.mutate(r.id);
                  }}
                  className="text-muted-foreground/60 hover:text-[color:var(--status-risk)]"
                  title="Eliminar"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}