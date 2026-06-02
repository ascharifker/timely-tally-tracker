import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type {
  Customer,
  DateChange,
  Job,
  POLineItem,
  PurchaseOrder,
} from "@/lib/fact-types";

export interface PurchaseOrderWithCustomer extends PurchaseOrder {
  customer: Pick<Customer, "id" | "name" | "code"> | null;
  line_count: number;
}

export function usePurchaseOrders() {
  return useQuery({
    queryKey: ["purchase_orders"],
    queryFn: async (): Promise<PurchaseOrderWithCustomer[]> => {
      const { data, error } = await supabase
        .from("purchase_orders" as never)
        .select("*, customer:customers(id,name,code), po_line_items(id)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      type Row = PurchaseOrder & {
        customer: Pick<Customer, "id" | "name" | "code"> | null;
        po_line_items: { id: string }[] | null;
      };
      return ((data ?? []) as unknown as Row[]).map((row) => ({
        ...row,
        line_count: row.po_line_items?.length ?? 0,
      }));
    },
  });
}

export interface PurchaseOrderDetail extends PurchaseOrder {
  customer: Customer | null;
  line_items: POLineItem[];
  jobs: (Job & { machine_name: string | null })[];
  date_changes: DateChange[];
}

export function usePurchaseOrder(id: string | undefined) {
  return useQuery({
    queryKey: ["purchase_order", id],
    enabled: !!id,
    queryFn: async (): Promise<PurchaseOrderDetail | null> => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("purchase_orders" as never)
        .select("*, customer:customers(*), line_items:po_line_items(*)")
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      const row = data as unknown as PurchaseOrder & {
        customer: Customer | null;
        line_items: POLineItem[];
      };
      const lineItems = [...(row.line_items ?? [])].sort(
        (a, b) => a.line_number - b.line_number,
      );
      const lineIds = lineItems.map((li) => li.id);

      let jobs: (Job & { machine_name: string | null })[] = [];
      if (lineIds.length > 0) {
        const { data: jobRows } = await supabase
          .from("jobs" as never)
          .select("*, machine:machines(name)")
          .in("po_line_item_id", lineIds);
        jobs = ((jobRows ?? []) as unknown as (Job & {
          machine: { name: string } | null;
        })[]).map((j) => ({ ...j, machine_name: j.machine?.name ?? null }));
      }
      const jobIds = jobs.map((j) => j.id);

      let dateChanges: DateChange[] = [];
      if (lineIds.length > 0 || jobIds.length > 0) {
        const orParts: string[] = [];
        if (lineIds.length > 0)
          orParts.push(`po_line_item_id.in.(${lineIds.join(",")})`);
        if (jobIds.length > 0) orParts.push(`job_id.in.(${jobIds.join(",")})`);
        const { data: dcRows } = await supabase
          .from("date_change_log" as never)
          .select("*")
          .or(orParts.join(","))
          .order("changed_at", { ascending: false });
        dateChanges = (dcRows ?? []) as unknown as DateChange[];
      }

      return {
        ...row,
        line_items: lineItems,
        jobs,
        date_changes: dateChanges,
      };
    },
  });
}