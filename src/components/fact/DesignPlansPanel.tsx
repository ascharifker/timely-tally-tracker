import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ExternalLink,
  Eye,
  Link2,
  Link2Off,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  searchDesignPlans,
  getPlanTemporaryLink,
  attachPlanToLine,
} from "@/lib/dropbox.functions";
import type { PoLineWithContext } from "@/hooks/usePoQueues";

interface PlanFile {
  id: string;
  name: string;
  path_lower: string;
  path_display: string;
  size: number | null;
  server_modified: string | null;
  rev_from_name: string | null;
}

function humanSize(bytes: number | null): string {
  if (!bytes) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i++;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

function isPreviewable(name: string): boolean {
  return /\.(pdf|png|jpe?g|gif|webp)$/i.test(name);
}

export function DesignPlansPanel({
  line,
  canReview,
  onSaved,
}: {
  line: PoLineWithContext;
  canReview: boolean;
  onSaved: () => void;
}) {
  const searchFn = useServerFn(searchDesignPlans);
  const linkFn = useServerFn(getPlanTemporaryLink);
  const attachFn = useServerFn(attachPlanToLine);

  const defaultQuery = line.pir ?? "";
  const [query, setQuery] = useState(defaultQuery);
  const [activeQuery, setActiveQuery] = useState(defaultQuery);
  const [preview, setPreview] = useState<{ name: string; url: string } | null>(null);
  const [working, setWorking] = useState(false);

  useEffect(() => {
    setQuery(line.pir ?? "");
    setActiveQuery(line.pir ?? "");
  }, [line.id, line.pir]);

  const enabled = activeQuery.trim().length >= 2;

  const { data, isFetching, error, refetch } = useQuery({
    queryKey: ["dropbox_plans", activeQuery],
    enabled,
    staleTime: 5 * 60 * 1000,
    queryFn: () => searchFn({ data: { query: activeQuery.trim(), limit: 25 } }),
  });

  const files = useMemo<PlanFile[]>(
    () => (data?.files ?? []) as PlanFile[],
    [data],
  );
  const connected = data?.connected ?? true;

  const openFile = async (path: string, mode: "tab" | "preview", name: string) => {
    setWorking(true);
    try {
      const { url } = await linkFn({ data: { path } });
      if (mode === "tab") window.open(url, "_blank", "noopener");
      else setPreview({ name, url });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo abrir el archivo");
    } finally {
      setWorking(false);
    }
  };

  const attach = async (f: PlanFile | null) => {
    setWorking(true);
    try {
      await attachFn({
        data: {
          poLineItemId: line.id,
          path: f ? f.path_lower : null,
          name: f ? f.name : null,
          rev: f ? f.rev_from_name : null,
        },
      });
      toast.success(f ? "Plano adjuntado a la línea" : "Plano desvinculado");
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setWorking(false);
    }
  };

  const lineRev = (line.pir_rev ?? "").trim().toUpperCase();

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-sm font-semibold">Planos (Dropbox)</h3>
        <p className="text-xs text-muted-foreground">
          Busca el plano de diseño por PIR, revisión o número de dibujo sin salir
          de la plataforma.
        </p>
      </div>

      {line.plan_dropbox_path && (
        <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-2 text-xs space-y-2">
          <div className="flex items-center gap-2">
            <Link2 className="h-3.5 w-3.5 text-emerald-300" />
            <span className="font-mono truncate">{line.plan_dropbox_name}</span>
            {line.plan_dropbox_rev && (
              <Badge variant="outline">REV {line.plan_dropbox_rev}</Badge>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="secondary"
              disabled={working}
              onClick={() =>
                openFile(line.plan_dropbox_path!, "tab", line.plan_dropbox_name ?? "")
              }
            >
              Abrir plano adjunto <ExternalLink className="h-3.5 w-3.5 ml-1" />
            </Button>
            {canReview && (
              <Button
                size="sm"
                variant="ghost"
                disabled={working}
                onClick={() => attach(null)}
              >
                <Link2Off className="h-3.5 w-3.5 mr-1" /> Quitar
              </Button>
            )}
          </div>
        </div>
      )}

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          setActiveQuery(query);
        }}
      >
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="PIR, dibujo o texto libre"
        />
        <Button type="submit" size="sm" variant="secondary" disabled={isFetching}>
          <Search className="h-3.5 w-3.5" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          disabled={!enabled || isFetching}
          onClick={() => refetch()}
          title="Volver a buscar"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </Button>
      </form>

      {!connected && (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          Dropbox no está conectado. Un administrador puede conectarlo en Settings
          → Dropbox.
        </div>
      )}

      {error && (
        <div className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs">
          {error instanceof Error ? error.message : "Error al buscar en Dropbox"}
        </div>
      )}

      {!enabled && (
        <p className="text-xs text-muted-foreground">
          Escribe al menos 2 caracteres para buscar.
        </p>
      )}

      {enabled && isFetching && (
        <p className="text-xs text-muted-foreground">Buscando en Dropbox…</p>
      )}

      {enabled && !isFetching && connected && files.length === 0 && !error && (
        <p className="text-xs text-muted-foreground">
          Sin resultados para “{activeQuery}”.
        </p>
      )}

      <div className="space-y-2">
        {files.map((f) => {
          const mismatch =
            !!lineRev && !!f.rev_from_name && f.rev_from_name !== lineRev;
          return (
            <div key={f.id} className="rounded-md border p-2 text-xs space-y-1">
              <div className="flex items-start gap-2">
                <span className="font-mono break-all">{f.name}</span>
                {f.rev_from_name && (
                  <Badge variant="outline" className="shrink-0">
                    REV {f.rev_from_name}
                  </Badge>
                )}
              </div>
              <div className="text-muted-foreground break-all">{f.path_display}</div>
              <div className="text-muted-foreground">
                {humanSize(f.size)}
                {f.server_modified
                  ? ` · ${new Date(f.server_modified).toLocaleDateString()}`
                  : ""}
              </div>
              {mismatch && (
                <div className="text-amber-300">
                  Dropbox tiene REV {f.rev_from_name} — la línea dice REV {lineRev}
                </div>
              )}
              <div className="flex flex-wrap gap-1 pt-1">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={working}
                  onClick={() => openFile(f.path_lower, "tab", f.name)}
                >
                  Abrir <ExternalLink className="h-3.5 w-3.5 ml-1" />
                </Button>
                {isPreviewable(f.name) && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={working}
                    onClick={() => openFile(f.path_lower, "preview", f.name)}
                  >
                    <Eye className="h-3.5 w-3.5 mr-1" /> Vista previa
                  </Button>
                )}
                {canReview && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={working || line.plan_dropbox_path === f.path_lower}
                    onClick={() => attach(f)}
                  >
                    <Link2 className="h-3.5 w-3.5 mr-1" />
                    {line.plan_dropbox_path === f.path_lower
                      ? "Adjuntado"
                      : "Adjuntar a la línea"}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle className="font-mono text-sm break-all">
              {preview?.name}
            </DialogTitle>
          </DialogHeader>
          {preview && (
            <iframe
              src={preview.url}
              title={preview.name}
              className="h-[70vh] w-full rounded-md border bg-background"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}