import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Set password · MEGO" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[reset-password] auth event", event, !!session);
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        setReady(true);
      }
    });

    const tryFromHash = async () => {
      // Supabase normally auto-parses the hash, but if anything strips it
      // (router, history replace), manually call setSession.
      const hash = window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash;
      const params = new URLSearchParams(hash);
      const access_token = params.get("access_token");
      const refresh_token = params.get("refresh_token");
      const errorDesc = params.get("error_description");
      if (errorDesc) {
        toast.error("Invalid or expired link", { description: errorDesc });
        return false;
      }
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) {
          toast.error("Could not validate link", { description: error.message });
          return false;
        }
        if (!cancelled) setReady(true);
        return true;
      }
      return false;
    };

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (!cancelled) setReady(true);
        return;
      }
      const ok = await tryFromHash();
      if (ok) return;
      // Last resort: poll briefly for the SDK to finish auto-detect.
      for (let i = 0; i < 10 && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 200));
        const { data: d2 } = await supabase.auth.getSession();
        if (d2.session) {
          if (!cancelled) setReady(true);
          return;
        }
      }
    })();

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords do not match.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSubmitting(false);
    if (error) {
      toast.error("Could not set password", { description: error.message });
      return;
    }
    toast.success("Password set. Signing you in…");
    navigate({ to: "/purchase-orders" });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Toaster theme="dark" position="top-right" />
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-5 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-primary/10 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Set your password</h1>
            <p className="text-xs text-muted-foreground">Welcome to MEGO OTD Hub</p>
          </div>
        </div>
        {!ready ? (
          <p className="text-sm text-muted-foreground">Validating link…</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm password</Label>
              <Input id="confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
            <Button type="submit" className="w-full" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set password
            </Button>
          </>
        )}
      </form>
    </div>
  );
}