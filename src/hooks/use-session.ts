import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type Roles = { admin: boolean; driver: boolean; customer: boolean };

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<Roles>({ admin: false, driver: false, customer: false });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadRoles = async (userId: string | undefined) => {
      if (!userId) {
        if (active) setRoles({ admin: false, driver: false, customer: false });
        return;
      }
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);
      if (!active) return;
      const list = (data ?? []).map((r) => r.role as string);
      setRoles({
        admin: list.includes("admin"),
        driver: list.includes("driver"),
        customer: list.includes("customer"),
      });
    };

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void loadRoles(next?.user?.id);
    });

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      void loadRoles(data.session?.user?.id).finally(() => active && setLoading(false));
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, roles, loading };
}
