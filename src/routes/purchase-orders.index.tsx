import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AppShell } from "@/components/fact/AppShell";
import { UploadPoDialog } from "@/components/fact/UploadPoDialog";
import { PoLinesSpreadsheet } from "@/components/fact/PoLinesSpreadsheet";

export const Route = createFileRoute("/purchase-orders/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Purchase Orders · MEGO Produccion" },
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
          <h2 className="text-2xl font-semibold tracking-tight">Purchase Orders</h2>
          <p className="text-sm text-muted-foreground">
            Una fila por línea de PO. Las líneas no desaparecen al avanzar — ves todo el ciclo
            (ingeniería → producción → export → enviado). Editá in-line, los cambios quedan resaltados.
          </p>
        </div>
        <UploadPoDialog />
      </div>
      <PoLinesSpreadsheet mode="intake" />
    </AppShell>
  );
}