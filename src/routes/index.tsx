import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/fact/AppShell";
import { MachineGantt } from "@/components/fact/MachineGantt";
import { StatusBoard } from "@/components/fact/StatusBoard";
import { OTDTracker } from "@/components/fact/OTDTracker";
import { CreateJobDialog } from "@/components/fact/CreateJobDialog";
import { BriefingPanel } from "@/components/fact/BriefingPanel";
import { JobDetailDialog } from "@/components/fact/JobDetailDialog";
import { useJobs, useMachines } from "@/hooks/useFactData";
import type { Job } from "@/lib/fact-types";

export const Route = createFileRoute("/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "FACT · Mego Afek Producción" },
      { name: "description", content: "Planificación de producción Mego Afek — MAZAK, talleres externos, OTD y cascada determinística." },
    ],
  }),
  component: FactDashboard,
});

function FactDashboard() {
  const { data: machines = [] } = useMachines();
  const { data: jobs = [], isLoading } = useJobs();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />

      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Panel de Producción</h1>
          <p className="text-xs text-muted-foreground">
            {isLoading ? "Cargando…" : `${jobs.length} ODFs activos · ${machines.length} máquinas`}
          </p>
        </div>
        <CreateJobDialog />
      </div>

      <div className="grid gap-4 lg:grid-cols-3 mb-4">
        <div className="lg:col-span-2">
          <OTDTracker jobs={jobs} />
        </div>
        <BriefingPanel jobs={jobs} machines={machines} />
      </div>

      <div className="mb-4">
        <MachineGantt jobs={jobs} machines={machines} onJobClick={setSelectedJob} />
      </div>

      <StatusBoard jobs={jobs} />

      <JobDetailDialog job={selectedJob} onClose={() => setSelectedJob(null)} />
    </AppShell>
  );
}
