import { useEffect, type ReactNode } from "react";
import { Activity, Settings, Inbox, Wrench, Factory, LogOut, ClipboardList } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useUserRole";
import { primaryRoleLabel, isAdmin, hasRole } from "@/lib/rbac";

export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { userId, email, roles, loading } = useAuth();

  useEffect(() => {
    if (!loading && !userId) {
      navigate({ to: "/auth", replace: true });
    }
  }, [loading, userId, navigate]);

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

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-sidebar/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">MEGO OTD Hub</h1>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
            <Link
              to="/purchase-orders"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border hover:border-primary/60 hover:text-foreground transition-colors"
              activeProps={{ className: "border-primary text-primary" }}
            >
              <Inbox className="h-3.5 w-3.5" />
              <span className="uppercase tracking-widest">Orders</span>
            </Link>
            {showPendingReview && (
              <Link
                to="/pending-review"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border hover:border-primary/60 hover:text-foreground transition-colors"
                activeProps={{ className: "border-primary text-primary" }}
              >
                <ClipboardList className="h-3.5 w-3.5" />
                <span className="uppercase tracking-widest">Pending</span>
              </Link>
            )}
            <Link
              to="/engineering"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border hover:border-primary/60 hover:text-foreground transition-colors"
              activeProps={{ className: "border-primary text-primary" }}
            >
              <Wrench className="h-3.5 w-3.5" />
              <span className="uppercase tracking-widest">Engineering</span>
            </Link>
            <Link
              to="/production"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border hover:border-primary/60 hover:text-foreground transition-colors"
              activeProps={{ className: "border-primary text-primary" }}
            >
              <Factory className="h-3.5 w-3.5" />
              <span className="uppercase tracking-widest">Producción</span>
            </Link>
            <Link
              to="/"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border hover:border-primary/60 hover:text-foreground transition-colors"
              activeProps={{ className: "border-primary text-primary" }}
              activeOptions={{ exact: true }}
            >
              <span className="uppercase tracking-widest">Calendario</span>
            </Link>
            <Link
              to="/configuracion"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border hover:border-primary/60 hover:text-foreground transition-colors"
              activeProps={{ className: "border-primary text-primary" }}
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="uppercase tracking-widest">Config</span>
            </Link>
            {showAdmin && (
              <Link
                to="/admin/users"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border hover:border-primary/60 hover:text-foreground transition-colors"
                activeProps={{ className: "border-primary text-primary" }}
              >
                <span className="uppercase tracking-widest">Users</span>
              </Link>
            )}
            <div className="flex items-center gap-2 pl-4 ml-2 border-l border-border">
              <div className="flex flex-col items-end leading-tight">
                <span className="text-[11px] text-foreground truncate max-w-[160px]" title={email ?? undefined}>{email}</span>
                <span className="text-[10px] uppercase tracking-widest text-primary">{roleLabel}</span>
              </div>
              <button
                type="button"
                onClick={handleSignOut}
                title="Sign out"
                className="inline-flex items-center gap-1 px-2 py-1 rounded border border-border hover:border-primary/60 hover:text-foreground transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-6 py-6">{children}</main>
    </div>
  );
}