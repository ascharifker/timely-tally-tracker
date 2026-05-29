import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MachineRun } from "@/lib/fact-types";
import { toast } from "sonner";

/** All runs (small dataset for now). Filter client-side per machine/job. */
export function useMachineRuns() {
  return useQuery({
    queryKey: ["machine_runs"],
    queryFn: async (): Promise<MachineRun[]> => {
      const { data, error } = await supabase
        .from("machine_runs" as never)
        .select("*")
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as MachineRun[];
    },
  });
}

export function useStartRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      job_id: string;
      machine_id: string;
      operator_name?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("machine_runs" as never)
        .insert({
          job_id: input.job_id,
          machine_id: input.machine_id,
          started_at: new Date().toISOString(),
          operator_name: input.operator_name ?? null,
        } as never)
        .select()
        .single();
      if (error) throw error;
      return data as MachineRun;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine_runs"] });
      toast.success("Corrida iniciada");
    },
    onError: (e) => toast.error("No se pudo iniciar", { description: (e as Error).message }),
  });
}

export function useStopRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; pieces_completed: number; notes?: string | null }) => {
      const { error } = await supabase
        .from("machine_runs" as never)
        .update({
          ended_at: new Date().toISOString(),
          pieces_completed: input.pieces_completed,
          notes: input.notes ?? null,
        } as never)
        .eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine_runs"] });
      toast.success("Corrida cerrada");
    },
    onError: (e) => toast.error("No se pudo cerrar", { description: (e as Error).message }),
  });
}

/** Retroactive: cargar lo que está en papel. */
export function useCreateRunRetroactive() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      job_id: string;
      machine_id: string;
      started_at: string;
      ended_at: string;
      pieces_completed: number;
      operator_name?: string | null;
      notes?: string | null;
    }) => {
      const { data, error } = await supabase
        .from("machine_runs" as never)
        .insert(input as never)
        .select()
        .single();
      if (error) throw error;
      return data as MachineRun;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine_runs"] });
      toast.success("Corrida registrada");
    },
    onError: (e) => toast.error("No se pudo registrar", { description: (e as Error).message }),
  });
}

export function useDeleteRun() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("machine_runs" as never).delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machine_runs"] });
      toast.success("Corrida eliminada");
    },
  });
}

export function useUpdateMachine() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & Record<string, unknown>) => {
      const { id, ...patch } = input;
      const { error } = await supabase
        .from("machines")
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
      return input;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Máquina actualizada");
    },
    onError: (e) => toast.error("No se pudo actualizar", { description: (e as Error).message }),
  });
}