import { useEffect, useMemo, useRef, useState } from "react";
import type { Job, Machine } from "@/lib/fact-types";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/fact-types";
import { Card } from "@/components/ui/card";
import { useRecentDelays, useRedistributeSchedules, usePartTimes } from "@/hooks/useFactData";
import { jobDurationHours } from "@/lib/scheduling/duration";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Shuffle } from "lucide-react";
import { ApproveMovesDialog, type PendingMove } from "./ApproveMovesDialog";
import { SHIFTS, shiftStartMs, shiftIndexFromDate, shiftSpan, snapToShift } from "@/lib/shifts";

interface Props {
  jobs: Job[];
  machines: Machine[];
  onJobClick?: (job: Job) => void;
}

type ViewMode = "14d" | "month" | "quarter";

// Pixel width per column for each view mode. Keeps the day grid and shift
// sub-bands pixel-aligned with the absolutely-positioned ODF bars.
const COL_WIDTH: Record<ViewMode, number> = {
  "14d": 180,
  month: 56,
  quarter: 110,
};
const MACHINE_COL_WIDTH = 160;
const ROW_HEIGHT = 96;

export function MachineGantt({ jobs, machines, onJobClick }: Props) {
  const { data: delays = [] } = useRecentDelays();
  const { data: partTimes = [] } = usePartTimes();
  const redistribute = useRedistributeSchedules();
  const [dragJobId, setDragJobId] = useState<string | null>(null);
  const [hoverJobId, setHoverJobId] = useState<string | null>(null);
  const [hoverCell, setHoverCell] = useState<string | null>(null); // `${machineId}:${dayIdx}`
  const [viewMode, setViewMode] = useState<ViewMode>("14d");
  // Which shifts are visible. When exactly one is selected, the Gantt enters
  // "single-shift mode": each day collapses to that 8h band, other bars hide.
  const [shiftFilter, setShiftFilter] = useState<Set<number>>(new Set([0, 1, 2]));
  const soloShift = shiftFilter.size === 1 ? [...shiftFilter][0] : null;
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
  const toggleShift = (idx: number) => {
    setShiftFilter((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) {
        if (next.size === 1) return new Set([0, 1, 2]); // re-enable all
        next.delete(idx);
      } else {
        next.add(idx);
      }
      return next;
    });
  };

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

  // Move/nudge a bar to a different shift without dragging.
  // Same machine, same calendar day, snap to shift start.
  const moveJobToShift = (jobId: string, targetShiftIdx: number, dayDelta = 0) => {
    const job = effectiveJobs.find((j) => j.id === jobId);
    if (!job || !job.planned_start || !job.planned_end) return;
    const oldStart = new Date(job.planned_start);
    const durMs = new Date(job.planned_end).getTime() - oldStart.getTime();
    const baseDay = new Date(oldStart);
    baseDay.setDate(baseDay.getDate() + dayDelta);
    const newStart = snapToShift(baseDay, targetShiftIdx);
    const newEnd = new Date(newStart.getTime() + durMs);
    const original = jobs.find((j) => j.id === jobId);
    setPending((prev) => {
      const next = new Map(prev);
      next.set(jobId, {
        jobId,
        odf: job.odf,
        planned_start: newStart.toISOString(),
        planned_end: newEnd.toISOString(),
        machine_id: job.machine_id ?? original?.machine_id ?? "",
        original_start: original?.planned_start ?? null,
        original_end: original?.planned_end ?? null,
        original_machine_id: original?.machine_id ?? null,
        eventKind: "delay",
      });
      return next;
    });
  };

  // Shift load: how many bars currently touch each shift band in the visible window.
  const shiftLoad = useMemo(() => {
    const counts = [0, 0, 0];
    for (const j of effectiveJobs) {
      if (!j.planned_start || !j.planned_end) continue;
      const js = new Date(j.planned_start).getTime();
      const je = new Date(j.planned_end).getTime();
      if (je < start || js > end) continue;
      for (const idx of shiftSpan(j.planned_start, j.planned_end)) {
        counts[idx]++;
      }
    }
    return counts;
  }, [effectiveJobs, start, end]);

  return (
    <>
    <Card className="overflow-hidden border-zinc-800 bg-[#121214] p-0 font-sans text-zinc-300 shadow-2xl">
      {/* ============== HEADER ============== */}
      <div className="border-b border-zinc-800 bg-[#18181b]/60 p-4 space-y-3">
        {/* Row 1: title + actions */}
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white tracking-tight">Cronograma por Máquina</h2>
            <span className="px-2.5 py-0.5 bg-zinc-800 rounded-full text-[10px] font-medium text-zinc-400 border border-zinc-700 uppercase tracking-widest">
              {headerLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => redistribute.mutate()}
              disabled={redistribute.isPending}
              title="Redistribuye automáticamente todos los ODFs programados en bloques M/T/N"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500 hover:bg-yellow-400 disabled:opacity-50 text-black text-[11px] font-bold rounded uppercase tracking-wider transition-colors"
            >
              <Shuffle className="h-3.5 w-3.5" />
              {redistribute.isPending ? "Redistribuyendo…" : "Redistribuir"}
            </button>
            <div className="flex bg-zinc-800 p-1 rounded-lg border border-zinc-700">
              {(["14d", "month", "quarter"] as ViewMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setViewMode(m)}
                  className={`px-3 py-1 text-[11px] font-semibold uppercase tracking-tight rounded-md transition-colors ${
                    viewMode === m
                      ? "bg-zinc-700 text-white shadow-sm"
                      : "text-zinc-400 hover:text-zinc-200"
                  }`}
                >
                  {m === "14d" ? "14 Días" : m === "month" ? "Mes" : "Trimestre"}
                </button>
              ))}
            </div>
            <div className="flex gap-1 ml-1">
              <button
                onClick={() => shift(-1)}
                className="p-1.5 hover:bg-zinc-800 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                onClick={goToday}
                className="px-3 py-1.5 hover:bg-zinc-800 rounded border border-zinc-700 text-[11px] font-bold uppercase tracking-tight text-zinc-300 hover:text-white transition-colors"
              >
                Hoy
              </button>
              <button
                onClick={() => shift(1)}
                className="p-1.5 hover:bg-zinc-800 rounded border border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Row 2: carga + shift filter */}
        <div className="flex items-center justify-between gap-4 pt-2 border-t border-zinc-800/60 flex-wrap">
          <div className="flex items-center gap-3">
            <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Carga:</span>
            <div className="flex items-center gap-3">
              {SHIFTS.map((s, i) => (
                <div key={s.key} className="flex items-center gap-1.5 text-[11px] font-mono">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
                  <span className="text-zinc-400">{s.label}:</span>
                  <span className="text-white font-bold">{shiftLoad[i]}</span>
                </div>
              ))}
            </div>
          </div>

          {showShifts && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">
                Filtro Turnos:
              </span>
              <div className="flex gap-2">
                {SHIFTS.map((s, i) => {
                  const active = shiftFilter.has(i);
                  return (
                    <button
                      key={s.key}
                      onClick={() => toggleShift(i)}
                      className={`flex items-center gap-2 px-3 py-1 rounded-full border text-[11px] font-bold transition-all ${
                        active ? "" : "opacity-40 hover:opacity-70"
                      }`}
                      style={{
                        backgroundColor: `${s.color}1a`,
                        borderColor: `${s.color}4d`,
                        color: s.color,
                      }}
                      title={`${s.name} · ${String(s.startHour).padStart(2, "0")}:00–${String((s.startHour + s.hours) % 24).padStart(2, "0")}:00`}
                    >
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                      {s.name}
                    </button>
                  );
                })}
                {soloShift !== null && (
                  <button
                    onClick={() => setShiftFilter(new Set([0, 1, 2]))}
                    className="text-[10px] text-zinc-500 hover:text-zinc-300 underline-offset-2 hover:underline px-2"
                  >
                    ver todos
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ============== GANTT GRID ============== */}
      <div className="relative flex overflow-x-auto bg-[#121214]">
        {/* Left sticky machine column */}
        <div
          className="sticky left-0 z-30 bg-[#121214] border-r border-zinc-800 shadow-[4px_0_15px_rgba(0,0,0,0.5)]"
          style={{ width: MACHINE_COL_WIDTH, minWidth: MACHINE_COL_WIDTH }}
        >
          <div className="h-16 flex items-center px-4 border-b border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
            Máquina
          </div>
          <div className="divide-y divide-zinc-800/60">
            {machines.map((m, idx) => (
              <div
                key={m.id}
                className={`px-4 flex flex-col justify-center ${
                  idx % 2 === 0 ? "bg-zinc-900/30" : ""
                } ${m.type === "external_shop" ? "bg-[#18181b]" : ""}`}
                style={{ height: ROW_HEIGHT }}
              >
                {m.type === "external_shop" && (
                  <div className="text-[10px] font-bold text-yellow-500/80 uppercase italic tracking-wide">
                    Taller Externo
                  </div>
                )}
                <div className="text-sm font-bold text-white">{m.name}</div>
                <div className="text-[10px] text-zinc-500 font-mono uppercase">
                  {m.type === "internal" ? "interna" : "externo"}
                </div>
              </div>
            ))}
            {unscheduled.length > 0 && (
              <div
                className="px-4 flex flex-col justify-center bg-zinc-950/40 border-t-2 border-dashed border-zinc-700"
                style={{ height: ROW_HEIGHT }}
              >
                <div className="text-sm font-bold text-zinc-400">Sin programar</div>
                <div className="text-[10px] text-zinc-500 font-mono uppercase tracking-widest">
                  {unscheduled.length} ODF{unscheduled.length === 1 ? "" : "s"}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Timeline */}
        <div style={{ width: columns * COL_WIDTH[viewMode], minWidth: columns * COL_WIDTH[viewMode] }}>
          {/* Day headers */}
          <div className="flex h-16 border-b border-zinc-800">
            {days.map((d, i) => {
              const isToday = d.getTime() === today.getTime();
              return (
                <div
                  key={i}
                  className={`flex-none flex flex-col border-r border-zinc-800/40 ${
                    isToday ? "ring-1 ring-inset ring-yellow-500/40 bg-yellow-500/[0.03]" : ""
                  }`}
                  style={{ width: COL_WIDTH[viewMode] }}
                >
                  <div
                    className={`h-8 flex items-center justify-center border-b border-zinc-800/30 ${
                      isToday ? "bg-yellow-500/10" : "bg-zinc-900/30"
                    }`}
                  >
                    {viewMode === "quarter" ? (
                      <span className="text-[10px] font-bold uppercase tracking-tight text-zinc-400">
                        S{getWeekNumber(d)}{" "}
                        <span className="text-white ml-1">
                          {d.toLocaleDateString("es", { day: "2-digit", month: "short" })}
                        </span>
                      </span>
                    ) : (
                      <span
                        className={`text-[11px] font-bold uppercase tracking-tight ${
                          isToday ? "text-yellow-500" : "text-zinc-400"
                        }`}
                      >
                        {d.toLocaleDateString("es", { weekday: "short" })}{" "}
                        <span
                          className={`ml-1 ${isToday ? "text-white font-black underline decoration-yellow-500" : "text-white"}`}
                        >
                          {d.getDate()}
                        </span>
                      </span>
                    )}
                  </div>
                  {/* Shift sub-bands (only 14d view) */}
                  {showShifts ? (
                    <div className="flex flex-1">
                      {SHIFTS.map((s, sIdx) => {
                        const visible = shiftFilter.has(sIdx);
                        const isFocus = soloShift === sIdx;
                        return (
                          <div
                            key={s.key}
                            className="flex-1 flex items-center justify-center border-r border-zinc-800/20 last:border-r-0 transition-opacity"
                            style={{
                              backgroundColor: `${s.color}${isFocus ? "33" : visible ? "26" : "0d"}`,
                              opacity: visible ? 1 : 0.5,
                            }}
                          >
                            <span
                              className="text-[11px] font-black tracking-wider"
                              style={{
                                color: s.color,
                                opacity: visible ? (isFocus ? 1 : 0.85) : 0.3,
                              }}
                            >
                              {s.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex-1 bg-zinc-900/20" />
                  )}
                </div>
              );
            })}
          </div>

          {/* Machine rows */}
          <div className="relative">
            {machines.map((m, mIdx) => {
              const rowJobs = effectiveJobs.filter(
                (j) => j.machine_id === m.id && j.planned_start && j.planned_end,
              );
              return (
                <div
                  key={m.id}
                  className={`relative border-b border-zinc-800/50 group ${
                    mIdx % 2 === 0 ? "bg-zinc-900/20" : ""
                  } ${m.type === "external_shop" ? "bg-[#18181b]" : ""}`}
                  style={{ height: ROW_HEIGHT }}
                >
                  {/* Background drop grid: day x shift sub-bands */}
                  <div className="absolute inset-0 flex">
                    {days.map((d, i) => {
                      const isToday = d.getTime() === today.getTime();
                      return (
                        <div
                          key={i}
                          className={`flex-none flex border-r border-zinc-800/40 ${
                            isToday ? "bg-yellow-500/[0.02]" : ""
                          }`}
                          style={{ width: COL_WIDTH[viewMode] }}
                        >
                          {showShifts ? (
                            SHIFTS.map((s, sIdx) => {
                              const cellKey = `${m.id}:${i}:${sIdx}`;
                              const isHover = hoverCell === cellKey;
                              const visible = shiftFilter.has(sIdx);
                              const isFocus = soloShift === sIdx;
                              return (
                                <div
                                  key={s.key}
                                  onDragOver={onCellDragOver}
                                  onDragEnter={() => dragJobId && setHoverCell(cellKey)}
                                  onDragLeave={() => hoverCell === cellKey && setHoverCell(null)}
                                  onDrop={() => onCellDrop(m.id, i, sIdx)}
                                  className="flex-1 border-r border-zinc-800/20 last:border-r-0 transition-all"
                                  style={{
                                    backgroundColor: isHover
                                      ? `${s.color}66`
                                      : `${s.color}${isFocus ? "1f" : visible ? "12" : "06"}`,
                                    boxShadow: isHover ? `inset 0 0 0 2px ${s.color}` : undefined,
                                  }}
                                  title={`${s.name} · ${String(s.startHour).padStart(2, "0")}:00 – ${String((s.startHour + s.hours) % 24).padStart(2, "0")}:00`}
                                />
                              );
                            })
                          ) : (
                            <div
                              onDragOver={onCellDragOver}
                              onDragEnter={() => dragJobId && setHoverCell(`${m.id}:${i}`)}
                              onDragLeave={() => hoverCell === `${m.id}:${i}` && setHoverCell(null)}
                              onDrop={() => onCellDrop(m.id, i)}
                              className={`flex-1 transition-colors ${
                                hoverCell === `${m.id}:${i}` ? "bg-primary/20" : ""
                              }`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Job bars (absolute positioned over the grid) */}
                  {rowJobs.map((j) => {
                    const s = new Date(j.planned_start as string).getTime();
                    const e = new Date(j.planned_end as string).getTime();
                    const timelineWidth = columns * COL_WIDTH[viewMode];
                    const leftPx = Math.max(0, ((s - start) / range) * timelineWidth);
                    const widthPx = Math.max(
                      24,
                      ((Math.min(e, end) - Math.max(s, start)) / range) * timelineWidth,
                    );
                    if (leftPx >= timelineWidth || leftPx + widthPx <= 0) return null;
                    const jobShiftIdx = shiftIndexFromDate(j.planned_start as string);
                    const dimmedByFilter = showShifts && !shiftFilter.has(jobShiftIdx);
                    const ghost = ghosts[j.id];
                    const hasDelay = delayedJobIds.has(j.id);
                    const pendingMove = pending.get(j.id);
                    const shiftMeta = SHIFTS[jobShiftIdx];
                    const spannedShifts = showShifts
                      ? shiftSpan(j.planned_start as string, j.planned_end as string)
                      : [jobShiftIdx];
                    const isHovered = hoverJobId === j.id;
                    return (
                      <div key={j.id}>
                        {ghost && (() => {
                          const gs = new Date(ghost.start).getTime();
                          const ge = new Date(ghost.end).getTime();
                          const gl = Math.max(0, ((gs - start) / range) * timelineWidth);
                          const gw = Math.max(
                            24,
                            ((Math.min(ge, end) - Math.max(gs, start)) / range) * timelineWidth,
                          );
                          return (
                            <div
                              className="absolute top-6 h-12 rounded border-2 border-dashed border-[color:var(--status-risk)]/60 pointer-events-none animate-pulse"
                              style={{ left: gl, width: gw, opacity: 0.35 }}
                            />
                          );
                        })()}
                        {pendingMove && pendingMove.original_start && pendingMove.original_end && (() => {
                          const os = new Date(pendingMove.original_start).getTime();
                          const oe = new Date(pendingMove.original_end).getTime();
                          const ol = Math.max(0, ((os - start) / range) * timelineWidth);
                          const ow = Math.max(
                            24,
                            ((Math.min(oe, end) - Math.max(os, start)) / range) * timelineWidth,
                          );
                          if (ol >= timelineWidth || ol + ow <= 0) return null;
                          return (
                            <div
                              className="absolute top-6 h-12 rounded border border-dashed border-zinc-500/50 bg-zinc-700/20 pointer-events-none"
                              style={{ left: ol, width: ow }}
                              title="Posición original"
                            />
                          );
                        })()}
                        <button
                          draggable
                          onDragStart={(ev) => {
                            setDragJobId(j.id);
                            ev.dataTransfer.effectAllowed = "move";
                          }}
                          onDragEnd={() => { setDragJobId(null); setHoverCell(null); }}
                          onMouseEnter={() => setHoverJobId(j.id)}
                          onMouseLeave={() => setHoverJobId((id) => (id === j.id ? null : id))}
                          onClick={() => onJobClick?.(j)}
                          className={`absolute top-6 h-12 rounded-r-md pl-2 pr-1.5 text-left flex items-center bg-zinc-800 hover:bg-zinc-700 shadow-lg z-10 transition-all duration-200 hover:-translate-y-px hover:shadow-xl cursor-grab active:cursor-grabbing ${
                            dragJobId === j.id ? "opacity-50" : ""
                          } ${pendingMove ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#121214]" : ""} ${dimmedByFilter ? "opacity-30" : ""}`}
                          style={{
                            left: leftPx,
                            width: widthPx,
                            borderLeft: `4px solid ${shiftMeta.color}`,
                            boxShadow: `inset 3px 0 0 ${STATUS_COLOR[j.status]}33, 0 2px 8px rgba(0,0,0,0.4)`,
                          }}
                          title={`ODF ${j.odf} · ${STATUS_LABEL[j.status]} · Turnos ${spannedShifts.map((i) => SHIFTS[i].label).join("→")}${pendingMove ? " · pendiente de aprobar" : ""}`}
                        >
                          {hasDelay && (
                            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[color:var(--status-risk)] ring-2 ring-[#121214]" />
                          )}
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[11px] font-black text-white leading-none truncate">
                              ODF {j.odf}
                            </span>
                            {j.tube_spec && (
                              <span className="text-[9px] text-zinc-400 font-medium uppercase mt-0.5 truncate">
                                {j.tube_spec}
                              </span>
                            )}
                          </div>
                          {showShifts && widthPx > 80 && (
                            <div className="ml-auto flex items-center gap-px shrink-0">
                              {spannedShifts.map((sIdx) => (
                                <span
                                  key={sIdx}
                                  className="inline-flex h-4 w-4 items-center justify-center rounded-sm text-[9px] font-black"
                                  style={{
                                    backgroundColor: `${SHIFTS[sIdx].color}26`,
                                    color: SHIFTS[sIdx].color,
                                  }}
                                  title={SHIFTS[sIdx].name}
                                >
                                  {SHIFTS[sIdx].label}
                                </span>
                              ))}
                            </div>
                          )}
                          <div
                            className="absolute bottom-0 left-0 h-0.5 rounded-bl-sm"
                            style={{ width: "100%", backgroundColor: STATUS_COLOR[j.status] }}
                          />
                        </button>
                        {showShifts && isHovered && !dragJobId && (
                          <div
                            className="absolute z-20 flex items-center gap-0.5 rounded-md border border-zinc-700 bg-zinc-900 px-1 py-0.5 shadow-xl"
                            style={{
                              left: leftPx + Math.max(widthPx, 24) / 2,
                              top: 0,
                              transform: "translate(-50%, 0)",
                            }}
                            onMouseEnter={() => setHoverJobId(j.id)}
                            onMouseLeave={() => setHoverJobId((id) => (id === j.id ? null : id))}
                          >
                            <button
                              onClick={(ev) => { ev.stopPropagation(); moveJobToShift(j.id, jobShiftIdx, -1); }}
                              className="rounded p-0.5 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200"
                              title="Día anterior"
                            >
                              <ChevronLeft className="h-3 w-3" />
                            </button>
                            {SHIFTS.map((s, sIdx) => {
                              const active = jobShiftIdx === sIdx;
                              return (
                                <button
                                  key={s.key}
                                  onClick={(ev) => { ev.stopPropagation(); moveJobToShift(j.id, sIdx); }}
                                  className={`inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold transition-all ${
                                    active ? "text-white scale-110" : "text-zinc-400 hover:text-white hover:scale-105"
                                  }`}
                                  style={{
                                    backgroundColor: active ? s.color : `${s.color}26`,
                                    boxShadow: active ? `0 0 0 1px ${s.color}` : undefined,
                                  }}
                                  title={`Mover a ${s.name}`}
                                >
                                  {s.label}
                                </button>
                              );
                            })}
                            <button
                              onClick={(ev) => { ev.stopPropagation(); moveJobToShift(j.id, jobShiftIdx, 1); }}
                              className="rounded p-0.5 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-200"
                              title="Día siguiente"
                            >
                              <ChevronRight className="h-3 w-3" />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}

            {/* Unscheduled row */}
            {unscheduled.length > 0 && (
              <div
                className="relative border-t-2 border-dashed border-zinc-700 bg-zinc-950/40"
                style={{ height: ROW_HEIGHT }}
              >
                <div className="absolute inset-0 p-2 flex flex-wrap gap-1.5 content-start overflow-auto">
                  {unscheduled.map((j) => (
                    <button
                      key={j.id}
                      draggable
                      onDragStart={(ev) => {
                        setDragJobId(j.id);
                        ev.dataTransfer.effectAllowed = "move";
                      }}
                      onDragEnd={() => { setDragJobId(null); setHoverCell(null); }}
                      onClick={() => onJobClick?.(j)}
                      className={`rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] hover:border-yellow-500/60 hover:bg-zinc-800 transition-colors flex items-center gap-1.5 cursor-grab active:cursor-grabbing ${
                        dragJobId === j.id ? "opacity-50" : ""
                      }`}
                      title={`ODF ${j.odf} · ${STATUS_LABEL[j.status]} · arrastrá al cronograma`}
                    >
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[j.status] }} />
                      <span className="font-mono font-bold text-white">ODF {j.odf}</span>
                      {j.tube_spec && <span className="text-zinc-500">{j.tube_spec}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ============== FOOTER LEGEND ============== */}
      <div className="p-3 border-t border-zinc-800 bg-[#0c0c0e] flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-5 flex-wrap">
          {SHIFTS.map((s) => (
            <div key={s.key} className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: s.color }} />
              <span className="text-[10px] uppercase font-bold text-zinc-500">
                {s.name} ({String(s.startHour).padStart(2, "0")}:00 –{" "}
                {String((s.startHour + s.hours) % 24).padStart(2, "0")}:00)
              </span>
            </div>
          ))}
        </div>
        <div className="text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
          {machines.length} máquina{machines.length === 1 ? "" : "s"} · {effectiveJobs.filter(j => j.planned_start).length} ODFs programadas
        </div>
      </div>
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