// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useRef } from "react";
import {
  Car,
  MapPin,
  Navigation,
  Phone,
  PhoneCall,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Share2,
  Sparkles,
  ArrowRight,
  Clock,
  CheckCircle2,
  Search,
  ExternalLink,
  LifeBuoy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { LiveRideMap } from "@/components/live-ride-map";
import { getBookingVehiclePlate, resolveDriverDetails } from "@/lib/ride-vehicle";

export const Route = createFileRoute("/track")({
  validateSearch: (search: Record<string, unknown>) => ({
    ref: typeof search.ref === "string" ? search.ref : "",
  }),
  head: () => ({
    meta: [
      { title: "Live Ride Tracking — Orange Taxi" },
      {
        name: "description",
        content: "Track live ride status, driver location, vehicle details, and estimated arrival for Orange Electric Taxi.",
      },
    ],
  }),
  component: TrackPage,
});

const STATUS_LABELS: Record<string, { label: string; color: string; desc: string }> = {
  searching: {
    label: "Finding Driver",
    color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/50 dark:text-amber-300",
    desc: "Orange dispatch is assigning the nearest EV chauffeur.",
  },
  accepted: {
    label: "Driver En Route",
    color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-950/50 dark:text-blue-300",
    desc: "Your chauffeur is on the way to the pickup point.",
  },
  arrived: {
    label: "Driver Arrived",
    color: "bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-950/50 dark:text-purple-300",
    desc: "Vehicle has reached the pickup location.",
  },
  in_progress: {
    label: "Ride in Progress",
    color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300",
    desc: "Traveling safely towards the destination.",
  },
  completed: {
    label: "Ride Completed",
    color: "bg-muted text-foreground border-border",
    desc: "This ride has been completed successfully.",
  },
  cancelled: {
    label: "Ride Cancelled",
    color: "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300",
    desc: "This ride was cancelled.",
  },
};

function TrackPage() {
  const { ref: initialRef } = Route.useSearch();
  const [searchRef, setSearchRef] = useState(initialRef || "");
  const [activeRef, setActiveRef] = useState(initialRef || "");
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState<any | null>(null);
  const [driver, setDriver] = useState<any | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (initialRef) {
      setSearchRef(initialRef);
      setActiveRef(initialRef);
    }
  }, [initialRef]);

  // Fetch booking and driver
  useEffect(() => {
    if (!activeRef.trim()) return;

    let bookingChannel: any = null;
    let driverChannel: any = null;

    async function loadTrackingData() {
      setLoading(true);
      setNotFound(false);

      const cleanRef = activeRef.trim().toUpperCase().replace(/^#/, "");

      try {
        const { data: bData, error } = await supabase
          .from("bookings")
          .select("*")
          .ilike("reference", cleanRef)
          .maybeSingle();

        if (error || !bData) {
          setBooking(null);
          setDriver(null);
          setNotFound(true);
          setLoading(false);
          return;
        }

        setBooking(bData);

        // Fetch driver details if assigned
        if (bData.driver_id) {
          const { data: dData } = await supabase
            .from("drivers")
            .select("*")
            .eq("id", bData.driver_id)
            .maybeSingle();
          if (dData) {
            let appData: any = null;
            try {
              const { data: app } = await supabase
                .from("driver_applications")
                .select("*")
                .or(`full_name.eq.${dData.full_name}${dData.phone ? `,phone.eq.${dData.phone}` : ""}`)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              appData = app;
            } catch (e) {}

            let parsedNotes: any = {};
            try {
              if (appData?.admin_notes && typeof appData.admin_notes === "string" && appData.admin_notes.trim().startsWith("{")) {
                parsedNotes = JSON.parse(appData.admin_notes);
              }
            } catch (e) {}

            let metaEncoded: any = {};
            if (dData.vehicle_code && typeof dData.vehicle_code === "string" && dData.vehicle_code.startsWith("ORANGE_META:")) {
              try {
                metaEncoded = JSON.parse(dData.vehicle_code.replace("ORANGE_META:", ""));
              } catch (e) {}
            }

            let photoUrl = dData.photo_url || metaEncoded.photo || parsedNotes.photo_url || appData?.photo_url || "";
            if (!photoUrl) {
              photoUrl = localStorage.getItem(`orange_driver_photo_${dData.id}`) ||
                (dData.user_id ? localStorage.getItem(`orange_driver_photo_${dData.user_id}`) : null) ||
                (dData.phone ? localStorage.getItem(`orange_driver_photo_by_phone_${dData.phone.replace(/\D/g, "")}`) : null) ||
                (dData.full_name ? localStorage.getItem(`orange_driver_photo_by_name_${dData.full_name.trim().toLowerCase()}`) : null) || "";
            }

            const rawDriver = {
              ...dData,
              photo_url: photoUrl,
              vehicle_number: (dData.vehicle_number && dData.vehicle_number !== "Unassigned" ? dData.vehicle_number : "") || metaEncoded.plate || appData?.vehicle_number || parsedNotes.vehicle_number || "",
              vehicle_model: dData.vehicle_model || metaEncoded.model || appData?.vehicle_model || parsedNotes.vehicle_model || "",
            };

            const resolved = resolveDriverDetails(rawDriver, bData);
            setDriver(resolved);
          }

          // Subscribe to live driver updates (GPS coordinates)
          driverChannel = supabase
            .channel(`public-driver-${bData.driver_id}`)
            .on(
              "postgres_changes",
              {
                event: "UPDATE",
                schema: "public",
                table: "drivers",
                filter: `id=eq.${bData.driver_id}`,
              },
              (payload) => {
                setDriver((prev: any) => {
                  const updated = prev ? { ...prev, ...payload.new } : (payload.new as any);
                  return resolveDriverDetails(updated, bData);
                });
              }
            )
            .subscribe();
        }

        // Subscribe to live booking updates
        bookingChannel = supabase
          .channel(`public-booking-${bData.id}`)
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "bookings",
              filter: `id=eq.${bData.id}`,
            },
            async (payload) => {
              const updated = payload.new;
              setBooking((prev: any) => ({ ...prev, ...updated }));
              if (updated.driver_id && (!driver || driver.id !== updated.driver_id)) {
                const { data: d } = await supabase
                  .from("drivers")
                  .select("*")
                  .eq("id", updated.driver_id)
                  .maybeSingle();
                if (d) {
                  const resolved = resolveDriverDetails(d, updated);
                  setDriver(resolved);
                }
              }
            }
          )
          .subscribe();
      } catch (err) {
        console.error("Tracking load error:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    }

    loadTrackingData();

    return () => {
      if (bookingChannel) supabase.removeChannel(bookingChannel);
      if (driverChannel) supabase.removeChannel(driverChannel);
    };
  }, [activeRef]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchRef.trim()) {
      setActiveRef(searchRef.trim());
    }
  };

  const handleShare = () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (navigator.share) {
      navigator
        .share({
          title: `Orange Taxi Live Tracking - #${booking?.reference || ""}`,
          text: `Follow this Orange Electric Taxi live ride on the map:`,
          url,
        })
        .catch(() => {});
    } else {
      navigator.clipboard?.writeText(url);
      toast.success("Live tracking link copied to clipboard!");
    }
  };

  // Coordinates parsing
  const parseCoords = (addrStr?: string, defaultLat = 28.5562, defaultLng = 77.0856) => {
    if (!addrStr) return { lat: defaultLat, lng: defaultLng };
    const parts = addrStr.split(",").map((s) => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return { lat: parts[0], lng: parts[1] };
    }
    return { lat: defaultLat, lng: defaultLng };
  };

  const pickupCoords = parseCoords(booking?.pickup_address, 12.9716, 77.5946);
  const dropCoords = parseCoords(booking?.drop_address, 13.1986, 77.7066);

  const statusInfo = STATUS_LABELS[booking?.status || "searching"] || STATUS_LABELS.searching;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Brand Bar */}
      <header className="border-b border-border bg-card/60 backdrop-blur sticky top-0 z-30">
        <div className="section-shell py-3 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <span className="display-serif text-xl font-bold tracking-tight text-primary">
              Orange<span className="text-foreground">Taxi</span>
            </span>
            <span className="hidden sm:inline-block rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] font-bold text-primary">
              Live Trip Radar
            </span>
          </Link>

          <div className="flex items-center gap-2">
            <a
              href="tel:+911140007000"
              className="flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
              title="24x7 Safety Helpline"
            >
              <LifeBuoy className="size-3.5 text-primary" />
              <span className="hidden sm:inline">24x7 Helpline:</span>
              <span className="font-mono text-foreground">011 4000 7000</span>
            </a>
          </div>
        </div>
      </header>

      <main className="flex-1 section-shell py-6 max-w-4xl w-full">
        {/* Search Bar / Ref Switcher */}
        <form onSubmit={handleSearch} className="mb-6 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input
              value={searchRef}
              onChange={(e) => setSearchRef(e.target.value)}
              placeholder="Enter Booking Reference (e.g. #OT1234ABCD)..."
              className="pl-10 h-11 text-sm bg-muted/30 border-border"
            />
          </div>
          <Button type="submit" className="h-11 px-5 font-bold shrink-0">
            Track Ride
          </Button>
        </form>

        {loading ? (
          <div className="py-24 text-center space-y-3">
            <div className="inline-block size-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
            <p className="text-sm font-semibold text-muted-foreground">Connecting to vehicle telemetry...</p>
          </div>
        ) : notFound || !booking ? (
          <div className="rounded-2xl border border-dashed border-border bg-card/40 p-10 text-center space-y-4">
            <div className="mx-auto size-14 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
              <Car className="size-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Track Any Orange Electric Ride</h2>
              <p className="text-sm text-muted-foreground mt-1 max-w-md mx-auto">
                Enter your booking reference above to view live vehicle location, chauffeur details, and route progress.
              </p>
            </div>
            {notFound && (
              <p className="text-xs font-semibold text-rose-500">
                No active booking found with reference "{activeRef}". Please check the 8-character reference code.
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {/* Status Header Banner */}
            <div className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                  <div className="flex size-11 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20 text-primary font-bold shrink-0">
                    <Car className="size-6" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold text-primary">#{booking.reference}</span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusInfo.color}`}
                      >
                        <span className="inline-block size-1.5 rounded-full bg-current mr-1.5 animate-pulse" />
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{statusInfo.desc}</p>
                  </div>
                </div>

                {/* Share Button */}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleShare}
                  className="shrink-0 gap-1.5 font-bold text-xs h-9 border-primary/30 text-primary hover:bg-primary/10"
                >
                  <Share2 className="size-3.5" />
                  <span>Share Live Trip</span>
                </Button>
              </div>

              {/* Pickup & Destination */}
              <div className="grid sm:grid-cols-2 gap-3 text-xs">
                <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 p-3 border border-border/60">
                  <MapPin className="size-4 text-emerald-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                      Pickup Location
                    </span>
                    <p className="font-bold text-foreground text-sm mt-0.5">{booking.pickup_area}</p>
                  </div>
                </div>
                <div className="flex items-start gap-2.5 rounded-xl bg-muted/40 p-3 border border-border/60">
                  <Navigation className="size-4 text-primary shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-muted-foreground uppercase tracking-wider text-[10px]">
                      Drop-off Destination
                    </span>
                    <p className="font-bold text-foreground text-sm mt-0.5">{booking.drop_area}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Live Interactive Map */}
            <div className="rounded-2xl border border-border overflow-hidden shadow-lg bg-card">
              <LiveRideMap
                pickup={{ name: booking.pickup_area, lat: pickupCoords.lat, lng: pickupCoords.lng }}
                drop={{ name: booking.drop_area, lat: dropCoords.lat, lng: dropCoords.lng }}
                driver={
                  driver
                    ? {
                        full_name: driver.full_name,
                        vehicle_model: driver.vehicle_model || booking.vehicle_name,
                        vehicle_number: driver.vehicle_number,
                        current_lat: driver.current_lat,
                        current_lng: driver.current_lng,
                      }
                    : null
                }
                status={booking.status}
                distKm={booking.distance_km || 10}
              />
            </div>

            {/* Driver & Vehicle Details */}
            {driver && (
              <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="relative size-12 shrink-0">
                      {driver.photo_url ? (
                        <img
                          src={driver.photo_url}
                          alt={driver.full_name}
                          className="size-12 rounded-2xl object-cover border-2 border-primary shadow-md"
                        />
                      ) : (
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-bold text-lg shadow-md">
                          {driver.full_name?.charAt(0) || "D"}
                        </div>
                      )}
                      <span className="absolute -bottom-1 -right-1 size-3.5 rounded-full bg-emerald-500 border-2 border-card" title="Active Chauffeur" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          Assigned EV Chauffeur
                        </span>
                        <span className="text-xs font-bold text-amber-500">★ {driver.rating || "4.9"}</span>
                      </div>
                      <h3 className="font-bold text-base text-foreground mt-0.5">{driver.full_name}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span className="font-medium text-foreground">{driver.vehicle_model || booking.vehicle_name}</span>
                        <span>•</span>
                        <span className="font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded text-[11px]">
                          {getBookingVehiclePlate(booking, driver)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Driver Contact Phone (if available) */}
                  {driver.phone && (
                    <div className="flex items-center gap-2">
                      <a
                        href={`tel:${driver.phone.replace(/\D/g, "")}`}
                        className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground shadow-md transition-all hover:bg-primary/90 active:scale-95"
                      >
                        <PhoneCall className="size-4" />
                        <span>Call Driver</span>
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Emergency & 24/7 Safety Desk */}
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-rose-500/20 text-rose-500 shrink-0">
                  <ShieldAlert className="size-5" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Safety Assistance & SOS</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Ride monitored by Orange Command Center. In an emergency, dial 112 or contact our helpline.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a
                  href="tel:112"
                  className="rounded-xl bg-rose-600 px-3.5 py-2 text-xs font-bold text-white shadow-md hover:bg-rose-700 transition-colors"
                >
                  Dial 112 (Police)
                </a>
                <a
                  href="tel:+911140007000"
                  className="rounded-xl border border-border bg-background px-3.5 py-2 text-xs font-semibold text-foreground hover:bg-muted transition-colors"
                >
                  Helpline
                </a>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
