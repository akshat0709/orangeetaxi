import re

with open('backup_book.tsx', 'r') as f:
    original = f.read()

new_content = """// @ts-nocheck

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { ArrowRight, BatteryCharging, CalendarClock, Check, CheckCircle, ChevronRight, Droplets, Loader2, MapPin, Navigation, ShieldCheck, Snowflake, Sparkles, UserRoundCheck, Wallet, Phone, Car } from "lucide-react";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useJsApiLoader, Autocomplete, GoogleMap, DirectionsRenderer } from "@react-google-maps/api";
import passengerImage from "@/assets/orange-taxi-passenger.jpg";
import interiorImage from "@/assets/orange-taxi-interior.jpg";

export const Route = createFileRoute("/book")({
  head: () => ({ meta: [
    { title: "Book a Ride — Orange Taxi" },
    { name: "description", content: "Book a premium Orange electric taxi. Select your vehicle, enter your journey and get an instant fare estimate." },
  ]}), component: PassengerPage,
});

interface VehicleCategory {
  id: string; code: string; name: string; tagline: string; seats: number;
  base_fare: number; per_km: number; minimum_fare: number;
}
interface LocationPoint { name: string; lat: number; lng: number; }
interface DriverInfo { full_name: string; phone: string; vehicle_model: string; vehicle_number: string; rating: number; current_lat?: number; current_lng?: number; }

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

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const libraries: ("places" | "geometry")[] = ["places", "geometry"];

function PassengerPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "",
    libraries,
  });

  const [vehicles, setVehicles] = useState<VehicleCategory[]>([]);
  const [pricingSettings, setPricingSettings] = useState({ tax_percent: 0, platform_fee: 0 });
  const [loading, setLoading] = useState(true);

  // Booking state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleCategory | null>(null);
  
  const [pickup, setPickup] = useState<LocationPoint | null>(null);
  const [drop, setDrop] = useState<LocationPoint | null>(null);
  const [distKm, setDistKm] = useState(0);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi">("cash");
  const [submitting, setSubmitting] = useState(false);
  const [bookingData, setBookingData] = useState<{ id: string; reference: string; otp: string } | null>(null);

  useEffect(() => {
    async function fetchData() {
      const [{ data: v }, { data: p }] = await Promise.all([
        supabase.from("vehicle_categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("pricing_settings").select("*").eq("id", 1).single(),
      ]);
      const vData = (v as VehicleCategory[]) ?? [];
      setVehicles(vData);
      if (p) setPricingSettings({ tax_percent: (p as any).tax_percent, platform_fee: (p as any).platform_fee });

      const aiBookingStr = sessionStorage.getItem("ai_booking");
      if (aiBookingStr) {
        try {
          const ai = JSON.parse(aiBookingStr);
          const selVeh = vData.find(x => x.code === ai.vehicle);
          if (selVeh) setSelectedVehicle(selVeh);
          // With dynamic maps, we don't have predefined lat/lng for "Delhi", so we let the user select it via Autocomplete
          sessionStorage.removeItem("ai_booking");
        } catch {}
      }
      setLoading(false);
    }
    fetchData();
  }, []);

  useEffect(() => {
    if (pickup && drop && isLoaded && window.google) {
      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route({
        origin: { lat: pickup.lat, lng: pickup.lng },
        destination: { lat: drop.lat, lng: drop.lng },
        travelMode: window.google.maps.TravelMode.DRIVING,
      }, (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
          const distanceMeters = result.routes[0]?.legs[0]?.distance?.value || 0;
          setDistKm(distanceMeters / 1000);
        } else {
          setDistKm(Math.max(1, haversine(pickup.lat, pickup.lng, drop.lat, drop.lng)));
        }
      });
    }
  }, [pickup, drop, isLoaded]);

  const fareBreakdown = selectedVehicle && distKm > 0 ? calcFare(selectedVehicle, distKm, pricingSettings) : null;

  async function confirmBooking() {
    if (!user) { navigate({ to: "/login", search: { redirect: "/book" } }); return; }
    if (!selectedVehicle || !pickup || !drop || !fareBreakdown) return;
    setSubmitting(true);
    
    const otp = generateOTP();
    const { data, error } = await supabase.from("bookings").insert({
      customer_id: user.id,
      pickup_location: pickup.name,
      drop_location: drop.name,
      pickup_lat: pickup.lat,
      pickup_lng: pickup.lng,
      drop_lat: drop.lat,
      drop_lng: drop.lng,
      vehicle_id: selectedVehicle.id,
      vehicle_name: selectedVehicle.name,
      base_fare: fareBreakdown.base,
      distance_fare: fareBreakdown.distance,
      tax_amount: fareBreakdown.tax,
      estimated_fare: fareBreakdown.total,
      payment_method: paymentMethod,
      status: "searching",
      ride_otp: otp,
    }).select("id, reference").single();
    
    if (error) { 
      console.error("Booking insert error:", error);
      toast.error(`Booking failed: ${error.message}`); 
      setSubmitting(false); 
      return; 
    }
    
    setBookingData({ id: (data as any).id, reference: (data as any).reference, otp });
    setStep(4);
    toast.success("Ride confirmed!");
    setSubmitting(false);
  }

  return <>
    <section className="relative overflow-hidden bg-night text-background">
      <img src={passengerImage} alt="Passenger" className="absolute inset-0 size-full object-cover object-[70%_center]" />
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

    <section id="booking" className="bg-night py-24 text-background md:py-32">
      <div className="section-shell">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Book your Orange</p>
        <h2 className="display-serif mt-4 text-5xl leading-none md:text-6xl">{step === 4 ? "You're all set." : "Plan your journey."}</h2>

        {step !== 4 && (
          <div className="mt-8 flex items-center gap-3">
            {([1, 2, 3] as const).map((s, i) => (
              <div key={s} className="flex items-center gap-3">
                <div className={`grid size-7 place-items-center rounded-full text-xs font-bold transition-colors ${step >= s ? "bg-primary text-primary-foreground" : "border border-background/30 text-background/40"}`}>
                  {step > s ? <Check className="size-3.5" /> : s}
                </div>
                <span className={`text-xs font-semibold ${step === s ? "text-background" : "text-background/40"}`}>{["Choose vehicle", "Journey details", "Confirm"][i]}</span>
                {i < 2 && <ChevronRight className="size-4 text-background/30" />}
              </div>
            ))}
          </div>
        )}

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
          <div className="rounded-xl border border-background/15 bg-background/5 p-7">
            {loading ? <div className="flex justify-center py-16"><Loader2 className="size-8 animate-spin text-primary" /></div> :
             step === 1 ? <Step1Vehicles vehicles={vehicles} selected={selectedVehicle} onSelect={setSelectedVehicle} onNext={() => { if (!user) { navigate({ to: "/login", search: { redirect: "/book" } }); return; } setStep(2); }} /> :
             step === 2 ? <Step2Journey pickup={pickup} drop={drop} onPickup={setPickup} onDrop={setDrop} distKm={distKm} fareBreakdown={fareBreakdown} selectedVehicle={selectedVehicle!} onBack={() => setStep(1)} onNext={() => setStep(3)} isLoaded={isLoaded} directions={directions} /> :
             step === 3 ? <Step3Confirm selectedVehicle={selectedVehicle!} pickup={pickup!} drop={drop!} fareBreakdown={fareBreakdown!} distKm={distKm} paymentMethod={paymentMethod} onPaymentChange={setPaymentMethod} onBack={() => setStep(2)} onConfirm={confirmBooking} submitting={submitting} /> :
             <Step4Confirmed bookingData={bookingData!} pickup={pickup!} drop={drop!} vehicle={selectedVehicle!} fare={fareBreakdown!.total} isLoaded={isLoaded} />}
          </div>
          <figure className="overflow-hidden rounded-xl">
            <img src={interiorImage} alt="Premium Orange cabin" className="aspect-[4/3] size-full object-cover" />
          </figure>
        </div>
      </div>
    </section>
  </>;
}

function Step1Vehicles({ vehicles, selected, onSelect, onNext }: any) {
  return <div>
    <p className="text-sm font-semibold text-background">Choose your ride</p>
    <div className="mt-5 space-y-3">
      {vehicles.map((v: any) => (
        <button key={v.id} onClick={() => onSelect(v)} className={`w-full rounded-lg border p-5 text-left transition-all ${selected?.id === v.id ? "border-primary bg-primary/10" : "border-background/15 hover:border-background/30"}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2"><BatteryCharging className="size-4 text-primary" /><span className="text-sm font-bold text-background">{v.name}</span></div>
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
    <Button size="lg" className="mt-6 w-full" disabled={!selected} onClick={onNext}>Continue <ArrowRight /></Button>
  </div>;
}

function Step2Journey({ pickup, drop, onPickup, onDrop, distKm, fareBreakdown, selectedVehicle, onBack, onNext, isLoaded, directions }: any) {
  const canProceed = pickup && drop && (pickup.lat !== drop.lat || pickup.lng !== drop.lng);
  
  const [pickupRef, setPickupRef] = useState<google.maps.places.Autocomplete | null>(null);
  const [dropRef, setDropRef] = useState<google.maps.places.Autocomplete | null>(null);
  
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
      setShowError(true);
    }
  }, []);

  return <div>
    <p className="text-sm font-semibold text-background">Set your journey — {selectedVehicle.name}</p>
    
    {showError && (
      <div className="mt-3 rounded border border-red-500/50 bg-red-500/10 p-3 text-xs text-red-200">
        Missing VITE_GOOGLE_MAPS_API_KEY. Maps will not load. Please add it to your environment variables.
      </div>
    )}

    <div className="mt-5 space-y-4">
      {!isLoaded ? (
        <div className="flex justify-center p-6"><Loader2 className="size-6 animate-spin text-primary" /></div>
      ) : (
        <>
          <div>
            <Label className="text-background/70">Pickup location</Label>
            <Autocomplete 
              onLoad={setPickupRef}
              onPlaceChanged={() => {
                if (pickupRef) {
                  const place = pickupRef.getPlace();
                  if (place.geometry?.location) {
                    onPickup({
                      name: place.name || place.formatted_address || "Pickup",
                      lat: place.geometry.location.lat(),
                      lng: place.geometry.location.lng()
                    });
                  }
                }
              }}
            >
              <div className="relative mt-1.5 flex items-center">
                <MapPin className="absolute left-3 size-4 text-primary" />
                <input 
                  type="text"
                  placeholder="Enter pickup location"
                  defaultValue={pickup?.name || ""}
                  className="h-10 w-full rounded-md border border-background/20 bg-background/10 pl-10 pr-3 text-sm text-background placeholder:text-background/50 focus:border-primary focus:outline-none"
                />
              </div>
            </Autocomplete>
          </div>
          <div>
            <Label className="text-background/70">Drop-off location</Label>
            <Autocomplete 
              onLoad={setDropRef}
              onPlaceChanged={() => {
                if (dropRef) {
                  const place = dropRef.getPlace();
                  if (place.geometry?.location) {
                    onDrop({
                      name: place.name || place.formatted_address || "Drop-off",
                      lat: place.geometry.location.lat(),
                      lng: place.geometry.location.lng()
                    });
                  }
                }
              }}
            >
              <div className="relative mt-1.5 flex items-center">
                <Navigation className="absolute left-3 size-4 text-primary" />
                <input 
                  type="text"
                  placeholder="Enter drop location"
                  defaultValue={drop?.name || ""}
                  className="h-10 w-full rounded-md border border-background/20 bg-background/10 pl-10 pr-3 text-sm text-background placeholder:text-background/50 focus:border-primary focus:outline-none"
                />
              </div>
            </Autocomplete>
          </div>

          {(pickup || drop) && (
            <div className="mt-4 h-48 w-full overflow-hidden rounded-lg border border-background/20">
              <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={pickup ? { lat: pickup.lat, lng: pickup.lng } : (drop ? { lat: drop.lat, lng: drop.lng } : { lat: 28.6139, lng: 77.2090 })}
                zoom={pickup && drop ? undefined : 14}
                options={{ disableDefaultUI: true }}
              >
                {directions && <DirectionsRenderer directions={directions} options={{ suppressMarkers: false }} />}
              </GoogleMap>
            </div>
          )}
        </>
      )}

      {fareBreakdown && distKm > 0 && (
        <div className="rounded-lg border border-primary/30 bg-primary/10 p-5">
          <p className="text-xs font-bold uppercase tracking-wider text-primary">Fare estimate</p>
          <p className="mt-3 text-3xl font-bold text-background">₹{Math.round(fareBreakdown.total)}</p>
          <p className="mt-1 text-xs text-background/50">~{Math.round(distKm)} km · approx {Math.round(distKm / 0.5)} min</p>
        </div>
      )}
    </div>
    <div className="mt-6 flex gap-3">
      <Button variant="ghost" className="text-background/70 hover:text-background" onClick={onBack}>Back</Button>
      <Button size="lg" className="flex-1" disabled={!canProceed} onClick={onNext}>Review & Confirm <ArrowRight /></Button>
    </div>
  </div>;
}

function Step3Confirm({ selectedVehicle, pickup, drop, fareBreakdown, distKm, paymentMethod, onPaymentChange, onBack, onConfirm, submitting }: any) {
  return <div>
    <p className="text-sm font-semibold text-background">Confirm your ride</p>
    <div className="mt-5 space-y-3">
      <div className="rounded-lg border border-background/15 p-5 space-y-3">
        <Row label="Vehicle" value={selectedVehicle.name} />
        <Row label="Pickup" value={pickup.name} />
        <Row label="Drop-off" value={drop.name} />
        <div className="flex items-center justify-between border-t border-background/10 pt-3">
          <span className="font-bold text-background">Total</span>
          <span className="text-xl font-bold text-primary">₹{Math.round(fareBreakdown.total)}</span>
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-background/60">Payment method</p>
        <RadioGroup value={paymentMethod} onValueChange={onPaymentChange} className="mt-3 flex gap-3">
          {([["cash", "Cash"], ["upi", "UPI"]] as const).map(([val, label]) => (
            <label key={val} className={`flex flex-1 cursor-pointer items-center gap-3 rounded-lg border p-4 ${paymentMethod === val ? "border-primary bg-primary/10" : "border-background/15 hover:border-background/30"}`}>
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
  return <div className="flex justify-between text-sm"><span className="text-background/60">{label}</span><span className="font-semibold text-background">{value}</span></div>;
}

function Step4Confirmed({ bookingData, pickup, drop, vehicle, fare, isLoaded }: { bookingData: { id: string; reference: string; otp: string }; pickup: LocationPoint; drop: LocationPoint; vehicle: VehicleCategory; fare: number; isLoaded: boolean }) {
  const [status, setStatus] = useState("searching");
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);

  useEffect(() => {
    const bookingChannel = supabase.channel(`booking-${bookingData.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingData.id}` }, async (payload) => {
        const newStatus = payload.new.status;
        setStatus(newStatus);
        
        if (payload.new.driver_id && !driverInfo) {
          const { data } = await supabase.from("drivers").select("*").eq("id", payload.new.driver_id).single();
          if (data) {
            setDriverInfo(data as any);
            supabase.channel(`driver-${data.id}`)
              .on("postgres_changes", { event: "UPDATE", schema: "public", table: "drivers", filter: `id=eq.${data.id}` }, (driverPayload) => {
                setDriverInfo(prev => prev ? { ...prev, current_lat: driverPayload.new.current_lat, current_lng: driverPayload.new.current_lng } : prev);
              }).subscribe();
          }
        }
      }).subscribe();
      
    return () => { supabase.removeChannel(bookingChannel); };
  }, [bookingData.id, driverInfo]);

  return <div className="flex flex-col py-2">
    <div className="flex items-center gap-4 border-b border-background/10 pb-6">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/20 text-primary"><CheckCircle className="size-6" /></span>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{status === "searching" ? "Finding driver" : status.replace("_", " ")}</p>
        <p className="display-serif text-2xl text-background">Ref: {bookingData.reference}</p>
      </div>
    </div>

    <div className="mt-6 rounded-xl border border-primary/30 bg-primary/10 p-5 text-center">
      <p className="text-xs font-bold uppercase tracking-wider text-primary">Ride OTP</p>
      <p className="mt-2 text-4xl font-mono font-bold tracking-widest text-background">{bookingData.otp}</p>
      <p className="mt-2 text-xs text-background/60">Show this code to your driver to start the ride</p>
    </div>

    {driverInfo ? (
      <div className="mt-6 rounded-xl border border-background/15 p-5">
        <p className="text-xs font-bold uppercase tracking-wider text-background/60">Your Driver</p>
        <div className="mt-4 flex items-start justify-between">
          <div>
            <p className="font-bold text-background">{driverInfo.full_name}</p>
            <div className="mt-1 flex items-center gap-2 text-xs text-background/60">
              <span className="flex items-center gap-1"><Car className="size-3" /> {driverInfo.vehicle_model || vehicle.name}</span>
              <span className="rounded bg-background/10 px-1.5 py-0.5 font-mono text-background">{driverInfo.vehicle_number || "Awaiting Plate"}</span>
            </div>
          </div>
          <a href={`tel:${driverInfo.phone}`} className="grid size-10 place-items-center rounded-full bg-background/10 text-background hover:bg-background/20 transition-colors">
            <Phone className="size-4" />
          </a>
        </div>
      </div>
    ) : (
      <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-background/15 py-10">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="mt-3 text-sm text-background/60">Matching you with the nearest {vehicle.name}...</p>
      </div>
    )}

    {driverInfo?.current_lat && driverInfo?.current_lng && isLoaded && (
      <div className="mt-6 h-48 w-full overflow-hidden rounded-xl border border-background/15 bg-background/5 relative">
        <GoogleMap
          mapContainerStyle={{ width: '100%', height: '100%' }}
          center={{ lat: driverInfo.current_lat, lng: driverInfo.current_lng }}
          zoom={15}
          options={{ disableDefaultUI: true }}
        >
          {/* Driver marker logic could go here, but omitted for simplicity */}
        </GoogleMap>
        <div className="absolute bottom-0 inset-x-0 p-2 text-center text-xs font-bold text-background/80 bg-background/20 backdrop-blur-md">
          Live tracking active
        </div>
      </div>
    )}

    <div className="mt-6 space-y-2 text-sm">
      <Row label="Pickup" value={pickup.name} />
      <Row label="Drop-off" value={drop.name} />
      <div className="flex justify-between border-t border-background/10 pt-3">
        <span className="text-background/60">Estimated fare</span>
        <span className="font-bold text-primary">₹{Math.round(fare)}</span>
      </div>
    </div>
    
    <div className="mt-8 flex justify-center">
      <Button variant="ghost" className="text-background/60 hover:text-background" onClick={() => window.location.reload()}>Book another ride</Button>
    </div>
  </div>;
}
"""

with open('src/routes/book.tsx', 'w') as f:
    f.write(new_content)

print("Updated src/routes/book.tsx")
