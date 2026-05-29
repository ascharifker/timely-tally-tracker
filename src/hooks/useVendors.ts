import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Vendor } from "@/lib/fact-types";
import { toast } from "sonner";

export function useVendors() {
  return useQuery({
    queryKey: ["vendors"],
    queryFn: async (): Promise<Vendor[]> => {
      const { data, error } = await supabase
        .from("vendors" as never)
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Vendor[];
    },
  });
}

/** Create a vendor AND a machine row that mirrors it (so it shows in Gantt/Kanban). */
export function useCreateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; hourly_rate?: number }) => {
      const { data: vendor, error } = await supabase
        .from("vendors" as never)
        .insert({
          name: input.name,
          hourly_rate: input.hourly_rate ?? 0,
        } as never)
        .select()
        .single();
      if (error) throw error;
      const v = vendor as Vendor;
      // Companion machine row (type=external_shop) so the vendor appears in Gantt/Kanban.
      const { error: mErr } = await supabase
        .from("machines")
        .insert({
          name: v.name,
          type: "external_shop",
          display_order: 999,
          hours_per_shift: 8,
          vendor_id: v.id,
          hourly_cost: v.hourly_rate,
        } as never);
      if (mErr) throw mErr;
      return v;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Taller externo creado");
    },
    onError: (e) => toast.error("No se pudo crear", { description: (e as Error).message }),
  });
}

export function useUpdateVendor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string } & Partial<Vendor>) => {
      const { id, ...patch } = input;
      const { error } = await supabase
        .from("vendors" as never)
        .update(patch as never)
        .eq("id", id);
      if (error) throw error;
      // Keep mirror machine name + cost in sync.
      if (patch.name !== undefined || patch.hourly_rate !== undefined) {
        const mirrorPatch: Record<string, unknown> = {};
        if (patch.name !== undefined) mirrorPatch.name = patch.name;
        if (patch.hourly_rate !== undefined) mirrorPatch.hourly_cost = patch.hourly_rate;
        await supabase
          .from("machines")
          .update(mirrorPatch as never)
          .eq("vendor_id", id);
      }
      return input;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["vendors"] });
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Taller externo actualizado");
    },
    onError: (e) => toast.error("No se pudo actualizar", { description: (e as Error).message }),
  });
}