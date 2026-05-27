import { useEffect, useMemo, useRef, useState } from "react";
import type { Job, Machine } from "@/lib/fact-types";
import { STATUS_COLOR, STATUS_LABEL, type EventKind } from "@/lib/fact-types";
import { Card } from "@/components/ui/card";
import { useRecentDelays } from "@/hooks/useFactData";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ApproveMovesDialog, type PendingMove } from "./ApproveMovesDialog";

interface Props {
  jobs: Job[];
  machines: Machine[];
  onJobClick?: (job: Job) => void;
}

type ViewMode = "14d" | "month" | "quarter";

// Production shifts (24h coverage)
const SHIFTS = [
  { key: "manana", label: "M", name: "Mañana", startHour: 6, hours: 8, tint: "rgba(250, 204, 21, 0.08)" },
  { key: "tarde", label: "T", name: "Tarde", startHour: 14, hours: 8, tint: "rgba(56, 189, 248, 0.08)" },
  { key: "noche", label: "N", name: "Noche", startHour: 22, hours: 8, tint: "rgba(139, 92, 246, 0.10)" },
] as const;

/** Given a Date (day) and shift index, return the absolute start ms of that shift. */
function shiftStartMs(day: Date, shiftIdx: number): number {
  const d = new Date(day);
  d.setHours(SHIFTS[shiftIdx].startHour, 0, 0, 0);
  return d.getTime();
}

export function MachineGantt({ jobs, machines, onJobClick }: Props) {
  const { data: delays = [] } = useRecentDelays();
  const [dragJobId, setDragJobId] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<string | null>(null); // `${machineId}:${dayIdx}`
  const [viewMode, setViewMode] = useState<ViewMode>("14d");
  const [anchor, setAnchor] = useState<Date>(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  });
  // Drag staging: each drag updates pending moves; commit happens via dialog.
  const [pending, setPending] = useState<Map<string, PendingMove>>(new Map());
  const [approveOpen, setApproveOpen] = useState(false);

  // Track previous planned_end per job to render a ghost bar that fades out
  // when a delay is applied — makes small schedule shifts visually obvious.
  const prevEnds = useRef<Map<string, string>>(new Map());
  const [ghosts, setGhosts] = useState<
    Record<string, { start: string; end: string; expiresAt: number }>
  >({});

  useEffect(() => {
    const next: Record<string, { start: string; end: string; expiresAt: number }> = { ...ghosts };
    let changed = false;
    for (const j of jobs) {
      if (!j.planned_start || !j.planned_end) continue;
      const prev = prevEnds.current.get(j.id);
      if (prev && prev !== j.planned_end) {
        next[j.id] = {
          start: prevEnds.current.get(j.id + ":start") ?? j.planned_start,
          end: prev,
          expiresAt: Date.now() + 4000,
        };
        changed = true;
      }
      prevEnds.current.set(j.id, j.planned_end);
      prevEnds.current.set(j.id + ":start", j.planned_start);
    }
    if (changed) setGhosts(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs]);

  useEffect(() => {
    if (Object.keys(ghosts).length === 0) return;
    const t = setTimeout(() => {
      const now = Date.now();
      const filtered = Object.fromEntries(
        Object.entries(ghosts).filter(([, v]) => v.expiresAt > now),
      );
      setGhosts(filtered);
    }, 500);
    return () => clearTimeout(t);
  }, [ghosts]);

  const delayedJobIds = useMemo(
    () => new Set(delays.map((d) => d.job_id as string)),
    [delays],
  );

  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const { days, columns, dayCount } = useMemo(() => {
    if (viewMode === "14d") {
      const list = Array.from({ length: 14 }, (_, i) => {
        const d = new Date(anchor);
        d.setDate(d.getDate() + i - 2);
        return d;
      });
      return { days: list, columns: list.length, dayCount: 14 };
    }
    if (viewMode === "month") {
      const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
      const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
      const n = last.getDate();
      const list = Array.from({ length: n }, (_, i) => {
        const d = new Date(first);
        d.setDate(d.getDate() + i);
        return d;
      });
      return { days: list, columns: list.length, dayCount: n };
    }
    // quarter: 13 weeks, header per week
    const first = new Date(anchor);
    first.setDate(first.getDate() - first.getDay()); // Sunday-start week
    const weeks = 13;
    const list = Array.from({ length: weeks }, (_, i) => {
      const d = new Date(first);
      d.setDate(d.getDate() + i * 7);
      return d;
    });
    return { days: list, columns: weeks, dayCount: weeks * 7 };
  }, [viewMode, anchor]);

  const start = days[0].getTime();
  const end = start + dayCount * 24 * 60 * 60 * 1000;
  const range = end - start;

  const unscheduled = useMemo(
    () => jobs.filter((j) => !j.planned_start || !j.planned_end),
    [jobs],
  );

  const DAY_MS = 24 * 60 * 60 * 1000;
  const DEFAULT_DUR_MS = 2 * DAY_MS;

  const onCellDragOver = (e: React.DragEvent) => {
    if (!dragJobId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onCellDrop = (machineId: string, dayIdx: number, shiftIdx: number | null = null) => {
    if (!dragJobId) return;
    const job = effectiveJobs.find((j) => j.id === dragJobId);
    if (!job) return;
    const dropDay = days[dayIdx];
    // preserve time-of-day + duration if previously scheduled; else default
    let startMs: number;
    let durMs: number;
    if (job.planned_start && job.planned_end) {
      const oldStart = new Date(job.planned_start);
      durMs = new Date(job.planned_end).getTime() - oldStart.getTime();
      if (shiftIdx !== null) {
        startMs = shiftStartMs(dropDay, shiftIdx);
      } else {
        const d = new Date(dropDay);
        d.setHours(oldStart.getHours(), oldStart.getMinutes(), 0, 0);
        startMs = d.getTime();
      }
    } else {
      startMs = shiftStartMs(dropDay, shiftIdx ?? 0);
      durMs = DEFAULT_DUR_MS;
    }
    const endMs = startMs + durMs;
    const original = jobs.find((j) => j.id === dragJobId);
    setPending((prev) => {
      const next = new Map(prev);
      next.set(dragJobId, {
        jobId: dragJobId,
        odf: job.odf,
        planned_start: new Date(startMs).toISOString(),
        planned_end: new Date(endMs).toISOString(),
        machine_id: machineId,
        original_start: original?.planned_start ?? null,
        original_end: original?.planned_end ?? null,
        original_machine_id: original?.machine_id ?? null,
        eventKind: "delay",
      });
      return next;
    });
    setDragJobId(null);
    setHoverCell(null);
  };

  const shift = (dir: 1 | -1) => {
    const d = new Date(anchor);
    if (viewMode === "14d") d.setDate(d.getDate() + dir * 14);
    else if (viewMode === "month") d.setMonth(d.getMonth() + dir);
    else d.setDate(d.getDate() + dir * 91);
    setAnchor(d);
  };
  const goToday = () => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    setAnchor(t);
  };

  const headerLabel =
    viewMode === "month"
      ? anchor.toLocaleDateString("es", { month: "long", year: "numeric" })
      : `${days[0].toLocaleDateString("es", { day: "2-digit", month: "short" })} → ${new Date(end - 1).toLocaleDateString("es", { day: "2-digit", month: "short" })}`;

  const showShifts = viewMode === "14d";

  // Visual state = jobs with pending moves applied on top.
  const effectiveJobs = useMemo(() => {
    if (pending.size === 0) return jobs;
    return jobs.map((j) => {
      const p = pending.get(j.id);
      if (!p) return j;
      return {
        ...j,
        planned_start: p.planned_start,
        planned_end: p.planned_end,
        machine_id: p.machine_id,
      };
    });
  }, [jobs, pending]);

  return (
    <>
    <Card className="overflow-hidden border-border bg-card p-0">
      <div className="border-b border-border bg-sidebar/40 px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold">Cronograma por Máquina</h2>
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
            {headerLabel}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <div className="flex rounded border border-border overflow-hidden mr-2">
            {(["14d", "month", "quarter"] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setViewMode(m)}
                className={`px-2 py-1 text-[10px] uppercase tracking-widest font-mono transition-colors ${
                  viewMode === m
                    ? "bg-primary text-primary-foreground"
                    : "bg-card text-muted-foreground hover:bg-sidebar"
                }`}
              >
                {m === "14d" ? "14 días" : m === "month" ? "Mes" : "Trimestre"}
              </button>
            ))}
          </div>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => shift(-1)}>
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] uppercase tracking-widest font-mono" onClick={goToday}>
            Hoy
          </Button>
          <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => shift(1)}>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      <div className="grid border-b border-border" style={{ gridTemplateColumns: `140px 1fr` }}>
        <div className="border-r border-border px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          Máquina
          {showShifts && (
            <div className="mt-1 flex items-center gap-2 normal-case tracking-normal text-[9px]">
              {SHIFTS.map((s) => (
                <span key={s.key} className="flex items-center gap-1">
                  <span
                    className="inline-flex h-3 w-3 items-center justify-center rounded-sm text-[8px] font-bold text-foreground/80"
                    style={{ backgroundColor: s.tint.replace("0.08", "0.5").replace("0.10", "0.5") }}
                  >
                    {s.label}
                  </span>
                  <span className="text-muted-foreground">{s.name}</span>
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="grid font-mono text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {days.map((d, i) => (
            <div
              key={i}
              className={`border-r border-border px-1 py-2 text-center ${
                d.getTime() === today.getTime() ? "bg-primary/10 text-primary" : ""
              }`}
            >
              {viewMode === "quarter" ? (
                <>
                  <div>S{getWeekNumber(d)}</div>
                  <div className="text-foreground">{d.toLocaleDateString("es", { day: "2-digit", month: "short" })}</div>
                </>
              ) : (
                <>
                  <div>{d.toLocaleDateString("es", { weekday: "short" })}</div>
                  <div className="text-foreground">{d.getDate()}</div>
                  {showShifts && (
                    <div className="mt-1 grid grid-cols-3 gap-px text-[8px]">
                      {SHIFTS.map((s) => (
                        <span key={s.key} className="text-muted-foreground/70">{s.label}</span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {machines.map((m) => {
        const rowJobs = effectiveJobs.filter(
          (j) => j.machine_id === m.id && j.planned_start && j.planned_end,
        );
        return (
          <div
            key={m.id}
            className="grid border-b border-border/60 hover:bg-sidebar/30"
            style={{ gridTemplateColumns: `140px 1fr` }}
          >
            <div className="border-r border-border px-3 py-3 flex flex-col justify-center">
              <div className="text-sm font-semibold">{m.name}</div>
              <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                {m.type === "internal" ? "interna" : "taller externo"}
              </div>
            </div>
            <div className="relative h-14">
              <div
                className="absolute inset-0 grid"
                style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
              >
                {days.map((d, i) => (
                  <div
                    key={i}
                    className={`relative border-r border-border/40 ${
                      d.getTime() === today.getTime() ? "bg-primary/5" : ""
                    }`}
                  >
                    {showShifts ? (
                      <div className="absolute inset-0 grid grid-cols-3">
                        {SHIFTS.map((s, sIdx) => {
                          const cellKey = `${m.id}:${i}:${sIdx}`;
                          const isHover = hoverCell === cellKey;
                          return (
                            <div
                              key={s.key}
                              onDragOver={onCellDragOver}
                              onDragEnter={() => dragJobId && setHoverCell(cellKey)}
                              onDragLeave={() => hoverCell === cellKey && setHoverCell(null)}
                              onDrop={() => onCellDrop(m.id, i, sIdx)}
                              className={`border-r border-border/20 last:border-r-0 transition-colors ${
                                isHover ? "bg-primary/25 ring-1 ring-primary ring-inset" : ""
                              }`}
                              style={!isHover ? { backgroundColor: s.tint } : undefined}
                              title={`${s.name} · ${s.startHour}:00 – ${(s.startHour + s.hours) % 24}:00`}
                            />
                          );
                        })}
                      </div>
                    ) : (
                      <div
                        onDragOver={onCellDragOver}
                        onDragEnter={() => dragJobId && setHoverCell(`${m.id}:${i}`)}
                        onDragLeave={() => hoverCell === `${m.id}:${i}` && setHoverCell(null)}
                        onDrop={() => onCellDrop(m.id, i)}
                        className={`absolute inset-0 transition-colors ${
                          hoverCell === `${m.id}:${i}` ? "bg-primary/20 ring-1 ring-primary ring-inset" : ""
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
              {rowJobs.map((j) => {
                const s = new Date(j.planned_start as string).getTime();
                const e = new Date(j.planned_end as string).getTime();
                const left = Math.max(0, ((s - start) / range) * 100);
                const width = Math.max(2, ((Math.min(e, end) - Math.max(s, start)) / range) * 100);
                if (left >= 100 || left + width <= 0) return null;
                const ghost = ghosts[j.id];
                const hasDelay = delayedJobIds.has(j.id);
                const pendingMove = pending.get(j.id);
                return (
                  <div key={j.id}>
                    {ghost && (() => {
                      const gs = new Date(ghost.start).getTime();
                      const ge = new Date(ghost.end).getTime();
                      const gl = Math.max(0, ((gs - start) / range) * 100);
                      const gw = Math.max(2, ((Math.min(ge, end) - Math.max(gs, start)) / range) * 100);
                      return (
                        <div
                          className="absolute top-2 h-10 rounded border-2 border-dashed border-[color:var(--status-risk)]/60 pointer-events-none animate-pulse"
                          style={{ left: `${gl}%`, width: `${gw}%`, opacity: 0.35 }}
                        />
                      );
                    })()}
                    {pendingMove && pendingMove.original_start && pendingMove.original_end && (() => {
                      const os = new Date(pendingMove.original_start).getTime();
                      const oe = new Date(pendingMove.original_end).getTime();
                      const ol = Math.max(0, ((os - start) / range) * 100);
                      const ow = Math.max(2, ((Math.min(oe, end) - Math.max(os, start)) / range) * 100);
                      if (ol >= 100 || ol + ow <= 0) return null;
                      return (
                        <div
                          className="absolute top-2 h-10 rounded border border-dashed border-muted-foreground/50 bg-muted/20 pointer-events-none"
                          style={{ left: `${ol}%`, width: `${ow}%` }}
                          title="Posición original"
                        />
                      );
                    })()}
                  <button
                    draggable
                    onDragStart={(e) => {
                      setDragJobId(j.id);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => { setDragJobId(null); setHoverCell(null); }}
                    onClick={() => onJobClick?.(j)}
                    className={`absolute top-2 h-10 rounded px-2 text-left text-[11px] text-background font-medium shadow-sm transition-all duration-500 hover:translate-y-[-1px] hover:shadow-md cursor-grab active:cursor-grabbing ${
                      dragJobId === j.id ? "opacity-50" : ""
                    } ${pendingMove ? "ring-2 ring-amber-400 ring-offset-1 ring-offset-card" : ""}`}
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: STATUS_COLOR[j.status],
                    }}
                    title={`ODF ${j.odf} · ${STATUS_LABEL[j.status]}${pendingMove ? " · pendiente de aprobar" : ""}`}
                  >
                    {hasDelay && (
                      <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[color:var(--status-risk)] ring-2 ring-card" />
                    )}
                    <div className="font-mono leading-tight truncate">ODF {j.odf}</div>
                    <div className="text-[10px] opacity-80 truncate">{j.tube_spec ?? ""}</div>
                  </button>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
      {unscheduled.length > 0 && (
        <div
          className="grid border-t-2 border-dashed border-border bg-sidebar/20"
          style={{ gridTemplateColumns: `140px 1fr` }}
        >
          <div className="border-r border-border px-3 py-3 flex flex-col justify-center">
            <div className="text-sm font-semibold text-muted-foreground">Sin programar</div>
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
              {unscheduled.length} ODF{unscheduled.length === 1 ? "" : "s"}
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5 p-2">
            {unscheduled.map((j) => (
              <button
                key={j.id}
                draggable
                onDragStart={(e) => {
                  setDragJobId(j.id);
                  e.dataTransfer.effectAllowed = "move";
                }}
                onDragEnd={() => { setDragJobId(null); setHoverCell(null); }}
                onClick={() => onJobClick?.(j)}
                className={`rounded border border-border bg-card px-2 py-1 text-[11px] hover:border-primary hover:bg-primary/5 transition-colors flex items-center gap-1.5 cursor-grab active:cursor-grabbing ${
                  dragJobId === j.id ? "opacity-50" : ""
                }`}
                title={`ODF ${j.odf} · ${STATUS_LABEL[j.status]} · arrastrá al cronograma o click para editar`}
              >
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[j.status] }} />
                <span className="font-mono font-semibold">ODF {j.odf}</span>
                <span className="text-muted-foreground">{j.tube_spec ?? ""}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </Card>
    {pending.size > 0 && (
      <div className="sticky bottom-3 z-30 mt-3 flex items-center justify-between gap-3 rounded-lg border border-amber-400/60 bg-amber-50/95 dark:bg-amber-950/40 px-4 py-2.5 shadow-lg">
        <div className="text-sm">
          <span className="font-semibold">{pending.size}</span> movimiento{pending.size === 1 ? "" : "s"} pendiente{pending.size === 1 ? "" : "s"} de aprobar
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" onClick={() => setPending(new Map())}>
            Descartar
          </Button>
          <Button size="sm" onClick={() => setApproveOpen(true)}>
            Aprobar movimientos
          </Button>
        </div>
      </div>
    )}
    <ApproveMovesDialog
      open={approveOpen}
      onClose={() => setApproveOpen(false)}
      moves={Array.from(pending.values())}
      machines={machines}
      onApplied={() => { setPending(new Map()); setApproveOpen(false); }}
      onUpdateKind={(jobId, kind) => {
        setPending((prev) => {
          const next = new Map(prev);
          const m = next.get(jobId);
          if (m) next.set(jobId, { ...m, eventKind: kind });
          return next;
        });
      }}
      onRemove={(jobId) => {
        setPending((prev) => {
          const next = new Map(prev);
          next.delete(jobId);
          return next;
        });
      }}
    />
    </>
  );
}

function getWeekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}