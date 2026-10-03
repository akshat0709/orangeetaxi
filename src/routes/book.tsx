// @ts-nocheck

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import { ArrowRight, BatteryCharging, Calendar, CalendarClock, Check, CheckCircle, ChevronRight, Clock, Copy, Droplets, FileText, Loader2, MapPin, MessageSquare, Navigation, Phone, PhoneCall, Shield, ShieldAlert, ShieldCheck, Snowflake, Sparkles, UserRoundCheck, Wallet, Car, XCircle, Crosshair, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { MapPicker, PAN_INDIA_PRESETS } from "@/components/map-picker";
import { GuardianSafetyModal } from "@/components/guardian-safety-modal";
import { LiveRideMap } from "@/components/live-ride-map";
import { APIProvider } from "@vis.gl/react-google-maps";
import { RatingModal } from "@/components/rating-modal";
import { TaxInvoiceModal } from "@/components/tax-invoice-modal";
import { RideChatSheet } from "@/components/ride-chat-sheet";
import { WaitingFeeTimer } from "@/components/waiting-fee-timer";
import passengerImage from "@/assets/orange-taxi-passenger.jpg";
import interiorImage from "@/assets/orange-taxi-interior.jpg";

import { getBookingVehiclePlate, resolveDriverDetails, fetchAndHydrateDriverDetails } from "@/lib/ride-vehicle";
import { encodePickupAddressWithPrefs, parseRidePreferences, parseCleanCoords, getCabinClimateBadge } from "@/lib/ride-preferences";
import { NotificationBanner } from "@/components/notification-banner";
import { sendRideNotification, getStatusNotificationContent } from "@/lib/notifications";

const GOOGLE_MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

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
interface ServiceArea { id: string; name: string; lat: number; lng: number; is_airport: boolean; }
interface DriverInfo {
  id?: string;
  user_id?: string;
  full_name: string;
  phone: string;
  vehicle_model: string;
  vehicle_number: string;
  vehicle_code?: string;
  rating: number;
  driver_type?: string;
  photo_url?: string;
  current_lat?: number;
  current_lng?: number;
}

const comforts = [
  { icon: Droplets, title: "Complimentary Water", text: "A chilled bottle is always waiting in your Orange." },
  { icon: Snowflake, title: "Pre-Cooled Cabin", text: "Your car is cooled before you step in — every time." },
  { icon: UserRoundCheck, title: "Professional Drivers", text: "Trained, courteous drivers who take pride in service." },
  { icon: Sparkles, title: "Premium Electric Vehicles", text: "Quiet, smooth, spotless cars designed for comfort." },
  { icon: ShieldCheck, title: "A Safer Journey", text: "Considered safety standards across every Orange ride." },
  { icon: CalendarClock, title: "On Your Schedule", text: "Reliable, punctual service for everyday journeys." },
];

const DEFAULT_VEHICLES: VehicleCategory[] = [
  {
    id: "v-signature",
    code: "signature",
    name: "Orange Signature",
    tagline: "Spotless, Pre-Cooled Mahindra BE 6 EV",
    seats: 4,
    base_fare: 99,
    per_km: 18,
    minimum_fare: 149,
  }
];

const DEFAULT_AREAS: ServiceArea[] = [
  { id: "a-delhi", name: "Delhi NCR (All Zones)", lat: 28.6315, lng: 77.2167, is_airport: false },
  { id: "a-igi", name: "IGI Airport (Terminal 1/2/3)", lat: 28.5562, lng: 77.1000, is_airport: true },
  { id: "a-gurugram", name: "Gurugram CyberHub", lat: 28.4950, lng: 77.0895, is_airport: false },
  { id: "a-noida", name: "Noida Sector 18", lat: 28.5708, lng: 77.3260, is_airport: false },
  { id: "a-blr", name: "Indiranagar / Bengaluru", lat: 12.9784, lng: 77.6408, is_airport: false },
  { id: "a-kia", name: "Kempegowda Int'l Airport (BLR)", lat: 13.1986, lng: 77.7066, is_airport: true },
];

function haversine(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcFare(vehicle: VehicleCategory, distKm: number, settings: { tax_percent: number; platform_fee: number }) {
  const distFare = Math.round(vehicle.per_km * distKm);
  const raw = Math.max(vehicle.minimum_fare, vehicle.base_fare + distFare);
  const tax = Math.round((raw * (settings.tax_percent || 0)) / 100);
  const platform = Math.round(settings.platform_fee || 0);
  const total = Math.round(raw + tax + platform);
  return { base: vehicle.base_fare, distance: distFare, tax, total, platform };
}

function generateOTP() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function reverseGeocodeCoords(lat: number, lng: number): Promise<string> {
  // 1. Instant check against curated presets (only if within 600m of an airport terminal or specific transit hub)
  if (PAN_INDIA_PRESETS && PAN_INDIA_PRESETS.length > 0) {
    for (const p of PAN_INDIA_PRESETS) {
      const d = haversine(lat, lng, p.lat, p.lng);
      if (d < 0.6) {
        return p.name;
      }
    }
  }

  // 2. High-speed client reverse geocoding via BigDataCloud (<180ms, free, works everywhere without API key)
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);
    const res = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lng}&localityLanguage=en`,
      { signal: controller.signal }
    );
    clearTimeout(timeout);
    if (res.ok) {
      const data = await res.json();
      const locality = data.locality || data.principalSubdivision || "";
      const city = data.city || data.localityInfo?.administrative?.[2]?.name || data.localityInfo?.administrative?.[1]?.name || "";
      if (locality && city && locality.toLowerCase() !== city.toLowerCase()) {
        return `${locality}, ${city}`;
      } else if (locality || city) {
        return locality || city;
      }
    }
  } catch (e) {}

  // 3. Try Google Geocoder if loaded
  if (typeof window !== "undefined" && window.google?.maps?.Geocoder) {
    try {
      const geocoder = new window.google.maps.Geocoder();
      const googleAddress: string | null = await new Promise((resolve) => {
        geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
          if (status === "OK" && results?.[0]?.formatted_address) {
            const parts = results[0].formatted_address.split(",").map((s: string) => s.trim());
            resolve(parts.slice(0, 3).join(", "));
          } else {
            resolve(null);
          }
        });
      });
      if (googleAddress) return googleAddress;
    } catch (e) {}
  }

  // 4. Try Google Geocoding API (Fallback)
  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${GOOGLE_MAPS_KEY}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.results && data.results.length > 0) {
        const parts = data.results[0].formatted_address.split(",").map((s: string) => s.trim());
        return parts.slice(0, 3).join(", ");
      }
    }
  } catch (e) {}

  return `Current Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
}

function PassengerPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [vehicles, setVehicles] = useState<VehicleCategory[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const c = localStorage.getItem("orange_cached_vehicles");
        if (c) {
          const parsed = JSON.parse(c);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return DEFAULT_VEHICLES;
  });
  const [areas, setAreas] = useState<ServiceArea[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const c = localStorage.getItem("orange_cached_areas");
        if (c) {
          const parsed = JSON.parse(c);
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return DEFAULT_AREAS;
  });
  const [pricingSettings, setPricingSettings] = useState(() => {
    if (typeof window !== "undefined") {
      try {
        const c = localStorage.getItem("orange_cached_pricing");
        if (c) return JSON.parse(c);
      } catch {}
    }
    return { tax_percent: 5, platform_fee: 0 };
  });
  const [loading, setLoading] = useState(false);

  // Booking state
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [selectedVehicle, setSelectedVehicle] = useState<VehicleCategory | null>(() => DEFAULT_VEHICLES[0]);
  const [pickupId, setPickupId] = useState("");
  const [dropId, setDropId] = useState("");

  // GPS locations (with instant localStorage cache for zero-click instant loading)
  const [pickupGPS, setPickupGPS] = useState<{ name: string; lat: number; lng: number } | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const cached = localStorage.getItem("orange_user_pickup_gps");
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.lat && parsed?.lng && parsed?.name) {
          return parsed;
        }
      }
    } catch {}
    return null;
  });
  const [dropGPS, setDropGPS] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [locatingGPS, setLocatingGPS] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "upi">("cash");
  const [pickupPillar, setPickupPillar] = useState("");
  const [cabinClimate, setCabinClimate] = useState<"chilled" | "pleasant" | "eco">("pleasant");
  const [quietRide, setQuietRide] = useState(false);
  const [isAdvanceBooking, setIsAdvanceBooking] = useState(false);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>(() => {
    const d = new Date(Date.now() + 60 * 60 * 1000);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  });
  const [submitting, setSubmitting] = useState(false);
  const [bookingData, setBookingData] = useState<{ id: string; reference: string; otp: string } | null>(null);
  const [liveDriverInfo, setLiveDriverInfo] = useState<any>(null);
  const [liveRideStatus, setLiveRideStatus] = useState<string>("searching");

  // Auto-acquire user GPS for instant zero-click pickup on page load
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.geolocation) return;

    let isMounted = true;
    setLocatingGPS(true);

    const updateLocation = async (lat: number, lng: number, fallbackLabel?: string) => {
      if (!isMounted) return;

      // 1. Immediately ensure pickupGPS is populated so it is NEVER null or blocking
      setPickupGPS((prev) => {
        const currentName = prev && prev.lat === lat && prev.lng === lng ? prev.name : (fallbackLabel || prev?.name || "Locating street...");
        const nextLoc = { name: currentName, lat, lng };
        try { localStorage.setItem("orange_user_pickup_gps", JSON.stringify(nextLoc)); } catch {}
        return nextLoc;
      });

      // 2. Resolve formatted street address asynchronously
      try {
        const resolved = await reverseGeocodeCoords(lat, lng);
        if (isMounted && resolved) {
          setPickupGPS({ name: resolved, lat, lng });
          try {
            localStorage.setItem("orange_user_pickup_gps", JSON.stringify({ name: resolved, lat, lng }));
          } catch {}
        }
      } catch (err) {
        console.warn("Reverse geocode notice:", err);
      } finally {
        if (isMounted) setLocatingGPS(false);
      }
    };

    // Fast Phase 1: Wi-Fi / IP positioning (<250ms)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        updateLocation(lat, lng, "Current Location");

        // Background Phase 2: High-accuracy refinement
        navigator.geolocation.getCurrentPosition(
          (highPos) => {
            const hLat = highPos.coords.latitude;
            const hLng = highPos.coords.longitude;
            if (haversine(lat, lng, hLat, hLng) > 0.04) {
              updateLocation(hLat, hLng);
            }
          },
          () => {},
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      },
      (fastErr) => {
        console.warn("Fast GPS pass notice, attempting high accuracy:", fastErr);
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            updateLocation(pos.coords.latitude, pos.coords.longitude, "Current Location");
          },
          (err) => {
            console.warn("GPS acquire notice:", err);
            if (!isMounted) return;
            setLocatingGPS(false);
            // Attempt fast IP geolocation fallback if browser GPS is blocked
            fetch("https://ipwho.is/")
              .then((r) => r.json())
              .then((ip) => {
                if (isMounted && ip?.success && ip.latitude && ip.longitude) {
                  updateLocation(ip.latitude, ip.longitude, `${ip.city || "Current Area"}, ${ip.region || "India"}`);
                }
              })
              .catch(() => {});
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      },
      { enableHighAccuracy: false, timeout: 3500, maximumAge: 300000 }
    );

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    async function fetchData() {
      const [{ data: v }, { data: a }, { data: p }] = await Promise.all([
        supabase.from("vehicle_categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("service_areas").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("pricing_settings").select("*").eq("id", 1).single(),
      ]);
      const vData = (v as VehicleCategory[]) ?? [];
      const aData = (a as ServiceArea[]) ?? [];
      if (vData.length > 0) {
        setVehicles(vData);
        try { localStorage.setItem("orange_cached_vehicles", JSON.stringify(vData)); } catch {}
        setSelectedVehicle((prev) => prev || vData[0]);
      }
      if (aData.length > 0) {
        setAreas(aData);
        try { localStorage.setItem("orange_cached_areas", JSON.stringify(aData)); } catch {}
      }
      if (p) {
        const nextPricing = { tax_percent: (p as any).tax_percent, platform_fee: (p as any).platform_fee };
        setPricingSettings(nextPricing);
        try { localStorage.setItem("orange_cached_pricing", JSON.stringify(nextPricing)); } catch {}
      }

      // Allow live GPS or user selection to populate pickupGPS without hardcoded city fallback

      // ✅ BOOKING PERSISTENCE FIX: Check for existing active booking
      if (user) {
        const { data: activeBooking } = await supabase
          .from("bookings")
          .select("*")
          .eq("customer_id", user.id)
          .in("status", ["searching", "accepted", "arrived", "in_progress"])
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (activeBooking) {
          // Restore full state from the active booking
          const veh = vData.find((x: any) => x.code === activeBooking.vehicle_code) || vData.find((x: any) => x.name === activeBooking.vehicle_name);
          const pArea = aData.find((x: any) => x.name === activeBooking.pickup_area);
          const dArea = aData.find((x: any) => x.name === activeBooking.drop_area);
          if (veh) setSelectedVehicle(veh);
          if (pArea) setPickupId(pArea.id);
          if (dArea) setDropId(dArea.id);

          // Restore exact GPS coordinates if available
          const cleanPickup = parseCleanCoords(activeBooking.pickup_address);
          if (cleanPickup) {
            setPickupGPS({ name: activeBooking.pickup_area, lat: cleanPickup.lat, lng: cleanPickup.lng });
          }
          const cleanDrop = parseCleanCoords(activeBooking.drop_address);
          if (cleanDrop) {
            setDropGPS({ name: activeBooking.drop_area, lat: cleanDrop.lat, lng: cleanDrop.lng });
          }

          // Restore passenger comfort preferences (AC, Quiet Mode, Hub Pillar)
          const restoredPrefs = parseRidePreferences(activeBooking.pickup_address, activeBooking.id);
          if (restoredPrefs.cabinClimate) setCabinClimate(restoredPrefs.cabinClimate);
          if (typeof restoredPrefs.quietRide === "boolean") setQuietRide(restoredPrefs.quietRide);
          if (restoredPrefs.pickupPillar) setPickupPillar(restoredPrefs.pickupPillar);

          setBookingData({ id: activeBooking.id, reference: activeBooking.reference, otp: activeBooking.ride_otp });
          setStep(4);
          setLoading(false);
          return;
        }
      }

      const aiBookingStr = sessionStorage.getItem("ai_booking");
      if (aiBookingStr) {
        try {
          const ai = JSON.parse(aiBookingStr);
          const selVeh = vData.find(x => x.code === ai.vehicle);
          const pArea = aData.find(x => x.name.toLowerCase() === ai.pickup?.toLowerCase());
          const dArea = aData.find(x => x.name.toLowerCase() === ai.drop?.toLowerCase());
          if (selVeh) setSelectedVehicle(selVeh);
          if (pArea) setPickupId(pArea.id);
          if (dArea) setDropId(dArea.id);
          if (selVeh && pArea && dArea) setStep(3);
          sessionStorage.removeItem("ai_booking");
        } catch {}
      }

      setLoading(false);
    }
    fetchData();
  }, [user]);

  // Resolve pickup/drop from either area ID or GPS location
  const pickup = pickupGPS
    ? { name: pickupGPS.name, lat: pickupGPS.lat, lng: pickupGPS.lng }
    : areas.find(a => a.id === pickupId);
  const drop = dropGPS
    ? { name: dropGPS.name, lat: dropGPS.lat, lng: dropGPS.lng }
    : areas.find(a => a.id === dropId);
  const [distKm, setDistKm] = useState(0);
  useEffect(() => {
    if (pickup && drop) {
      if (typeof window !== "undefined" && (window as any).google?.maps?.DistanceMatrixService) {
        const service = new (window as any).google.maps.DistanceMatrixService();
        service.getDistanceMatrix({
          origins: [{ lat: pickup.lat, lng: pickup.lng }],
          destinations: [{ lat: drop.lat, lng: drop.lng }],
          travelMode: (window as any).google.maps.TravelMode.DRIVING,
        }, (response: any, status: any) => {
          if (status === 'OK' && response?.rows[0]?.elements[0]?.distance?.value) {
            // Convert meters to kilometers
            const roadDist = response.rows[0].elements[0].distance.value / 1000;
            setDistKm(Math.max(1, roadDist));
          } else {
            setDistKm(Math.max(1, haversine(pickup.lat, pickup.lng, drop.lat, drop.lng)));
          }
        });
      } else {
        setDistKm(Math.max(1, haversine(pickup.lat, pickup.lng, drop.lat, drop.lng)));
      }
    } else {
      setDistKm(0);
    }
  }, [pickup?.lat, pickup?.lng, drop?.lat, drop?.lng]);
  const fareBreakdown = selectedVehicle && distKm > 0 ? calcFare(selectedVehicle, distKm, pricingSettings) : null;


  async function confirmBooking() {
    if (!user) { navigate({ to: "/login", search: { redirect: "/book" } }); return; }
    if (!selectedVehicle || !pickup || !drop || !fareBreakdown) return;
    setSubmitting(true);
    
    const otp = generateOTP();

    // Ensure customer's profile is up to date with full name and phone number
    try {
      const custName = (user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split("@")[0] || "").trim();
      const custPhone = (user.user_metadata?.phone || user.phone || "").trim();
      if (custName || custPhone) {
        await supabase.from("profiles").upsert({
          id: user.id,
          full_name: custName || "Passenger",
          phone: custPhone,
          updated_at: new Date().toISOString(),
        }, { onConflict: "id" });
      }
    } catch (e) {
      console.warn("Could not sync profile before booking:", e);
    }

    const effectivePickup = pickupPillar
      ? `${pickup.name} (${pickupPillar})`
      : pickup.name;

    const encodedPickupAddress = encodePickupAddressWithPrefs(
      { lat: pickup.lat, lng: pickup.lng },
      { cabinClimate, quietRide, pickupPillar: pickupPillar || undefined }
    );

    const scheduledIso = isAdvanceBooking && scheduledDateTime ? new Date(scheduledDateTime).toISOString() : null;

    const { data, error } = await supabase.from("bookings").insert({
      customer_id: user.id,
      pickup_area: effectivePickup,
      pickup_address: encodedPickupAddress,
      drop_area: drop.name,
      drop_address: `${drop.lat},${drop.lng}`,
      distance_km: Math.round(distKm * 10) / 10,
      duration_min: Math.round(distKm / 0.5),
      vehicle_code: selectedVehicle.code,
      vehicle_name: selectedVehicle.name,
      base_fare: Math.round(fareBreakdown.base),
      distance_fare: Math.round(fareBreakdown.distance),
      tax_amount: Math.round(fareBreakdown.tax),
      estimated_fare: Math.round(fareBreakdown.total),
      payment_method: paymentMethod,
      status: isAdvanceBooking ? "scheduled" : "searching",
      scheduled_at: scheduledIso,
      ride_otp: otp,
    }).select("id, reference").single();
    
    if (error) { 
      console.error("Booking insert error:", error);
      toast.error(`Booking failed: ${error.message}`); 
      setSubmitting(false); 
      return; 
    }

    // Persist booking id in localStorage for instant tracking/profile access
    try {
      const stored = localStorage.getItem("@orange_booking_history_ids");
      const idList = stored ? JSON.parse(stored) : [];
      if (!idList.includes((data as any).id)) {
        idList.unshift((data as any).id);
        localStorage.setItem("@orange_booking_history_ids", JSON.stringify(idList.slice(0, 50)));
      }
    } catch (e) {}

    // Persist ride preferences for this booking (viewable by driver across devices)
    const ridePref = {
      cabinClimate,
      quietRide,
      pickupPillar: pickupPillar || undefined,
    };
    try {
      localStorage.setItem(`orange_ride_pref_${(data as any).id}`, JSON.stringify(ridePref));
      localStorage.setItem(`orange_ride_pref_${(data as any).reference}`, JSON.stringify(ridePref));
    } catch {}
    
    setBookingData({ id: (data as any).id, reference: (data as any).reference, otp });
    setLiveRideStatus(isAdvanceBooking ? "scheduled" : "searching");
    setStep(4);
    if (isAdvanceBooking) {
      toast.success("Advance Ride Scheduled! 🍊 Zero-surge fare locked.");
    } else {
      toast.success("Ride confirmed! Searching for nearest EV chauffeur.");
    }
    setSubmitting(false);
  }

  return <APIProvider apiKey={GOOGLE_MAPS_KEY}>
    {step !== 4 && (
      <section className="relative overflow-hidden bg-night text-foreground">
        <img src={passengerImage} alt="Passenger" className="absolute inset-0 size-full object-cover object-[70%_center]" />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--night)_0%,color-mix(in_oklab,var(--night)_82%,transparent)_42%,transparent_78%)]" />
        <div className="section-shell relative flex min-h-[35vh] md:min-h-[48vh] items-end py-8 md:items-center md:py-20 min-w-0 max-w-full">
          <div className="max-w-2xl animate-gentle-rise min-w-0">
            <p className="mb-3 md:mb-5 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">For passengers</p>
            <h1 className="display-serif text-3xl sm:text-4xl md:text-6xl leading-[0.95] text-foreground">Every ride,<br /><span className="text-primary">taken care of.</span></h1>
            <p className="mt-3 md:mt-7 max-w-xl text-sm leading-6 text-foreground/75 md:text-lg">Premium electric car, professional driver, complimentary water — designed to be your everyday way to travel.</p>
            <Button asChild size="lg" className="mt-5 md:mt-8"><a href="#booking">Book a Ride <ArrowRight /></a></Button>
          </div>
        </div>
      </section>
    )}

    <section id="booking" className={`bg-background text-foreground dark:bg-night dark:text-foreground min-w-0 max-w-full overflow-hidden ${step === 4 ? "py-4 sm:py-8" : "py-8 md:py-24"}`}>
      <div className="section-shell min-w-0 max-w-full">
        {step !== 4 && (
          <>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Book your Orange</p>
            <h2 className="display-serif mt-2 md:mt-4 text-3xl sm:text-4xl md:text-6xl leading-tight text-foreground dark:text-foreground">Plan your journey.</h2>
          </>
        )}

        {step !== 4 && (
          <div className="mt-6 md:mt-8 min-w-0 max-w-full">
            {/* Desktop stepper */}
            <div className="hidden sm:flex items-center gap-3">
              {([1, 2, 3] as const).map((s, i) => (
                <div key={s} className="flex items-center gap-3">
                  <div className={`grid size-7 place-items-center rounded-full text-xs font-bold transition-colors ${step >= s ? "bg-primary text-primary-foreground" : "border border-border text-muted-foreground dark:border-white/30 dark:text-muted-foreground/60"}`}>
                    {step > s ? <Check className="size-3.5" /> : s}
                  </div>
                  <span className={`text-xs font-semibold ${step === s ? "text-foreground dark:text-foreground" : "text-muted-foreground dark:text-muted-foreground/60"}`}>{["Choose vehicle", "Journey details", "Confirm"][i]}</span>
                  {i < 2 && <ChevronRight className="size-4 text-muted-foreground/50 dark:text-foreground/30" />}
                </div>
              ))}
            </div>

            {/* Mobile compact stepper */}
            <div className="sm:hidden flex items-center justify-between rounded-xl border border-border bg-card dark:border-white/15 dark:bg-card px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="flex size-6 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-primary-foreground">
                  {step}
                </span>
                <span className="text-xs font-semibold text-foreground dark:text-foreground">
                  {step === 1 ? "Choose Vehicle" : step === 2 ? "Select Route & Destination" : "Confirm Ride"}
                </span>
              </div>
              <span className="text-[11px] font-medium text-muted-foreground dark:text-muted-foreground">Step {step} of 3</span>
            </div>
          </div>
        )}

        <div className="mt-6 md:mt-10 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-start min-w-0 max-w-full">
          <div className="min-w-0 max-w-full rounded-2xl border border-border bg-card p-4 sm:p-7 shadow-lg dark:border-white/15 dark:bg-card">
            {loading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="size-8 animate-spin text-primary" />
              </div>
            ) : step === 1 ? (
              <Step1Vehicles
                vehicles={vehicles}
                selected={selectedVehicle}
                onSelect={setSelectedVehicle}
                onNext={() => {
                  if (!user) {
                    navigate({ to: "/login", search: { redirect: "/book" } });
                    return;
                  }
                  setStep(2);
                }}
              />
            ) : step === 2 ? (
              <Step2Journey
                areas={areas}
                pickupId={pickupId}
                dropId={dropId}
                onPickup={setPickupId}
                onDrop={setDropId}
                pickupGPS={pickupGPS}
                dropGPS={dropGPS}
                onPickupGPS={setPickupGPS}
                onDropGPS={setDropGPS}
                distKm={distKm}
                fareBreakdown={fareBreakdown}
                selectedVehicle={selectedVehicle!}
                locatingGPS={locatingGPS}
                onBack={() => setStep(1)}
                onNext={() => setStep(3)}
              />
            ) : step === 3 ? (
              <Step3Confirm
                selectedVehicle={selectedVehicle!}
                pickup={pickup!}
                drop={drop!}
                fareBreakdown={fareBreakdown!}
                distKm={distKm}
                paymentMethod={paymentMethod}
                onPaymentChange={setPaymentMethod}
                pickupPillar={pickupPillar}
                onPickupPillarChange={setPickupPillar}
                cabinClimate={cabinClimate}
                onCabinClimateChange={setCabinClimate}
                quietRide={quietRide}
                onQuietRideChange={setQuietRide}
                isAdvanceBooking={isAdvanceBooking}
                onAdvanceBookingChange={setIsAdvanceBooking}
                scheduledDateTime={scheduledDateTime}
                onScheduledDateTimeChange={setScheduledDateTime}
                onBack={() => setStep(2)}
                onConfirm={confirmBooking}
                submitting={submitting}
              />
            ) : (
              <Step4Confirmed
                bookingData={bookingData!}
                pickup={pickup!}
                drop={drop!}
                vehicle={selectedVehicle!}
                fare={fareBreakdown?.total || selectedVehicle?.minimum_fare || 500}
                distKm={distKm}
                onDriverUpdate={setLiveDriverInfo}
                onStatusUpdate={setLiveRideStatus}
                onReset={() => {
                  setStep(1);
                  setBookingData(null);
                  setLiveDriverInfo(null);
                  setLiveRideStatus("searching");
                  setDropGPS(null);
                  setDropId("");
                }}
              />
            )}
          </div>
          {step === 4 && pickup && drop ? (
            <div className="hidden lg:block sticky top-24 min-w-0 max-w-full">
              <LiveRideMap
                id="desktop-live-map"
                pickup={pickup}
                dropoff={drop}
                driverLocation={liveDriverInfo}
                rideStatus={liveRideStatus}
                distKm={distKm}
              />
            </div>
          ) : (
            <figure className="overflow-hidden rounded-xl hidden lg:block">
              <img src={interiorImage} alt="Premium Orange cabin" className="aspect-[4/3] size-full object-cover" />
            </figure>
          )}
        </div>
      </div>
    </section>
  </APIProvider>;
}

/* ---------- STEP 1 to 3 components omitted for brevity, keeping same logic ---------- */
function Step1Vehicles({ vehicles, selected, onSelect, onNext }: any) {
  return <div className="space-y-4 min-w-0 max-w-full">
    <p className="text-sm font-semibold text-foreground dark:text-foreground">Choose your ride</p>
    <div className="space-y-3 min-w-0 max-w-full">
      {vehicles.map((v: any) => (
        <button key={v.id} onClick={() => onSelect(v)} className={`w-full rounded-xl border p-3.5 sm:p-5 text-left transition-all min-w-0 max-w-full bg-card dark:bg-transparent ${selected?.id === v.id ? "border-primary bg-primary/10" : "border-border hover:border-primary/50 dark:border-white/15 dark:hover:border-white/30"}`}>
          <div className="flex items-start justify-between gap-3 min-w-0">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2"><BatteryCharging className="size-4 text-primary shrink-0" /><span className="text-sm font-bold text-foreground dark:text-foreground truncate">{v.name}</span></div>
              <p className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground truncate">{v.tagline}</p>
              <p className="mt-1.5 text-xs text-muted-foreground/80 dark:text-muted-foreground">{v.seats} seats</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-lg font-bold text-primary">₹{v.base_fare}</p>
              <p className="text-[11px] text-muted-foreground dark:text-muted-foreground">base + ₹{v.per_km}/km</p>
              <p className="text-[10px] text-muted-foreground/70 dark:text-muted-foreground/60">min ₹{v.minimum_fare}</p>
            </div>
          </div>
          {selected?.id === v.id && <div className="mt-2 flex items-center gap-1 text-xs font-semibold text-primary"><Check className="size-3" />Selected</div>}
        </button>
      ))}
    </div>
    <Button size="lg" className="mt-4 sm:mt-6 w-full" disabled={!selected} onClick={onNext}>Continue <ArrowRight /></Button>
  </div>;
}

function Step2Journey({ areas, pickupId, dropId, onPickup, onDrop, pickupGPS, dropGPS, onPickupGPS, onDropGPS, distKm, fareBreakdown, selectedVehicle, onBack, onNext, locatingGPS }: any) {
  // Start directly at drop-off destination selection (Pickup is automatically auto-detected via GPS)
  const [subStep, setSubStep] = useState<"pickup" | "drop">("drop");

  // Safeguard: Ensure pickup is NEVER empty in Step 2 so zero user clicks are needed
  useEffect(() => {
    if (!pickupGPS && !locatingGPS) {
      if (areas && areas.length > 0) {
        const centralArea = areas.find(a => !a.is_airport && !a.name.toLowerCase().includes("airport")) || areas[0];
        onPickupGPS({ name: centralArea.name, lat: centralArea.lat, lng: centralArea.lng });
      } else {
        onPickupGPS({
          name: "Indiranagar, Bengaluru",
          lat: 12.9784,
          lng: 77.6408,
        });
      }
    }
  }, [pickupGPS, locatingGPS, areas]);

  const hasPickup = !!(pickupGPS || pickupId);
  const hasDrop = !!(dropGPS || dropId);

  if (subStep === "pickup") {
    return (
      <div className="space-y-3 min-w-0 max-w-full">
        <div className="flex items-center justify-between rounded-xl bg-muted px-3.5 py-2.5 text-xs text-foreground border border-white/15 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <MapPin className="size-4 text-primary shrink-0" />
            <span className="font-semibold truncate">Select or Adjust Pickup Pin</span>
          </div>
          <button
            type="button"
            onClick={() => setSubStep("drop")}
            className="text-xs font-semibold text-primary underline hover:text-primary/80 shrink-0 ml-2"
          >
            Back to Destination →
          </button>
        </div>

        <MapPicker
          label="Pickup location"
          placeholder="Search street, landmark, or drag map..."
          areas={areas}
          apiKey={GOOGLE_MAPS_KEY}
          initialLocation={pickupGPS}
          onBack={() => setSubStep("drop")}
          onConfirm={(loc) => {
            onPickupGPS(loc);
            setSubStep("drop");
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 min-w-0 max-w-full">
      {/* {t("booking.pickup")} Status Banner (100% Zero-Click Auto-GPS) */}
      <div className="flex items-center justify-between gap-2.5 rounded-xl border border-emerald-500/40 bg-emerald-500/15 p-3 sm:p-3.5 text-xs text-foreground shadow-xs min-w-0 max-w-full">
        <div className="flex items-center gap-2.5 min-w-0 flex-1">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400">
            {locatingGPS ? (
              <Loader2 className="size-4 animate-spin text-emerald-400" />
            ) : (
              <Crosshair className="size-4 animate-pulse" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-[10px] uppercase font-bold tracking-wider text-emerald-400">Pickup</p>
              <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-300">
                {locatingGPS ? "Syncing..." : pickupGPS ? "Live GPS Locked" : "GPS Pending"}
              </span>
            </div>
            <p className="truncate font-medium text-foreground text-xs">
              {pickupGPS?.name || (locatingGPS ? "Acquiring live pickup location..." : "Tap Change to set pickup location")}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setSubStep("pickup")}
          className="shrink-0 text-xs font-semibold text-emerald-400 underline hover:text-emerald-300 px-1"
        >
          Change
        </button>
      </div>

      {/* Main Destination MapPicker (Only destination needed) */}
      <MapPicker
        label="Drop-off destination"
        placeholder="Where are you going? Search destination, hotel, mall, or drag map..."
        areas={areas}
        apiKey={GOOGLE_MAPS_KEY}
        initialLocation={dropGPS}
        fallbackCenter={pickupGPS}
        onBack={onBack}
        onConfirm={(loc) => {
          onDropGPS(loc);
        }}
      />

      {fareBreakdown && distKm > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/10 p-4 min-w-0 max-w-full">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-primary">Fare estimate ({selectedVehicle?.name})</p>
            <span className="text-[11px] text-muted-foreground shrink-0">~{Math.round(distKm * 10) / 10} km · {Math.max(1, Math.round(distKm / 0.5))} min</span>
          </div>
          <p className="mt-2 text-2xl sm:text-3xl font-bold text-foreground font-mono">₹{Math.round(fareBreakdown.total)}</p>
        </div>
      )}

      {hasDrop && hasPickup && (
        <Button size="lg" className="mt-2 w-full" onClick={onNext}>
          Review & Confirm <ArrowRight />
        </Button>
      )}
    </div>
  );
}


function Step3Confirm({
  selectedVehicle,
  pickup,
  drop,
  fareBreakdown,
  distKm,
  paymentMethod,
  onPaymentChange,
  pickupPillar,
  onPickupPillarChange,
  cabinClimate,
  onCabinClimateChange,
  quietRide,
  onQuietRideChange,
  isAdvanceBooking,
  onAdvanceBookingChange,
  scheduledDateTime,
  onScheduledDateTimeChange,
  onBack,
  onConfirm,
  submitting,
}: any) {
  const isAirportOrHub =
    pickup?.name?.toLowerCase().includes("airport") ||
    pickup?.name?.toLowerCase().includes("terminal") ||
    pickup?.name?.toLowerCase().includes("kempegowda") ||
    pickup?.name?.toLowerCase().includes("tech park") ||
    pickup?.name?.toLowerCase().includes("manyata") ||
    pickup?.name?.toLowerCase().includes("ecospace") ||
    pickup?.is_airport;

  return (
    <div className="space-y-4 min-w-0 max-w-full">
      <p className="text-sm font-semibold text-foreground">Review & Customize Ride</p>
      <div className="space-y-3 min-w-0 max-w-full">
        {/* Journey Card */}
        <div className="rounded-xl border border-white/15 p-4 sm:p-5 space-y-3 min-w-0 max-w-full">
          <Row label="Vehicle" value={selectedVehicle.name} />
          <Row label="Pickup" value={pickupPillar ? `${pickup.name} (${pickupPillar})` : pickup.name} />
          <Row label="Drop-off" value={drop.name} />
          <div className="flex items-center justify-between border-t border-border pt-3">
            <span className="font-bold text-foreground">Total Fare</span>
            <span className="text-xl font-bold text-primary font-mono">₹{Math.round(fareBreakdown.total)}</span>
          </div>
        </div>

        {/* Airport / Landmark Terminal & Pillar Selector */}
        {isAirportOrHub && (
          <div className="rounded-xl border border-primary/40 bg-primary/10 p-3.5 space-y-2">
            <div className="flex items-center gap-1.5">
              <MapPin className="size-3.5 text-primary" />
              <label className="text-[11px] font-bold uppercase tracking-wider text-foreground">
                Select Pickup Pillar / Gate Landmark (Optional)
              </label>
            </div>
            <Select value={pickupPillar} onValueChange={onPickupPillarChange}>
              <SelectTrigger className="bg-muted border-input text-foreground text-xs h-10">
                <SelectValue placeholder="Select Pickup Pillar or Gate (e.g. T2 Pillar 4B)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="T1 - Pillar 1 to 4 (Zone A)">🛫 Terminal 1 — Pick-up Zone A (Pillars 1 to 4)</SelectItem>
                <SelectItem value="T1 - Pillar 5 to 8 (Zone B)">🛫 Terminal 1 — Pick-up Zone B (Pillars 5 to 8)</SelectItem>
                <SelectItem value="T2 - Arrivals Curb (Pillars 1 to 3)">🛫 Terminal 2 — Arrivals Curb (Pillars 1 to 3)</SelectItem>
                <SelectItem value="T2 - Commercial Zone (Pillars 4 to 6)">🛫 Terminal 2 — Commercial Zone (Pillars 4 to 6)</SelectItem>
                <SelectItem value="Main Gate 1 (Visitor Reception)">🏢 Main Gate 1 (Visitor Reception)</SelectItem>
                <SelectItem value="Gate 2 (Tower 3 & 4 Pick-up)">🏢 Gate 2 (Tower 3 & 4 Pick-up Bay)</SelectItem>
                <SelectItem value="Curb-side Taxi Stand">🚕 Dedicated Curb Taxi Stand</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Pre-Ride Cabin Climate Preference */}
        <div className="rounded-xl border border-white/15 bg-card p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
              <Snowflake className="size-3.5 text-primary" />
              Cabin Climate Preference
            </span>
            <span className="text-[10px] font-semibold text-primary">Pre-cooled before arrival</span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              { id: "chilled", label: "Chilled", temp: "20°C", icon: "❄️" },
              { id: "pleasant", label: "Pleasant", temp: "23°C", icon: "🍃" },
              { id: "eco", label: "Eco / Mild", temp: "Fresh", icon: "🌿" },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => onCabinClimateChange(item.id)}
                className={`rounded-xl border p-2 text-center transition-all ${
                  cabinClimate === item.id
                    ? "border-primary bg-primary/20 text-foreground font-bold shadow-sm scale-102"
                    : "border-input bg-muted text-muted-foreground hover:border-muted-foreground hover:text-foreground"
                }`}
              >
                <span className="text-sm block">{item.icon}</span>
                <span className="text-xs block font-bold mt-0.5">{item.label}</span>
                <span className="text-[10px] text-muted-foreground block">{item.temp}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Quiet Ride Mode Toggle */}
        <div className="rounded-xl border border-white/15 bg-card p-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0">
              <VolumeX className="size-4" />
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">Quiet Ride Mode</p>
              <p className="text-[10px] text-muted-foreground">Executive peace — no conversation or music (work calls / resting)</p>
            </div>
          </div>
          <input
            type="checkbox"
            checked={quietRide}
            onChange={e => onQuietRideChange(e.target.checked)}
            className="size-4.5 accent-primary rounded cursor-pointer shrink-0"
          />
        </div>

        {/* Pickup Timing: Ride Now vs Schedule Advance */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pickup Timing</p>
          <div className="mt-2.5 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => onAdvanceBookingChange?.(false)}
              className={`flex items-center justify-center gap-2 rounded-lg border p-3.5 text-xs font-bold transition-all ${
                !isAdvanceBooking
                  ? "border-primary bg-primary/20 text-foreground shadow-sm"
                  : "border-white/15 bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Clock className="size-4 text-primary" />
              <span>Ride Now (Instant)</span>
            </button>
            <button
              type="button"
              onClick={() => onAdvanceBookingChange?.(true)}
              className={`flex items-center justify-center gap-2 rounded-lg border p-3.5 text-xs font-bold transition-all ${
                isAdvanceBooking
                  ? "border-purple-400 bg-purple-500/25 text-foreground shadow-sm"
                  : "border-white/15 bg-card text-muted-foreground hover:text-foreground"
              }`}
            >
              <Calendar className="size-4 text-purple-400" />
              <span>Schedule for Later</span>
            </button>
          </div>

          {isAdvanceBooking && (
            <div className="mt-3 rounded-xl border border-purple-400/40 bg-purple-500/10 p-4 space-y-2">
              <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                <Calendar className="size-3.5" />
                <span>Select Departure Date & Time:</span>
              </label>
              <input
                type="datetime-local"
                value={scheduledDateTime}
                onChange={(e) => onScheduledDateTimeChange?.(e.target.value)}
                min={new Date(Date.now() + 15 * 60 * 1000).toISOString().slice(0, 16)}
                className="w-full rounded-lg border border-input bg-black/60 px-3.5 py-2.5 text-sm font-semibold text-foreground focus:border-purple-400 focus:outline-none"
              />
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                • <strong>Zero-Surge Fare Locked</strong>: Your fare will never increase.<br />
                • <strong>Chauffeur Assignment</strong>: Verified EV Chauffeur dispatched 15–30 mins prior.<br />
                • <strong>Pre-Cooling SLA</strong>: Chauffeur arrives 5–10 mins prior with Dual-Zone AC at 22°C.
              </p>
            </div>
          )}
        </div>

        {/* Payment Method */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Payment method</p>
          <RadioGroup value={paymentMethod} onValueChange={onPaymentChange} className="mt-2.5 flex gap-3">
            {([["cash", "Cash"], ["upi", "UPI"]] as const).map(([val, label]) => (
              <label key={val} className={`flex flex-1 cursor-pointer items-center gap-3 rounded-lg border p-3.5 sm:p-4 min-w-0 ${paymentMethod === val ? "border-primary bg-primary/10" : "border-white/15 hover:border-white/30"}`}>
                <RadioGroupItem value={val} className="border-muted-foreground text-primary" />
                <Wallet className="size-4 text-primary shrink-0" />
                <span className="text-sm font-semibold text-foreground">{label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      </div>

      {/* Affirmative Booking Consent under Consumer Protection Rules */}
      <div className="mt-4 rounded-lg border border-white/15 bg-card p-3 text-[11px] text-foreground/65 leading-relaxed min-w-0">
        By confirming, you agree to our <Link to="/terms" target="_blank" className="text-primary underline">Terms of Service</Link>, <Link to="/privacy" target="_blank" className="text-primary underline">Privacy Policy</Link>, and fee-exempt cancellation rules under MV Aggregator Guidelines 2025.
      </div>
      <div className="mt-5 flex gap-3 min-w-0">
        <Button variant="ghost" className="text-muted-foreground hover:text-foreground" onClick={onBack}>Back</Button>
        <Button size="lg" className="flex-1" onClick={onConfirm} disabled={submitting}>
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <>Confirm Ride <ArrowRight /></>}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return <div className="flex justify-between gap-3 text-sm min-w-0"><span className="text-muted-foreground shrink-0">{label}</span><span className="font-semibold text-foreground truncate text-right">{value}</span></div>;
}

/* ---------- STEP 4: Live Tracking ---------- */
function Step4Confirmed({
  bookingData,
  pickup,
  drop,
  vehicle,
  fare,
  distKm,
  onDriverUpdate,
  onStatusUpdate,
  onReset,
}: {
  bookingData: { id: string; reference: string; otp: string };
  pickup: ServiceArea;
  drop: ServiceArea;
  vehicle: VehicleCategory;
  fare: number;
  distKm?: number;
  onDriverUpdate?: (driver: any) => void;
  onStatusUpdate?: (status: string) => void;
  onReset?: () => void;
}) {
  const { user } = useAuth();
  const [status, setStatus] = useState("searching");
  const [driverInfo, setDriverInfo] = useState<DriverInfo | null>(null);
  const [currentBooking, setCurrentBooking] = useState<any>(null);
  const [arrivedAt, setArrivedAt] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [ratingModalOpen, setRatingModalOpen] = useState(false);
  const [taxInvoiceModalOpen, setTaxInvoiceModalOpen] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelReason, setCancelReason] = useState("delay");
  const lastNotifiedStatusRef = useRef<string>("");
  const isFirstLoadRef = useRef<boolean>(true);

  const triggerRideNotification = (newStatus: string, driverObj?: any) => {
    if (!newStatus || lastNotifiedStatusRef.current === newStatus) return;
    if (newStatus === "searching") return;
    lastNotifiedStatusRef.current = newStatus;

    const currentDriver = driverObj || driverInfo;
    const content = getStatusNotificationContent(
      newStatus,
      {
        name: currentDriver?.name || "Your Chauffeur",
        plate: currentDriver?.plate,
        vehicle: currentDriver?.vehicle || vehicle?.name,
        otp: bookingData.otp,
      },
      bookingData.reference,
      drop?.name
    );

    if (content) {
      sendRideNotification({
        title: content.title,
        body: content.body,
        url: "/book",
        tag: content.tag,
        data: {
          bookingId: bookingData.id,
          reference: bookingData.reference,
          status: newStatus,
        },
      });
    }
  };

  async function handleCancelRide() {
    setCancelling(true);
    const { error } = await supabase.from("bookings").update({ status: "cancelled" }).eq("id", bookingData.id);
    if (error) {
      toast.error("Failed to cancel ride: " + error.message);
      setCancelling(false);
    } else {
      setStatus("cancelled");
      onStatusUpdate?.("cancelled");
      triggerRideNotification("cancelled");
      setCancelModalOpen(false);
      toast.success("Ride cancelled. ₹0 fee applied under statutory exemption.");
      setCancelling(false);
      onReset?.();
    }
  }

  function handleStatusChange(newStatus: string, driverObj?: any) {
    setStatus(newStatus);
    onStatusUpdate?.(newStatus);
    triggerRideNotification(newStatus, driverObj);
    if (newStatus === "completed") {
      setRatingModalOpen(true);
    }
  }

  function handleDriverChange(d: any) {
    setDriverInfo(d);
    onDriverUpdate?.(d);
    if (status === "accepted" || status === "arrived") {
      triggerRideNotification(status, d);
    }
  }

  async function fetchDriverWithPhone(driverId: string) {
    try {
      const resolved = await fetchAndHydrateDriverDetails(supabase, driverId, currentBooking || bookingData);
      return resolved;
    } catch (e) {
      console.warn("Could not fetch driver details:", e);
      return null;
    }
  }

  useEffect(() => {
    let driverChannel: any = null;

    function subscribeToDriver(driverId: string) {
      if (driverChannel) supabase.removeChannel(driverChannel);
      driverChannel = supabase.channel(`driver-${driverId}`)
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "drivers", filter: `id=eq.${driverId}` }, (driverPayload) => {
          setDriverInfo(prev => {
            const updated = prev ? { ...prev, ...driverPayload.new } : (driverPayload.new as any);
            const fullyResolved = resolveDriverDetails(updated, currentBooking || bookingData);
            onDriverUpdate?.(fullyResolved);
            return fullyResolved;
          });
        }).subscribe();
    }

    // 1. Initial load: immediately check if driver is already assigned to this booking
    async function loadInitial() {
      const { data: b } = await supabase.from("bookings").select("*, driver_id, status, rating, arrived_at, vehicle_name, reference").eq("id", bookingData.id).single();
      if (b) {
        setCurrentBooking(b);
        if (b.status === "cancelled") {
          onReset?.();
          return;
        }
        if (b.arrived_at) {
          setArrivedAt(b.arrived_at);
        }
        if (b.status) {
          if (isFirstLoadRef.current) {
            isFirstLoadRef.current = false;
            lastNotifiedStatusRef.current = b.status;
            setStatus(b.status);
            onStatusUpdate?.(b.status);
          } else {
            handleStatusChange(b.status);
          }
          if (b.status === "completed" && !b.rating) {
            setRatingModalOpen(true);
          }
        }
        if (b.driver_id) {
          const d = await fetchDriverWithPhone(b.driver_id);
          if (d) {
            handleDriverChange(d);
            subscribeToDriver(d.id);
          }
        }
      }
    }
    loadInitial();

    // Polling fallback every 3 seconds to guarantee instant status & waiting window detection
    const pollInterval = setInterval(loadInitial, 3000);

    // 2. Subscribe to booking status updates
    const bookingChannel = supabase.channel(`booking-${bookingData.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings", filter: `id=eq.${bookingData.id}` }, async (payload) => {
        const newStatus = payload.new.status;
        setCurrentBooking((prev: any) => ({ ...prev, ...payload.new }));
        if (payload.new.arrived_at) {
          setArrivedAt(payload.new.arrived_at);
        }
        handleStatusChange(newStatus);
        
        if (newStatus === "cancelled") {
          toast.info("Ride has been cancelled.");
          onReset?.();
          return;
        }

        // If driver assigned, fetch driver details
        if (payload.new.driver_id) {
          const d = await fetchDriverWithPhone(payload.new.driver_id);
          if (d) {
            handleDriverChange(d);
            subscribeToDriver(d.id);
            if (newStatus === "accepted" || newStatus === "arrived") {
              triggerRideNotification(newStatus, d);
            }
          }
        }
      }).subscribe();
      
    return () => {
      clearInterval(pollInterval);
      supabase.removeChannel(bookingChannel);
      if (driverChannel) supabase.removeChannel(driverChannel);
    };
  }, [bookingData.id]);

  const activeDriverPhone = driverInfo?.phone && driverInfo.phone.trim() !== "" ? driverInfo.phone.trim() : "+91 11 4000 7000";
  const cleanDialPhone = activeDriverPhone.replace(/[^0-9+]/g, "");

  const [guardianModalOpen, setGuardianModalOpen] = useState(false);
  const [guardianContact, setGuardianContact] = useState<{ name: string; phone: string } | null>(() => {
    if (typeof window !== "undefined") {
      try {
        const s = localStorage.getItem("orange_guardian_contact");
        return s ? JSON.parse(s) : null;
      } catch (e) {
        return null;
      }
    }
    return null;
  });

  useEffect(() => {
    const handleUpdate = (e: any) => {
      if (e.detail) setGuardianContact(e.detail);
      else {
        try {
          const s = localStorage.getItem("orange_guardian_contact");
          if (s) setGuardianContact(JSON.parse(s));
        } catch (err) {}
      }
    };
    window.addEventListener("guardian_contact_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);
    return () => {
      window.removeEventListener("guardian_contact_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  return <div className="flex flex-col py-2">
    <NotificationBanner context="rider" className="mb-4" />
    <div className="flex items-center gap-4 border-b border-border pb-6">
      <span className="grid size-12 shrink-0 place-items-center rounded-full bg-primary/20 text-primary"><CheckCircle className="size-6" /></span>
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{status === "searching" ? "Finding driver" : status === "scheduled" ? "Advance Booking Guaranteed" : status.replace("_", " ")}</p>
        <p className="display-serif text-2xl text-foreground">Ref: {bookingData.reference}</p>
      </div>
    </div>

    {/* Advance Scheduled Booking Details Banner */}
    {status === "scheduled" && (
      <div className="mt-6 rounded-2xl border-2 border-purple-500/60 bg-gradient-to-r from-purple-500/20 via-primary/10 to-purple-500/10 p-5 space-y-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-3.5">
          <div className="size-12 rounded-2xl bg-purple-600 text-foreground flex items-center justify-center shrink-0 shadow-md">
            <Calendar className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-purple-400 animate-pulse" />
              <p className="text-xs font-extrabold uppercase tracking-wider text-purple-300">Advance Chauffeur Reserved</p>
            </div>
            <p className="text-base font-bold text-foreground mt-0.5">
              {currentBooking?.scheduled_at
                ? new Date(currentBooking.scheduled_at).toLocaleDateString("en-IN", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                    hour12: true,
                  })
                : "Scheduled Departure"}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 text-xs border-t border-purple-400/30">
          <div className="rounded-lg bg-black/40 p-2.5 border border-border">
            <span className="text-[10px] uppercase text-muted-foreground font-semibold">Locked Fare</span>
            <p className="font-mono text-base font-bold text-primary">₹{fare}</p>
            <span className="text-[10px] text-muted-foreground">Zero surge guaranteed</span>
          </div>
          <div className="rounded-lg bg-black/40 p-2.5 border border-border">
            <span className="text-[10px] uppercase text-muted-foreground font-semibold">Chauffeur Dispatch</span>
            <p className="font-semibold text-foreground">Broadcasts T-25m</p>
            <span className="text-[10px] text-muted-foreground">High-priority alert</span>
          </div>
          <div className="col-span-2 sm:col-span-1 rounded-lg bg-black/40 p-2.5 border border-border">
            <span className="text-[10px] uppercase text-muted-foreground font-semibold">Arrival SLA</span>
            <p className="font-semibold text-foreground">Pre-cooled 22°C</p>
            <span className="text-[10px] text-muted-foreground">5–10 mins prior</span>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Button asChild className="flex-1 bg-purple-600 hover:bg-purple-700 text-foreground font-bold h-10 text-xs">
            <Link to="/track" search={{ ref: bookingData.reference }}>
              Open Dedicated Live Radar →
            </Link>
          </Button>
          <Button asChild variant="outline" className="border-input text-foreground hover:bg-muted h-10 text-xs">
            <Link to="/profile">
              View in My Profile
            </Link>
          </Button>
        </div>
      </div>
    )}

    {/* OTP Display / Trip in Progress Banner */}
    {status === "in_progress" ? (
      <div className="mt-6 rounded-2xl border border-emerald-500/40 bg-gradient-to-r from-emerald-500/15 via-emerald-500/10 to-transparent p-4 flex items-center justify-between gap-4 shadow-lg backdrop-blur-sm">
        <div className="flex items-center gap-3.5">
          <div className="size-11 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 shadow-inner">
            <CheckCircle className="size-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-400">Ride In Progress · OTP Verified</p>
            </div>
            <p className="text-sm font-semibold text-foreground mt-0.5">Your chauffeur is en route to destination</p>
          </div>
        </div>
        <div className="text-right shrink-0">
          <span className="rounded-full bg-emerald-500/20 border border-emerald-500/40 px-3 py-1 text-xs font-mono font-bold text-emerald-300">
            Trip Active ⚡
          </span>
        </div>
      </div>
    ) : status !== "completed" && bookingData.otp ? (
      <div className="mt-6 rounded-xl border border-primary/30 bg-primary/10 p-5 text-center">
        <p className="text-xs font-bold uppercase tracking-wider text-primary">Ride OTP</p>
        <p className="mt-2 text-4xl font-mono font-bold tracking-widest text-foreground">{bookingData.otp}</p>
        <p className="mt-2 text-xs text-muted-foreground">Show this code to your driver to start the ride</p>
      </div>
    ) : null}

    {/* Waiting Time Window & Fee Countdown Bar */}
    {status === "arrived" ? (
      <div className="mt-4">
        <WaitingFeeTimer arrivedAt={arrivedAt || new Date().toISOString()} />
      </div>
    ) : status === "accepted" ? (
      <div className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <Clock className="size-4 shrink-0 text-amber-400" />
          <span className="font-semibold text-foreground">
            Complimentary Waiting Window: <span className="text-amber-400 font-bold">3 minutes free</span> once driver arrives
          </span>
        </div>
        <span className="text-[11px] text-muted-foreground shrink-0 font-mono">₹2/min thereafter</span>
      </div>
    ) : status === "searching" ? (
      <div className="mt-4 rounded-xl border border-primary/30 bg-primary/10 p-3.5 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <Clock className="size-4 shrink-0 text-primary animate-pulse" />
          <span className="font-semibold text-foreground">
            Estimated dispatch wait: <span className="text-primary font-bold">1–3 mins</span>
          </span>
        </div>
        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
          <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> Fleet nearby
        </span>
      </div>
    ) : null}

    {/* Driver & Assigned Vehicle Details Card - Always Visible when assigned or in-progress */}
    {driverInfo || status === "in_progress" || status === "accepted" || status === "arrived" ? (() => {
      const displayModel = driverInfo?.vehicle_model || currentBooking?.vehicle_name || vehicle.name;
      const displayPlate = driverInfo?.vehicle_number && driverInfo.vehicle_number !== "Unassigned"
        ? driverInfo.vehicle_number
        : getBookingVehiclePlate(currentBooking || bookingData, driverInfo) || "DL 01 EV 1001";
      const driverName = driverInfo?.full_name || "Assigned Chauffeur";

      return (
        <div className="mt-6 rounded-2xl border border-white/15 bg-card p-5 backdrop-blur-xs shadow-xl">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <div className="flex items-center gap-2">
              <Car className="size-4 text-primary" />
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {status === "in_progress" ? "Your Ride Vehicle & Chauffeur" : "Assigned Vehicle & Driver"}
              </p>
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
              <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" /> {status === "in_progress" ? "On Journey" : "Assigned & Active"}
            </span>
          </div>

          {/* Prominent Vehicle Highlight Bar */}
          <div className="mt-4 p-3.5 rounded-xl border border-primary/30 bg-primary/10 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="size-10 rounded-lg bg-primary/20 border border-primary/40 flex items-center justify-center text-primary">
                <Car className="size-5" />
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider font-semibold text-primary/80">Vehicle Model</p>
                <p className="text-base font-bold text-foreground flex items-center gap-2">
                  {displayModel}
                  <span className="text-[11px] font-medium text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded-full border border-emerald-500/30">
                    100% Electric EV
                  </span>
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">Registration Plate</p>
              <span className="mt-0.5 inline-block font-mono text-base font-extrabold tracking-widest text-primary bg-black/40 border border-primary/40 px-3 py-1 rounded-lg">
                {displayPlate}
              </span>
            </div>
          </div>

          <div className="mt-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center gap-3.5">
                {/* High-Resolution Driver Photo / Verified Avatar (Clause 14.9) */}
                <div className="relative size-12 shrink-0">
                  {driverInfo?.photo_url ? (
                    <img
                      src={driverInfo.photo_url}
                      alt={driverName}
                      className="size-12 rounded-full object-cover border-2 border-primary shadow-sm"
                    />
                  ) : (
                    <div className="size-12 rounded-full border-2 border-primary bg-primary/20 flex items-center justify-center text-primary font-bold text-lg shadow-sm">
                      <span>{driverName.charAt(0) || "D"}</span>
                    </div>
                  )}
                  <span className="absolute -bottom-0.5 -right-0.5 size-4 rounded-full bg-emerald-500 border-2 border-neutral-900 flex items-center justify-center text-[9px] text-foreground font-bold" title="Police Verified & Onboarded Driver">
                    ✓
                  </span>
                </div>
                <div className="space-y-1">
                  <p className="text-lg font-bold text-foreground flex items-center gap-2">
                    {driverName}
                    <span className="rounded bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-semibold text-emerald-400 px-1.5 py-0.5">
                      Verified Chauffeur
                    </span>
                    {driverInfo?.driver_type === "partner" && (
                      <span className="rounded bg-primary/20 border border-primary/40 text-[10px] font-semibold text-primary px-1.5 py-0.5">
                        Partner EV
                      </span>
                    )}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                    <span className="text-amber-400 font-bold">⭐ {driverInfo?.rating ? Number(driverInfo.rating).toFixed(1) : "4.9"}</span>
                    <span>·</span>
                    <span className="text-muted-foreground">{driverInfo?.total_rides || 1} rides completed</span>
                  </div>
                </div>
              </div>

              {/* Prominently Display Driver Phone Number with Copy Button */}
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <div className="flex items-center gap-1.5 rounded-lg border border-primary/40 bg-primary/10 px-3 py-1.5 text-xs font-mono font-bold text-primary">
                  <Phone className="size-3 text-primary" />
                  <span>{activeDriverPhone}</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(activeDriverPhone);
                    toast.success(`Copied driver phone: ${activeDriverPhone}`);
                  }}
                  className="flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors border border-input"
                  title="Copy phone number to clipboard"
                >
                  <Copy className="size-3" /> Copy
                </button>
              </div>
            </div>

            {/* Action Buttons: Call Driver, WhatsApp & In-Ride Chat */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              <a
                href={`tel:${cleanDialPhone}`}
                onClick={() => {
                  navigator.clipboard?.writeText(activeDriverPhone);
                  toast.success(`Calling ${driverName}: ${activeDriverPhone}`);
                }}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-95"
              >
                <PhoneCall className="size-4" />
                <span>Call Driver</span>
              </a>

              {driverInfo?.phone && driverInfo.phone.trim() !== "" && (
                <a
                  href={`https://wa.me/${cleanDialPhone.startsWith("91") ? cleanDialPhone : `91${cleanDialPhone}`}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3.5 py-2.5 text-xs font-bold text-emerald-400 hover:bg-emerald-500/20 transition-all active:scale-95"
                  title="Chat with driver on WhatsApp"
                >
                  <MessageSquare className="size-3.5" />
                  <span>WhatsApp</span>
                </a>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsChatOpen(true);
                  setUnreadChatCount(0);
                }}
                className="relative flex items-center gap-1.5 rounded-xl border border-primary/40 bg-primary/20 px-3.5 py-2.5 text-xs font-bold text-primary hover:bg-primary/30 transition-all active:scale-95"
                title="Open Live Chat with Driver"
              >
                <MessageSquare className="size-3.5" />
                <span>In-Ride Chat</span>
                {unreadChatCount > 0 && (
                  <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-bounce">
                    {unreadChatCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {(!driverInfo?.phone || driverInfo.phone.trim() === "") && (
            <p className="mt-3 text-[11px] text-muted-foreground italic">
              * Direct line being connected. Calling connects to the 24/7 Orange Fleet Helpline.
            </p>
          )}
        </div>
      );
    })() : (
      <div className="mt-6 flex flex-col items-center justify-center rounded-xl border border-dashed border-white/15 py-10">
        <Loader2 className="size-6 animate-spin text-primary" />
        <p className="mt-3 text-sm text-muted-foreground">Matching you with the nearest {vehicle.name}...</p>
      </div>
    )}

    {/* Guardian Call & Safety Shield Card */}
    <div className="mt-5 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-center justify-between gap-3 flex-wrap">
      <div className="flex items-center gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-400">
          <ShieldAlert className="size-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-wider text-amber-300">
              Guardian Shield & SOS
            </p>
            <span className="rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[10px] font-semibold px-2 py-0.5">
              24/7 Safety
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {guardianContact
              ? `Guardian: ${guardianContact.name} (${guardianContact.phone})`
              : "Set emergency contact for 1-tap guardian call & live ride alerts"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={() => setGuardianModalOpen(true)}
          className="bg-amber-600 hover:bg-amber-700 text-foreground font-bold text-xs px-4 py-2.5 rounded-xl flex items-center gap-2 shadow-md active:scale-95 transition-all"
        >
          <PhoneCall className="size-3.5 animate-pulse" />
          <span>Guardian Call</span>
        </Button>
      </div>
    </div>

    {/* Fee-Exempt Cancellation Option (Clause 18 MV Aggregator Guidelines) */}
    {(status === "searching" || status === "accepted" || status === "arrived") && (
      <div className="mt-4 flex items-center justify-between rounded-xl border border-border bg-card p-3 text-xs">
        <span className="text-muted-foreground">Need to change your ride?</span>
        <button
          type="button"
          onClick={() => setCancelModalOpen(true)}
          className="text-xs font-semibold text-rose-400 hover:text-rose-300 underline"
        >
          Cancel Ride (Fee-Exempt Options)
        </button>
      </div>
    )}

    {/* Fee-Exempt Cancel Dialog */}
    <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
      <DialogContent className="max-w-md bg-background text-foreground border-border">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2 text-foreground">
            <XCircle className="size-5 text-destructive" />
            Cancel Ride Request
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Under Clause 18 of the MV Aggregator Guidelines 2025, cancellations meeting statutory grounds carry <strong>₹0 cancellation fee</strong>.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4 space-y-2 text-xs">
          <p className="font-semibold text-foreground">Select Reason for Cancellation:</p>
          {[
            { id: "delay", label: "Driver delayed (> 5 mins past ETA)", fee: "₹0 Fee" },
            { id: "mismatch", label: "Driver or vehicle plate mismatch at pickup", fee: "₹0 Fee" },
            { id: "offline", label: "Driver asked for off-app / offline cash fare", fee: "₹0 Fee" },
            { id: "plans", label: "Change of plans (Within free cancellation window)", fee: "₹0 Fee" },
          ].map((item) => (
            <label
              key={item.id}
              className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                cancelReason === item.id ? "border-primary bg-primary/10 text-foreground" : "border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              <div className="flex items-center gap-2.5">
                <input
                  type="radio"
                  name="cancel_reason"
                  checked={cancelReason === item.id}
                  onChange={() => setCancelReason(item.id)}
                  className="accent-primary"
                />
                <span>{item.label}</span>
              </div>
              <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                {item.fee}
              </span>
            </label>
          ))}
        </div>

        <div className="mt-5 flex gap-2 justify-end">
          <Button variant="ghost" size="sm" onClick={() => setCancelModalOpen(false)}>
            Keep Ride
          </Button>
          <Button
            variant="destructive"
            size="sm"
            onClick={handleCancelRide}
            disabled={cancelling}
          >
            {cancelling ? <Loader2 className="size-3.5 animate-spin" /> : "Confirm Cancellation"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>

    {/* Guardian Safety Modal Dialog */}
    <GuardianSafetyModal
      open={guardianModalOpen}
      onOpenChange={setGuardianModalOpen}
      bookingData={bookingData}
      driverInfo={driverInfo}
      pickup={pickup}
      drop={drop}
      vehicle={vehicle}
    />

    {/* In-Ride Real-Time Chat Drawer */}
    <RideChatSheet
      bookingId={bookingData.id}
      bookingReference={bookingData.reference}
      currentUserType="customer"
      currentUserName={user?.user_metadata?.full_name || user?.email?.split("@")[0] || "Passenger"}
      otherPartyName={driverInfo?.full_name || "Driver"}
      otherPartyPhone={activeDriverPhone}
      isOpen={isChatOpen}
      onOpenChange={setIsChatOpen}
      onUnreadCountChange={setUnreadChatCount}
    />

    {/* Live Map (Mobile View) */}
    <div className="mt-6 lg:hidden">
      <LiveRideMap
        id="mobile-live-map"
        pickup={pickup}
        dropoff={drop}
        driverLocation={driverInfo}
        rideStatus={status}
        distKm={distKm}
      />
    </div>

    {/* 5-Star Post-Ride Rating Modal */}
    <RatingModal
      open={ratingModalOpen}
      onOpenChange={setRatingModalOpen}
      booking={{
        id: bookingData.id,
        reference: bookingData.reference,
        pickup_area: pickup.name,
        drop_area: drop.name,
        estimated_fare: fare,
        driver_id: driverInfo?.id,
      }}
      driver={driverInfo}
      onSubmitted={() => {
        if (onReset) onReset();
        else window.location.reload();
      }}
    />

    {/* Completed Ride GST Tax Invoice Banner */}
    {status === "completed" && (
      <div className="mt-5 rounded-2xl border border-primary/30 bg-primary/10 p-4 flex items-center justify-between gap-3 flex-wrap shadow-sm">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-xl bg-primary/20 flex items-center justify-center text-primary">
            <FileText className="size-4" />
          </div>
          <div>
            <p className="text-xs font-bold text-foreground">Official GST Tax Invoice Ready</p>
            <p className="text-[11px] text-muted-foreground">ORANGE TAXI LIMITED · SAC 996412 · 5% GST</p>
          </div>
        </div>
        <Button
          type="button"
          size="sm"
          onClick={() => setTaxInvoiceModalOpen(true)}
          className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs px-3.5 h-8 gap-1.5 shadow"
        >
          <FileText className="size-3" />
          <span>View Invoice</span>
        </Button>
      </div>
    )}

    {/* Tax Invoice Modal */}
    {taxInvoiceModalOpen && (
      <TaxInvoiceModal
        open={taxInvoiceModalOpen}
        onOpenChange={setTaxInvoiceModalOpen}
        booking={{
          id: bookingData.id,
          reference: bookingData.reference,
          pickup_area: pickup.name,
          drop_area: drop.name,
          estimated_fare: fare,
          final_fare: fare,
          driver_id: driverInfo?.id,
          completed_at: new Date().toISOString(),
        }}
        driver={driverInfo}
      />
    )}

    <div className="mt-6 space-y-2 text-sm">
      <Row label="Pickup" value={pickup.name} />
      <Row label="Drop-off" value={drop.name} />
      <div className="flex justify-between border-t border-border pt-3">
        <span className="text-muted-foreground">Estimated fare</span>
        <span className="font-bold text-primary">₹{Math.round(fare)}</span>
      </div>
    </div>
    
    <div className="mt-8 flex justify-center">
      <Button
        variant="ghost"
        className="text-muted-foreground hover:text-foreground"
        onClick={() => {
          if (onReset) onReset();
          else window.location.reload();
        }}
      >
        Book another ride
      </Button>
    </div>
  </div>;
}
