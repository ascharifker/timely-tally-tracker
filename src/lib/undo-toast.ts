import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { QueryClient } from "@tanstack/react-query";
import type { Job } from "./fact-types";

export type ScheduleSnapshot = {
  id: string;
  planned_start: string | null;
  planned_end: string | null;
};

export function snapshotJobs(jobs: Job[], ids: Iterable<string>): ScheduleSnapshot[] {
  const set = new Set(ids);
  return jobs
    .filter((j) => set.has(j.id))
    .map((j) => ({
      id: j.id,
      planned_start: j.planned_start ?? null,
      planned_end: j.planned_end ?? null,
    }));
}

/**
 * Show a success toast with a "Deshacer" action that restores the given
 * planned_start / planned_end snapshots for the affected jobs.
 */
export function showUndoToast(
  qc: QueryClient,
  label: string,
  snapshots: ScheduleSnapshot[],
) {
  if (snapshots.length === 0) {
    toast.success(label);
    return;
  }
  toast.success(label, {
    duration: 8000,
    action: {
      label: "Deshacer",
      onClick: async () => {
        try {
          for (const s of snapshots) {
            const { error } = await supabase
              .from("jobs")
              .update({ planned_start: s.planned_start, planned_end: s.planned_end })
              .eq("id", s.id);
            if (error) throw error;
          }
          toast.success(
            `Movimiento revertido · ${snapshots.length} ODT${snapshots.length === 1 ? "" : "s"}`,
          );
          qc.invalidateQueries({ queryKey: ["jobs"] });
          qc.invalidateQueries({ queryKey: ["active_jobs"] });
          qc.invalidateQueries({ queryKey: ["completed_jobs"] });
          qc.invalidateQueries({ queryKey: ["status_events"] });
        } catch (e) {
          toast.error("No se pudo deshacer", { description: (e as Error).message });
        }
      },
    },
  });
}