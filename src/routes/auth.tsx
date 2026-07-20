import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useServerFn } from "@tanstack/react-start";
import { claimAdminIfEligible } from "@/lib/admin-users.functions";
import { Activity, Info, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in · MEGO" },
      { name: "description", content: "Sign in to the MEGO On-Time Delivery Hub." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const claimAdmin = useServerFn(claimAdminIfEligible);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data, error }) => {
      if (!error && data.user) {
        claimAdmin({}).catch(() => {});
        navigate({ to: "/purchase-orders" });
      }
    });
  }, [navigate, claimAdmin]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setSubmitting(false);
    if (error) {
      toast.error("Sign-in failed", { description: error.message });
      return;
    }
    await claimAdmin({}).catch(() => {});
    navigate({ to: "/purchase-orders" });
  };

  const handleForgotPassword = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail) {
      toast.error("Enter your email above first.");
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
      description: `Check ${cleanEmail} for a link to reset your password.`,
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Toaster theme="dark" position="top-right" />
      <div className="w-full max-w-sm space-y-5 rounded-lg border bg-card p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded bg-primary/10 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">MEGO OTD Hub</h1>
            <p className="text-xs text-muted-foreground">On-Time Delivery Hub</p>
          </div>
        </div>
        <div className="rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
          <div className="mb-1 flex items-center gap-1.5 font-medium text-foreground">
            <Info className="h-3.5 w-3.5" />
            Live app access
          </div>
          <p>
            Use <span className="font-mono text-foreground">https://mego-produccion.lovable.app</span>. If you already set a password, sign in here instead of reusing the invite link.
          </p>
        </div>
        <form onSubmit={handleSignIn} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="si-email">Email</Label>
            <Input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="si-password">Password</Label>
              <button
                type="button"
                onClick={handleForgotPassword}
                disabled={resetting}
                className="text-[11px] text-primary hover:underline disabled:opacity-50"
              >
                {resetting ? "Sending…" : "Forgot password?"}
              </button>
            </div>
            <Input id="si-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Sign in
          </Button>
        </form>
        <p className="text-[11px] text-muted-foreground text-center">
          Access is invite-only. Contact your administrator if you need an account.
        </p>
      </div>
    </div>
  );
}