import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Toaster, toast } from "sonner";
import { useState } from "react";
import { AppShell } from "@/components/fact/AppShell";
import { usePoLinesByStatus } from "@/hooks/usePoQueues";
import {
  advanceEngStep,
  setEngStep,
  flagPoLine,
} from "@/lib/po-workflow.functions";
import {
  ENGINEERING_STEPS,
  getStep,
  stepIndex,
} from "@/lib/engineering-steps";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowRight, ChevronDown, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { EngStepDrawer } from "@/components/fact/EngStepDrawer";
import type { PoLineWithContext } from "@/hooks/usePoQueues";

export const Route = createFileRoute("/engineering")({
  ssr: false,
  head: () => ({ meta: [{ title: "Engineering · MEGO Produccion" }] }),
  component: EngineeringPage,
});

function formatElapsed(startedAt: string | null | undefined): string {
  if (!startedAt) return "—";
  const ms = Date.now() - new Date(startedAt).getTime();
  if (Number.isNaN(ms) || ms < 0) return "—";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ${mins % 60}m`;
  const days = Math.floor(hrs / 24);
  return `${days}d ${hrs % 24}h`;
}

function StepDots({ currentKey }: { currentKey: string | null }) {
  const idx = stepIndex(currentKey);
  return (
    <div className="flex items-center gap-1">
      {ENGINEERING_STEPS.map((s, i) => {
        const done = idx > i;
        const active = idx === i;
        return (
          <div key={s.key} className="flex items-center gap-1">
            <div
              title={s.label}
              className={cn(
                "h-2 w-2 rounded-full transition-colors",
                done && "bg-emerald-500",
                active && "bg-primary ring-2 ring-primary/30",
                !done && !active && "bg-muted",
              )}
            />
            {i < ENGINEERING_STEPS.length - 1 && (
              <div
                className={cn(
                  "h-px w-4",
                  done ? "bg-emerald-500/50" : "bg-muted",
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function EngineeringPage() {
  const { data: lines = [], isLoading } = usePoLinesByStatus([
    "pending_engineering",
    "engineering_flagged",
  ]);
  const advanceFn = useServerFn(advanceEngStep);
  const jumpFn = useServerFn(setEngStep);
  const flagFn = useServerFn(flagPoLine);
  const qc = useQueryClient();

  const [busy, setBusy] = useState<string | null>(null);
  const [flagOpen, setFlagOpen] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState("");
  const [drawerLine, setDrawerLine] = useState<PoLineWithContext | null>(null);

  const refresh = () =>
    qc.invalidateQueries({ queryKey: ["po_lines_by_status"] });

  const advance = async (id: string) => {
    setBusy(id);
    try {
      const res = await advanceFn({ data: { id } });
      toast.success(
        res.completed ? "Ready for production" : "Step completed",
      );
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  };

  const jump = async (id: string, step: string) => {
    setBusy(id);
    try {
      await jumpFn({ data: { id, step } });
      toast.success("Step set");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  };

  const flag = async () => {
    if (!flagOpen) return;
    if (!flagReason.trim()) {
      toast.error("Reason required");
      return;
    }
    setBusy(flagOpen);
    try {
      await flagFn({
        data: { id: flagOpen, reason: flagReason.trim() },
      });
      toast.success("Flagged — back to intake");
      setFlagOpen(null);
      setFlagReason("");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(null);
    }
  };

  return (
    <AppShell>
      <Toaster theme="dark" position="top-right" />
      <div className="mb-4">
        <h2 className="text-2xl font-semibold tracking-tight">Engineering</h2>
        <p className="text-sm text-muted-foreground">
          4-step verification funnel: PO Info → PIR → Components → Matrix.
        </p>
      </div>

      <div className="rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Customer / PO</TableHead>
              <TableHead>Line</TableHead>
              <TableHead>PIR</TableHead>
              <TableHead>Spec</TableHead>
              <TableHead className="text-right">Qty</TableHead>
              <TableHead>Committed</TableHead>
              <TableHead className="min-w-[180px]">Step</TableHead>
              <TableHead>Time in step</TableHead>
              <TableHead className="w-64" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Loading…
                </TableCell>
              </TableRow>
            )}
            {!isLoading && lines.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  Queue empty.
                </TableCell>
              </TableRow>
            )}
            {lines.map((l) => {
              const currentStep = l.eng_step ?? ENGINEERING_STEPS[0].key;
              const step = getStep(currentStep);
              const isFlagged = l.status === "engineering_flagged";
              return (
              <TableRow key={l.id}>
                <TableCell className="text-sm">
                  {l.purchase_order?.customer?.name ?? "—"}
                  <div className="font-mono text-xs text-muted-foreground">
                    {l.purchase_order?.po_number}
                  </div>
                </TableCell>
                <TableCell className="font-mono text-xs">L{l.line_number}</TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {l.pir ?? "—"}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {l.tube_spec ?? "—"}
                </TableCell>
                <TableCell className="text-right font-mono">{l.qty_ordered}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {l.committed_date ?? "—"}
                </TableCell>
                <TableCell>
                  <div className="flex flex-col gap-1">
                    <StepDots currentKey={currentStep} />
                    <div className="text-xs text-muted-foreground">
                      {step?.label ?? "—"}
                    </div>
                  </div>
                  {isFlagged && (
                    <Badge variant="outline" className="mt-1 border-red-500/50 text-red-300">
                      Flagged
                    </Badge>
                  )}
                  {l.flag_reason && (
                    <div className="text-[11px] text-red-300/80 mt-1 max-w-[220px]">
                      {l.flag_reason}
                    </div>
                  )}
                </TableCell>
                <TableCell className="text-xs text-muted-foreground font-mono">
                  {formatElapsed(l.eng_step_started_at)}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setDrawerLine(l)}
                    >
                      Open
                    </Button>
                    <Button
                      size="sm"
                      variant="default"
                      disabled={busy === l.id}
                      onClick={() => advance(l.id)}
                    >
                      Complete step <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="ghost" disabled={busy === l.id}>
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {ENGINEERING_STEPS.map((s) => (
                          <DropdownMenuItem
                            key={s.key}
                            onClick={() => jump(l.id, s.key)}
                          >
                            Jump to {s.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={busy === l.id}
                      onClick={() => {
                        setFlagOpen(l.id);
                        setFlagReason(l.flag_reason ?? "");
                      }}
                    >
                      <Flag className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <Dialog open={!!flagOpen} onOpenChange={(o) => !o && setFlagOpen(null)}>
        <DialogContent className="bg-card">
          <DialogHeader>
            <DialogTitle>Flag line</DialogTitle>
          </DialogHeader>
          <Textarea
            rows={4}
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            placeholder="e.g. PIR 102882625 rev C outdated, confirm rev D with customer."
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFlagOpen(null)}>
              Cancel
            </Button>
            <Button onClick={flag} disabled={!!busy}>
              Flag
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EngStepDrawer
        line={drawerLine}
        open={!!drawerLine}
        onOpenChange={(o) => !o && setDrawerLine(null)}
      />
    </AppShell>
  );
}