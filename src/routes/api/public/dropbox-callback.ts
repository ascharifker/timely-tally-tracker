import { createFileRoute } from "@tanstack/react-router";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const PAGE_STYLE = `
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body {
    margin: 0; min-height: 100vh; display: grid; place-items: center;
    background: #0b0f14; color: #e6edf3;
    font: 15px/1.5 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
    padding: 24px;
  }
  .card {
    max-width: 460px; width: 100%; text-align: center;
    border: 1px solid rgba(255,255,255,.12); border-radius: 14px;
    background: rgba(255,255,255,.04); padding: 32px 28px;
  }
  .icon { width: 46px; height: 46px; margin: 0 auto 14px; display: block; }
  h1 { font-size: 19px; margin: 0 0 8px; }
  p { margin: 0 0 6px; color: #a9b6c2; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 12px; }
  a { color: #7cc4ff; }
  .hint { margin-top: 18px; font-size: 12px; color: #7c8a97; }
`;

const CLOSE_SCRIPT = `
  <script>
    setTimeout(function () {
      try { window.close(); } catch (e) {}
    }, 1200);
  </script>
`;

function page(title: string, body: string): Response {
  const html = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex" />
<title>${escapeHtml(title)}</title>
<style>${PAGE_STYLE}</style>
</head>
<body>
<div class="card">${body}</div>
${CLOSE_SCRIPT}
</body>
</html>`;
  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Robots-Tag": "noindex",
    },
  });
}

const CHECK_ICON = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke-opacity=".35"/><path d="m8.5 12.5 2.5 2.5 5-5.5"/></svg>`;

const ALERT_ICON = `<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10" stroke-opacity=".35"/><path d="M12 8v5"/><path d="M12 16.5h.01"/></svg>`;

export const Route = createFileRoute("/api/public/dropbox-callback")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const origin = url.origin;
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const denied = url.searchParams.get("error");

        if (denied) {
          return page(
            "Dropbox no conectado",
            `${ALERT_ICON}
             <h1>Autorización cancelada</h1>
             <p>Dropbox devolvió: <code>${escapeHtml(denied)}</code></p>
             <p class="hint">Vuelve a la app y pulsa «Conectar Dropbox» otra vez.</p>`,
          );
        }
        if (!code || !state) {
          return page(
            "Dropbox no conectado",
            `${ALERT_ICON}
             <h1>Enlace incompleto</h1>
             <p>Falta el código de autorización.</p>
             <p class="hint">Vuelve a la app y pulsa «Conectar Dropbox» otra vez.</p>`,
          );
        }

        try {
          const {
            verifyState,
            exchangeCode,
            writeConfig,
            resetTokenCache,
            getCurrentAccount,
          } = await import("@/lib/dropbox.server");

          // Signed state is the security boundary for this unauthenticated route.
          const { userId } = verifyState(state);
          const refreshToken = await exchangeCode(code);

          await writeConfig({
            refresh_token: refreshToken,
            connected_at: new Date().toISOString(),
            connected_by: userId,
          });
          resetTokenCache();

          let accountLine = "";
          try {
            const account = await getCurrentAccount();
            await writeConfig({
              account_name: account.name,
              account_email: account.email,
            });
            accountLine = `<p>${escapeHtml(account.name)}${
              account.email ? ` · ${escapeHtml(account.email)}` : ""
            }</p>`;
          } catch (e) {
            console.error("Dropbox account lookup failed after connect", e);
          }

          return page(
            "Dropbox conectado",
            `${CHECK_ICON}
             <h1>Dropbox conectado</h1>
             ${accountLine}
             <p>Puedes cerrar esta pestaña: la app se actualiza sola.</p>
             <p class="hint"><a href="${escapeHtml(origin)}/settings?tab=dropbox">Abrir Ajustes</a></p>`,
          );
        } catch (e) {
          console.error("Dropbox callback failed", e);
          return page(
            "Dropbox no conectado",
            `${ALERT_ICON}
             <h1>No se pudo completar la conexión</h1>
             <p>${escapeHtml(e instanceof Error ? e.message : "Error desconocido")}</p>
             <p class="hint">Vuelve a la app y pulsa «Conectar Dropbox» otra vez.</p>`,
          );
        }
      },
    },
  },
});
