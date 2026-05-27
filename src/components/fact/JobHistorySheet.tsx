import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { EventKind } from "@/lib/fact-types";
import { EVENT_KIND_LABEL, EVENT_KIND_COLOR } from "@/lib/fact-types";
import { useJobHistory } from "@/hooks/useFactData";

interface Props {
  jobId: string | null;
  odf: string | null;
  open: boolean;
  onClose: () => void;
}

export function JobHistorySheet({ jobId, odf, open, onClose }: Props) {
  const { data: events = [], isLoading } = useJobHistory(open ? jobId : null);

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="bg-card sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-mono">Historial · ODF {odf ?? ""}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-2">
          {isLoading && <p className="text-xs text-muted-foreground">Cargando…</p>}
          {!isLoading && events.length === 0 && (
            <p className="text-xs text-muted-foreground">Sin eventos registrados.</p>
          )}
          {events.map((ev) => {
            const kind = (ev.event_kind ?? "delay") as EventKind;
            const shift = ev.delay_hours ?? 0;
            return (
              <div key={ev.id} className="rounded border border-border bg-sidebar/30 p-3">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: EVENT_KIND_COLOR[kind] }}
                  />
                  <span className="text-sm font-semibold">{EVENT_KIND_LABEL[kind]}</span>
                  <span className="ml-auto text-[10px] uppercase tracking-widest text-muted-foreground font-mono">
                    {new Date(ev.created_at).toLocaleString("es", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                <div className="mt-1 text-xs font-mono">
                  {shift > 0 ? "+" : ""}{shift.toFixed(1)} h
                </div>
                {ev.reason && (
                  <p className="mt-1 text-xs text-muted-foreground">{ev.reason}</p>
                )}
              </div>
            );
          })}
        </div>
      </SheetContent>
    </Sheet>
  );
}