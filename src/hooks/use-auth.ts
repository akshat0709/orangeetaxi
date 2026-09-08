import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "admin" | "driver" | "customer" | null;

export interface AuthState {
  user: User | null;
  role: AppRole;
  loading: boolean;
  signOut: () => Promise<void>;
}

async function fetchRole(userId: string, email?: string): Promise<AppRole> {
  // Hardcode admin access for the owner's email
  if (email === "orangeetaxi@gmail.com") return "admin";

  // Priority: admin > driver > customer
  const { data } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);

  if (!data || data.length === 0) return "customer";
  const roles = data.map((r) => r.role);
  if (roles.includes("admin")) return "admin";
  if (roles.includes("driver")) return "driver";
  return "customer";
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const r = await fetchRole(session.user.id, session.user.email);
        setRole(r);
      }
      setLoading(false);
    });

    // Subscribe to auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const r = await fetchRole(session.user.id, session.user.email);
        setRole(r);
      } else {
        setRole(null);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { user, role, loading, signOut };
}
