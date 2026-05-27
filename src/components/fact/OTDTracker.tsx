import { useMemo } from "react";
import type { Job } from "@/lib/fact-types";
import { summarize, classify } from "@/lib/scheduling/otd";
import { Card } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Clock } from "lucide-react";

export function OTDTracker({ jobs }: { jobs: Job[] }) {
  const sum = useMemo(() => summarize(jobs), [jobs]);
  const atRisk = useMemo(() => jobs.filter((j) => classify(j) !== "on_time"), [jobs]);

  const Pct = ({ value, label, color, icon }: { value: number; label: string; color: string; icon: React.ReactNode }) => (
    <div className="flex flex-col items-center justify-center rounded border border-border bg-sidebar/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-2xl font-mono font-semibold" style={{ color }}>{value}</div>
    </div>
  );

  return (
    <Card className="border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">OTD · Entrega a Tiempo</h2>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">cálculo determinístico</span>
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Pct value={sum.otd_pct} label="OTD %" color="var(--status-listo)" icon={<CheckCircle2 className="h-3 w-3" />} />
        <Pct value={sum.on_time} label="A tiempo" color="var(--status-expo)" icon={<CheckCircle2 className="h-3 w-3" />} />
        <Pct value={sum.at_risk} label="En riesgo" color="var(--primary)" icon={<Clock className="h-3 w-3" />} />
        <Pct value={sum.late} label="Tarde" color="var(--status-risk)" icon={<AlertTriangle className="h-3 w-3" />} />
      </div>
      {atRisk.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 text-[10px] uppercase tracking-widest text-muted-foreground">Trabajos en riesgo</div>
          <div className="space-y-1">
            {atRisk.map((j) => {
              const c = classify(j);
              return (
                <div key={j.id} className="flex items-center justify-between text-[11px] font-mono">
                  <span>ODF {j.odf}</span>
                  <span className="text-muted-foreground">{j.tube_spec}</span>
                  <span
                    className="rounded px-2 py-0.5 text-[9px] uppercase"
                    style={{
                      backgroundColor: c === "late" ? "var(--status-risk)" : "var(--primary)",
                      color: "var(--background)",
                    }}
                  >
                    {c === "late" ? "tarde" : "riesgo"}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </Card>
  );
}