import { useMemo } from "react";
import type { Job, Machine } from "@/lib/fact-types";
import { STATUS_COLOR, STATUS_LABEL } from "@/lib/fact-types";
import { Card } from "@/components/ui/card";

interface Props {
  jobs: Job[];
  machines: Machine[];
  onJobClick?: (job: Job) => void;
}

const DAYS = 14;

export function MachineGantt({ jobs, machines, onJobClick }: Props) {
  const today = useMemo(() => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    return t;
  }, []);

  const days = useMemo(
    () =>
      Array.from({ length: DAYS }, (_, i) => {
        const d = new Date(today);
        d.setDate(d.getDate() + i - 2);
        return d;
      }),
    [today],
  );

  const start = days[0].getTime();
  const end = days[days.length - 1].getTime() + 24 * 60 * 60 * 1000;
  const range = end - start;

  return (
    <Card className="overflow-hidden border-border bg-card p-0">
      <div className="border-b border-border bg-sidebar/40 px-4 py-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Cronograma por Máquina</h2>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          {DAYS} días · turnos M / T / N
        </span>
      </div>

      <div className="grid border-b border-border" style={{ gridTemplateColumns: `140px 1fr` }}>
        <div className="border-r border-border px-3 py-2 text-[10px] uppercase tracking-widest text-muted-foreground">
          Máquina
        </div>
        <div className="grid font-mono text-[10px] text-muted-foreground" style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}>
          {days.map((d, i) => (
            <div
              key={i}
              className={`border-r border-border px-1 py-2 text-center ${
                d.getTime() === today.getTime() ? "bg-primary/10 text-primary" : ""
              }`}
            >
              <div>{d.toLocaleDateString("es", { weekday: "short" })}</div>
              <div className="text-foreground">{d.getDate()}</div>
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
                style={{ gridTemplateColumns: `repeat(${DAYS}, 1fr)` }}
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
                return (
                  <button
                    key={j.id}
                    onClick={() => onJobClick?.(j)}
                    className="absolute top-2 h-10 rounded px-2 text-left text-[11px] text-background font-medium shadow-sm transition hover:translate-y-[-1px] hover:shadow-md"
                    style={{
                      left: `${left}%`,
                      width: `${width}%`,
                      backgroundColor: STATUS_COLOR[j.status],
                    }}
                    title={`ODF ${j.odf} · ${STATUS_LABEL[j.status]}`}
                  >
                    <div className="font-mono leading-tight truncate">ODF {j.odf}</div>
                    <div className="text-[10px] opacity-80 truncate">{j.tube_spec ?? ""}</div>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </Card>
  );
}