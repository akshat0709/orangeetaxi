// @ts-nocheck

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Banknote, BatteryCharging, Bell, BellOff, Car, Check, CheckCircle, Clock, Loader2, MapPin, Navigation, Power, Star, TrendingUp, Volume2, Wallet, X, Map } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getBookingVehiclePlate, lockBookingVehicle, saveRideVehiclePlate, formatVehicleNameWithPlate } from "@/lib/ride-vehicle";

export const Route = createFileRoute("/driver-console")({
  head: () => ({ meta: [{ title: "Driver Console — Orange Taxi" }] }),
  component: DriverConsolePage,
});

interface Booking {
  id: string; reference: string; status: string;
  pickup_area: string; drop_area: string;
  estimated_fare: number; final_fare: number | null;
  vehicle_name: string; payment_method: string;
  created_at: string; completed_at: string | null;
  distance_km: number; rating: number | null;
  ride_otp?: string;
}
interface DriverProfile {
  id: string; user_id: string; full_name: string; is_online: boolean;
  rating: number; total_rides: number; city: string;
}
interface ServiceArea {
  name: string; lat: number; lng: number;
}

const STATUS_FLOW: Record<string, { label: string; next: string; nextLabel: string } | null> = {
  accepted: { label: "Driver En Route", next: "arrived", nextLabel: "Mark Arrived" },
  arrived: { label: "Arrived at Pickup", next: "in_progress", nextLabel: "Start Ride" },
  in_progress: { label: "Ride in Progress", next: "completed", nextLabel: "Complete Ride" },
  completed: null,
};

const STATUS_COLOR: Record<string, string> = {
  searching: "bg-amber-100 text-amber-700 border-amber-200",
  accepted: "bg-blue-100 text-blue-700 border-blue-200",
  arrived: "bg-violet-100 text-violet-700 border-violet-200",
  in_progress: "bg-orange-100 text-orange-700 border-orange-200",
  completed: "bg-green-100 text-green-700 border-green-200",
  cancelled: "bg-red-100 text-red-700 border-red-200",
};

function playRideRequestChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // First tone (587.33 Hz - D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.35, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.3);

    // Second tone (880 Hz - A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.16);
    gain2.gain.setValueAtTime(0.4, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.16);
    osc2.stop(now + 0.55);

    // Third tone (1318.51 Hz - E6)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(1318.51, now + 0.32);
    gain3.gain.setValueAtTime(0.28, now + 0.32);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.75);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.32);
    osc3.stop(now + 0.75);

    // Mobile haptic vibration
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([200, 100, 200, 100, 300]);
    }
  } catch (err) {
    console.warn("Audio chime error:", err);
  }
}

function DriverConsolePage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [areas, setAreas] = useState<Record<string, ServiceArea>>({});
  const [activeRides, setActiveRides] = useState<Booking[]>([]);
  const [newRequests, setNewRequests] = useState<Booking[]>([]);
  const [recentRides, setRecentRides] = useState<Booking[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [otpInputs, setOtpInputs] = useState<Record<string, string>>({});
  const [soundEnabled, setSoundEnabled] = useState<boolean>(() => {
    if (typeof window !== "undefined") {
      const s = localStorage.getItem("orange_driver_sound_enabled");
      return s !== null ? s === "true" : true;
    }
    return true;
  });
  const prevRequestsCountRef = useRef(-1);

  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate({ to: "/login", search: { redirect: "/driver-console" } }); return; }
      if (role && role !== "driver" && role !== "admin") {
        toast.error("Driver access required.");
        navigate({ to: "/" });
      }
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    loadData();
    const channel = supabase.channel("driver-bookings")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "bookings" }, (payload) => {
        if (payload.new?.status === "searching" && !payload.new?.driver_id) {
          if (soundEnabled) {
            playRideRequestChime();
          }
          toast.info("🔔 New ride request available nearby!", { duration: 4000 });
        }
        loadData();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings" }, (payload) => {
        if (payload.new?.status === "searching" && payload.old?.status !== "searching") {
          if (soundEnabled) {
            playRideRequestChime();
          }
          toast.info("🔔 New ride request available nearby!", { duration: 4000 });
        }
        loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_cash_settlements" }, () => loadData())
      .subscribe();

    const handleStorageUpdate = () => loadData();
    window.addEventListener("storage", handleStorageUpdate);
    window.addEventListener("cash_settlements_updated", handleStorageUpdate);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("storage", handleStorageUpdate);
      window.removeEventListener("cash_settlements_updated", handleStorageUpdate);
    };
  }, [user, soundEnabled]);


  // Live location sharing
  useEffect(() => {
    if (!driver || !driver.is_online) return;
    const watchId = navigator.geolocation.watchPosition(
      async (pos) => {
        await supabase.from("drivers").update({
          current_lat: pos.coords.latitude,
          current_lng: pos.coords.longitude,
          location_updated_at: new Date().toISOString()
        }).eq("id", driver.id);
      },
      (err) => console.warn("Location sharing error:", err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [driver?.is_online, driver?.id]);

  async function loadData() {
    if (!user) return;
    let { data: driverData } = await supabase.from("drivers").select("*").eq("user_id", user.id).single();
    
    // Auto-create driver profile if role is granted but profile is missing
    if (!driverData && (role === "driver" || role === "admin")) {
      const { data: appData } = await supabase.from("driver_applications").select("*").eq("email", user.email).single();
      const { data: newDriver } = await supabase.from("drivers").insert({
        user_id: user.id,
        full_name: appData?.full_name || user.email?.split("@")[0] || "New Driver",
        city: appData?.city || "Delhi NCR",
        phone: appData?.phone || "",
        vehicle_model: "Mahindra BE.6",
        vehicle_number: "Unassigned"
      }).select().single();
      driverData = newDriver;
    }

    if (!driverData) { setLoading(false); return; }
    setDriver(driverData as DriverProfile);

    // Fetch areas for coordinates
    const { data: areaData } = await supabase.from("service_areas").select("*");
    const areaMap: Record<string, ServiceArea> = {};
    (areaData || []).forEach((a: any) => areaMap[a.name] = a);
    setAreas(areaMap);

    const { data: active } = await supabase.from("bookings").select("*")
      .eq("driver_id", driverData.id)
      .in("status", ["accepted", "arrived", "in_progress"])
      .order("created_at", { ascending: false });
    setActiveRides((active as Booking[]) ?? []);

    const { data: requests } = await supabase.from("bookings").select("*")
      .eq("status", "searching").is("driver_id", null)
      .order("created_at", { ascending: false }).limit(5);
    const reqList = (requests as Booking[]) ?? [];
    setNewRequests(reqList);

    // If new requests arrived and driver is online, play chime alert!
    if (reqList.length > prevRequestsCountRef.current && prevRequestsCountRef.current !== -1) {
      if (soundEnabled && driverData?.is_online) {
        playRideRequestChime();
        toast.info("🔔 New ride request available nearby!", { duration: 4000 });
      }
    }
    prevRequestsCountRef.current = reqList.length;

    const { data: recent } = await supabase.from("bookings").select("*")
      .eq("driver_id", driverData.id).eq("status", "completed")
      .order("completed_at", { ascending: false }).limit(100);
    const recentList = (recent as Booking[]) ?? [];
    if (driverData.vehicle_number && driverData.vehicle_number !== "Unassigned") {
      recentList.forEach(r => {
        saveRideVehiclePlate(r.id, driverData.vehicle_number, r.reference);
      });
    }
    setRecentRides(recentList);

    try {
      const { data: settleData } = await supabase
        .from("driver_cash_settlements")
        .select("*")
        .eq("driver_id", driverData.id)
        .order("created_at", { ascending: false });
      if (settleData) {
        setSettlements(settleData);
      } else {
        const stored = localStorage.getItem("orange_cash_settlements");
        if (stored) {
          const all = JSON.parse(stored);
          setSettlements(all.filter((s: any) => s.driver_id === driverData.id));
        }
      }
    } catch (e) {
      const stored = localStorage.getItem("orange_cash_settlements");
      if (stored) {
        try {
          const all = JSON.parse(stored);
          setSettlements(all.filter((s: any) => s.driver_id === driverData.id));
        } catch (err) {}
      }
    }

    setLoading(false);

  }

  async function toggleOnline() {
    if (!driver) return;
    setToggling(true);
    const newStatus = !driver.is_online;
    const { error } = await supabase.from("drivers").update({ is_online: newStatus }).eq("id", driver.id);
    if (!error) {
      setDriver(prev => prev ? { ...prev, is_online: newStatus } : prev);
      toast.success(newStatus ? "You're now online — ready for rides!" : "You're now offline");
    } else {
      toast.error("Could not update status: " + error.message);
    }
    setToggling(false);
  }

  async function acceptRide(bookingId: string) {
    if (!driver) return;
    // Prevent accepting more than one ride at a time
    if (activeRides.length > 0) {
      toast.error("You already have an active ride. Complete it before accepting a new one.");
      return;
    }
    const { error } = await supabase.from("bookings").update({ driver_id: driver.id, status: "accepted", accepted_at: new Date().toISOString() }).eq("id", bookingId).eq("status", "searching");
    if (error) { toast.error("Could not accept ride — it may have been taken by another driver."); return; }

    if (driver.vehicle_number && driver.vehicle_number !== "Unassigned") {
      const activeBooking = newRequests.find(b => b.id === bookingId);
      await lockBookingVehicle(supabase, bookingId, driver.vehicle_number, activeBooking?.vehicle_name, activeBooking?.reference);
    }

    toast.success("Ride accepted!");
    loadData();
  }

  async function advanceStatus(booking: Booking) {
    const flow = STATUS_FLOW[booking.status];
    if (!flow) return;
    
    // OTP Check if trying to start ride
    if (flow.next === "in_progress") {
      const enteredOtp = otpInputs[booking.id];
      if (enteredOtp !== booking.ride_otp) {
        toast.error("Incorrect OTP. Please check with the customer.");
        return;
      }
    }

    const updates: Record<string, string | number | null> = { status: flow.next };
    if (flow.next === "arrived") updates.arrived_at = new Date().toISOString();
    if (flow.next === "in_progress") updates.started_at = new Date().toISOString();
    if (flow.next === "completed") {
      updates.completed_at = new Date().toISOString();
      updates.final_fare = booking.estimated_fare;
      updates.payment_status = "paid";
      if (driver.vehicle_number && driver.vehicle_number !== "Unassigned") {
        updates.vehicle_name = formatVehicleNameWithPlate(booking.vehicle_name, driver.vehicle_number);
        saveRideVehiclePlate(booking.id, driver.vehicle_number, booking.reference);
      }
    }
    const { error } = await supabase.from("bookings").update(updates).eq("id", booking.id);
    if (error) { toast.error("Update failed"); return; }
    toast.success(`Status updated to ${flow.next.replace("_", " ")}`);
    loadData();
  }

  function getNavUrl(areaName: string) {
    const a = areas[areaName];
    if (!a) return "#";
    return `https://www.google.com/maps/dir/?api=1&destination=${a.lat},${a.lng}&travelmode=driving`;
  }

  if (authLoading || loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;

  if (!driver) {
    return (
      <section className="min-h-screen py-24">
        <div className="section-shell text-center">
          <h1 className="display-serif text-5xl">Driver profile not found</h1>
          <p className="mt-4 text-muted-foreground">Your account hasn't been set up as a driver yet.</p>
          <Button asChild className="mt-8"><Link to="/drive">Apply to Drive <ArrowRight /></Link></Button>
        </div>
      </section>
    );
  }

  // Earnings calculations — daily, weekly, monthly split by payment method
  const today = new Date(); today.setHours(0,0,0,0);
  const todayRides   = recentRides.filter(r => new Date(r.completed_at ?? "") >= today);
  const todayTotal   = todayRides.reduce((s, r) => s + (r.final_fare ?? r.estimated_fare), 0);
  const todayUPI     = todayRides.filter(r => r.payment_method === "upi").reduce((s, r) => s + (r.final_fare ?? r.estimated_fare), 0);
  const todayCash    = todayRides.filter(r => r.payment_method === "cash").reduce((s, r) => s + (r.final_fare ?? r.estimated_fare), 0);
  const weekStart    = new Date(Date.now() - 7 * 24 * 3600000);
  const weeklyRides  = recentRides.filter(r => new Date(r.completed_at ?? "") >= weekStart);
  const weeklyEarnings = weeklyRides.reduce((s, r) => s + (r.final_fare ?? r.estimated_fare), 0);
  const weekUPI      = weeklyRides.filter(r => r.payment_method === "upi").reduce((s, r) => s + (r.final_fare ?? r.estimated_fare), 0);
  const weekCash     = weeklyRides.filter(r => r.payment_method === "cash").reduce((s, r) => s + (r.final_fare ?? r.estimated_fare), 0);
  const monthlyEarnings = recentRides.reduce((s, r) => s + (r.final_fare ?? r.estimated_fare), 0);
  const monthUPI     = recentRides.filter(r => r.payment_method === "upi").reduce((s, r) => s + (r.final_fare ?? r.estimated_fare), 0);
  const monthCash    = recentRides.filter(r => r.payment_method === "cash").reduce((s, r) => s + (r.final_fare ?? r.estimated_fare), 0);
  const avgRating    = recentRides.filter(r => r.rating).reduce((sum, r, _, arr) => sum + (r.rating ?? 0) / arr.length, 0) || driver.rating;

  // Cash calculations & Admin settlement balance
  const totalCashCollected = recentRides
    .filter(r => r.payment_method === "cash")
    .reduce((s, r) => s + (r.final_fare ?? r.estimated_fare), 0);

  const totalCashSubmitted = settlements
    .reduce((s, x) => s + Number(x.amount), 0);

  const currentCashHolding = Math.max(0, totalCashCollected - totalCashSubmitted);

  return (
    <section className="min-h-screen bg-warm py-10">
      <div className="section-shell">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Driver Console</p>
            <h1 className="display-serif mt-2 text-4xl">Welcome, {driver.full_name.split(" ")[0]}.</h1>
            <div className="mt-2 flex items-center gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">{driver.city}</span>
              <span className="text-muted-foreground text-xs">·</span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Car className="size-3.5" />
                <span>{driver.vehicle_model || "Mahindra BE.6"}</span>
                <span className="font-mono font-bold">
                  {driver.vehicle_number && driver.vehicle_number !== "Unassigned" ? driver.vehicle_number : "No car assigned today"}
                </span>
              </span>
              <span className="text-muted-foreground text-xs">·</span>
              <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                currentCashHolding > 0
                  ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                  : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
              }`}>
                <Banknote className="size-3.5" />
                <span>Cash in Hand: <strong className="font-mono">₹{Math.round(currentCashHolding)}</strong></span>
              </span>
            </div>
          </div>


          <div className="flex items-center gap-2 flex-wrap">
            {/* Sound Alert Toggle */}
            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                localStorage.setItem("orange_driver_sound_enabled", String(next));
                if (next) {
                  playRideRequestChime();
                  toast.success("Alert chime enabled 🔔");
                } else {
                  toast.info("Alert chime muted 🔕");
                }
              }}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-2 text-xs font-semibold transition-colors ${
                soundEnabled
                  ? "border-primary/30 bg-primary/10 text-primary hover:bg-primary/20"
                  : "border-border bg-background text-muted-foreground hover:bg-muted"
              }`}
              title={soundEnabled ? "Mute ride alerts" : "Enable ride alerts"}
            >
              {soundEnabled ? <Bell className="size-3.5 text-primary" /> : <BellOff className="size-3.5" />}
              <span>{soundEnabled ? "Chime ON" : "Chime Muted"}</span>
            </button>

            {/* Test Sound Button */}
            <button
              type="button"
              onClick={() => {
                playRideRequestChime();
                toast.success("Playing test request chime 🎵");
              }}
              className="flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-2 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              title="Test chime sound"
            >
              <Volume2 className="size-3.5 text-primary" />
              <span>Test</span>
            </button>

            <button onClick={toggleOnline} disabled={toggling}
              className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${driver.is_online ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100" : "border-border bg-background text-muted-foreground hover:bg-accent"}`}>
              {toggling ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
              {driver.is_online ? "Online" : "Go Online"}
            </button>
          </div>
        </div>

        <Tabs defaultValue="rides" className="mt-10">
          <TabsList className="mb-6">
            <TabsTrigger value="rides">Active Rides {activeRides.length > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{activeRides.length}</span>}</TabsTrigger>
            <TabsTrigger value="requests">New Requests {newRequests.length > 0 && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{newRequests.length}</span>}</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
          </TabsList>

          <TabsContent value="rides">
            {activeRides.length === 0 ? (
              <EmptyState icon={Navigation} title="No active rides" text="Accept a ride request to get started." />
            ) : (
              <div className="space-y-4">
                {activeRides.map(ride => {
                  const flow = STATUS_FLOW[ride.status];
                  return (
                    <div key={ride.id} className="rounded-xl border border-border bg-background p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold">{ride.reference}</span>
                            <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${STATUS_COLOR[ride.status] ?? ""}`}>
                              {STATUS_FLOW[ride.status]?.label ?? ride.status.replace("_", " ")}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
                            <MapPin className="size-4 text-primary" />{ride.pickup_area}
                            <span className="text-border">→</span>
                            <Navigation className="size-4 text-primary" />{ride.drop_area}
                          </div>
                        </div>
                      </div>

                      {ride.status === "accepted" && (
                        <div className="mt-6 flex flex-col sm:flex-row gap-3 border-t border-border pt-4">
                          <Button asChild variant="outline" className="flex-1"><a href={getNavUrl(ride.pickup_area)} target="_blank" rel="noreferrer"><Map className="mr-2 size-4" /> Navigate to Pickup</a></Button>
                          <Button onClick={() => advanceStatus(ride)} className="flex-1">Mark Arrived <Check className="ml-2 size-4" /></Button>
                        </div>
                      )}

                      {ride.status === "arrived" && (
                        <div className="mt-6 border-t border-border pt-4 text-center">
                          <p className="text-sm font-semibold mb-3">Ask customer for the 6-digit OTP</p>
                          <div className="flex flex-col items-center gap-4">
                            <InputOTP maxLength={6} value={otpInputs[ride.id] || ""} onChange={(val) => setOtpInputs(p => ({ ...p, [ride.id]: val }))}>
                              <InputOTPGroup>
                                {[0,1,2,3,4,5].map(i => <InputOTPSlot key={i} index={i} className="size-10 text-lg" />)}
                              </InputOTPGroup>
                            </InputOTP>
                            <Button onClick={() => advanceStatus(ride)} disabled={otpInputs[ride.id]?.length !== 6} className="w-full sm:w-auto">
                              Verify & Start Ride <ArrowRight className="ml-2 size-4" />
                            </Button>
                          </div>
                        </div>
                      )}

                      {ride.status === "in_progress" && (
                        <div className="mt-6 flex flex-col sm:flex-row gap-3 border-t border-border pt-4">
                          <Button asChild variant="outline" className="flex-1"><a href={getNavUrl(ride.drop_area)} target="_blank" rel="noreferrer"><Map className="mr-2 size-4" /> Navigate to Drop-off</a></Button>
                          <Button onClick={() => advanceStatus(ride)} className="flex-1 bg-green-600 hover:bg-green-700">Complete Ride <CheckCircle className="ml-2 size-4" /></Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="requests">
            {!driver.is_online && <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">You're offline. Go online to receive ride requests.</div>}
            {newRequests.length === 0 ? <EmptyState icon={Clock} title="No new requests" text="New ride requests in your area will appear here." /> :
              <div className="space-y-4">
                {newRequests.map(ride => (
                  <div key={ride.id} className="rounded-xl border border-border bg-background p-6">
                    <div className="flex justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm font-bold"><MapPin className="size-4 text-primary" />{ride.pickup_area} <span className="text-muted-foreground">→</span> <Navigation className="size-4 text-primary" />{ride.drop_area}</div>
                        <div className="mt-2 text-xs text-muted-foreground space-x-4"><span className="font-bold text-primary">₹{Math.round(ride.estimated_fare)}</span><span>{Math.round(ride.distance_km)} km</span><span>{ride.vehicle_name}</span></div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setNewRequests(p => p.filter(r => r.id !== ride.id))}><X className="size-4" /></Button>
                        <Button size="sm" onClick={() => acceptRide(ride.id)}>Accept</Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            }
          </TabsContent>

          <TabsContent value="earnings">
            {/* Cash in Hand & Admin Handover Card */}
            <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50/50 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 dark:border-amber-900/60 pb-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-amber-100 text-amber-700 dark:bg-amber-900/50">
                    <Banknote className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-amber-800 dark:text-amber-300">
                      Cash in Hand (To Be Handed Over to Admin)
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Physical cash collected from riders. Reduces automatically when Admin records collection.
                    </p>
                  </div>
                </div>
                <div className="text-left sm:text-right">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">Current Cash Holding</p>
                  <p className="text-3xl font-mono font-bold text-amber-700 dark:text-amber-400">
                    ₹{Math.round(currentCashHolding)}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-lg border border-border bg-background p-3.5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase">Total Cash Collected (Rides)</p>
                  <p className="mt-1 text-2xl font-bold font-mono text-foreground">₹{Math.round(totalCashCollected)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">From all completed cash rides</p>
                </div>

                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-3.5 dark:border-emerald-950 dark:bg-emerald-950/20">
                  <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 uppercase">Cash Deposited with Admin</p>
                  <p className="mt-1 text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">₹{Math.round(totalCashSubmitted)}</p>
                  <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/70 mt-0.5">{settlements.length} verified handover{settlements.length !== 1 ? "s" : ""}</p>
                </div>
              </div>

              {settlements.length > 0 && (
                <div className="mt-4 pt-3 border-t border-amber-200/70 dark:border-amber-900/40">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                    Recent Handover Receipts from Admin
                  </p>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {settlements.slice(0, 5).map(s => (
                      <div key={s.id} className="flex items-center justify-between text-xs rounded-lg bg-background/90 px-3 py-2 border border-border">
                        <div className="flex items-center gap-2">
                          <Check className="size-3.5 text-emerald-600" />
                          <span className="font-semibold text-emerald-600 font-mono">₹{Math.round(s.amount)}</span>
                          <span className="text-muted-foreground text-[11px]">({s.notes || "Admin cash collection"})</span>
                        </div>
                        <span className="font-mono text-[10px] text-muted-foreground">
                          {s.created_at ? new Date(s.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Today's breakdown */}
            <div className="mb-6">

              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">Today</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-background p-5">
                  <p className="text-xs font-semibold text-muted-foreground">Total Earned</p>
                  <p className="mt-2 text-3xl font-bold">₹{Math.round(todayTotal)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{todayRides.length} ride{todayRides.length !== 1 ? "s" : ""}</p>
                </div>
                <div className="rounded-xl border border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-900 p-5">
                  <p className="text-xs font-semibold text-blue-600">via UPI</p>
                  <p className="mt-2 text-3xl font-bold text-blue-700">₹{Math.round(todayUPI)}</p>
                  <p className="mt-1 text-xs text-blue-500">{todayRides.filter(r => r.payment_method === "upi").length} rides</p>
                </div>
                <div className="rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/20 dark:border-green-900 p-5">
                  <p className="text-xs font-semibold text-green-600">via Cash</p>
                  <p className="mt-2 text-3xl font-bold text-green-700">₹{Math.round(todayCash)}</p>
                  <p className="mt-1 text-xs text-green-500">{todayRides.filter(r => r.payment_method === "cash").length} rides</p>
                </div>
              </div>
            </div>

            {/* Weekly breakdown */}
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">This Week</p>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-border bg-background p-5">
                  <p className="text-xs font-semibold text-muted-foreground">Total</p>
                  <p className="mt-2 text-2xl font-bold">₹{Math.round(weeklyEarnings)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{weeklyRides.length} rides</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-5">
                  <p className="text-xs font-semibold text-blue-600">UPI</p>
                  <p className="mt-2 text-2xl font-bold">₹{Math.round(weekUPI)}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-5">
                  <p className="text-xs font-semibold text-green-600">Cash</p>
                  <p className="mt-2 text-2xl font-bold">₹{Math.round(weekCash)}</p>
                </div>
              </div>
            </div>

            {/* Monthly breakdown */}
            <div className="mb-8">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">This Month</p>
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="rounded-xl border border-border bg-background p-5">
                  <p className="text-xs font-semibold text-muted-foreground">Total</p>
                  <p className="mt-2 text-2xl font-bold">₹{Math.round(monthlyEarnings)}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{recentRides.length} rides</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-5">
                  <p className="text-xs font-semibold text-blue-600">UPI</p>
                  <p className="mt-2 text-2xl font-bold">₹{Math.round(monthUPI)}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-5">
                  <p className="text-xs font-semibold text-green-600">Cash</p>
                  <p className="mt-2 text-2xl font-bold">₹{Math.round(monthCash)}</p>
                </div>
                <div className="rounded-xl border border-border bg-background p-5">
                  <p className="text-xs font-semibold text-muted-foreground">Avg Rating</p>
                  <p className="mt-2 text-2xl font-bold">{avgRating.toFixed(1)} ⭐</p>
                </div>
              </div>
            </div>

            {/* Ride history */}
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">Ride History</p>
              {recentRides.length === 0
                ? <EmptyState icon={TrendingUp} title="No completed rides yet" text="Completed rides will appear here." />
                : <div className="space-y-2">
                    {recentRides.map(ride => {
                      const ridePlate = getBookingVehiclePlate(ride, driver);
                      return (
                        <div key={ride.id} className="flex items-center justify-between rounded-xl border border-border bg-background px-5 py-4 gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <MapPin className="size-3 shrink-0 text-primary" />
                              <span className="truncate">{ride.pickup_area} → {ride.drop_area}</span>
                            </div>
                            <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                              <span>
                                {ride.completed_at ? new Date(ride.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—"}
                              </span>
                              {ridePlate && (
                                <>
                                  <span>·</span>
                                  <span className="inline-flex items-center gap-1 font-mono font-bold text-foreground bg-primary/10 px-1.5 py-0.5 rounded text-[10px]">
                                    <Car className="size-2.5 text-primary" />
                                    <span>{ridePlate}</span>
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        <div className="flex items-center gap-3 shrink-0">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${ride.payment_method === "upi" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                            {ride.payment_method?.toUpperCase()}
                          </span>
                          <span className="font-bold text-primary">₹{Math.round(ride.final_fare ?? ride.estimated_fare)}</span>
                        </div>
                      </div>
                    );
                  })}
                  </div>
              }
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

function EmptyState({ icon: Icon, title, text }: any) {
  return <div className="flex flex-col items-center rounded-xl border border-dashed py-16 text-center"><Icon className="size-10 text-muted-foreground/40" /><p className="mt-4 font-semibold">{title}</p><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>;
}
