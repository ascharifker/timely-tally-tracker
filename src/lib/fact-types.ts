// Domain types for FACT — Mego Afek production planning.
// Mirrors the Supabase schema. Keep in sync with src/integrations/supabase/types.ts.

export type MachineType = "internal" | "external_shop";
export type ShiftSlot = "manana" | "tarde" | "noche";
export type JobStatus =
  | "PLANNED"
  | "MAZAK"
  | "MAQUINADO_LISTO"
  | "CEMENTACION"
  | "EXPO"
  | "YA_SE_ENVIO";
export type JobPriority = "low" | "normal" | "high" | "urgent";

export interface Machine {
  id: string;
  name: string;
  type: MachineType;
  display_order: number;
  hours_per_shift: number;
  active_shifts: ShiftSlot[];
}

export interface Job {
  id: string;
  odf: string;
  po_musa: string | null;
  po_halliburton: string | null;
  pir: string | null;
  tube_spec: string | null;
  qty: number;
  machine_id: string | null;
  status: JobStatus;
  priority: JobPriority;
  export_date: string | null;
  customer_date: string | null;
  planned_start: string | null;
  planned_end: string | null;
  notes: string | null;
  hours_override: number | null;
  operator_name: string | null;
}

export interface PartTime {
  id: string;
  pir: string;
  machine_id: string;
  hours_per_piece: number;
}

export const STATUS_PIPELINE: JobStatus[] = [
  "PLANNED",
  "MAZAK",
  "MAQUINADO_LISTO",
  "CEMENTACION",
  "EXPO",
  "YA_SE_ENVIO",
];

export const STATUS_LABEL: Record<JobStatus, string> = {
  PLANNED: "Planificado",
  MAZAK: "MAZAK",
  MAQUINADO_LISTO: "Maquinado Listo",
  CEMENTACION: "Cementación",
  EXPO: "Expo",
  YA_SE_ENVIO: "Ya se Envió",
};

export const STATUS_COLOR: Record<JobStatus, string> = {
  PLANNED: "var(--status-planned)",
  MAZAK: "var(--status-mazak)",
  MAQUINADO_LISTO: "var(--status-listo)",
  CEMENTACION: "var(--status-cementacion)",
  EXPO: "var(--status-expo)",
  YA_SE_ENVIO: "var(--status-enviado)",
};

export const SHIFT_LABEL: Record<ShiftSlot, string> = {
  manana: "Mañana",
  tarde: "Tarde",
  noche: "Noche",
};

export type DelayUnit = "hours" | "shifts" | "days";

/** Convert a delay amount in the chosen unit into hours. 1 turno = 8h. */
export function toHours(amount: number, unit: DelayUnit): number {
  switch (unit) {
    case "hours":
      return amount;
    case "shifts":
      return amount * 8;
    case "days":
      return amount * 24;
  }
}

export type EventKind =
  | "delay"
  | "priority_shift"
  | "absence"
  | "change_order"
  | "breakdown";

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  delay: "Retraso de producción",
  priority_shift: "Prioridad cambiada",
  absence: "Ausencia de personal",
  change_order: "Cambio de orden",
  breakdown: "Avería de máquina",
};

export const EVENT_KIND_COLOR: Record<EventKind, string> = {
  delay: "var(--status-risk)",
  priority_shift: "var(--status-mazak)",
  absence: "var(--status-listo)",
  change_order: "var(--status-cementacion)",
  breakdown: "var(--status-expo)",
};