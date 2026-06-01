import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Customer, POLineItem, PurchaseOrder } from "@/lib/fact-types";

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
      return {
        ...row,
        line_items: [...(row.line_items ?? [])].sort(
          (a, b) => a.line_number - b.line_number,
        ),
      };
    },
  });
}