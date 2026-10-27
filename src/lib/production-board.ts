import type { Job, JobStatus, Machine, PartTime } from "./fact-types";
import { STATUS_LABEL, STATUS_PIPELINE } from "./fact-types";
import { planInsertion } from "./scheduling/insertion";
import { jobDurationHours } from "./scheduling/duration";
import { scheduleJob } from "./scheduling/schedule";

export interface BoardColumn {
  id: string;
  label: string;
  status: JobStatus;
  machine?: Machine;
  unassigned?: boolean;
}

export function productionColumns(machines: Machine[], jobs: Job[]): BoardColumn[] {
  const internal = machines.filter((m) => m.type === "internal")
    .sort((a, b) => a.display_order - b.display_order || a.name.localeCompare(b.name));
  return STATUS_PIPELINE.flatMap((status): BoardColumn[] => {
    if (status !== "MAZAK") return [{ id: status, label: STATUS_LABEL[status], status }];
    const columns: BoardColumn[] = internal.map((machine) => ({
      id: machine.id, label: machine.name, status, machine,
    }));
    if (!internal.length || jobs.some((j) => j.status === status && !internal.some((m) => m.id === j.machine_id))) {
      columns.push({ id: "MAZAK_UNASSIGNED", label: "MAZAK · Sin asignar", status, unassigned: true });
    }
    return columns;
  });
}

export function belongsToColumn(job: Job, column: BoardColumn, machines: Machine[]): boolean {
  if (job.status !== column.status) return false;
  if (column.machine) return job.machine_id === column.machine.id;
  if (column.unassigned) return !machines.some((m) => m.type === "internal" && m.id === job.machine_id);
  return true;
}

export function planBoardAssignment(jobs: Job[], job: Job, machine: Machine, partTimes: PartTime[], now: number) {
  const start = job.planned_start ? new Date(job.planned_start).getTime() : now;
  const span = scheduleJob(start, jobDurationHours({ ...job, machine_id: machine.id }, partTimes).hours, machine);
  return planInsertion(jobs, job.id, machine.id, new Date(span.planned_start).getTime(), new Date(span.planned_end).getTime());
}