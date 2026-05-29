import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { EventKind } from "@/lib/fact-types";

export interface MachineEvent {
  id: string;
  job_id: string | null;
  machine_id: string | null;
  event_kind: EventKind;
  reason: string | null;
  delay_hours: number | null;
  from_status: string | null;
  to_status: string | null;
  started_at: string | null;
  ended_at: string | null;
  cost: number | null;
  created_at: string;
}

/** Events tied to a machine — either directly (machine_id) or via a job that ran on it. */
export function useMachineEvents(machineId: string | null, jobIds: string[]) {
  return useQuery({
    queryKey: ["status_events", "machine", machineId, jobIds.length],
    enabled: !!machineId,
    queryFn: async (): Promise<MachineEvent[]> => {
      // Two queries unioned in JS — Supabase JS doesn't support OR across separate columns cleanly with `in`.
      const [byMachine, byJobs] = await Promise.all([
        supabase
          .from("status_events")
          .select("*")
          .eq("machine_id" as never, machineId!)
          .order("created_at", { ascending: false }),
        jobIds.length > 0
          ? supabase
              .from("status_events")
              .select("*")
              .in("job_id", jobIds)
              .order("created_at", { ascending: false })
          : Promise.resolve({ data: [] as unknown[], error: null }),
      ]);
      if (byMachine.error) throw byMachine.error;
      if (byJobs.error) throw byJobs.error;
      const seen = new Set<string>();
      const out: MachineEvent[] = [];
      for (const row of [...((byMachine.data ?? []) as MachineEvent[]), ...((byJobs.data ?? []) as MachineEvent[])]) {
        if (seen.has(row.id)) continue;
        seen.add(row.id);
        out.push(row);
      }
      out.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return out;
    },
  });
}

export function useCreateMaintenanceEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      machine_id: string;
      kind: "maintenance_preventive" | "maintenance_corrective";
      started_at: string;
      ended_at: string | null;
      cost: number | null;
      reason: string;
    }) => {
      const { error } = await supabase.from("status_events").insert({
        machine_id: input.machine_id,
        event_kind: input.kind,
        to_status: "MAZAK", // not used but column is NOT NULL; placeholder
        reason: input.reason,
        started_at: input.started_at,
        ended_at: input.ended_at,
        cost: input.cost,
      } as never);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["status_events"] });
      toast.success("Mantenimiento registrado");
    },
    onError: (e) => toast.error("No se pudo registrar", { description: (e as Error).message }),
  });
}