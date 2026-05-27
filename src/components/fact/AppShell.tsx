import type { ReactNode } from "react";
import { Activity } from "lucide-react";

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
              <h1 className="text-base font-semibold tracking-tight">FACT</h1>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest">
                Mego Afek · Producción
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground font-mono">
            <span>MAZAK 1–4 + GEMAK · MAQYRO · TECMAC</span>
            <span className="h-2 w-2 rounded-full bg-[color:var(--status-listo)]" />
            <span>online</span>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1600px] px-6 py-6">{children}</main>
    </div>
  );
}