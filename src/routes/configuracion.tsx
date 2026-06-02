import { createFileRoute, Link } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/fact/AppShell";
import { MachinesConfig } from "@/components/fact/MachinesConfig";
import { PartTimesConfig } from "@/components/fact/PartTimesConfig";
import { useJobs, useMachines, usePartTimes } from "@/hooks/useFactData";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/configuracion")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Configuración · MEGO Produccion" },
      { name: "description", content: "Capacidad de máquinas y catálogo de tiempos por pieza." },
    ],
  }),
  component: ConfigPage,
});

function ConfigPage() {
  const { data: machines = [] } = useMachines();
  const { data: partTimes = [] } = usePartTimes();
  const { data: jobs = [] } = useJobs();

  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-[11px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 mb-1"
          >
            <ArrowLeft className="h-3 w-3" /> Volver al panel
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">Configuración de producción</h1>
          <p className="text-xs text-muted-foreground">
            Definí las horas reales por turno de cada máquina y cuánto tarda cada pieza. El cronograma se calcula con estos valores.
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <MachinesConfig machines={machines} />
        <PartTimesConfig machines={machines} partTimes={partTimes} jobs={jobs} />
      </div>
    </AppShell>
  );
}