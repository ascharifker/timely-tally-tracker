/**
 * Body / tube spec fields — the steel tubing that is transformed into the
 * part "body". These are distinct from the component specs.
 * Add or rename a field here and the Engineering panel picks it up.
 */

export type BodySpecKey =
  | "body_od"
  | "body_wall"
  | "body_grade"
  | "body_length"
  | "body_thread"
  | "body_heat_treat"
  | "body_notes";

export interface BodySpecField {
  key: BodySpecKey;
  label: string;
  placeholder: string;
  /** Render as a wide/multiline input. */
  wide?: boolean;
}

export const BODY_SPEC_FIELDS: BodySpecField[] = [
  { key: "body_od", label: "OD", placeholder: 'e.g. 2.875"' },
  { key: "body_wall", label: "Wall", placeholder: 'e.g. 0.217"' },
  { key: "body_grade", label: "Grade / material", placeholder: "e.g. L80" },
  { key: "body_length", label: "Length", placeholder: 'e.g. 31.5"' },
  { key: "body_thread", label: "Thread / connection", placeholder: "e.g. EUE 8RD" },
  { key: "body_heat_treat", label: "Heat treatment", placeholder: "e.g. Q&T" },
  { key: "body_notes", label: "Notes", placeholder: "Anything else Engineering should know", wide: true },
];

/** Compact one-line summary (OD x wall x grade) for table cells. */
export function bodySpecSummary(line: Partial<Record<BodySpecKey, string | null>>): string | null {
  const parts = [line.body_od, line.body_wall, line.body_grade].filter(
    (v): v is string => !!v && v.trim() !== "",
  );
  return parts.length > 0 ? parts.join(" × ") : null;
}
