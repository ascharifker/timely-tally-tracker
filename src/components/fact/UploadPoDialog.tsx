import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Upload, FileText, Plus, Trash2, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { useCustomers } from "@/hooks/useCustomers";
import {
  extractPoFromPdf,
  commitPo,
  type ExtractedPoData,
} from "@/lib/po-intake.functions";

type Stage = "idle" | "uploading" | "extracting" | "reviewing" | "committing";

interface ReviewState {
  storagePath: string;
  customerId: string | null;
  customerName: string;
  po_number: string;
  issued_date: string;
  committed_date: string;
  notes: string;
  line_items: ExtractedPoData["line_items"];
}

function makeStoragePath(filename: string) {
  const ext = filename.split(".").pop() ?? "pdf";
  return `${crypto.randomUUID()}.${ext}`;
}

export function UploadPoDialog() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [review, setReview] = useState<ReviewState | null>(null);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: customers = [] } = useCustomers();
  const extractFn = useServerFn(extractPoFromPdf);
  const commitFn = useServerFn(commitPo);

  const reset = () => {
    setStage("idle");
    setReview(null);
  };

  const handleFile = async (file: File) => {
    try {
      setStage("uploading");
      const storagePath = makeStoragePath(file.name);
      const { error: upErr } = await supabase.storage
        .from("po-documents")
        .upload(storagePath, file, { contentType: "application/pdf" });
      if (upErr) throw upErr;

      setStage("extracting");
      const extracted = await extractFn({ data: { storagePath } });

      // Pre-match customer by fuzzy name.
      const lower = extracted.customer_name.toLowerCase();
      const match = customers.find(
        (c) =>
          c.name.toLowerCase() === lower ||
          c.name.toLowerCase().includes(lower) ||
          lower.includes(c.name.toLowerCase()),
      );

      setReview({
        storagePath,
        customerId: match?.id ?? null,
        customerName: match?.name ?? extracted.customer_name,
        po_number: extracted.po_number,
        issued_date: extracted.issued_date ?? "",
        committed_date: extracted.committed_date ?? "",
        notes: "",
        line_items: extracted.line_items.length
          ? extracted.line_items
          : [emptyLine(1)],
      });
      setStage("reviewing");
    } catch (e) {
      const msg = (e as Error).message;
      if (msg.includes("429")) {
        toast.error("Rate limit", { description: "Reintentá en un momento." });
      } else if (msg.includes("402")) {
        toast.error("Sin créditos", {
          description: "Agregá créditos en Workspace → Usage.",
        });
      } else {
        toast.error("No se pudo procesar el PDF", { description: msg });
      }
      reset();
    }
  };

  const handleCommit = async () => {
    if (!review) return;
    try {
      setStage("committing");
      const result = await commitFn({
        data: {
          storagePath: review.storagePath,
          customer: {
            id: review.customerId,
            name: review.customerName.trim(),
          },
          po_number: review.po_number.trim(),
          issued_date: review.issued_date || null,
          committed_date: review.committed_date || null,
          notes: review.notes.trim() || null,
          line_items: review.line_items.map((li) => ({
            ...li,
            pir: li.pir?.trim() || null,
            tube_spec: li.tube_spec?.trim() || null,
            currency: li.currency?.trim() || null,
            committed_date: li.committed_date || null,
          })),
        },
      });
      qc.invalidateQueries({ queryKey: ["purchase_orders"] });
      qc.invalidateQueries({ queryKey: ["customers"] });
      toast.success("Purchase Order creado");
      setOpen(false);
      reset();
      navigate({ to: "/purchase-orders/$id", params: { id: result.id } });
    } catch (e) {
      toast.error("No se pudo crear el PO", { description: (e as Error).message });
      setStage("reviewing");
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) reset();
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <Upload className="mr-2 h-4 w-4" /> Cargar PO
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Cargar Purchase Order</DialogTitle>
          <DialogDescription>
            Subí el PDF del PO del cliente. Lo procesamos con AI y te dejamos
            revisar antes de guardarlo.
          </DialogDescription>
        </DialogHeader>

        {stage === "idle" && (
          <FileDropZone onFile={handleFile} />
        )}

        {(stage === "uploading" || stage === "extracting") && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">
              {stage === "uploading"
                ? "Subiendo PDF…"
                : "Extrayendo datos con AI…"}
            </p>
          </div>
        )}

        {stage === "reviewing" && review && (
          <ReviewForm
            value={review}
            onChange={setReview}
            customers={customers.map((c) => ({ id: c.id, name: c.name }))}
            onCommit={handleCommit}
            onCancel={reset}
          />
        )}

        {stage === "committing" && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin" />
            <p className="text-sm">Guardando…</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function FileDropZone({ onFile }: { onFile: (file: File) => void }) {
  const [dragOver, setDragOver] = useState(false);
  return (
    <label
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        const f = e.dataTransfer.files?.[0];
        if (f && f.type === "application/pdf") onFile(f);
        else toast.error("Solo aceptamos PDF");
      }}
      className={`flex flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed py-16 cursor-pointer transition-colors ${
        dragOver
          ? "border-primary bg-primary/5"
          : "border-border hover:border-primary/60"
      }`}
    >
      <FileText className="h-10 w-10 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">
        Arrastrá un PDF aquí o hacé click para seleccionar
      </p>
      <input
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
    </label>
  );
}

function emptyLine(n: number): ExtractedPoData["line_items"][number] {
  return {
    line_number: n,
    pir: "",
    tube_spec: "",
    qty_ordered: 1,
    committed_date: null,
    unit_price: null,
    currency: null,
  };
}

interface ReviewFormProps {
  value: ReviewState;
  onChange: (v: ReviewState) => void;
  customers: { id: string; name: string }[];
  onCommit: () => void;
  onCancel: () => void;
}

function ReviewForm({ value, onChange, customers, onCommit, onCancel }: ReviewFormProps) {
  const set = <K extends keyof ReviewState>(k: K, v: ReviewState[K]) =>
    onChange({ ...value, [k]: v });

  const updateLine = (idx: number, patch: Partial<ExtractedPoData["line_items"][number]>) => {
    const next = value.line_items.map((li, i) =>
      i === idx ? { ...li, ...patch } : li,
    );
    onChange({ ...value, line_items: next });
  };
  const addLine = () =>
    onChange({
      ...value,
      line_items: [...value.line_items, emptyLine(value.line_items.length + 1)],
    });
  const removeLine = (idx: number) =>
    onChange({
      ...value,
      line_items: value.line_items
        .filter((_, i) => i !== idx)
        .map((li, i) => ({ ...li, line_number: i + 1 })),
    });

  const canCommit =
    value.customerName.trim().length > 0 &&
    value.po_number.trim().length > 0 &&
    value.line_items.length > 0;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>Cliente</Label>
          <Select
            value={value.customerId ?? "__new__"}
            onValueChange={(v) => {
              if (v === "__new__") {
                set("customerId", null);
              } else {
                const c = customers.find((x) => x.id === v);
                onChange({
                  ...value,
                  customerId: v,
                  customerName: c?.name ?? value.customerName,
                });
              }
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {customers.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
              <SelectItem value="__new__">+ Crear nuevo cliente…</SelectItem>
            </SelectContent>
          </Select>
          {value.customerId === null && (
            <Input
              placeholder="Nombre del nuevo cliente"
              value={value.customerName}
              onChange={(e) => set("customerName", e.target.value)}
            />
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Número de PO</Label>
          <Input
            value={value.po_number}
            onChange={(e) => set("po_number", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Fecha de emisión</Label>
          <Input
            type="date"
            value={value.issued_date}
            onChange={(e) => set("issued_date", e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <Label>Fecha comprometida (PO)</Label>
          <Input
            type="date"
            value={value.committed_date}
            onChange={(e) => set("committed_date", e.target.value)}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label>Notas</Label>
        <Textarea
          rows={2}
          value={value.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <Label>Líneas ({value.line_items.length})</Label>
          <Button size="sm" variant="outline" onClick={addLine}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Agregar línea
          </Button>
        </div>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>PIR</TableHead>
                <TableHead>Spec / Descripción</TableHead>
                <TableHead className="w-24">Cantidad</TableHead>
                <TableHead className="w-40">F. Comprometida</TableHead>
                <TableHead className="w-28">Precio</TableHead>
                <TableHead className="w-20">Moneda</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {value.line_items.map((li, idx) => (
                <TableRow key={idx}>
                  <TableCell className="font-mono text-xs">{li.line_number}</TableCell>
                  <TableCell>
                    <Input
                      value={li.pir ?? ""}
                      onChange={(e) => updateLine(idx, { pir: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={li.tube_spec ?? ""}
                      onChange={(e) => updateLine(idx, { tube_spec: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      min={1}
                      value={li.qty_ordered}
                      onChange={(e) =>
                        updateLine(idx, {
                          qty_ordered: Math.max(1, Number(e.target.value) || 1),
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="date"
                      value={li.committed_date ?? ""}
                      onChange={(e) =>
                        updateLine(idx, { committed_date: e.target.value || null })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={li.unit_price ?? ""}
                      onChange={(e) =>
                        updateLine(idx, {
                          unit_price: e.target.value === "" ? null : Number(e.target.value),
                        })
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <Input
                      value={li.currency ?? ""}
                      onChange={(e) => updateLine(idx, { currency: e.target.value })}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeLine(idx)}
                      disabled={value.line_items.length === 1}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button onClick={onCommit} disabled={!canCommit}>
          Confirmar y crear PO
        </Button>
      </div>
    </div>
  );
}