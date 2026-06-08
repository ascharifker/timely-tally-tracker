import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import { AppShell } from "@/components/fact/AppShell";
import { UploadPoDialog } from "@/components/fact/UploadPoDialog";
import { PoLinesSpreadsheet } from "@/components/fact/PoLinesSpreadsheet";
import { useAuth } from "@/hooks/useUserRole";
import { canCreatePo } from "@/lib/rbac";

export const Route = createFileRoute("/purchase-orders/")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Purchase Orders · MEGO OTD Hub" },
      {
        name: "description",
        content: "Customer orders. Upload a PO PDF and AI will extract the line items.",
      },
    ],
  }),
  component: PurchaseOrdersPage,
});

function PurchaseOrdersPage() {
  const { roles } = useAuth();
  const showUpload = canCreatePo(roles);
  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Purchase Orders</h2>
          <p className="text-sm text-muted-foreground">
            One row per PO line. Lines stay visible across the full lifecycle
            (engineering → production → export → shipped). Edit in-line; changes are highlighted.
            <span className="font-mono text-[11px] ml-2 opacity-70">
              PO # = customer order &nbsp;·&nbsp; ODF # = internal production order
            </span>
          </p>
        </div>
        {showUpload && <UploadPoDialog />}
      </div>
      <PoLinesSpreadsheet mode="intake" />
    </AppShell>
  );
}