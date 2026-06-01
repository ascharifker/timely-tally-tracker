import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { POLineItem, POLineStatus, DateChange } from "@/lib/fact-types";

export interface PoLineWithContext extends POLineItem {
  purchase_order: {
    id: string;
    po_number: string;
    issued_date: string | null;
    committed_date: string | null;
    source_document_url: string | null;
    customer: { id: string; name: string; code: string | null } | null;
  } | null;
}

export function usePoLinesByStatus(statuses: POLineStatus[]) {
  return useQuery({
    queryKey: ["po_lines_by_status", statuses],
    queryFn: async (): Promise<PoLineWithContext[]> => {
      const { data, error } = await supabase
        .from("po_line_items" as never)
        .select(
          "*, purchase_order:purchase_orders(id, po_number, issued_date, committed_date, source_document_url, customer:customers(id, name, code))",
        )
        .in("status", statuses)
        .order("committed_date", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as unknown as PoLineWithContext[];
    },
  });
}

export interface DateChangeWithContext extends DateChange {
  job: {
    id: string;
    odf: string;
    po_halliburton: string | null;
    po_musa: string | null;
  } | null;
  po_line_item: {
    id: string;
    line_number: number;
    pir: string | null;
    purchase_order: {
      po_number: string;
      customer: { name: string } | null;
    } | null;
  } | null;
}

export function useDateChanges(opts: { onlyUnacknowledged?: boolean } = {}) {
  return useQuery({
    queryKey: ["date_changes", opts.onlyUnacknowledged ?? false],
    queryFn: async (): Promise<DateChangeWithContext[]> => {
      let q = supabase
        .from("date_change_log" as never)
        .select(
          "*, job:jobs(id, odf, po_halliburton, po_musa), po_line_item:po_line_items(id, line_number, pir, purchase_order:purchase_orders(po_number, customer:customers(name)))",
        )
        .order("changed_at", { ascending: false })
        .limit(100);
      if (opts.onlyUnacknowledged) {
        q = q.eq("acknowledged_by_peter", false);
      }
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as DateChangeWithContext[];
    },
  });
}