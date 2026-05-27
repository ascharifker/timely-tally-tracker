import { useState } from "react";
import { summarize as aiSummarize } from "@/lib/ai/brainmate";
import { summarize as otdSummarize } from "@/lib/scheduling/otd";
import type { Job, Machine } from "@/lib/fact-types";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  jobs: Job[];
  machines: Machine[];
}

export function BriefingPanel({ jobs, machines }: Props) {
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState<string | null>(null);
  const [source, setSource] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    try {
      const otd = otdSummarize(jobs);
      const byMachine = machines.map((m) => ({
        machine: m.name,
        active_jobs: jobs.filter((j) => j.machine_id === m.id).length,
        odfs: jobs.filter((j) => j.machine_id === m.id).map((j) => j.odf),
      }));
      const snapshot = {
        date: new Date().toISOString().slice(0, 10),
        otd,
        by_machine: byMachine,
        statuses: jobs.reduce<Record<string, number>>((acc, j) => {
          acc[j.status] = (acc[j.status] ?? 0) + 1;
          return acc;
        }, {}),
      };
      const res = await aiSummarize("daily_briefing", snapshot);
      setText(res.text);
      setSource(res.source);
    } catch (e) {
      toast.error("AI no disponible: " + (e instanceof Error ? e.message : "error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-primary" /> Resumen del día
          </h2>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            AI narrativa · sin cálculos · vía BrainMate
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={run} disabled={loading}>
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : "Generar"}
        </Button>
      </div>
      {text ? (
        <div className="space-y-2">
          <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{text}</p>
          {source && (
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
              fuente: {source}
            </div>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">
          Pulsa <span className="text-foreground">Generar</span> para obtener un resumen narrativo basado en los datos ya calculados del día.
        </p>
      )}
    </Card>
  );
}