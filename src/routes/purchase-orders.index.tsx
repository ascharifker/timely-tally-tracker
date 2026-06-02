import { createFileRoute, Link } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/fact/AppShell";
import { UploadPoDialog } from "@/components/fact/UploadPoDialog";
import { PoLinesSpreadsheet } from "@/components/fact/PoLinesSpreadsheet";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/purchase-orders/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Purchase Orders · FACT" },
      {
        name: "description",
        content: "Pedidos del cliente. Cargá un PDF y dejá que la AI extraiga las líneas.",
      },
    ],
  }),
  component: PurchaseOrdersPage,
});

function PurchaseOrdersPage() {
  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link
            to="/"
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-3 w-3" /> Volver
          </Link>
          <h2 className="text-2xl font-semibold tracking-tight mt-1">Purchase Orders</h2>
          <p className="text-sm text-muted-foreground">
            Todas las líneas de PO, vista tipo planilla. Editá in-line; los cambios quedan resaltados.
          </p>
        </div>
        <UploadPoDialog />
      </div>
      <PoLinesSpreadsheet mode="browse" />
    </AppShell>
  );
}