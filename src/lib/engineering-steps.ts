/**
 * Engineering Verification Funnel — step configuration.
 * Data-driven: add an entry here and the UI + advance logic pick it up.
 */

export type EngStepKey =
  | "po_info"
  | "pir_verify"
  | "components"
  | "matrix_check";

export interface EngStep {
  key: EngStepKey;
  label: string;
  shortLabel: string;
  description: string;
  optional: boolean;
}

export const ENGINEERING_STEPS: EngStep[] = [
  {
    key: "po_info",
    label: "PO Info",
    shortLabel: "PO",
    description: "Review PO header, customer, line, qty and committed date.",
    optional: false,
  },
  {
    key: "pir_verify",
    label: "PIR Verification",
    shortLabel: "PIR",
    description: "Verify PIR number and tube spec for the line.",
    optional: false,
  },
  {
    key: "components",
    label: "Part Component List",
    shortLabel: "Components",
    description: "Cross-check against the Master PIR component list.",
    optional: false,
  },
  {
    key: "matrix_check",
    label: "Quality Matrix Check",
    shortLabel: "Matrix",
    description: "Mark Quality Matrix check complete. No auto-email.",
    optional: false,
  },
];

export function firstStep(): EngStep {
  return ENGINEERING_STEPS[0];
}

export function getStep(key: string | null | undefined): EngStep | undefined {
  if (!key) return undefined;
  return ENGINEERING_STEPS.find((s) => s.key === key);
}

export function nextStep(current: string | null | undefined): EngStep | null {
  if (!current) return firstStep();
  const idx = ENGINEERING_STEPS.findIndex((s) => s.key === current);
  if (idx < 0) return firstStep();
  if (idx >= ENGINEERING_STEPS.length - 1) return null;
  return ENGINEERING_STEPS[idx + 1];
}

export function stepIndex(key: string | null | undefined): number {
  if (!key) return -1;
  return ENGINEERING_STEPS.findIndex((s) => s.key === key);
}