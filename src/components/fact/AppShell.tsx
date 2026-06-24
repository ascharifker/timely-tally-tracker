import { useEffect, useState, type ReactNode } from "react";
import {
  Activity,
  Settings,
  Inbox,
  Wrench,
  Factory,
  LogOut,
  ClipboardList,
  CalendarDays,
  Languages,
  Menu,
  ChevronLeft,
  ChevronRight,
  Upload,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useUserRole";
import { primaryRoleLabel, isAdmin, hasRole } from "@/lib/rbac";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const STORAGE_KEY = "mego.sidebar.collapsed";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { userId, email, roles, loading } = useAuth();
  const { lang, setLang, t } = useI18n();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setCollapsed(window.localStorage.getItem(STORAGE_KEY) === "1");
    }
  }, []);

  useEffect(() => {
    if (!loading && !userId) navigate({ to: "/auth", replace: true });
  }, [loading, userId, navigate]);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      }
      return next;
    });
  };

  const handleSignOut = async () => {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  };

  if (loading || !userId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-muted-foreground text-sm">
        Loading…
      </div>
    );
  }

  const roleLabel = primaryRoleLabel(roles);
  const showAdmin = isAdmin(roles);
  const showPendingReview =
    isAdmin(roles) ||
    hasRole(roles, "po_editor") ||
    hasRole(roles, "coe_reviewer") ||
    hasRole(roles, "third_party_reviewer");

  const navItems: Array<{ to: string; label: string; icon: typeof Inbox; exact?: boolean; show: boolean }> = [
    { to: "/", label: t("nav.calendar"), icon: CalendarDays, exact: true, show: true },
    { to: "/purchase-orders", label: t("nav.orders"), icon: Inbox, show: true },
    { to: "/pending-review", label: t("nav.pending"), icon: ClipboardList, show: showPendingReview },
    { to: "/engineering", label: t("nav.engineering"), icon: Wrench, show: true },
    { to: "/production", label: t("nav.production"), icon: Factory, show: true },
    { to: "/admin/import-maquinados", label: "Importar MAQ.", icon: Upload, show: showAdmin },
    { to: "/settings", label: showAdmin ? t("nav.settings") : t("nav.config"), icon: Settings, show: true },
  ];

  const sidebarWidth = collapsed ? "w-16" : "w-56";

  const SidebarBody = ({ onNavigate }: { onNavigate?: () => void }) => (
    <div className="flex h-full flex-col bg-sidebar text-sidebar-foreground">
      <div className={cn("flex items-center gap-2 border-b border-border px-3 py-3", collapsed && "justify-center px-2")}>
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-primary/10 text-primary">
          <Activity className="h-5 w-5" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold tracking-tight">MEGO OTD Hub</h1>
            <p className="truncate text-[10px] uppercase tracking-widest text-muted-foreground">Producción</p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-3">
        <ul className="space-y-1">
          {navItems.filter((i) => i.show).map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.to}>
                <Link
                  to={item.to}
                  onClick={onNavigate}
                  activeProps={{ className: "bg-primary/10 text-primary border-primary/40" }}
                  activeOptions={item.exact ? { exact: true } : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded border border-transparent px-2.5 py-2 text-xs font-medium uppercase tracking-widest text-muted-foreground transition-colors hover:border-border hover:bg-muted/40 hover:text-foreground",
                    collapsed && "justify-center px-0",
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span className="truncate">{item.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-2 py-3 space-y-2">
        <button
          type="button"
          onClick={() => setLang(lang === "en" ? "es" : "en")}
          title={lang === "en" ? "Cambiar a español" : "Switch to English"}
          className={cn(
            "flex w-full items-center gap-2 rounded border border-border px-2.5 py-1.5 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-primary/60",
            collapsed && "justify-center px-0",
          )}
        >
          <Languages className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span>{lang === "en" ? "English" : "Español"}</span>}
        </button>

        {!collapsed && (
          <div className="rounded border border-border bg-muted/20 px-2.5 py-2">
            <p className="truncate text-[11px] text-foreground" title={email ?? undefined}>{email}</p>
            <p className="text-[10px] uppercase tracking-widest text-primary">{roleLabel}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handleSignOut}
          className={cn(
            "flex w-full items-center gap-2 rounded border border-border px-2.5 py-1.5 text-[11px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-primary/60",
            collapsed && "justify-center px-0",
          )}
          title={t("nav.signout")}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span>{t("nav.signout")}</span>}
        </button>

        <button
          type="button"
          onClick={toggleCollapsed}
          className="hidden md:flex w-full items-center justify-center gap-1 rounded border border-border/60 px-2 py-1 text-[10px] uppercase tracking-widest text-muted-foreground hover:text-foreground hover:border-primary/60"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <><ChevronLeft className="h-3 w-3" /><span>Collapse</span></>}
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden md:flex sticky top-0 h-screen shrink-0 border-r border-border transition-[width] duration-200",
          sidebarWidth,
        )}
      >
        <SidebarBody />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setMobileOpen(false)}>
          <div className="absolute inset-0 bg-background/70 backdrop-blur-sm" />
          <aside className="absolute left-0 top-0 h-full w-60 border-r border-border" onClick={(e) => e.stopPropagation()}>
            <SidebarBody onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="md:hidden sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-sidebar/80 backdrop-blur px-4 py-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="inline-flex items-center justify-center rounded border border-border p-1.5 text-muted-foreground hover:text-foreground"
            aria-label="Open menu"
          >
            <Menu className="h-4 w-4" />
          </button>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold tracking-tight">MEGO OTD Hub</span>
          </div>
        </header>
        <main className="flex-1 px-6 py-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
