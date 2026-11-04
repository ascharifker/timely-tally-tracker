// Client-safe ranking for Dropbox design-plan search results.
export const PLAN_EXTENSIONS = ["pdf", "dwg", "dxf", "png", "jpg", "jpeg", "tif", "tiff"];

export interface RankableFile {
  name: string;
  path_display: string;
  rev_from_name: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function isPlanFile(name: string): boolean {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return PLAN_EXTENSIONS.includes(ext);
}

/** Higher = better. 0 means the query is not in the file name at all. */
export function planScore(f: RankableFile, query: string, lineRev?: string | null): number {
  const q = norm(query);
  if (!q) return 0;
  const base = norm(f.name.replace(/\.[^.]+$/, ""));
  let score = 0;
  if (base === q) score = 100;
  else if (base.startsWith(q)) score = 80;
  else if (base.includes(q)) score = 60;
  else return 0;
  const rev = (lineRev ?? "").trim().toUpperCase();
  if (rev && f.rev_from_name === rev) score += 15;
  if (/\.pdf$/i.test(f.name)) score += 5;
  return score;
}

export function rankPlans<T extends RankableFile>(
  files: T[],
  query: string,
  lineRev?: string | null,
): Array<T & { score: number }> {
  return files
    .filter((f) => isPlanFile(f.name))
    .map((f) => ({ ...f, score: planScore(f, query, lineRev) }))
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function folderLabel(pathDisplay: string): string {
  const parts = pathDisplay.split("/").filter(Boolean);
  parts.pop();
  return parts.slice(-2).join(" › ") || "Raíz";
}
