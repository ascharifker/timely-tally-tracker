import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Machine, Job, JobStatus } from "@/lib/fact-types";

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
      const { error } = await supabase
        .from("jobs")
        .update({ status: input.status })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useApplyCascade() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      changes: { job_id: string; new_start: string; new_end: string }[],
    ) => {
      for (const c of changes) {
        const { error } = await supabase
          .from("jobs")
          .update({ planned_start: c.new_start, planned_end: c.new_end })
          .eq("id", c.job_id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}