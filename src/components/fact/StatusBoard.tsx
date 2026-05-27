import type { Job } from "@/lib/fact-types";
import { STATUS_PIPELINE, STATUS_LABEL, STATUS_COLOR, type JobStatus } from "@/lib/fact-types";
import { Card } from "@/components/ui/card";
import { useUpdateJobStatus } from "@/hooks/useFactData";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";

export function StatusBoard({ jobs }: { jobs: Job[] }) {
  const update = useUpdateJobStatus();
  const [dragOver, setDragOver] = useState<JobStatus | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <Card className="border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">Pipeline de Estado</h2>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          arrastra para cambiar estado
        </span>
      </div>
      <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${STATUS_PIPELINE.length}, minmax(0,1fr))` }}>
        {STATUS_PIPELINE.map((status) => {
          const cards = jobs.filter((j) => j.status === status);
          const isOver = dragOver === status;
          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOver !== status) setDragOver(status);
              }}
              onDragLeave={(e) => {
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                setDragOver((s) => (s === status ? null : s));
              }}
              onDrop={(e) => {
                e.preventDefault();
                const id = e.dataTransfer.getData("text/plain") || dragId;
                setDragOver(null);
                setDragId(null);
                if (!id) return;
                const job = jobs.find((j) => j.id === id);
                if (!job || job.status === status) return;
                update.mutate({ id, status });
              }}
              className={`min-h-[160px] rounded border p-2 transition-colors ${
                isOver
                  ? "border-primary bg-primary/10 ring-2 ring-primary/40"
                  : "border-border bg-sidebar/30"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: STATUS_COLOR[status] }} />
                  <span className="text-[11px] font-medium">{STATUS_LABEL[status]}</span>
                </div>
                <span className="text-[10px] font-mono text-muted-foreground">{cards.length}</span>
              </div>
              <div className="space-y-1.5">
                {cards.map((j) => (
                  <div
                    key={j.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", j.id);
                      e.dataTransfer.effectAllowed = "move";
                      setDragId(j.id);
                    }}
                    onDragEnd={() => {
                      setDragId(null);
                      setDragOver(null);
                    }}
                    className={`rounded border border-border bg-card p-2 text-[11px] leading-tight cursor-grab active:cursor-grabbing select-none ${
                      dragId === j.id ? "opacity-40" : ""
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-semibold">ODF {j.odf}</span>
                      {j.priority === "urgent" && (
                        <Badge variant="destructive" className="h-4 px-1 text-[9px]">URG</Badge>
                      )}
                    </div>
                    <div className="text-muted-foreground">{j.tube_spec}</div>
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