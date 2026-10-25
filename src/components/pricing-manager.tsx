// Admin → Pricing: every price riders see and pay comes from here (pricing_settings +
// vehicle_categories). The website, the rider app and the server's fare check all read these
// rows, so a save here changes fares everywhere for new bookings. Existing bookings keep theirs.
import { useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Save, IndianRupee, TrendingUp, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import {
  calcFare,
  cancellationPolicyText,
  DEFAULT_PRICING,
  normalizePricing,
  type PricingSettings,
} from "@/lib/pricing";

interface VehicleRow {
  id?: string;
  code: string;
  name: string;
  tagline: string;
  seats: number;
  base_fare: number;
  per_km: number;
  minimum_fare: number;
  is_active: boolean;
  sort_order: number;
}

// Same limits as the database (pricing_settings_sane / vehicle_categories_sane).
const LIMITS: Record<keyof PricingSettings, [number, number] | null> = {
  tax_percent: [0, 28],
  platform_fee: [0, 500],
  surge_enabled: null,
  surge_multiplier: [1, 3],
  cancellation_charge: [0, 1000],
  cancellation_free_minutes: [0, 60],
  cancellation_free_km: [0, 50],
  cancellation_stuck_minutes: [1, 120],
  cancellation_stuck_km: [0, 20],
  partner_commission_percent: [0, 60],
  waiting_charge_per_min: [0, 100],
  waiting_free_minutes: [0, 60],
};
const SAMPLE_KM = [5, 10, 20];

function settingsError(s: PricingSettings): string | null {
  for (const [key, range] of Object.entries(LIMITS) as [
    keyof PricingSettings,
    [number, number] | null,
  ][]) {
    if (!range) continue;
    const v = Number(s[key]);
    if (!Number.isFinite(v) || v < range[0] || v > range[1]) {
      return `${key.replace(/_/g, " ")} must be between ${range[0]} and ${range[1]}.`;
    }
  }
  return null;
}

function vehicleError(v: VehicleRow): string | null {
  if (!/^[A-Z0-9_]{2,40}$/.test(v.code)) return "Code: 2–40 capital letters, digits or _.";
  if (!v.name.trim()) return "Name is required.";
  if (!(v.seats >= 1 && v.seats <= 12)) return "Seats must be 1–12.";
  for (const k of ["base_fare", "per_km", "minimum_fare"] as const) {
    const max = k === "per_km" ? 1000 : 10000;
    if (!(Number(v[k]) >= 0 && Number(v[k]) <= max))
      return `${k.replace("_", " ")} must be 0–${max}.`;
  }
  return null;
}

function NumberField({
  label,
  value,
  onChange,
  step = "1",
  suffix,
  hint,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: string;
  suffix?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-semibold">{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="decimal"
          step={step}
          value={Number.isFinite(value) ? value : ""}
          onChange={(e) => onChange(e.target.value === "" ? NaN : Number(e.target.value))}
          className="h-9"
        />
        {suffix && <span className="text-xs text-muted-foreground shrink-0">{suffix}</span>}
      </div>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function PricingManager() {
  const [loading, setLoading] = useState(true);
  const [settings, setSettings] = useState<PricingSettings>(DEFAULT_PRICING);
  const [savedSettings, setSavedSettings] = useState<PricingSettings>(DEFAULT_PRICING);
  const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
  const [savingSettings, setSavingSettings] = useState(false);
  const [savingVehicle, setSavingVehicle] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: p, error: pe }, { data: v, error: ve }] = await Promise.all([
      supabase.from("pricing_settings").select("*").eq("id", 1).maybeSingle(),
      supabase.from("vehicle_categories").select("*").order("sort_order"),
    ]);
    if (pe || ve) toast.error("Could not load pricing: " + (pe || ve)?.message);
    const s = normalizePricing(p);
    setSettings(s);
    setSavedSettings(s);
    setVehicles(
      ((v as unknown as VehicleRow[]) || []).map((r) => ({
        ...r,
        seats: Number(r.seats),
        base_fare: Number(r.base_fare),
        per_km: Number(r.per_km),
        minimum_fare: Number(r.minimum_fare),
        sort_order: Number(r.sort_order),
      })),
    );
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  const dirty = JSON.stringify(settings) !== JSON.stringify(savedSettings);
  const set = <K extends keyof PricingSettings>(k: K, v: PricingSettings[K]) =>
    setSettings((s) => ({ ...s, [k]: v }));

  async function saveSettings() {
    const err = settingsError(settings);
    if (err) {
      toast.error(err);
      return;
    }
    setSavingSettings(true);
    const { error } = await supabase
      .from("pricing_settings")
      .update({ ...settings, updated_at: new Date().toISOString() } as never)
      .eq("id", 1);
    setSavingSettings(false);
    if (error) {
      toast.error("Save failed: " + error.message);
      return;
    }
    setSavedSettings(settings);
    toast.success("Pricing saved. New bookings use it right away.");
  }

  async function saveVehicle(idx: number) {
    const v = vehicles[idx];
    if (!v) return;
    const err = vehicleError(v);
    if (err) {
      toast.error(err);
      return;
    }
    setSavingVehicle(v.id || v.code);
    const row = {
      code: v.code,
      name: v.name.trim(),
      tagline: v.tagline.trim(),
      seats: v.seats,
      base_fare: v.base_fare,
      per_km: v.per_km,
      minimum_fare: v.minimum_fare,
      is_active: v.is_active,
      sort_order: v.sort_order,
    };
    const { data, error } = v.id
      ? await supabase
          .from("vehicle_categories")
          .update(row as never)
          .eq("id", v.id)
          .select("id")
          .single()
      : await supabase
          .from("vehicle_categories")
          .insert(row as never)
          .select("id")
          .single();
    setSavingVehicle(null);
    if (error) {
      toast.error("Save failed: " + error.message);
      return;
    }
    setVehicles((list) =>
      list.map((x, i) => (i === idx ? { ...x, id: (data as { id: string }).id } : x)),
    );
    toast.success(`${row.name} saved.`);
  }

  const editVehicle = (idx: number, patch: Partial<VehicleRow>) =>
    setVehicles((list) => list.map((x, i) => (i === idx ? { ...x, ...patch } : x)));

  const activeVehicles = useMemo(() => vehicles.filter((v) => v.is_active), [vehicles]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Loading pricing…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground">
        Prices here are used by the website, the rider app and the server&apos;s fare check. Saving
        changes the fare for <strong>new</strong> bookings straight away; rides already booked keep
        their fare.
      </div>

      {/* Fees, tax, surge */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold flex items-center gap-2">
            <IndianRupee className="size-4 text-primary" /> Fees, tax and surge
          </h3>
          <Button size="sm" onClick={saveSettings} disabled={!dirty || savingSettings}>
            {savingSettings ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Save className="size-3.5" />
            )}
            Save
          </Button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField
            label="GST"
            suffix="%"
            step="0.5"
            value={settings.tax_percent}
            onChange={(v) => set("tax_percent", v)}
            hint="Tax invoices are issued at 5% (SAC 9964). Change only on your accountant's advice."
          />
          <NumberField
            label="Platform fee per ride"
            suffix="₹"
            value={settings.platform_fee}
            onChange={(v) => set("platform_fee", v)}
            hint="Added to every ride. 0 = no platform fee."
          />
          <div className="space-y-1">
            <Label className="text-xs font-semibold flex items-center gap-1.5">
              <TrendingUp className="size-3.5" /> Surge
            </Label>
            <div className="flex items-center gap-3">
              <Switch
                checked={settings.surge_enabled}
                onCheckedChange={(v) => set("surge_enabled", v)}
              />
              <Input
                type="number"
                step="0.1"
                min={1}
                max={3}
                value={Number.isFinite(settings.surge_multiplier) ? settings.surge_multiplier : ""}
                onChange={(e) =>
                  set("surge_multiplier", e.target.value === "" ? NaN : Number(e.target.value))
                }
                className="h-9 w-24"
                disabled={!settings.surge_enabled}
              />
              <span className="text-xs text-muted-foreground">×</span>
            </div>
            <p className="text-[11px] text-muted-foreground">
              {settings.surge_enabled
                ? `Ride fares are multiplied by ${settings.surge_multiplier}× (1–3).`
                : "Off: no surge."}
            </p>
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <XCircle className="size-4 text-destructive" /> Cancellation
          </h4>
          <div className="grid gap-4 sm:grid-cols-3">
            <NumberField
              label="Cancellation fee"
              suffix="₹"
              value={settings.cancellation_charge}
              onChange={(v) => set("cancellation_charge", v)}
            />
            <NumberField
              label="Free within"
              suffix="min of acceptance"
              value={settings.cancellation_free_minutes}
              onChange={(v) => set("cancellation_free_minutes", v)}
            />
            <NumberField
              label="…and driver moved at most"
              suffix="km"
              step="0.1"
              value={settings.cancellation_free_km}
              onChange={(v) => set("cancellation_free_km", v)}
            />
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Also free if, after"
              suffix="min"
              value={settings.cancellation_stuck_minutes}
              onChange={(v) => set("cancellation_stuck_minutes", v)}
            />
            <NumberField
              label="…the driver has moved less than"
              suffix="km"
              step="0.1"
              value={settings.cancellation_stuck_km}
              onChange={(v) => set("cancellation_stuck_km", v)}
              hint="The driver is stuck or not coming."
            />
          </div>
          <p className="mt-2 text-[11px] text-muted-foreground">
            {cancellationPolicyText(settings)}
          </p>
        </div>

        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Clock className="size-4" /> Waiting at pickup
          </h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Free waiting"
              suffix="min"
              value={settings.waiting_free_minutes}
              onChange={(v) => set("waiting_free_minutes", v)}
            />
            <NumberField
              label="Then"
              suffix="₹ per min"
              value={settings.waiting_charge_per_min}
              onChange={(v) => set("waiting_charge_per_min", v)}
              hint="Shown to the rider and driver on the waiting timer."
            />
          </div>
        </div>

        <div className="border-t border-border pt-4">
          <h4 className="text-sm font-semibold mb-3">Commission drivers (own vehicle)</h4>
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField
              label="Company commission"
              suffix="% of each fare"
              step="0.5"
              value={settings.partner_commission_percent}
              onChange={(v) => set("partner_commission_percent", v)}
              hint="Used by the Commission Ledger. The driver keeps the rest."
            />
          </div>
        </div>
      </section>

      {/* Vehicle tariffs */}
      <section className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-bold">Vehicle fares</h3>
          <Button
            size="sm"
            variant="outline"
            onClick={() =>
              setVehicles((list) => [
                ...list,
                {
                  code: "",
                  name: "",
                  tagline: "",
                  seats: 4,
                  base_fare: 99,
                  per_km: 18,
                  minimum_fare: 149,
                  is_active: false,
                  sort_order: (list.at(-1)?.sort_order ?? 0) + 1,
                },
              ])
            }
          >
            <Plus className="size-3.5" /> Add vehicle
          </Button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          Only <strong>active</strong> vehicles are offered to riders. Fare = max(minimum, base +
          per km × distance){settings.surge_enabled ? `, × ${settings.surge_multiplier} surge` : ""}
          , then GST{settings.platform_fee > 0 ? " and the platform fee" : ""}.
        </p>

        <div className="space-y-3">
          {vehicles.map((v, idx) => (
            <div
              key={v.id || `new-${idx}`}
              className="rounded-lg border border-border p-4 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={v.is_active}
                    onCheckedChange={(c) => editVehicle(idx, { is_active: c })}
                  />
                  <Badge variant={v.is_active ? "default" : "secondary"}>
                    {v.is_active ? "Active" : "Hidden"}
                  </Badge>
                  <span className="font-mono text-xs text-muted-foreground">{v.code || "new"}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => saveVehicle(idx)}
                  disabled={savingVehicle === (v.id || v.code)}
                >
                  {savingVehicle === (v.id || v.code) ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <Save className="size-3.5" />
                  )}
                  Save
                </Button>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Name</Label>
                  <Input
                    className="h-9"
                    value={v.name}
                    onChange={(e) => editVehicle(idx, { name: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs font-semibold">Code</Label>
                  <Input
                    className="h-9 font-mono"
                    value={v.code}
                    disabled={!!v.id}
                    placeholder="ORANGE_SIGNATURE"
                    onChange={(e) => editVehicle(idx, { code: e.target.value.toUpperCase() })}
                  />
                </div>
                <div className="space-y-1 lg:col-span-2">
                  <Label className="text-xs font-semibold">Tagline</Label>
                  <Input
                    className="h-9"
                    value={v.tagline}
                    onChange={(e) => editVehicle(idx, { tagline: e.target.value })}
                  />
                </div>
                <NumberField
                  label="Base fare"
                  suffix="₹"
                  value={v.base_fare}
                  onChange={(n) => editVehicle(idx, { base_fare: n })}
                />
                <NumberField
                  label="Per km"
                  suffix="₹"
                  step="0.5"
                  value={v.per_km}
                  onChange={(n) => editVehicle(idx, { per_km: n })}
                />
                <NumberField
                  label="Minimum fare"
                  suffix="₹"
                  value={v.minimum_fare}
                  onChange={(n) => editVehicle(idx, { minimum_fare: n })}
                />
                <div className="grid grid-cols-2 gap-3">
                  <NumberField
                    label="Seats"
                    value={v.seats}
                    onChange={(n) => editVehicle(idx, { seats: n })}
                  />
                  <NumberField
                    label="Order"
                    value={v.sort_order}
                    onChange={(n) => editVehicle(idx, { sort_order: n })}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="text-muted-foreground">Rider pays (with current settings):</span>
                {SAMPLE_KM.map((km) => (
                  <span key={km} className="rounded bg-muted px-2 py-0.5 font-mono">
                    {km} km → ₹{calcFare(v, km, settings).total}
                  </span>
                ))}
              </div>
            </div>
          ))}
          {vehicles.length === 0 && (
            <p className="text-sm text-muted-foreground">No vehicles yet. Add one above.</p>
          )}
        </div>
        {activeVehicles.length === 0 && vehicles.length > 0 && (
          <p className="text-xs text-destructive">
            No vehicle is active: riders will see the default Orange Signature fare until you
            activate one.
          </p>
        )}
      </section>
      <UnpaidFees />
    </div>
  );
}

interface DueRow {
  id: string;
  amount: number;
  status: string;
  created_at: string;
  booking: { reference: string } | null;
  carried: { reference: string } | null;
}

// Unpaid cancellation fees: each is added to the rider's next ride and settled when that ride is
// paid. Admins can waive one (e.g. after a complaint).
function UnpaidFees() {
  const [rows, setRows] = useState<DueRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const { data, error } = await supabase
      .from("cancellation_dues" as never)
      .select(
        "id, amount, status, created_at, booking:bookings!cancellation_dues_booking_id_fkey(reference), carried:bookings!cancellation_dues_carried_by_fkey(reference)",
      )
      .eq("status", "due")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      toast.error("Could not load unpaid fees: " + error.message);
      setRows([]);
      return;
    }
    setRows((data as unknown as DueRow[]) || []);
  }

  useEffect(() => {
    load();
  }, []);

  async function waive(id: string) {
    setBusy(id);
    const { error } = await supabase
      .from("cancellation_dues" as never)
      .update({ status: "waived" } as never)
      .eq("id", id);
    setBusy(null);
    if (error) {
      toast.error("Could not waive: " + error.message);
      return;
    }
    toast.success("Fee waived.");
    setRows((r) => (r || []).filter((x) => x.id !== id));
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="font-bold">Unpaid cancellation fees</h3>
      <p className="text-[11px] text-muted-foreground">
        Each fee is added to the rider&apos;s next ride and settled when that ride is paid.
      </p>
      {rows === null ? (
        <p className="text-xs text-muted-foreground">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">No unpaid fees.</p>
      ) : (
        <div className="divide-y divide-border">
          {rows.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs"
            >
              <div className="min-w-0">
                <span className="font-mono font-semibold">#{r.booking?.reference ?? "—"}</span>
                <span className="ml-2 text-muted-foreground">
                  {new Date(r.created_at).toLocaleDateString("en-IN")}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {r.carried ? `added to ride #${r.carried.reference}` : "waiting for next ride"}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono font-bold">₹{Number(r.amount)}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy === r.id}
                  onClick={() => waive(r.id)}
                >
                  {busy === r.id ? <Loader2 className="size-3.5 animate-spin" /> : "Waive"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
