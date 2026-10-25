// Live pricing hooks. The fare formula itself lives in ./fare.ts (no imports, unit-tested).
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_PRICING,
  normalizePricing,
  type PricingSettings,
  type VehicleCategoryRow,
} from "./fare";

export * from "./fare";

const CACHE_KEY = "orange_cached_pricing_v2";

/** Live pricing settings (cached per browser for a fast first paint). */
export function usePricingSettings() {
  const [settings, setSettings] = useState<PricingSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_PRICING;
    try {
      const c = localStorage.getItem(CACHE_KEY);
      if (c) return normalizePricing(JSON.parse(c));
    } catch {
      // cache is optional
    }
    return DEFAULT_PRICING;
  });

  useEffect(() => {
    let alive = true;
    supabase
      .from("pricing_settings")
      .select("*")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }) => {
        if (!alive || !data) return;
        const next = normalizePricing(data);
        setSettings(next);
        try {
          localStorage.setItem(CACHE_KEY, JSON.stringify(next));
        } catch {
          // cache is optional
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return settings;
}

/** Active vehicle categories with their admin-set tariffs. */
export function useVehicleCategories() {
  const [rows, setRows] = useState<VehicleCategoryRow[]>([]);
  useEffect(() => {
    let alive = true;
    supabase
      .from("vehicle_categories")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (alive && data) setRows(data as unknown as VehicleCategoryRow[]);
      });
    return () => {
      alive = false;
    };
  }, []);
  return rows;
}
