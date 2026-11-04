import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Download, Eye, FileText, RefreshCw, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { attachPoDocument, getPoDocumentUrl } from "@/lib/po-intake.functions";
import { AttachmentsPanel } from "./DocumentAttachments";

function fileNameOf(path: string) {
  const base = path.split("/").pop() ?? path;
  return base.replace(/^\d{10,}-/, "");
}

/**
 * The original PO file as a persistent artifact: preview inline, download,
 * replace, plus any extra PO-level documents. Shared by Orders and Engineering.
 */
export function PoDocumentCard({
  poId,
  poNumber,
  storagePath,
  onChanged,
  canEdit = true,
}: {
  poId: string;
  poNumber: string;
  storagePath: string | null;
  onChanged?: () => void;
  canEdit?: boolean;
}) {
  const signFn = useServerFn(getPoDocumentUrl);
  const attachFn = useServerFn(attachPoDocument);
  const [busy, setBusy] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const preview = async () => {
    if (!storagePath) return;
    setBusy(true);
    try {
      const { url } = await signFn({ data: { storagePath } });
      setPreviewUrl(url);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo abrir el PDF");
    } finally {
      setBusy(false);
    }
  };

  const download = async () => {
    if (!storagePath) return;
    setBusy(true);
    try {
      const { url } = await signFn({ data: { storagePath, download: fileNameOf(storagePath) } });
      window.location.href = url;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo descargar");
    } finally {
      setBusy(false);
    }
  };

  const upload = async (file: File) => {
    setBusy(true);
    try {
      const path = `po/${poId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error } = await supabase.storage
        .from("po-documents")
        .upload(path, file, { contentType: file.type || "application/pdf" });
      if (error) throw error;
      await attachFn({ data: { purchaseOrderId: poId, storagePath: path } });
      toast.success("PDF de la PO guardado");
      onChanged?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error al subir");
    } finally {
      setBusy(false);
    }
  };

  const uploadButton = (label: string, Icon: typeof Upload) => (
    <label className="inline-flex">
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        disabled={busy}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) upload(f);
          e.currentTarget.value = "";
        }}
      />
      <Button size="sm" variant="outline" disabled={busy} asChild>
        <span>
          <Icon className="h-3.5 w-3.5 mr-1" /> {label}
        </span>
      </Button>
    </label>
  );

  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/30 p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <FileText className="h-4 w-4" /> PO original
        </div>
        {storagePath ? (
          <>
            <div className="text-xs font-mono truncate" title={fileNameOf(storagePath)}>
              {fileNameOf(storagePath)}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="secondary" disabled={busy} onClick={preview}>
                <Eye className="h-3.5 w-3.5 mr-1" /> Vista previa
              </Button>
              <Button size="sm" variant="outline" disabled={busy} onClick={download}>
                <Download className="h-3.5 w-3.5 mr-1" /> Descargar
              </Button>
              {canEdit && uploadButton("Reemplazar", RefreshCw)}
            </div>
          </>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">Esta PO no tiene PDF guardado.</p>
            {canEdit && uploadButton(busy ? "Subiendo…" : "Adjuntar PDF de la PO", Upload)}
          </div>
        )}
      </div>

      <AttachmentsPanel
        entityType="purchase_order"
        entityId={poId}
        categories={["orden_compra", "otro"]}
        title="Otros documentos de la PO"
        canEdit={canEdit}
      />

      <Dialog open={!!previewUrl} onOpenChange={(o) => !o && setPreviewUrl(null)}>
        <DialogContent className="max-w-5xl h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>PO {poNumber}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            <iframe src={previewUrl} title={`PO ${poNumber}`} className="flex-1 w-full rounded border" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
