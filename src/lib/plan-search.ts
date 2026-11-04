// Client-safe ranking for Dropbox design-plan search results.
export const PLAN_EXTENSIONS = [
  "pdf", "dwg", "dxf", "png", "jpg", "jpeg", "tif", "tiff",
  "doc", "docx", "xls", "xlsx", "zip",
];

export interface RankableFile {
  name: string;
  path_display: string;
  rev_from_name: string | null;
  is_folder?: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** Split "103216693 Rev-A" into ["103216693", "a"] — like Dropbox's word search. */
export function queryTokens(query: string): string[] {
  return query
    .toLowerCase()
    .replace(/\brev(ision)?[\s._-]*/g, " ")
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

export function isPlanFile(name: string, isFolder = false): boolean {
  if (isFolder) return true;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return PLAN_EXTENSIONS.includes(ext);
}

/** Higher = better. 0 means the query does not match name or folder. */
export function planScore(f: RankableFile, query: string, lineRev?: string | null): number {
  const q = norm(query);
  const tokens = queryTokens(query);
  if (!q || tokens.length === 0) return 0;
  const base = norm(f.name.replace(/\.[^.]+$/, ""));
  const nameWords = f.name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const pathWords = f.path_display.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  const has = (words: string[], t: string) =>
    t.length <= 2 ? words.includes(t) : words.some((w) => w.includes(t));
  let score = 0;
  if (base === q) score = 100;
  else if (tokens.every((t) => has(nameWords, t))) score = 80;
  else if (base.includes(q)) score = 70;
  else if (tokens.every((t) => has(pathWords, t))) score = 50;
  else return 0;
  const rev = (lineRev ?? "").trim().toUpperCase();
  if (rev && f.rev_from_name === rev) score += 15;
  if (f.is_folder) score += 3;
  if (/\.pdf$/i.test(f.name)) score += 5;
  return score;
}

export function rankPlans<T extends RankableFile>(
  files: T[],
  query: string,
  lineRev?: string | null,
): Array<T & { score: number }> {
  return files
    .filter((f) => isPlanFile(f.name, f.is_folder))
    .map((f) => ({ ...f, score: planScore(f, query, lineRev) }))
    .filter((f) => f.score > 0)
    .sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
}

export function folderLabel(pathDisplay: string): string {
  const parts = pathDisplay.split("/").filter(Boolean);
  parts.pop();
  return parts.slice(-2).join(" › ") || "Raíz";
}
