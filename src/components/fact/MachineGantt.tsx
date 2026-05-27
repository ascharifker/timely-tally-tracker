import { useEffect, useMemo, useRef, useState } from "react";
import type { Job, Machine } from "@/lib/fact-types";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/fact-types";
import { Card } from "@/components/ui/card";
import { useRecentDelays } from "@/hooks/useFactData";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface Props {
  jobs: Job[];
  machines: Machine[];
  onJobClick?: (job: Job) => void;
}

type ViewMode = "14d" | "month" | "quarter";

export function MachineGantt({ jobs, machines, onJobClick }: Props) {
  const { data: delays = [] } = useRecentDelays();
  const [viewMode, setViewMode] = useState<ViewMode>("14d");
  const [anchor, setAnchor] = useState<Date>(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  });

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

  return (
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
                </>
              )}
            </div>
          ))}
        </div>
      </div>

      {machines.map((m) => {
        const rowJobs = jobs.filter(
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
                    className={`border-r border-border/40 ${
                      d.getTime() === today.getTime() ? "bg-primary/5" : ""
                    }`}
                  />
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
                  <button
                    onClick={() => onJobClick?.(j)}
                    className="absolute top-2 h-10 rounded px-2 text-left text-[11px] text-background font-medium shadow-sm transition-all duration-500 hover:translate-y-[-1px] hover:shadow-md"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: STATUS_COLOR[j.status],
                    }}
                    title={`ODF ${j.odf} · ${STATUS_LABEL[j.status]}`}
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
                onClick={() => onJobClick?.(j)}
                className="rounded border border-border bg-card px-2 py-1 text-[11px] hover:border-primary hover:bg-primary/5 transition-colors flex items-center gap-1.5"
                title={`ODF ${j.odf} · ${STATUS_LABEL[j.status]} · click para asignar fechas`}
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
  );
}

function getWeekNumber(d: Date): number {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}