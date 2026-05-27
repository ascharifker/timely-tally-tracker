import type { Job } from "@/lib/fact-types";
import { STATUS_PIPELINE, STATUS_LABEL, STATUS_COLOR, type JobStatus } from "@/lib/fact-types";
import { Card } from "@/components/ui/card";
import { useUpdateJobStatus } from "@/hooks/useFactData";
import { Badge } from "@/components/ui/badge";
import { useState, Fragment } from "react";
import { ChevronRight, GripVertical } from "lucide-react";

const STATUS_HELP: Record<JobStatus, string> = {
  PLANNED: "Ingresada, sin asignar a máquina",
  MAZAK: "En MAZAK — maquinado en curso",
  MAQUINADO_LISTO: "Maquinado terminado, listo para tratamiento",
  CEMENTACION: "En cementación / tratamiento térmico",
  EXPO: "En taller externo / EXPO",
  YA_SE_ENVIO: "Despachado al cliente",
};

export function StatusBoard({ jobs }: { jobs: Job[] }) {
  const update = useUpdateJobStatus();
  const [dragOver, setDragOver] = useState<JobStatus | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);

  return (
    <Card className="border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-semibold">Flujo de Producción</h2>
          <p className="text-[11px] text-muted-foreground mt-0.5">
            Arrastrá una ODF de una etapa a la siguiente para avanzarla. Total: {jobs.length} ODF{jobs.length === 1 ? "" : "s"}.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
          <GripVertical className="h-3 w-3" /> arrastrá para mover
        </div>
      </div>
      <div
        className="grid gap-0 items-stretch"
        style={{
          gridTemplateColumns: STATUS_PIPELINE.map(() => "minmax(0,1fr) auto")
            .slice(0, STATUS_PIPELINE.length * 2 - 1)
            .join(" "),
        }}
      >
        {STATUS_PIPELINE.map((status, idx) => {
          const cards = jobs.filter((j) => j.status === status);
          const isOver = dragOver === status;
          const color = STATUS_COLOR[status];
          return (
            <Fragment key={status}>
            <div
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
              className={`min-h-[180px] rounded-md border p-0 overflow-hidden flex flex-col transition-colors ${
                isOver
                  ? "border-primary bg-primary/10 ring-2 ring-primary/50"
                  : "border-border bg-sidebar/20 hover:bg-sidebar/40"
              }`}
            >
              <div
                className="px-2 py-1.5 border-b border-border/60"
                style={{ backgroundColor: `color-mix(in oklab, ${color} 18%, transparent)` }}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-background"
                      style={{ backgroundColor: color }}
                    >
                      {idx + 1}
                    </span>
                    <span className="text-[11px] font-semibold truncate">{STATUS_LABEL[status]}</span>
                  </div>
                  <span
                    className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `color-mix(in oklab, ${color} 25%, transparent)`,
                      color: "var(--foreground)",
                    }}
                  >
                    {cards.length}
                  </span>
                </div>
                <div className="text-[9px] text-muted-foreground mt-0.5 leading-tight truncate" title={STATUS_HELP[status]}>
                  {STATUS_HELP[status]}
                </div>
              </div>
              <div className="space-y-1.5 p-2 flex-1">
                {cards.length === 0 && (
                  <div className="flex h-full min-h-[80px] items-center justify-center rounded border border-dashed border-border/50 text-[10px] text-muted-foreground/60 uppercase tracking-widest font-mono">
                    vacío
                  </div>
                )}
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
                    className={`rounded border border-border bg-card p-2 text-[11px] leading-tight cursor-grab active:cursor-grabbing select-none hover:border-primary/60 hover:shadow-sm transition-all ${
                      dragId === j.id ? "opacity-40" : ""
                    }`}
                    style={{ borderLeft: `3px solid ${color}` }}
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
            {idx < STATUS_PIPELINE.length - 1 && (
              <div className="flex items-center justify-center px-0.5 text-muted-foreground/50">
                <ChevronRight className="h-4 w-4" />
              </div>
            )}
            </Fragment>
          );
        })}
      </div>
    </Card>
  );
}