import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PoDetailLine {
  id: string;
  line_number: number;
  pir: string | null;
  tube_spec: string | null;
  qty_ordered: number;
  committed_date: string | null;
  status: string;
  notes: string | null;
  unit_price: number | null;
  currency: string | null;
}

export interface PoDetailData {
  po: {
    id: string;
    po_number: string;
    status: string;
    issued_date: string | null;
    committed_date: string | null;
    notes: string | null;
    source_document_url: string | null;
    customer: { id: string; name: string; code: string | null } | null;
    lines: PoDetailLine[];
  } | null;
  changes: Array<{
    id: string;
    field: string;
    old_value: string | null;
    new_value: string | null;
    changed_at: string;
    changed_by: string | null;
    reason: string | null;
    po_line_item_id: string | null;
  }>;
}

export function usePoDetail(poId: string | null) {
  return useQuery({
    enabled: !!poId,
    queryKey: ["po_detail", poId],
    queryFn: async (): Promise<PoDetailData> => {
      const { data: po, error } = await supabase
        .from("purchase_orders" as never)
        .select(
          "*, customer:customers(id, name, code), lines:po_line_items(id, line_number, pir, tube_spec, qty_ordered, committed_date, status, notes, unit_price, currency)",
        )
        .eq("id", poId!)
        .single();
      if (error) throw error;
      const typedPo = po as unknown as PoDetailData["po"];
      const lineIds = typedPo?.lines?.map((l) => l.id) ?? [];
      let changes: PoDetailData["changes"] = [];
      if (lineIds.length > 0) {
        const { data: ch, error: e2 } = await supabase
          .from("date_change_log" as never)
          .select("id, field, old_value, new_value, changed_at, changed_by, reason, po_line_item_id")
          .in("po_line_item_id", lineIds)
          .order("changed_at", { ascending: false })
          .limit(50);
        if (e2) throw e2;
        changes = (ch ?? []) as unknown as PoDetailData["changes"];
      }
      // Sort lines by line_number
      if (typedPo?.lines) {
        typedPo.lines.sort((a, b) => a.line_number - b.line_number);
      }
      return { po: typedPo, changes };
    },
  });
}