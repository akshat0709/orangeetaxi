import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, BatteryCharging, Check, CheckCircle, Clock, Loader2, MapPin, Navigation, Power, Star, TrendingUp, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

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
}
interface DriverProfile {
  id: string; user_id: string; full_name: string; is_online: boolean;
  rating: number; total_rides: number; city: string;
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

function DriverConsolePage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [driver, setDriver] = useState<DriverProfile | null>(null);
  const [activeRides, setActiveRides] = useState<Booking[]>([]);
  const [newRequests, setNewRequests] = useState<Booking[]>([]);
  const [recentRides, setRecentRides] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);

  // Redirect if not driver
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

    // Realtime subscription for new ride requests
    const channel = supabase.channel("driver-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, () => loadData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  async function loadData() {
    if (!user) return;
    // Get driver profile
    const { data: driverData } = await supabase.from("drivers").select("*").eq("user_id", user.id).single();
    if (!driverData) { setLoading(false); return; }
    setDriver(driverData as DriverProfile);

    // Active rides assigned to this driver
    const { data: active } = await supabase.from("bookings").select("*")
      .eq("driver_id", driverData.id)
      .in("status", ["accepted", "arrived", "in_progress"])
      .order("created_at", { ascending: false });
    setActiveRides((active as Booking[]) ?? []);

    // Open requests (searching) in driver's city — pick up to 5
    const { data: requests } = await supabase.from("bookings").select("*")
      .eq("status", "searching").is("driver_id", null)
      .order("created_at", { ascending: false }).limit(5);
    setNewRequests((requests as Booking[]) ?? []);

    // Recent completed rides
    const { data: recent } = await supabase.from("bookings").select("*")
      .eq("driver_id", driverData.id).eq("status", "completed")
      .order("completed_at", { ascending: false }).limit(20);
    setRecentRides((recent as Booking[]) ?? []);

    setLoading(false);
  }

  async function toggleOnline() {
    if (!driver) return;
    setToggling(true);
    await supabase.from("drivers").update({ is_online: !driver.is_online }).eq("id", driver.id);
    setDriver(prev => prev ? { ...prev, is_online: !prev.is_online } : prev);
    toast.success(driver.is_online ? "You're now offline" : "You're now online — ready for rides!");
    setToggling(false);
  }

  async function acceptRide(bookingId: string) {
    if (!driver) return;
    const { error } = await supabase.from("bookings").update({ driver_id: driver.id, status: "accepted", accepted_at: new Date().toISOString() }).eq("id", bookingId);
    if (error) { toast.error("Could not accept ride"); return; }
    toast.success("Ride accepted!");
    loadData();
  }

  async function declineRide(bookingId: string) {
    // Just remove from new requests display (no DB change needed — driver simply doesn't accept)
    setNewRequests(prev => prev.filter(r => r.id !== bookingId));
    toast.info("Ride skipped");
  }

  async function advanceStatus(booking: Booking) {
    const flow = STATUS_FLOW[booking.status];
    if (!flow) return;
    const updates: Record<string, string | number | null> = { status: flow.next };
    if (flow.next === "arrived") updates.arrived_at = new Date().toISOString();
    if (flow.next === "in_progress") updates.started_at = new Date().toISOString();
    if (flow.next === "completed") {
      updates.completed_at = new Date().toISOString();
      updates.final_fare = booking.estimated_fare;
      updates.payment_status = "paid";
    }
    const { error } = await supabase.from("bookings").update(updates).eq("id", booking.id);
    if (error) { toast.error("Update failed"); return; }
    toast.success(`Status updated to ${flow.next.replace("_", " ")}`);
    loadData();
  }

  // Earnings
  const weeklyEarnings = recentRides.filter(r => {
    const d = new Date(r.completed_at ?? "");
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return d >= weekAgo;
  }).reduce((sum, r) => sum + (r.final_fare ?? r.estimated_fare), 0);

  const monthlyEarnings = recentRides.reduce((sum, r) => sum + (r.final_fare ?? r.estimated_fare), 0);
  const avgRating = recentRides.filter(r => r.rating).reduce((sum, r, _, arr) => sum + (r.rating ?? 0) / arr.length, 0);

  if (authLoading || loading) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  if (!driver) {
    return (
      <section className="min-h-screen py-24">
        <div className="section-shell text-center">
          <h1 className="display-serif text-5xl">Driver profile not found</h1>
          <p className="mt-4 text-muted-foreground">Your account hasn't been set up as a driver yet. Please wait for admin approval after applying.</p>
          <Button asChild className="mt-8"><Link to="/drive">Apply to Drive <ArrowRight /></Link></Button>
        </div>
      </section>
    );
  }

  return (
    <section className="min-h-screen bg-warm py-10">
      <div className="section-shell">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Driver Console</p>
            <h1 className="display-serif mt-2 text-4xl">Welcome, {driver.full_name.split(" ")[0]}.</h1>
            <p className="mt-1 text-sm text-muted-foreground">{driver.city}</p>
          </div>
          <button onClick={toggleOnline} disabled={toggling}
            className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition-colors ${driver.is_online ? "border-green-300 bg-green-50 text-green-700 hover:bg-green-100" : "border-border bg-background text-muted-foreground hover:bg-accent"}`}>
            {toggling ? <Loader2 className="size-4 animate-spin" /> : <Power className="size-4" />}
            {driver.is_online ? "Online" : "Go Online"}
          </button>
        </div>

        {/* KPIs */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard icon={Wallet} label="This week" value={`₹${Math.round(weeklyEarnings)}`} />
          <KpiCard icon={TrendingUp} label="This month" value={`₹${Math.round(monthlyEarnings)}`} />
          <KpiCard icon={CheckCircle} label="Total rides" value={driver.total_rides.toString()} />
          <KpiCard icon={Star} label="Rating" value={avgRating > 0 ? avgRating.toFixed(1) : driver.rating.toFixed(1)} />
        </div>

        {/* Tabs */}
        <Tabs defaultValue="rides" className="mt-10">
          <TabsList className="mb-6">
            <TabsTrigger value="rides">Active Rides {activeRides.length > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-bold text-primary-foreground">{activeRides.length}</span>}</TabsTrigger>
            <TabsTrigger value="requests">New Requests {newRequests.length > 0 && <span className="ml-1.5 rounded-full bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">{newRequests.length}</span>}</TabsTrigger>
            <TabsTrigger value="earnings">Earnings</TabsTrigger>
          </TabsList>

          {/* ACTIVE RIDES */}
          <TabsContent value="rides">
            {activeRides.length === 0 ? (
              <EmptyState icon={Navigation} title="No active rides" text="Accept a ride request to get started. Make sure you're online!" />
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
                          <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1"><BatteryCharging className="size-3 text-primary" />{ride.vehicle_name}</span>
                            <span className="flex items-center gap-1"><Wallet className="size-3 text-primary" />₹{Math.round(ride.estimated_fare)} · {ride.payment_method}</span>
                            <span>{Math.round(ride.distance_km)} km</span>
                          </div>
                        </div>
                        {flow && (
                          <Button size="sm" onClick={() => advanceStatus(ride)} className="shrink-0">
                            {flow.nextLabel} <Check className="size-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </TabsContent>

          {/* NEW REQUESTS */}
          <TabsContent value="requests">
            {!driver.is_online && (
              <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
                You're offline. Go online to receive ride requests.
              </div>
            )}
            {newRequests.length === 0 ? (
              <EmptyState icon={Clock} title="No new requests" text="New ride requests in your area will appear here." />
            ) : (
              <div className="space-y-4">
                {newRequests.map(ride => (
                  <div key={ride.id} className="rounded-xl border border-border bg-background p-6">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 text-sm font-bold">
                          <MapPin className="size-4 text-primary" />{ride.pickup_area}
                          <span className="text-muted-foreground">→</span>
                          <Navigation className="size-4 text-primary" />{ride.drop_area}
                        </div>
                        <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                          <span className="font-bold text-primary">₹{Math.round(ride.estimated_fare)}</span>
                          <span>{Math.round(ride.distance_km)} km</span>
                          <span>{ride.vehicle_name}</span>
                          <span>{ride.payment_method}</span>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">{new Date(ride.created_at).toLocaleTimeString()}</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10" onClick={() => declineRide(ride.id)}><X className="size-4" /></Button>
                        <Button size="sm" onClick={() => acceptRide(ride.id)}>Accept <Check className="size-3" /></Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          {/* EARNINGS */}
          <TabsContent value="earnings">
            <div className="grid gap-4 lg:grid-cols-3 mb-8">
              <EarningsCard label="This week" amount={weeklyEarnings} rides={recentRides.filter(r => { const d = new Date(r.completed_at ?? ""); const now = new Date(); return d >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000); }).length} />
              <EarningsCard label="This month" amount={monthlyEarnings} rides={recentRides.length} />
              <div className="rounded-xl border border-border bg-background p-6">
                <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Average Rating</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-3xl font-bold">{avgRating > 0 ? avgRating.toFixed(1) : driver.rating.toFixed(1)}</span>
                  <span className="mb-1 text-sm text-muted-foreground">/ 5</span>
                </div>
                <div className="mt-2 flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className={`size-4 ${i < Math.round(avgRating || driver.rating) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                  ))}
                </div>
              </div>
            </div>

            {/* Recent rides table */}
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              <div className="border-b border-border px-6 py-4">
                <h3 className="font-semibold">Recent Rides</h3>
              </div>
              {recentRides.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No completed rides yet.</p>
              ) : (
                <div className="divide-y divide-border">
                  {recentRides.map(ride => (
                    <div key={ride.id} className="flex items-center justify-between gap-4 px-6 py-4 text-sm">
                      <div>
                        <p className="font-semibold">{ride.pickup_area} → {ride.drop_area}</p>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {ride.completed_at ? new Date(ride.completed_at).toLocaleDateString() : "—"} · {Math.round(ride.distance_km)} km
                        </p>
                      </div>
                      <div className="flex items-center gap-4 shrink-0">
                        {ride.rating && (
                          <div className="flex items-center gap-1 text-xs">
                            <Star className="size-3 fill-primary text-primary" />{ride.rating}
                          </div>
                        )}
                        <span className="font-bold text-primary">₹{Math.round(ride.final_fare ?? ride.estimated_fare)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
}

function KpiCard({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <Icon className="size-5 text-primary" />
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function EarningsCard({ label, amount, rides }: { label: string; amount: number; rides: number }) {
  return (
    <div className="rounded-xl border border-border bg-background p-6">
      <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-3 text-3xl font-bold">₹{Math.round(amount)}</p>
      <p className="mt-1 text-sm text-muted-foreground">{rides} ride{rides !== 1 ? "s" : ""}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, title, text }: { icon: React.ElementType; title: string; text: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-16 text-center">
      <Icon className="size-10 text-muted-foreground/40" />
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
