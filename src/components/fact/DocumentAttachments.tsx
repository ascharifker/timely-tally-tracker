import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Cloud, ExternalLink, FileText, Folder, Loader2, Paperclip, Search, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { searchDesignPlans, getPlanTemporaryLink } from "@/lib/dropbox.functions";

export type AttachmentEntity = "purchase_order" | "po_line" | "job" | "qc_matrix";

export type PickedDocument =
  | { source: "dropbox"; name: string; path: string }
  | { source: "upload"; name: string; file: File };

type DropboxHit = { name: string; path_display?: string; path_lower?: string; is_folder?: boolean };

/** Two-tab picker: local upload or Dropbox team search. */
export function DocumentPicker({
  onPick,
  accept,
  busy,
}: {
  onPick: (doc: PickedDocument) => void;
  accept?: string;
  busy?: boolean;
}) {
  const searchFn = useServerFn(searchDesignPlans);
  const [q, setQ] = useState("");
  const [active, setActive] = useState("");
  const res = useQuery({
    queryKey: ["doc_picker_search", active],
    enabled: active.trim().length >= 2,
    queryFn: () => searchFn({ data: { query: active.trim(), limit: 20 } }),
  });
  const files = ((res.data?.files ?? []) as DropboxHit[]).filter((f) => !f.is_folder);

  return (
    <Tabs defaultValue="upload" className="w-full">
      <TabsList className="grid grid-cols-2 w-full">
        <TabsTrigger value="upload">
          <Upload className="h-3.5 w-3.5 mr-1" /> Subir archivo
        </TabsTrigger>
        <TabsTrigger value="dropbox">
          <Cloud className="h-3.5 w-3.5 mr-1" /> Buscar en Dropbox
        </TabsTrigger>
      </TabsList>
      <TabsContent value="upload" className="mt-2">
        <label className="flex flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed border-border hover:border-primary/60 p-5 cursor-pointer text-sm text-muted-foreground">
          <FileText className="h-7 w-7" />
          Haz clic para seleccionar un archivo
          <input
            type="file"
            accept={accept}
            className="hidden"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) onPick({ source: "upload", name: f.name, file: f });
              e.currentTarget.value = "";
            }}
          />
        </label>
      </TabsContent>
      <TabsContent value="dropbox" className="mt-2 space-y-2">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            setActive(q);
          }}
        >
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número de parte, PO, nombre…" />
          <Button type="submit" size="sm" variant="outline" disabled={q.trim().length < 2}>
            <Search className="h-3.5 w-3.5" />
          </Button>
        </form>
        <div className="max-h-56 overflow-y-auto rounded border border-border divide-y divide-border">
          {res.isFetching && (
            <div className="p-3 text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Buscando…
            </div>
          )}
          {res.data && res.data.connected === false && (
            <div className="p-3 text-xs text-muted-foreground">Dropbox no está conectado (Configuración).</div>
          )}
          {!res.isFetching && active && res.data?.connected && files.length === 0 && (
            <div className="p-3 text-xs text-muted-foreground">Sin resultados.</div>
          )}
          {!res.isFetching &&
            files.map((f) => {
              const path = f.path_display ?? f.path_lower ?? "";
              return (
                <button
                  key={path}
                  type="button"
                  disabled={busy}
                  onClick={() => onPick({ source: "dropbox", name: f.name, path })}
                  className="w-full text-left p-2 hover:bg-accent/40 text-xs flex items-start gap-2"
                >
                  {f.is_folder ? <Folder className="h-3.5 w-3.5 mt-0.5" /> : <FileText className="h-3.5 w-3.5 mt-0.5" />}
                  <span className="min-w-0">
                    <span className="block font-medium truncate">{f.name}</span>
                    <span className="block text-muted-foreground truncate">
                      {path.split("/").slice(-3, -1).join(" › ")}
                    </span>
                  </span>
                </button>
              );
            })}
        </div>
      </TabsContent>
    </Tabs>
  );
}

type AttachmentRow = {
  id: string;
  category: string;
  source: string;
  name: string;
  dropbox_path: string | null;
  storage_path: string | null;
  rev: string | null;
  created_at: string;
};

export const CATEGORY_LABELS: Record<string, string> = {
  plano: "Plano",
  control_calidad: "Control de calidad",
  certificado: "Certificado",
  orden_compra: "Orden de compra",
  otro: "Otro",
};

/** Saves a picked document as an attachment of an entity. */
export async function saveAttachment(
  entityType: AttachmentEntity,
  entityId: string,
  doc: PickedDocument,
  category: string,
  rev?: string | null,
) {
  const { data: u } = await supabase.auth.getUser();
  let storage_path: string | null = null;
  if (doc.source === "upload") {
    const ext = doc.name.split(".").pop() ?? "bin";
    storage_path = `${entityType}/${entityId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("attachments").upload(storage_path, doc.file, {
      contentType: doc.file.type || undefined,
    });
    if (error) throw error;
  }
  const { error } = await supabase.from("document_attachments").insert({
    entity_type: entityType,
    entity_id: entityId,
    category,
    source: doc.source,
    name: doc.name,
    dropbox_path: doc.source === "dropbox" ? doc.path : null,
    storage_path,
    rev: rev ?? null,
    created_by: u.user?.id ?? null,
  });
  if (error) throw error;
}

/** List + add attachments for a record. */
export function AttachmentsPanel({
  entityType,
  entityId,
  categories = ["plano", "control_calidad", "certificado", "otro"],
  title = "Documentos adjuntos",
  canEdit = true,
}: {
  entityType: AttachmentEntity;
  entityId: string;
  categories?: string[];
  title?: string;
  canEdit?: boolean;
}) {
  const qc = useQueryClient();
  const linkFn = useServerFn(getPlanTemporaryLink);
  const [category, setCategory] = useState(categories[0]);
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);
  const key = ["attachments", entityType, entityId];
  const list = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("document_attachments")
        .select("id, category, source, name, dropbox_path, storage_path, rev, created_at")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AttachmentRow[];
    },
  });

  const onPick = async (doc: PickedDocument) => {
    setBusy(true);
    try {
      await saveAttachment(entityType, entityId, doc, category);
      toast.success(`${doc.name} adjuntado`);
      setAdding(false);
      qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo adjuntar");
    } finally {
      setBusy(false);
    }
  };

  const open = async (a: AttachmentRow) => {
    const w = window.open("", "_blank");
    try {
      let url: string;
      if (a.storage_path) {
        const { data, error } = await supabase.storage.from("attachments").createSignedUrl(a.storage_path, 600);
        if (error) throw error;
        url = data.signedUrl;
      } else {
        url = (await linkFn({ data: { path: a.dropbox_path ?? "" } })).url;
      }
      if (w) w.location.href = url;
      else window.location.href = url;
    } catch (e) {
      w?.close();
      toast.error(e instanceof Error ? e.message : "No se pudo abrir");
    }
  };

  const remove = async (a: AttachmentRow) => {
    const { error } = await supabase.from("document_attachments").delete().eq("id", a.id);
    if (error) return toast.error(error.message);
    if (a.storage_path) await supabase.storage.from("attachments").remove([a.storage_path]);
    qc.invalidateQueries({ queryKey: key });
  };

  const rows = list.data ?? [];
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold flex items-center gap-1.5">
          <Paperclip className="h-3.5 w-3.5" /> {title} ({rows.length})
        </h4>
        {canEdit && !adding && (
          <Button type="button" size="sm" variant="outline" onClick={() => setAdding(true)}>
            Adjuntar
          </Button>
        )}
      </div>
      {adding && (
        <div className="rounded-md border border-border p-3 space-y-2 bg-muted/20">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Tipo</span>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="h-8 w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {CATEGORY_LABELS[c] ?? c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => setAdding(false)}>
              Cancelar
            </Button>
          </div>
          <DocumentPicker onPick={onPick} busy={busy} />
          {busy && <div className="text-xs text-muted-foreground">Guardando…</div>}
        </div>
      )}
      {rows.length === 0 && !adding && (
        <div className="text-xs text-muted-foreground">Sin documentos.</div>
      )}
      <ul className="space-y-1">
        {rows.map((a) => (
          <li key={a.id} className="flex items-center gap-2 rounded border border-border px-2 py-1.5 text-xs">
            <Badge variant="outline" className="shrink-0">{CATEGORY_LABELS[a.category] ?? a.category}</Badge>
            <span className="truncate flex-1" title={a.name}>{a.name}</span>
            {a.rev && <Badge variant="secondary">Rev. {a.rev}</Badge>}
            <span className="text-muted-foreground shrink-0">{a.source === "dropbox" ? "Dropbox" : "Subido"}</span>
            <Button type="button" size="icon" variant="ghost" className="h-6 w-6" aria-label={`Abrir ${a.name}`} onClick={() => open(a)}>
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
            {canEdit && (
              <Button type="button" size="icon" variant="ghost" className="h-6 w-6 text-destructive" aria-label={`Quitar ${a.name}`} onClick={() => remove(a)}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
