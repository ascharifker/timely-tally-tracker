import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { AlertTriangle, Check, Download, FileText, Minus, Upload, X } from "lucide-react";
import type { PoLineWithContext } from "@/hooks/usePoQueues";
import {
  getQualityMatrixTemplate,
  getPoLineQualityChecks,
  saveQualityMatrixCheck,
  signOffQualityMatrix,
  attachQualityMatrixDocument,
  getQualityMatrixDocumentUrl,
} from "@/lib/quality-matrix.functions";

interface Props {
  line: PoLineWithContext;
  canReview: boolean;
  onSaved: () => void;
}

type CheckStatus = "pass" | "fail" | "n_a";

interface CheckFormValue {
  status: CheckStatus | null;
  notes: string;
}

export function QualityMatrixPanel({ line, canReview, onSaved }: Props) {
  const qc = useQueryClient();
  const templateFn = useServerFn(getQualityMatrixTemplate);
  const checksFn = useServerFn(getPoLineQualityChecks);
  const saveCheckFn = useServerFn(saveQualityMatrixCheck);
  const signOffFn = useServerFn(signOffQualityMatrix);
  const attachFn = useServerFn(attachQualityMatrixDocument);
  const signUrlFn = useServerFn(getQualityMatrixDocumentUrl);

  const [uploading, setUploading] = useState(false);
  const [working, setWorking] = useState(false);
  const [signNotes, setSignNotes] = useState(line.quality_matrix_notes ?? "");
  const [formValues, setFormValues] = useState<Record<string, CheckFormValue>>({});

  const { data: templateData } = useQuery({
    queryKey: ["quality_matrix_template"],
    queryFn: () => templateFn(),
  });

  const { data: checksData, refetch: refetchChecks } = useQuery({
    queryKey: ["po_line_quality_checks", line.id],
    queryFn: () => checksFn({ data: { poLineItemId: line.id } }),
  });

  const checksByItemId = useMemo(() => {
    const map: Record<string, (typeof checksData?.checks)[number]> = {};
    for (const c of checksData?.checks ?? []) {
      map[c.item_id] = c;
    }
    return map;
  }, [checksData]);

  useEffect(() => {
    const next: Record<string, CheckFormValue> = {};
    for (const item of templateData?.items ?? []) {
      const existing = checksByItemId[item.id];
      next[item.id] = {
        status: (existing?.status as CheckStatus) ?? null,
        notes: existing?.notes ?? "",
      };
    }
    setFormValues(next);
  }, [templateData, checksByItemId]);

  useEffect(() => {
    setSignNotes(line.quality_matrix_notes ?? "");
  }, [line.id, line.quality_matrix_notes]);

  const groupedItems = useMemo(() => {
    const groups: Record<string, typeof templateData.items> = {};
    for (const item of templateData?.items ?? []) {
      const cat = item.category ?? "General";
      groups[cat] = groups[cat] ?? [];
      groups[cat].push(item);
    }
    return groups;
  }, [templateData]);

  const categories = Object.keys(groupedItems).sort();

  const stats = useMemo(() => {
    const values = Object.values(formValues);
    const total = values.length;
    const pass = values.filter((v) => v.status === "pass").length;
    const fail = values.filter((v) => v.status === "fail").length;
    const na = values.filter((v) => v.status === "n_a").length;
    const pending = total - pass - fail - na;
    return { total, pass, fail, na, pending };
  }, [formValues]);

  const handleUpload = async (file: File) => {
    if (!canReview) return;
    setUploading(true);
    try {
      const path = `quality-matrix/${line.id}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("po-documents")
        .upload(path, file, { contentType: file.type || "application/pdf", upsert: true });
      if (error) throw error;
      await attachFn({ data: { poLineItemId: line.id, storagePath: path } });
      toast.success("Quality matrix document attached");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const openDocument = async () => {
    if (!line.quality_matrix_document_url) return;
    setWorking(true);
    try {
      const { url } = await signUrlFn({ data: { storagePath: line.quality_matrix_document_url } });
      window.open(url, "_blank", "noopener");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open document");
    } finally {
      setWorking(false);
    }
  };

  const updateStatus = async (itemId: string, status: CheckStatus) => {
    if (!canReview) return;
    const notes = formValues[itemId]?.notes ?? "";
    setFormValues((v) => ({ ...v, [itemId]: { ...v[itemId], status } }));
    try {
      await saveCheckFn({ data: { poLineItemId: line.id, itemId, status, notes } });
      await refetchChecks();
      toast.success("Check saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error saving check");
    }
  };

  const updateNotes = async (itemId: string, notes: string) => {
    setFormValues((v) => ({ ...v, [itemId]: { ...v[itemId], notes } }));
  };

  const saveNotes = async (itemId: string) => {
    if (!canReview) return;
    const status = formValues[itemId]?.status;
    if (!status) return;
    try {
      await saveCheckFn({
        data: {
          poLineItemId: line.id,
          itemId,
          status,
          notes: formValues[itemId]?.notes ?? null,
        },
      });
      await refetchChecks();
      toast.success("Notes saved");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error saving notes");
    }
  };

  const handleSignOff = async () => {
    if (!canReview) return;
    setWorking(true);
    try {
      await signOffFn({ data: { poLineItemId: line.id, notes: signNotes.trim() || null } });
      toast.success("Quality matrix signed off");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error signing off");
    } finally {
      setWorking(false);
    }
  };

  const signedOff = !!line.quality_matrix_signed_off_at;

  return (
    <div className="space-y-5">
      {!canReview && (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200/90 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          Read-only — the Engineering role is required to edit the matrix.
        </div>
      )}

      {/* Reference document */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold flex items-center gap-2">
          <FileText className="h-4 w-4" /> Reference document
        </h3>
        {line.quality_matrix_document_url ? (
          <div className="rounded-md border p-3 flex items-center justify-between gap-3">
            <div className="text-sm truncate">{line.quality_matrix_document_url.split("/").pop()}</div>
            <div className="flex items-center gap-2 shrink-0">
              <Button variant="secondary" size="sm" disabled={working} onClick={openDocument}>
                <Download className="h-3.5 w-3.5 mr-1" /> Open
              </Button>
              {canReview && (
                <label className="inline-flex">
                  <input
                    type="file"
                    accept=".pdf,.xlsx,.xls"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) handleUpload(f);
                      e.currentTarget.value = "";
                    }}
                  />
                  <Button variant="outline" size="sm" disabled={uploading} asChild>
                    <span>{uploading ? "Uploading…" : "Replace"}</span>
                  </Button>
                </label>
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-md border border-dashed p-4 text-center space-y-2">
            <p className="text-xs text-muted-foreground">No quality matrix document attached.</p>
            {canReview && (
              <label className="inline-flex">
                <input
                  type="file"
                  accept=".pdf,.xlsx,.xls"
                  className="hidden"
                  disabled={uploading}
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUpload(f);
                    e.currentTarget.value = "";
                  }}
                />
                <Button size="sm" disabled={uploading} asChild>
                  <span>
                    <Upload className="h-3.5 w-3.5 mr-1" />
                    {uploading ? "Uploading…" : "Attach document"}
                  </span>
                </Button>
              </label>
            )}
          </div>
        )}
      </div>

      <Separator />

      {/* Checklist */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Digital checklist</h3>
          <div className="flex items-center gap-1.5 text-xs">
            <Badge variant="outline" className="text-emerald-300 border-emerald-500/40">
              <Check className="h-3 w-3 mr-1" /> {stats.pass}
            </Badge>
            <Badge variant="outline" className="text-red-300 border-red-500/40">
              <X className="h-3 w-3 mr-1" /> {stats.fail}
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              <Minus className="h-3 w-3 mr-1" /> N/A {stats.na}
            </Badge>
            {stats.pending > 0 && (
              <Badge variant="outline" className="text-amber-300 border-amber-500/40">
                Pending {stats.pending}/{stats.total}
              </Badge>
            )}
          </div>
        </div>

        {templateData?.items.length === 0 && (
          <p className="text-sm text-muted-foreground">No checklist items configured yet.</p>
        )}

        {categories.map((category) => (
          <div key={category} className="rounded-md border overflow-hidden">
            <div className="bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {category}
            </div>
            <div className="divide-y">
              {groupedItems[category].map((item) => {
                const value = formValues[item.id] ?? { status: null, notes: "" };
                return (
                  <div key={item.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm leading-snug">
                        {item.label}
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <StatusButton
                          status="pass"
                          current={value.status}
                          disabled={!canReview}
                          onClick={() => updateStatus(item.id, "pass")}
                        />
                        <StatusButton
                          status="fail"
                          current={value.status}
                          disabled={!canReview}
                          onClick={() => updateStatus(item.id, "fail")}
                        />
                        <StatusButton
                          status="n_a"
                          current={value.status}
                          disabled={!canReview}
                          onClick={() => updateStatus(item.id, "n_a")}
                        />
                      </div>
                    </div>
                    <Textarea
                      rows={2}
                      placeholder="Notes…"
                      value={value.notes}
                      disabled={!canReview}
                      onChange={(e) => updateNotes(item.id, e.target.value)}
                      onBlur={() => canReview && saveNotes(item.id)}
                      className="text-xs min-h-0 py-1.5"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <Separator />

      {/* Sign-off */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Sign-off</h3>
        {signedOff ? (
          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 p-3 space-y-1">
            <div className="text-sm font-medium text-emerald-200 flex items-center gap-2">
              <Check className="h-4 w-4" /> Signed off
            </div>
            {line.quality_matrix_signed_off_at && (
              <div className="text-xs text-muted-foreground">
                {new Date(line.quality_matrix_signed_off_at).toLocaleString()}
              </div>
            )}
            {line.quality_matrix_notes && (
              <div className="text-xs text-muted-foreground pt-1">{line.quality_matrix_notes}</div>
            )}
          </div>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="sign-notes">Sign-off notes</Label>
            <Textarea
              id="sign-notes"
              rows={3}
              placeholder="Optional notes before signing off…"
              value={signNotes}
              disabled={!canReview}
              onChange={(e) => setSignNotes(e.target.value)}
            />
            {stats.pending > 0 && (
              <p className="text-xs text-amber-300/80 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {stats.pending} item(s) still unchecked.
              </p>
            )}
            {stats.fail > 0 && (
              <p className="text-xs text-red-300/80 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                {stats.fail} item(s) marked failed.
              </p>
            )}
            <Button
              className="w-full"
              disabled={!canReview || working}
              onClick={handleSignOff}
            >
              {working ? "Saving…" : "Sign off matrix"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusButton({
  status,
  current,
  disabled,
  onClick,
}: {
  status: CheckStatus;
  current: CheckStatus | null;
  disabled: boolean;
  onClick: () => void;
}) {
  const active = current === status;
  const variants: Record<CheckStatus, string> = {
    pass: active
      ? "bg-emerald-500 text-white border-emerald-500 hover:bg-emerald-600"
      : "border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/10",
    fail: active
      ? "bg-red-500 text-white border-red-500 hover:bg-red-600"
      : "border-red-500/40 text-red-300 hover:bg-red-500/10",
    n_a: active
      ? "bg-muted text-foreground border-border hover:bg-muted/80"
      : "border-border text-muted-foreground hover:bg-muted/50",
  };

  const labels: Record<CheckStatus, string> = {
    pass: "Pass",
    fail: "Fail",
    n_a: "N/A",
  };

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`px-2 py-1 text-xs rounded-md border transition-colors disabled:opacity-50 ${variants[status]}`}
    >
      {labels[status]}
    </button>
  );
}
