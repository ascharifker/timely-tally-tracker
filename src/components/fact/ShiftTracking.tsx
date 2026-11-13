import { useMemo, useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ClipboardCheck } from "lucide-react";
import {
  STAGES, jobProgress, machineDayTotals, currentShiftNumber,
  type ShiftLogLike, type StageKey,
} from "@/lib/shift-progress";

type Machine = { id: string; name: string; type?: string };
type JobLite = {
  id: string; odf: string; qty: number; pir: string | null; machine_id: string | null;
  customer_date: string | null; export_date: string | null; status: string;
};
type ShiftLogRow = ShiftLogLike & { id: string; operator_name: string | null; notes: string | null; created_at: string };

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export function useShiftLogs(jobIds?: string[]) {
  return useQuery({
    queryKey: ["shift_logs", jobIds?.slice().sort().join(",") ?? "all"],
    queryFn: async (): Promise<ShiftLogRow[]> => {
      let q = supabase.from("shift_logs").select("*").order("log_date", { ascending: false }).limit(5000);
      if (jobIds) {
        if (jobIds.length === 0) return [];
        q = q.in("job_id", jobIds);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as ShiftLogRow[];
    },
  });
}

export function useStageSettings(jobIds: string[]) {
  return useQuery({
    queryKey: ["job_stage_settings", jobIds.slice().sort().join(",")],
    enabled: jobIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("job_stage_settings").select("*").in("job_id", jobIds);
      if (error) throw error;
      const m = new Map<string, string[]>();
      for (const r of data ?? []) m.set(r.job_id, r.not_applicable ?? []);
      return m;
    },
  });
}

/** 30-second end-of-shift capture. */
export function ShiftLogDialog({
  open, onOpenChange, jobs, machines, defaultJobId,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; jobs: JobLite[]; machines: Machine[]; defaultJobId?: string;
}) {
  const qc = useQueryClient();
  const [date, setDate] = useState(todayStr());
  const [shift, setShift] = useState<number>(currentShiftNumber());
  const [machineId, setMachineId] = useState<string>("");
  const [jobId, setJobId] = useState<string>("");
  const [operator, setOperator] = useState("");
  const [pieces, setPieces] = useState("");
  const [stages, setStages] = useState<Partial<Record<StageKey, string>>>({});
  const [showStages, setShowStages] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setDate(todayStr()); setShift(currentShiftNumber()); setPieces(""); setStages({}); setNotes(""); setShowStages(false);
    const j = jobs.find((x) => x.id === defaultJobId);
    setJobId(j?.id ?? ""); setMachineId(j?.machine_id ?? "");
  }, [open, defaultJobId, jobs]);

  const machineJobs = useMemo(
    () => (machineId ? jobs.filter((j) => j.machine_id === machineId) : jobs),
    [jobs, machineId],
  );
  const job = jobs.find((j) => j.id === jobId);
  const { data: jobLogs = [] } = useShiftLogs(jobId ? [jobId] : []);
  const done = jobLogs.reduce((s, l) => s + l.pieces_machined, 0);

  const save = async () => {
    if (!jobId) return toast.error("Elegí la ODT");
    const n = Number(pieces || 0);
    if (!Number.isFinite(n) || n < 0) return toast.error("Piezas inválidas");
    const stage_counts: Record<string, number> = {};
    for (const [k, v] of Object.entries(stages)) if (v && Number(v) > 0) stage_counts[k] = Number(v);
    if (n === 0 && Object.keys(stage_counts).length === 0) return toast.error("Capturá al menos una cantidad");
    setSaving(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("shift_logs").insert({
      log_date: date, shift_number: shift, machine_id: machineId || job?.machine_id || null, job_id: jobId,
      operator_name: operator.trim() || null, pieces_machined: n, stage_counts, notes: notes.trim() || null,
      created_by: u.user?.id ?? null,
    });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Turno ${shift} registrado · ${job?.odf}`);
    qc.invalidateQueries({ queryKey: ["shift_logs"] });
    onOpenChange(false);
  };

  const sel = "h-9 w-full rounded-md border bg-background px-2 text-sm";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Registrar avance de turno</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Fecha</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} /></div>
            <div>
              <Label>Turno</Label>
              <div className="mt-1 grid grid-cols-3 gap-1">
                {[1, 2, 3].map((s) => (
                  <Button key={s} type="button" size="sm" variant={shift === s ? "default" : "outline"} onClick={() => setShift(s)}>{s}</Button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <Label>Máquina</Label>
            <select className={sel} value={machineId} onChange={(e) => { setMachineId(e.target.value); setJobId(""); }}>
              <option value="">Todas</option>
              {machines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <Label>ODT</Label>
            <select className={sel} value={jobId} onChange={(e) => {
              setJobId(e.target.value);
              const j = jobs.find((x) => x.id === e.target.value);
              if (j?.machine_id && !machineId) setMachineId(j.machine_id);
            }}>
              <option value="">Elegir…</option>
              {machineJobs.map((j) => <option key={j.id} value={j.id}>{j.odf} · {j.pir ?? "sin PIR"} · {j.qty} pzs</option>)}
            </select>
            {job && (
              <p className="mt-1 text-xs text-muted-foreground">
                Maquinadas hasta ahora: <b>{Math.min(done, job.qty)}</b> de {job.qty} · pendientes {Math.max(0, job.qty - done)}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label>Piezas maquinadas en el turno</Label><Input inputMode="numeric" type="number" min={0} value={pieces} onChange={(e) => setPieces(e.target.value)} className="text-lg font-semibold" /></div>
            <div><Label>Operador</Label><Input value={operator} onChange={(e) => setOperator(e.target.value)} placeholder="Nombre" /></div>
          </div>
          <button type="button" className="text-left text-xs text-primary underline" onClick={() => setShowStages((v) => !v)}>
            {showStages ? "Ocultar etapas posteriores" : "+ Registrar etapas posteriores (inspección, fosfato, cementación…)"}
          </button>
          {showStages && (
            <div className="grid grid-cols-2 gap-2 rounded-md border p-2">
              {STAGES.map((s) => (
                <div key={s.key}>
                  <Label className="text-[11px]">{s.label}</Label>
                  <Input type="number" min={0} className="h-8" value={stages[s.key] ?? ""} onChange={(e) => setStages((p) => ({ ...p, [s.key]: e.target.value }))} />
                </div>
              ))}
            </div>
          )}
          <div><Label>Observaciones</Label><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={save} disabled={saving}>{saving ? "Guardando…" : "Guardar turno"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Bar({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="text-[10px] text-muted-foreground">N/A</span>;
  const tone = pct >= 100 ? "bg-primary" : pct > 0 ? "bg-primary/60" : "bg-muted";
  return (
    <div className="flex items-center gap-1">
      <div className="h-1.5 w-12 rounded bg-muted"><div className={`h-1.5 rounded ${tone}`} style={{ width: `${pct}%` }} /></div>
      <span className="font-mono text-[10px]">{pct}%</span>
    </div>
  );
}

/** Santiago's RESUMEN sheet: daily output by machine and the 8-stage pipeline per ODT. */
export function ShiftSummary({ jobs, machines }: { jobs: JobLite[]; machines: Machine[] }) {
  const qc = useQueryClient();
  const [day, setDay] = useState(todayStr());
  const [open, setOpen] = useState(false);
  const [presetJob, setPresetJob] = useState<string | undefined>();
  const ids = useMemo(() => jobs.map((j) => j.id), [jobs]);
  const { data: logs = [] } = useShiftLogs();
  const { data: na = new Map<string, string[]>() } = useStageSettings(ids);
  const totals = machineDayTotals(logs, day);
  const internal = machines.filter((m) => m.type !== "external_shop");
  const now = new Date(); now.setHours(0, 0, 0, 0);

  const toggleNa = async (jobId: string, key: string) => {
    const cur = na.get(jobId) ?? [];
    const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
    const { error } = await supabase.from("job_stage_settings").upsert({ job_id: jobId, not_applicable: next, updated_at: new Date().toISOString() });
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["job_stage_settings"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Label className="text-xs">Día a consultar</Label>
          <Input type="date" value={day} onChange={(e) => setDay(e.target.value)} className="w-44" />
        </div>
        <Button onClick={() => { setPresetJob(undefined); setOpen(true); }}>
          <ClipboardCheck className="mr-2 h-4 w-4" />Registrar turno
        </Button>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-muted-foreground">
            <tr className="border-b">
              <th className="p-2 text-left">Máquina</th><th className="p-2">Turno 1</th><th className="p-2">Turno 2</th>
              <th className="p-2">Turno 3</th><th className="p-2">Total día</th><th className="p-2">ODTs activas</th><th className="p-2">Vencidas</th>
            </tr>
          </thead>
          <tbody>
            {internal.map((m) => {
              const t = totals.get(m.id) ?? [0, 0, 0];
              const mj = jobs.filter((j) => j.machine_id === m.id);
              const late = mj.filter((j) => { const d = j.customer_date ?? j.export_date; return d && new Date(d) < now; }).length;
              return (
                <tr key={m.id} className="border-b last:border-0 text-center">
                  <td className="p-2 text-left font-medium">{m.name}</td>
                  {t.map((v, i) => <td key={i} className="p-2 font-mono">{v || "—"}</td>)}
                  <td className="p-2 font-mono font-semibold">{t[0] + t[1] + t[2] || "—"}</td>
                  <td className="p-2">{mj.length}</td>
                  <td className={`p-2 ${late ? "text-destructive font-semibold" : ""}`}>{late || "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="rounded-md border bg-card overflow-x-auto">
        <div className="border-b p-2 text-xs text-muted-foreground">Avance por etapa · clic en una etapa para marcarla “No aplica”</div>
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="border-b">
              <th className="p-2 text-left">ODT</th><th className="p-2 text-left">Máquina</th><th className="p-2">Maquinado</th>
              {STAGES.map((s) => <th key={s.key} className="p-2 whitespace-nowrap">{s.label.replace("Cementación · ", "Cem. ").replace("Material entregado · ", "")}</th>)}
              <th className="p-2">General</th><th />
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 && <tr><td colSpan={13} className="p-4 text-center text-muted-foreground">No hay ODTs en curso.</td></tr>}
            {jobs.map((j) => {
              const p = jobProgress(j.qty, logs.filter((l) => l.job_id === j.id), na.get(j.id) ?? []);
              return (
                <tr key={j.id} className="border-b last:border-0">
                  <td className="p-2 font-mono">{j.odf}<div className="text-[10px] text-muted-foreground">{j.pir}</div></td>
                  <td className="p-2">{machines.find((m) => m.id === j.machine_id)?.name ?? "—"}</td>
                  <td className="p-2"><div className="font-mono text-[10px]">{p.machined}/{j.qty}</div><Bar pct={p.pct} /></td>
                  {STAGES.map((s) => (
                    <td key={s.key} className="p-2 cursor-pointer hover:bg-muted/50" title="Clic: alternar No aplica" onClick={() => toggleNa(j.id, s.key)}>
                      <Bar pct={p.stages[s.key].pct} />
                    </td>
                  ))}
                  <td className="p-2 font-semibold">{p.overall}%</td>
                  <td className="p-2"><Button size="sm" variant="ghost" onClick={() => { setPresetJob(j.id); setOpen(true); }}>+ Turno</Button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ShiftLogDialog open={open} onOpenChange={setOpen} jobs={jobs} machines={machines} defaultJobId={presetJob} />
    </div>
  );
}

/** Shift history for one ODT (used in the ODT detail card). */
export function JobShiftHistory({ job, machines }: { job: JobLite; machines: Machine[] }) {
  const { data: logs = [] } = useShiftLogs([job.id]);
  const [open, setOpen] = useState(false);
  const p = jobProgress(job.qty, logs);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-sm"><b>{p.machined}</b> de {job.qty} piezas maquinadas · {logs.length} turnos registrados</div>
        <Button size="sm" variant="outline" onClick={() => setOpen(true)}>Registrar turno</Button>
      </div>
      {logs.length > 0 && (
        <table className="w-full text-xs">
          <thead className="text-muted-foreground"><tr className="border-b"><th className="p-1 text-left">Fecha</th><th className="p-1">Turno</th><th className="p-1 text-left">Operador</th><th className="p-1">Piezas</th><th className="p-1 text-left">Notas</th></tr></thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-b last:border-0">
                <td className="p-1">{l.log_date}</td><td className="p-1 text-center">{l.shift_number}</td>
                <td className="p-1">{l.operator_name ?? "—"}</td><td className="p-1 text-center font-mono">{l.pieces_machined}</td>
                <td className="p-1 text-muted-foreground">{l.notes ?? ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <ShiftLogDialog open={open} onOpenChange={setOpen} jobs={[job]} machines={machines} defaultJobId={job.id} />
    </div>
  );
}
