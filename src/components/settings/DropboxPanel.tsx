import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Folder, PlugZap, RefreshCw, Unplug } from "lucide-react";
import {
  getDropboxStatus,
  startDropboxOAuth,
  disconnectDropbox,
  testDropboxConnection,
  setDropboxRootFolder,
  listDropboxFolder,
} from "@/lib/dropbox.functions";

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

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["dropbox_status"],
    queryFn: () => statusFn({}),
  });

  const rootValue = root ?? data?.rootFolder ?? "";

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

          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              disabled={busy || !data?.hasKeys}
              onClick={async () => {
                setBusy(true);
                try {
                  const { url } = await startFn({});
                  window.location.href = url;
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Error");
                  setBusy(false);
                }
              }}
            >
              <PlugZap className="h-3.5 w-3.5 mr-1" />
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