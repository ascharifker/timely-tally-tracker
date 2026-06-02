import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Job } from "@/lib/fact-types";

export interface JobStep {
  id: string;
  job_id: string;
  step_order: number;
  step_name: string;
  status: string;
  machine_id: string | null;
  vendor_id: string | null;
  planned_start: string | null;
  planned_end: string | null;
  started_at: string | null;
  completed_at: string | null;
  note: string | null;
}

export interface ActiveJob extends Job {
  steps: JobStep[];
  current_step: JobStep | null;
}

const TERMINAL_STATUSES = ["YA_SE_ENVIO"];

export function useActiveJobs() {
  return useQuery({
    queryKey: ["active_jobs"],
    queryFn: async (): Promise<ActiveJob[]> => {
      const { data: jobs, error } = await supabase
        .from("jobs")
        .select("*")
        .not("status", "in", `(${TERMINAL_STATUSES.join(",")})`)
        .order("planned_start", { ascending: true, nullsFirst: false });
      if (error) throw error;
      const list = (jobs ?? []) as Job[];
      if (list.length === 0) return [];
      const ids = list.map((j) => j.id);
      const { data: steps, error: sErr } = await supabase
        .from("job_steps" as never)
        .select("*")
        .in("job_id", ids)
        .order("step_order", { ascending: true });
      if (sErr) throw sErr;
      const byJob = new Map<string, JobStep[]>();
      for (const s of (steps as unknown as JobStep[]) ?? []) {
        const arr = byJob.get(s.job_id) ?? [];
        arr.push(s);
        byJob.set(s.job_id, arr);
      }
      return list.map((j) => {
        const all = byJob.get(j.id) ?? [];
        const current = all.find((s) => !s.completed_at) ?? null;
        return { ...j, steps: all, current_step: current };
      });
    },
  });
}