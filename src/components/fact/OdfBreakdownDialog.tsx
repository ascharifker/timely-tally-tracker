import { useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ActiveJob, JobStep } from "@/hooks/useActiveJobs";
import { useMachineRuns } from "@/hooks/useMachineRuns";
import { computeOdfOtd, stepDurationHours, OTD_TONE } from "@/lib/scheduling/odf-otd";
import { runDurationHours } from "@/lib/machine-metrics";
import { STATUS_LABEL } from "@/lib/fact-types";
import { Clock, Cpu, User, Calendar, Package, FileText } from "lucide-react";

const STEP_LABEL: Record<string, string> = {
  MAZAK: "Mazak",
  MAQUINADO_LISTO: "Maquinado Listo",
  CEMENTACION: "Cementación",
  CEMENTACION_LISTO: "Cementación Lista",
  EXPO: "Exportación",
  YA_SE_ENVIO: "Enviado",
};

function fmtDt(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDate(d: string | null) {
  if (!d) return "—";
  return new Date(d + "T00:00:00").toLocaleDateString("es", {
    day: "2-digit",
    month: "short",
    year: "2-digit",
  });
}

export function OdfBreakdownDialog({
  job,
  machines,
  onClose,
}: {
  job: ActiveJob | null;
  machines: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { data: allRuns = [] } = useMachineRuns();
  const mById = useMemo(() => Object.fromEntries(machines.map((m) => [m.id, m.name])), [machines]);

  const runs = useMemo(
    () => (job ? allRuns.filter((r) => r.job_id === job.id) : []),
    [allRuns, job],
  );
  const realHours = runs.reduce((acc, r) => acc + (r.ended_at ? runDurationHours(r) : 0), 0);
  const piecesDone = runs.reduce((acc, r) => acc + (r.pieces_completed ?? 0), 0);

  if (!job) return null;

  const otd = computeOdfOtd(job);
  const tone = OTD_TONE[otd.score];

  return (
    <Dialog open={!!job} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded bg-primary/15 px-2 py-1 text-[10px] uppercase tracking-widest text-primary font-mono">
              ODT
            </span>
            <span className="font-mono">{job.odf}</span>
            <span className="text-xs text-muted-foreground font-normal">· {STATUS_LABEL[job.status]}</span>
            <span
              className="ml-auto inline-flex items-center gap-1.5 rounded px-2 py-1 text-[11px] font-semibold"
              style={{ color: tone.color, backgroundColor: tone.bg }}
            >
              OTD · {tone.label}
              {otd.days_diff !== null && (
                <span className="font-mono">
                  {otd.days_diff > 0 ? `+${otd.days_diff}d` : `${otd.days_diff}d`}
                </span>
              )}
            </span>
          </DialogTitle>
        </DialogHeader>

        {/* PO header */}
        {job.po && (
          <div className="rounded border border-border bg-sidebar/30 p-3 text-sm">
            <div className="flex items-baseline gap-2">
              <span className="inline-flex items-center gap-1.5 rounded bg-[color:var(--status-mazak)]/15 px-2 py-0.5 text-[10px] uppercase tracking-widest text-[color:var(--status-mazak)] font-mono">
                PO
              </span>
              <span className="font-mono font-semibold">{job.po.po_number}</span>
              <span className="text-muted-foreground">·</span>
              <span>{job.po.customer_name ?? "Sin cliente"}</span>
            </div>
          </div>
        )}

        {/* OTD summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <MetricCard
            icon={<Calendar className="h-3 w-3" />}
            label="Fecha cliente"
            value={fmtDate(job.customer_date)}
          />
          <MetricCard
            icon={<Calendar className="h-3 w-3" />}
            label="Enviado"
            value={otd.shipped_at ? fmtDt(otd.shipped_at) : "—"}
          />
          <MetricCard
            icon={<Clock className="h-3 w-3" />}
            label="Tiempo real"
            value={otd.actual_hours !== null ? `${otd.actual_hours} h` : "—"}
            sub={otd.planned_hours !== null ? `plan ${otd.planned_hours} h` : null}
          />
          <MetricCard
            icon={<Clock className="h-3 w-3" />}
            label="Dentro de estimado"
            value={
              otd.within_estimate === null
                ? "—"
                : otd.within_estimate
                  ? "Sí"
                  : "Excedido"
            }
            tone={
              otd.within_estimate === null
                ? undefined
                : otd.within_estimate
                  ? "var(--status-enviado)"
                  : "var(--status-risk)"
            }
          />
        </div>

        {/* Job meta */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 rounded border border-border bg-sidebar/20 p-3 text-sm">
          <MetaField icon={<Package className="h-3 w-3" />} label="Cantidad" value={String(job.qty)} />
          <MetaField icon={<FileText className="h-3 w-3" />} label="PIR" value={job.pir ?? "—"} />
          <MetaField icon={<Cpu className="h-3 w-3" />} label="Máquina principal" value={job.machine_id ? mById[job.machine_id] ?? "—" : "—"} />
          <MetaField icon={<User className="h-3 w-3" />} label="Operador" value={job.operator_name ?? "—"} />
          <MetaField icon={<Calendar className="h-3 w-3" />} label="Export plan" value={fmtDate(job.export_date)} />
          <MetaField icon={<Calendar className="h-3 w-3" />} label="Inicio planificado" value={fmtDt(job.planned_start)} />
          <MetaField icon={<Calendar className="h-3 w-3" />} label="Fin planificado" value={fmtDt(job.planned_end)} />
          <MetaField icon={<FileText className="h-3 w-3" />} label="Tubo" value={job.tube_spec ?? "—"} />
        </div>

        {/* Step-by-step breakdown */}
        <div>
          <h3 className="text-sm font-semibold mb-2">Recorrido por etapas</h3>
          <div className="rounded border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-sidebar/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-1.5">#</th>
                  <th className="text-left px-2 py-1.5">Etapa</th>
                  <th className="text-left px-2 py-1.5">Máquina / Vendor</th>
                  <th className="text-left px-2 py-1.5">Inicio</th>
                  <th className="text-left px-2 py-1.5">Fin</th>
                  <th className="text-right px-2 py-1.5">Duración</th>
                  <th className="text-left px-2 py-1.5">Nota</th>
                </tr>
              </thead>
              <tbody>
                {job.steps.length === 0 && (
                  <tr><td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">Sin pasos registrados.</td></tr>
                )}
                {job.steps.map((s) => (
                  <StepRow key={s.id} step={s} machineName={s.machine_id ? mById[s.machine_id] ?? null : null} />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Machine runs */}
        <div>
          <div className="flex items-baseline justify-between mb-2">
            <h3 className="text-sm font-semibold">Corridas de máquina</h3>
            <span className="text-[11px] text-muted-foreground font-mono">
              {realHours.toFixed(1)} h reales · {piecesDone} piezas
            </span>
          </div>
          <div className="rounded border border-border overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-sidebar/40 text-[10px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="text-left px-2 py-1.5">Máquina</th>
                  <th className="text-left px-2 py-1.5">Operador</th>
                  <th className="text-left px-2 py-1.5">Inicio</th>
                  <th className="text-left px-2 py-1.5">Fin</th>
                  <th className="text-right px-2 py-1.5">Horas</th>
                  <th className="text-right px-2 py-1.5">Piezas</th>
                  <th className="text-left px-2 py-1.5">Nota</th>
                </tr>
              </thead>
              <tbody>
                {runs.length === 0 && (
                  <tr><td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">Sin corridas registradas.</td></tr>
                )}
                {runs.map((r) => (
                  <tr key={r.id} className="border-t border-border/50">
                    <td className="px-2 py-1.5">{mById[r.machine_id] ?? "—"}</td>
                    <td className="px-2 py-1.5">{r.operator_name ?? "—"}</td>
                    <td className="px-2 py-1.5 font-mono">{fmtDt(r.started_at)}</td>
                    <td className="px-2 py-1.5 font-mono">{fmtDt(r.ended_at)}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.ended_at ? runDurationHours(r).toFixed(1) : "—"}</td>
                    <td className="px-2 py-1.5 text-right font-mono">{r.pieces_completed}</td>
                    <td className="px-2 py-1.5 text-muted-foreground">{r.notes ?? ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {job.notes && (
          <div className="rounded border border-border bg-sidebar/30 p-3 text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">Notas: </span>
            {job.notes}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function StepRow({ step, machineName }: { step: JobStep; machineName: string | null }) {
  const dur = stepDurationHours(step);
  const tone = step.completed_at
    ? "var(--status-enviado)"
    : step.started_at
      ? "var(--status-mazak)"
      : "var(--muted-foreground)";
  return (
    <tr className="border-t border-border/50">
      <td className="px-2 py-1.5 font-mono text-muted-foreground">{step.step_order}</td>
      <td className="px-2 py-1.5">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: tone }} />
          <span className="font-semibold">{STEP_LABEL[step.step_name] ?? step.step_name}</span>
        </span>
      </td>
      <td className="px-2 py-1.5">{machineName ?? (step.vendor_id ? "Vendor externo" : "—")}</td>
      <td className="px-2 py-1.5 font-mono">{fmtDt(step.started_at)}</td>
      <td className="px-2 py-1.5 font-mono">{fmtDt(step.completed_at)}</td>
      <td className="px-2 py-1.5 text-right font-mono">{dur !== null ? `${dur} h` : "—"}</td>
      <td className="px-2 py-1.5 text-muted-foreground">{step.note ?? ""}</td>
    </tr>
  );
}

function MetricCard({
  icon,
  label,
  value,
  sub,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  sub?: string | null;
  tone?: string;
}) {
  return (
    <div className="rounded border border-border bg-sidebar/30 p-2.5">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 font-mono text-sm font-semibold" style={tone ? { color: tone } : undefined}>
        {value}
      </div>
      {sub && <div className="text-[10px] font-mono text-muted-foreground">{sub}</div>}
    </div>
  );
}

function MetaField({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 font-mono text-sm">{value}</div>
    </div>
  );
}