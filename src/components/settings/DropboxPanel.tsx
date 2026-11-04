import { useCallback, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Copy,
  ExternalLink,
  Folder,
  Loader2,
  PlugZap,
  RefreshCw,
  Unplug,
  X,
} from "lucide-react";
import {
  getDropboxStatus,
  startDropboxOAuth,
  disconnectDropbox,
  testDropboxConnection,
  setDropboxRootFolder,
  listDropboxFolder,
} from "@/lib/dropbox.functions";

const POLL_MS = 2500;
const POLL_TIMEOUT_MS = 10 * 60 * 1000;

export function DropboxPanel() {
  const statusFn = useServerFn(getDropboxStatus);
  const startFn = useServerFn(startDropboxOAuth);
  const disconnectFn = useServerFn(disconnectDropbox);
  const testFn = useServerFn(testDropboxConnection);
  const rootFn = useServerFn(setDropboxRootFolder);
  const listFn = useServerFn(listDropboxFolder);

  const [busy, setBusy] = useState(false);
  const [root, setRoot] = useState<string | null>(null);
  const [folders, setFolders] = useState<{ name: string; path_lower: string }[] | null>(
    null,
  );
  const [waiting, setWaiting] = useState(false);
  const [blockedUrl, setBlockedUrl] = useState<string | null>(null);

  const pollRef = useRef<number | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dropbox_status"],
    queryFn: () => statusFn({}),
  });

  const rootValue = root ?? data?.rootFolder ?? "";

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
    setWaiting(false);
  }, []);

  useEffect(() => stopPolling, [stopPolling]);

  const startPolling = useCallback(() => {
    stopPolling();
    setWaiting(true);
    const startedAt = Date.now();
    pollRef.current = window.setInterval(async () => {
      try {
        const status = await statusFn({});
        if (status.connected) {
          stopPolling();
          await refetch();
          toast.success("Dropbox conectado correctamente");
          return;
        }
      } catch {
        // Transient status failure: keep waiting for the tab to finish.
      }
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) stopPolling();
    }, POLL_MS);
  }, [refetch, statusFn, stopPolling]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    try {
      await fn();
      if (ok) toast.success(ok);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    setBlockedUrl(null);
    try {
      const { url } = await startFn({});
      const tab = window.open(url, "_blank");
      if (!tab) {
        setBlockedUrl(url);
        toast.error(
          "El navegador bloqueó la pestaña nueva. Abre el enlace que aparece abajo.",
        );
        return;
      }
      // Sever the opener link so the external page can't touch this tab.
      try {
        tab.opener = null;
      } catch {
        /* cross-origin assignment is not always permitted */
      }
      startPolling();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading) return <div className="text-sm text-muted-foreground">Cargando…</div>;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            Dropbox
            {data?.connected ? (
              <Badge className="bg-emerald-500/20 text-emerald-300">Conectado</Badge>
            ) : (
              <Badge variant="outline">Sin conectar</Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!data?.hasKeys && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
              Faltan las credenciales de la app de Dropbox (DROPBOX_APP_KEY /
              DROPBOX_APP_SECRET). Agrégalas antes de conectar.
            </div>
          )}

          {data?.connected && (
            <div className="text-xs text-muted-foreground">
              Cuenta: {data.accountName ?? "—"}{" "}
              {data.accountEmail ? `· ${data.accountEmail}` : ""}
              {data.connectedAt
                ? ` · desde ${new Date(data.connectedAt).toLocaleDateString()}`
                : ""}
            </div>
          )}

          {waiting && (
            <div className="flex flex-wrap items-center gap-2 rounded-md border border-sky-500/40 bg-sky-500/10 p-2 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-sky-300" />
              <span>
                Autoriza Dropbox en la pestaña nueva. Esta pantalla se actualiza sola al
                terminar.
              </span>
              <Button
                size="sm"
                variant="outline"
                className="ml-auto h-6 text-xs"
                onClick={() => run(() => refetch())}
              >
                Ya conecté
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-6 text-xs"
                onClick={stopPolling}
              >
                <X className="h-3 w-3 mr-1" /> Cancelar
              </Button>
            </div>
          )}

          {blockedUrl && (
            <div className="space-y-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs">
              <p>El navegador bloqueó la pestaña nueva. Abre el enlace manualmente:</p>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    window.open(blockedUrl, "_blank");
                    startPolling();
                  }}
                >
                  <ExternalLink className="h-3.5 w-3.5 mr-1" /> Abrir enlace de Dropbox
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(blockedUrl);
                      toast.success("Enlace copiado");
                    } catch {
                      toast.error("No se pudo copiar el enlace");
                    }
                  }}
                >
                  <Copy className="h-3.5 w-3.5 mr-1" /> Copiar enlace
                </Button>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || !data?.hasKeys || waiting}
              onClick={connect}
            >
              {waiting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />
              ) : (
                <PlugZap className="h-3.5 w-3.5 mr-1" />
              )}
              {data?.connected ? "Reconectar" : "Conectar Dropbox"}
            </Button>
            {data?.connected && (
              <>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(() => testFn({}), "Conexión verificada con Dropbox")
                  }
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-1" /> Probar conexión
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={busy}
                  onClick={() => run(() => disconnectFn({}), "Dropbox desconectado")}
                >
                  <Unplug className="h-3.5 w-3.5 mr-1" /> Desconectar
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Carpeta raíz de planos</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <p className="text-xs text-muted-foreground">
            Limita las búsquedas de planos a esta carpeta. Déjala vacía para buscar
            en todo el Dropbox. Ejemplo:{" "}
            <code className="font-mono">/Ingeniería/Planos</code>
          </p>
          <div className="flex gap-2">
            <Input
              value={rootValue}
              placeholder="/Ingeniería/Planos"
              onChange={(e) => setRoot(e.target.value)}
            />
            <Button
              size="sm"
              disabled={busy}
              onClick={() =>
                run(
                  () => rootFn({ data: { rootFolder: rootValue } }),
                  "Carpeta raíz guardada",
                )
              }
            >
              Guardar
            </Button>
          </div>
          {data?.connected && (
            <div className="space-y-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const res = await listFn({ data: { path: rootValue } });
                    setFolders(res.folders);
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Error");
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                <Folder className="h-3.5 w-3.5 mr-1" /> Ver subcarpetas
              </Button>
              {folders && folders.length === 0 && (
                <p className="text-xs text-muted-foreground">Sin subcarpetas.</p>
              )}
              {folders && folders.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {folders.map((f) => (
                    <Button
                      key={f.path_lower}
                      size="sm"
                      variant="outline"
                      className="font-mono text-xs"
                      onClick={() => setRoot(f.path_lower)}
                    >
                      {f.name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
