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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowRight, Download, ExternalLink, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  ENGINEERING_STEPS,
  getStep,
  type EngStepKey,
} from "@/lib/engineering-steps";
import { advanceEngStep } from "@/lib/po-workflow.functions";
import { updatePoLineField } from "@/lib/po-workflow.functions";
import type { PoLineWithContext } from "@/hooks/usePoQueues";

const MASTER_PIR_PATH = "master-pir/current.xlsx";

interface Props {
  line: PoLineWithContext | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EngStepDrawer({ line, open, onOpenChange }: Props) {
  const advanceFn = useServerFn(advanceEngStep);
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  if (!line) return null;
  const currentKey = (line.eng_step ?? ENGINEERING_STEPS[0].key) as EngStepKey;
  const step = getStep(currentKey);

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["po_lines_by_status"] });

  const handleAdvance = async () => {
    setBusy(true);
    try {
      const res = await advanceFn({ data: { id: line.id } });
      toast.success(res.completed ? "Ready for production" : "Step completed");
      await refresh();
      if (res.completed) onOpenChange(false);
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
            Step {ENGINEERING_STEPS.findIndex((s) => s.key === currentKey) + 1}
            /{ENGINEERING_STEPS.length}: {step?.label ?? "—"}
          </SheetTitle>
          <SheetDescription>{step?.description}</SheetDescription>
        </SheetHeader>

        <div className="my-4 rounded-md border bg-muted/30 p-3 text-sm space-y-1">
          <div className="font-medium">
            {line.purchase_order?.customer?.name ?? "—"}
          </div>
          <div className="font-mono text-xs text-muted-foreground">
            {line.purchase_order?.po_number} · Line {line.line_number}
          </div>
        </div>

        <div className="py-2">
          {currentKey === "po_info" && <PoInfoPanel line={line} />}
          {currentKey === "pir_verify" && (
            <PirVerifyPanel line={line} onSaved={refresh} />
          )}
          {currentKey === "components" && <ComponentsPanel />}
          {currentKey === "matrix_check" && <MatrixPanel />}
        </div>

        <SheetFooter className="mt-6">
          <Button
            className="w-full"
            disabled={busy}
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

function PoInfoPanel({ line }: { line: PoLineWithContext }) {
  const po = line.purchase_order;
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-semibold mb-2">PO Info (read-only)</h3>
      <Field label="Customer" value={po?.customer?.name} />
      <Field label="PO #" value={po?.po_number} />
      <Field label="Line #" value={`L${line.line_number}`} />
      <Field label="PIR" value={line.pir} />
      <Field label="Tube spec" value={line.tube_spec} />
      <Field label="Qty ordered" value={line.qty_ordered} />
      <Field label="Committed date" value={line.committed_date} />
      <Field label="Issued date" value={po?.issued_date} />
      {po?.source_document_url && (
        <div className="pt-3">
          <a
            href={po.source_document_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            Open source PDF <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      )}
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
  const [spec, setSpec] = useState(line.tube_spec ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPir(line.pir ?? "");
    setSpec(line.tube_spec ?? "");
  }, [line.id, line.pir, line.tube_spec]);

  const save = async (field: "pir" | "tube_spec", value: string) => {
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

function MatrixPanel() {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Quality Matrix Check</h3>
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        <p className="mb-2">Matrix workflow TBD.</p>
        <p className="text-xs">
          Final UI lands once the team defines the matrix source. Use the
          button below to mark the check complete. No auto-email is sent.
        </p>
      </div>
    </div>
  );
}