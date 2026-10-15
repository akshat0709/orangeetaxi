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

// Module-level singleton state across the entire browser app lifecycle
let globalUser: User | null = null;
let globalRole: AppRole = null;
let globalLoading = true;
let isInitialized = false;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((fn) => fn());
}

// Synchronously rehydrate from localStorage on first import if available
if (typeof window !== "undefined") {
  try {
    const cached = localStorage.getItem("orange_auth_cache");
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.user) {
        globalUser = parsed.user;
        globalRole = parsed.role ?? "customer";
        globalLoading = false;
      }
    }
  } catch {}
}

async function fetchRole(userId: string, email?: string): Promise<AppRole> {
  // Hardcode admin access for the owner's email
  if (email === "orangeetaxi@gmail.com") return "admin";

  try {
    // Priority: admin > driver > customer
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", userId);

    let determinedRole: AppRole = "customer";

    if (data && data.length > 0) {
      const roles = data.map((r) => r.role);
      if (roles.includes("admin")) determinedRole = "admin";
      else if (roles.includes("driver")) determinedRole = "driver";
    }

    // Fallback: If roles table was wiped, check if they exist in the drivers table
    if (determinedRole === "customer") {
      const { data: driverData } = await supabase
        .from("drivers")
        .select("id")
        .eq("user_id", userId)
        .maybeSingle();
      if (driverData) {
        determinedRole = "driver";
      }
    }

    return determinedRole;
  } catch (err) {
    console.warn("fetchRole notice:", err);
    return "customer";
  }
}

function initGlobalAuth() {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;

  // Single initial session check
  supabase.auth.getSession().then(async ({ data: { session } }) => {
    globalUser = session?.user ?? null;
    if (session?.user) {
      globalRole = await fetchRole(session.user.id, session.user.email);
    } else {
      globalRole = null;
    }
    globalLoading = false;

    try {
      if (globalUser) {
        localStorage.setItem(
          "orange_auth_cache",
          JSON.stringify({ user: globalUser, role: globalRole }),
        );
      } else {
        localStorage.removeItem("orange_auth_cache");
      }
    } catch {}

    notify();
  });

  // Real-time auth subscription
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
        window.location.href = `/login?mode=reset${window.location.hash || ""}`;
      }
    }

    globalUser = session?.user ?? null;
    if (session?.user) {
      globalRole = await fetchRole(session.user.id, session.user.email);
    } else {
      globalRole = null;
    }
    globalLoading = false;

    try {
      if (globalUser) {
        localStorage.setItem(
          "orange_auth_cache",
          JSON.stringify({ user: globalUser, role: globalRole }),
        );
      } else {
        localStorage.removeItem("orange_auth_cache");
      }
    } catch {}

    notify();
  });
}

export function useAuth(): AuthState {
  if (typeof window !== "undefined") {
    initGlobalAuth();
  }

  const [, setTick] = useState(0);

  useEffect(() => {
    const update = () => setTick((t) => t + 1);
    listeners.add(update);
    return () => {
      listeners.delete(update);
    };
  }, []);

  const signOut = async () => {
    globalUser = null;
    globalRole = null;
    globalLoading = false;
    try {
      localStorage.removeItem("orange_auth_cache");
    } catch {}
    notify();
    await supabase.auth.signOut();
  };

  return {
    user: globalUser,
    role: globalRole,
    loading: globalLoading,
    signOut,
  };
}
