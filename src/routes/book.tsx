import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BatteryCharging, CalendarClock, Check, CheckCircle, ChevronRight, Droplets, Loader2, MapPin, Navigation, ShieldCheck, Snowflake, Sparkles, UserRoundCheck, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import passengerImage from "@/assets/orange-taxi-passenger.jpg";
import interiorImage from "@/assets/orange-taxi-interior.jpg";

export const Route = createFileRoute("/book")({
  head: () => ({ meta: [
    { title: "Book a Ride — Orange Taxi" },
    { name: "description", content: "Book a premium Orange electric taxi. Select your vehicle, enter your journey and get an instant fare estimate." },
    { property: "og:title", content: "Book a Ride — Orange Taxi" },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ]}), component: PassengerPage,
});

interface VehicleCategory {
  id: string; code: string; name: string; tagline: string; seats: number;
  base_fare: number; per_km: number; minimum_fare: number;
}
interface ServiceArea { id: string; name: string; lat: number; lng: number; is_airport: boolean; }

const comforts = [
  { icon: Droplets, title: "Complimentary Water", text: "A chilled bottle is always waiting in your Orange." },
  { icon: Snowflake, title: "Pre-Cooled Cabin", text: "Your car is cooled before you step in — every time." },
  { icon: UserRoundCheck, title: "Professional Drivers", text: "Trained, courteous drivers who take pride in service." },
  { icon: Sparkles, title: "Premium Electric Vehicles", text: "Quiet, smooth, spotless cars designed for comfort." },
  { icon: ShieldCheck, title: "A Safer Journey", text: "Considered safety standards across every Orange ride." },
  { icon: CalendarClock, title: "On Your Schedule", text: "Reliable, punctual service for everyday journeys." },
];

// Haversine distance in km
function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcFare(vehicle: VehicleCategory, distKm: number, settings: { tax_percent: number; platform_fee: number }) {
  const raw = Math.max(vehicle.minimum_fare, vehicle.base_fare + vehicle.per_km * distKm);
  const tax = (raw * settings.tax_percent) / 100;
  return { base: vehicle.base_fare, distance: vehicle.per_km * distKm, tax, total: raw + tax + settings.platform_fee, platform: settings.platform_fee };
}

function PassengerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState<VehicleCategory[]>([]);
  const [areas, setAreas] = useState<ServiceArea[]>([]);
  const [pricingSettings, setPricingSettings] = useState({ tax_percent: 0, platform_fee: 0 });
  const [loading, setLoading] = useState(true);

  // Booking state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleCategory | null>(null);
  const [pickupId, setPickupId] = useState("");
  const [dropId, setDropId] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi">("cash");
  const [submitting, setSubmitting] = useState(false);
  const [bookingRef, setBookingRef] = useState("");

  useEffect(() => {
    async function fetchData() {
      const [{ data: v }, { data: a }, { data: p }] = await Promise.all([
        supabase.from("vehicle_categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("service_areas").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("pricing_settings").select("*").eq("id", 1).single(),
      ]);
      setVehicles((v as VehicleCategory[]) ?? []);
      setAreas((a as ServiceArea[]) ?? []);
      if (p) setPricingSettings({ tax_percent: (p as any).tax_percent, platform_fee: (p as any).platform_fee });
      setLoading(false);
    }
    fetchData();
  }, []);

  const pickup = areas.find(a => a.id === pickupId);
  const drop = areas.find(a => a.id === dropId);
  const distKm = pickup && drop ? Math.max(1, haversine(pickup.lat, pickup.lng, drop.lat, drop.lng)) : 0;
  const fareBreakdown = selectedVehicle && distKm > 0 ? calcFare(selectedVehicle, distKm, pricingSettings) : null;

  async function confirmBooking() {
    if (!user) { navigate({ to: "/login", search: { redirect: "/book" } }); return; }
    if (!selectedVehicle || !pickup || !drop || !fareBreakdown) return;
    setSubmitting(true);
    const { data, error } = await supabase.from("bookings").insert({
      customer_id: user.id,
      pickup_area: pickup.name,
      drop_area: drop.name,
      distance_km: Math.round(distKm * 10) / 10,
      duration_min: Math.round(distKm / 0.5),
      vehicle_code: selectedVehicle.code,
      vehicle_name: selectedVehicle.name,
      base_fare: fareBreakdown.base,
      distance_fare: fareBreakdown.distance,
      tax_amount: fareBreakdown.tax,
      estimated_fare: fareBreakdown.total,
      payment_method: paymentMethod,
      status: "searching",
    }).select("reference").single();
    if (error) { toast.error("Booking failed — please try again."); setSubmitting(false); return; }
    setBookingRef((data as any).reference);
    setStep(4);
    toast.success("Ride confirmed!");
    setSubmitting(false);
  }

  return <>
    {/* Hero */}
    <section className="relative overflow-hidden bg-night text-background">
      <img src={passengerImage} alt="A relaxed passenger enjoying the premium cabin of an Orange electric taxi" width={1408} height={1056} fetchPriority="high" className="absolute inset-0 size-full object-cover object-[70%_center]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--night)_0%,color-mix(in_oklab,var(--night)_82%,transparent)_42%,transparent_78%)]" />
      <div className="section-shell relative flex min-h-[50vh] items-end py-10 md:items-center md:py-20">
        <div className="max-w-2xl animate-gentle-rise">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-background/70">For passengers</p>
          <h1 className="display-serif text-[clamp(2.85rem,7vw,5rem)] leading-[0.92]">Every ride,<br /><span className="text-primary">taken care of.</span></h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-background/75 md:text-lg">Premium electric car, professional driver, complimentary water — designed to be your everyday way to travel.</p>
          <Button asChild size="lg" className="mt-8"><a href="#booking">Book a Ride <ArrowRight /></a></Button>
        </div>
      </div>
    </section>

    {/* Comforts */}
    <section className="py-20 md:py-28"><div className="section-shell">
      <div className="mt-0 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {comforts.map(({ icon: Icon, title, text }) => <article key={title} className="bg-background p-7">
          <span className="grid size-11 place-items-center rounded-full bg-warm text-primary"><Icon className="size-5" /></span>
          <h2 className="mt-10 text-lg font-bold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
        </article>)}
      </div>
    </div></section>

    {/* BOOKING SECTION */}
    <section id="booking" className="bg-night py-24 text-background md:py-32">
      <div className="section-shell">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Book your Orange</p>
        <h2 className="display-serif mt-4 text-5xl leading-none md:text-6xl">
          {step === 4 ? "You're all set." : "Plan your journey."}
        </h2>

        {/* Step indicator */}
        {step !== 4 && (
          <div className="mt-8 flex items-center gap-3">
            {([1, 2, 3] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className={`grid size-7 place-items-center rounded-full text-xs font-bold transition-colors ${step >= s ? "bg-primary text-primary-foreground" : "border border-background/30 text-background/40"}`}>
                  {step > s ? <Check className="size-3.5" /> : s}
                </div>
                <span className={`text-xs font-semibold ${step === s ? "text-background" : "text-background/40"}`}>
                  {["Choose vehicle", "Journey details", "Confirm"][i]}
                </span>
                {i < 2 && <ChevronRight className="size-4 text-background/30" />}
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          {/* LEFT — step content */}
          <div className="rounded-xl border border-background/15 bg-background/5 p-7">
            {loading ? (
              <div className="flex items-center justify-center py-16"><Loader2 className="size-8 animate-spin text-primary" /></div>
            ) : step === 1 ? (
              <Step1Vehicles vehicles={vehicles} selected={selectedVehicle} onSelect={setSelectedVehicle} onNext={() => { if (!user) { navigate({ to: "/login", search: { redirect: "/book" } }); return; } setStep(2); }} />
            ) : step === 2 ? (
              <Step2Journey areas={areas} pickupId={pickupId} dropId={dropId} onPickup={setPickupId} onDrop={setDropId}
                distKm={distKm} fareBreakdown={fareBreakdown} selectedVehicle={selectedVehicle!}
                onBack={() => setStep(1)} onNext={() => setStep(3)} />
            ) : step === 3 ? (
              <Step3Confirm selectedVehicle={selectedVehicle!} pickup={pickup!} drop={drop!}
                fareBreakdown={fareBreakdown!} distKm={distKm} paymentMethod={paymentMethod}
                onPaymentChange={setPaymentMethod} onBack={() => setStep(2)} onConfirm={confirmBooking} submitting={submitting} />
            ) : (
              <Step4Confirmed bookingRef={bookingRef} pickup={pickup!} drop={drop!} vehicle={selectedVehicle!} fare={fareBreakdown!.total} />
            )}
          </div>

          {/* RIGHT — image */}
          <figure className="overflow-hidden rounded-xl">
            <img src={interiorImage} alt="Premium Orange cabin" width={1408} height={1056} loading="lazy" className="aspect-[4/3] size-full object-cover" />
          </figure>
        </div>
      </div>
    </section>

    {/* Orange Premium features */}
    <section className="py-24 md:py-32"><div className="section-shell">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">One class, done right</p>
      <h2 className="display-serif mt-4 text-5xl leading-none md:text-6xl">Orange Premium.</h2>
      <ul className="mt-12 grid gap-y-4 border-t border-border pt-10 text-sm font-semibold sm:grid-cols-2 lg:grid-cols-3">
        {["Spacious premium cabin", "Air conditioning, always on", "Complimentary water on board", "Trained professional driver", "Quiet, smooth electric ride", "Clear fare before you confirm"].map((x) => <li key={x} className="flex items-center gap-3"><Check className="size-4 text-primary" />{x}</li>)}
      </ul>
    </div></section>
  </>;
}

/* ---------- STEP 1 ---------- */
function Step1Vehicles({ vehicles, selected, onSelect, onNext }: { vehicles: VehicleCategory[]; selected: VehicleCategory | null; onSelect: (v: VehicleCategory) => void; onNext: () => void; }) {
  return <div>
    <p className="text-sm font-semibold text-background">Choose your ride</p>
    <div className="mt-5 space-y-3">
      {vehicles.map(v => (
        <button key={v.id} onClick={() => onSelect(v)}
          className={`w-full rounded-lg border p-5 text-left transition-all ${selected?.id === v.id ? "border-primary bg-primary/10" : "border-background/15 hover:border-background/30"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BatteryCharging className="size-4 text-primary" />
                <span className="text-sm font-bold text-background">{v.name}</span>
              </div>
              <p className="mt-1 text-xs text-background/60">{v.tagline}</p>
              <p className="mt-2 text-xs text-background/50">{v.seats} seats</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-primary">₹{v.base_fare}</p>
              <p className="text-xs text-background/50">base + ₹{v.per_km}/km</p>
              <p className="text-xs text-background/40">min ₹{v.minimum_fare}</p>
            </div>
          </div>
          {selected?.id === v.id && <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary"><Check className="size-3" />Selected</div>}
        </button>
      ))}
    </div>
    <Button size="lg" className="mt-6 w-full" disabled={!selected} onClick={onNext}>
      Continue <ArrowRight />
    </Button>
  </div>;
}

/* ---------- STEP 2 ---------- */
function Step2Journey({ areas, pickupId, dropId, onPickup, onDrop, distKm, fareBreakdown, selectedVehicle, onBack, onNext }: {
  areas: ServiceArea[]; pickupId: string; dropId: string;
  onPickup: (id: string) => void; onDrop: (id: string) => void;
  distKm: number; fareBreakdown: ReturnType<typeof calcFare> | null;
  selectedVehicle: VehicleCategory; onBack: () => void; onNext: () => void;
}) {
  const canProceed = pickupId && dropId && pickupId !== dropId;
  return <div>
    <p className="text-sm font-semibold text-background">Set your journey — {selectedVehicle.name}</p>
    <div className="mt-5 space-y-4">
      <div>
        <Label htmlFor="pickup" className="text-background/70">Pickup location</Label>
        <Select value={pickupId} onValueChange={onPickup}>
          <SelectTrigger id="pickup" className="mt-1.5 border-background/20 bg-background/10 text-background">
            <MapPin className="mr-2 size-4 text-primary" /><SelectValue placeholder="Select pickup area" />
          </SelectTrigger>
          <SelectContent>
            {areas.map(a => <SelectItem key={a.id} value={a.id}>{a.name}{a.is_airport ? " ✈️" : ""}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label htmlFor="drop" className="text-background/70">Drop-off location</Label>
        <Select value={dropId} onValueChange={onDrop}>
          <SelectTrigger id="drop" className="mt-1.5 border-background/20 bg-background/10 text-background">
            <Navigation className="mr-2 size-4 text-primary" /><SelectValue placeholder="Select drop area" />
          </SelectTrigger>
          <SelectContent>
            {areas.filter(a => a.id !== pickupId).map(a => <SelectItem key={a.id} value={a.id}>{a.name}{a.is_airport ? " ✈️" : ""}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {fareBreakdown && distKm > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Fare estimate</p>
          <p className="mt-3 text-3xl font-bold text-background">₹{Math.round(fareBreakdown.total)}</p>
          <p className="mt-1 text-xs text-background/50">~{Math.round(distKm)} km · approx {Math.round(distKm / 0.5)} min</p>
          <div className="mt-4 space-y-1 border-t border-background/10 pt-3 text-xs text-background/60">
            <div className="flex justify-between"><span>Base fare</span><span>₹{Math.round(fareBreakdown.base)}</span></div>
            <div className="flex justify-between"><span>Distance ({Math.round(distKm)} km × ₹{selectedVehicle.per_km})</span><span>₹{Math.round(fareBreakdown.distance)}</span></div>
            {fareBreakdown.tax > 0 && <div className="flex justify-between"><span>Tax</span><span>₹{Math.round(fareBreakdown.tax)}</span></div>}
            {fareBreakdown.platform > 0 && <div className="flex justify-between"><span>Platform fee</span><span>₹{Math.round(fareBreakdown.platform)}</span></div>}
          </div>
        </div>
      )}

      {pickupId && dropId && pickupId === dropId && (
        <p className="text-xs text-destructive">Pickup and drop-off must be different.</p>
      )}
    </div>
    <div className="mt-6 flex gap-3">
      <Button variant="ghost" className="text-background/70 hover:text-background" onClick={onBack}>Back</Button>
      <Button size="lg" className="flex-1" disabled={!canProceed} onClick={onNext}>Review & Confirm <ArrowRight /></Button>
    </div>
  </div>;
}

/* ---------- STEP 3 ---------- */
function Step3Confirm({ selectedVehicle, pickup, drop, fareBreakdown, distKm, paymentMethod, onPaymentChange, onBack, onConfirm, submitting }: {
  selectedVehicle: VehicleCategory; pickup: ServiceArea; drop: ServiceArea;
  fareBreakdown: ReturnType<typeof calcFare>; distKm: number;
  paymentMethod: "cash" | "upi"; onPaymentChange: (v: "cash" | "upi") => void;
  onBack: () => void; onConfirm: () => void; submitting: boolean;
}) {
  return <div>
    <p className="text-sm font-semibold text-background">Confirm your ride</p>
    <div className="mt-5 space-y-3">
      {/* Summary */}
      <div className="rounded-lg border border-background/15 p-5 space-y-3">
        <Row label="Vehicle" value={selectedVehicle.name} />
        <Row label="Pickup" value={pickup.name} />
        <Row label="Drop-off" value={drop.name} />
        <Row label="Distance" value={`~${Math.round(distKm)} km`} />
        <div className="border-t border-background/10 pt-3">
          <Row label="Base fare" value={`₹${Math.round(fareBreakdown.base)}`} />
          <Row label="Distance fare" value={`₹${Math.round(fareBreakdown.distance)}`} />
          {fareBreakdown.tax > 0 && <Row label="Tax" value={`₹${Math.round(fareBreakdown.tax)}`} />}
        </div>
        <div className="flex items-center justify-between border-t border-background/10 pt-3">
          <span className="font-bold text-background">Total</span>
          <span className="text-xl font-bold text-primary">₹{Math.round(fareBreakdown.total)}</span>
        </div>
      </div>

      {/* Payment */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-background/60">Payment method</p>
        <RadioGroup value={paymentMethod} onValueChange={onPaymentChange as any} className="mt-3 flex gap-3">
          {([["cash", "Cash"], ["upi", "UPI"]] as const).map(([val, label]) => (
            <label key={val} className={`flex flex-1 cursor-pointer items-center gap-3 rounded-lg border p-4 transition-colors ${paymentMethod === val ? "border-primary bg-primary/10" : "border-background/15 hover:border-background/30"}`}>
              <RadioGroupItem value={val} className="border-background/40 text-primary" />
              <Wallet className="size-4 text-primary" />
              <span className="text-sm font-semibold text-background">{label}</span>
            </label>
          ))}
        </RadioGroup>
      </div>
    </div>
    <div className="mt-6 flex gap-3">
      <Button variant="ghost" className="text-background/70 hover:text-background" onClick={onBack}>Back</Button>
      <Button size="lg" className="flex-1" onClick={onConfirm} disabled={submitting}>
        {submitting ? <Loader2 className="size-4 animate-spin" /> : <>Confirm Ride <ArrowRight /></>}
      </Button>
    </div>
  </div>;
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex items-center justify-between text-sm">
    <span className="text-background/60">{label}</span><span className="font-semibold text-background">{value}</span>
  </div>;
}

/* ---------- STEP 4 ---------- */
function Step4Confirmed({ bookingRef, pickup, drop, vehicle, fare }: { bookingRef: string; pickup: ServiceArea; drop: ServiceArea; vehicle: VehicleCategory; fare: number; }) {
  return <div className="flex flex-col items-center py-6 text-center">
    <span className="grid size-16 place-items-center rounded-full bg-primary/20 text-primary"><CheckCircle className="size-8" /></span>
    <p className="mt-6 text-xs font-bold uppercase tracking-[0.18em] text-primary">Booking confirmed</p>
    <p className="display-serif mt-2 text-4xl text-background">{bookingRef}</p>
    <p className="mt-2 text-xs text-background/50">Keep this reference handy</p>
    <div className="mt-8 w-full rounded-lg border border-background/15 p-5 text-left space-y-2">
      <Row label="Vehicle" value={vehicle.name} />
      <Row label="Pickup" value={pickup.name} />
      <Row label="Drop-off" value={drop.name} />
      <div className="flex items-center justify-between border-t border-background/10 pt-3 text-sm">
        <span className="text-background/60">Estimated fare</span>
        <span className="text-lg font-bold text-primary">₹{Math.round(fare)}</span>
      </div>
    </div>
    <p className="mt-6 text-sm leading-6 text-background/60">We're finding you an Orange driver. You'll be notified when one accepts your ride.</p>
    <div className="mt-6 flex gap-3">
      <Button asChild variant="light"><Link to="/">Back home</Link></Button>
      <Button onClick={() => window.location.reload()}>Book another</Button>
    </div>
  </div>;
}
