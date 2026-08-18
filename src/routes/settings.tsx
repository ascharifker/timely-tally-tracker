import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Toaster } from "@/components/ui/sonner";
import { AppShell } from "@/components/fact/AppShell";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useUserRole";
import { isAdmin } from "@/lib/rbac";
import { ConfigPanel } from "@/components/settings/ConfigPanel";
import { UsersPanel } from "@/components/settings/UsersPanel";
import { DelegationsPanel } from "@/components/settings/DelegationsPanel";
import { DropboxPanel } from "@/components/settings/DropboxPanel";
import { Sliders, Users as UsersIcon, CalendarRange, Cloud } from "lucide-react";
import { useEffect } from "react";
import { toast } from "sonner";

type SettingsTab = "config" | "users" | "delegations" | "dropbox";
const TABS: SettingsTab[] = ["config", "users", "delegations", "dropbox"];

export const Route = createFileRoute("/settings")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Settings · MEGO OTD Hub" },
      { name: "description", content: "Production config, users and delegations in one place." },
    ],
  }),
  validateSearch: (
    s: Record<string, unknown>,
  ): { tab?: SettingsTab; dropbox_connected?: string; dropbox_error?: string } => {
    const tab = s.tab as string | undefined;
    const out: { tab?: SettingsTab; dropbox_connected?: string; dropbox_error?: string } =
      {};
    if (TABS.includes(tab as SettingsTab)) out.tab = tab as SettingsTab;
    if (typeof s.dropbox_connected === "string")
      out.dropbox_connected = s.dropbox_connected;
    if (typeof s.dropbox_error === "string") out.dropbox_error = s.dropbox_error;
    return out;
  },
  component: SettingsPage,
});

function SettingsPage() {
  const { tab, dropbox_connected, dropbox_error } = Route.useSearch();
  const navigate = useNavigate();
  const { roles, loading } = useAuth();
  const admin = isAdmin(roles);
  const active: SettingsTab = tab ?? "config";

  useEffect(() => {
    if (dropbox_connected) toast.success("Dropbox conectado correctamente");
    if (dropbox_error) toast.error(`Dropbox: ${dropbox_error}`);
  }, [dropbox_connected, dropbox_error]);

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
          {admin && (
            <TabsTrigger value="dropbox" className="gap-1.5">
              <Cloud className="h-3.5 w-3.5" /> Dropbox
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
        <TabsContent value="dropbox" className="mt-4">
          {loading ? null : admin ? <DropboxPanel /> : (
            <div className="text-sm text-muted-foreground">Forbidden — admin role required.</div>
          )}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}