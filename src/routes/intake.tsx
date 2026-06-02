import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AppShell } from "@/components/fact/AppShell";
import { UploadPoDialog } from "@/components/fact/UploadPoDialog";
import { PoLinesSpreadsheet } from "@/components/fact/PoLinesSpreadsheet";

export const Route = createFileRoute("/intake")({
  ssr: false,
  head: () => ({ meta: [{ title: "Intake · FACT" }] }),
  component: IntakePage,
});

function IntakePage() {
  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Intake · Peter</h2>
          <p className="text-sm text-muted-foreground">
            Una fila por línea de PO, como tu planilla. Editá in-line, los cambios quedan resaltados.
          </p>
        </div>
        <UploadPoDialog />
      </div>
      <PoLinesSpreadsheet mode="intake" />
    </AppShell>
  );
}