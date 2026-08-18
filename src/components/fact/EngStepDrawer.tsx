import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useUserRole";
import { canReviewEngineering } from "@/lib/rbac";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, ArrowRight, Download, ExternalLink, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  ENGINEERING_STEPS,
  getStep,
  stepIndex,
  type EngStepKey,
} from "@/lib/engineering-steps";
import {
  advanceEngStep,
  revertEngStep,
  setEngStep,
} from "@/lib/po-workflow.functions";
import { updatePoLineField } from "@/lib/po-workflow.functions";
import { attachPoDocument, getPoDocumentUrl } from "@/lib/po-intake.functions";
import { BODY_SPEC_FIELDS, type BodySpecKey } from "@/lib/body-spec";
import type { PoLineWithContext } from "@/hooks/usePoQueues";
import { QualityMatrixPanel } from "./QualityMatrixPanel";
import { DesignPlansPanel } from "./DesignPlansPanel";

const MASTER_PIR_PATH = "master-pir/current.xlsx";

interface Props {
  line: PoLineWithContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialStep?: EngStepKey | null;
}

export function EngStepDrawer({ line, open, onOpenChange, initialStep }: Props) {
  const advanceFn = useServerFn(advanceEngStep);
  const revertFn = useServerFn(revertEngStep);
  const jumpFn = useServerFn(setEngStep);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const { roles } = useAuth();
  const canReview = canReviewEngineering(roles);
  const realKey = (line?.eng_step ?? ENGINEERING_STEPS[0].key) as EngStepKey;
  const [viewStep, setViewStep] = useState<EngStepKey>(realKey);

  useEffect(() => {
    if (!open) return;
    setViewStep((initialStep ?? realKey) as EngStepKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, line?.id, initialStep]);

  if (!line) return null;
  const currentKey = realKey;
  const step = getStep(viewStep);
  const isPreview = viewStep !== currentKey;
  const viewIdx = stepIndex(viewStep);

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["po_lines_by_status"] });

  const handleAdvance = async () => {
    setBusy(true);
    try {
      const res = await advanceFn({ data: { id: line.id } });
      toast.success(res.completed ? "Ready for production" : "Step completed", {
        duration: 10000,
        action: {
          label: "Undo",
          onClick: async () => {
            try {
              await revertFn({ data: { id: line.id, kind: "undo" } });
              toast.success("Step restored");
              await refresh();
            } catch (e) {
              toast.error(e instanceof Error ? e.message : "Error");
            }
          },
        },
      });
      await refresh();
      if (res.completed) onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const handleBack = async () => {
    setBusy(true);
    try {
      await revertFn({ data: { id: line.id, kind: "back" } });
      toast.success("Moved back one step");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const handleSetCurrent = async () => {
    setBusy(true);
    try {
      await jumpFn({ data: { id: line.id, step: viewStep } });
      toast.success(`Current step set to ${getStep(viewStep)?.label}`);
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="bg-card w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            Step {viewIdx + 1}/{ENGINEERING_STEPS.length}: {step?.label ?? "—"}
          </SheetTitle>
          <SheetDescription>{step?.description}</SheetDescription>
        </SheetHeader>

        <div className="mt-3 flex flex-wrap gap-1">
          {ENGINEERING_STEPS.map((s, i) => {
            const active = s.key === viewStep;
            const isCurrent = s.key === currentKey;
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => setViewStep(s.key)}
                title={s.label}
                className={cn(
                  "rounded-md border px-2 py-1 text-xs transition-colors",
                  active
                    ? "border-primary bg-primary/15 text-foreground"
                    : "border-border text-muted-foreground hover:bg-muted/50",
                  !active && isCurrent && "border-emerald-500/60 text-emerald-300",
                )}
              >
                {i + 1}. {s.shortLabel}
              </button>
            );
          })}
        </div>

        {isPreview && (
          <div className="mt-3 flex flex-wrap items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
            <span className="text-amber-200/90">
              Viewing {getStep(viewStep)?.label} — current step is{" "}
              {getStep(currentKey)?.label}
            </span>
            <div className="ml-auto flex gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setViewStep(currentKey)}
              >
                Back to current
              </Button>
              <Button
                size="sm"
                variant="secondary"
                disabled={!canReview || busy}
                onClick={handleSetCurrent}
              >
                Set as current step
              </Button>
            </div>
          </div>
        )}

        <div className="my-4 rounded-md border bg-muted/30 p-3 text-sm space-y-1">
          <div className="font-medium">
            {line.purchase_order?.customer?.name ?? "—"}
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            {line.purchase_order?.po_number} · Line {line.line_number}
          </div>
        </div>

        <div className="py-2">
          {viewStep === "po_info" && (
            <PoInfoPanel line={line} onSaved={refresh} />
          )}
          {viewStep === "pir_verify" && (
            <div className="space-y-6">
              <PirVerifyPanel line={line} onSaved={refresh} />
              <div className="border-t pt-4">
                <DesignPlansPanel
                  line={line}
                  canReview={canReview}
                  onSaved={refresh}
                />
              </div>
            </div>
          )}
          {viewStep === "body_spec" && (
            <BodySpecPanel line={line} onSaved={refresh} />
          )}
          {viewStep === "components" && <ComponentsPanel />}
          {viewStep === "matrix_check" && (
            <QualityMatrixPanel line={line} canReview={canReview} onSaved={refresh} />
          )}
        </div>

        <div className="mt-4 flex items-center justify-between gap-2 border-t pt-3">
          <Button
            size="sm"
            variant="ghost"
            disabled={viewIdx <= 0}
            onClick={() => setViewStep(ENGINEERING_STEPS[viewIdx - 1].key)}
          >
            <ArrowLeft className="h-3.5 w-3.5 mr-1" /> Previous step
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Browsing only — nothing is recorded
          </span>
          <Button
            size="sm"
            variant="ghost"
            disabled={viewIdx >= ENGINEERING_STEPS.length - 1}
            onClick={() => setViewStep(ENGINEERING_STEPS[viewIdx + 1].key)}
          >
            Next step <ArrowRight className="h-3.5 w-3.5 ml-1" />
          </Button>
        </div>

        <SheetFooter className="mt-6 flex-col gap-2 sm:flex-row">
          <Button
            variant="outline"
            className="sm:w-auto w-full"
            disabled={!canReview || busy || stepIndex(currentKey) <= 0}
            onClick={handleBack}
          >
            <ArrowLeft className="h-4 w-4 mr-2" /> Back
          </Button>
          <Button
            className="w-full"
            disabled={!canReview || busy}
            onClick={handleAdvance}
          >
            {currentKey === "matrix_check"
              ? "Mark complete → Ready for production"
              : "Complete step"}
            <ArrowRight className="h-4 w-4 ml-2" />
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid grid-cols-3 gap-2 py-1.5 text-sm border-b border-border/40 last:border-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="col-span-2 font-mono">{value ?? "—"}</div>
    </div>
  );
}

function PoInfoPanel({
  line,
  onSaved,
}: {
  line: PoLineWithContext;
  onSaved: () => void;
}) {
  const po = line.purchase_order;
  const signFn = useServerFn(getPoDocumentUrl);
  const attachFn = useServerFn(attachPoDocument);
  const [working, setWorking] = useState(false);

  const openPdf = async () => {
    if (!po?.source_document_url) return;
    setWorking(true);
    try {
      const { url } = await signFn({
        data: { storagePath: po.source_document_url },
      });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo abrir el PDF");
    } finally {
      setWorking(false);
    }
  };

  const attach = async (file: File) => {
    if (!po?.id) return;
    setWorking(true);
    try {
      const path = `po/${po.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("po-documents")
        .upload(path, file, { contentType: file.type || "application/pdf" });
      if (error) throw error;
      await attachFn({ data: { purchaseOrderId: po.id, storagePath: path } });
      toast.success("PO PDF attached");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold mb-2">PO Info (read-only)</h3>
      <Field label="Customer" value={po?.customer?.name} />
      <Field label="PO #" value={po?.po_number} />
      <Field label="Line #" value={`L${line.line_number}`} />
      <Field label="PIR" value={line.pir} />
      <Field label="PIR rev" value={line.pir_rev} />
      <Field label="Tube spec" value={line.tube_spec} />
      <Field label="Qty ordered" value={line.qty_ordered} />
      <Field label="Committed date" value={line.committed_date} />
      <Field label="Issued date" value={po?.issued_date} />
      <div className="pt-3">
        {po?.source_document_url ? (
          <Button
            variant="secondary"
            size="sm"
            disabled={working}
            onClick={openPdf}
          >
            Open source PDF <ExternalLink className="h-3.5 w-3.5 ml-1" />
          </Button>
        ) : (
          <div className="rounded-md border border-dashed p-3 space-y-2">
            <p className="text-xs text-muted-foreground">
              No PDF attached to this PO.
            </p>
            <label className="inline-flex">
              <input
                type="file"
                accept="application/pdf"
                className="hidden"
                disabled={working}
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) attach(f);
                  e.currentTarget.value = "";
                }}
              />
              <Button size="sm" disabled={working} asChild>
                <span>
                  <Upload className="h-3.5 w-3.5 mr-1" />
                  {working ? "Uploading…" : "Attach PO PDF"}
                </span>
              </Button>
            </label>
          </div>
        )}
      </div>
    </div>
  );
}

function PirVerifyPanel({
  line,
  onSaved,
}: {
  line: PoLineWithContext;
  onSaved: () => void;
}) {
  const updateFn = useServerFn(updatePoLineField);
  const [pir, setPir] = useState(line.pir ?? "");
  const [rev, setRev] = useState(line.pir_rev ?? "");
  const [spec, setSpec] = useState(line.tube_spec ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPir(line.pir ?? "");
    setRev(line.pir_rev ?? "");
    setSpec(line.tube_spec ?? "");
  }, [line.id, line.pir, line.pir_rev, line.tube_spec]);

  const save = async (
    field: "pir" | "pir_rev" | "tube_spec",
    value: string,
  ) => {
    setSaving(true);
    try {
      await updateFn({
        data: { id: line.id, field, value: value.trim() || null },
      });
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">PIR Verification</h3>
      <p className="text-xs text-muted-foreground">
        Confirm PIR number and tube spec. Saving updates the PO line directly.
      </p>
      <div className="space-y-2">
        <Label htmlFor="pir">PIR</Label>
        <div className="flex gap-2">
          <Input
            id="pir"
            value={pir}
            onChange={(e) => setPir(e.target.value)}
            placeholder="e.g. 102882625"
          />
          <Button
            variant="secondary"
            disabled={saving || pir === (line.pir ?? "")}
            onClick={() => save("pir", pir)}
          >
            Save
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="pir_rev">PIR revision</Label>
        <div className="flex gap-2">
          <Input
            id="pir_rev"
            value={rev}
            onChange={(e) => setRev(e.target.value)}
            placeholder="e.g. Rev C"
          />
          <Button
            variant="secondary"
            disabled={saving || rev === (line.pir_rev ?? "")}
            onClick={() => save("pir_rev", rev)}
          >
            Save
          </Button>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="spec">Tube spec</Label>
        <div className="flex gap-2">
          <Input
            id="spec"
            value={spec}
            onChange={(e) => setSpec(e.target.value)}
            placeholder="e.g. 2.875 L80"
          />
          <Button
            variant="secondary"
            disabled={saving || spec === (line.tube_spec ?? "")}
            onClick={() => save("tube_spec", spec)}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
}

function ComponentsPanel() {
  return <ComponentsPanelInner />;
}

function BodySpecPanel({
  line,
  onSaved,
}: {
  line: PoLineWithContext;
  onSaved: () => void;
}) {
  const updateFn = useServerFn(updatePoLineField);
  const [values, setValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, string> = {};
    for (const f of BODY_SPEC_FIELDS) {
      next[f.key] = (line[f.key] as string | null) ?? "";
    }
    setValues(next);
  }, [line]);

  const save = async (key: BodySpecKey) => {
    setSaving(key);
    try {
      await updateFn({
        data: { id: line.id, field: key, value: values[key]?.trim() || null },
      });
      toast.success("Saved");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setSaving(null);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Body / Tube Spec Review</h3>
      <p className="text-xs text-muted-foreground">
        Steel tubing that becomes the part body — separate from the component
        specs.
      </p>
      <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1">
        <div className="text-muted-foreground">Raw spec from the PO</div>
        <div className="font-mono">{line.tube_spec ?? "—"}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {BODY_SPEC_FIELDS.map((f) => (
          <div
            key={f.key}
            className={`space-y-2 ${f.wide ? "sm:col-span-2" : ""}`}
          >
            <Label htmlFor={f.key}>{f.label}</Label>
            <div className="flex gap-2">
              <Input
                id={f.key}
                value={values[f.key] ?? ""}
                placeholder={f.placeholder}
                onChange={(e) =>
                  setValues((v) => ({ ...v, [f.key]: e.target.value }))
                }
              />
              <Button
                variant="secondary"
                disabled={
                  saving !== null ||
                  (values[f.key] ?? "") ===
                    (((line[f.key] as string | null) ?? "") as string)
                }
                onClick={() => save(f.key)}
              >
                Save
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ComponentsPanelInner() {
  const [uploading, setUploading] = useState(false);
  const [lastModified, setLastModified] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMeta = async () => {
    setLoading(true);
    try {
      const { data } = await supabase.storage
        .from("po-documents")
        .list("master-pir", { limit: 5 });
      const current = data?.find((f) => f.name === "current.xlsx");
      setLastModified(current?.updated_at ?? current?.created_at ?? null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMeta();
  }, []);

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      const { error } = await supabase.storage
        .from("po-documents")
        .upload(MASTER_PIR_PATH, file, {
          upsert: true,
          contentType:
            "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        });
      if (error) throw error;
      toast.success("Master PIR updated");
      await loadMeta();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const download = async () => {
    const { data, error } = await supabase.storage
      .from("po-documents")
      .createSignedUrl(MASTER_PIR_PATH, 60);
    if (error || !data) {
      toast.error("No Master PIR uploaded yet");
      return;
    }
    window.open(data.signedUrl, "_blank");
  };

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold">Part Component List</h3>
      <p className="text-xs text-muted-foreground">
        Cross-check the line against the Master PIR component list (Excel).
      </p>
      <div className="rounded-md border p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium">Master PIR</div>
            <div className="text-xs text-muted-foreground">
              {loading
                ? "Loading…"
                : lastModified
                  ? `Last uploaded ${new Date(lastModified).toLocaleString()}`
                  : "Not uploaded yet"}
            </div>
          </div>
          {lastModified && (
            <Badge variant="outline" className="text-emerald-300 border-emerald-500/40">
              Available
            </Badge>
          )}
        </div>
        <Separator />
        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={download}
            disabled={!lastModified}
          >
            <Download className="h-3.5 w-3.5 mr-1" /> Download
          </Button>
          <label className="inline-flex">
            <input
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.currentTarget.value = "";
              }}
            />
            <Button
              variant="default"
              size="sm"
              disabled={uploading}
              asChild
            >
              <span>
                <Upload className="h-3.5 w-3.5 mr-1" />
                {uploading
                  ? "Uploading…"
                  : lastModified
                    ? "Replace"
                    : "Upload"}
              </span>
            </Button>
          </label>
        </div>
      </div>
    </div>
  );
}
