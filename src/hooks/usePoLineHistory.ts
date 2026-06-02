import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { DateChange } from "@/lib/fact-types";

export interface ChangeCell {
  id: string;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_at: string;
  changed_by: string | null;
  acknowledged: boolean;
  reason: string | null;
}

/**
 * Map of `${lineId}::${field}` → latest change. Used to highlight cells that
 * differ from the prior known value and surface diff tooltips.
 */
export type ChangeMap = Map<string, ChangeCell>;

function keyOf(lineId: string, field: string) {
  return `${lineId}::${field}`;
}

export function usePoLineHistory(lineIds: string[]) {
  return useQuery({
    queryKey: ["po_line_history", [...lineIds].sort().join(",")],
    enabled: lineIds.length > 0,
    queryFn: async (): Promise<ChangeMap> => {
      const { data, error } = await supabase
        .from("date_change_log" as never)
        .select("*")
        .in("po_line_item_id", lineIds)
        .order("changed_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as unknown as DateChange[];
      const map: ChangeMap = new Map();
      for (const r of rows) {
        if (!r.po_line_item_id) continue;
        const k = keyOf(r.po_line_item_id, r.field);
        if (map.has(k)) continue; // already have the most recent
        map.set(k, {
          id: r.id,
          field: r.field,
          old_value: r.old_value,
          new_value: r.new_value,
          changed_at: r.changed_at,
          changed_by: r.changed_by,
          acknowledged: r.acknowledged_by_peter,
          reason: r.reason,
        });
      }
      return map;
    },
  });
}

export function getChange(map: ChangeMap | undefined, lineId: string, field: string) {
  return map?.get(keyOf(lineId, field));
}