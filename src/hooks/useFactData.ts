import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Machine, Job, JobStatus, PartTime } from "@/lib/fact-types";
import { cascade, type CascadeChange } from "@/lib/scheduling/cascade";
import type { EventKind } from "@/lib/fact-types";
import { toast } from "sonner";
import { STATUS_LABEL } from "@/lib/fact-types";
import { nextShiftBoundary } from "@/lib/shifts";
import { jobDurationHours } from "@/lib/scheduling/duration";
import { scheduleJob } from "@/lib/scheduling/schedule";

export function useMachines() {
  return useQuery({
    queryKey: ["machines"],
    queryFn: async (): Promise<Machine[]> => {
      const { data, error } = await supabase
        .from("machines")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as Machine[];
    },
  });
}

export function useJobs() {
  return useQuery({
    queryKey: ["jobs"],
    queryFn: async (): Promise<Job[]> => {
      const { data, error } = await supabase
        .from("jobs")
        .select("*")
        .order("planned_start", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return (data ?? []) as Job[];
    },
  });
}

export function usePartTimes() {
  return useQuery({
    queryKey: ["part_times"],
    queryFn: async (): Promise<PartTime[]> => {
      const { data, error } = await supabase
        .from("part_times")
        .select("*")
        .order("pir", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PartTime[];
    },
  });
}

export function useUpdateMachineHoursPerShift() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, hours_per_shift }: { id: string; hours_per_shift: number }) => {
      const { error } = await supabase
        .from("machines")
        .update({ hours_per_shift } as never)
        .eq("id", id);
      if (error) throw error;
      return { id, hours_per_shift };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Horas por turno actualizadas");
    },
    onError: (err) => toast.error("No se pudo actualizar", { description: (err as Error).message }),
  });
}

export function useUpdateMachineActiveShifts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, active_shifts }: { id: string; active_shifts: string[] }) => {
      const { error } = await supabase
        .from("machines")
        .update({ active_shifts } as never)
        .eq("id", id);
      if (error) throw error;
      return { id, active_shifts };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["machines"] });
      toast.success("Turnos activos actualizados");
    },
    onError: (err) => toast.error("No se pudo actualizar", { description: (err as Error).message }),
  });
}

export function useUpsertPartTime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id?: string; pir: string; machine_id: string; hours_per_piece: number }) => {
      if (input.id) {
        const { error } = await supabase
          .from("part_times")
          .update({ pir: input.pir, machine_id: input.machine_id, hours_per_piece: input.hours_per_piece } as never)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("part_times")
          .insert({ pir: input.pir, machine_id: input.machine_id, hours_per_piece: input.hours_per_piece } as never);
        if (error) throw error;
      }
      return input;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["part_times"] });
      toast.success("Tiempo de pieza guardado");
    },
    onError: (err) => toast.error("No se pudo guardar", { description: (err as Error).message }),
  });
}

export function useDeletePartTime() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("part_times").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["part_times"] });
      toast.success("Entrada eliminada");
    },
  });
}

export function useCreateJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<Job>) => {
      const { data, error } = await supabase.from("jobs").insert(input as never).select().single();
      if (error) throw error;
      return data as Job;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export function useUpdateJobStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; status: JobStatus }) => {
      const all = qc.getQueryData<Job[]>(["jobs"]) ?? [];
      const job = all.find((j) => j.id === input.id);
      const machines = qc.getQueryData<Machine[]>(["machines"]) ?? [];
      const partTimes = qc.getQueryData<PartTime[]>(["part_times"]) ?? [];
      const patch: { status: JobStatus; planned_start?: string; planned_end?: string } = {
        status: input.status,
      };
      if (input.status === "MAZAK" && job && (!job.planned_start || !job.planned_end)) {
        const machine = machines.find((m) => m.id === job.machine_id);
        const { hours } = jobDurationHours(job, partTimes);
        const span = scheduleJob(Date.now(), hours, machine ?? { hours_per_shift: 8 });
        patch.planned_start = span.planned_start;
        patch.planned_end = span.planned_end;
      }
      const { error } = await supabase.from("jobs").update(patch).eq("id", input.id);
      if (error) throw error;
      return patch;
    },
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ["jobs"] });
      const previous = qc.getQueryData<Job[]>(["jobs"]) ?? [];
      const job = previous.find((j) => j.id === id);
      const machines = qc.getQueryData<Machine[]>(["machines"]) ?? [];
      const partTimes = qc.getQueryData<PartTime[]>(["part_times"]) ?? [];
      let planned_start = job?.planned_start ?? null;
      let planned_end = job?.planned_end ?? null;
      if (status === "MAZAK" && job && (!planned_start || !planned_end)) {
        const machine = machines.find((m) => m.id === job.machine_id);
        const { hours } = jobDurationHours(job, partTimes);
        const span = scheduleJob(Date.now(), hours, machine ?? { hours_per_shift: 8 });
        planned_start = span.planned_start;
        planned_end = span.planned_end;
      }
      qc.setQueryData<Job[]>(
        ["jobs"],
        previous.map((j) => (j.id === id ? { ...j, status, planned_start, planned_end } : j)),
      );
      return { previous, job };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["jobs"], ctx.previous);
      toast.error("No se pudo cambiar el estado", { description: (err as Error).message });
    },
    onSuccess: (data, vars, ctx) => {
      const odf = ctx?.job?.odf ?? "ODF";
      let extra = "";
      if (data?.planned_start && data?.planned_end) {
        const s = new Date(data.planned_start).toLocaleDateString("es", { day: "2-digit", month: "2-digit" });
        const e = new Date(data.planned_end).toLocaleDateString("es", { day: "2-digit", month: "2-digit" });
        extra = ` · programado ${s} → ${e}`;
      }
      toast.success(`ODF ${odf} → ${STATUS_LABEL[vars.status]}${extra}`);
      if (vars.status === "MAZAK" && ctx?.job && !ctx.job.machine_id) {
        toast.info("Asigná una máquina para verlo en el cronograma");
      }
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

const SCHEDULED_STATUSES: JobStatus[] = [
  "MAZAK",
  "MAQUINADO_LISTO",
  "CEMENTACION",
  "EXPO",
];

/**
 * One-shot backfill: any job in MAZAK+ with a machine assigned but no
 * planned dates gets slotted into the next free window on its machine.
 * Runs once per session to make legacy ODFs visible on the Gantt.
 */
export function useBackfillSchedules(jobs: Job[]) {
  const qc = useQueryClient();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || jobs.length === 0) return;
    const needs = jobs.filter(
      (j) =>
        SCHEDULED_STATUSES.includes(j.status) &&
        j.machine_id &&
        (!j.planned_start || !j.planned_end),
    );
    if (needs.length === 0) {
      done.current = true;
      return;
    }
    done.current = true;
    (async () => {
      const machines = qc.getQueryData<Machine[]>(["machines"]) ?? [];
      const partTimes = qc.getQueryData<PartTime[]>(["part_times"]) ?? [];
      const updates = computeSpreadSchedule(needs, jobs, machines, partTimes);
      // optimistic patch
      const prev = qc.getQueryData<Job[]>(["jobs"]) ?? [];
      const byId = new Map(updates.map((u) => [u.id, u]));
      qc.setQueryData<Job[]>(
        ["jobs"],
        prev.map((j) => {
          const u = byId.get(j.id);
          return u ? { ...j, planned_start: u.planned_start, planned_end: u.planned_end } : j;
        }),
      );
      try {
        for (const u of updates) {
          await supabase
            .from("jobs")
            .update({ planned_start: u.planned_start, planned_end: u.planned_end })
            .eq("id", u.id);
        }
        toast.success(
          `Programadas ${updates.length} ODF${updates.length === 1 ? "" : "s"} sin fecha`,
        );
        qc.invalidateQueries({ queryKey: ["jobs"] });
      } catch (e) {
        qc.setQueryData(["jobs"], prev);
        toast.error("No se pudieron programar ODFs sin fecha", {
          description: (e as Error).message,
        });
      }
    })();
  }, [jobs, qc]);
}

/**
 * Spread jobs across the 3-shift day, machine by machine.
 * Each machine has its own cursor starting at the next shift boundary
 * (or after its last scheduled job). Jobs are placed back-to-back so the
 * day fills with M → T → N bands instead of every job starting at 08:00.
 */
function computeSpreadSchedule(
  jobsToSchedule: Job[],
  existingJobs: Job[],
  machines: Machine[],
  partTimes: PartTime[],
): { id: string; planned_start: string; planned_end: string }[] {
  const base = nextShiftBoundary().getTime();
  const cursors = new Map<string, number>();
  // Initialize each cursor from the tail of already-scheduled jobs on that machine.
  for (const j of existingJobs) {
    if (!j.machine_id || !j.planned_end) continue;
    const e = new Date(j.planned_end).getTime();
    cursors.set(j.machine_id, Math.max(cursors.get(j.machine_id) ?? base, e));
  }
  const out: { id: string; planned_start: string; planned_end: string }[] = [];
  for (const j of jobsToSchedule) {
    const mId = j.machine_id!;
    const cursor = cursors.get(mId) ?? base;
    const machine = machines.find((m) => m.id === mId) ?? { hours_per_shift: 8 };
    const { hours } = jobDurationHours(j, partTimes);
    const span = scheduleJob(cursor, hours, machine);
    cursors.set(mId, span.cursorMs);
    out.push({
      id: j.id,
      planned_start: span.planned_start,
      planned_end: span.planned_end,
    });
  }
  return out;
}

/**
 * Redistribute ALL scheduled jobs across the 3 shifts, starting from now.
 * Useful as a "rebalance" button to fix legacy data clumped at 08:00.
 * Sorts jobs by current planned_start so the existing sequence per machine is preserved.
 */
export function useRedistributeSchedules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const jobs = (qc.getQueryData<Job[]>(["jobs"]) ?? []).filter(
        (j) => SCHEDULED_STATUSES.includes(j.status) && j.machine_id,
      );
      const machines = qc.getQueryData<Machine[]>(["machines"]) ?? [];
      const partTimes = qc.getQueryData<PartTime[]>(["part_times"]) ?? [];
      // Sort per-machine by current planned_start (nulls last) then by odf.
      const sorted = [...jobs].sort((a, b) => {
        const am = a.machine_id ?? "";
        const bm = b.machine_id ?? "";
        if (am !== bm) return am.localeCompare(bm);
        const as = a.planned_start ? new Date(a.planned_start).getTime() : Infinity;
        const bs = b.planned_start ? new Date(b.planned_start).getTime() : Infinity;
        if (as !== bs) return as - bs;
        return a.odf.localeCompare(b.odf);
      });
      const base = nextShiftBoundary().getTime();
      const cursors = new Map<string, number>();
      const updates: { id: string; planned_start: string; planned_end: string }[] = [];
      for (const j of sorted) {
        const mId = j.machine_id!;
        const cursor = cursors.get(mId) ?? base;
        const machine = machines.find((m) => m.id === mId) ?? { hours_per_shift: 8 };
        const { hours } = jobDurationHours(j, partTimes);
        const span = scheduleJob(cursor, hours, machine);
        cursors.set(mId, span.cursorMs);
        updates.push({
          id: j.id,
          planned_start: span.planned_start,
          planned_end: span.planned_end,
        });
      }
      for (const u of updates) {
        const { error } = await supabase
          .from("jobs")
          .update({ planned_start: u.planned_start, planned_end: u.planned_end })
          .eq("id", u.id);
        if (error) throw error;
      }
      return { count: updates.length };
    },
    onSuccess: ({ count }) => {
      toast.success(`Cronograma redistribuido · ${count} ODFs en turnos M/T/N`);
    },
    onError: (err) => {
      toast.error("No se pudo redistribuir", { description: (err as Error).message });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export interface RescheduleInput {
  id: string;
  planned_start: string;
  planned_end: string;
  machine_id?: string | null;
}

/** Drag-to-reschedule: move a bar to a new day and/or machine. */
export function useRescheduleJob() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: RescheduleInput) => {
      const patch: Partial<Job> = {
        planned_start: input.planned_start,
        planned_end: input.planned_end,
      };
      if (input.machine_id !== undefined) patch.machine_id = input.machine_id;
      const { error } = await supabase.from("jobs").update(patch).eq("id", input.id);
      if (error) throw error;
      return input;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: ["jobs"] });
      const previous = qc.getQueryData<Job[]>(["jobs"]) ?? [];
      qc.setQueryData<Job[]>(
        ["jobs"],
        previous.map((j) =>
          j.id === input.id
            ? {
                ...j,
                planned_start: input.planned_start,
                planned_end: input.planned_end,
                ...(input.machine_id !== undefined ? { machine_id: input.machine_id } : {}),
              }
            : j,
        ),
      );
      return { previous };
    },
    onError: (err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["jobs"], ctx.previous);
      toast.error("No se pudo reprogramar", { description: (err as Error).message });
    },
    onSuccess: (data) => {
      const s = new Date(data.planned_start).toLocaleDateString("es", { day: "2-digit", month: "2-digit" });
      const e = new Date(data.planned_end).toLocaleDateString("es", { day: "2-digit", month: "2-digit" });
      toast.success(`Reprogramado · ${s} → ${e}`);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });
}

export interface LogDelayInput {
  jobId: string;
  delayHours: number;
  reason: string;
  eventKind?: EventKind;
}

export interface LogDelayResult {
  changes: CascadeChange[];
  shiftedAt: number;
}

/**
 * Record a production delay and cascade the schedule in one shot.
 *   1. inserts a row in status_events (audit trail)
 *   2. bulk-updates planned_start / planned_end on the anchor + downstream jobs
 *   3. optimistically patches the React Query cache so the Gantt moves immediately
 */
export function useLogDelay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ jobId, delayHours, reason, eventKind = "delay" }: LogDelayInput) => {
      const jobs = (qc.getQueryData<Job[]>(["jobs"]) ?? []);
      const changes = cascade({ jobs, delayedJobId: jobId, delayHours });
      if (changes.length === 0) {
        throw new Error("No hay nada que reprogramar — el ODF no tiene fecha planificada.");
      }

      // 1. audit row
      const anchor = jobs.find((j) => j.id === jobId);
      const { error: evErr } = await supabase.from("status_events").insert({
        job_id: jobId,
        from_status: anchor?.status ?? null,
        to_status: anchor?.status ?? "PLANNED",
        delay_hours: delayHours,
        reason,
        event_kind: eventKind,
      } as never);
      if (evErr) throw evErr;

      // 2. bulk update affected jobs
      for (const c of changes) {
        const { error } = await supabase
          .from("jobs")
          .update({ planned_start: c.new_start, planned_end: c.new_end })
          .eq("id", c.job_id);
        if (error) throw error;
      }

      return { changes, shiftedAt: Date.now() } as LogDelayResult;
    },
    onMutate: async ({ jobId, delayHours }) => {
      await qc.cancelQueries({ queryKey: ["jobs"] });
      const previous = qc.getQueryData<Job[]>(["jobs"]) ?? [];
      const changes = cascade({ jobs: previous, delayedJobId: jobId, delayHours });
      const byId = new Map(changes.map((c) => [c.job_id, c]));
      const next = previous.map((j) => {
        const c = byId.get(j.id);
        return c ? { ...j, planned_start: c.new_start, planned_end: c.new_end } : j;
      });
      qc.setQueryData<Job[]>(["jobs"], next);
      return { previous };
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(["jobs"], ctx.previous);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["status_events"] });
    },
  });
}

// ============================================================================
// Batch apply: takes a list of pending moves (drag-staged in the Gantt) and
// commits them in a single confirmation. Each move can have its own event kind
// and the cascade is computed sequentially per move.
// ============================================================================

export interface PendingMoveCommit {
  jobId: string;
  planned_start: string;
  planned_end: string;
  machine_id: string | null;
  eventKind: EventKind;
}

export interface ApplyReschedulesInput {
  moves: PendingMoveCommit[];
  reason: string;
}

export function useApplyReschedules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ moves, reason }: ApplyReschedulesInput) => {
      if (moves.length === 0) throw new Error("Sin movimientos para aplicar");
      const jobs = qc.getQueryData<Job[]>(["jobs"]) ?? [];
      const byId = new Map(jobs.map((j) => [j.id, j]));

      for (const m of moves) {
        const original = byId.get(m.jobId);
        const fromStatus = original?.status ?? "PLANNED";
        const oldEndMs = original?.planned_end ? new Date(original.planned_end).getTime() : null;
        const newEndMs = new Date(m.planned_end).getTime();
        const shiftedHours = oldEndMs ? (newEndMs - oldEndMs) / (60 * 60 * 1000) : 0;

        // 1. patch the dragged job (position + machine)
        const { error: updErr } = await supabase
          .from("jobs")
          .update({
            planned_start: m.planned_start,
            planned_end: m.planned_end,
            machine_id: m.machine_id,
          })
          .eq("id", m.jobId);
        if (updErr) throw updErr;

        // 2. cascade downstream on the original machine using the delta.
        //    cascade() takes the un-moved jobs + delayHours and computes
        //    downstream shifts on the same machine; we skip the anchor itself
        //    since we wrote it explicitly above.
        if (shiftedHours !== 0 && original && original.machine_id && original.planned_end) {
          const changes = cascade({
            jobs,
            delayedJobId: m.jobId,
            delayHours: shiftedHours,
          });
          for (const c of changes) {
            if (c.job_id === m.jobId) continue;
            await supabase
              .from("jobs")
              .update({ planned_start: c.new_start, planned_end: c.new_end })
              .eq("id", c.job_id);
          }
        }

        // 3. audit row
        const { error: evErr } = await supabase.from("status_events").insert({
          job_id: m.jobId,
          from_status: fromStatus,
          to_status: fromStatus,
          delay_hours: shiftedHours,
          reason,
          event_kind: m.eventKind,
        } as never);
        if (evErr) throw evErr;
      }

      return { count: moves.length };
    },
    onSuccess: ({ count }) => {
      toast.success(`${count} movimiento${count === 1 ? "" : "s"} aplicado${count === 1 ? "" : "s"}`);
    },
    onError: (err) => {
      toast.error("No se pudo aplicar la reprogramación", { description: (err as Error).message });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ["jobs"] });
      qc.invalidateQueries({ queryKey: ["status_events"] });
    },
  });
}

/** Full event history for a single ODF — newest first. */
export function useJobHistory(jobId: string | null) {
  return useQuery({
    queryKey: ["status_events", jobId],
    enabled: !!jobId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("status_events")
        .select("id, job_id, event_kind, delay_hours, reason, created_at, from_status, to_status")
        .eq("job_id", jobId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Recent delays — used by the Gantt to draw ghost bars and badges. */
export function useRecentDelays() {
  return useQuery({
    queryKey: ["status_events"],
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("status_events")
        .select("job_id, delay_hours, reason, created_at")
        .gte("created_at", since)
        .gt("delay_hours", 0)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });
}