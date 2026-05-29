import { useMemo } from "react";
import type { Job } from "@/lib/fact-types";
import { summarize, classify } from "@/lib/scheduling/otd";
import { Card } from "@/components/ui/card";
import { AlertTriangle, CheckCircle2, Clock, Info } from "lucide-react";

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
      <div className="mt-3 flex items-start gap-2 rounded border border-border/60 bg-sidebar/20 px-2.5 py-2 text-[11px] text-muted-foreground leading-relaxed">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
        <div>
          <span className="text-foreground/80 font-medium">Cómo se calcula:</span>{" "}
          <span className="text-[var(--status-expo)] font-semibold">A tiempo</span> — exportación ≤ fecha cliente.{" "}
          <span className="text-[var(--primary)] font-semibold">En riesgo</span> — ODF aún en maquinado/cementación y faltan menos de 5 días para entrega.{" "}
          <span className="text-[var(--status-risk)] font-semibold">Tarde</span> — fecha de exportación posterior a la del cliente.
        </div>
      </div>
      {atRisk.length > 0 && (
        <div className="mt-3 border-t border-border pt-3">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-semibold">Trabajos en riesgo</div>
            <div className="text-[10px] text-muted-foreground font-mono">{atRisk.length} ODF{atRisk.length === 1 ? "" : "s"}</div>
          </div>
          <div className="overflow-hidden rounded border border-border/60">
            <table className="w-full text-[11px]">
              <thead className="bg-sidebar/40 text-[9px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-2 py-1.5 text-left font-semibold">ODF</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Tubo</th>
                  <th className="px-2 py-1.5 text-left font-semibold">Fecha cliente</th>
                  <th className="px-2 py-1.5 text-right font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {atRisk.map((j) => {
                  const c = classify(j);
                  const isLate = c === "late";
                  return (
                    <tr key={j.id} className="hover:bg-sidebar/20">
                      <td className="px-2 py-1.5 font-mono font-semibold">{j.odf}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{j.tube_spec ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{j.customer_date ?? "—"}</td>
                      <td className="px-2 py-1.5 text-right">
                        <span
                          className="inline-block rounded px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wider"
                          style={{
                            backgroundColor: isLate ? "var(--status-risk)" : "var(--primary)",
                            color: "var(--background)",
                          }}
                        >
                          {isLate ? "tarde" : "riesgo"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Card>
  );
}