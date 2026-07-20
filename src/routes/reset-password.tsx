import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Activity, AlertCircle, Loader2 } from "lucide-react";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Set password · MEGO" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<"validating" | "ready" | "invalid">("validating");
  const [message, setMessage] = useState("This link may already be used or expired.");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN" || event === "INITIAL_SESSION")) {
        setStatus("ready");
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
        if (!cancelled) {
          setMessage(errorDesc);
          setStatus("invalid");
        }
        return false;
      }
      if (access_token && refresh_token) {
        const { error } = await supabase.auth.setSession({ access_token, refresh_token });
        if (error) {
          if (!cancelled) {
            setMessage(error.message);
            setStatus("invalid");
          }
          return false;
        }
        if (!cancelled) setStatus("ready");
        return true;
      }
      return false;
    };

    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        if (!cancelled) setStatus("ready");
        return;
      }
      const ok = await tryFromHash();
      if (ok) return;
      // Last resort: poll briefly for the SDK to finish auto-detect.
      for (let i = 0; i < 10 && !cancelled; i++) {
        await new Promise((r) => setTimeout(r, 200));
        const { data: d2 } = await supabase.auth.getSession();
        if (d2.session) {
          if (!cancelled) setStatus("ready");
          return;
        }
      }
      if (!cancelled) setStatus("invalid");
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

  const requestReset = async () => {
    const cleanEmail = resetEmail.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Enter your email first.");
      return;
    }
    setResetting(true);
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetting(false);
    if (error) {
      toast.error("Could not send reset email", { description: error.message });
      return;
    }
    toast.success("Password reset email sent", {
      description: `Check ${cleanEmail} for a fresh link.`,
    });
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
        {status === "validating" ? (
          <p className="text-sm text-muted-foreground">Validating link…</p>
        ) : status === "invalid" ? (
          <div className="space-y-4">
            <div className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-muted-foreground">
              <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
                <AlertCircle className="h-4 w-4 text-destructive" />
                Link already used or expired
              </div>
              <p>{message}</p>
            </div>
            <Button type="button" className="w-full" onClick={() => navigate({ to: "/auth" })}>
              Go to sign in
            </Button>
            <div className="space-y-2 border-t border-border pt-4">
              <Label htmlFor="reset-email">Need a fresh password reset?</Label>
              <Input
                id="reset-email"
                type="email"
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="name@mego-afek.com"
                autoComplete="email"
              />
              <Button type="button" variant="outline" className="w-full" disabled={resetting} onClick={requestReset}>
                {resetting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send fresh reset email
              </Button>
            </div>
          </div>
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