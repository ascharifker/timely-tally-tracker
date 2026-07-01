import type { Job, Machine } from "@/lib/fact-types";
import { STATUS_PIPELINE, STATUS_LABEL, STATUS_COLOR, type JobStatus } from "@/lib/fact-types";
import { Card } from "@/components/ui/card";
import { useUpdateJobStatus, usePartTimes } from "@/hooks/useFactData";
import { useMachineRuns } from "@/hooks/useMachineRuns";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState, Fragment } from "react";
import { ChevronRight, ChevronDown, GripVertical, AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { getUrgency, urgencyColor } from "@/lib/job-urgency";
import { jobDurationHours } from "@/lib/scheduling/duration";
import { ShippedDateDialog } from "./ShippedDateDialog";

const STATUS_HELP: Record<JobStatus, string> = {
  PLANNED: "Ingresada, sin asignar a máquina",
  MAZAK: "En MAZAK — maquinado en curso",
  TALLER_EXTERNO: "En taller externo (tercero) — maquinado fuera",
  MAQUINADO_LISTO: "Maquinado terminado, listo para tratamiento",
  CEMENTACION: "En cementación / tratamiento térmico",
  EXPO: "Lista para exportación",
  YA_SE_ENVIO: "Despachado al cliente",
  EN_ESPERA: "Pendiente de iniciar producción",
  ON_HOLD: "Detenida — esperando definición o material",
  MAQYRO: "Safety stock Maqyro",
  EN_GEMAK: "En proceso GEMAK",
  CEMENTACION_LISTO: "Cementación terminada, lista para Expo",
};

/** Statuses where cards bind to a specific machine. */
const MACHINE_BOUND: JobStatus[] = ["MAZAK", "TALLER_EXTERNO"];

/** Fixed palette indexed by machine display_order. Keeps chips visually distinct. */
const MACHINE_PALETTE = [
  "oklch(0.70 0.18 250)", // blue
  "oklch(0.72 0.18 145)", // green
  "oklch(0.78 0.17 75)",  // amber
  "oklch(0.70 0.20 25)",  // red
  "oklch(0.70 0.18 305)", // magenta
  "oklch(0.72 0.16 195)", // teal
];

function machineColor(m: Machine | undefined): string {
  if (!m) return "var(--muted)";
  return MACHINE_PALETTE[(m.display_order ?? 0) % MACHINE_PALETTE.length];
}

function machineShortLabel(m: Machine | undefined): string {
  if (!m) return "—";
  const mazak = m.name.match(/MAZAK\s*(\d+)/i);
  if (mazak) return `M${mazak[1]}`;
  return m.name.slice(0, 4).toUpperCase();
}

function formatHours(h: number): string {
  if (h <= 0) return "0h";
  if (h < 10) return `${h.toFixed(1)}h`;
  return `${Math.round(h)}h`;
}

export function StatusBoard({
  jobs,
  machines = [],
  onJobClick,
}: {
  jobs: Job[];
  machines?: Machine[];
  onJobClick?: (job: Job) => void;
}) {
  const update = useUpdateJobStatus();
  const { data: partTimes = [] } = usePartTimes();
  const { data: runs = [] } = useMachineRuns();
  const [dragOver, setDragOver] = useState<JobStatus | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [selectedMachines, setSelectedMachines] = useState<Set<string>>(new Set());
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [shipJob, setShipJob] = useState<Job | null>(null);

  const machineById = useMemo(
    () => Object.fromEntries(machines.map((m) => [m.id, m])) as Record<string, Machine>,
    [machines],
  );

  // Map job_id -> earliest open run (run with no ended_at).
  const openRunByJob = useMemo(() => {
    const m = new Map<string, typeof runs[number]>();
    for (const r of runs) {
      if (r.ended_at) continue;
      if (!m.has(r.job_id)) m.set(r.job_id, r);
    }
    return m;
  }, [runs]);

  const isFiltered = selectedMachines.size > 0;
  const isVisible = (j: Job): boolean => {
    if (!isFiltered) return true;
    if (!j.machine_id) return false;
    return selectedMachines.has(j.machine_id);
  };

  const toggleMachine = (id: string) => {
    setSelectedMachines((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (key: string) =>
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <>
    <Card className="border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">Flujo de Producción</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Arrastrá una ODT de una etapa a la siguiente para avanzarla. Total: {jobs.length} ODT{jobs.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          <GripVertical className="h-3 w-3" /> arrastrá para mover
        </div>
      </div>

      {machines.length > 0 && (
        <div className="mb-3 flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground font-mono mr-1">
            Filtrar:
          </span>
          <button
            onClick={() => setSelectedMachines(new Set())}
            className={`rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
              !isFiltered
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-sidebar/20 text-muted-foreground hover:text-foreground"
            }`}
          >
            Todas
          </button>
          {machines.map((m) => {
            const active = selectedMachines.has(m.id);
            const color = machineColor(m);
            return (
              <button
                key={m.id}
                onClick={() => toggleMachine(m.id)}
                className={`rounded border px-2 py-0.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-colors ${
                  active ? "text-background" : "text-foreground hover:opacity-80"
                }`}
                style={{
                  borderColor: color,
                  backgroundColor: active ? color : `color-mix(in oklab, ${color} 15%, transparent)`,
                }}
                title={m.name}
              >
                {machineShortLabel(m)}
              </button>
            );
          })}
        </div>
      )}

      <div
        className="grid gap-0 items-stretch"
        style={{
          gridTemplateColumns: STATUS_PIPELINE.map(() => "minmax(0,1fr) auto")
            .slice(0, STATUS_PIPELINE.length * 2 - 1)
            .join(" "),
        }}
      >
        {STATUS_PIPELINE.map((status, idx) => {
          const cards = jobs.filter((j) => j.status === status);
          const visibleCount = cards.filter(isVisible).length;
          const isOver = dragOver === status;
          const color = STATUS_COLOR[status];
          const isMachineBound = MACHINE_BOUND.includes(status);

          // Totals for header
          const totalHours = isMachineBound
            ? cards.reduce((acc, j) => acc + jobDurationHours(j, partTimes).hours, 0)
            : 0;

          // Grouping (only for machine-bound columns)
          const groups: { key: string; machine: Machine | undefined; items: Job[] }[] = [];
          if (isMachineBound) {
            const byMachine = new Map<string, Job[]>();
            const unassigned: Job[] = [];
            for (const j of cards) {
              if (!j.machine_id) unassigned.push(j);
              else {
                const arr = byMachine.get(j.machine_id) ?? [];
                arr.push(j);
                byMachine.set(j.machine_id, arr);
              }
            }
            if (unassigned.length) {
              groups.push({ key: `${status}__unassigned`, machine: undefined, items: unassigned });
            }
            const sortedIds = [...byMachine.keys()].sort((a, b) => {
              const oa = machineById[a]?.display_order ?? 999;
              const ob = machineById[b]?.display_order ?? 999;
              return oa - ob;
            });
            for (const mid of sortedIds) {
              groups.push({
                key: `${status}__${mid}`,
                machine: machineById[mid],
                items: byMachine.get(mid)!,
              });
            }
          }

          return (
            <Fragment key={status}>
            <div
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOver !== status) setDragOver(status);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragOver((s) => (s === status ? null : s));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                setDragOver(null);
                setDragId(null);
                if (!id) return;
                const job = jobs.find((j) => j.id === id);
                if (!job || job.status === status) return;
                if (status === "YA_SE_ENVIO") {
                  setShipJob(job);
                  return;
                }
                update.mutate({ id, status });
              }}
              className={`min-h-[180px] rounded-md border p-0 overflow-hidden flex flex-col transition-colors ${
                isOver
                  ? "border-primary bg-primary/10 ring-2 ring-primary/50"
                  : "border-border bg-sidebar/20 hover:bg-sidebar/40"
              }`}
            >
              <div
                className="px-2 py-1.5 border-b border-border/60"
                style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-background"
                      style={{ backgroundColor: color }}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-[11px] font-semibold truncate">{STATUS_LABEL[status]}</span>
                  </div>
                  <span
                    className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded whitespace-nowrap"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${color} 25%, transparent)`,
                      color: "var(--foreground)",
                    }}
                  >
                    {cards.length}
                    {isFiltered && visibleCount !== cards.length && (
                      <span className="opacity-60"> ({visibleCount})</span>
                    )}
                    {isMachineBound && totalHours > 0 && (
                      <span className="opacity-70"> · {formatHours(totalHours)}</span>
                    )}
                  </span>
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight truncate" title={STATUS_HELP[status]}>
                  {STATUS_HELP[status]}
                </div>
              </div>
              <div className="space-y-1.5 p-2 flex-1">
                {cards.length === 0 && (
                  <div className="flex h-full min-h-[80px] items-center justify-center rounded border border-dashed border-border/50 text-[10px] text-muted-foreground/60 uppercase tracking-widest font-mono">
                    vacío
                  </div>
                )}
                {isMachineBound
                  ? groups.map((g) => {
                      const isCollapsed = !!collapsed[g.key];
                      const mColor = g.machine ? machineColor(g.machine) : "var(--status-risk)";
                      const label = g.machine ? g.machine.name : "Sin asignar";
                      const groupHours = g.items.reduce(
                        (a, j) => a + jobDurationHours(j, partTimes).hours,
                        0,
                      );
                      return (
                        <div key={g.key} className="space-y-1">
                          <button
                            type="button"
                            onClick={() => toggleGroup(g.key)}
                            className="w-full flex items-center gap-1.5 px-1 py-0.5 rounded text-[9px] uppercase tracking-wider font-mono font-bold hover:bg-sidebar/40 transition-colors"
                            style={{ color: mColor }}
                          >
                            {isCollapsed ? (
                              <ChevronRight className="h-2.5 w-2.5" />
                            ) : (
                              <ChevronDown className="h-2.5 w-2.5" />
                            )}
                            <span className="truncate flex-1 text-left">{label}</span>
                            <span className="opacity-70">
                              {g.items.length}
                              {groupHours > 0 && ` · ${formatHours(groupHours)}`}
                            </span>
                          </button>
                          {!isCollapsed &&
                            g.items.map((j) =>
                              renderCard({
                                j,
                                machine: g.machine,
                                statusColor: color,
                                dragId,
                                setDragId,
                                setDragOver,
                                onJobClick,
                                dimmed: !isVisible(j),
                                showMachineChip: true,
                                missingMachine: !g.machine,
                                openRun: openRunByJob.get(j.id) ?? null,
                                showRunControl: true,
                              }),
                            )}
                        </div>
                      );
                    })
                  : cards.map((j) =>
                      renderCard({
                        j,
                        machine: j.machine_id ? machineById[j.machine_id] : undefined,
                        statusColor: color,
                        dragId,
                        setDragId,
                        setDragOver,
                        onJobClick,
                        dimmed: !isVisible(j),
                        showMachineChip: false,
                        missingMachine: false,
                        openRun: null,
                        showRunControl: false,
                      }),
                    )}
              </div>
            </div>
            {idx < STATUS_PIPELINE.length - 1 && (
              <div className="flex items-center justify-center px-0.5 text-muted-foreground/50">
                <ChevronRight className="h-4 w-4" />
              </div>
            )}
            </Fragment>
          );
        })}
      </div>
    </Card>
    <ShippedDateDialog job={shipJob} onClose={() => setShipJob(null)} />
    </>
  );
}

interface RenderCardArgs {
  j: Job;
  machine: Machine | undefined;
  statusColor: string;
  dragId: string | null;
  setDragId: (v: string | null) => void;
  setDragOver: (v: JobStatus | null) => void;
  onJobClick?: (j: Job) => void;
  dimmed: boolean;
  showMachineChip: boolean;
  missingMachine: boolean;
  openRun: import("@/lib/fact-types").MachineRun | null;
  showRunControl: boolean;
}

function renderCard({
  j,
  machine,
  statusColor,
  dragId,
  setDragId,
  setDragOver,
  onJobClick,
  dimmed,
  showMachineChip,
  missingMachine,
  openRun,
  showRunControl,
}: RenderCardArgs) {
  const urgency = getUrgency(j);
  const mColor = machine ? machineColor(machine) : "var(--status-risk)";
  const leftBorder = missingMachine ? "var(--status-risk)" : statusColor;
  return (
    <div
      key={j.id}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", j.id);
        e.dataTransfer.effectAllowed = "move";
        setDragId(j.id);
      }}
      onDragEnd={() => {
        setDragId(null);
        setDragOver(null);
      }}
      onClick={(e) => {
        if (e.defaultPrevented) return;
        onJobClick?.(j);
      }}
      className={`rounded border bg-card p-2 text-[11px] leading-tight cursor-grab active:cursor-grabbing select-none hover:border-primary/60 hover:shadow-sm transition-all ${
        dragId === j.id ? "opacity-40" : ""
      } ${dimmed ? "opacity-30" : ""} ${missingMachine ? "border-[color:var(--status-risk)] border-dashed" : "border-border"}`}
      style={{ borderLeft: `3px solid ${leftBorder}` }}
      title={missingMachine ? "Sin máquina asignada — abrí la ODT y asigná una, o devolvé a Planificado" : undefined}
    >
      <div className="flex items-center justify-between gap-1.5">
        <div className="flex items-center gap-1.5 min-w-0">
          {missingMachine && (
            <AlertTriangle className="h-3 w-3 shrink-0" style={{ color: "var(--status-risk)" }} />
          )}
          {showMachineChip && machine && (
            <Link
              to="/maquina/$id"
              params={{ id: machine.id }}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              draggable={false}
              className="shrink-0 rounded px-1 py-0 text-[9px] font-mono font-bold leading-tight text-background hover:ring-2 hover:ring-primary/60"
              style={{ backgroundColor: mColor }}
              title={`Ver ficha de ${machine.name}`}
            >
              {machineShortLabel(machine)}
            </Link>
          )}
          <span className="font-mono font-semibold truncate">ODT {j.odf}</span>
        </div>
        {urgency && (
          <Badge
            className="h-4 px-1 text-[9px] font-bold text-background border-0 shrink-0"
            style={{ backgroundColor: urgencyColor(urgency.kind) }}
          >
            {urgency.label}
          </Badge>
        )}
      </div>
      {j.tube_spec && <div className="text-muted-foreground truncate mt-0.5">{j.tube_spec}</div>}
      {showRunControl && machine && (
        <div className="mt-1.5 flex items-center justify-end">
          <StartStopRunButton job={j} openRun={openRun} />
        </div>
      )}
    </div>
  );
}