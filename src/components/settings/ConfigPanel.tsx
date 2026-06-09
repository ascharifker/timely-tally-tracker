import { MachinesConfig } from "@/components/fact/MachinesConfig";
import { PartTimesConfig } from "@/components/fact/PartTimesConfig";
import { useJobs, useMachines, usePartTimes } from "@/hooks/useFactData";

export function ConfigPanel() {
  const { data: machines = [] } = useMachines();
  const { data: partTimes = [] } = usePartTimes();
  const { data: jobs = [] } = useJobs();

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold tracking-tight">Configuración de producción</h2>
        <p className="text-xs text-muted-foreground">
          Definí las horas reales por turno de cada máquina y cuánto tarda cada pieza. El cronograma se calcula con estos valores.
        </p>
      </div>
      <MachinesConfig machines={machines} />
      <PartTimesConfig machines={machines} partTimes={partTimes} jobs={jobs} />
    </div>
  );
}