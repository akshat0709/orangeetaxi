// @ts-nocheck

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Award, Banknote, BatteryCharging, Bell, BellOff, Calendar, Car, Check, CheckCircle, Clock, Copy, Heart, Loader2, MapPin, MessageSquare, Navigation, Phone, PhoneCall, Power, Snowflake, Sparkles, Star, TrendingUp, User, Volume2, VolumeX, Wallet, X, Map, Building2, Handshake, Percent, ShieldCheck, Smartphone, QrCode, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getBookingVehiclePlate, lockBookingVehicle, saveRideVehiclePlate, formatVehicleNameWithPlate, resolveDriverDetails } from "@/lib/ride-vehicle";
import { parseCleanCoords, parseRidePreferences, getCabinClimateBadge } from "@/lib/ride-preferences";
import { PAN_INDIA_PRESETS } from "@/components/map-picker";
import { RideChatSheet } from "@/components/ride-chat-sheet";
import { WaitingFeeTimer } from "@/components/waiting-fee-timer";
import { NotificationBanner } from "@/components/notification-banner";
import { sendRideNotification } from "@/lib/notifications";

export const Route = createFileRoute("/driver-console")({
  head: () => ({ meta: [{ title: "Driver Console — Orange Taxi" }] }),
  component: DriverConsolePage,
});

interface Booking {
  id: string; reference: string; status: string;
  pickup_area: string; drop_area: string;
  pickup_address?: string; drop_address?: string;
  estimated_fare: number; final_fare: number | null;
  vehicle_name: string; payment_method: string; payment_status?: string;
  created_at: string; accepted_at?: string; arrived_at?: string | null; started_at?: string; completed_at: string | null;
  distance_km: number; rating: number | null;
  customer_id?: string; driver_id?: string;
  notes?: string; ride_otp?: string;
  scheduled_at?: string | null;
}

function formatScheduledDeparture(isoString?: string | null) {
  if (!isoString) return { fullText: "Advance Booking", countdown: "Scheduled", isUrgent: false, isNearDispatch: false, diffMin: 999 };
  const target = new Date(isoString);
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60000);
  const diffHrs = Math.round(diffMs / (60000 * 60));
  const diffDays = Math.round(diffMs / (60000 * 60 * 24));

  const timeStr = target.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
  const dateStr = target.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });

  let countdown = "";
  if (diffMin <= 0) {
    countdown = "Departure time reached";
  } else if (diffMin < 60) {
    countdown = `In ${diffMin} mins`;
  } else if (diffHrs < 24) {
    countdown = `In ${diffHrs} hr${diffHrs > 1 ? "s" : ""}`;
  } else {
    countdown = `In ${diffDays} day${diffDays > 1 ? "s" : ""}`;
  }

  const isUrgent = diffMin > -15 && diffMin <= 30; // 15-30 min priority dispatch window
  const isNearDispatch = diffMin <= 45; // Driver can click Start Dispatch

  return { fullText: `${dateStr} at ${timeStr}`, countdown, isUrgent, isNearDispatch, diffMin };
}
interface DriverProfile {
  id: string; user_id: string; full_name: string; is_online: boolean;
  rating: number; total_rides: number; city: string;
  phone?: string; vehicle_model?: string; vehicle_number?: string;
  vehicle_code?: string;
  driver_type?: string; photo_url?: string; chassis_number?: string;
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
  searching: "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800/40",
  accepted: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800/40",
  arrived: "bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-950/60 dark:text-violet-300 dark:border-violet-800/40",
  in_progress: "bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-950/60 dark:text-orange-300 dark:border-orange-800/40",
  completed: "bg-green-100 text-green-700 border-green-200 dark:bg-green-950/60 dark:text-green-300 dark:border-green-800/40",
  cancelled: "bg-red-100 text-red-700 border-red-200 dark:bg-red-950/60 dark:text-red-300 dark:border-red-800/40",
};

function playRideRequestChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }
    const now = ctx.currentTime;

    // First tone (587.33 Hz - D5)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "triangle";
    osc1.frequency.setValueAtTime(587.33, now);
    gain1.gain.setValueAtTime(0.4, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Second tone (880 Hz - A5)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.16);
    gain2.gain.setValueAtTime(0.45, now + 0.16);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.16);
    osc2.stop(now + 0.6);

    // Third tone (1318.51 Hz - E6)
    const osc3 = ctx.createOscillator();
    const gain3 = ctx.createGain();
    osc3.type = "sine";
    osc3.frequency.setValueAtTime(1318.51, now + 0.32);
    gain3.gain.setValueAtTime(0.35, now + 0.32);
    gain3.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
    osc3.connect(gain3);
    gain3.connect(ctx.destination);
    osc3.start(now + 0.32);
    osc3.stop(now + 0.85);

    // Mobile haptic vibration
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([300, 150, 300, 150, 500]);
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
  const [scheduledBookings, setScheduledBookings] = useState<Booking[]>([]);
  const [recentRides, setRecentRides] = useState<Booking[]>([]);
  const [settlements, setSettlements] = useState<any[]>([]);
  const [commissionSettlements, setCommissionSettlements] = useState<any[]>([]);
  const [customerProfiles, setCustomerProfiles] = useState<Record<string, { full_name: string; phone: string }>>({});
  const [activeChatRide, setActiveChatRide] = useState<Booking | null>(null);
  const [unreadChats, setUnreadChats] = useState<Record<string, number>>({});
  const [driverReviews, setDriverReviews] = useState<any[]>([]);
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

  // Fixed Salary Driver UPI Remittance Modal State
  const [upiDepositModalOpen, setUpiDepositModalOpen] = useState(false);
  const [depositAmount, setDepositAmount] = useState<number | "">("");
  const [depositUtr, setDepositUtr] = useState("");
  const [submittingDeposit, setSubmittingDeposit] = useState(false);

  // Commission Partner Driver UPI Payment Modal State
  const [upiCommissionModalOpen, setUpiCommissionModalOpen] = useState(false);
  const [commissionPayAmount, setCommissionPayAmount] = useState<number | "">("");
  const [commissionUtr, setCommissionUtr] = useState("");
  const [submittingCommission, setSubmittingCommission] = useState(false);

  // Continuous looping alert: sound + vibration repeat every 2.5s while unaccepted requests exist
  useEffect(() => {
    if (!driver?.is_online || newRequests.length === 0 || !soundEnabled) {
      return;
    }

    // Play chime once immediately
    playRideRequestChime();

    // Loop chime and vibration every 2.5 seconds
    const chimeTimer = setInterval(() => {
      playRideRequestChime();
    }, 2500);

    return () => clearInterval(chimeTimer);
  }, [newRequests.length, driver?.is_online, soundEnabled]);

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
          sendRideNotification({
            title: "New Ride Request Nearby! ⚡",
            body: `Pickup: ${payload.new?.pickup_area || "Nearby"} • Fare: ₹${payload.new?.estimated_fare || "—"}`,
            url: "/driver-console",
            tag: `driver-req-${payload.new?.id || Date.now()}`,
          });
        } else if (payload.new?.status === "scheduled" && !payload.new?.driver_id) {
          if (soundEnabled) {
            playRideRequestChime();
          }
          toast.info("📅 New Advance Scheduled Booking in Fleet Pool!", { duration: 5000 });
          sendRideNotification({
            title: "New Scheduled Booking Available! 📅",
            body: `Pickup: ${payload.new?.pickup_area || "Nearby"} • Fare: ₹${payload.new?.estimated_fare || "—"}`,
            url: "/driver-console",
            tag: `driver-sched-${payload.new?.id || Date.now()}`,
          });
        }
        loadData();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "bookings" }, (payload) => {
        if (payload.new?.status === "searching" && payload.old?.status !== "searching") {
          if (soundEnabled) {
            playRideRequestChime();
          }
          toast.info("🔔 New ride request available nearby!", { duration: 4000 });
          sendRideNotification({
            title: "New Ride Request Nearby! ⚡",
            body: `Pickup: ${payload.new?.pickup_area || "Nearby"} • Fare: ₹${payload.new?.estimated_fare || "—"}`,
            url: "/driver-console",
            tag: `driver-req-${payload.new?.id || Date.now()}`,
          });
        } else if (payload.new?.status === "scheduled" && payload.old?.status !== "scheduled") {
          if (soundEnabled) {
            playRideRequestChime();
          }
          toast.info("📅 Advance Scheduled Booking Available in Fleet Pool!", { duration: 4000 });
        }
        loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "drivers" }, () => loadData())
      .on("postgres_changes", { event: "*", schema: "public", table: "driver_cash_settlements" }, () => loadData())
      .subscribe();

    const handleStorageUpdate = () => loadData();
    window.addEventListener("storage", handleStorageUpdate);
    window.addEventListener("cash_settlements_updated", handleStorageUpdate);
    window.addEventListener("commission_settlements_updated", handleStorageUpdate);

    return () => {
      supabase.removeChannel(channel);
      window.removeEventListener("storage", handleStorageUpdate);
      window.removeEventListener("cash_settlements_updated", handleStorageUpdate);
      window.removeEventListener("commission_settlements_updated", handleStorageUpdate);
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
    let { data: driverData } = await supabase.from("drivers").select("*").eq("user_id", user.id).maybeSingle();
    
    // Resolve login phone from auth user_metadata, user.phone, profiles, or driver_applications
    let loginPhone = (user.user_metadata?.phone || user.phone || "").trim();
    if (!loginPhone) {
      try {
        const { data: prof } = await supabase.from("profiles").select("phone").eq("id", user.id).maybeSingle();
        if (prof?.phone && prof.phone.trim()) loginPhone = prof.phone.trim();
      } catch (e) {}
    }
    if (!loginPhone) {
      try {
        const { data: appData } = await supabase.from("driver_applications").select("phone").eq("email", user.email).maybeSingle();
        if (appData?.phone && appData.phone.trim()) loginPhone = appData.phone.trim();
      } catch (e) {}
    }

    async function fetchAppForUser(email?: string, phone?: string, fullName?: string) {
      try {
        if (phone && phone.trim()) {
          const { data } = await supabase
            .from("driver_applications")
            .select("*")
            .eq("phone", phone.trim())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) return data;
        }
        if (email && email.trim()) {
          const { data } = await supabase
            .from("driver_applications")
            .select("*")
            .eq("email", email.trim().toLowerCase())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) return data;
        }
        if (fullName && fullName.trim()) {
          const { data } = await supabase
            .from("driver_applications")
            .select("*")
            .ilike("full_name", fullName.trim())
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) return data;
        }
      } catch (e) {}
      return null;
    }

    // Auto-create driver profile if role is granted but profile is missing
    if (!driverData && (role === "driver" || role === "admin")) {
      const appData = await fetchAppForUser(user.email, loginPhone, user.user_metadata?.full_name);

      let parsedNotes: any = {};
      try {
        if (appData?.admin_notes && typeof appData.admin_notes === "string" && appData.admin_notes.trim().startsWith("{")) {
          parsedNotes = JSON.parse(appData.admin_notes);
        }
      } catch (e) {}

      const isPartner = Boolean(appData?.owns_vehicle || appData?.driver_type === "partner" || parsedNotes?.driver_type === "partner");
      const plate = appData?.vehicle_number || parsedNotes?.vehicle_number || (isPartner ? "KA 01 EV 4421" : "DL 01 EV 1001");
      const model = appData?.vehicle_model || parsedNotes?.vehicle_model || (isPartner ? "Tata Nexon EV" : "Mahindra BE.6");
      const photo = appData?.photo_url || parsedNotes?.photo_url || "";

      const metaObj = {
        photo,
        plate,
        model,
        type: isPartner ? "partner" : "company",
      };

      const { data: newDriver } = await supabase.from("drivers").insert({
        user_id: user.id,
        full_name: appData?.full_name || user.user_metadata?.full_name || user.email?.split("@")[0] || "New Driver",
        city: appData?.city || "Bengaluru",
        phone: loginPhone,
        vehicle_model: model,
        vehicle_number: plate,
        vehicle_code: "ORANGE_META:" + JSON.stringify(metaObj),
      }).select().single();
      driverData = newDriver;
    } else if (driverData && loginPhone) {
      // Sync driver phone if missing or if login phone was updated
      if (!driverData.phone || driverData.phone.trim() !== loginPhone) {
        await supabase.from("drivers").update({ phone: loginPhone }).eq("id", driverData.id);
        driverData.phone = loginPhone;
      }
    }

    if (!driverData) { setLoading(false); return; }

    // Resolve driver photo, operating model, and partner vehicle details from application
    try {
      const appData = await fetchAppForUser(user.email, loginPhone, user.user_metadata?.full_name);

      let parsedNotes: any = {};
      try {
        if (appData?.admin_notes && typeof appData.admin_notes === "string" && appData.admin_notes.trim().startsWith("{")) {
          parsedNotes = JSON.parse(appData.admin_notes);
        }
      } catch (e) {}

      let storedMeta: any = {};
      try {
        storedMeta = JSON.parse(localStorage.getItem(`orange_app_meta_${user.email?.toLowerCase()}`) || "{}");
      } catch (e) {}

      const isPartner = Boolean(
        driverData.driver_type === "partner" ||
        appData?.owns_vehicle ||
        appData?.driver_type === "partner" ||
        parsedNotes?.driver_type === "partner" ||
        storedMeta?.driver_type === "partner"
      );

      const resolvedPlate = appData?.vehicle_number || parsedNotes?.vehicle_number || storedMeta?.vehicle_number ||
        (driverData.vehicle_number && driverData.vehicle_number !== "Unassigned" ? driverData.vehicle_number : "") ||
        (isPartner ? "KA 01 EV 4421" : "DL 01 EV 1001");

      const resolvedModel = appData?.vehicle_model || parsedNotes?.vehicle_model || storedMeta?.vehicle_model ||
        driverData.vehicle_model || (isPartner ? "Tata Nexon EV" : "Mahindra BE.6");

      const resolvedPhoto = appData?.photo_url || parsedNotes?.photo_url || storedMeta?.photo_url || driverData.photo_url || "";

      // Decode existing vehicle_code if encoded with ORANGE_META
      if (driverData.vehicle_code && typeof driverData.vehicle_code === "string" && driverData.vehicle_code.startsWith("ORANGE_META:")) {
        try {
          const metaDecoded = JSON.parse(driverData.vehicle_code.replace("ORANGE_META:", ""));
          if (!driverData.photo_url && metaDecoded.photo) driverData.photo_url = metaDecoded.photo;
        } catch (e) {}
      }

      const needsPlateSync = !driverData.vehicle_number || driverData.vehicle_number === "Unassigned";
      const needsCodeSync = !driverData.vehicle_code || !driverData.vehicle_code.startsWith("ORANGE_META:");
      const needsModelSync = !driverData.vehicle_model;

      if (needsPlateSync || needsCodeSync || needsModelSync) {
        const metaObj = {
          photo: resolvedPhoto || driverData.photo_url || "",
          plate: resolvedPlate,
          model: resolvedModel,
          type: isPartner ? "partner" : "company",
        };
        const dbUpdates: any = {
          vehicle_number: resolvedPlate,
          vehicle_model: resolvedModel,
          vehicle_code: "ORANGE_META:" + JSON.stringify(metaObj),
        };
        try {
          await supabase.from("drivers").update(dbUpdates).eq("id", driverData.id);
          driverData.vehicle_number = resolvedPlate;
          driverData.vehicle_model = resolvedModel;
          driverData.vehicle_code = dbUpdates.vehicle_code;
        } catch (err) {
          console.warn("Could not sync driver vehicle in console:", err);
        }
      }

      if (resolvedPhoto) {
        driverData.photo_url = resolvedPhoto;
        try {
          localStorage.setItem(`orange_driver_photo_${driverData.id}`, resolvedPhoto);
          if (user.id) localStorage.setItem(`orange_driver_photo_${user.id}`, resolvedPhoto);
          if (user.email) localStorage.setItem(`orange_driver_photo_by_email_${user.email.toLowerCase()}`, resolvedPhoto);
          if (loginPhone) localStorage.setItem(`orange_driver_photo_by_phone_${loginPhone.replace(/\D/g, "")}`, resolvedPhoto);
        } catch (e) {}
      }

      driverData.driver_type = isPartner ? "partner" : "company";
    } catch (e) {
      console.warn("Error resolving driver details in console:", e);
    }

    // Run universal resolver to guarantee all fields are populated
    driverData = resolveDriverDetails(driverData);
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
    const activeList = (active as Booking[]) ?? [];
    setActiveRides(activeList);

    const { data: requests } = await supabase.from("bookings").select("*")
      .eq("status", "searching").is("driver_id", null)
      .order("created_at", { ascending: false }).limit(5);
    const reqList = (requests as Booking[]) ?? [];
    setNewRequests(reqList);

    const { data: schedData } = await supabase.from("bookings").select("*")
      .eq("status", "scheduled")
      .order("scheduled_at", { ascending: true })
      .limit(30);
    const rawSchedList = (schedData as Booking[]) ?? [];
    const schedList = rawSchedList.filter(
      b => !b.driver_id || b.driver_id === driverData.id
    );
    setScheduledBookings(schedList);

    // Fetch customer profiles for active rides, incoming requests, and scheduled bookings
    const allCustIds = Array.from(new Set([
      ...activeList.map(b => b.customer_id),
      ...reqList.map(b => b.customer_id),
      ...schedList.map(b => b.customer_id),
    ].filter(Boolean)));

    if (allCustIds.length > 0) {
      try {
        const { data: profs } = await supabase.from("profiles").select("id, full_name, phone").in("id", allCustIds);
        if (profs) {
          const map: Record<string, { full_name: string; phone: string }> = {};
          profs.forEach((p: any) => {
            map[p.id] = { full_name: p.full_name || "Passenger", phone: p.phone || "" };
          });
          setCustomerProfiles(prev => ({ ...prev, ...map }));
        }
      } catch (e) {
        console.warn("Could not fetch customer profiles:", e);
      }
    }

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

    // Automatically synchronize total_rides and rating on driver record if discrepancy exists
    const totalCompleted = recentList.length;
    const ratedRides = recentList.filter(r => r.rating);
    const calculatedAvgRating = ratedRides.length > 0
      ? Number((ratedRides.reduce((s, r) => s + Number(r.rating || 0), 0) / ratedRides.length).toFixed(1))
      : driverData.rating || 5.0;

    if (totalCompleted > (driverData.total_rides || 0) || (ratedRides.length > 0 && Math.abs((driverData.rating || 0) - calculatedAvgRating) > 0.05)) {
      try {
        const nextRides = Math.max(driverData.total_rides || 0, totalCompleted);
        await supabase.from("drivers").update({
          total_rides: nextRides,
          rating: calculatedAvgRating,
        }).eq("id", driverData.id);
        driverData.total_rides = nextRides;
        driverData.rating = calculatedAvgRating;
        setDriver(prev => prev ? { ...prev, total_rides: nextRides, rating: calculatedAvgRating } : prev);
      } catch (e) {}
    }

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

    try {
      const storedComm = localStorage.getItem("orange_commission_settlements");
      if (storedComm) {
        const allComm = JSON.parse(storedComm);
        setCommissionSettlements(allComm.filter((c: any) => c.driver_id === driverData.id || (driverData.full_name && c.driver_name?.toLowerCase() === driverData.full_name?.toLowerCase())));
      }
    } catch (e) {}

    try {
      const storedReviews = JSON.parse(localStorage.getItem("orange_driver_reviews") || "[]");
      if (driverData) {
        const matched = storedReviews.filter((r: any) => !r.driver_id || r.driver_id === driverData.id || r.driver_name === driverData.full_name);
        setDriverReviews(matched.length > 0 ? matched : storedReviews);
      } else {
        setDriverReviews(storedReviews);
      }
    } catch (e) {}

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
    const resolvedDr = resolveDriverDetails(driver);
    const resolvedPlate = resolvedDr?.vehicle_number || (driver.vehicle_number && driver.vehicle_number !== "Unassigned" ? driver.vehicle_number : "KA 01 EV 4421");
    const activeBooking = newRequests.find(b => b.id === bookingId);
    const updatedVehicleName = formatVehicleNameWithPlate(activeBooking?.vehicle_name || "Orange Go", resolvedPlate);

    const { error } = await supabase.from("bookings").update({
      driver_id: driver.id,
      status: "accepted",
      accepted_at: new Date().toISOString(),
      vehicle_name: updatedVehicleName,
    }).eq("id", bookingId).eq("status", "searching");
    if (error) { toast.error("Could not accept ride — it may have been taken by another driver."); return; }

    await lockBookingVehicle(supabase, bookingId, resolvedPlate, updatedVehicleName, activeBooking?.reference);

    toast.success("Ride accepted!");
    loadData();
  }

  async function preAcceptScheduledRide(bookingId: string) {
    if (!driver) return;
    const resolvedDr = resolveDriverDetails(driver);
    const resolvedPlate = resolvedDr?.vehicle_number || (driver.vehicle_number && driver.vehicle_number !== "Unassigned" ? driver.vehicle_number : "KA 01 EV 4421");
    const schedBooking = scheduledBookings.find(b => b.id === bookingId);
    const updatedVehicleName = formatVehicleNameWithPlate(schedBooking?.vehicle_name || "Orange Go", resolvedPlate);

    const { error } = await supabase.from("bookings").update({
      driver_id: driver.id,
      vehicle_name: updatedVehicleName,
    }).eq("id", bookingId).eq("status", "scheduled").is("driver_id", null);

    if (error) {
      toast.error("Could not claim scheduled booking — it may have already been claimed by another chauffeur.");
      return;
    }

    await lockBookingVehicle(supabase, bookingId, resolvedPlate, updatedVehicleName, schedBooking?.reference);

    toast.success("Scheduled Pre-Booking Confirmed! 🎯", {
      description: "You are the assigned chauffeur. Please be online and arrive at least 10 minutes before pickup.",
    });
    loadData();
  }

  async function startScheduledRideDispatch(booking: Booking) {
    if (!driver) return;
    if (activeRides.length > 0) {
      toast.error("You already have an active ride in progress. Complete it before starting dispatch.");
      return;
    }
    const resolvedDr = resolveDriverDetails(driver);
    const resolvedPlate = resolvedDr?.vehicle_number || (driver.vehicle_number && driver.vehicle_number !== "Unassigned" ? driver.vehicle_number : "KA 01 EV 4421");
    const updatedVehicleName = formatVehicleNameWithPlate(booking.vehicle_name || "Orange Go", resolvedPlate);

    const { error } = await supabase.from("bookings").update({
      status: "accepted",
      accepted_at: new Date().toISOString(),
      driver_id: driver.id,
      vehicle_name: updatedVehicleName,
    }).eq("id", booking.id);

    if (error) {
      toast.error("Could not activate dispatch for scheduled ride: " + error.message);
      return;
    }

    toast.success("Chauffeur En Route! Heading to scheduled pickup location.");
    loadData();
  }

  async function releaseScheduledRide(bookingId: string) {
    const { error } = await supabase.from("bookings").update({
      driver_id: null,
    }).eq("id", bookingId).eq("status", "scheduled");

    if (error) {
      toast.error("Failed to release ride: " + error.message);
      return;
    }
    toast.info("Scheduled ride returned to fleet pool.");
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
      updates.final_fare = Math.round(Number(booking.estimated_fare || 0));
      updates.payment_status = "paid";
      if (driver.vehicle_number && driver.vehicle_number !== "Unassigned") {
        updates.vehicle_name = formatVehicleNameWithPlate(booking.vehicle_name, driver.vehicle_number);
        saveRideVehiclePlate(booking.id, driver.vehicle_number, booking.reference);
      }
    }
    const { error } = await supabase.from("bookings").update(updates).eq("id", booking.id);
    if (error) { toast.error("Update failed"); return; }

    if (flow.next === "completed") {
      try {
        const nextTotal = (driver.total_rides || 0) + 1;
        await supabase.from("drivers").update({
          total_rides: nextTotal,
        }).eq("id", driver.id);
        setDriver(prev => prev ? { ...prev, total_rides: nextTotal } : prev);
      } catch (e) {
        console.warn("Could not update driver total_rides:", e);
      }
    }

    toast.success(`Status updated to ${flow.next.replace("_", " ")}`);
    loadData();
  }

  function getNavUrl(areaName: string, coordsOrAddress?: string | null) {
    // 1. Direct coordinate check from pickup_address / drop_address using parseCleanCoords
    const clean = parseCleanCoords(coordsOrAddress);
    if (clean) {
      return `https://www.google.com/maps/dir/?api=1&destination=${clean.lat},${clean.lng}&travelmode=driving`;
    }

    // 2. Extract coordinates embedded in the area name, e.g. "Current Location (12.9784, 77.6408)" or "Indiranagar (12.978, 77.641)"
    if (areaName) {
      const parenMatch = areaName.match(/\((-?\d+\.\d+),\s*(-?\d+\.\d+)\)/);
      if (parenMatch) {
        const lat = parseFloat(parenMatch[1]);
        const lng = parseFloat(parenMatch[2]);
        if (!isNaN(lat) && !isNaN(lng)) {
          return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
        }
      }
    }

    // 3. Exact or case-insensitive match from service_areas DB
    if (areaName) {
      const foundInAreas = areas[areaName] || Object.values(areas).find(a => a.name.toLowerCase() === areaName.toLowerCase());
      if (foundInAreas?.lat && foundInAreas?.lng) {
        return `https://www.google.com/maps/dir/?api=1&destination=${foundInAreas.lat},${foundInAreas.lng}&travelmode=driving`;
      }
    }

    // 4. Match against PAN_INDIA_PRESETS (Airports, Railway stations, Metros across India)
    if (areaName && Array.isArray(PAN_INDIA_PRESETS)) {
      const cleanTarget = areaName.toLowerCase().replace(/^(near|at|to|from)\s+/i, "").trim();
      const preset = PAN_INDIA_PRESETS.find(p => {
        const pName = p.name.toLowerCase();
        return pName === cleanTarget || cleanTarget.includes(pName) || pName.includes(cleanTarget);
      });
      if (preset?.lat && preset?.lng) {
        return `https://www.google.com/maps/dir/?api=1&destination=${preset.lat},${preset.lng}&travelmode=driving`;
      }
    }

    // 5. Fallback: Google Maps directions with clean query
    if (!areaName || areaName.trim() === "") return "https://www.google.com/maps";
    return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(areaName.trim())}&travelmode=driving`;
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
  const todayTotal   = todayRides.reduce((s, r) => s + Math.round(Number(r.final_fare ?? r.estimated_fare ?? 0)), 0);
  const todayUPI     = todayRides.filter(r => r.payment_method === "upi").reduce((s, r) => s + Math.round(Number(r.final_fare ?? r.estimated_fare ?? 0)), 0);
  const todayCash    = todayRides.filter(r => r.payment_method === "cash").reduce((s, r) => s + Math.round(Number(r.final_fare ?? r.estimated_fare ?? 0)), 0);
  const weekStart    = new Date(Date.now() - 7 * 24 * 3600000);
  const weeklyRides  = recentRides.filter(r => new Date(r.completed_at ?? "") >= weekStart);
  const weeklyEarnings = weeklyRides.reduce((s, r) => s + Math.round(Number(r.final_fare ?? r.estimated_fare ?? 0)), 0);
  const weekUPI      = weeklyRides.filter(r => r.payment_method === "upi").reduce((s, r) => s + Math.round(Number(r.final_fare ?? r.estimated_fare ?? 0)), 0);
  const weekCash     = weeklyRides.filter(r => r.payment_method === "cash").reduce((s, r) => s + Math.round(Number(r.final_fare ?? r.estimated_fare ?? 0)), 0);
  const monthlyEarnings = recentRides.reduce((s, r) => s + Math.round(Number(r.final_fare ?? r.estimated_fare ?? 0)), 0);
  const monthUPI     = recentRides.filter(r => r.payment_method === "upi").reduce((s, r) => s + Math.round(Number(r.final_fare ?? r.estimated_fare ?? 0)), 0);
  const monthCash    = recentRides.filter(r => r.payment_method === "cash").reduce((s, r) => s + Math.round(Number(r.final_fare ?? r.estimated_fare ?? 0)), 0);
  const avgRating    = recentRides.filter(r => r.rating).reduce((sum, r, _, arr) => sum + (r.rating ?? 0) / arr.length, 0) || driver.rating;

  // Operating model
  const isPartnerDriver = driver.driver_type === "partner" || Boolean((driver as any).owns_vehicle);

  // Partner commission calculations (15% platform commission model)
  const allTimeFares = recentRides.reduce((s, r) => s + Math.round(Number(r.final_fare ?? r.estimated_fare ?? 0)), 0);
  const partnerCommissionPayable = Math.round(allTimeFares * 0.15);
  const partnerCommissionPaid = commissionSettlements.reduce((s, c) => s + Math.round(Number(c.amount || 0)), 0);
  const partnerCommissionDue = Math.max(0, partnerCommissionPayable - partnerCommissionPaid);
  const partnerNetEarnings = Math.max(0, allTimeFares - partnerCommissionPayable);

  // Cash calculations & Admin settlement balance (Strict whole rupees)
  const totalCashCollected = recentRides
    .filter(r => r.payment_method === "cash")
    .reduce((s, r) => s + Math.round(Number(r.final_fare ?? r.estimated_fare ?? 0)), 0);

  const totalCashSubmitted = settlements
    .reduce((s, x) => s + Math.round(Number(x.amount || 0)), 0);

  const currentCashHolding = Math.max(0, totalCashCollected - totalCashSubmitted);

  async function handleSubmitUpiDeposit() {
    const amt = Number(depositAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid deposit amount.");
      return;
    }
    if (amt > currentCashHolding) {
      toast.error(`Deposit amount cannot exceed holding cash of ₹${currentCashHolding}.`);
      return;
    }
    if (!depositUtr || depositUtr.trim().length < 4) {
      toast.error("Please enter a valid 12-digit UPI Transaction / UTR reference number.");
      return;
    }

    setSubmittingDeposit(true);
    const cleanUtr = depositUtr.trim().toUpperCase();
    const newRecord = {
      id: "settle-upi-" + Date.now(),
      driver_id: driver.id,
      amount: Math.round(amt),
      collected_by: "UPI Auto-Remit",
      notes: `UPI Deposit (UTR: ${cleanUtr}) to orangeetaxi@upi`,
      created_at: new Date().toISOString(),
    };

    try {
      const { data, error } = await supabase.from("driver_cash_settlements").insert({
        driver_id: driver.id,
        amount: Math.round(amt),
        collected_by: "UPI Auto-Remit",
        notes: `UPI Deposit (UTR: ${cleanUtr}) to orangeetaxi@upi`,
      }).select().single();

      if (data) {
        newRecord.id = data.id;
      }
      if (error) {
        console.warn("Could not insert to driver_cash_settlements in DB, saving locally:", error);
      }
    } catch (e) {
      console.warn("driver_cash_settlements insert error:", e);
    }

    // Update local state and localStorage
    const updated = [newRecord, ...settlements];
    setSettlements(updated);
    try {
      const stored = localStorage.getItem("orange_cash_settlements");
      const all = stored ? JSON.parse(stored) : [];
      localStorage.setItem("orange_cash_settlements", JSON.stringify([newRecord, ...all]));
    } catch (e) {}

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("cash_settlements_updated"));
    }

    toast.success(`₹${amt} UPI deposit submitted! Handover receipt recorded.`);
    setUpiDepositModalOpen(false);
    setDepositAmount("");
    setDepositUtr("");
    setSubmittingDeposit(false);
    await loadData();
  }

  async function handleSubmitUpiCommission() {
    const amt = Number(commissionPayAmount);
    if (!amt || amt <= 0) {
      toast.error("Please enter a valid payment amount.");
      return;
    }
    if (!commissionUtr || commissionUtr.trim().length < 4) {
      toast.error("Please enter a valid 12-digit UPI Transaction / UTR reference number.");
      return;
    }

    setSubmittingCommission(true);
    const cleanUtr = commissionUtr.trim().toUpperCase();
    const newRecord = {
      id: "comm-" + Date.now(),
      driver_id: driver.id,
      driver_name: driver.full_name || "Partner Driver",
      amount: Math.round(amt),
      payment_mode: "upi" as const,
      reference_no: `UTR: ${cleanUtr}`,
      collected_by: "UPI Auto-Remit",
      notes: `15% Platform Commission UPI Remittance (UTR: ${cleanUtr}) to orangeetaxi@upi`,
      created_at: new Date().toISOString(),
    };

    try {
      await supabase.from("driver_commission_settlements").insert({
        driver_id: driver.id,
        driver_name: driver.full_name || "Partner Driver",
        amount: Math.round(amt),
        payment_mode: "upi",
        reference_no: `UTR: ${cleanUtr}`,
        collected_by: "UPI Auto-Remit",
        notes: `15% Platform Commission UPI Remittance (UTR: ${cleanUtr}) to orangeetaxi@upi`,
      });
    } catch (e) {
      console.warn("Could not insert to driver_commission_settlements in DB:", e);
    }

    // Update local state and localStorage
    const stored = localStorage.getItem("orange_commission_settlements");
    let current = stored ? JSON.parse(stored) : [];
    current = [newRecord, ...current];
    try {
      localStorage.setItem("orange_commission_settlements", JSON.stringify(current));
    } catch (e) {}

    setCommissionSettlements(prev => [newRecord, ...prev]);

    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new Event("commission_settlements_updated"));
    }

    toast.success(`₹${amt} platform commission payment recorded!`);
    setUpiCommissionModalOpen(false);
    setCommissionPayAmount("");
    setCommissionUtr("");
    setSubmittingCommission(false);
    await loadData();
  }

  return (
    <section className="min-h-screen bg-warm py-10">
      <div className="section-shell">
        <NotificationBanner context="driver" className="mb-6" />
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            {driver.photo_url ? (
              <img
                src={driver.photo_url}
                alt={driver.full_name}
                className="size-16 rounded-2xl object-cover border-2 border-primary/30 shadow-md shrink-0"
              />
            ) : (
              <div className="grid size-16 place-items-center rounded-2xl bg-primary/10 text-primary font-bold text-2xl shrink-0 border border-primary/20">
                {driver.full_name.charAt(0)}
              </div>
            )}
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Driver Console</p>
                <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  isPartnerDriver 
                    ? "bg-amber-100 text-amber-900 border border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800"
                    : "bg-blue-100 text-blue-900 border border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800"
                }`}>
                  {isPartnerDriver ? "⚡ Partner Owner-Operator (15% Comm.)" : "🏢 Company Fleet (Fixed Salary)"}
                </span>
              </div>
              <h1 className="display-serif mt-1 text-3xl sm:text-4xl">Welcome, {driver.full_name.split(" ")[0]}.</h1>
              <div className="mt-2 flex items-center gap-2 flex-wrap">
                <span className="text-sm text-muted-foreground">{driver.city}</span>
                <span className="text-muted-foreground text-xs">·</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                  <Car className="size-3.5" />
                  <span>{driver.vehicle_model || (isPartnerDriver ? "Private EV" : "Mahindra BE.6")}</span>
                  <span className="font-mono font-bold">
                    {driver.vehicle_number && driver.vehicle_number !== "Unassigned" ? driver.vehicle_number : "No car assigned today"}
                  </span>
                </span>
                <span className="text-muted-foreground text-xs">·</span>
                {isPartnerDriver ? (
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                    partnerCommissionDue > 0
                      ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                      : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                  }`}>
                    <Percent className="size-3.5" />
                    <span>Comm. Due: <strong className="font-mono">₹{partnerCommissionDue}</strong></span>
                  </span>
                ) : (
                  <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${
                    currentCashHolding > 0
                      ? "border-amber-400 bg-amber-50 text-amber-800 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-300"
                      : "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-300"
                  }`}>
                    <Banknote className="size-3.5" />
                    <span>Cash in Hand: <strong className="font-mono">₹{Math.round(currentCashHolding)}</strong></span>
                  </span>
                )}
                <span className="text-muted-foreground text-xs">·</span>
                <button
                type="button"
                onClick={async () => {
                  const newPhone = prompt("Update your contact phone number (used for passenger calls):", driver.phone || "");
                  if (newPhone !== null && newPhone.trim()) {
                    const p = newPhone.trim();
                    await supabase.from("drivers").update({ phone: p }).eq("id", driver.id);
                    await supabase.from("profiles").update({ phone: p }).eq("id", user.id);
                    await supabase.auth.updateUser({ data: { phone: p } });
                    setDriver({ ...driver, phone: p });
                    toast.success("Phone number updated successfully!");
                  }
                }}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors cursor-pointer"
                title="Click to update phone number"
              >
                <Phone className="size-3.5" />
                <span>Phone: <strong className="font-mono">{driver.phone || "Add Phone ✏️"}</strong></span>
              </button>
            </div>
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

        {/* Top Emergency Pulsating Alert Banner when new requests are available */}
        {driver.is_online && newRequests.length > 0 && (
          <div className="mt-6 rounded-2xl border-2 border-amber-500 bg-gradient-to-r from-amber-500/15 via-primary/10 to-amber-500/15 p-4 sm:p-5 shadow-lg shadow-amber-500/10 animate-pulse">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex size-3 rounded-full bg-amber-500 animate-ping" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <Bell className="size-4 text-amber-500 animate-bounce" />
                    {newRequests.length} New Ride Request{newRequests.length > 1 ? "s" : ""} Available!
                  </span>
                  <span className="font-mono font-bold text-lg text-primary">
                    ₹{Math.round(newRequests[0].estimated_fare)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    ({Math.round(newRequests[0].distance_km)} km • {newRequests[0].vehicle_name})
                  </span>
                </div>

                <p className="text-sm font-bold text-foreground flex items-center gap-2 flex-wrap">
                  <span>{newRequests[0].pickup_area}</span>
                  <span className="text-primary font-bold">→</span>
                  <span>{newRequests[0].drop_area}</span>
                </p>

                {/* Comfort preference preview on top banner */}
                {(() => {
                  const reqPref = parseRidePreferences(newRequests[0].pickup_address, newRequests[0].id || newRequests[0].reference);
                  if (!reqPref.cabinClimate && !reqPref.quietRide && !reqPref.pickupPillar) return null;
                  return (
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {reqPref.cabinClimate && (() => {
                        const b = getCabinClimateBadge(reqPref.cabinClimate);
                        return (
                          <span className={`inline-flex items-center gap-1 rounded-full border ${b.borderClass} ${b.bgClass} px-2.5 py-0.5 text-[11px] font-bold ${b.textClass}`}>
                            <span>{b.icon}</span>
                            <span>{b.label}</span>
                          </span>
                        );
                      })()}
                      {reqPref.quietRide && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-bold text-purple-600 dark:text-purple-400">
                          <VolumeX className="size-3" />
                          <span>Quiet Ride Requested</span>
                        </span>
                      )}
                      {reqPref.pickupPillar && (
                        <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                          <MapPin className="size-3" />
                          <span>Pillar: {reqPref.pickupPillar}</span>
                        </span>
                      )}
                    </div>
                  );
                })()}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  type="button"
                  onClick={() => {
                    const next = !soundEnabled;
                    setSoundEnabled(next);
                    localStorage.setItem("orange_driver_sound_enabled", String(next));
                    if (!next) toast.info("Alert chime muted 🔕");
                    else toast.success("Alert chime enabled 🔔");
                  }}
                  className="text-xs h-9 border-border bg-background"
                >
                  {soundEnabled ? <VolumeX className="mr-1.5 size-3.5 text-muted-foreground" /> : <Bell className="mr-1.5 size-3.5 text-primary" />}
                  <span>{soundEnabled ? "Mute Sound" : "Unmute"}</span>
                </Button>

                <Button
                  size="sm"
                  type="button"
                  onClick={() => acceptRide(newRequests[0].id)}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs h-9 px-4 shadow-md active:scale-95"
                >
                  <Check className="mr-1.5 size-4" />
                  <span>Accept Ride (1-Tap)</span>
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Urgent Scheduled Ride Priority Dispatch Alert Banner */}
        {(() => {
          const urgentSched = scheduledBookings.filter(b => {
            if (b.driver_id) return false;
            if (!b.scheduled_at) return false;
            const diffMs = new Date(b.scheduled_at).getTime() - Date.now();
            return diffMs > -15 * 60 * 1000 && diffMs <= 30 * 60 * 1000;
          });
          if (!driver?.is_online || urgentSched.length === 0) return null;
          const target = urgentSched[0];
          const diffMin = Math.max(1, Math.round((new Date(target.scheduled_at!).getTime() - Date.now()) / 60000));
          return (
            <div className="mt-4 rounded-2xl border-2 border-purple-500 bg-gradient-to-r from-purple-500/15 via-primary/10 to-purple-500/15 p-4 sm:p-5 shadow-lg shadow-purple-500/10">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="flex size-3 rounded-full bg-purple-500 animate-ping" />
                    <span className="text-xs font-extrabold uppercase tracking-wider text-purple-600 dark:text-purple-400 flex items-center gap-1.5">
                      <Calendar className="size-4 text-purple-500" />
                      ⚡ Urgent Advance Booking • Pickup in {diffMin} Mins!
                    </span>
                    <span className="font-mono font-bold text-lg text-primary">
                      ₹{Math.round(target.estimated_fare)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      ({Math.round(target.distance_km)} km • {target.vehicle_name})
                    </span>
                  </div>

                  <p className="text-sm font-bold text-foreground flex items-center gap-2 flex-wrap">
                    <span>{target.pickup_area}</span>
                    <span className="text-primary font-bold">→</span>
                    <span>{target.drop_area}</span>
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    type="button"
                    onClick={() => preAcceptScheduledRide(target.id)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-9 px-5 shadow-md active:scale-95"
                  >
                    <Check className="mr-1.5 size-4" />
                    <span>Claim & Dispatch</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Available Scheduled Pre-Bookings Fleet Banner */}
        {(() => {
          const unclaimed = scheduledBookings.filter(b => !b.driver_id);
          const urgentSched = scheduledBookings.filter(b => {
            if (b.driver_id) return false;
            if (!b.scheduled_at) return false;
            const diffMs = new Date(b.scheduled_at).getTime() - Date.now();
            return diffMs > -15 * 60 * 1000 && diffMs <= 30 * 60 * 1000;
          });
          if (!driver?.is_online || urgentSched.length > 0 || unclaimed.length === 0) return null;
          const target = unclaimed[0];
          const schedule = formatScheduledDeparture(target.scheduled_at);
          return (
            <div className="mt-4 rounded-xl border border-purple-400/60 bg-gradient-to-r from-purple-500/10 via-background to-purple-500/5 p-4 shadow-sm">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="grid size-9 place-items-center rounded-lg bg-purple-600 text-white shrink-0">
                    <Calendar className="size-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                        📅 {unclaimed.length} Advance Scheduled {unclaimed.length === 1 ? "Trip" : "Trips"} in Fleet Pool
                      </span>
                      <span className="text-xs text-muted-foreground">• Pickup {schedule.countdown}</span>
                      <span className="font-mono font-bold text-sm text-primary">₹{Math.round(target.estimated_fare)}</span>
                    </div>
                    <p className="text-xs font-medium text-foreground mt-0.5">
                      {target.pickup_area} → {target.drop_area} ({Math.round(target.distance_km)} km • {target.vehicle_name})
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => preAcceptScheduledRide(target.id)}
                    className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-8 px-3.5 shadow active:scale-95"
                  >
                    <Check className="mr-1 size-3.5" />
                    <span>Pre-Claim Ride (₹{Math.round(target.estimated_fare)})</span>
                  </Button>
                </div>
              </div>
            </div>
          );
        })()}

        <Tabs defaultValue="rides" className="mt-10">
          <TabsList className="mb-6">
            <TabsTrigger value="rides">Active Rides {activeRides.length > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{activeRides.length}</span>}</TabsTrigger>
            <TabsTrigger value="requests">New Requests {newRequests.length > 0 && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{newRequests.length}</span>}</TabsTrigger>
            <TabsTrigger value="scheduled">
              Scheduled Pre-Bookings {scheduledBookings.length > 0 && <span className="ml-1.5 rounded-full bg-purple-600 px-1.5 py-0.5 text-[10px] font-bold text-white">{scheduledBookings.length}</span>}
            </TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
            <TabsTrigger value="praise">
              Customer Praise & Tips {driverReviews.length > 0 && <span className="ml-1.5 rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{driverReviews.length}</span>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="rides">
            {/* Pre-assigned Scheduled Duties for this Chauffeur */}
            {(() => {
              const myScheduled = scheduledBookings.filter(b => b.driver_id === driver?.id);
              if (myScheduled.length === 0) return null;
              return (
                <div className="mb-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Calendar className="size-4 text-purple-600" />
                      <span>Upcoming Pre-Assigned Duties ({myScheduled.length})</span>
                    </h3>
                    <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold bg-purple-50 dark:bg-purple-950/40 px-2.5 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                      Guaranteed Advance Booking
                    </span>
                  </div>

                  <div className="space-y-3">
                    {myScheduled.map((ride) => {
                      const schedule = formatScheduledDeparture(ride.scheduled_at);
                      const customer = ride.customer_id ? customerProfiles[ride.customer_id] : null;

                      return (
                        <div
                          key={ride.id}
                          className="rounded-xl border-2 border-purple-500/40 bg-purple-500/[0.04] p-5 shadow-sm"
                        >
                          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-sm font-bold">{ride.reference}</span>
                                <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300 text-[11px] font-bold px-2 py-0.5 border border-emerald-300">
                                  ✓ Pre-Assigned to You
                                </span>
                                {schedule.isUrgent && (
                                  <span className="rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-400 text-[11px] font-bold px-2 py-0.5 animate-pulse">
                                    ⚡ Dispatch Window Active (&lt; 30m)
                                  </span>
                                )}
                                <span className="ml-auto flex items-center gap-1.5 text-xs font-bold text-purple-600 bg-purple-100 dark:bg-purple-950 px-2.5 py-0.5 rounded-md">
                                  <Clock className="size-3.5" />
                                  <span>{schedule.countdown}</span>
                                </span>
                              </div>

                              <div className="flex items-center gap-2 text-xs font-semibold text-foreground bg-muted/60 px-3 py-1.5 rounded-lg">
                                <Calendar className="size-3.5 text-purple-600 shrink-0" />
                                <span>Departure: <strong>{schedule.fullText}</strong></span>
                              </div>

                              <div className="flex items-center gap-2 text-sm font-bold">
                                <MapPin className="size-4 text-primary shrink-0" />
                                <a href={getNavUrl(ride.pickup_area, ride.pickup_address)} target="_blank" rel="noreferrer" className="hover:underline hover:text-primary">
                                  {ride.pickup_area}
                                </a>
                                <span>→</span>
                                <Navigation className="size-4 text-primary shrink-0" />
                                <a href={getNavUrl(ride.drop_area, ride.drop_address)} target="_blank" rel="noreferrer" className="hover:underline hover:text-primary">
                                  {ride.drop_area}
                                </a>
                              </div>

                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="font-mono font-bold text-primary text-sm">₹{Math.round(ride.estimated_fare)}</span>
                                <span>{Math.round(ride.distance_km)} km</span>
                                <span>{ride.vehicle_name}</span>
                                {customer && (
                                  <span className="flex items-center gap-1 text-foreground font-medium">
                                    <User className="size-3 text-muted-foreground" /> {customer.full_name} ({customer.phone || "No phone"})
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex md:flex-col gap-2 shrink-0 justify-end">
                              <Button
                                size="sm"
                                onClick={() => startScheduledRideDispatch(ride)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs h-9 px-4 shadow-sm active:scale-95"
                              >
                                <Navigation className="mr-1.5 size-3.5" />
                                <span>Start Dispatch (En Route)</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => releaseScheduledRide(ride.id)}
                                className="text-xs h-9 border-border text-muted-foreground hover:text-destructive"
                              >
                                Return to Pool
                              </Button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {activeRides.length === 0 ? (
              scheduledBookings.filter(b => b.driver_id === driver?.id).length === 0 && (
                <EmptyState icon={Navigation} title="No active rides" text="Accept a ride request to get started." />
              )
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
                            <MapPin className="size-4 text-primary shrink-0" />
                            <a 
                              href={getNavUrl(ride.pickup_area, ride.pickup_address)} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-foreground hover:underline hover:text-primary transition-colors"
                              title="Open Pickup in Google Maps"
                            >
                              {ride.pickup_area}
                            </a>
                            <span className="text-border">→</span>
                            <Navigation className="size-4 text-primary shrink-0" />
                            <a 
                              href={getNavUrl(ride.drop_area, ride.drop_address)} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-foreground hover:underline hover:text-primary transition-colors"
                              title="Open Drop-off in Google Maps"
                            >
                              {ride.drop_area}
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Passenger Ride Preferences (Cabin Climate, Quiet Mode, Hub/Pillar) */}
                      {(() => {
                        const ridePrefs = parseRidePreferences(ride.pickup_address, ride.id || ride.reference);
                        const hasPrefs = ridePrefs.cabinClimate || ridePrefs.quietRide || ridePrefs.pickupPillar;
                        if (!hasPrefs) return null;

                        return (
                          <div className="mt-3.5 rounded-xl border border-border bg-muted/30 p-3.5 space-y-2">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                <Sparkles className="size-3 text-primary" />
                                Passenger Comfort & Trip Preferences
                              </span>
                              <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                Customer Request
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              {ridePrefs.cabinClimate && (() => {
                                const b = getCabinClimateBadge(ridePrefs.cabinClimate);
                                return (
                                  <span className={`inline-flex items-center gap-1.5 rounded-lg border ${b.borderClass} ${b.bgClass} px-3 py-1.5 text-xs font-bold ${b.textClass}`}>
                                    <Snowflake className="size-3.5" />
                                    <span>{b.label}</span>
                                    <span className="text-[10px] font-normal opacity-80">(Keep cabin pre-cooled)</span>
                                  </span>
                                );
                              })()}
                              {ridePrefs.quietRide && (
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-600 dark:text-purple-400">
                                  <VolumeX className="size-3.5" />
                                  <span>Quiet Ride (Resting / Work Call — No Chitchat)</span>
                                </span>
                              )}
                              {ridePrefs.pickupPillar && (
                                <span className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-bold text-amber-700 dark:text-amber-400">
                                  <MapPin className="size-3.5" />
                                  <span>Designated Pillar: {ridePrefs.pickupPillar}</span>
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })()}

                      {/* Customer Contact & In-Ride Communication Card */}
                      {(() => {
                        const customerInfo = (ride.customer_id && customerProfiles[ride.customer_id]) || {
                          full_name: "Passenger",
                          phone: "",
                        };
                        const cleanCustomerPhone = (customerInfo.phone || "").replace(/\D/g, "");

                        return (
                          <div className="mt-4 rounded-xl border border-border/80 bg-muted/40 p-3.5 sm:p-4">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="flex size-11 items-center justify-center rounded-full bg-primary/10 border border-primary/20 text-primary font-bold text-sm shrink-0">
                                  {(customerInfo.full_name || "P").charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Passenger Details</span>
                                  </div>
                                  <p className="font-bold text-sm text-foreground truncate">{customerInfo.full_name || "Passenger"}</p>
                                  {customerInfo.phone ? (
                                    <div className="flex items-center gap-2 mt-0.5">
                                      <span className="font-mono text-xs font-semibold text-primary">{customerInfo.phone}</span>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(customerInfo.phone);
                                          toast.success(`Copied customer phone: ${customerInfo.phone}`);
                                        }}
                                        className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 border border-border/60 rounded px-1.5 py-0.5"
                                        title="Copy customer phone"
                                      >
                                        <Copy className="size-3" />
                                        <span>Copy</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-[11px] text-muted-foreground italic">Phone: Syncing via booking</span>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons: Call Customer, WhatsApp & In-Ride Chat */}
                              <div className="flex items-center gap-2 flex-wrap pt-1 sm:pt-0">
                                {cleanCustomerPhone ? (
                                  <a
                                    href={`tel:${cleanCustomerPhone}`}
                                    onClick={() => toast.success(`Calling ${customerInfo.full_name}: ${customerInfo.phone}`)}
                                    className="flex items-center gap-1.5 rounded-lg bg-primary px-3.5 py-2 text-xs font-bold text-primary-foreground shadow-sm hover:bg-primary/90 transition-all active:scale-95"
                                  >
                                    <PhoneCall className="size-3.5" />
                                    <span>Call Customer</span>
                                  </a>
                                ) : (
                                  <a
                                    href="tel:+911140007000"
                                    className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-all"
                                  >
                                    <Phone className="size-3.5" />
                                    <span>Helpline</span>
                                  </a>
                                )}

                                {cleanCustomerPhone && (
                                  <a
                                    href={`https://wa.me/${cleanCustomerPhone.startsWith("91") ? cleanCustomerPhone : `91${cleanCustomerPhone}`}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-600 hover:bg-emerald-500/20 transition-all active:scale-95"
                                    title="Chat on WhatsApp"
                                  >
                                    <MessageSquare className="size-3.5" />
                                    <span className="hidden sm:inline">WhatsApp</span>
                                  </a>
                                )}

                                {/* In-Ride Chat Button with Unread Badge */}
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setActiveChatRide(ride);
                                    setUnreadChats(prev => ({ ...prev, [ride.id]: 0 }));
                                  }}
                                  className="relative flex items-center gap-1.5 border-primary/40 bg-primary/5 hover:bg-primary/10 text-primary font-bold text-xs h-9 px-3"
                                >
                                  <MessageSquare className="size-3.5 text-primary" />
                                  <span>In-Ride Chat</span>
                                  {unreadChats[ride.id] > 0 && (
                                    <span className="ml-1 flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground animate-bounce">
                                      {unreadChats[ride.id]}
                                    </span>
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        );
                      })()}

                      {ride.status === "accepted" && (
                        <div className="mt-6 flex flex-col sm:flex-row gap-3 border-t border-border pt-4">
                          <Button asChild variant="outline" className="flex-1"><a href={getNavUrl(ride.pickup_area, ride.pickup_address)} target="_blank" rel="noreferrer"><Map className="mr-2 size-4" /> Navigate to Pickup</a></Button>
                          <Button onClick={() => advanceStatus(ride)} className="flex-1">Mark Arrived <Check className="ml-2 size-4" /></Button>
                        </div>
                      )}

                      {ride.status === "arrived" && (
                        <div className="mt-6 border-t border-border pt-4 text-center">
                          {/* Live Waiting Fee Timer */}
                          <div className="mb-4">
                            <WaitingFeeTimer arrivedAt={ride.arrived_at} isDriver={true} />
                          </div>

                          <div className="mb-3 flex justify-center">
                            <Button asChild variant="ghost" size="sm" className="text-xs text-muted-foreground hover:text-foreground">
                              <a href={getNavUrl(ride.pickup_area, ride.pickup_address)} target="_blank" rel="noreferrer">
                                <Map className="mr-1.5 size-3.5" /> Re-open Pickup Navigation
                              </a>
                            </Button>
                          </div>
                          <p className="text-sm font-semibold mb-3">
                            Ask customer for the {ride.ride_otp?.length === 6 ? "6" : "4"}-digit OTP
                          </p>
                          <div className="flex flex-col items-center gap-4">
                            {(() => {
                              const expectedLen = ride.ride_otp?.length === 6 ? 6 : 4;
                              return (
                                <>
                                  <InputOTP
                                    maxLength={expectedLen}
                                    value={otpInputs[ride.id] || ""}
                                    onChange={(val) => setOtpInputs(p => ({ ...p, [ride.id]: val }))}
                                  >
                                    <InputOTPGroup>
                                      {Array.from({ length: expectedLen }, (_, i) => (
                                        <InputOTPSlot key={i} index={i} className="size-10 text-lg" />
                                      ))}
                                    </InputOTPGroup>
                                  </InputOTP>
                                  <Button
                                    onClick={() => advanceStatus(ride)}
                                    disabled={otpInputs[ride.id]?.length !== expectedLen}
                                    className="w-full sm:w-auto"
                                  >
                                    Verify & Start Ride <ArrowRight className="ml-2 size-4" />
                                  </Button>
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}

                      {ride.status === "in_progress" && (
                        <div className="mt-6 flex flex-col sm:flex-row gap-3 border-t border-border pt-4">
                          <Button asChild variant="outline" className="flex-1"><a href={getNavUrl(ride.drop_area, ride.drop_address)} target="_blank" rel="noreferrer"><Map className="mr-2 size-4" /> Navigate to Drop-off</a></Button>
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

            {/* Open Advance Scheduled Pre-Bookings */}
            {(() => {
              const unclaimedSched = scheduledBookings.filter(b => !b.driver_id);
              if (unclaimedSched.length === 0) return null;
              return (
                <div className="mb-6 space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <Calendar className="size-4 text-purple-600" />
                      <span>Open Scheduled Pre-Bookings ({unclaimedSched.length})</span>
                    </h3>
                    <span className="text-xs text-purple-600 dark:text-purple-400 font-semibold bg-purple-50 dark:bg-purple-950/40 px-2 py-0.5 rounded-full border border-purple-200 dark:border-purple-800">
                      Available for Pre-Claim
                    </span>
                  </div>

                  <div className="space-y-3">
                    {unclaimedSched.map((ride) => {
                      const schedule = formatScheduledDeparture(ride.scheduled_at);
                      return (
                        <div key={ride.id} className="rounded-xl border-2 border-purple-500/40 bg-purple-500/[0.04] p-5 shadow-sm">
                          <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
                            <div className="flex-1 space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 text-[11px] font-bold px-2 py-0.5 border border-purple-300">
                                  📅 Scheduled Departure
                                </span>
                                <span className="text-xs font-bold text-foreground">{schedule.fullText}</span>
                                <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">({schedule.countdown})</span>
                              </div>
                              <div className="flex items-center gap-2 text-sm font-bold">
                                <MapPin className="size-4 text-primary shrink-0" />
                                <a href={getNavUrl(ride.pickup_area, ride.pickup_address)} target="_blank" rel="noreferrer" className="hover:underline hover:text-primary">
                                  {ride.pickup_area}
                                </a>
                                <span className="text-muted-foreground">→</span>
                                <Navigation className="size-4 text-primary shrink-0" />
                                <a href={getNavUrl(ride.drop_area, ride.drop_address)} target="_blank" rel="noreferrer" className="hover:underline hover:text-primary">
                                  {ride.drop_area}
                                </a>
                              </div>
                              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="font-mono font-bold text-primary text-sm">₹{Math.round(ride.estimated_fare)}</span>
                                <span>{Math.round(ride.distance_km)} km</span>
                                <span>{ride.vehicle_name}</span>
                              </div>
                            </div>
                            <Button
                              size="sm"
                              onClick={() => preAcceptScheduledRide(ride.id)}
                              className="bg-purple-600 hover:bg-purple-700 text-white font-bold text-xs h-9 px-4 shrink-0 shadow-sm active:scale-95"
                            >
                              <Check className="mr-1.5 size-4" />
                              <span>Pre-Claim Ride</span>
                            </Button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {newRequests.length === 0 ? (
              scheduledBookings.filter(b => !b.driver_id).length === 0 && (
                <EmptyState icon={Clock} title="No new requests" text="New ride requests in your area will appear here." />
              )
            ) : (
              <div className="space-y-4">
                {newRequests.map(ride => {
                  const reqPref = parseRidePreferences(ride.pickup_address, ride.id || ride.reference);
                  return (
                    <div key={ride.id} className="rounded-xl border border-border bg-background p-6">
                      <div className="flex justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 text-sm font-bold">
                            <MapPin className="size-4 text-primary shrink-0" />
                            <a 
                              href={getNavUrl(ride.pickup_area, ride.pickup_address)} 
                              target="_blank" 
                              rel="noreferrer"
                              className="hover:underline hover:text-primary transition-colors flex items-center gap-1"
                              title="Preview pickup location on Google Maps"
                            >
                              {ride.pickup_area}
                              <Map className="size-3 text-muted-foreground inline" />
                            </a>
                            <span className="text-muted-foreground">→</span> 
                            <Navigation className="size-4 text-primary shrink-0" />
                            <a 
                              href={getNavUrl(ride.drop_area, ride.drop_address)} 
                              target="_blank" 
                              rel="noreferrer"
                              className="hover:underline hover:text-primary transition-colors flex items-center gap-1"
                              title="Preview drop location on Google Maps"
                            >
                              {ride.drop_area}
                              <Map className="size-3 text-muted-foreground inline" />
                            </a>
                          </div>
                          <div className="mt-2 text-xs text-muted-foreground space-x-4">
                            <span className="font-bold text-primary font-mono text-sm">₹{Math.round(ride.estimated_fare)}</span>
                            <span>{Math.round(ride.distance_km)} km</span>
                            <span>{ride.vehicle_name}</span>
                          </div>

                          {/* Customer Comfort Preferences on incoming request */}
                          {(reqPref.cabinClimate || reqPref.quietRide || reqPref.pickupPillar) && (
                            <div className="mt-3 flex flex-wrap items-center gap-2 pt-2.5 border-t border-border/60">
                              {reqPref.cabinClimate && (() => {
                                const b = getCabinClimateBadge(reqPref.cabinClimate);
                                return (
                                  <span className={`inline-flex items-center gap-1 rounded-full border ${b.borderClass} ${b.bgClass} px-2.5 py-1 text-[11px] font-bold ${b.textClass}`}>
                                    <Snowflake className="size-3" />
                                    <span>Pre-cool {b.label}</span>
                                  </span>
                                );
                              })()}
                              {reqPref.quietRide && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-1 text-[11px] font-bold text-purple-600 dark:text-purple-400">
                                  <VolumeX className="size-3" />
                                  <span>Quiet Ride Requested</span>
                                </span>
                              )}
                              {reqPref.pickupPillar && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                                  <MapPin className="size-3" />
                                  <span>Pillar: {reqPref.pickupPillar}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex gap-2 shrink-0 items-start">
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => setNewRequests(p => p.filter(r => r.id !== ride.id))}><X className="size-4" /></Button>
                          <Button size="sm" onClick={() => acceptRide(ride.id)}>Accept</Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="scheduled">
            {/* Advance Scheduling Explainer Banner */}
            <div className="mb-6 rounded-2xl border border-purple-200/80 bg-gradient-to-r from-purple-50/90 via-background to-indigo-50/70 p-5 shadow-sm dark:border-purple-900/60 dark:from-purple-950/30 dark:to-indigo-950/20">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="grid size-10 place-items-center rounded-xl bg-purple-600 text-white shrink-0 shadow-sm shadow-purple-600/20">
                    <Calendar className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                      <span>Guaranteed Chauffeur Pre-Booking System</span>
                      <span className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300 text-[10px] font-bold px-2 py-0.5 border border-purple-200 dark:border-purple-800">
                        100% Payout / 0 Cancel Fees
                      </span>
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
                      Scheduled rides are confirmed in advance. Pre-claim long-distance airport & city trips to plan your daily earnings.
                      During the <strong>15–30 minute priority dispatch window</strong>, unclaimed rides broadcast urgent audio chimes. Chauffeurs must arrive <strong>5–10 mins prior</strong> with Dual-Zone AC pre-cooled to 22°C.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {scheduledBookings.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No scheduled pre-bookings currently"
                text="When passengers book advance rides for airport transfers or city meetings, they will appear here for you to claim."
              />
            ) : (
              <div className="space-y-4">
                {scheduledBookings.map((ride) => {
                  const schedule = formatScheduledDeparture(ride.scheduled_at);
                  const isAssignedToMe = ride.driver_id === driver?.id;
                  const isUnassigned = !ride.driver_id;
                  const reqPref = parseRidePreferences(ride.pickup_address, ride.id || ride.reference);
                  const customer = ride.customer_id ? customerProfiles[ride.customer_id] : null;

                  return (
                    <div
                      key={ride.id}
                      className={`rounded-xl border p-6 transition-all ${
                        isAssignedToMe
                          ? "border-purple-500/50 bg-purple-500/[0.03] dark:bg-purple-950/10 shadow-sm"
                          : schedule.isUrgent
                          ? "border-amber-500/60 bg-amber-500/[0.03] dark:bg-amber-950/10"
                          : "border-border bg-background"
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
                        <div className="flex-1 space-y-3">
                          {/* Top Row: Ref, Status, Time Countdown */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-bold">{ride.reference}</span>

                            {isAssignedToMe ? (
                              <span className="rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 text-[11px] font-bold px-2.5 py-0.5">
                                ✓ Assigned to You
                              </span>
                            ) : (
                              <span className="rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-300 dark:border-purple-800 text-[11px] font-bold px-2.5 py-0.5">
                                Available in Fleet Pool
                              </span>
                            )}

                            {schedule.isUrgent && (
                              <span className="rounded-full bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 text-[11px] font-bold px-2.5 py-0.5 animate-pulse">
                                ⚡ Dispatch Window Active (&lt; 30m)
                              </span>
                            )}

                            <span className="ml-auto flex items-center gap-1.5 text-xs font-bold text-purple-600 dark:text-purple-400 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/50 px-2.5 py-1 rounded-md">
                              <Clock className="size-3.5" />
                              <span>{schedule.countdown}</span>
                            </span>
                          </div>

                          {/* Scheduled Time Banner */}
                          <div className="flex items-center gap-2 text-xs font-semibold text-foreground bg-muted/50 px-3 py-2 rounded-lg border border-border/60">
                            <Calendar className="size-4 text-purple-600 dark:text-purple-400 shrink-0" />
                            <span>Scheduled Pickup: <strong>{schedule.fullText}</strong></span>
                          </div>

                          {/* Pickup & Drop Addresses */}
                          <div className="flex items-center gap-2 text-sm font-bold">
                            <MapPin className="size-4 text-primary shrink-0" />
                            <a
                              href={getNavUrl(ride.pickup_area, ride.pickup_address)}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline hover:text-primary transition-colors flex items-center gap-1 text-foreground"
                              title="Preview pickup location on Google Maps"
                            >
                              {ride.pickup_area}
                              <Map className="size-3 text-muted-foreground inline" />
                            </a>
                            <span className="text-muted-foreground">→</span>
                            <Navigation className="size-4 text-primary shrink-0" />
                            <a
                              href={getNavUrl(ride.drop_area, ride.drop_address)}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline hover:text-primary transition-colors flex items-center gap-1 text-foreground"
                              title="Preview drop location on Google Maps"
                            >
                              {ride.drop_area}
                              <Map className="size-3 text-muted-foreground inline" />
                            </a>
                          </div>

                          {/* Fare and distance */}
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="font-mono font-bold text-primary text-sm">₹{Math.round(ride.estimated_fare)}</span>
                            <span>{Math.round(ride.distance_km)} km</span>
                            <span>{ride.vehicle_name}</span>
                            {customer && (
                              <span className="flex items-center gap-1 text-foreground font-medium">
                                <User className="size-3 text-muted-foreground" />
                                {customer.full_name}
                              </span>
                            )}
                          </div>

                          {/* Passenger Comfort Preferences */}
                          {(reqPref.cabinClimate || reqPref.quietRide || reqPref.pickupPillar) && (
                            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border/60">
                              {reqPref.cabinClimate && (() => {
                                const b = getCabinClimateBadge(reqPref.cabinClimate);
                                return (
                                  <span className={`inline-flex items-center gap-1 rounded-full border ${b.borderClass} ${b.bgClass} px-2.5 py-0.5 text-[11px] font-bold ${b.textClass}`}>
                                    <Snowflake className="size-3" />
                                    <span>Pre-cool {b.label}</span>
                                  </span>
                                );
                              })()}
                              {reqPref.quietRide && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-purple-500/30 bg-purple-500/10 px-2.5 py-0.5 text-[11px] font-bold text-purple-600 dark:text-purple-400">
                                  <VolumeX className="size-3" />
                                  <span>Quiet Mode</span>
                                </span>
                              )}
                              {reqPref.pickupPillar && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-0.5 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                                  <MapPin className="size-3" />
                                  <span>Pillar: {reqPref.pickupPillar}</span>
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Action buttons */}
                        <div className="flex md:flex-col gap-2 shrink-0 justify-end">
                          {isAssignedToMe ? (
                            <>
                              <Button
                                size="sm"
                                onClick={() => startScheduledRideDispatch(ride)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-sm active:scale-95 text-xs h-9 px-4"
                              >
                                <Navigation className="mr-1.5 size-3.5" />
                                <span>Start Dispatch (En Route)</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => releaseScheduledRide(ride.id)}
                                className="text-xs h-9 border-border text-muted-foreground hover:text-destructive"
                              >
                                Return to Pool
                              </Button>
                            </>
                          ) : isUnassigned ? (
                            <Button
                              size="sm"
                              onClick={() => preAcceptScheduledRide(ride.id)}
                              className="bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-md shadow-purple-500/20 active:scale-95 text-xs h-9 px-4"
                            >
                              <Check className="mr-1.5 size-4" />
                              <span>Pre-Claim Ride (₹{Math.round(ride.estimated_fare)})</span>
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground font-semibold px-2 py-1">
                              Claimed by another chauffeur
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="earnings">
            {/* Operating Model Financial Card: Partner Commission Ledger vs Company Cash Handover */}
            {isPartnerDriver ? (
              <div className="mb-6 rounded-xl border border-amber-400/80 bg-gradient-to-br from-amber-50/70 via-background to-orange-50/50 p-5 shadow-sm dark:border-amber-900/60 dark:from-amber-950/30 dark:to-orange-950/20">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200 dark:border-amber-900/60 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="grid size-11 place-items-center rounded-xl bg-amber-500 text-white shadow-sm">
                      <Percent className="size-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs font-bold uppercase tracking-wider text-amber-900 dark:text-amber-300">
                          Partner Commission & Net Earnings
                        </p>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                          15% Platform Commission Model
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        You drive your own EV and retain 85% of all rider fares. 15% platform commission is settled with Orange Taxi.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="text-left sm:text-right">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase">Commission Balance Due</p>
                      <p className={`text-3xl font-mono font-bold ${partnerCommissionDue > 0 ? "text-amber-700 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                        ₹{partnerCommissionDue}
                      </p>
                    </div>
                    {partnerCommissionDue > 0 && (
                      <Button
                        type="button"
                        onClick={() => {
                          setCommissionPayAmount(Math.round(partnerCommissionDue));
                          setCommissionUtr("");
                          setUpiCommissionModalOpen(true);
                        }}
                        className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 shadow-md active:scale-95"
                      >
                        <Smartphone className="size-4" />
                        <span>Pay Commission via UPI ⚡</span>
                      </Button>
                    )}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="rounded-lg border border-border bg-background p-3.5">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase">Gross Fares Collected</p>
                    <p className="mt-1 text-2xl font-bold font-mono text-foreground">₹{allTimeFares}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">Cash + UPI from all rides</p>
                  </div>

                  <div className="rounded-lg border border-emerald-300 bg-emerald-50/60 p-3.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                    <p className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300 uppercase">Your Net Take-Home (85%)</p>
                    <p className="mt-1 text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">₹{partnerNetEarnings}</p>
                    <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/80 mt-0.5">Retained earnings after platform fee</p>
                  </div>

                  <div className="rounded-lg border border-border bg-background p-3.5">
                    <p className="text-[11px] font-semibold text-muted-foreground uppercase">Commission Paid to Admin</p>
                    <p className="mt-1 text-2xl font-bold font-mono text-foreground">₹{partnerCommissionPaid}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{commissionSettlements.length} recorded settlement{commissionSettlements.length !== 1 ? "s" : ""}</p>
                  </div>
                </div>

                {commissionSettlements.length > 0 && (
                  <div className="mt-4 pt-3 border-t border-amber-200/70 dark:border-amber-900/40">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                      Recent Commission Settlements Recorded by Admin
                    </p>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {commissionSettlements.slice(0, 5).map(c => (
                        <div key={c.id} className="flex items-center justify-between text-xs rounded-lg bg-background/90 px-3 py-2 border border-border">
                          <div className="flex items-center gap-2">
                            <Check className="size-3.5 text-emerald-600" />
                            <span className="font-semibold text-emerald-600 font-mono">₹{Math.round(c.amount)}</span>
                            <span className="text-muted-foreground text-[11px]">
                              via {c.payment_method?.toUpperCase() || "UPI"} {c.utr_reference ? `(UTR: ${c.utr_reference})` : ""}
                            </span>
                          </div>
                          <span className="font-mono text-[10px] text-muted-foreground">
                            {c.created_at ? new Date(c.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
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
                        Physical cash collected from riders. Reduces automatically when remitted via UPI or deposited with Admin.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                    <div className="text-left sm:text-right">
                      <p className="text-[11px] font-semibold text-muted-foreground uppercase">Current Cash Holding</p>
                      <p className="text-3xl font-mono font-bold text-amber-700 dark:text-amber-400">
                        ₹{Math.round(currentCashHolding)}
                      </p>
                    </div>
                    {currentCashHolding > 0 && (
                      <Button
                        type="button"
                        onClick={() => {
                          setDepositAmount(Math.round(currentCashHolding));
                          setDepositUtr("");
                          setUpiDepositModalOpen(true);
                        }}
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs gap-1.5 shadow-md active:scale-95"
                      >
                        <Smartphone className="size-4" />
                        <span>Deposit via UPI ⚡</span>
                      </Button>
                    )}
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
                            {s.notes?.includes("UTR") || s.notes?.includes("UPI") ? (
                              <span className="inline-flex items-center gap-1 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 text-[10px] font-bold border border-purple-500/20">
                                ⚡ UPI Remittance ({s.notes})
                              </span>
                            ) : (
                              <span className="text-muted-foreground text-[11px]">({s.notes || "Admin cash collection"})</span>
                            )}
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
            )}

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

          {/* Customer Praise, Badges & Tips Tab */}
          <TabsContent value="praise">
            {(() => {
              const totalTips = driverReviews.reduce((sum, r) => sum + (Number(r.tip) || 0), 0);
              const allRatings = driverReviews.map(r => Number(r.rating)).filter(Boolean);
              const praiseAvgRating = allRatings.length > 0
                ? (allRatings.reduce((a, b) => a + b, 0) / allRatings.length).toFixed(1)
                : (driver.rating || 5.0).toFixed(1);

              const complimentCounts: Record<string, number> = {};
              driverReviews.forEach(r => {
                if (Array.isArray(r.compliments)) {
                  r.compliments.forEach((c: string) => {
                    complimentCounts[c] = (complimentCounts[c] || 0) + 1;
                  });
                }
              });

              const totalCompliments = Object.values(complimentCounts).reduce((a, b) => a + b, 0);

              return (
                <div className="space-y-6">
                  {/* Summary Metric Cards */}
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-5">
                      <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                        <Banknote className="size-5" />
                        <span className="text-xs font-bold uppercase tracking-wider">Total Tips Earned</span>
                      </div>
                      <p className="mt-2 text-3xl font-extrabold text-foreground">₹{totalTips}</p>
                      <p className="mt-1 text-xs text-muted-foreground">100% direct to your bank payout</p>
                    </div>

                    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5">
                      <div className="flex items-center gap-2 text-amber-500">
                        <Star className="size-5 fill-amber-400 text-amber-400" />
                        <span className="text-xs font-bold uppercase tracking-wider">Driver Rating</span>
                      </div>
                      <p className="mt-2 text-3xl font-extrabold text-foreground">{praiseAvgRating} ⭐</p>
                      <p className="mt-1 text-xs text-muted-foreground">Based on customer ratings</p>
                    </div>

                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-5">
                      <div className="flex items-center gap-2 text-primary">
                        <Award className="size-5" />
                        <span className="text-xs font-bold uppercase tracking-wider">Praise Badges</span>
                      </div>
                      <p className="mt-2 text-3xl font-extrabold text-foreground">{totalCompliments}</p>
                      <p className="mt-1 text-xs text-muted-foreground">Compliments collected</p>
                    </div>
                  </div>

                  {/* Compliments Showcase Badges */}
                  <div className="rounded-xl border border-border bg-background p-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles className="size-5 text-primary" />
                      <h3 className="font-bold text-sm">Customer Compliment Badges</h3>
                    </div>
                    {Object.keys(complimentCounts).length === 0 ? (
                      <p className="text-xs text-muted-foreground">No compliment badges collected yet. Deliver exceptional service to earn praise badges!</p>
                    ) : (
                      <div className="flex flex-wrap gap-2.5">
                        {Object.entries(complimentCounts).map(([badge, count]) => (
                          <div
                            key={badge}
                            className="flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3.5 py-1.5 text-xs font-bold text-foreground shadow-sm"
                          >
                            <span>{badge}</span>
                            <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[10px] font-extrabold text-primary-foreground">
                              {count}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Passenger Reviews & Praise Feed */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground mb-3">Recent Customer Reviews</p>
                    {driverReviews.length === 0 ? (
                      <EmptyState icon={Heart} title="No customer reviews yet" text="Customer feedback and ratings will appear here after completed rides." />
                    ) : (
                      <div className="space-y-3">
                        {driverReviews.map((rev, idx) => (
                          <div key={rev.booking_id || idx} className="rounded-xl border border-border bg-background p-4 sm:p-5">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="flex items-center gap-2">
                                <div className="flex items-center gap-0.5">
                                  {[1, 2, 3, 4, 5].map((s) => (
                                    <Star
                                      key={s}
                                      className={`size-4 ${
                                        s <= (rev.rating || 5)
                                          ? "text-amber-400 fill-amber-400"
                                          : "text-muted-foreground/30"
                                      }`}
                                    />
                                  ))}
                                </div>
                                <span className="font-mono text-xs text-muted-foreground">
                                  {rev.reference ? `Ride #${rev.reference}` : "Ride"}
                                </span>
                              </div>

                              <div className="flex items-center gap-2">
                                {rev.tip > 0 && (
                                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                                    +₹{rev.tip} Tip
                                  </span>
                                )}
                                {rev.created_at && (
                                  <span className="text-[11px] text-muted-foreground">
                                    {new Date(rev.created_at).toLocaleDateString("en-IN", {
                                      day: "numeric",
                                      month: "short",
                                    })}
                                  </span>
                                )}
                              </div>
                            </div>

                            {rev.compliments && rev.compliments.length > 0 && (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {rev.compliments.map((c: string) => (
                                  <span
                                    key={c}
                                    className="rounded-md bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                                  >
                                    {c}
                                  </span>
                                ))}
                              </div>
                            )}

                            {rev.comment && (
                              <p className="mt-2.5 text-xs italic text-foreground bg-muted/30 p-2.5 rounded-lg border border-border/50">
                                "{rev.comment}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </TabsContent>
        </Tabs>
      </div>

      {/* Background Active Ride Chat Sheets for Realtime Alerts & In-Ride Messaging */}
      {activeRides.map(ride => {
        const isThisChatOpen = activeChatRide?.id === ride.id;
        const custInfo = (ride.customer_id && customerProfiles[ride.customer_id]) || {
          full_name: "Passenger",
          phone: "",
        };
        return (
          <RideChatSheet
            key={`ride-chat-${ride.id}`}
            bookingId={ride.id}
            bookingReference={ride.reference}
            currentUserType="driver"
            currentUserName={driver?.full_name || "Driver"}
            otherPartyName={custInfo.full_name || "Passenger"}
            otherPartyPhone={custInfo.phone}
            isOpen={isThisChatOpen}
            onOpenChange={(open) => {
              if (open) setActiveChatRide(ride);
              else if (activeChatRide?.id === ride.id) setActiveChatRide(null);
            }}
            onUnreadCountChange={(count) => {
              setUnreadChats(prev => ({ ...prev, [ride.id]: count }));
            }}
          />
        );
      })}

      {/* Fixed Salary Driver UPI Holding Cash Remittance Dialog */}
      <Dialog open={upiDepositModalOpen} onOpenChange={setUpiDepositModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Smartphone className="size-5 text-amber-600" />
              Remit Holding Cash via UPI
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Transfer physical passenger cash collections directly to Orange Taxi official account using any UPI app (GPay, PhonePe, Paytm, BHIM).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Cash in Hand Info */}
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase text-amber-700 dark:text-amber-400">Total Cash in Hand</p>
                <p className="text-2xl font-mono font-black text-amber-600 dark:text-amber-300">₹{Math.round(currentCashHolding)}</p>
              </div>
              <Badge className="bg-amber-600 text-white font-semibold text-xs">
                Physical Cash
              </Badge>
            </div>

            {/* Official Orange Taxi UPI ID */}
            <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Orange Taxi Official VPA:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText("orangeetaxi@upi");
                    toast.success("UPI ID copied: orangeetaxi@upi");
                  }}
                  className="inline-flex items-center gap-1 text-primary font-bold hover:underline"
                >
                  <Copy className="size-3" />
                  <span>Copy</span>
                </button>
              </div>
              <p className="font-mono font-extrabold text-sm text-foreground bg-background px-3 py-1.5 rounded-lg border border-border">
                orangeetaxi@upi
              </p>
              <p className="text-[11px] text-muted-foreground">Beneficiary Name: <strong className="text-foreground">Orange Taxi Limited</strong></p>
            </div>

            {/* Remittance Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Deposit Amount (₹)</Label>
              <Input
                type="number"
                min={1}
                max={Math.round(currentCashHolding)}
                value={depositAmount}
                onChange={(e) => setDepositAmount(e.target.value ? Number(e.target.value) : "")}
                placeholder="Enter deposit amount"
                className="font-mono text-base font-bold"
              />
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setDepositAmount(Math.round(currentCashHolding))}
                  className="text-xs h-7 font-medium"
                >
                  Full Cash (₹{Math.round(currentCashHolding)})
                </Button>
                {currentCashHolding >= 500 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDepositAmount(Math.min(Math.round(currentCashHolding), 500))}
                    className="text-xs h-7 font-medium"
                  >
                    ₹500
                  </Button>
                )}
                {currentCashHolding >= 1000 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setDepositAmount(Math.min(Math.round(currentCashHolding), 1000))}
                    className="text-xs h-7 font-medium"
                  >
                    ₹1,000
                  </Button>
                )}
              </div>
            </div>

            {/* Dynamic QR Code & 1-Tap UPI Intent Link */}
            {Number(depositAmount) > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-3">
                <p className="text-xs font-bold text-foreground">Scan with any UPI App to Pay ₹{depositAmount}</p>
                <div className="flex justify-center">
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-border/80">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`upi://pay?pa=orangeetaxi@upi&pn=Orange%20Taxi%20Limited&am=${depositAmount}&cu=INR&tn=${encodeURIComponent(`Cash Deposit Driver ${driver?.full_name || ""}`)}`)}`}
                      alt="UPI QR Code"
                      className="size-36 object-contain"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                  <a
                    href={`upi://pay?pa=orangeetaxi@upi&pn=Orange%20Taxi%20Limited&am=${depositAmount}&cu=INR&tn=${encodeURIComponent(`Cash Deposit Driver ${driver?.full_name || ""}`)}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md hover:bg-primary/90 active:scale-95"
                  >
                    <Smartphone className="size-4" />
                    <span>Open in UPI App (GPay / PhonePe / Paytm)</span>
                  </a>
                </div>
              </div>
            )}

            {/* 12-Digit UTR Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center justify-between">
                <span>12-Digit UPI Reference / UTR No. *</span>
                <span className="text-[10px] text-muted-foreground font-normal">Found in UPI app receipt</span>
              </Label>
              <Input
                type="text"
                maxLength={24}
                value={depositUtr}
                onChange={(e) => setDepositUtr(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                placeholder="e.g. 429182390124"
                className="font-mono uppercase font-semibold text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Enter the transaction ID / UTR shown after successful payment in your UPI app.
              </p>
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUpiDepositModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmitUpiDeposit}
                disabled={submittingDeposit || !depositAmount || Number(depositAmount) <= 0 || !depositUtr || depositUtr.trim().length < 4}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5"
              >
                {submittingDeposit ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                <span>Confirm Deposit</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Commission Partner Driver UPI Payment Dialog */}
      <Dialog open={upiCommissionModalOpen} onOpenChange={setUpiCommissionModalOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg font-bold">
              <Smartphone className="size-5 text-primary" />
              Pay 15% Platform Commission via UPI
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Settle your platform commission balance directly to Orange Taxi using any UPI app (GPay, PhonePe, Paytm, BHIM).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Commission Due Info */}
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 flex items-center justify-between">
              <div>
                <p className="text-[11px] font-bold uppercase text-primary">Commission Balance Due</p>
                <p className="text-2xl font-mono font-black text-primary">₹{partnerCommissionDue}</p>
              </div>
              <Badge className="bg-primary text-primary-foreground font-semibold text-xs">
                15% Platform Fee
              </Badge>
            </div>

            {/* Official Orange Taxi UPI ID */}
            <div className="rounded-xl border border-border bg-muted/40 p-3 space-y-1.5">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground font-medium">Orange Taxi Official VPA:</span>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText("orangeetaxi@upi");
                    toast.success("UPI ID copied: orangeetaxi@upi");
                  }}
                  className="inline-flex items-center gap-1 text-primary font-bold hover:underline"
                >
                  <Copy className="size-3" />
                  <span>Copy</span>
                </button>
              </div>
              <p className="font-mono font-extrabold text-sm text-foreground bg-background px-3 py-1.5 rounded-lg border border-border">
                orangeetaxi@upi
              </p>
              <p className="text-[11px] text-muted-foreground">Beneficiary Name: <strong className="text-foreground">Orange Taxi Limited</strong></p>
            </div>

            {/* Commission Payment Amount */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold">Payment Amount (₹)</Label>
              <Input
                type="number"
                min={1}
                value={commissionPayAmount}
                onChange={(e) => setCommissionPayAmount(e.target.value ? Number(e.target.value) : "")}
                placeholder="Enter amount to pay"
                className="font-mono text-base font-bold"
              />
              <div className="flex items-center gap-2 pt-1 flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCommissionPayAmount(partnerCommissionDue)}
                  className="text-xs h-7 font-medium"
                >
                  Full Due (₹{partnerCommissionDue})
                </Button>
                {partnerCommissionDue > 500 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCommissionPayAmount(500)}
                    className="text-xs h-7 font-medium"
                  >
                    ₹500
                  </Button>
                )}
                {partnerCommissionDue > 1000 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setCommissionPayAmount(1000)}
                    className="text-xs h-7 font-medium"
                  >
                    ₹1,000
                  </Button>
                )}
              </div>
            </div>

            {/* Dynamic QR Code & 1-Tap UPI Intent Link */}
            {Number(commissionPayAmount) > 0 && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center space-y-3">
                <p className="text-xs font-bold text-foreground">Scan with any UPI App to Pay ₹{commissionPayAmount}</p>
                <div className="flex justify-center">
                  <div className="p-2 bg-white rounded-xl shadow-sm border border-border/80">
                    <img
                      src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(`upi://pay?pa=orangeetaxi@upi&pn=Orange%20Taxi%20Limited&am=${commissionPayAmount}&cu=INR&tn=${encodeURIComponent(`Platform Commission ${driver?.full_name || ""}`)}`)}`}
                      alt="UPI QR Code"
                      className="size-36 object-contain"
                    />
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
                  <a
                    href={`upi://pay?pa=orangeetaxi@upi&pn=Orange%20Taxi%20Limited&am=${commissionPayAmount}&cu=INR&tn=${encodeURIComponent(`Platform Commission ${driver?.full_name || ""}`)}`}
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow-md hover:bg-primary/90 active:scale-95"
                  >
                    <Smartphone className="size-4" />
                    <span>Open in UPI App (GPay / PhonePe / Paytm)</span>
                  </a>
                </div>
              </div>
            )}

            {/* 12-Digit UTR Input */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold flex items-center justify-between">
                <span>12-Digit UPI Reference / UTR No. *</span>
                <span className="text-[10px] text-muted-foreground font-normal">Found in UPI app receipt</span>
              </Label>
              <Input
                type="text"
                maxLength={24}
                value={commissionUtr}
                onChange={(e) => setCommissionUtr(e.target.value.replace(/[^a-zA-Z0-9]/g, ""))}
                placeholder="e.g. 429182390124"
                className="font-mono uppercase font-semibold text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Enter the transaction ID / UTR shown after successful payment in your UPI app.
              </p>
            </div>

            <div className="pt-2 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setUpiCommissionModalOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSubmitUpiCommission}
                disabled={submittingCommission || !commissionPayAmount || Number(commissionPayAmount) <= 0 || !commissionUtr || commissionUtr.trim().length < 4}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground font-bold gap-1.5"
              >
                {submittingCommission ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
                <span>Record Payment</span>
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}

function EmptyState({ icon: Icon, title, text }: any) {
  return <div className="flex flex-col items-center rounded-xl border border-dashed py-16 text-center"><Icon className="size-10 text-muted-foreground/40" /><p className="mt-4 font-semibold">{title}</p><p className="mt-2 text-sm text-muted-foreground">{text}</p></div>;
}
