import * as XLSX from "xlsx";

export type RowStatus = "ready_for_production" | "in_progress" | "completed";

export interface ParsedRun {
  started_at: string; // ISO
  pieces: number;
  source_line: string;
}

export interface ParsedRow {
  rowIndex: number;
  machineHeader: string;
  machineId: string | null; // resolved
  po_raw: string;
  po_number: string | null;
  odf: string | null;
  committed_date: string | null; // ISO date
  tube_spec: string | null;
  notes_product: string | null;
  pir: string | null;
  qty: number | null;
  comentarios: string | null;
  runs: ParsedRun[];
  runsAttempted: number;
  status: RowStatus;
  errors: string[];
  warnings: string[];
}

export interface MachineLookup {
  id: string;
  name: string;
}

const MONTHS: Record<string, number> = {
  ene: 0, feb: 1, mar: 2, abr: 3, may: 4, jun: 5,
  jul: 6, ago: 7, sep: 8, oct: 9, nov: 10, dic: 11,
};

const SHIFT_HOUR: Record<string, number> = { "1er": 6, "2do": 14, "3er": 22 };

const MACHINE_HEADER_RE = /^(MAZAK\s*\d+|MAQYRO|TEC\s*MAQ|TECMAC|CENTRO DE MAQUINADO|MAQUINAS Y HERRAMIENTAS|GEMAK|GMAC)\s*$/i;

function normalizeMachineName(s: string): string {
  return s.replace(/\s+/g, " ").trim().toUpperCase();
}

function matchMachine(header: string, machines: MachineLookup[]): string | null {
  const norm = normalizeMachineName(header);
  const exact = machines.find((m) => normalizeMachineName(m.name) === norm);
  if (exact) return exact.id;
  // common alias: "TEC MAQ" -> "TECMAC"
  if (norm.replace(/\s/g, "") === "TECMAQ") {
    const m = machines.find((m) => normalizeMachineName(m.name) === "TECMAC");
    if (m) return m.id;
  }
  return null;
}

function asString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const s = String(v).trim();
  return s.length ? s : null;
}

function extractPoNumber(cell: string): string | null {
  // find first all-digit (4+) token across newlines
  const tokens = cell.split(/\s+/);
  for (const t of tokens) {
    const m = t.match(/^\d{4,}[A-Za-z]?$/);
    if (m) return m[0];
  }
  // fallback: any 3+ digit
  const m2 = cell.match(/\d{3,}/);
  return m2 ? m2[0] : null;
}

function extractQty(cell: unknown): number | null {
  if (typeof cell === "number") return Math.floor(cell);
  if (cell == null) return null;
  const m = String(cell).match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

function parseDate(cell: unknown): string | null {
  if (cell instanceof Date) return cell.toISOString().slice(0, 10);
  if (typeof cell === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(cell);
    if (d) {
      const dt = new Date(Date.UTC(d.y, d.m - 1, d.d));
      return dt.toISOString().slice(0, 10);
    }
  }
  if (typeof cell === "string") {
    const s = cell.trim();
    // dd/mm/yyyy
    let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    // dd-mon (es)
    m = s.match(/^(\d{1,2})-(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)$/i);
    if (m) {
      const year = new Date().getFullYear();
      const mm = MONTHS[m[2].toLowerCase()];
      return `${year}-${String(mm + 1).padStart(2, "0")}-${m[1].padStart(2, "0")}`;
    }
  }
  return null;
}

export function parseScheduleCell(text: string, fallbackYear: number): { runs: ParsedRun[]; attempted: number } {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const runs: ParsedRun[] = [];
  let attempted = 0;
  const re = /^(\d{1,2})-(ene|feb|mar|abr|may|jun|jul|ago|sep|oct|nov|dic)\s+(1er|2do|3er)\s+turno(?:\s+([\d.]+)\s*pza)?/i;
  for (const line of lines) {
    attempted++;
    const m = line.match(re);
    if (!m) continue;
    const day = parseInt(m[1], 10);
    const mm = MONTHS[m[2].toLowerCase()];
    const hour = SHIFT_HOUR[m[3].toLowerCase()];
    const pieces = m[4] ? parseFloat(m[4]) : 0;
    const dt = new Date(Date.UTC(fallbackYear, mm, day, hour, 0, 0));
    runs.push({
      started_at: dt.toISOString(),
      pieces: Math.round(pieces),
      source_line: line,
    });
  }
  return { runs, attempted };
}

export async function parseMaquinadosWorkbook(
  arrayBuffer: ArrayBuffer,
  machines: MachineLookup[],
): Promise<ParsedRow[]> {
  const wb = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
  if (!wb.SheetNames.includes("MAQUINADOS")) {
    throw new Error('El archivo no contiene una hoja llamada "MAQUINADOS".');
  }
  const ws = wb.Sheets["MAQUINADOS"];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null });

  const result: ParsedRow[] = [];
  let currentHeader = "";
  let currentMachineId: string | null = null;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const a = asString(row[0]);
    // detect header row: only col A populated, matches header regex
    const otherCols = row.slice(1).some((c) => c !== null && c !== "");
    if (a && !otherCols && MACHINE_HEADER_RE.test(a.replace(/\s+/g, " ").trim())) {
      currentHeader = a.replace(/\s+/g, " ").trim();
      currentMachineId = matchMachine(currentHeader, machines);
      continue;
    }

    // skip empty / header text rows
    if (!a) continue;
    if (/^no\.\s*de\s*p\.o\./i.test(a)) continue;
    if (/^fecha$/i.test(a)) continue;
    if (!currentHeader) continue; // data before any machine header

    const po_raw = String(row[0] ?? "");
    const po_number = extractPoNumber(po_raw);
    const odf = asString(row[1]);
    const committed_date = parseDate(row[2]);
    const tube_spec = asString(row[3]);
    const notes_product = asString(row[4]);
    const pir = asString(row[5]);
    const qty = extractQty(row[6]);
    const comentarios = asString(row[8]);

    const errors: string[] = [];
    const warnings: string[] = [];

    if (!po_number) errors.push("Falta No. de P.O.");
    if (!odf) errors.push("Falta ODF");
    if (!pir) errors.push("Falta PIR");
    if (!qty || qty <= 0) errors.push("Falta cantidad");
    if (!currentMachineId) {
      errors.push(`Máquina "${currentHeader}" no existe en el sistema — créala en Configuración`);
    }
    if (!committed_date && row[2]) warnings.push("Fecha de entrega no se pudo interpretar");

    const year = committed_date ? new Date(committed_date).getFullYear() : new Date().getFullYear();
    const { runs, attempted } = comentarios
      ? parseScheduleCell(comentarios, year)
      : { runs: [], attempted: 0 };
    if (attempted > 0 && runs.length === 0) {
      warnings.push("Comentarios presentes pero no se reconoció ningún turno");
    }

    result.push({
      rowIndex: i + 1,
      machineHeader: currentHeader,
      machineId: currentMachineId,
      po_raw,
      po_number,
      odf,
      committed_date,
      tube_spec,
      notes_product,
      pir,
      qty,
      comentarios,
      runs,
      runsAttempted: attempted,
      status: "in_progress",
      errors,
      warnings,
    });
  }

  return result;
}

export function rowToPayload(r: ParsedRow): Record<string, unknown> {
  const lineStatus: Record<RowStatus, string> = {
    ready_for_production: "ready_for_production",
    in_progress: "in_progress",
    completed: "completed",
  };
  const jobStatus: Record<RowStatus, string | null> = {
    ready_for_production: null,
    in_progress: "MAZAK",
    completed: "YA_SE_ENVIO",
  };
  return {
    po_number: r.po_number,
    po_raw: r.po_raw,
    odf: r.odf,
    pir: r.pir,
    qty: r.qty,
    tube_spec: r.tube_spec,
    notes_product: r.notes_product,
    committed_date: r.committed_date,
    machine_id: r.machineId,
    status: lineStatus[r.status],
    job_status: jobStatus[r.status],
    comentarios: r.comentarios,
    runs: r.runs.map((x) => ({ started_at: x.started_at, pieces: x.pieces })),
  };
}