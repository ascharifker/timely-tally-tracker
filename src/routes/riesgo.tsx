import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/fact/AppShell";
import { Card } from "@/components/ui/card";
import { JobDetailDialog } from "@/components/fact/JobDetailDialog";
import { OTDKpiGrid, OTDLegend } from "@/components/fact/otd-shared";
import { useJobs, useMachines } from "@/hooks/useFactData";
import { classify, summarize } from "@/lib/scheduling/otd";
import type { Job } from "@/lib/fact-types";
import { STATUS_LABEL } from "@/lib/fact-types";

export const Route = createFileRoute("/riesgo")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Trabajos en Riesgo · MEGO Produccion" },
      { name: "description", content: "ODFs en riesgo o tarde — detalle por máquina, operador y fecha." },
    ],
  }),
  component: RiesgoPage,
});

type Filter = "all" | "at_risk" | "late";

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr).getTime();
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d - today.getTime()) / 86400000);
}

function RiesgoPage() {
  const { data: jobs = [] } = useJobs();
  const { data: machines = [] } = useMachines();
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const machineById = useMemo(
    () => Object.fromEntries(machines.map((m) => [m.id, m.name])),
    [machines],
  );

  const sum = useMemo(() => summarize(jobs), [jobs]);

  const rows = useMemo(() => {
    const at = jobs
      .map((j) => ({ j, c: classify(j) }))
      .filter(({ c }) => c !== "on_time")
      .filter(({ c }) => (filter === "all" ? true : c === filter))
      .sort((a, b) => {
        const da = a.j.customer_date ? new Date(a.j.customer_date).getTime() : Infinity;
        const db = b.j.customer_date ? new Date(b.j.customer_date).getTime() : Infinity;
        return da - db;
      });
    return at;
  }, [jobs, filter]);

  const counts = useMemo(() => {
    let at_risk = 0;
    let late = 0;
    for (const j of jobs) {
      const c = classify(j);
      if (c === "at_risk") at_risk++;
      else if (c === "late") late++;
    }
    return { all: at_risk + late, at_risk, late };
  }, [jobs]);

  const FilterTab = ({ id, label, count }: { id: Filter; label: string; count: number }) => (
    <button
      onClick={() => setFilter(id)}
      className={`rounded border px-3 py-1.5 text-[11px] font-medium uppercase tracking-wider transition-colors ${
        filter === id
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-sidebar/20 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label} <span className="ml-1 font-mono text-[10px] opacity-70">{count}</span>
    </button>
  );

  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />

      <div className="mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Volver al tablero
        </Link>
        <h1 className="mt-2 text-xl font-semibold tracking-tight">Trabajos en Riesgo</h1>
        <p className="text-xs text-muted-foreground">
          ODFs que requieren atención inmediata para cumplir fecha cliente.
        </p>
      </div>

      <Card className="mb-4 border-border bg-card p-4">
        <OTDKpiGrid sum={sum} />
        <div className="mt-3">
          <OTDLegend />
        </div>
      </Card>

      <Card className="border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex gap-2">
            <FilterTab id="all" label="Todos" count={counts.all} />
            <FilterTab id="at_risk" label="En riesgo" count={counts.at_risk} />
            <FilterTab id="late" label="Tarde" count={counts.late} />
          </div>
          <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
            {rows.length} ODF{rows.length === 1 ? "" : "s"}
          </div>
        </div>

        {rows.length === 0 ? (
          <div className="rounded border border-border/60 bg-sidebar/20 px-4 py-8 text-center text-sm text-muted-foreground">
            Sin ODFs en esta categoría.
          </div>
        ) : (
          <div className="overflow-x-auto rounded border border-border/60">
            <table className="w-full text-[11px]">
              <thead className="bg-sidebar/40 text-[9px] uppercase tracking-widest text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-left font-semibold">ODF</th>
                  <th className="px-2 py-2 text-left font-semibold">Tubo</th>
                  <th className="px-2 py-2 text-left font-semibold">PIR</th>
                  <th className="px-2 py-2 text-right font-semibold">Qty</th>
                  <th className="px-2 py-2 text-left font-semibold">Operador</th>
                  <th className="px-2 py-2 text-left font-semibold">Máquina</th>
                  <th className="px-2 py-2 text-left font-semibold">Estatus</th>
                  <th className="px-2 py-2 text-left font-semibold">Fecha cliente</th>
                  <th className="px-2 py-2 text-left font-semibold">Export plan.</th>
                  <th className="px-2 py-2 text-right font-semibold">Días</th>
                  <th className="px-2 py-2 text-right font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {rows.map(({ j, c }) => {
                  const isLate = c === "late";
                  const days = daysUntil(j.customer_date ?? null);
                  return (
                    <tr
                      key={j.id}
                      onClick={() => setSelectedJob(j)}
                      className="cursor-pointer hover:bg-sidebar/30"
                    >
                      <td className="px-2 py-1.5 font-mono font-semibold">{j.odf}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{j.tube_spec ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{j.pir ?? "—"}</td>
                      <td className="px-2 py-1.5 text-right font-mono">{j.qty}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{j.operator_name ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono">{j.machine_id ? machineById[j.machine_id] ?? "—" : "—"}</td>
                      <td className="px-2 py-1.5 text-muted-foreground">{STATUS_LABEL[j.status]}</td>
                      <td className="px-2 py-1.5 font-mono">{j.customer_date ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono text-muted-foreground">{j.export_date ?? "—"}</td>
                      <td
                        className="px-2 py-1.5 text-right font-mono font-semibold"
                        style={{ color: days !== null && days < 0 ? "var(--status-risk)" : days !== null && days <= 5 ? "var(--primary)" : undefined }}
                      >
                        {days === null ? "—" : days}
                      </td>
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
        )}
      </Card>

      <JobDetailDialog job={selectedJob} onClose={() => setSelectedJob(null)} />
    </AppShell>
  );
}