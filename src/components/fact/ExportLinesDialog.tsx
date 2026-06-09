import { useMemo, useState } from "react";
import { Download, Mail, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useI18n } from "@/lib/i18n";
import type { SpreadsheetRow } from "@/hooks/usePoLinesSpreadsheet";
import { PO_LINE_STATUS_LABEL_EN } from "@/lib/fact-types";

interface Props {
  rows: SpreadsheetRow[];
  /** Used for filename + subject. */
  scope: string;
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCsv(rows: SpreadsheetRow[]): string {
  const headers = [
    "Customer",
    "PO #",
    "PIR",
    "Description",
    "Qty",
    "Pending",
    "Customer date",
    "Export date",
    "Shipped",
    "ODFs",
    "Status",
    "Notes",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    const odfs = r.jobs.map((j) => j.odf).join(" / ");
    lines.push(
      [
        r.customer?.name ?? "",
        r.po?.po_number ?? "",
        r.line.pir ?? "",
        r.line.tube_spec ?? "",
        r.line.qty_ordered,
        Math.max(0, r.line.qty_ordered - r.total_pieces_completed),
        r.line.committed_date ?? "",
        r.line.export_date ?? "",
        r.shipped_at?.slice(0, 10) ?? "",
        odfs,
        PO_LINE_STATUS_LABEL_EN[r.line.status] ?? r.line.status,
        r.line.notes ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
  }
  return lines.join("\r\n");
}

function buildPlainTextTable(rows: SpreadsheetRow[]): string {
  // Compact, paste-friendly summary for email body.
  const out: string[] = [];
  out.push(`PO lines export — ${rows.length} row(s)`);
  out.push("");
  for (const r of rows) {
    out.push(
      [
        r.customer?.name ?? "—",
        r.po?.po_number ?? "—",
        r.line.pir ?? "—",
        `qty ${r.line.qty_ordered}`,
        r.line.committed_date ? `due ${r.line.committed_date}` : "no date",
        PO_LINE_STATUS_LABEL_EN[r.line.status] ?? r.line.status,
      ].join(" · "),
    );
    if (r.line.tube_spec) out.push(`   ${r.line.tube_spec}`);
  }
  return out.join("\n");
}

export function ExportLinesDialog({ rows, scope }: Props) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");

  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const filename = `mego-po-lines-${scope}-${today}.csv`;
  const subject = `MEGO PO lines — ${scope} — ${today}`;

  const downloadCsv = () => {
    const csv = buildCsv(rows);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("CSV downloaded");
  };

  const openMail = () => {
    const body = buildPlainTextTable(rows);
    const url = `mailto:${encodeURIComponent(recipient)}?subject=${encodeURIComponent(
      subject,
    )}&body=${encodeURIComponent(body)}`;
    window.location.href = url;
  };

  const copyBody = async () => {
    await navigator.clipboard.writeText(buildPlainTextTable(rows));
    toast.success("Copied to clipboard");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="h-8">
          <Download className="h-3.5 w-3.5 mr-1" />
          {t("export.button")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("export.title")}</DialogTitle>
        </DialogHeader>
        <p className="text-xs text-muted-foreground">
          {rows.length} {t("export.rows")}.
        </p>
        <div className="space-y-3">
          <Button onClick={downloadCsv} className="w-full justify-start">
            <Download className="h-4 w-4 mr-2" />
            {t("export.csv")}
          </Button>
          <div className="space-y-1.5">
            <Label htmlFor="export-recipient">{t("export.recipient")}</Label>
            <Input
              id="export-recipient"
              type="email"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="peter@mego-afek.com"
            />
            <div className="flex gap-2">
              <Button
                type="button"
                onClick={openMail}
                disabled={!recipient}
                className="flex-1"
              >
                <Mail className="h-4 w-4 mr-2" />
                {t("export.open_mail")}
              </Button>
              <Button type="button" variant="outline" onClick={copyBody}>
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Opens your mail client with a pre-filled subject and the line summary
              in the body. Attach the CSV separately if needed.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}