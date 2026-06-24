import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { AppShell } from "@/components/fact/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useUserRole";
import { isAdmin } from "@/lib/rbac";
import { useMachines } from "@/hooks/useFactData";
import { useEffect } from "react";
import {
  parseMaquinadosWorkbook,
  rowToPayload,
  type ParsedRow,
  type RowStatus,
} from "@/lib/maquinados-import";
import { bulkImportMaquinados } from "@/lib/maquinados-import.functions";
import { Upload, AlertCircle, CheckCircle2, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/import-maquinados")({
  ssr: false,
  component: ImportMaquinadosPage,
});

const STATUS_LABELS: Record<RowStatus, string> = {
  ready_for_production: "Listo para producción",
  in_progress: "En producción (MAZAK)",
  completed: "Terminado (YA SE ENVIÓ)",
};

function ImportMaquinadosPage() {
  const { roles, loading } = useAuth();
  const navigate = useNavigate();
  const { data: machines = [] } = useMachines();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const importFn = useServerFn(bulkImportMaquinados);

  useEffect(() => {
    if (!loading && !isAdmin(roles)) navigate({ to: "/", replace: true });
  }, [loading, roles, navigate]);

  const onFile = useCallback(
    async (file: File) => {
      setBusy(true);
      setFileName(file.name);
      try {
        const buf = await file.arrayBuffer();
        const parsed = await parseMaquinadosWorkbook(
          buf,
          machines.map((m) => ({ id: m.id, name: m.name })),
        );
        setRows(parsed);
        toast.success(`Hoja parseada: ${parsed.length} filas`);
      } catch (e) {
        toast.error("No se pudo leer el archivo", { description: (e as Error).message });
        setRows([]);
      } finally {
        setBusy(false);
      }
    },
    [machines],
  );

  const updateRowStatus = (idx: number, status: RowStatus) => {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, status } : r)));
  };

  const bulkSetStatus = (status: RowStatus) => {
    setRows((prev) => prev.map((r) => ({ ...r, status })));
  };

  const counts = useMemo(() => {
    const ok = rows.filter((r) => r.errors.length === 0 && r.warnings.length === 0).length;
    const warn = rows.filter((r) => r.errors.length === 0 && r.warnings.length > 0).length;
    const err = rows.filter((r) => r.errors.length > 0).length;
    return { ok, warn, err, total: rows.length };
  }, [rows]);

  const onCommit = async () => {
    const committable = rows.filter((r) => r.errors.length === 0);
    if (committable.length === 0) {
      toast.error("No hay filas válidas para importar");
      return;
    }
    setBusy(true);
    try {
      const payload = { rows: committable.map(rowToPayload) };
      const res = await importFn({ data: payload });
      toast.success(`Importado: ${res.inserted}`, {
        description: res.skipped > 0 ? `${res.skipped} omitidas` : undefined,
      });
      if (res.errors.length > 0) {
        console.warn("Import errors", res.errors);
      }
      setRows([]);
      setFileName(null);
    } catch (e) {
      toast.error("Falló la importación", { description: (e as Error).message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4">
        <h1 className="text-2xl font-bold tracking-tight">Importar MAQUINADOS</h1>
        <p className="text-xs text-muted-foreground mt-1">
          Sube el archivo CRONOGRAMA FLOTACION. Solo se procesa la hoja <span className="font-mono">MAQUINADOS</span>.
        </p>
      </div>

      <Card className="border-border bg-card p-4 mb-4">
        <label className="flex items-center gap-3 cursor-pointer">
          <Upload className="h-4 w-4 text-primary" />
          <span className="text-sm">{fileName ?? "Selecciona un archivo .xlsx"}</span>
          <input
            type="file"
            accept=".xlsx"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
            disabled={busy}
          />
          <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground">
            {busy ? "Procesando…" : "Click para subir"}
          </span>
        </label>
      </Card>

      {rows.length > 0 && (
        <>
          <Card className="border-border bg-card p-3 mb-3 flex items-center gap-3 flex-wrap">
            <span className="text-xs font-mono">Total: {counts.total}</span>
            <span className="text-xs font-mono text-emerald-400">OK: {counts.ok}</span>
            <span className="text-xs font-mono text-amber-400">Advertencias: {counts.warn}</span>
            <span className="text-xs font-mono text-red-400">Errores: {counts.err}</span>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest text-muted-foreground">Asignar a todas:</span>
              {(["ready_for_production", "in_progress", "completed"] as RowStatus[]).map((s) => (
                <Button key={s} variant="outline" size="sm" className="h-7 text-xs" onClick={() => bulkSetStatus(s)}>
                  {STATUS_LABELS[s]}
                </Button>
              ))}
              <Button size="sm" onClick={onCommit} disabled={busy || counts.ok + counts.warn === 0}>
                Importar {counts.ok + counts.warn} filas
              </Button>
            </div>
          </Card>

          <Card className="border-border bg-card p-0 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-sidebar/40 border-b border-border/60">
                  <tr className="text-[10px] uppercase font-mono text-muted-foreground">
                    <th className="px-2 py-2 text-left w-8"></th>
                    <th className="px-2 py-2 text-left">Máquina</th>
                    <th className="px-2 py-2 text-left">PO #</th>
                    <th className="px-2 py-2 text-left">ODF</th>
                    <th className="px-2 py-2 text-left">PIR</th>
                    <th className="px-2 py-2 text-right">Qty</th>
                    <th className="px-2 py-2 text-left">Entrega</th>
                    <th className="px-2 py-2 text-left">Runs</th>
                    <th className="px-2 py-2 text-left">Estado</th>
                    <th className="px-2 py-2 text-left">Notas</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {rows.map((r, idx) => (
                    <tr
                      key={idx}
                      className={
                        r.errors.length > 0
                          ? "bg-red-500/5"
                          : r.warnings.length > 0
                            ? "bg-amber-500/5"
                            : ""
                      }
                    >
                      <td className="px-2 py-1.5 align-top">
                        {r.errors.length > 0 ? (
                          <AlertCircle className="h-3.5 w-3.5 text-red-400" />
                        ) : r.warnings.length > 0 ? (
                          <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                        )}
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <div className={r.machineId ? "" : "text-red-400"}>{r.machineHeader}</div>
                      </td>
                      <td className="px-2 py-1.5 font-mono align-top">{r.po_number ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono align-top">{r.odf ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono align-top">{r.pir ?? "—"}</td>
                      <td className="px-2 py-1.5 text-right font-mono align-top">{r.qty ?? "—"}</td>
                      <td className="px-2 py-1.5 font-mono align-top">{r.committed_date ?? "—"}</td>
                      <td className="px-2 py-1.5 align-top">
                        {r.runsAttempted === 0 ? (
                          <span className="text-muted-foreground">—</span>
                        ) : (
                          <span className={r.runs.length === 0 ? "text-amber-400" : "text-emerald-400"}>
                            {r.runs.length}/{r.runsAttempted}
                          </span>
                        )}
                      </td>
                      <td className="px-2 py-1.5 align-top">
                        <select
                          value={r.status}
                          onChange={(e) => updateRowStatus(idx, e.target.value as RowStatus)}
                          className="bg-background border border-border rounded px-1.5 py-1 text-xs"
                          disabled={r.errors.length > 0}
                        >
                          {(Object.keys(STATUS_LABELS) as RowStatus[]).map((s) => (
                            <option key={s} value={s}>
                              {STATUS_LABELS[s]}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-1.5 align-top max-w-xs">
                        {r.errors.length > 0 && (
                          <div className="text-red-400 text-[10px]">{r.errors.join(" · ")}</div>
                        )}
                        {r.warnings.length > 0 && (
                          <div className="text-amber-400 text-[10px]">{r.warnings.join(" · ")}</div>
                        )}
                        {r.comentarios && (
                          <div className="text-muted-foreground text-[10px] truncate" title={r.comentarios}>
                            {r.comentarios.split("\n")[0]}
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </AppShell>
  );
}