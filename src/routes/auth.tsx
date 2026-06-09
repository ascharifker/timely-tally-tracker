import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Toaster, toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useServerFn } from "@tanstack/react-start";
import { claimAdminIfEligible } from "@/lib/admin-users.functions";
import { Activity, Loader2 } from "lucide-react";

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
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verifySent, setVerifySent] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
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

  const handleSignUp = async (e: React.FormEvent) => {
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
    const cleanEmail = email.trim().toLowerCase();
    const { data, error } = await supabase.auth.signUp({
      email: cleanEmail,
      password,
      options: { emailRedirectTo: `${window.location.origin}/reset-password` },
    });
    setSubmitting(false);
    if (error) {
      toast.error("Sign-up failed", { description: error.message });
      return;
    }
    if (data.session) {
      // Auto-confirm was on (shouldn't be); jump straight in.
      await claimAdmin({}).catch(() => {});
      navigate({ to: "/purchase-orders" });
      return;
    }
    setVerifySent(cleanEmail);
  };

  if (verifySent) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Toaster theme="dark" position="top-right" />
        <div className="w-full max-w-sm space-y-4 rounded-lg border bg-card p-6 shadow-sm text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded bg-primary/10 text-primary">
            <Activity className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">Check your inbox</h1>
          <p className="text-sm text-muted-foreground">
            We sent a verification link to <span className="font-medium text-foreground">{verifySent}</span>.
            Click it to finish creating your account.
          </p>
          <Button variant="outline" className="w-full" onClick={() => { setVerifySent(null); setMode("signin"); }}>
            Back to sign in
          </Button>
        </div>
      </div>
    );
  }

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
        <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")} className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" className="pt-4">
            <form onSubmit={handleSignIn} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="si-email">Email</Label>
                <Input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="si-password">Password</Label>
                <Input id="si-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </form>
          </TabsContent>
          <TabsContent value="signup" className="pt-4">
            <form onSubmit={handleSignUp} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="su-email">Email</Label>
                <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-password">Password</Label>
                <Input id="su-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="su-confirm">Confirm password</Label>
                <Input id="su-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={8} autoComplete="new-password" />
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create account
              </Button>
              <p className="text-[11px] text-muted-foreground text-center">
                We'll send a verification link to your email.
              </p>
            </form>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}