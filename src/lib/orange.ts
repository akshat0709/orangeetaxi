import { supabase } from "@/integrations/supabase/client";

export type VehicleCategory = {
  id: string;
  code: string;
  name: string;
  tagline: string;
  seats: number;
  base_fare: number;
  per_km: number;
  minimum_fare: number;
  is_active: boolean;
  sort_order: number;
};

export type ServiceArea = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  is_airport: boolean;
  is_active: boolean;
  sort_order: number;
};

export type PricingSettings = {
  id: number;
  waiting_charge_per_min: number;
  waiting_free_minutes: number;
  cancellation_charge: number;
  surge_enabled: boolean;
  surge_multiplier: number;
  tax_percent: number;
  platform_fee: number;
  currency: string;
  demo_note: string;
};

export type Booking = {
  id: string;
  reference: string;
  customer_id: string;
  driver_id: string | null;
  pickup_area: string;
  pickup_address: string;
  drop_area: string;
  drop_address: string;
  distance_km: number;
  duration_min: number;
  vehicle_code: string;
  vehicle_name: string;
  base_fare: number;
  distance_fare: number;
  tax_amount: number;
  estimated_fare: number;
  final_fare: number | null;
  status: string;
  payment_method: string;
  payment_status: string;
  scheduled_at: string | null;
  cancel_reason: string;
  rating: number | null;
  review: string;
  sos_raised: boolean;
  created_at: string;
};

export const RIDE_FLOW = [
  "searching",
  "assigned",
  "arriving",
  "arrived",
  "in_progress",
  "completed",
] as const;

export const STATUS_LABEL: Record<string, string> = {
  searching: "Finding a driver",
  assigned: "Driver assigned",
  arriving: "Driver on the way",
  arrived: "Driver has arrived",
  in_progress: "Ride in progress",
  completed: "Ride completed",
  cancelled: "Cancelled",
};

export function inr(value: number) {
  return "\u20b9" + Math.round(value).toLocaleString("en-IN");
}

function toRad(deg: number) {
  return (deg * Math.PI) / 180;
}

/** Straight-line distance with a road factor — demo estimation, not live navigation. */
export function estimateDistanceKm(a: ServiceArea, b: ServiceArea) {
  const R = 6371;
  const dLat = toRad(Number(b.lat) - Number(a.lat));
  const dLng = toRad(Number(b.lng) - Number(a.lng));
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(Number(a.lat))) * Math.cos(toRad(Number(b.lat))) * Math.sin(dLng / 2) ** 2;
  const straight = 2 * R * Math.asin(Math.sqrt(h));
  return Math.max(2.5, Math.round(straight * 1.35 * 10) / 10);
}

export function estimateDurationMin(km: number) {
  return Math.max(8, Math.round((km / 22) * 60) + 4);
}

export function quoteFare(cat: VehicleCategory, km: number, settings: PricingSettings) {
  const surge = settings.surge_enabled ? Number(settings.surge_multiplier) || 1 : 1;
  const base = Number(cat.base_fare);
  const distance = Number(cat.per_km) * km;
  const raw = Math.max(Number(cat.minimum_fare), base + distance) * surge;
  const subtotal = raw + Number(settings.platform_fee);
  const tax = (subtotal * Number(settings.tax_percent)) / 100;
  return {
    base,
    distanceFare: Math.round(distance),
    subtotal: Math.round(subtotal),
    tax: Math.round(tax),
    total: Math.round(subtotal + tax),
  };
}

export async function fetchConfig() {
  const [cats, areas, settings] = await Promise.all([
    supabase.from("vehicle_categories").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("service_areas").select("*").eq("is_active", true).order("sort_order"),
    supabase.from("pricing_settings").select("*").eq("id", 1).maybeSingle(),
  ]);
  return {
    categories: (cats.data ?? []) as unknown as VehicleCategory[],
    areas: (areas.data ?? []) as unknown as ServiceArea[],
    settings: settings.data as unknown as PricingSettings,
  };
}
