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
    const loadVerifiedUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (cancelled) return;
      const u = error ? null : data.user;
      setSession(u ? { userId: u.id, email: u.email ?? null } : null);
      setLoading(false);
    };

    loadVerifiedUser();
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setLoading(false);
      } else if (s && (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "INITIAL_SESSION")) {
        loadVerifiedUser();
      }
      if (event === "SIGNED_OUT" || event === "SIGNED_IN" || event === "USER_UPDATED") {
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