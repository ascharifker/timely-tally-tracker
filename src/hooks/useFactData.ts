import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Machine, Job, JobStatus } from "@/lib/fact-types";
import { cascade, type CascadeChange } from "@/lib/scheduling/cascade";
import { toast } from "sonner";
import { STATUS_LABEL } from "@/lib/fact-types";

export function useMachines() {
  return useQuery({
    queryKey: ["machines"],
    queryFn: async (): Promise<Machine[]> => {
      const { data, error } = await supabase
        .from("machines")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as Machine[];
    },
  });
}

export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: async (): Promise<Job[]> => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("planned_start", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Job>) => {
      const { data, error } = await supabase.from("jobs").insert(input as never).select().single();
      if (error) throw error;
      return data as Job;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useUpdateJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: JobStatus }) => {
      const all = qc.getQueryData<Job[]>(["jobs"]) ?? [];
      const job = all.find((j) => j.id === input.id);
      const patch: { status: JobStatus; planned_start?: string; planned_end?: string } = {
        status: input.status,
      };
      if (input.status === "MAZAK" && job && (!job.planned_start || !job.planned_end)) {
        const start = nextShiftStart();
        const end = new Date(start.getTime() + 2 * 24 * 60 * 60 * 1000);
        patch.planned_start = start.toISOString();
        patch.planned_end = end.toISOString();
      }
      const { error } = await supabase.from("jobs").update(patch).eq("id", input.id);
      if (error) throw error;
      return patch;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["jobs"] });
      const previous = qc.getQueryData<Job[]>(["jobs"]) ?? [];
      const job = previous.find((j) => j.id === id);
      let planned_start = job?.planned_start ?? null;
      let planned_end = job?.planned_end ?? null;
      if (status === "MAZAK" && job && (!planned_start || !planned_end)) {
        const s = nextShiftStart();
        const e = new Date(s.getTime() + 2 * 24 * 60 * 60 * 1000);
        planned_start = s.toISOString();
        planned_end = e.toISOString();
      }
      qc.setQueryData<Job[]>(
        ["jobs"],
        previous.map((j) => (j.id === id ? { ...j, status, planned_start, planned_end } : j)),
      );
      return { previous, job };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["jobs"], ctx.previous);
      toast.error("No se pudo cambiar el estado", { description: (err as Error).message });
    },
    onSuccess: (data, vars, ctx) => {
      const odf = ctx?.job?.odf ?? "ODF";
      let extra = "";
      if (data?.planned_start && data?.planned_end) {
        const s = new Date(data.planned_start).toLocaleDateString("es", { day: "2-digit", month: "2-digit" });
        const e = new Date(data.planned_end).toLocaleDateString("es", { day: "2-digit", month: "2-digit" });
        extra = ` · programado ${s} → ${e}`;
      }
      toast.success(`ODF ${odf} → ${STATUS_LABEL[vars.status]}${extra}`);
      if (vars.status === "MAZAK" && ctx?.job && !ctx.job.machine_id) {
        toast.info("Asigná una máquina para verlo en el cronograma");
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

/** Round up to the next 8h shift boundary (00:00, 08:00, 16:00 local). */
function nextShiftStart(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  const h = d.getHours();
  if (h < 8) d.setHours(8);
  else if (h < 16) d.setHours(16);
  else {
    d.setDate(d.getDate() + 1);
    d.setHours(0);
  }
  return d;
}

export interface LogDelayInput {
  jobId: string;
  delayHours: number;
  reason: string;
}

export interface LogDelayResult {
  changes: CascadeChange[];
  shiftedAt: number;
}

/**
 * Record a production delay and cascade the schedule in one shot.
 *   1. inserts a row in status_events (audit trail)
 *   2. bulk-updates planned_start / planned_end on the anchor + downstream jobs
 *   3. optimistically patches the React Query cache so the Gantt moves immediately
 */
export function useLogDelay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, delayHours, reason }: LogDelayInput) => {
      const jobs = (qc.getQueryData<Job[]>(["jobs"]) ?? []);
      const changes = cascade({ jobs, delayedJobId: jobId, delayHours });
      if (changes.length === 0) {
        throw new Error("No hay nada que reprogramar — el ODF no tiene fecha planificada.");
      }

      // 1. audit row
      const anchor = jobs.find((j) => j.id === jobId);
      const { error: evErr } = await supabase.from("status_events").insert({
        job_id: jobId,
        from_status: anchor?.status ?? null,
        to_status: anchor?.status ?? "PLANNED",
        delay_hours: delayHours,
        reason,
      } as never);
      if (evErr) throw evErr;

      // 2. bulk update affected jobs
      for (const c of changes) {
        const { error } = await supabase
          .from("jobs")
          .update({ planned_start: c.new_start, planned_end: c.new_end })
          .eq("id", c.job_id);
        if (error) throw error;
      }

      return { changes, shiftedAt: Date.now() } as LogDelayResult;
    },
    onMutate: async ({ jobId, delayHours }) => {
      await qc.cancelQueries({ queryKey: ["jobs"] });
      const previous = qc.getQueryData<Job[]>(["jobs"]) ?? [];
      const changes = cascade({ jobs: previous, delayedJobId: jobId, delayHours });
      const byId = new Map(changes.map((c) => [c.job_id, c]));
      const next = previous.map((j) => {
        const c = byId.get(j.id);
        return c ? { ...j, planned_start: c.new_start, planned_end: c.new_end } : j;
      });
      qc.setQueryData<Job[]>(["jobs"], next);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["jobs"], ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["status_events"] });
    },
  });
}

/** Recent delays — used by the Gantt to draw ghost bars and badges. */
export function useRecentDelays() {
  return useQuery({
    queryKey: ["status_events"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("status_events")
        .select("job_id, delay_hours, reason, created_at")
        .gte("created_at", since)
        .gt("delay_hours", 0)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });
}