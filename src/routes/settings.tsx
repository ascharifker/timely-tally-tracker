import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/fact/AppShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useUserRole";
import { isAdmin } from "@/lib/rbac";
import { ConfigPanel } from "@/components/settings/ConfigPanel";
import { UsersPanel } from "@/components/settings/UsersPanel";
import { DelegationsPanel } from "@/components/settings/DelegationsPanel";
import { Sliders, Users as UsersIcon, CalendarRange } from "lucide-react";

type SettingsTab = "config" | "users" | "delegations";
const TABS: SettingsTab[] = ["config", "users", "delegations"];

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings · MEGO OTD Hub" },
      { name: "description", content: "Production config, users and delegations in one place." },
    ],
  }),
  validateSearch: (s: Record<string, unknown>): { tab?: SettingsTab } => {
    const tab = s.tab as string | undefined;
    return TABS.includes(tab as SettingsTab) ? { tab: tab as SettingsTab } : {};
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate();
  const { roles, loading } = useAuth();
  const admin = isAdmin(roles);
  const active: SettingsTab = tab ?? "config";

  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4">
        <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
        <p className="text-xs text-muted-foreground">
          Production config, users and vacation delegations.
        </p>
      </div>

      <Tabs
        value={active}
        onValueChange={(v) =>
          navigate({ to: "/settings", search: { tab: v as SettingsTab }, replace: true })
        }
      >
        <TabsList>
          <TabsTrigger value="config" className="gap-1.5">
            <Sliders className="h-3.5 w-3.5" /> Configuración
          </TabsTrigger>
          {admin && (
            <TabsTrigger value="users" className="gap-1.5">
              <UsersIcon className="h-3.5 w-3.5" /> Users
            </TabsTrigger>
          )}
          {admin && (
            <TabsTrigger value="delegations" className="gap-1.5">
              <CalendarRange className="h-3.5 w-3.5" /> Delegations
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="config" className="mt-4">
          <ConfigPanel />
        </TabsContent>
        <TabsContent value="users" className="mt-4">
          {loading ? null : admin ? <UsersPanel /> : (
            <div className="text-sm text-muted-foreground">Forbidden — admin role required.</div>
          )}
        </TabsContent>
        <TabsContent value="delegations" className="mt-4">
          {loading ? null : admin ? <DelegationsPanel /> : (
            <div className="text-sm text-muted-foreground">Forbidden — admin role required.</div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}