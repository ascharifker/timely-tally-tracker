import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import type { Job } from "@/lib/fact-types";
import { summarize, classify } from "@/lib/scheduling/otd";
import { Card } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import { OTDKpiGrid } from "./otd-shared";

export function OTDTracker({ jobs }: { jobs: Job[] }) {
  const sum = useMemo(() => summarize(jobs), [jobs]);
  const atRiskCount = useMemo(
    () => jobs.filter((j) => classify(j) !== "on_time").length,
    [jobs],
  );

  return (
    <Card className="border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">OTD · Entrega a Tiempo</h2>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          cálculo determinístico
        </span>
      </div>
      <OTDKpiGrid sum={sum} />
      <Link
        to="/riesgo"
        className="mt-3 flex items-center justify-between rounded border border-border/60 bg-sidebar/20 px-3 py-2 text-[11px] text-muted-foreground transition-colors hover:bg-sidebar/40 hover:text-foreground"
      >
        <span>
          {atRiskCount > 0 ? (
            <>
              <span className="font-semibold text-foreground">{atRiskCount}</span> ODF
              {atRiskCount === 1 ? "" : "s"} requieren atención
            </>
          ) : (
            "Todos los ODFs al día"
          )}
        </span>
        <span className="flex items-center gap-1 font-medium">
          Ver trabajos en riesgo
          <ArrowRight className="h-3 w-3" />
        </span>
      </Link>
    </Card>
  );
}