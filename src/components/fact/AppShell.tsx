import type { ReactNode } from "react";
import { Activity, Settings, Inbox, Wrench, Factory } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border bg-sidebar/80 backdrop-blur sticky top-0 z-30">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded bg-primary/10 text-primary">
              <Activity className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold tracking-tight">MEGO Produccion</h1>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
            <Link
              to="/purchase-orders"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border hover:border-primary/60 hover:text-foreground transition-colors"
              activeProps={{ className: "border-primary text-primary" }}
            >
              <Inbox className="h-3.5 w-3.5" />
              <span className="uppercase tracking-widest">Purchase Orders</span>
            </Link>
            <Link
              to="/engineering"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded border border-border hover:border-primary/60 hover:text-foreground transition-colors"
              activeProps={{ className: "border-primary text-primary" }}
            >
              <Wrench className="h-3.5 w-3.5" />
              <span className="uppercase tracking-widest">Ingeniería</span>
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
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-6 py-6">{children}</main>
    </div>
  );
}