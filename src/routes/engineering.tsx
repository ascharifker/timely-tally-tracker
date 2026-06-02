import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { useState } from "react";
import { AppShell } from "@/components/fact/AppShell";
import { usePoLinesByStatus } from "@/hooks/usePoQueues";
import { approvePoLine, flagPoLine } from "@/lib/po-workflow.functions";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Check, Flag } from "lucide-react";

export const Route = createFileRoute("/engineering")({
  ssr: false,
  head: () => ({ meta: [{ title: "Ingeniería · FACT" }] }),
  component: EngineeringPage,
});

function EngineeringPage() {
  const { data: lines = [], isLoading } = usePoLinesByStatus([
    "pending_engineering",
    "engineering_flagged",
  ]);
  const approveFn = useServerFn(approvePoLine);
  const flagFn = useServerFn(flagPoLine);
  const qc = useQueryClient();

  const [editPir, setEditPir] = useState<Record<string, string>>({});
  const [editSpec, setEditSpec] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [flagOpen, setFlagOpen] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["po_lines_by_status"] });

  const approve = async (id: string, currentPir: string | null, currentSpec: string | null) => {
    setBusy(id);
    try {
      const pir = editPir[id] ?? currentPir ?? "";
      const spec = editSpec[id] ?? currentSpec ?? "";
      await approveFn({
        data: {
          id,
          reviewer: "Alexis",
          pir: pir.trim() || null,
          tube_spec: spec.trim() || null,
        },
      });
      toast.success("Aprobada");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  };

  const flag = async () => {
    if (!flagOpen) return;
    if (!flagReason.trim()) {
      toast.error("Indicá el motivo");
      return;
    }
    setBusy(flagOpen);
    try {
      await flagFn({
        data: { id: flagOpen, reason: flagReason.trim(), reviewer: "Alexis" },
      });
      toast.success("Flagueada — vuelve a Peter");
      setFlagOpen(null);
      setFlagReason("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Ingeniería</h2>
        <p className="text-sm text-muted-foreground">
          Validá los PIRs contra la master list. Corregí PIR / spec si la AI los extrajo mal.
        </p>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Cliente / PO</TableHead>
              <TableHead>Línea</TableHead>
              <TableHead className="min-w-[180px]">PIR</TableHead>
              <TableHead className="min-w-[220px]">Spec</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Comprometida</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="w-48" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Cargando…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                  Cola vacía. Todo aprobado o aún no llegó nada.
                </TableCell>
              </TableRow>
            )}
            {lines.map((l) => (
              <TableRow key={l.id}>
                <TableCell className="text-sm">
                  {l.purchase_order?.customer?.name ?? "—"}
                  <div className="font-mono text-xs text-muted-foreground">
                    {l.purchase_order?.po_number}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">L{l.line_number}</TableCell>
                <TableCell>
                  <Input
                    defaultValue={l.pir ?? ""}
                    className="h-8 font-mono text-xs"
                    onChange={(e) =>
                      setEditPir((p) => ({ ...p, [l.id]: e.target.value }))
                    }
                  />
                </TableCell>
                <TableCell>
                  <Input
                    defaultValue={l.tube_spec ?? ""}
                    className="h-8 text-xs"
                    onChange={(e) =>
                      setEditSpec((p) => ({ ...p, [l.id]: e.target.value }))
                    }
                  />
                </TableCell>
                <TableCell className="text-right font-mono">{l.qty_ordered}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {l.committed_date ?? "—"}
                </TableCell>
                <TableCell>
                  {l.status === "engineering_flagged" ? (
                    <Badge variant="outline" className="border-red-500/50 text-red-300">
                      Flagueada
                    </Badge>
                  ) : (
                    <Badge variant="outline">Pendiente</Badge>
                  )}
                  {l.flag_reason && (
                    <div className="text-[11px] text-red-300/80 mt-1 max-w-[220px]">
                      {l.flag_reason}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === l.id}
                      onClick={() => approve(l.id, l.pir, l.tube_spec)}
                    >
                      <Check className="h-3.5 w-3.5 mr-1" /> Aprobar
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === l.id}
                      onClick={() => {
                        setFlagOpen(l.id);
                        setFlagReason(l.flag_reason ?? "");
                      }}
                    >
                      <Flag className="h-3.5 w-3.5 mr-1" /> Flag
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!flagOpen} onOpenChange={(o) => !o && setFlagOpen(null)}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Flaguear línea</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={4}
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            placeholder="Ej: PIR 102882625 rev C desactualizada, confirmar con cliente que es la rev D."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFlagOpen(null)}>
              Cancelar
            </Button>
            <Button onClick={flag} disabled={!!busy}>
              Flaguear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}