import type { Job } from "@/lib/fact-types";
import { STATUS_PIPELINE, STATUS_LABEL, STATUS_COLOR } from "@/lib/fact-types";
import { Card } from "@/components/ui/card";
import { useUpdateJobStatus } from "@/hooks/useFactData";
import { Badge } from "@/components/ui/badge";

export function StatusBoard({ jobs }: { jobs: Job[] }) {
  const update = useUpdateJobStatus();

  return (
    <Card className="border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Pipeline de Estado</h2>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          MAZAK → ENVIADO
        </span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${STATUS_PIPELINE.length}, minmax(0,1fr))` }}>
        {STATUS_PIPELINE.map((status) => {
          const cards = jobs.filter((j) => j.status === status);
          return (
            <div key={status} className="min-h-[160px] rounded border border-border bg-sidebar/30 p-2">
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
                  <span className="text-[11px] font-medium">{STATUS_LABEL[status]}</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">{cards.length}</span>
              </div>
              <div className="space-y-1.5">
                {cards.map((j) => (
                  <div key={j.id} className="rounded border border-border bg-card p-2 text-[11px] leading-tight">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold">ODF {j.odf}</span>
                      {j.priority === "urgent" && (
                        <Badge variant="destructive" className="h-4 px-1 text-[9px]">URG</Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground">{j.tube_spec}</div>
                    <div className="mt-1 flex gap-1 flex-wrap">
                      {STATUS_PIPELINE.filter((s) => s !== j.status).slice(0, 2).map((s) => (
                        <button
                          key={s}
                          onClick={() => update.mutate({ id: j.id, status: s })}
                          className="rounded bg-secondary px-1.5 py-0.5 text-[9px] text-secondary-foreground hover:bg-accent"
                        >
                          → {STATUS_LABEL[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}