// Prices come from the admin Pricing tab (pricing_settings + vehicle_categories).
// The server re-computes the same formula in public.fn_fare_quote() and never accepts less,
// so keep this function and that SQL function in step.

export interface PricingSettings {
  tax_percent: number;
  platform_fee: number;
  surge_enabled: boolean;
  surge_multiplier: number;
  cancellation_charge: number;
  cancellation_free_minutes: number;
  cancellation_free_km: number;
  cancellation_stuck_minutes: number;
  cancellation_stuck_km: number;
  partner_commission_percent: number;
  waiting_charge_per_min: number;
  waiting_free_minutes: number;
}

export interface VehicleTariff {
  base_fare: number;
  per_km: number;
  minimum_fare: number;
}

// Used only until the live settings load (and if they can't be read).
export const DEFAULT_PRICING: PricingSettings = {
  tax_percent: 5,
  platform_fee: 0,
  surge_enabled: false,
  surge_multiplier: 1,
  cancellation_charge: 50,
  cancellation_free_minutes: 3,
  cancellation_free_km: 1.5,
  cancellation_stuck_minutes: 5,
  cancellation_stuck_km: 0.5,
  partner_commission_percent: 15,
  waiting_charge_per_min: 2,
  waiting_free_minutes: 3,
};

const num = (v: unknown, fallback: number) => {
  const n = Number(v);
  return v !== null && v !== undefined && v !== "" && Number.isFinite(n) ? n : fallback;
};

export function normalizePricing(input: object | null | undefined): PricingSettings {
  if (!input) return DEFAULT_PRICING;
  const row = input as Partial<Record<keyof PricingSettings, unknown>>;
  const d = DEFAULT_PRICING;
  return {
    tax_percent: num(row.tax_percent, d.tax_percent),
    platform_fee: num(row.platform_fee, d.platform_fee),
    surge_enabled: row.surge_enabled === true,
    surge_multiplier: num(row.surge_multiplier, d.surge_multiplier),
    cancellation_charge: num(row.cancellation_charge, d.cancellation_charge),
    cancellation_free_minutes: num(row.cancellation_free_minutes, d.cancellation_free_minutes),
    cancellation_free_km: num(row.cancellation_free_km, d.cancellation_free_km),
    cancellation_stuck_minutes: num(row.cancellation_stuck_minutes, d.cancellation_stuck_minutes),
    cancellation_stuck_km: num(row.cancellation_stuck_km, d.cancellation_stuck_km),
    partner_commission_percent: num(row.partner_commission_percent, d.partner_commission_percent),
    waiting_charge_per_min: num(row.waiting_charge_per_min, d.waiting_charge_per_min),
    waiting_free_minutes: num(row.waiting_free_minutes, d.waiting_free_minutes),
  };
}

export function surgeOf(s: Pick<PricingSettings, "surge_enabled" | "surge_multiplier">) {
  return s.surge_enabled && s.surge_multiplier > 1 ? s.surge_multiplier : 1;
}

// Postgres ROUND() rounds halves away from zero; Math.round rounds them up. Fares are positive,
// so they agree.
export function calcFare(
  vehicle: VehicleTariff,
  distKm: number,
  settings: Partial<PricingSettings> = DEFAULT_PRICING,
) {
  const s = { ...DEFAULT_PRICING, ...settings };
  const distance = Math.round(Number(vehicle.per_km) * Math.max(0, distKm));
  const surge = surgeOf(s);
  const rideFare = Math.round(
    Math.max(Number(vehicle.minimum_fare), Number(vehicle.base_fare) + distance) * surge,
  );
  const tax = Math.round((rideFare * (s.tax_percent || 0)) / 100);
  const platform = Math.round(s.platform_fee || 0);
  return {
    base: Number(vehicle.base_fare),
    distance,
    surge,
    rideFare,
    tax,
    platform,
    total: rideFare + tax + platform,
  };
}

export interface VehicleCategoryRow extends VehicleTariff {
  id: string;
  code: string;
  name: string;
  tagline: string;
  seats: number;
}

export function cancellationPolicyText(p: PricingSettings) {
  return `Free until a driver accepts; within ${p.cancellation_free_minutes} minutes of acceptance if the driver hasn't travelled more than ${p.cancellation_free_km} km; and if, ${p.cancellation_stuck_minutes}+ minutes after accepting, the driver has moved less than ${p.cancellation_stuck_km} km. Otherwise a ₹${p.cancellation_charge} cancellation fee is added to your next ride.`;
}
