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
import { cn } from "@/lib/utils";
import { PO_LINE_STATUS_LABEL } from "@/lib/fact-types";
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

type Mode = "intake" | "browse";
type EditableField = "pir" | "tube_spec" | "qty_ordered" | "committed_date" | "notes";

interface Props {
  mode: Mode;
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

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.round((d.getTime() - today.getTime()) / 86400000);
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "hace segundos";
  if (diff < 3600) return `hace ${Math.round(diff / 60)}m`;
  if (diff < 86400) return `hace ${Math.round(diff / 3600)}h`;
  return `hace ${Math.round(diff / 86400)}d`;
}

export function PoLinesSpreadsheet({ mode }: Props) {
  const { data: rows = [], isLoading } = usePoLinesSpreadsheet();
  const lineIds = useMemo(() => rows.map((r) => r.line.id), [rows]);
  const { data: changes } = usePoLineHistory(lineIds);

  const qc = useQueryClient();
  const updateFn = useServerFn(updatePoLineField);
  const ackAllFn = useServerFn(acknowledgeAllDateChanges);

  const [query, setQuery] = useState("");
  const [customerFilter, setCustomerFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>(
    mode === "intake" ? "pending_engineering" : "all",
  );
  const [onlyChanges, setOnlyChanges] = useState(false);

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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (customerFilter !== "all" && r.customer?.id !== customerFilter) return false;
      if (statusFilter !== "all" && r.line.status !== statusFilter) return false;
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
  }, [rows, query, customerFilter, statusFilter, onlyChanges, changes]);

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
      toast.error(e instanceof Error ? e.message : "No se pudo guardar");
    }
  };

  const ackAll = async () => {
    try {
      await ackAllFn();
      toast.success("Cambios marcados como vistos");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  };

  return (
    <TooltipProvider delayDuration={200}>
      {/* Toolbar */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar PIR, PO, cliente, nota, ODF…"
            className="h-8 pl-7 text-xs"
          />
        </div>
        <Select value={customerFilter} onValueChange={setCustomerFilter}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue placeholder="Cliente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los clientes</SelectItem>
            {customers.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-48 text-xs">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            {Object.entries(PO_LINE_STATUS_LABEL).map(([k, v]) => (
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
          Cambios sin ver ({pendingChanges})
        </button>
        <span className="inline-flex items-center gap-1.5 rounded border border-border px-2 h-8 text-xs text-muted-foreground">
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              lateCount > 0 ? "bg-red-500" : "bg-muted-foreground/40",
            )}
          />
          Atrasados ({lateCount})
        </span>
        {pendingChanges > 0 && (
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={ackAll}>
            <Check className="h-3.5 w-3.5 mr-1" /> Marcar todo visto
          </Button>
        )}
      </div>

      {/* Grid */}
      <div className="rounded-md border bg-card overflow-auto max-h-[calc(100vh-220px)]">
        <table className="w-full border-collapse text-[12px] font-mono">
          <thead className="sticky top-0 z-10 bg-muted/60 backdrop-blur">
            <tr className="text-[11px] uppercase tracking-wider text-muted-foreground font-sans">
              <Th className="w-32">Cliente</Th>
              <Th className="w-28">PO #</Th>
              <Th className="w-32">PIR</Th>
              <Th className="min-w-[260px]">Descripción</Th>
              <Th className="w-16 text-right">Qty</Th>
              <Th className="w-16 text-right">Pend</Th>
              <Th className="w-32">Comprometida</Th>
              <Th className="w-32">MEX date</Th>
              <Th className="w-28">Shipped</Th>
              <Th className="w-16 text-right">Días</Th>
              <Th className="w-24">ODF</Th>
              <Th className="w-40">Estado</Th>
              <Th className="min-w-[220px]">Notas</Th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={13} className="text-center text-muted-foreground py-8">
                  Cargando…
                </td>
              </tr>
            )}
            {!isLoading && filtered.length === 0 && (
              <tr>
                <td colSpan={13} className="text-center text-muted-foreground py-8">
                  Sin líneas que coincidan.
                </td>
              </tr>
            )}
            {filtered.map((r, idx) => {
              const d = daysUntil(r.line.committed_date);
              const isLate = d !== null && d < 0 && r.line.status !== "completed";
              const odfs = r.jobs.map((j) => j.odf).join(", ");
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
                  />
                  <EditableCell
                    value={r.line.tube_spec ?? ""}
                    onCommit={(v) => handleEdit(r.line.id, "tube_spec", v || null)}
                    change={getChange(changes, r.line.id, "tube_spec")}
                  />
                  <EditableCell
                    value={String(r.line.qty_ordered)}
                    align="right"
                    onCommit={(v) => {
                      const n = parseInt(v, 10);
                      if (!Number.isFinite(n) || n < 1) {
                        toast.error("Qty inválida");
                        return;
                      }
                      handleEdit(r.line.id, "qty_ordered", n);
                    }}
                    change={getChange(changes, r.line.id, "qty_ordered")}
                  />
                  <Td className="text-right">
                    {Math.max(0, r.line.qty_ordered - r.total_pieces_completed)}
                  </Td>
                  <EditableCell
                    type="date"
                    value={r.line.committed_date ?? ""}
                    onCommit={(v) => handleEdit(r.line.id, "committed_date", v || null)}
                    change={getChange(changes, r.line.id, "committed_date")}
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
                    {odfs ? (
                      <span className="text-xs">{odfs}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
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
                      {PO_LINE_STATUS_LABEL[r.line.status]}
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
                  />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        {filtered.length} de {rows.length} líneas · click en una celda para editar
      </div>
    </TooltipProvider>
  );
}

function Th({ children, className }: { children: React.ReactNode; className?: string }) {
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
}: {
  value: string;
  onCommit: (v: string) => void;
  change: ChangeCell | undefined;
  type?: "text" | "date";
  align?: "left" | "right";
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
        "border-r border-border px-2 py-1 align-middle cursor-text relative",
        align === "right" && "text-right",
        isChanged && "bg-amber-500/10 border-l-2 border-l-amber-500",
      )}
      onClick={() => !editing && setEditing(true)}
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