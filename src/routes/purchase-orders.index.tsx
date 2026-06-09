import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { AppShell } from "@/components/fact/AppShell";
import { UploadPoDialog } from "@/components/fact/UploadPoDialog";
import { PoLinesSpreadsheet } from "@/components/fact/PoLinesSpreadsheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useUserRole";
import { canCreatePo, defaultTrackForRoles } from "@/lib/rbac";
import { useI18n } from "@/lib/i18n";

const trackSchema = z.object({
  track: fallback(z.enum(["all", "coe", "third_party", "internal"]), "all").default("all"),
});

export const Route = createFileRoute("/purchase-orders/")({
  ssr: false,
  validateSearch: zodValidator(trackSchema),
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
  const { track } = Route.useSearch();
  const navigate = useNavigate({ from: "/purchase-orders/" });
  const showUpload = canCreatePo(roles);
  const { t } = useI18n();

  // First load: if URL has no explicit track and the user is a track-scoped
  // reviewer, default them to their track.
  useEffect(() => {
    if (track !== "all") return;
    const def = defaultTrackForRoles(roles);
    if (def !== "all") navigate({ search: { track: def }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles.join(",")]);

  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">{t("orders.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("orders.subtitle")}
            <span className="font-mono text-[11px] ml-2 opacity-70">
              PO # = customer order &nbsp;·&nbsp; ODF # = internal production order
            </span>
          </p>
        </div>
        {showUpload && <UploadPoDialog />}
      </div>
      <Tabs
        value={track}
        onValueChange={(v) =>
          navigate({ search: { track: v as "all" | "coe" | "third_party" | "internal" } })
        }
        className="mb-3"
      >
        <TabsList>
          <TabsTrigger value="all">{t("track.all")}</TabsTrigger>
          <TabsTrigger value="coe">{t("track.coe")}</TabsTrigger>
          <TabsTrigger value="third_party">{t("track.third_party")}</TabsTrigger>
          <TabsTrigger value="internal">{t("track.internal")}</TabsTrigger>
        </TabsList>
      </Tabs>
      <PoLinesSpreadsheet mode="intake" track={track} />
    </AppShell>
  );
}