import { AlertTriangle, CheckCircle2, Clock, Info } from "lucide-react";
import type { OTDSummary } from "@/lib/scheduling/otd";

export function OTDKpi({
  value,
  label,
  color,
  icon,
}: {
  value: number;
  label: string;
  color: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-border bg-sidebar/30 p-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground">
        <span style={{ color }}>{icon}</span>
        {label}
      </div>
      <div className="mt-1 text-2xl font-mono font-semibold" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

export function OTDKpiGrid({ sum }: { sum: OTDSummary }) {
  return (
    <div className="grid grid-cols-4 gap-2">
      <OTDKpi value={sum.otd_pct} label="OTD %" color="var(--status-listo)" icon={<CheckCircle2 className="h-3 w-3" />} />
      <OTDKpi value={sum.on_time} label="A tiempo" color="var(--status-expo)" icon={<CheckCircle2 className="h-3 w-3" />} />
      <OTDKpi value={sum.at_risk} label="En riesgo" color="var(--primary)" icon={<Clock className="h-3 w-3" />} />
      <OTDKpi value={sum.late} label="Tarde" color="var(--status-risk)" icon={<AlertTriangle className="h-3 w-3" />} />
    </div>
  );
}

export function OTDLegend() {
  return (
    <div className="flex items-start gap-2 rounded border border-border/60 bg-sidebar/20 px-2.5 py-2 text-[11px] text-muted-foreground leading-relaxed">
      <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground/70" />
      <div>
        <span className="text-foreground/80 font-medium">Cómo se calcula:</span>{" "}
        <span className="text-[var(--status-expo)] font-semibold">A tiempo</span> — exportación ≤ fecha cliente.{" "}
        <span className="text-[var(--primary)] font-semibold">En riesgo</span> — ODT aún en maquinado/cementación y faltan menos de 5 días para entrega.{" "}
        <span className="text-[var(--status-risk)] font-semibold">Tarde</span> — fecha de exportación posterior a la del cliente.
      </div>
    </div>
  );
}