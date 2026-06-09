import { useEffect, useMemo, useRef, useState } from "react";
import type { Job, Machine } from "@/lib/fact-types";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/fact-types";
import { Card } from "@/components/ui/card";
import { useRecentDelays, useRedistributeSchedules, usePartTimes } from "@/hooks/useFactData";
import { jobDurationHours } from "@/lib/scheduling/duration";
import { packLanesByMachine } from "@/lib/scheduling/lanes";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronLeft, ChevronRight, ChevronUp, Shuffle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { ApproveMovesDialog, type PendingMove } from "./ApproveMovesDialog";
import { SHIFTS, shiftStartMs, shiftIndexFromDate, shiftSpan, snapToShift } from "@/lib/shifts";

interface Props {
  jobs: Job[];
  machines: Machine[];
  onJobClick?: (job: Job) => void;
}

type ViewMode = "14d" | "month" | "quarter";

// Base pixel widths. In 14d mode each day = 3 × SHIFT_W; in month/quarter
// a day is one cell that fills DAY_W.
const SHIFT_W = 64;
const DAY_W_NORMAL = SHIFT_W * 3; // 192
const COLLAPSED_SHIFT_W = 14; // width of off-focus shift columns in focus mode
const DAY_W_FOCUS = COLLAPSED_SHIFT_W * 2 + SHIFT_W * 2.4; // ~181 — keep day width stable
const DAY_W_MONTH = 56;
const DAY_W_QUARTER = 110;
const MACHINE_COL_WIDTH = 160;
const BASE_ROW_PADDING = 16; // top+bottom padding around lanes
const LANE_HEIGHT = 48;
const LANE_GAP = 6;
const HOUR_MS = 60 * 60 * 1000;
const SHIFT_MS = 8 * HOUR_MS;

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
  const [unschedOpen, setUnschedOpen] = useState(false);
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

  const showShifts = viewMode === "14d";

  // --------------------------------------------------------------------------
  // Variable-width segment model. In 14d mode each day is split into 3 shift
  // segments; in focus mode, two of those collapse to COLLAPSED_SHIFT_W.
  // In month/quarter the whole day is a single segment.
  // --------------------------------------------------------------------------
  type Segment = {
    dayIdx: number;
    shiftIdx: number; // 0/1/2 in 14d, or 0 when not showing shifts
    startMs: number;
    endMs: number;
    leftPx: number;
    widthPx: number;
    isFullDay: boolean;
  };

  const { segments, timelineWidth, dayWidths } = useMemo(() => {
    const segs: Segment[] = [];
    const dWidths: number[] = [];
    let cursor = 0;
    for (let i = 0; i < days.length; i++) {
      const d = days[i];
      if (showShifts) {
        let dayWidth = 0;
        for (let s = 0; s < 3; s++) {
          let w = SHIFT_W;
          if (soloShift !== null) {
            w = s === soloShift ? SHIFT_W * 2.4 : COLLAPSED_SHIFT_W;
          }
          const segStart = shiftStartMs(d, s);
          segs.push({
            dayIdx: i,
            shiftIdx: s,
            startMs: segStart,
            endMs: segStart + SHIFT_MS,
            leftPx: cursor,
            widthPx: w,
            isFullDay: false,
          });
          cursor += w;
          dayWidth += w;
        }
        dWidths.push(dayWidth);
      } else {
        const w = viewMode === "month" ? DAY_W_MONTH : DAY_W_QUARTER;
        const cellMs = viewMode === "quarter" ? 7 * 24 * HOUR_MS : 24 * HOUR_MS;
        segs.push({
          dayIdx: i,
          shiftIdx: 0,
          startMs: d.getTime(),
          endMs: d.getTime() + cellMs,
          leftPx: cursor,
          widthPx: w,
          isFullDay: true,
        });
        cursor += w;
        dWidths.push(w);
      }
    }
    return { segments: segs, timelineWidth: cursor, dayWidths: dWidths };
  }, [days, showShifts, soloShift, viewMode]);

  /** Map an absolute ms timestamp to a pixel x within the timeline. */
  const msToPx = (ms: number): number => {
    if (segments.length === 0) return 0;
    if (ms <= segments[0].startMs) return 0;
    const last = segments[segments.length - 1];
    if (ms >= last.endMs) return last.leftPx + last.widthPx;
    // binary search for the segment containing ms
    let lo = 0, hi = segments.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (segments[mid].endMs <= ms) lo = mid + 1;
      else hi = mid;
    }
    const seg = segments[lo];
    const frac = (ms - seg.startMs) / (seg.endMs - seg.startMs);
    return seg.leftPx + frac * seg.widthPx;
  };

  // Lane packing per machine over currently scheduled jobs.
  const { byMachine: lanesByMachine, laneByJob } = useMemo(() => {
    return packLanesByMachine(
      jobs.map((j) => {
        const p = pending.get(j.id);
        return p
          ? { ...j, planned_start: p.planned_start, planned_end: p.planned_end, machine_id: p.machine_id }
          : j;
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, pending]);

  const rowHeightFor = (machineId: string): number => {
    const lc = lanesByMachine.get(machineId)?.laneCount ?? 1;
    return BASE_ROW_PADDING + lc * LANE_HEIGHT + Math.max(0, lc - 1) * LANE_GAP;
  };

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
              title="Redistribuye automáticamente todas las ODTs programadas en bloques M/T/N"
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
              <Link
                key={m.id}
                to="/maquina/$id"
                params={{ id: m.id }}
                className={`px-4 flex flex-col justify-center cursor-pointer hover:bg-zinc-800/60 transition-colors ${
                  idx % 2 === 0 ? "bg-zinc-900/30" : ""
                } ${m.type === "external_shop" ? "bg-[#18181b]" : ""}`}
                style={{ height: rowHeightFor(m.id) }}
                title={`Ver ficha de ${m.name}`}
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
                {(lanesByMachine.get(m.id)?.laneCount ?? 0) > 1 && (
                  <div className="text-[9px] text-amber-500/80 font-mono uppercase mt-0.5">
                    {lanesByMachine.get(m.id)!.laneCount} lanes
                  </div>
                )}
              </Link>
            ))}
          </div>
        </div>

        {/* Timeline */}
        <div style={{ width: timelineWidth, minWidth: timelineWidth }}>
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
                  style={{ width: dayWidths[i] }}
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
                        const segW =
                          soloShift === null
                            ? SHIFT_W
                            : isFocus
                              ? SHIFT_W * 2.4
                              : COLLAPSED_SHIFT_W;
                        return (
                          <div
                            key={s.key}
                            className="flex-none flex items-center justify-center border-r border-zinc-800/40 last:border-r-0 transition-all cursor-pointer"
                            onClick={() => toggleShift(sIdx)}
                            style={{
                              width: segW,
                              backgroundColor: `${s.color}${isFocus ? "40" : visible ? "26" : "0d"}`,
                              opacity: visible ? 1 : 0.5,
                            }}
                            title={`${s.name} · click para foco`}
                          >
                            <span
                              className="text-[11px] font-black tracking-wider"
                              style={{
                                color: s.color,
                                opacity: visible ? (isFocus ? 1 : 0.85) : 0.3,
                              }}
                            >
                              {soloShift !== null && !isFocus ? "" : s.label}
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
              const rowH = rowHeightFor(m.id);
              return (
                <div
                  key={m.id}
                  className={`relative border-b border-zinc-800/50 group ${
                    mIdx % 2 === 0 ? "bg-zinc-900/20" : ""
                  } ${m.type === "external_shop" ? "bg-[#18181b]" : ""}`}
                  style={{ height: rowH }}
                >
                  {/* Background drop grid driven by segments (variable widths). */}
                  <div className="absolute inset-0">
                    {segments.map((seg) => {
                      const day = days[seg.dayIdx];
                      const isToday = day.getTime() === today.getTime();
                      if (seg.isFullDay) {
                        const cellKey = `${m.id}:${seg.dayIdx}`;
                        const isHover = hoverCell === cellKey;
                        return (
                          <div
                            key={`${seg.dayIdx}-${seg.shiftIdx}`}
                            onDragOver={onCellDragOver}
                            onDragEnter={() => dragJobId && setHoverCell(cellKey)}
                            onDragLeave={() => hoverCell === cellKey && setHoverCell(null)}
                            onDrop={() => onCellDrop(m.id, seg.dayIdx)}
                            className={`absolute top-0 bottom-0 border-r border-zinc-800/40 transition-colors ${
                              isToday ? "bg-yellow-500/[0.025]" : ""
                            } ${isHover ? "bg-primary/20" : ""}`}
                            style={{ left: seg.leftPx, width: seg.widthPx }}
                          />
                        );
                      }
                      const sh = SHIFTS[seg.shiftIdx];
                      const cellKey = `${m.id}:${seg.dayIdx}:${seg.shiftIdx}`;
                      const isHover = hoverCell === cellKey;
                      const visible = shiftFilter.has(seg.shiftIdx);
                      const isFocus = soloShift === seg.shiftIdx;
                      const isDayEdge = seg.shiftIdx === 2;
                      const alpha = isFocus ? "26" : visible ? (isToday ? "1c" : "12") : "06";
                      return (
                        <div
                          key={`${seg.dayIdx}-${seg.shiftIdx}`}
                          onDragOver={onCellDragOver}
                          onDragEnter={() => dragJobId && setHoverCell(cellKey)}
                          onDragLeave={() => hoverCell === cellKey && setHoverCell(null)}
                          onDrop={() => onCellDrop(m.id, seg.dayIdx, seg.shiftIdx)}
                          className={`absolute top-0 bottom-0 transition-all ${
                            isDayEdge ? "border-r border-zinc-700/60" : "border-r border-zinc-800/30"
                          }`}
                          style={{
                            left: seg.leftPx,
                            width: seg.widthPx,
                            backgroundColor: isHover ? `${sh.color}66` : `${sh.color}${alpha}`,
                            boxShadow: isHover ? `inset 0 0 0 2px ${sh.color}` : undefined,
                          }}
                          title={`${sh.name} · ${String(sh.startHour).padStart(2, "0")}:00–${String((sh.startHour + sh.hours) % 24).padStart(2, "0")}:00`}
                        />
                      );
                    })}
                  </div>

                  {/* Job bars (absolute positioned over the grid) */}
                  {rowJobs.map((j) => {
                    const s = new Date(j.planned_start as string).getTime();
                    const e = new Date(j.planned_end as string).getTime();
                    if (e < start || s > end) return null;
                    const leftPx = msToPx(Math.max(s, start));
                    const widthPx = Math.max(28, msToPx(Math.min(e, end)) - leftPx);
                    if (leftPx >= timelineWidth) return null;
                    const jobShiftIdx = shiftIndexFromDate(j.planned_start as string);
                    const dimmedByFilter = showShifts && !shiftFilter.has(jobShiftIdx);
                    if (soloShift !== null && dimmedByFilter) return null;
                    const ghost = ghosts[j.id];
                    const hasDelay = delayedJobIds.has(j.id);
                    const pendingMove = pending.get(j.id);
                    const shiftMeta = SHIFTS[jobShiftIdx];
                    const spannedShifts = showShifts
                      ? shiftSpan(j.planned_start as string, j.planned_end as string)
                      : [jobShiftIdx];
                    const isHovered = hoverJobId === j.id;
                    const dur = jobDurationHours(j, partTimes);
                    const machineHps = machines.find((mm) => mm.id === j.machine_id)?.hours_per_shift ?? 8;
                    const realHours = ((new Date(j.planned_end as string).getTime() - new Date(j.planned_start as string).getTime()) / 3_600_000);
                    const sourceLabel =
                      dur.source === "catalog"
                        ? `${dur.hoursPerPiece}h/pza × ${j.qty}`
                        : dur.source === "override"
                          ? "manual"
                          : "estimado";
                    const lane = laneByJob.get(j.id) ?? 0;
                    const topPx = BASE_ROW_PADDING / 2 + lane * (LANE_HEIGHT + LANE_GAP);
                    return (
                      <div key={j.id}>
                        {ghost && (() => {
                          const gs = new Date(ghost.start).getTime();
                          const ge = new Date(ghost.end).getTime();
                          if (ge < start || gs > end) return null;
                          const gl = msToPx(Math.max(gs, start));
                          const gw = Math.max(28, msToPx(Math.min(ge, end)) - gl);
                          return (
                            <div
                              className="absolute rounded border-2 border-dashed border-[color:var(--status-risk)]/60 pointer-events-none animate-pulse"
                              style={{ left: gl, width: gw, top: topPx, height: LANE_HEIGHT, opacity: 0.35 }}
                            />
                          );
                        })()}
                        {pendingMove && pendingMove.original_start && pendingMove.original_end && (() => {
                          const os = new Date(pendingMove.original_start).getTime();
                          const oe = new Date(pendingMove.original_end).getTime();
                          if (oe < start || os > end) return null;
                          const ol = msToPx(Math.max(os, start));
                          const ow = Math.max(28, msToPx(Math.min(oe, end)) - ol);
                          return (
                            <div
                              className="absolute rounded border border-dashed border-zinc-500/50 bg-zinc-700/20 pointer-events-none"
                              style={{ left: ol, width: ow, top: topPx, height: LANE_HEIGHT }}
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
                          className={`absolute rounded-md pl-2 pr-1.5 text-left flex items-center bg-[#23232b] hover:bg-[#2a2a34] z-10 transition-all duration-200 hover:-translate-y-px cursor-grab active:cursor-grabbing ${
                            dragJobId === j.id ? "opacity-50" : ""
                          } ${pendingMove ? "ring-2 ring-amber-400 ring-offset-2 ring-offset-[#121214]" : ""} ${dimmedByFilter ? "opacity-30" : ""}`}
                          style={{
                            left: leftPx,
                            width: widthPx,
                            top: topPx,
                            height: LANE_HEIGHT,
                            borderLeft: `4px solid ${shiftMeta.color}`,
                            boxShadow: `0 0 0 1px rgba(82,82,91,0.5), 0 4px 14px rgba(0,0,0,0.55)`,
                          }}
                          title={`ODT ${j.odf} · ${STATUS_LABEL[j.status]}\n${dur.hours.toFixed(1)}h trabajo · ${machineHps}h/turno · ocupa ${realHours.toFixed(1)}h reloj\nTurnos ${spannedShifts.map((i) => SHIFTS[i].label).join("→")} · ${sourceLabel}${pendingMove ? "\n⚠ pendiente de aprobar" : ""}`}
                        >
                          {hasDelay && (
                            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[color:var(--status-risk)] ring-2 ring-[#121214]" />
                          )}
                          {dur.source === "heuristic" && (
                            <span
                              className="absolute -top-1 -left-1 h-3 px-1 rounded-sm bg-amber-500 text-[8px] font-black text-black uppercase tracking-tight leading-3 flex items-center"
                              title="Duración estimada — cargá h/pieza en Configuración"
                            >
                              est
                            </span>
                          )}
                          <div className="flex flex-col min-w-0 flex-1">
                            <span className="text-[11px] font-black text-white leading-none truncate">
                              ODT {j.odf}
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
                              top: Math.max(0, topPx - 22),
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

          </div>
        </div>
      </div>

      {/* Unscheduled drawer */}
      {unscheduled.length > 0 && (
        <div className="border-t border-zinc-800 bg-[#0c0c0e]">
          <button
            onClick={() => setUnschedOpen((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-2 text-left hover:bg-zinc-900/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Sin programar</span>
              <span className="px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400 text-[10px] font-mono font-bold">
                {unscheduled.length}
              </span>
            </div>
            {unschedOpen ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
          </button>
          {unschedOpen && (
            <div className="p-3 flex flex-wrap gap-1.5 border-t border-zinc-800/60 max-h-40 overflow-auto">
              {unscheduled.map((j) => (
                <button
                  key={j.id}
                  draggable
                  onDragStart={(ev) => { setDragJobId(j.id); ev.dataTransfer.effectAllowed = "move"; }}
                  onDragEnd={() => { setDragJobId(null); setHoverCell(null); }}
                  onClick={() => onJobClick?.(j)}
                  className={`rounded border border-zinc-700 bg-zinc-900 px-2 py-1 text-[11px] hover:border-yellow-500/60 hover:bg-zinc-800 transition-colors flex items-center gap-1.5 cursor-grab active:cursor-grabbing ${
                    dragJobId === j.id ? "opacity-50" : ""
                  }`}
                  title={`ODT ${j.odf} · ${STATUS_LABEL[j.status]} · arrastrá al cronograma`}
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[j.status] }} />
                  <span className="font-mono font-bold text-white">ODT {j.odf}</span>
                  {j.tube_spec && <span className="text-zinc-500">{j.tube_spec}</span>}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
          {machines.length} máquina{machines.length === 1 ? "" : "s"} · {effectiveJobs.filter(j => j.planned_start).length} ODTs programadas
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