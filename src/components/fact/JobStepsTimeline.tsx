import type { JobStep } from "@/hooks/useActiveJobs";
import { Check, Circle, Loader2 } from "lucide-react";

const LABELS: Record<string, string> = {
  MAZAK: "Mazak",
  MAQUINADO_LISTO: "Maq. listo",
  CEMENTACION: "Cementación",
  CEMENTACION_LISTO: "Cem. listo",
  EXPO: "Expo",
  YA_SE_ENVIO: "Enviado",
};

export function JobStepsTimeline({ steps }: { steps: JobStep[] }) {
  const current = steps.find((s) => !s.completed_at);
  return (
    <div className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-wider">
      {steps.map((s, i) => {
        const done = !!s.completed_at;
        const active = s.id === current?.id;
        const color = done
          ? "var(--status-listo)"
          : active
            ? "var(--status-mazak)"
            : "var(--muted-foreground)";
        return (
          <div key={s.id} className="flex items-center gap-1">
            <span className="flex items-center gap-1" style={{ color }}>
              {done ? (
                <Check className="h-3 w-3" />
              ) : active ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Circle className="h-3 w-3" />
              )}
              <span className={active ? "font-bold" : ""}>{LABELS[s.step_name] ?? s.step_name}</span>
            </span>
            {i < steps.length - 1 && <span className="text-muted-foreground/40">→</span>}
          </div>
        );
      })}
    </div>
  );
}