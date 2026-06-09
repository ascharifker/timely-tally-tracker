import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { POLineItem, POLineStatus, ReviewTrack } from "@/lib/fact-types";

/** One flat row in the spreadsheet — mirrors Peter's Excel grain. */
export interface SpreadsheetRow {
  line: POLineItem;
  po: {
    id: string;
    po_number: string;
    issued_date: string | null;
    source_document_url: string | null;
    notes: string | null;
    review_track: ReviewTrack;
  } | null;
  customer: { id: string; name: string; code: string | null } | null;
  /** Aggregated job info across all ODFs for this line. */
  jobs: { id: string; odf: string; status: string; planned_end: string | null }[];
  total_pieces_completed: number;
  shipped_at: string | null;
}

interface PoSubRow {
  id: string;
  po_number: string;
  issued_date: string | null;
  source_document_url: string | null;
  notes: string | null;
  review_track: ReviewTrack;
  customer: { id: string; name: string; code: string | null } | null;
}

interface LineRow extends POLineItem {
  purchase_order: PoSubRow | null;
}

interface JobRow {
  id: string;
  odf: string;
  status: string;
  planned_end: string | null;
  po_line_item_id: string | null;
}

interface RunRow {
  job_id: string;
  pieces_completed: number;
  ended_at: string | null;
}

export function usePoLinesSpreadsheet(opts: { statuses?: POLineStatus[] } = {}) {
  return useQuery({
    queryKey: ["po_lines_spreadsheet", opts.statuses ?? null],
    queryFn: async (): Promise<SpreadsheetRow[]> => {
      let q = supabase
        .from("po_line_items" as never)
        .select(
          "*, purchase_order:purchase_orders(id, po_number, issued_date, source_document_url, notes, review_track, customer:customers(id, name, code))",
        )
        .order("committed_date", { ascending: true, nullsFirst: false });
      if (opts.statuses && opts.statuses.length > 0) {
        q = q.in("status", opts.statuses);
      }
      const { data, error } = await q;
      if (error) throw error;
      const lines = (data ?? []) as unknown as LineRow[];
      const lineIds = lines.map((l) => l.id);

      let jobs: JobRow[] = [];
      let runs: RunRow[] = [];
      if (lineIds.length > 0) {
        const { data: jobRows } = await supabase
          .from("jobs" as never)
          .select("id, odf, status, planned_end, po_line_item_id")
          .in("po_line_item_id", lineIds);
        jobs = (jobRows ?? []) as unknown as JobRow[];
        const jobIds = jobs.map((j) => j.id);
        if (jobIds.length > 0) {
          const { data: runRows } = await supabase
            .from("machine_runs" as never)
            .select("job_id, pieces_completed, ended_at")
            .in("job_id", jobIds);
          runs = (runRows ?? []) as unknown as RunRow[];
        }
      }

      const jobsByLine = new Map<string, JobRow[]>();
      for (const j of jobs) {
        if (!j.po_line_item_id) continue;
        const arr = jobsByLine.get(j.po_line_item_id) ?? [];
        arr.push(j);
        jobsByLine.set(j.po_line_item_id, arr);
      }
      const runsByJob = new Map<string, RunRow[]>();
      for (const r of runs) {
        const arr = runsByJob.get(r.job_id) ?? [];
        arr.push(r);
        runsByJob.set(r.job_id, arr);
      }

      return lines.map<SpreadsheetRow>((l) => {
        const lineJobs = jobsByLine.get(l.id) ?? [];
        let total = 0;
        let shipped: string | null = null;
        for (const j of lineJobs) {
          const jrs = runsByJob.get(j.id) ?? [];
          for (const r of jrs) {
            total += r.pieces_completed ?? 0;
          }
          if (j.status === "YA_SE_ENVIO") {
            // Best-effort "shipped at" — last run end.
            const last = jrs
              .map((r) => r.ended_at)
              .filter((x): x is string => !!x)
              .sort()
              .pop();
            if (last && (!shipped || last > shipped)) shipped = last;
          }
        }
        return {
          line: {
            id: l.id,
            purchase_order_id: l.purchase_order_id,
            line_number: l.line_number,
            pir: l.pir,
            tube_spec: l.tube_spec,
            qty_ordered: l.qty_ordered,
            committed_date: l.committed_date,
            export_date: l.export_date ?? null,
            unit_price: l.unit_price,
            currency: l.currency,
            notes: l.notes,
            created_at: l.created_at,
            updated_at: l.updated_at,
            status: l.status,
            flag_reason: l.flag_reason,
            engineering_reviewed_at: l.engineering_reviewed_at,
            engineering_reviewed_by: l.engineering_reviewed_by,
          },
          po: l.purchase_order
            ? {
                id: l.purchase_order.id,
                po_number: l.purchase_order.po_number,
                issued_date: l.purchase_order.issued_date,
                source_document_url: l.purchase_order.source_document_url,
                notes: l.purchase_order.notes,
                review_track: l.purchase_order.review_track,
              }
            : null,
          customer: l.purchase_order?.customer ?? null,
          jobs: lineJobs.map((j) => ({
            id: j.id,
            odf: j.odf,
            status: j.status,
            planned_end: j.planned_end,
          })),
          total_pieces_completed: total,
          shipped_at: shipped,
        };
      });
    },
  });
}