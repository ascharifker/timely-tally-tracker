import type { AppRole } from "@/hooks/useUserRole";
import type { ReviewTrack } from "@/lib/fact-types";

export function hasRole(roles: AppRole[], role: AppRole): boolean {
  return roles.includes(role);
}

export function isAdmin(roles: AppRole[]): boolean {
  return hasRole(roles, "admin");
}

export function isViewer(roles: AppRole[]): boolean {
  return roles.length === 0 || (roles.length === 1 && roles[0] === "viewer");
}

/** Can this user create new POs / line items at all (regardless of track)? */
export function canCreatePo(roles: AppRole[]): boolean {
  return (
    isAdmin(roles) ||
    hasRole(roles, "po_editor") ||
    hasRole(roles, "coe_reviewer") ||
    hasRole(roles, "third_party_reviewer")
  );
}

/** Can this user edit a specific PO given its review track? */
export function canEditPo(roles: AppRole[], track: ReviewTrack | null | undefined): boolean {
  if (isAdmin(roles) || hasRole(roles, "po_editor")) return true;
  if (track === "coe" && hasRole(roles, "coe_reviewer")) return true;
  if (track === "third_party" && hasRole(roles, "third_party_reviewer")) return true;
  return false;
}

/** Loose check — used to show/hide spreadsheet edit affordances when the PO track isn't known yet. */
export function canEditAnyPo(roles: AppRole[]): boolean {
  return canCreatePo(roles);
}

export function canEditProduction(roles: AppRole[]): boolean {
  return (
    isAdmin(roles) ||
    hasRole(roles, "manager") ||
    hasRole(roles, "production_editor")
  );
}

export const ROLE_LABEL: Record<AppRole, string> = {
  admin: "Admin",
  manager: "Manager",
  po_editor: "PO Editor",
  coe_reviewer: "COE Reviewer",
  third_party_reviewer: "Third-party Reviewer",
  production_editor: "Production",
  viewer: "Viewer",
};

export function primaryRoleLabel(roles: AppRole[]): string {
  if (roles.length === 0) return "Viewer";
  const order: AppRole[] = [
    "admin",
    "manager",
    "po_editor",
    "coe_reviewer",
    "third_party_reviewer",
    "production_editor",
    "viewer",
  ];
  for (const r of order) {
    if (roles.includes(r)) return ROLE_LABEL[r];
  }
  return "Viewer";
}

/** Which track tab a user should land on by default. */
export function defaultTrackForRoles(
  roles: AppRole[],
): "all" | ReviewTrack {
  if (hasRole(roles, "coe_reviewer") && !isAdmin(roles)) return "coe";
  if (hasRole(roles, "third_party_reviewer") && !isAdmin(roles)) return "third_party";
  return "all";
}