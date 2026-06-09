import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { useEffect, useMemo } from "react";
import { Toaster } from "sonner";
import { AppShell } from "@/components/fact/AppShell";
import { PoLinesSpreadsheet } from "@/components/fact/PoLinesSpreadsheet";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useUserRole";
import { defaultTrackForRoles } from "@/lib/rbac";
import { usePoLinesSpreadsheet } from "@/hooks/usePoLinesSpreadsheet";
import { useI18n } from "@/lib/i18n";

const trackSchema = z.object({
  track: fallback(z.enum(["all", "coe", "third_party", "internal"]), "all").default("all"),
});

export const Route = createFileRoute("/pending-review")({
  ssr: false,
  validateSearch: zodValidator(trackSchema),
  head: () => ({
    meta: [
      { title: "Pending review · MEGO OTD Hub" },
      {
        name: "description",
        content: "PO lines waiting on engineering review, scoped by track.",
      },
    ],
  }),
  component: PendingReviewPage,
});

function PendingReviewPage() {
  const { roles } = useAuth();
  const { track } = Route.useSearch();
  const navigate = useNavigate({ from: "/pending-review" });
  const { data: rows = [] } = usePoLinesSpreadsheet();
  const { t } = useI18n();

  useEffect(() => {
    if (track !== "all") return;
    const def = defaultTrackForRoles(roles);
    if (def !== "all") navigate({ search: { track: def }, replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roles.join(",")]);

  const kpis = useMemo(() => {
    const pending = rows.filter(
      (r) =>
        r.line.status === "pending_engineering" ||
        r.line.status === "engineering_flagged",
    );
    const byTrack = { coe: 0, third_party: 0, internal: 0 };
    let oldestAgeDays = 0;
    const now = Date.now();
    for (const r of pending) {
      const t = r.po?.review_track;
      if (t && t in byTrack) byTrack[t as keyof typeof byTrack]++;
      const age = Math.floor((now - new Date(r.line.created_at).getTime()) / 86400000);
      if (age > oldestAgeDays) oldestAgeDays = age;
    }
    return { total: pending.length, byTrack, oldestAgeDays };
  }, [rows]);

  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">{t("pending.title")}</h2>
        <p className="text-sm text-muted-foreground">{t("pending.subtitle")}</p>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label={t("pending.total")} value={kpis.total} />
        <Kpi label={t("track.coe")} value={kpis.byTrack.coe} />
        <Kpi label={t("track.third_party")} value={kpis.byTrack.third_party} />
        <Kpi
          label={t("pending.oldest")}
          value={kpis.oldestAgeDays ? `${kpis.oldestAgeDays}d` : "—"}
        />
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

      <PoLinesSpreadsheet mode="pending" track={track} defaultPreset="pending" />
    </AppShell>
  );
}

function Kpi({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-md border border-border bg-card px-3 py-2">
      <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-xl text-foreground">{value}</div>
    </div>
  );
}