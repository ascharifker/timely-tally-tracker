// Domain types for FACT — Mego Afek production planning.
// Mirrors the Supabase schema. Keep in sync with src/integrations/supabase/types.ts.

export type MachineType = "internal" | "external_shop";
export type ShiftSlot = "manana" | "tarde" | "noche";
export type JobStatus =
  | "PLANNED"
  | "MAZAK"
  | "TALLER_EXTERNO"
  | "MAQUINADO_LISTO"
  | "CEMENTACION"
  | "EXPO"
  | "YA_SE_ENVIO"
  | "EN_ESPERA"
  | "ON_HOLD"
  | "MAQYRO"
  | "EN_GEMAK"
  | "CEMENTACION_LISTO";
export type JobPriority = "low" | "normal" | "high" | "urgent";

export interface Machine {
  id: string;
  name: string;
  type: MachineType;
  display_order: number;
  hours_per_shift: number;
  active_shifts: ShiftSlot[];
  model?: string | null;
  serial_number?: string | null;
  year?: number | null;
  purchase_date?: string | null;
  location?: string | null;
  image_url?: string | null;
  notes?: string | null;
  hourly_cost?: number;
  vendor_id?: string | null;
}

export interface Job {
  id: string;
  odf: string;
  /** @deprecated Usar po_line_item_id + join a purchase_orders. Se mantiene por compatibilidad de UI. */
  po_musa: string | null;
  /** @deprecated Idem po_musa. */
  po_halliburton: string | null;
  /** @deprecated Vive ahora en po_line_items.pir. */
  pir: string | null;
  /** @deprecated Vive ahora en po_line_items.tube_spec. */
  tube_spec: string | null;
  qty: number;
  machine_id: string | null;
  status: JobStatus;
  priority: JobPriority;
  export_date: string | null;
  /** @deprecated Vive ahora en po_line_items.committed_date. */
  customer_date: string | null;
  planned_start: string | null;
  planned_end: string | null;
  notes: string | null;
  hours_override: number | null;
  operator_name: string | null;
  /** FK a la línea del PO que origina esta ODF. Null = trabajo interno sin PO. */
  po_line_item_id?: string | null;
}

export interface PartTime {
  id: string;
  pir: string;
  machine_id: string;
  hours_per_piece: number;
}

export interface Vendor {
  id: string;
  name: string;
  tax_id: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  hourly_rate: number;
  lead_time_days_avg: number | null;
  notes: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------
// Purchase Order model (Paso 1 del Order Lifecycle Hub)
// ---------------------------------------------------------------

export interface Customer {
  id: string;
  name: string;
  code: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export type PurchaseOrderStatus =
  | "received"
  | "in_production"
  | "partial_shipped"
  | "completed"
  | "cancelled";

export interface PurchaseOrder {
  id: string;
  customer_id: string;
  po_number: string;
  issued_date: string | null;
  committed_date: string | null;
  status: PurchaseOrderStatus;
  source_document_url: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface POLineItem {
  id: string;
  purchase_order_id: string;
  line_number: number;
  pir: string | null;
  tube_spec: string | null;
  qty_ordered: number;
  committed_date: string | null;
  export_date: string | null;
  unit_price: number | null;
  currency: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  status: POLineStatus;
  flag_reason: string | null;
  engineering_reviewed_at: string | null;
  engineering_reviewed_by: string | null;
}

export type POLineStatus =
  | "pending_engineering"
  | "engineering_approved"
  | "engineering_flagged"
  | "ready_for_production"
  | "scheduled"
  | "in_progress"
  | "completed"
  | "cancelled";

export const PO_LINE_STATUS_LABEL: Record<POLineStatus, string> = {
  pending_engineering: "Pendiente ingeniería",
  engineering_approved: "Aprobada por ingeniería",
  engineering_flagged: "Flagueada por ingeniería",
  ready_for_production: "Lista para producción",
  scheduled: "Planificada",
  in_progress: "En curso",
  completed: "Completada",
  cancelled: "Cancelada",
};

export interface DateChange {
  id: string;
  po_line_item_id: string | null;
  job_id: string | null;
  field: string;
  old_value: string | null;
  new_value: string | null;
  changed_by: string | null;
  changed_at: string;
  reason: string | null;
  acknowledged_by_peter: boolean;
  acknowledged_at: string | null;
}

export interface MachineRun {
  id: string;
  job_id: string;
  machine_id: string;
  started_at: string;
  ended_at: string | null;
  pieces_completed: number;
  operator_name: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export const STATUS_PIPELINE: JobStatus[] = [
  "PLANNED",
  "MAZAK",
  "TALLER_EXTERNO",
  "MAQUINADO_LISTO",
  "CEMENTACION",
  "EXPO",
  "YA_SE_ENVIO",
];

export const STATUS_LABEL: Record<JobStatus, string> = {
  PLANNED: "Planificado",
  MAZAK: "MAZAK",
  TALLER_EXTERNO: "Taller Externo",
  MAQUINADO_LISTO: "Maquinado Listo",
  CEMENTACION: "Cementación",
  EXPO: "Expo",
  YA_SE_ENVIO: "Ya se Envió",
  EN_ESPERA: "En Espera",
  ON_HOLD: "On Hold",
  MAQYRO: "Maqyro",
  EN_GEMAK: "En Gemak",
  CEMENTACION_LISTO: "Cementación Lista",
};

export const STATUS_COLOR: Record<JobStatus, string> = {
  PLANNED: "var(--status-planned)",
  MAZAK: "var(--status-mazak)",
  TALLER_EXTERNO: "var(--status-taller)",
  MAQUINADO_LISTO: "var(--status-listo)",
  CEMENTACION: "var(--status-cementacion)",
  EXPO: "var(--status-expo)",
  YA_SE_ENVIO: "var(--status-enviado)",
  EN_ESPERA: "var(--status-planned)",
  ON_HOLD: "var(--status-risk)",
  MAQYRO: "var(--status-cementacion)",
  EN_GEMAK: "var(--status-taller)",
  CEMENTACION_LISTO: "var(--status-listo)",
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
  | "breakdown"
  | "maintenance_preventive"
  | "maintenance_corrective";

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  delay: "Retraso de producción",
  priority_shift: "Prioridad cambiada",
  absence: "Ausencia de personal",
  change_order: "Cambio de orden",
  breakdown: "Avería de máquina",
  maintenance_preventive: "Mantenimiento preventivo",
  maintenance_corrective: "Mantenimiento correctivo",
};

export const EVENT_KIND_COLOR: Record<EventKind, string> = {
  delay: "var(--status-risk)",
  priority_shift: "var(--status-mazak)",
  absence: "var(--status-listo)",
  change_order: "var(--status-cementacion)",
  breakdown: "var(--status-expo)",
  maintenance_preventive: "var(--status-planned)",
  maintenance_corrective: "var(--status-risk)",
};

/** Maintenance vs production split — drives UI grouping in Events tab. */
export const MAINTENANCE_EVENT_KINDS: EventKind[] = [
  "maintenance_preventive",
  "maintenance_corrective",
];
export function isMaintenanceEvent(kind: EventKind): boolean {
  return MAINTENANCE_EVENT_KINDS.includes(kind);
}