import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useMachineEvents } from "@/hooks/useMachineEvents";
import { EVENT_KIND_LABEL, EVENT_KIND_COLOR, isMaintenanceEvent, type EventKind } from "@/lib/fact-types";
import { MaintenanceEventForm } from "./MaintenanceEventForm";

type Filter = "all" | "produccion" | "mantenimiento";

interface Props {
  machineId: string;
  jobIds: string[];
  isExternal: boolean;
}

export function MachineEventsTab({ machineId, jobIds, isExternal }: Props) {
  const { data: events = [], isLoading } = useMachineEvents(machineId, jobIds);
  const [filter, setFilter] = useState<Filter>("all");
  const [formOpen, setFormOpen] = useState(false);

  const filtered = useMemo(() => {
    if (filter === "all") return events;
    if (filter === "mantenimiento") return events.filter((e) => isMaintenanceEvent(e.event_kind));
    return events.filter((e) => !isMaintenanceEvent(e.event_kind));
  }, [events, filter]);

  const filters: { id: Filter; label: string; show: boolean }[] = [
    { id: "all", label: "Todos", show: true },
    { id: "produccion", label: "Producción", show: true },
    { id: "mantenimiento", label: "Mantenimiento", show: !isExternal },
  ];

  return (
    <div className="space-y-3">
      <Card className="border-border bg-card p-0 overflow-hidden">
        <div className="border-b border-border/60 bg-sidebar/40 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            {filters.filter((f) => f.show).map((f) => (
              <button
                key={f.id}
                onClick={() => setFilter(f.id)}
                className={`px-2 py-1 text-[10px] font-semibold uppercase tracking-wider rounded transition-colors ${
                  filter === f.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          {!isExternal && (
            <Button size="sm" variant="outline" className="h-7" onClick={() => setFormOpen((o) => !o)}>
              <Plus className="h-3.5 w-3.5 mr-1" />
              Mantenimiento
            </Button>
          )}
        </div>

        {formOpen && !isExternal && (
          <div className="border-b border-border/60 p-3">
            <MaintenanceEventForm machineId={machineId} onDone={() => setFormOpen(false)} />
          </div>
        )}

        {isLoading ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">Cargando…</div>
        ) : filtered.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted-foreground">
            Sin eventos {filter === "mantenimiento" ? "de mantenimiento" : filter === "produccion" ? "de producción" : ""}.
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map((e) => {
              const color = EVENT_KIND_COLOR[e.event_kind as EventKind] ?? "var(--muted)";
              const when = new Date(e.started_at ?? e.created_at).toLocaleString("es", {
                day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit",
              });
              return (
                <div key={e.id} className="px-3 py-2 text-xs flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: color }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-semibold">{EVENT_KIND_LABEL[e.event_kind as EventKind] ?? e.event_kind}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">{when}</span>
                    </div>
                    {e.reason && <div className="text-muted-foreground mt-0.5">{e.reason}</div>}
                    <div className="mt-1 flex gap-3 text-[10px] font-mono text-muted-foreground">
                      {e.delay_hours !== null && e.delay_hours > 0 && <span>+{e.delay_hours}h retraso</span>}
                      {e.cost !== null && <span>${Math.round(e.cost).toLocaleString("es-AR")}</span>}
                      {e.ended_at && e.started_at && (
                        <span>
                          duración{" "}
                          {((new Date(e.ended_at).getTime() - new Date(e.started_at).getTime()) / 3_600_000).toFixed(1)}h
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}