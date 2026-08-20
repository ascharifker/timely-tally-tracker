import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/fact/AppShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckCircle2, Clock, FileQuestion, RefreshCw, Trash2, Upload } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/hooks/useUserRole";
import { canDocumentQc } from "@/lib/rbac";
import {
  listMatrix,
  listPendingQualityActions,
  markDocumented,
  importMatrixRows,
  deleteMatrixEntries,
} from "@/lib/qc-matrix.functions";

export const Route = createFileRoute("/calidad")({
  ssr: false,
  component: CalidadPage,
  head: () => ({
    meta: [
      { title: "Calidad — Matriz de documentos | MEGO Producción" },
      {
        name: "description",
        content:
          "Control de revisiones de planos y documentos por número de parte para producción en MEGO.",
      },
      { property: "og:title", content: "Calidad — Matriz de documentos" },
      {
        property: "og:description",
        content: "Control de revisiones de planos y documentos por número de parte.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Row = {
  id: string;
  pir: string;
  part_description: string | null;
  documented_rev: string | null;
  status: string;
  dropbox_name: string | null;
  notes: string | null;
  updated_at: string;
};

const STATUS_META: Record<string, { label: string; className: string; icon: typeof CheckCircle2 }> = {
  documented: {
    label: "Documentado",
    className: "text-emerald-300 border-emerald-500/40",
    icon: CheckCircle2,
  },
  new_rev_pending: {
    label: "Revisión nueva",
    className: "text-amber-300 border-amber-500/40",
    icon: RefreshCw,
  },
  not_documented: {
    label: "No documentado",
    className: "text-red-300 border-red-500/40",
    icon: FileQuestion,
  },
  requested_from_customer: {
    label: "Solicitado al cliente",
    className: "text-sky-300 border-sky-500/40",
    icon: Clock,
  },
};

function StatusBadge({ status }: { status: string }) {
  const meta = STATUS_META[status] ?? STATUS_META["not_documented"];
  const Icon = meta.icon;
  return (
    <Badge variant="outline" className={meta.className}>
      <Icon className="h-3 w-3 mr-1" /> {meta.label}
    </Badge>
  );
}

function CalidadPage() {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const canDocument = canDocumentQc(roles);

  const pendingFn = useServerFn(listPendingQualityActions);
  const listFn = useServerFn(listMatrix);
  const documentFn = useServerFn(markDocumented);
  const importFn = useServerFn(importMatrixRows);
  const deleteFn = useServerFn(deleteMatrixEntries);

  const [search, setSearch] = useState("");
  const [revDrafts, setRevDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  const pending = useQuery({
    queryKey: ["qc_matrix_pending"],
    queryFn: () => pendingFn(),
  });

  const all = useQuery({
    queryKey: ["qc_matrix_list", search],
    queryFn: () => listFn({ data: { search: search || undefined } }),
  });

  const pendingRows = (pending.data?.rows ?? []) as Row[];
  const allRows = (all.data?.rows ?? []) as Row[];

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const r of pendingRows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [pendingRows]);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["qc_matrix_pending"] });
    qc.invalidateQueries({ queryKey: ["qc_matrix_list"] });
    qc.invalidateQueries({ queryKey: ["qc_matrix_entry"] });
  };

  const doDocument = async (row: Row) => {
    const rev = (revDrafts[row.id] ?? "").trim() || row.documented_rev;
    if (!rev) {
      toast.error("Captura la revisión");
      return;
    }
    setBusy(true);
    try {
      await documentFn({ data: { pir: row.pir, rev } });
      toast.success(`${row.pir} documentado en Rev. ${rev}`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const doDelete = async () => {
    if (!toDelete) return;
    setBusy(true);
    try {
      await deleteFn({ data: { ids: [toDelete.id] } });
      toast.success(`${toDelete.pir} eliminado de la matriz`);
      setToDelete(null);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo eliminar");
    } finally {
      setBusy(false);
    }
  };

  const onImportFile = async (file: File) => {
    setBusy(true);
    try {
      const XLSX = await import("xlsx");
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const pick = (r: Record<string, unknown>, keys: string[]) => {
        for (const k of Object.keys(r)) {
          const norm = k.toLowerCase().replace(/[^a-z]/g, "");
          if (keys.includes(norm)) return String(r[k] ?? "").trim();
        }
        return "";
      };
      const rows = json
        .map((r) => ({
          pir: pick(r, ["pir", "parte", "partnumber", "numerodeparte", "noparte", "partno"]),
          documentedRev: pick(r, ["rev", "revision", "reva", "revisin"]) || null,
          partDescription: pick(r, ["descripcion", "descripcin", "description", "desc"]) || null,
        }))
        .filter((r) => r.pir);
      if (rows.length === 0) {
        toast.error("No se encontraron columnas de número de parte");
        return;
      }
      const res = await importFn({ data: { rows } });
      toast.success(`${res.imported} partes importadas`);
      refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo importar");
    } finally {
      setBusy(false);
    }
  };

  const renderTable = (rows: Row[], withActions: boolean) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Parte (PIR)</TableHead>
          <TableHead>Descripción</TableHead>
          <TableHead>Rev. documentada</TableHead>
          <TableHead>Estado</TableHead>
          <TableHead>Plano</TableHead>
          {withActions && canDocument && <TableHead className="w-[320px]">Acción</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.length === 0 && (
          <TableRow>
            <TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">
              Sin registros.
            </TableCell>
          </TableRow>
        )}
        {rows.map((r) => (
          <TableRow key={r.id}>
            <TableCell className="font-mono text-xs">{r.pir}</TableCell>
            <TableCell className="text-xs max-w-[220px] truncate">
              {r.part_description ?? "—"}
            </TableCell>
            <TableCell className="font-mono text-xs">{r.documented_rev ?? "—"}</TableCell>
            <TableCell>
              <StatusBadge status={r.status} />
            </TableCell>
            <TableCell className="text-xs max-w-[180px] truncate">
              {r.dropbox_name ?? "—"}
            </TableCell>
            {withActions && canDocument && (
              <TableCell>
                <div className="flex gap-2">
                  <Input
                    className="h-8 w-24 font-mono"
                    placeholder="Rev."
                    value={revDrafts[r.id] ?? ""}
                    onChange={(e) =>
                      setRevDrafts((d) => ({ ...d, [r.id]: e.target.value }))
                    }
                  />
                  <Button size="sm" disabled={busy} onClick={() => doDocument(r)}>
                    Documentar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    disabled={busy}
                    aria-label={`Eliminar ${r.pir}`}
                    onClick={() => setToDelete(r)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  return (
    <AppShell>
      <Toaster />
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">Calidad — Matriz de documentos</h1>
            <p className="text-sm text-muted-foreground">
              Control de revisiones de planos por número de parte.
            </p>
          </div>
          {canDocument && (
            <label className="inline-flex">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                disabled={busy}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) onImportFile(f);
                  e.currentTarget.value = "";
                }}
              />
              <Button variant="outline" size="sm" disabled={busy} asChild>
                <span>
                  <Upload className="h-3.5 w-3.5 mr-1" /> Importar matriz (Excel)
                </span>
              </Button>
            </label>
          )}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(
            [
              ["new_rev_pending", "Revisiones nuevas"],
              ["not_documented", "No documentados"],
              ["requested_from_customer", "Solicitados al cliente"],
            ] as const
          ).map(([key, label]) => (
            <Card key={key} className="p-3">
              <div className="text-xs text-muted-foreground">{label}</div>
              <div className="text-2xl font-semibold">{counts[key] ?? 0}</div>
            </Card>
          ))}
          <Card className="p-3">
            <div className="text-xs text-muted-foreground">Partes en la matriz</div>
            <div className="text-2xl font-semibold">{allRows.length}</div>
          </Card>
        </div>

        <Tabs defaultValue="pending">
          <TabsList>
            <TabsTrigger value="pending">Pendientes ({pendingRows.length})</TabsTrigger>
            <TabsTrigger value="all">Matriz completa</TabsTrigger>
          </TabsList>
          <TabsContent value="pending" className="mt-3">
            <Card className="overflow-x-auto">{renderTable(pendingRows, true)}</Card>
          </TabsContent>
          <TabsContent value="all" className="mt-3 space-y-3">
            <Input
              placeholder="Buscar número de parte…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Card className="overflow-x-auto">{renderTable(allRows, true)}</Card>
          </TabsContent>
        </Tabs>
      </div>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar {toDelete?.pir}?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrará esta parte de la matriz junto con su historial. Esta acción no se puede
              deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction disabled={busy} onClick={doDelete}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
