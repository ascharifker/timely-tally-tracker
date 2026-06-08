import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AppRole =
  | "admin"
  | "manager"
  | "po_editor"
  | "coe_reviewer"
  | "third_party_reviewer"
  | "production_editor"
  | "viewer";

export interface AuthState {
  userId: string | null;
  email: string | null;
  roles: AppRole[];
  loading: boolean;
}

export function useAuthSession() {
  const [session, setSession] = useState<{ userId: string; email: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const qc = useQueryClient();

  useEffect(() => {
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      const u = data.session?.user;
      setSession(u ? { userId: u.id, email: u.email ?? null } : null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      const u = s?.user;
      setSession(u ? { userId: u.id, email: u.email ?? null } : null);
      if (event === "SIGNED_OUT" || event === "SIGNED_IN") {
        qc.invalidateQueries({ queryKey: ["user_roles"] });
      }
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [qc]);

  return { session, loading };
}

export function useUserRoles(userId: string | null) {
  return useQuery({
    queryKey: ["user_roles", userId],
    enabled: !!userId,
    queryFn: async (): Promise<AppRole[]> => {
      if (!userId) return [];
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      if (error) throw error;
      return (data ?? []).map((r) => r.role as AppRole);
    },
  });
}

export function useAuth(): AuthState {
  const { session, loading } = useAuthSession();
  const { data: roles = [], isLoading: rolesLoading } = useUserRoles(session?.userId ?? null);
  return {
    userId: session?.userId ?? null,
    email: session?.email ?? null,
    roles,
    loading: loading || (!!session && rolesLoading),
  };
}