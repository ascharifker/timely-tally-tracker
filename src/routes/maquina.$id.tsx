import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/fact/AppShell";
import { Card } from "@/components/ui/card";
import { MachineSpecsForm } from "@/components/fact/MachineSpecsForm";
import { VendorForm } from "@/components/fact/VendorForm";
import { MachineRunsTable } from "@/components/fact/MachineRunsTable";
import { MachineEventsTab } from "@/components/fact/MachineEventsTab";
import { useJobs, useMachines, usePartTimes } from "@/hooks/useFactData";
import { useMachineRuns } from "@/hooks/useMachineRuns";
import { useVendors } from "@/hooks/useVendors";
import {
  catalogDeviation,
  monthlyCost,
  openRuns,
  utilization,
  vendorLeadTimeAvgDays,
} from "@/lib/machine-metrics";

export const Route = createFileRoute("/maquina/$id")({
  ssr: false,
  component: MachinePage,
});

type Tab = "resumen" | "specs" | "produccion" | "tiempos" | "eventos";

function MachinePage() {
  const { id } = Route.useParams();
  const { data: machines = [] } = useMachines();
  const { data: jobs = [] } = useJobs();
  const { data: partTimes = [] } = usePartTimes();
  const { data: runs = [] } = useMachineRuns();
  const { data: vendors = [] } = useVendors();

  const machine = machines.find((m) => m.id === id);
  const vendor = machine?.vendor_id
    ? vendors.find((v) => v.id === machine.vendor_id) ?? null
    : null;
  const isExternal = machine?.type === "external_shop";

  const machineRuns = useMemo(() => runs.filter((r) => r.machine_id === id), [runs, id]);
  const machineJobs = useMemo(() => jobs.filter((j) => j.machine_id === id), [jobs, id]);

  const [tab, setTab] = useState<Tab>("resumen");

  if (!machine) {
    return (
      <AppShell>
        <Toaster theme="dark" position="top-right" />
        <p className="text-sm text-muted-foreground">Máquina no encontrada.</p>
      </AppShell>
    );
  }

  const util = utilization(machineRuns, machine, 7);
  const cost = monthlyCost(
    machineRuns,
    isExternal ? vendor?.hourly_rate ?? 0 : machine.hourly_cost ?? 0,
  );
  const open = openRuns(machineRuns);
  const leadTime = isExternal ? vendorLeadTimeAvgDays(machineRuns, jobs) : null;
  const deviation = catalogDeviation(machineRuns, jobs, partTimes, machine.id);

  const tabs: { id: Tab; label: string; show: boolean }[] = [
    { id: "resumen", label: "Resumen", show: true },
    { id: "specs", label: isExternal ? "Vendor" : "Specs", show: true },
    { id: "produccion", label: "Producción", show: true },
    { id: "tiempos", label: "Tiempos", show: !isExternal },
    { id: "eventos", label: "Eventos", show: true },
  ];

  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4">
        <Link
          to="/"
          className="inline-flex items-center gap-1 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground mb-2"
        >
          <ArrowLeft className="h-3 w-3" /> Volver al panel
        </Link>
        <div className="flex items-baseline gap-3 flex-wrap">
          <h1 className="text-2xl font-bold tracking-tight">{machine.name}</h1>
          <span className="text-xs uppercase font-mono text-muted-foreground">
            {isExternal ? "taller externo" : "interna"} ·{" "}
            {(machine.active_shifts ?? []).join("/").toUpperCase() || "—"} ·{" "}
            {machine.hours_per_shift}h/turno
          </span>
        </div>
      </div>

      <div className="mb-4 flex gap-1 border-b border-border">
        {tabs
          .filter((t) => t.show)
          .map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border-b-2 transition-colors ${
                tab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
      </div>

      {tab === "resumen" && (
        <div className="grid gap-3 md:grid-cols-4 mb-3">
          <KpiCard
            label="ODTs activas"
            value={machineJobs.length.toString()}
            sub={`${open.length} corrida${open.length === 1 ? "" : "s"} en curso`}
          />
          {!isExternal ? (
            <KpiCard
              label="Utilización 7d (real)"
              value={`${util.pct.toFixed(0)}%`}
              sub={`${util.realHours.toFixed(1)}h / ${util.availableHours.toFixed(0)}h disp.`}
            />
          ) : (
            <KpiCard
              label="Lead time real"
              value={leadTime !== null ? `${leadTime.toFixed(1)}d` : "n/d"}
              sub={
                vendor?.lead_time_days_avg
                  ? `declarado: ${vendor.lead_time_days_avg}d`
                  : "sin declarado"
              }
            />
          )}
          <KpiCard
            label="Costo del mes"
            value={`$${Math.round(cost.cost).toLocaleString("es-AR")}`}
            sub={`${cost.hours.toFixed(1)}h × $${isExternal ? vendor?.hourly_rate ?? 0 : machine.hourly_cost ?? 0}/h`}
          />
          <KpiCard
            label="Corridas medidas"
            value={machineRuns.length.toString()}
            sub={machineRuns.length === 0 ? "Sin datos reales aún" : "Base para desvíos"}
          />
          {open.length > 0 && (
            <Card className="md:col-span-4 border-[color:var(--status-risk)]/60 bg-[color:var(--status-risk)]/10 p-3 text-xs">
              ⚠ Hay {open.length} corrida{open.length === 1 ? "" : "s"} sin cerrar — cerralas para que cuenten en utilización y costo.
            </Card>
          )}
        </div>
      )}

      {tab === "specs" &&
        (isExternal && vendor ? (
          <VendorForm vendor={vendor} />
        ) : (
          <MachineSpecsForm machine={machine} />
        ))}

      {tab === "produccion" && (
        <div className="space-y-3">
          <MachineRunsTable runs={machineRuns} jobs={jobs} fixedMachineId={machine.id} />
          <Card className="border-border bg-card p-3">
            <h3 className="text-sm font-semibold mb-2">ODTs asignadas</h3>
            {machineJobs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Ninguna ODT asignada.</p>
            ) : (
              <div className="divide-y divide-border/40">
                {machineJobs.map((j) => (
                  <div
                    key={j.id}
                    className="grid grid-cols-[80px_100px_1fr_80px] gap-2 py-1.5 text-xs items-center"
                  >
                    <span className="font-mono font-semibold">{j.odf}</span>
                    <span className="font-mono text-muted-foreground">{j.status}</span>
                    <span className="text-muted-foreground truncate">{j.tube_spec ?? "—"}</span>
                    <span className="font-mono text-right">qty {j.qty}</span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {tab === "tiempos" && !isExternal && (
        <Card className="border-border bg-card p-0 overflow-hidden">
          <div className="border-b border-border/60 bg-sidebar/40 px-3 py-2">
            <h3 className="text-sm font-semibold">Catálogo vs Real medido</h3>
            <p className="text-[10px] text-muted-foreground">
              "Real" sale solo de corridas cerradas con piezas {">"} 0. No incluye overrides planificados.
            </p>
          </div>
          {deviation.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-muted-foreground">
              Sin corridas medidas. Cargá runs en Producción para ver desvíos vs catálogo.
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              <div className="grid grid-cols-[1fr_70px_70px_70px_70px_80px] gap-2 px-3 py-1.5 text-[9px] uppercase font-mono text-muted-foreground bg-sidebar/30">
                <span>PIR</span>
                <span className="text-right">N</span>
                <span className="text-right">Catálogo</span>
                <span className="text-right">Real avg</span>
                <span className="text-right">σ</span>
                <span className="text-right">Desvío</span>
              </div>
              {deviation.map((d) => (
                <div
                  key={d.pir}
                  className="grid grid-cols-[1fr_70px_70px_70px_70px_80px] gap-2 px-3 py-1.5 text-[11px] font-mono items-center"
                >
                  <span className="font-semibold">{d.pir}</span>
                  <span className="text-right">{d.runs}</span>
                  <span className="text-right text-muted-foreground">
                    {d.catalogHpp !== null ? d.catalogHpp.toFixed(2) : "—"}
                  </span>
                  <span className="text-right">{d.hoursPerPieceAvg.toFixed(2)}</span>
                  <span className="text-right text-muted-foreground">{d.stdDev.toFixed(2)}</span>
                  <span
                    className={`text-right font-bold ${
                      d.deviationPct === null
                        ? "text-muted-foreground"
                        : d.deviationPct > 10
                          ? "text-[color:var(--status-risk)]"
                          : d.deviationPct < -10
                            ? "text-emerald-400"
                            : "text-foreground"
                    }`}
                  >
                    {d.deviationPct === null ? "—" : `${d.deviationPct > 0 ? "+" : ""}${d.deviationPct.toFixed(0)}%`}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {tab === "eventos" && (
        <MachineEventsTab
          machineId={machine.id}
          jobIds={machineJobs.map((j) => j.id)}
          isExternal={isExternal}
        />
      )}
    </AppShell>
  );
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <Card className="border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
        {label}
      </div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      {sub && <div className="text-[10px] text-muted-foreground mt-0.5">{sub}</div>}
    </Card>
  );
}