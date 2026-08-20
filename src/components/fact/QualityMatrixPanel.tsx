import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileQuestion,
  FileText,
  History,
  RefreshCw,
  Send,
} from "lucide-react";
import type { PoLineWithContext } from "@/hooks/usePoQueues";
import { useAuth } from "@/hooks/useUserRole";
import { canDocumentQc, canFlagQcDocuments } from "@/lib/rbac";
import {
  getMatrixEntryForPir,
  requestRevisionUpdate,
  markDocumented,
  markRequestedFromCustomer,
  attachPlanToMatrix,
} from "@/lib/qc-matrix.functions";
import { signOffQualityMatrix } from "@/lib/quality-matrix.functions";

interface Props {
  line: PoLineWithContext;
  canReview: boolean;
  onSaved: () => void;
}

type MatrixStatus =
  | "documented"
  | "new_rev_pending"
  | "not_documented"
  | "requested_from_customer";

const STATUS_META: Record<
  MatrixStatus,
  { label: string; className: string; icon: typeof CheckCircle2 }
> = {
  documented: {
    label: "Documentado",
    className: "text-emerald-300 border-emerald-500/40 bg-emerald-500/10",
    icon: CheckCircle2,
  },
  new_rev_pending: {
    label: "Revisión nueva pendiente",
    className: "text-amber-300 border-amber-500/40 bg-amber-500/10",
    icon: RefreshCw,
  },
  not_documented: {
    label: "No documentado",
    className: "text-red-300 border-red-500/40 bg-red-500/10",
    icon: FileQuestion,
  },
  requested_from_customer: {
    label: "Solicitado al cliente",
    className: "text-sky-300 border-sky-500/40 bg-sky-500/10",
    icon: Clock,
  },
};

const EVENT_LABEL: Record<string, string> = {
  documented: "Documentado por Calidad",
  revision_update_requested: "Actualización de revisión solicitada",
  requested_from_customer: "Documento solicitado al cliente",
  plan_attached: "Plano de Dropbox adjuntado",
};

function normRev(v: string | null | undefined) {
  return (v ?? "").trim().toUpperCase().replace(/^REV[\s._-]*/i, "");
}

export function QualityMatrixPanel({ line, canReview, onSaved }: Props) {
  const qc = useQueryClient();
  const { roles } = useAuth();
  const canFlag = canReview && canFlagQcDocuments(roles);
  const canDocument = canDocumentQc(roles);

  const entryFn = useServerFn(getMatrixEntryForPir);
  const requestRevFn = useServerFn(requestRevisionUpdate);
  const documentFn = useServerFn(markDocumented);
  const requestCustomerFn = useServerFn(markRequestedFromCustomer);
  const attachFn = useServerFn(attachPlanToMatrix);
  const signOffFn = useServerFn(signOffQualityMatrix);

  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [revInput, setRevInput] = useState("");

  const pir = (line.pir ?? "").trim();
  const poRev = line.pir_rev ?? null;

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["qc_matrix_entry", pir],
    queryFn: () => entryFn({ data: { pir } }),
    enabled: pir.length > 0,
  });

  const entry = data?.entry ?? null;
  const events = data?.events ?? [];

  const derivedStatus: MatrixStatus = useMemo(() => {
    if (!entry) return "not_documented";
    const s = entry.status as MatrixStatus;
    if (s === "documented" && poRev && normRev(poRev) !== normRev(entry.documented_rev)) {
      return "new_rev_pending";
    }
    return s;
  }, [entry, poRev]);

  const meta = STATUS_META[derivedStatus];
  const StatusIcon = meta.icon;

  const planRev = useMemo(() => {
    const name = line.plan_dropbox_rev ?? line.plan_dropbox_name ?? null;
    if (!name) return null;
    const m = /rev[\s._-]*([a-z0-9]+)/i.exec(name);
    return m ? m[1].toUpperCase() : null;
  }, [line.plan_dropbox_rev, line.plan_dropbox_name]);

  const run = async (fn: () => Promise<unknown>, okMsg: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(okMsg);
      setNote("");
      await refetch();
      qc.invalidateQueries({ queryKey: ["qc_matrix_pending"] });
      qc.invalidateQueries({ queryKey: ["qc_matrix_list"] });
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const base = {
    pir,
    poLineItemId: line.id,
    partDescription: line.tube_spec ?? null,
  };

  if (!pir) {
    return (
      <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90 flex items-start gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
        Esta línea no tiene número de parte (PIR). Captúralo en el paso de verificación de PIR
        antes de revisar la matriz de documentos.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!canFlag && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          Solo lectura — se requiere rol de Ingeniería o Calidad.
        </div>
      )}

      {/* Status card */}
      <div className="rounded-md border p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <FileText className="h-4 w-4" /> Matriz de documentos
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              Parte <span className="font-mono">{pir}</span>
            </p>
          </div>
          <Badge variant="outline" className={meta.className}>
            <StatusIcon className="h-3 w-3 mr-1" /> {meta.label}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-3 text-xs">
          <div>
            <div className="text-muted-foreground">Revisión en la OC</div>
            <div className="font-mono">{poRev ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Revisión documentada</div>
            <div className="font-mono">{entry?.documented_rev ?? "—"}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Revisión del plano</div>
            <div className="font-mono">{planRev ?? "—"}</div>
          </div>
        </div>

        {isLoading && <p className="text-xs text-muted-foreground">Consultando la matriz…</p>}

        {derivedStatus === "new_rev_pending" && (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-200/90">
            La revisión de la OC no coincide con la documentada. Calidad debe actualizar el registro.
          </div>
        )}
      </div>

      {/* Actions */}
      {canFlag && (
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Nota (opcional)</Label>
            <Textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Contexto para Calidad…"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() =>
                run(
                  () => requestRevFn({ data: { ...base, rev: poRev, note: note || null } }),
                  "Se solicitó a Calidad actualizar la revisión",
                )
              }
            >
              <Send className="h-3.5 w-3.5 mr-1" /> Solicitar actualización a Calidad
            </Button>

            {line.plan_dropbox_path && (
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() =>
                  run(
                    () =>
                      attachFn({
                        data: {
                          ...base,
                          rev: planRev,
                          dropboxPath: line.plan_dropbox_path as string,
                          dropboxName: (line.plan_dropbox_name ?? "plano") as string,
                        },
                      }),
                    "Plano adjuntado a la matriz",
                  )
                }
              >
                <FileText className="h-3.5 w-3.5 mr-1" /> Adjuntar plano de Dropbox
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              onClick={() =>
                run(
                  () => requestCustomerFn({ data: { ...base, note: note || null } }),
                  "Marcado como solicitado al cliente",
                )
              }
            >
              <Clock className="h-3.5 w-3.5 mr-1" /> Solicitar al cliente
            </Button>
          </div>

          {canDocument && (
            <div className="rounded-md border p-3 space-y-2">
              <Label className="text-xs">Calidad — registrar revisión documentada</Label>
              <div className="flex gap-2">
                <Input
                  className="h-8 font-mono"
                  placeholder={poRev ?? "Rev."}
                  value={revInput}
                  onChange={(e) => setRevInput(e.target.value)}
                />
                <Button
                  size="sm"
                  disabled={busy || !(revInput.trim() || poRev)}
                  onClick={() =>
                    run(
                      () =>
                        documentFn({
                          data: {
                            ...base,
                            rev: (revInput.trim() || poRev) as string,
                            note: note || null,
                          },
                        }),
                      "Documento registrado en la matriz",
                    )
                  }
                >
                  Marcar documentado
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <Separator />

      {/* History */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <History className="h-4 w-4" /> Historial del documento
        </h3>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground">Sin movimientos registrados.</p>
        ) : (
          <ul className="space-y-1.5">
            {events.map((ev) => (
              <li key={ev.id} className="rounded border px-2.5 py-1.5 text-xs">
                <div className="flex items-center justify-between gap-2">
                  <span>{EVENT_LABEL[ev.kind] ?? ev.kind}</span>
                  <span className="text-muted-foreground">
                    {new Date(ev.occurred_at).toLocaleString("es-MX")}
                  </span>
                </div>
                {(ev.from_rev || ev.to_rev) && (
                  <div className="text-muted-foreground font-mono mt-0.5">
                    {ev.from_rev ?? "—"} → {ev.to_rev ?? "—"}
                  </div>
                )}
                {ev.note && <div className="text-muted-foreground mt-0.5">{ev.note}</div>}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Step sign-off */}
      {canFlag && (
        <>
          <Separator />
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-muted-foreground">
              {line.quality_matrix_signed_off_at
                ? `Verificación firmada el ${new Date(line.quality_matrix_signed_off_at).toLocaleString("es-MX")}`
                : "Firma la verificación cuando el documento esté confirmado."}
            </p>
            <Button
              size="sm"
              disabled={busy || derivedStatus !== "documented"}
              onClick={() =>
                run(
                  () => signOffFn({ data: { poLineItemId: line.id, notes: note || null } }),
                  "Verificación de documento firmada",
                )
              }
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Firmar verificación
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
