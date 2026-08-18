import { createFileRoute } from "@tanstack/react-router";

function redirectTo(origin: string, params: Record<string, string>): Response {
  const q = new URLSearchParams({ tab: "dropbox", ...params });
  return new Response(null, {
    status: 302,
    headers: { Location: `${origin}/settings?${q.toString()}` },
  });
}

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
          return redirectTo(origin, { dropbox_error: denied });
        }
        if (!code || !state) {
          return redirectTo(origin, { dropbox_error: "missing_code" });
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

          try {
            const account = await getCurrentAccount();
            await writeConfig({
              account_name: account.name,
              account_email: account.email,
            });
          } catch (e) {
            console.error("Dropbox account lookup failed after connect", e);
          }

          return redirectTo(origin, { dropbox_connected: "1" });
        } catch (e) {
          console.error("Dropbox callback failed", e);
          return redirectTo(origin, {
            dropbox_error: e instanceof Error ? e.message : "unknown_error",
          });
        }
      },
    },
  },
});