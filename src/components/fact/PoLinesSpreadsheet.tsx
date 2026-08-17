import { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Check, ExternalLink, Search } from "lucide-react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  PO_LINE_STATUS_LABEL_EN,
  type POLineStatus,
  type ReviewTrack,
} from "@/lib/fact-types";
import { useAuth } from "@/hooks/useUserRole";
import { canEditAnyPo } from "@/lib/rbac";
import type { SpreadsheetRow } from "@/hooks/usePoLinesSpreadsheet";
import { usePoLinesSpreadsheet } from "@/hooks/usePoLinesSpreadsheet";
import {
  usePoLineHistory,
  getChange,
  type ChangeCell,
} from "@/hooks/usePoLineHistory";
import {
  acknowledgeAllDateChanges,
  updatePoLineField,
} from "@/lib/po-workflow.functions";
import { ExportLinesDialog } from "@/components/fact/ExportLinesDialog";

type Mode = "intake" | "pending";
type EditableField =
  | "pir"
  | "pir_rev"
  | "tube_spec"
  | "qty_ordered"
  | "committed_date"
  | "notes"
  | "hb_price";
type Preset = "all" | "pending" | "production" | "shipped" | "late";
type SortMode = "po_asc" | "po_desc" | "date_asc";

const SORT_KEY = "po_lines_sort_mode_v1";
const EXPANDED_KEY = "po_lines_expanded_v1";

function fmtMoney(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(Number(v))) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(Number(v));
}

function naturalCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

const PRESET_STATUSES: Record<Exclude<Preset, "all" | "late">, POLineStatus[]> = {
  pending: ["pending_engineering", "engineering_flagged"],
  production: ["engineering_approved", "ready_for_production", "scheduled", "in_progress"],
  shipped: ["completed"],
};

interface Props {
  mode: Mode;
  /** Filter rows by the PO's review track. "all" = no filter. */
  track?: "all" | ReviewTrack;
  /** Initial preset selection; useful for the pending-review view. */
  defaultPreset?: Preset;
}

const STATUS_TONE: Record<string, string> = {
  pending_engineering: "border-amber-500/50 text-amber-300",
  engineering_flagged: "border-red-500/50 text-red-300",
  engineering_approved: "border-emerald-500/50 text-emerald-300",
  ready_for_production: "border-emerald-500/50 text-emerald-300",
  scheduled: "border-blue-500/50 text-blue-300",
  in_progress: "border-blue-500/50 text-blue-300",
  completed: "border-muted-foreground/40 text-muted-foreground",
  cancelled: "border-muted-foreground/40 text-muted-foreground line-through",
};

const JOB_STAGE_LABEL: Record<string, string> = {
  EN_ESPERA: "Waiting",
  PLANNED: "Planned",
  MAZAK: "MAZAK",
  TALLER_EXTERNO: "Ext. shop",
  MAQUINADO_LISTO: "Machined",
  CEMENTACION: "Cementing",
  CEMENTACION_LISTO: "Cement. done",
  EN_GEMAK: "At Gemak",
  EXPO: "EXPO",
  YA_SE_ENVIO: "Shipped",
  ON_HOLD: "Hold",
  MAQYRO: "Mach + RO",
};

const JOB_STAGE_TONE: Record<string, string> = {
  EN_ESPERA: "border-muted-foreground/40 text-muted-foreground",
  PLANNED: "border-muted-foreground/40 text-muted-foreground",
  MAZAK: "border-blue-500/60 text-blue-200 bg-blue-500/10",
  TALLER_EXTERNO: "border-blue-500/60 text-blue-200 bg-blue-500/10",
  MAQUINADO_LISTO: "border-indigo-500/60 text-indigo-200 bg-indigo-500/10",
  CEMENTACION: "border-purple-500/60 text-purple-200 bg-purple-500/10",
  CEMENTACION_LISTO: "border-purple-500/60 text-purple-200 bg-purple-500/10",
  EXPO: "border-cyan-500/60 text-cyan-200 bg-cyan-500/10",
  YA_SE_ENVIO: "border-emerald-500/60 text-emerald-200 bg-emerald-500/10",
  ON_HOLD: "border-red-500/60 text-red-200 bg-red-500/10",
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "seconds ago";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export function PoLinesSpreadsheet({ mode, track = "all", defaultPreset = "all" }: Props) {
  void mode;
  const { data: rows = [], isLoading } = usePoLinesSpreadsheet();
  const lineIds = useMemo(() => rows.map((r) => r.line.id), [rows]);
  const { data: changes } = usePoLineHistory(lineIds);
  const { roles } = useAuth();
  const canEdit = canEditAnyPo(roles);

  const qc = useQueryClient();
  const updateFn = useServerFn(updatePoLineField);
  const ackAllFn = useServerFn(acknowledgeAllDateChanges);

  const [query, setQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [preset, setPreset] = useState<Preset>(defaultPreset);
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [sortMode, setSortMode] = useState<SortMode>(() => {
    if (typeof window === "undefined") return "po_asc";
    return (localStorage.getItem(SORT_KEY) as SortMode) || "po_asc";
  });
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return new Set();
    try {
      const raw = localStorage.getItem(EXPANDED_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });

  useEffect(() => {
    if (typeof window !== "undefined") localStorage.setItem(SORT_KEY, sortMode);
  }, [sortMode]);
  useEffect(() => {
    if (typeof window !== "undefined")
      localStorage.setItem(EXPANDED_KEY, JSON.stringify([...expanded]));
  }, [expanded]);

  const toggleGroup = (key: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Re-sync preset when the parent changes defaultPreset (e.g. via URL).
  useEffect(() => {
    setPreset(defaultPreset);
  }, [defaultPreset]);

  const customers = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((r) => {
      if (r.customer) m.set(r.customer.id, r.customer.name);
    });
    return [...m.entries()].map(([id, name]) => ({ id, name }));
  }, [rows]);

  const pendingChanges = useMemo(() => {
    if (!changes) return 0;
    let n = 0;
    changes.forEach((c) => {
      if (!c.acknowledged) n++;
    });
    return n;
  }, [changes]);

  const lateCount = useMemo(
    () =>
      rows.filter((r) => {
        const d = daysUntil(r.line.committed_date);
        return d !== null && d < 0 && r.line.status !== "completed";
      }).length,
    [rows],
  );

  const counts = useMemo(() => {
    let active = 0,
      pending = 0,
      production = 0,
      shipped = 0;
    for (const r of rows) {
      const s = r.line.status;
      if (s !== "completed" && s !== "cancelled") active++;
      if (PRESET_STATUSES.pending.includes(s as POLineStatus)) pending++;
      if (PRESET_STATUSES.production.includes(s as POLineStatus)) production++;
      if (s === "completed") shipped++;
    }
    return { active, pending, production, shipped, total: rows.length };
  }, [rows]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = rows.filter((r) => {
      if (customerFilter !== "all" && r.customer?.id !== customerFilter) return false;
      if (statusFilter !== "all" && r.line.status !== statusFilter) return false;
      if (track !== "all" && r.po?.review_track !== track) return false;
      if (preset !== "all") {
        if (preset === "late") {
          const d = daysUntil(r.line.committed_date);
          if (!(d !== null && d < 0 && r.line.status !== "completed")) return false;
        } else {
          const allowed = PRESET_STATUSES[preset];
          if (!allowed.includes(r.line.status as POLineStatus)) return false;
        }
      }
      if (onlyChanges) {
        const hasPending = ["committed_date", "pir", "tube_spec", "qty_ordered", "notes"].some(
          (f) => {
            const c = getChange(changes, r.line.id, f);
            return c && !c.acknowledged;
          },
        );
        if (!hasPending) return false;
      }
      if (q) {
        const hay = [
          r.customer?.name,
          r.po?.po_number,
          r.line.pir,
          r.line.tube_spec,
          r.line.notes,
          ...r.jobs.map((j) => j.odf),
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
    // Bitácora-style sort: active first (by committed_date asc, nulls last),
    // then closed (by shipped_at desc).
    const isClosed = (r: SpreadsheetRow) =>
      r.line.status === "completed" || r.line.status === "cancelled";
    void isClosed;
    return list;
  }, [rows, query, customerFilter, statusFilter, preset, onlyChanges, changes, track]);

  // Group filtered rows by PO id. Rows without a PO fall into a synthetic
  // "No PO" bucket rendered at the end.
  interface Group {
    key: string;
    poId: string | null;
    poNumber: string;
    customerName: string;
    reviewTrack: string | null;
    lines: SpreadsheetRow[];
    totalQty: number;
    totalPending: number;
    totalHb: number;
    hasHb: boolean;
    earliestDate: string | null;
    statusCounts: Record<string, number>;
  }
  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Group>();
    for (const r of filtered) {
      const key = r.po?.id ?? "__no_po__";
      let g = map.get(key);
      if (!g) {
        g = {
          key,
          poId: r.po?.id ?? null,
          poNumber: r.po?.po_number ?? "— No PO —",
          customerName: r.customer?.name ?? "—",
          reviewTrack: r.po?.review_track ?? null,
          lines: [],
          totalQty: 0,
          totalPending: 0,
          totalHb: 0,
          hasHb: false,
          earliestDate: null,
          statusCounts: {},
        };
        map.set(key, g);
      }
      g.lines.push(r);
      g.totalQty += r.line.qty_ordered ?? 0;
      g.totalPending += Math.max(
        0,
        (r.line.qty_ordered ?? 0) - r.total_pieces_completed,
      );
      if (r.line.total_hb != null) {
        g.totalHb += Number(r.line.total_hb);
        g.hasHb = true;
      } else if (r.line.hb_price != null) {
        g.totalHb += Number(r.line.hb_price) * (r.line.qty_ordered ?? 0);
        g.hasHb = true;
      }
      const d = r.line.committed_date;
      if (d && (!g.earliestDate || d < g.earliestDate)) g.earliestDate = d;
      g.statusCounts[r.line.status] = (g.statusCounts[r.line.status] ?? 0) + 1;
    }
    for (const g of map.values()) {
      g.lines.sort((a, b) => a.line.line_number - b.line.line_number);
    }
    const arr = [...map.values()];
    arr.sort((a, b) => {
      // Always push "no PO" bucket to the end.
      if (a.poId === null && b.poId !== null) return 1;
      if (b.poId === null && a.poId !== null) return -1;
      if (sortMode === "date_asc") {
        const da = a.earliestDate ?? "9999-12-31";
        const db = b.earliestDate ?? "9999-12-31";
        const cmp = da.localeCompare(db);
        if (cmp !== 0) return cmp;
        return naturalCompare(a.poNumber, b.poNumber);
      }
      const cmp = naturalCompare(a.poNumber, b.poNumber);
      return sortMode === "po_asc" ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sortMode]);

  const searchActive = query.trim().length > 0 || onlyChanges;
  const isGroupOpen = (key: string) => searchActive || expanded.has(key);

  const expandAll = () => setExpanded(new Set(groups.map((g) => g.key)));
  const collapseAll = () => setExpanded(new Set());

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["po_lines_spreadsheet"] });
    qc.invalidateQueries({ queryKey: ["po_line_history"] });
    qc.invalidateQueries({ queryKey: ["date_changes"] });
    qc.invalidateQueries({ queryKey: ["purchase_orders"] });
  };

  const handleEdit = async (
    id: string,
    field: EditableField,
    value: string | number | null,
  ) => {
    try {
      await updateFn({ data: { id, field, value, changed_by: "Peter" } });
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not save");
    }
  };

  const ackAll = async () => {
    try {
      await ackAllFn();
      toast.success("Changes marked as seen");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* Quick presets — bitácora style */}
      <div className="mb-2 flex flex-wrap items-center gap-1.5">
        <PresetChip active={preset === "all"} onClick={() => setPreset("all")} label="All" count={counts.total} />
        <PresetChip active={preset === "pending"} onClick={() => setPreset("pending")} label="Pending eng." count={counts.pending} tone="amber" />
        <PresetChip active={preset === "production"} onClick={() => setPreset("production")} label="In production" count={counts.production} tone="blue" />
        <PresetChip active={preset === "shipped"} onClick={() => setPreset("shipped")} label="Shipped" count={counts.shipped} tone="emerald" />
        <PresetChip active={preset === "late"} onClick={() => setPreset("late")} label="Late" count={lateCount} tone="red" />
      </div>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search PIR, PO #, customer, note, ODF #…"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Customer" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All customers</SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-48 text-xs">
            <SelectValue placeholder="Exact status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Exact status: all</SelectItem>
            {Object.entries(PO_LINE_STATUS_LABEL_EN).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <button
          type="button"
          onClick={() => setOnlyChanges((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded border px-2 h-8 text-xs transition-colors",
            onlyChanges
              ? "border-amber-500/60 bg-amber-500/10 text-amber-200"
              : "border-border text-muted-foreground hover:border-amber-500/40",
          )}
        >
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500" />
          Unseen changes ({pendingChanges})
        </button>
        {pendingChanges > 0 && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={ackAll}>
            <Check className="h-3.5 w-3.5 mr-1" /> Mark all seen
          </Button>
        )}
        <div className="ml-auto">
          <ExportLinesDialog
            rows={filtered}
            scope={`${track}-${preset}`}
          />
        </div>
      </div>

      {/* Sort + expand controls */}
      <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted-foreground">Sort:</span>
        <Select value={sortMode} onValueChange={(v) => setSortMode(v as SortMode)}>
          <SelectTrigger className="h-7 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="po_asc">PO # ↑</SelectItem>
            <SelectItem value="po_desc">PO # ↓</SelectItem>
            <SelectItem value="date_asc">Earliest date</SelectItem>
          </SelectContent>
        </Select>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={expandAll}>
          Expand all
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={collapseAll}>
          Collapse all
        </Button>
        <span className="text-muted-foreground ml-auto">
          {groups.length} PO{groups.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Grid */}
      <div className="rounded-md border bg-card overflow-auto max-h-[calc(100vh-220px)]">
        <table className="w-full border-collapse text-[12px] font-mono">
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-sans">
              <Th className="w-6">{" "}</Th>
              <Th className="w-32">Customer</Th>
              <Th className="w-28">PO #</Th>
              <Th className="w-32">PIR</Th>
              <Th className="w-20">Rev</Th>
              <Th className="min-w-[260px]">Description</Th>
              <Th className="w-16 text-right">Qty</Th>
              <Th className="w-16 text-right">Pend</Th>
              <Th className="w-24 text-right">HB Price</Th>
              <Th className="w-24 text-right">Total HB</Th>
              <Th className="w-32">Customer date</Th>
              <Th className="w-32">Export date</Th>
              <Th className="w-28">Shipped</Th>
              <Th className="w-16 text-right">Days</Th>
              <Th className="w-56">ODF # · Stage</Th>
              <Th className="w-40">Status</Th>
              <Th className="min-w-[220px]">Notes</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={17} className="text-center text-muted-foreground py-8">
                  Loading…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={17} className="text-center text-muted-foreground py-8">
                  No lines match.
                </td>
              </tr>
            )}
            {groups.map((g) => {
              const open = isGroupOpen(g.key);
              const statusPill = Object.entries(g.statusCounts)
                .map(([s, n]) => `${n} ${PO_LINE_STATUS_LABEL_EN[s as POLineStatus] ?? s}`)
                .join(" · ");
              return (
                <>
                  <tr
                    key={`hdr-${g.key}`}
                    className="border-t border-border bg-muted/40 hover:bg-muted/60 cursor-pointer"
                    onClick={() => toggleGroup(g.key)}
                  >
                    <Td className="text-center">
                      {open ? (
                        <ChevronDown className="h-3.5 w-3.5 inline" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 inline" />
                      )}
                    </Td>
                    <Td>
                      <span className="font-sans font-medium truncate block">
                        {g.customerName}
                      </span>
                    </Td>
                    <Td>
                      {g.poId ? (
                        <Link
                          to="/purchase-orders/$id"
                          params={{ id: g.poId }}
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-primary hover:underline font-medium"
                        >
                          {g.poNumber}
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">{g.poNumber}</span>
                      )}
                    </Td>
                    <Td className="text-muted-foreground font-sans text-[11px]">
                      {g.lines.length} line{g.lines.length === 1 ? "" : "s"}
                    </Td>
                    <Td className="text-muted-foreground">—</Td>
                    <Td className="text-muted-foreground font-sans text-[11px] truncate">
                      {statusPill}
                    </Td>
                    <Td className="text-right">{g.totalQty}</Td>
                    <Td className="text-right">{g.totalPending}</Td>
                    <Td className="text-right text-muted-foreground">—</Td>
                    <Td className="text-right font-medium">
                      {g.hasHb ? fmtMoney(g.totalHb) : "—"}
                    </Td>
                    <Td className="text-muted-foreground text-[11px]">
                      {g.earliestDate ?? "—"}
                    </Td>
                    <td colSpan={6} className="border-r border-border px-2 py-1" />
                  </tr>
                  {open &&
                    g.lines.map((r, idx) => {
                      const d = daysUntil(r.line.committed_date);
                      const isLate =
                        d !== null && d < 0 && r.line.status !== "completed";
                      const isClosedRow =
                        r.line.status === "completed" ||
                        r.line.status === "cancelled";
                      const mexEnd = r.jobs
                        .map((j) => j.planned_end)
                        .filter((x): x is string => !!x)
                        .sort()
                        .pop();
                      return (
                        <tr
                          key={r.line.id}
                          className={cn(
                            "border-t border-border hover:bg-muted/30",
                            idx % 2 === 1 && "bg-muted/10",
                            isClosedRow && "text-muted-foreground",
                          )}
                        >
                          <Td className="text-center text-muted-foreground font-sans text-[10px]">
                            L{r.line.line_number}
                          </Td>
                          <Td>
                            <span className="pl-3 text-muted-foreground truncate block text-[11px]">
                              ↳
                            </span>
                          </Td>
                          <Td className="text-muted-foreground">·</Td>
                          <EditableCell
                            value={r.line.pir ?? ""}
                            onCommit={(v) => handleEdit(r.line.id, "pir", v || null)}
                            change={getChange(changes, r.line.id, "pir")}
                            readOnly={!canEdit}
                          />
                          <EditableCell
                            value={r.line.pir_rev ?? ""}
                            onCommit={(v) =>
                              handleEdit(r.line.id, "pir_rev", v || null)
                            }
                            change={getChange(changes, r.line.id, "pir_rev")}
                            readOnly={!canEdit}
                          />
                          <EditableCell
                            value={r.line.tube_spec ?? ""}
                            onCommit={(v) =>
                              handleEdit(r.line.id, "tube_spec", v || null)
                            }
                            change={getChange(changes, r.line.id, "tube_spec")}
                            readOnly={!canEdit}
                          />
                          <EditableCell
                            value={String(r.line.qty_ordered)}
                            align="right"
                            onCommit={(v) => {
                              const n = parseInt(v, 10);
                              if (!Number.isFinite(n) || n < 1) {
                                toast.error("Invalid qty");
                                return;
                              }
                              handleEdit(r.line.id, "qty_ordered", n);
                            }}
                            change={getChange(changes, r.line.id, "qty_ordered")}
                            readOnly={!canEdit}
                          />
                          <Td className="text-right">
                            {Math.max(
                              0,
                              r.line.qty_ordered - r.total_pieces_completed,
                            )}
                          </Td>
                          <EditableCell
                            value={
                              r.line.hb_price == null ? "" : String(r.line.hb_price)
                            }
                            align="right"
                            onCommit={(v) => {
                              const trimmed = v.trim();
                              if (trimmed === "") {
                                handleEdit(r.line.id, "hb_price", null);
                                return;
                              }
                              const n = Number(trimmed.replace(/[$,]/g, ""));
                              if (!Number.isFinite(n) || n < 0) {
                                toast.error("Invalid HB price");
                                return;
                              }
                              handleEdit(r.line.id, "hb_price", n);
                            }}
                            change={undefined}
                            readOnly={!canEdit}
                          />
                          <Td className="text-right font-medium">
                            {fmtMoney(r.line.total_hb)}
                          </Td>
                          <EditableCell
                            type="date"
                            value={r.line.committed_date ?? ""}
                            onCommit={(v) =>
                              handleEdit(r.line.id, "committed_date", v || null)
                            }
                            change={getChange(changes, r.line.id, "committed_date")}
                            readOnly={!canEdit}
                          />
                          <Td className="text-muted-foreground">
                            {mexEnd ? mexEnd.slice(0, 10) : "—"}
                          </Td>
                          <Td className="text-muted-foreground">
                            {r.shipped_at ? r.shipped_at.slice(0, 10) : "—"}
                          </Td>
                          <Td className="text-right">
                            {d === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <span
                                className={cn(
                                  isLate
                                    ? "text-red-400"
                                    : d <= 3
                                      ? "text-amber-300"
                                      : "text-muted-foreground",
                                )}
                              >
                                {d > 0 ? `+${d}` : d}
                              </span>
                            )}
                          </Td>
                          <Td>
                            {r.jobs.length === 0 ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              <div className="flex flex-col gap-0.5">
                                {r.jobs.map((j) => (
                                  <div
                                    key={j.id}
                                    className="flex items-center gap-1.5"
                                  >
                                    <span className="font-mono text-[11px]">
                                      {j.odf}
                                    </span>
                                    <span
                                      className={cn(
                                        "rounded border px-1.5 text-[9px] uppercase tracking-wide",
                                        JOB_STAGE_TONE[j.status] ??
                                          "border-muted-foreground/40 text-muted-foreground",
                                      )}
                                    >
                                      {JOB_STAGE_LABEL[j.status] ?? j.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </Td>
                          <Td>
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px] font-normal",
                                STATUS_TONE[r.line.status] ?? "",
                              )}
                            >
                              {PO_LINE_STATUS_LABEL_EN[r.line.status]}
                            </Badge>
                            {r.line.flag_reason && (
                              <div className="text-[10px] text-red-300/80 mt-0.5 truncate max-w-[180px]">
                                {r.line.flag_reason}
                              </div>
                            )}
                          </Td>
                          <EditableCell
                            value={r.line.notes ?? ""}
                            onCommit={(v) =>
                              handleEdit(r.line.id, "notes", v || null)
                            }
                            change={getChange(changes, r.line.id, "notes")}
                            readOnly={!canEdit}
                          />
                        </tr>
                      );
                    })}
                </>
              );
            })}
            {false && filtered.map((r, idx) => {
              const d = daysUntil(r.line.committed_date);
              const isLate = d !== null && d < 0 && r.line.status !== "completed";
              const isClosed = r.line.status === "completed" || r.line.status === "cancelled";
              const mexEnd = r.jobs
                .map((j) => j.planned_end)
                .filter((x): x is string => !!x)
                .sort()
                .pop();
              return (
                <tr
                  key={r.line.id}
                  className={cn(
                    "border-t border-border hover:bg-muted/30",
                    idx % 2 === 1 && "bg-muted/10",
                    isClosed && "text-muted-foreground",
                  )}
                >
                  <Td>
                    <span className="truncate block">{r.customer?.name ?? "—"}</span>
                  </Td>
                  <Td>
                    {r.po ? (
                      <Link
                        to="/purchase-orders/$id"
                        params={{ id: r.po.id }}
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        {r.po.po_number}
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    ) : (
                      "—"
                    )}
                  </Td>
                  <EditableCell
                    value={r.line.pir ?? ""}
                    onCommit={(v) => handleEdit(r.line.id, "pir", v || null)}
                    change={getChange(changes, r.line.id, "pir")}
                    readOnly={!canEdit}
                  />
                  <EditableCell
                    value={r.line.tube_spec ?? ""}
                    onCommit={(v) => handleEdit(r.line.id, "tube_spec", v || null)}
                    change={getChange(changes, r.line.id, "tube_spec")}
                    readOnly={!canEdit}
                  />
                  <EditableCell
                    value={String(r.line.qty_ordered)}
                    align="right"
                    onCommit={(v) => {
                      const n = parseInt(v, 10);
                      if (!Number.isFinite(n) || n < 1) {
                        toast.error("Invalid qty");
                        return;
                      }
                      handleEdit(r.line.id, "qty_ordered", n);
                    }}
                    change={getChange(changes, r.line.id, "qty_ordered")}
                    readOnly={!canEdit}
                  />
                  <Td className="text-right">
                    {Math.max(0, r.line.qty_ordered - r.total_pieces_completed)}
                  </Td>
                  <EditableCell
                    type="date"
                    value={r.line.committed_date ?? ""}
                    onCommit={(v) => handleEdit(r.line.id, "committed_date", v || null)}
                    change={getChange(changes, r.line.id, "committed_date")}
                    readOnly={!canEdit}
                  />
                  <Td className="text-muted-foreground">
                    {mexEnd ? mexEnd.slice(0, 10) : "—"}
                  </Td>
                  <Td className="text-muted-foreground">
                    {r.shipped_at ? r.shipped_at.slice(0, 10) : "—"}
                  </Td>
                  <Td className="text-right">
                    {d === null ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <span
                        className={cn(
                          isLate
                            ? "text-red-400"
                            : d <= 3
                              ? "text-amber-300"
                              : "text-muted-foreground",
                        )}
                      >
                        {d > 0 ? `+${d}` : d}
                      </span>
                    )}
                  </Td>
                  <Td>
                    {r.jobs.length === 0 ? (
                      <span className="text-muted-foreground">—</span>
                    ) : (
                      <div className="flex flex-col gap-0.5">
                        {r.jobs.map((j) => (
                          <div key={j.id} className="flex items-center gap-1.5">
                            <span className="font-mono text-[11px]">{j.odf}</span>
                            <span
                              className={cn(
                                "rounded border px-1.5 text-[9px] uppercase tracking-wide",
                                JOB_STAGE_TONE[j.status] ??
                                  "border-muted-foreground/40 text-muted-foreground",
                              )}
                            >
                              {JOB_STAGE_LABEL[j.status] ?? j.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Td>
                  <Td>
                    <Badge
                      variant="outline"
                      className={cn(
                        "text-[10px] font-normal",
                        STATUS_TONE[r.line.status] ?? "",
                      )}
                    >
                        {PO_LINE_STATUS_LABEL_EN[r.line.status]}
                    </Badge>
                    {r.line.flag_reason && (
                      <div className="text-[10px] text-red-300/80 mt-0.5 truncate max-w-[180px]">
                        {r.line.flag_reason}
                      </div>
                    )}
                  </Td>
                  <EditableCell
                    value={r.line.notes ?? ""}
                    onCommit={(v) => handleEdit(r.line.id, "notes", v || null)}
                    change={getChange(changes, r.line.id, "notes")}
                    readOnly={!canEdit}
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-3 gap-y-1">
        <span>{filtered.length} visible</span>
        <span>·</span>
        <span>{counts.active} active</span>
        <span>·</span>
        <span>{counts.shipped} shipped</span>
        <span>·</span>
        <span className={lateCount > 0 ? "text-red-400" : ""}>{lateCount} late</span>
        <span>·</span>
        <span>{counts.total} total</span>
        <span className="ml-auto">{canEdit ? "click a cell to edit" : "read-only · ask your admin for edit access"}</span>
      </div>
    </TooltipProvider>
  );
}

function PresetChip({
  active,
  onClick,
  label,
  count,
  tone = "neutral",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  tone?: "neutral" | "amber" | "blue" | "emerald" | "red";
}) {
  const toneCls: Record<typeof tone, string> = {
    neutral: "border-border text-muted-foreground hover:border-foreground/40",
    amber: "border-amber-500/50 text-amber-300 hover:border-amber-500",
    blue: "border-blue-500/50 text-blue-300 hover:border-blue-500",
    emerald: "border-emerald-500/50 text-emerald-300 hover:border-emerald-500",
    red: "border-red-500/50 text-red-300 hover:border-red-500",
  };
  const activeCls: Record<typeof tone, string> = {
    neutral: "bg-foreground/10 border-foreground/60 text-foreground",
    amber: "bg-amber-500/15 border-amber-500 text-amber-200",
    blue: "bg-blue-500/15 border-blue-500 text-blue-200",
    emerald: "bg-emerald-500/15 border-emerald-500 text-emerald-200",
    red: "bg-red-500/15 border-red-500 text-red-200",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 h-7 text-xs transition-colors",
        active ? activeCls[tone] : toneCls[tone],
      )}
    >
      {label}
      <span className="font-mono opacity-75">{count}</span>
    </button>
  );
}

function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <th
      className={cn(
        "border-r border-border px-2 py-1.5 text-left font-medium",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("border-r border-border px-2 py-1 align-middle", className)}>
      {children}
    </td>
  );
}

function EditableCell({
  value,
  onCommit,
  change,
  type = "text",
  align = "left",
  readOnly = false,
}: {
  value: string;
  onCommit: (v: string) => void;
  change: ChangeCell | undefined;
  type?: "text" | "date";
  align?: "left" | "right";
  readOnly?: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const isChanged = !!change && !change.acknowledged;

  const cell = (
    <td
      className={cn(
        "border-r border-border px-2 py-1 align-middle relative",
        readOnly ? "cursor-default" : "cursor-text",
        align === "right" && "text-right",
        isChanged && "bg-amber-500/10 border-l-2 border-l-amber-500",
      )}
      onClick={() => !editing && !readOnly && setEditing(true)}
    >
      {editing ? (
        <input
          ref={inputRef}
          type={type}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            setEditing(false);
            if (draft !== value) onCommit(draft);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setDraft(value);
              setEditing(false);
            }
          }}
          className={cn(
            "w-full bg-transparent outline-none border border-primary/60 rounded px-1 -mx-1 font-mono text-[12px]",
            align === "right" && "text-right",
          )}
        />
      ) : (
        <span className="block truncate">{value || <span className="text-muted-foreground">—</span>}</span>
      )}
      {isChanged && !editing && (
        <span className="absolute top-0.5 right-1 h-1.5 w-1.5 rounded-full bg-amber-500" />
      )}
    </td>
  );

  if (!change) return cell;

  const diffText =
    change.reason ??
    `${change.old_value ?? "—"} → ${change.new_value ?? "—"}`;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{cell}</TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        <div className="font-medium">{diffText}</div>
        <div className="text-muted-foreground">
          {timeAgo(change.changed_at)}
          {change.changed_by ? ` · ${change.changed_by}` : ""}
          {change.acknowledged ? " · visto" : " · sin ver"}
        </div>
      </TooltipContent>
    </Tooltip>
  );
}