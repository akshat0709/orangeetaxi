// @ts-nocheck

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Banknote, BriefcaseBusiness, Car, Check, CheckCircle, ChevronDown, ChevronUp, FileSpreadsheet, Loader2, MoreHorizontal, ParkingSquare, Phone, Search, Users, Wallet, X, Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { FleetManager, DEFAULT_SAMPLE_FLEET } from "@/components/fleet-manager";
import { CashSettlementManager } from "@/components/cash-settlement-manager";
import { GSTAccountingManager } from "@/components/gst-accounting-manager";
import { TabErrorBoundary } from "@/components/tab-error-boundary";
import { getBookingVehiclePlate, lockBookingVehicle, saveRideVehiclePlate } from "@/lib/ride-vehicle";

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : "bookings",
  }),
  head: () => ({ meta: [{ title: "Admin — Orange Taxi" }] }),
  component: AdminPage,
});

interface Booking { id: string; reference: string; status: string; pickup_area: string; drop_area: string; estimated_fare: number; vehicle_name: string; payment_method: string; created_at: string; driver_id: string | null; customer_id: string; ride_otp: string; }
interface Application { id: string; full_name: string; email: string; phone: string; city: string; licence_number: string; experience_years: number; owns_vehicle: boolean; message: string; status: string; admin_notes: string; created_at: string; }
interface Enquiry { id: string; company_name: string; contact_name: string; email: string; phone: string; city: string; team_size: string; requirement: string; message: string; status: string; created_at: string; }
interface Driver { id: string; full_name: string; phone: string; city: string; is_online: boolean; rating: number; total_rides: number; status: string; vehicle_model: string; vehicle_number: string; }

const STATUS_BADGE: Record<string, string> = {
  accepted: "bg-blue-100 text-blue-700",
  arrived: "bg-violet-100 text-violet-700",
  in_progress: "bg-orange-100 text-orange-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-700",
  new: "bg-slate-100 text-slate-700",
  reviewed: "bg-blue-100 text-blue-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  contacted: "bg-purple-100 text-purple-700",
};

function AdminPage() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const search = Route.useSearch();
  const [activeTab, setActiveTab] = useState(() => search?.tab || "bookings");

  useEffect(() => {
    if (search?.tab && search.tab !== activeTab) {
      setActiveTab(search.tab);
    }
  }, [search?.tab]);


  useEffect(() => {
    if (!authLoading) {
      if (!user) { navigate({ to: "/login", search: { redirect: "/admin" } }); return; }
      if (role !== "admin") { toast.error("Admin access required."); navigate({ to: "/" }); }
    }
  }, [user, role, authLoading, navigate]);

  useEffect(() => {
    if (role === "admin") loadAll();
  }, [role]);

  async function loadAll() {
    setLoading(true);
    const [{ data: b }, { data: a }, { data: e }, { data: d }] = await Promise.all([
      supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("driver_applications").select("*").order("created_at", { ascending: false }),
      supabase.from("corporate_enquiries").select("*").order("created_at", { ascending: false }),
      supabase.from("drivers").select("*").order("created_at", { ascending: false }),
    ]);
    const fetchedBookings = (b as Booking[]) ?? [];
    const fetchedDrivers = (d as Driver[]) ?? [];

    // Automatically snapshot and freeze vehicle registration numbers for existing completed rides
    fetchedBookings.forEach((booking) => {
      if (booking.driver_id && ["completed", "in_progress"].includes(booking.status)) {
        const dr = fetchedDrivers.find((x) => x.id === booking.driver_id);
        if (dr?.vehicle_number && dr.vehicle_number !== "Unassigned") {
          saveRideVehiclePlate(booking.id, dr.vehicle_number, booking.reference);
        }
      }
    });

    setBookings(fetchedBookings);
    setApplications((a as Application[]) ?? []);
    setEnquiries((e as Enquiry[]) ?? []);
    setDrivers(fetchedDrivers);
    setLoading(false);
  }

  // Stats
  const stats = {
    totalBookings: bookings.length,
    activeBookings: bookings.filter(b => ["searching", "accepted", "arrived", "in_progress"].includes(b.status)).length,
    completedBookings: bookings.filter(b => b.status === "completed").length,
    totalRevenue: bookings.filter(b => b.status === "completed").reduce((s, b) => s + Math.round(Number(b.final_fare ?? b.estimated_fare ?? 0)), 0),
    onlineDrivers: drivers.filter(d => d.is_online).length,
    pendingApplications: applications.filter(a => a.status === "new").length,
    newEnquiries: enquiries.filter(e => e.status === "new").length,
  };

  async function updateApplicationStatus(id: string, status: string, email?: string) {
    const { error } = await supabase.from("driver_applications").update({ status }).eq("id", id);
    if (error) {
      console.error("Update error:", error);
      toast.error(`Error updating: ${error.message || "Unknown error"}`);
      return;
    }

    if (status === "approved" && email) {
      // Grant driver role via RPC
      const { data: result } = await supabase.rpc("admin_set_role" as any, { _email: email, _role: "driver", _grant: true });
      if (result !== "ok") toast.error(`Could not grant driver role: ${result}`);
      else toast.success("Driver role granted! Have them log in and go online.");
    }
    toast.success(`Application ${status}`);
    loadAll();
  }

  async function updateEnquiryStatus(id: string, status: string) {
    await supabase.from("corporate_enquiries").update({ status }).eq("id", id);
    toast.success("Enquiry updated");
    loadAll();
  }

  async function assignDriver(bookingId: string, driverId: string) {
    const driver = drivers.find((d) => d.id === driverId);
    const booking = bookings.find((b) => b.id === bookingId);
    const plate = driver?.vehicle_number && driver.vehicle_number !== "Unassigned" ? driver.vehicle_number : null;

    const { error } = await supabase
      .from("bookings")
      .update({
        driver_id: driverId,
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (error) {
      toast.error("Assignment failed");
      return;
    }

    if (plate) {
      await lockBookingVehicle(supabase, bookingId, plate, booking?.vehicle_name, booking?.reference);
    }

    toast.success("Driver assigned!");
    loadAll();
  }

  if (authLoading || (loading && role === "admin")) {
    return <div className="flex min-h-screen items-center justify-center"><Loader2 className="size-8 animate-spin text-primary" /></div>;
  }

  return (
    <section className="min-h-screen bg-warm py-10">
      <div className="section-shell">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Admin Dashboard</p>
        <h1 className="display-serif mt-2 text-4xl">Orange Operations</h1>

        {/* KPIs */}
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-5">
          <KpiCard label="Total Bookings" value={stats.totalBookings} sub={`${stats.activeBookings} active`} icon={Car} />
          <KpiCard label="Revenue" value={`₹${Math.round(stats.totalRevenue)}`} sub={`${stats.completedBookings} completed`} icon={BadgeCheck} />
          <KpiCard label="Drivers Online" value={stats.onlineDrivers} sub={`of ${drivers.length} total`} icon={Users} />
          <KpiCard label="Orange Fleet" value="Mahindra BE.6" sub="Bay & battery tracking" icon={ParkingSquare} />
          <KpiCard label="Pending" value={stats.pendingApplications + stats.newEnquiries} sub={`${stats.pendingApplications} apps · ${stats.newEnquiries} enquiries`} icon={MoreHorizontal} />
        </div>

        {/* Main tabs */}
        <Tabs
          value={activeTab}
          onValueChange={val => {
            setActiveTab(val);
            navigate({
              to: "/admin",
              search: { tab: val },
              replace: true,
            });
          }}
          className="mt-10"
        >
          <TabsList className="mb-6 flex flex-wrap gap-1">
            <TabsTrigger value="bookings">Bookings <CountBadge n={stats.activeBookings} /></TabsTrigger>
            <TabsTrigger value="fleet" className="gap-1.5 font-semibold">
              <ParkingSquare className="size-3.5 text-primary" /> Fleet & Bays
            </TabsTrigger>
            <TabsTrigger value="cash" className="gap-1.5 font-semibold">
              <Banknote className="size-3.5 text-emerald-600" /> Cash Settlements
            </TabsTrigger>
            <TabsTrigger value="gst" className="gap-1.5 font-semibold">
              <FileSpreadsheet className="size-3.5 text-blue-600" /> GST & Invoicing
            </TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="applications">Applications <CountBadge n={stats.pendingApplications} color="amber" /></TabsTrigger>
            <TabsTrigger value="enquiries">Enquiries <CountBadge n={stats.newEnquiries} color="blue" /></TabsTrigger>
          </TabsList>



          {/* BOOKINGS */}
          <TabsContent value="bookings">
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              <div className="border-b border-border px-6 py-4 flex items-center justify-between">
                <h3 className="font-semibold">All Bookings</h3>
                <Button size="sm" variant="ghost" onClick={loadAll}>Refresh</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {["Ref", "Route", "Vehicle", "Fare", "Status", "Driver", "OTP", "Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bookings.map(b => (
                      <tr key={b.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs font-bold">{b.reference}</td>
                        <td className="px-4 py-3 text-xs">{b.pickup_area} → {b.drop_area}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{b.vehicle_name}</td>
                        <td className="px-4 py-3 font-semibold text-primary">₹{Math.round(b.estimated_fare)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[b.status] ?? "bg-muted text-muted-foreground"}`}>{b.status.replace("_", " ")}</span>
                        </td>
                        <td className="px-4 py-3">
                          {b.status === "searching" ? (
                            <Select onValueChange={v => assignDriver(b.id, v)}>
                              <SelectTrigger className="h-7 w-48 text-xs"><SelectValue placeholder="Assign driver" /></SelectTrigger>
                              <SelectContent>
                                {drivers.map(d => (
                                  <SelectItem key={d.id} value={d.id}>
                                    {d.full_name} · {d.vehicle_number && d.vehicle_number !== "Unassigned" ? d.vehicle_number : "No plate"} {d.is_online ? '(Online)' : '(Offline)'}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {b.driver_id ? (() => {
                                const d = drivers.find(dr => dr.id === b.driver_id);
                                const ridePlate = getBookingVehiclePlate(b, d);
                                return d ? (
                                  <span className="flex flex-col">
                                    <span className="font-semibold text-foreground">{d.full_name}</span>
                                    <span className="font-mono text-[11px] font-bold text-primary">{ridePlate}</span>
                                  </span>
                                ) : (
                                  <span className="flex flex-col">
                                    <span className="font-semibold text-foreground">Assigned</span>
                                    <span className="font-mono text-[11px] font-bold text-primary">{ridePlate}</span>
                                  </span>
                                );
                              })() : "—"}
                            </span>
                          )}
                        </td>

                        <td className="px-4 py-3">
                          <span className="font-mono text-sm font-bold text-primary">{b.ride_otp || "—"}</span>
                        </td>
                        <td className="px-4 py-3">
                          {["searching", "accepted", "arrived", "in_progress"].includes(b.status) && (
                            <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:bg-destructive/10"
                              onClick={async () => { await supabase.from("bookings").update({ status: "cancelled", cancelled_at: new Date().toISOString() }).eq("id", b.id); toast.success("Booking cancelled"); loadAll(); }}>
                              Cancel
                            </Button>
                          )}
                        </td>

                      </tr>
                    ))}
                  </tbody>
                </table>
                {bookings.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No bookings yet.</p>}
              </div>
            </div>
          </TabsContent>

          {/* DRIVER APPLICATIONS */}
          <TabsContent value="applications">
            <div className="space-y-4">
              {applications.length === 0 && <EmptyState title="No applications yet" text="Driver applications from /drive will appear here." />}
              {applications.map(app => (
                <div key={app.id} className="rounded-xl border border-border bg-background p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-bold">{app.full_name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[app.status] ?? "bg-muted text-muted-foreground"}`}>{app.status}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground lg:grid-cols-4">
                        <span>📧 {app.email}</span>
                        <span>📞 {app.phone}</span>
                        <span>📍 {app.city}</span>
                        <span>🪪 {app.licence_number}</span>
                        <span>🚗 {app.experience_years} yrs experience</span>
                        <span>{app.owns_vehicle ? "✅ Owns EV" : "❌ No vehicle"}</span>
                        <span>📅 {new Date(app.created_at).toLocaleDateString()}</span>
                      </div>
                      {app.message && <p className="mt-3 rounded-lg bg-muted p-3 text-xs leading-5">{app.message}</p>}
                    </div>
                    {app.status === "new" && (
                      <div className="flex shrink-0 gap-2">
                        <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
                          onClick={() => updateApplicationStatus(app.id, "rejected")}>
                          <X className="size-4" /> Reject
                        </Button>
                        <Button size="sm" onClick={() => updateApplicationStatus(app.id, "approved", app.email)}>
                          <CheckCircle className="size-4" /> Approve
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* ENQUIRIES */}
          <TabsContent value="enquiries">
            <div className="space-y-4">
              {enquiries.length === 0 && <EmptyState title="No enquiries yet" text="Corporate enquiries from /talk-to-orange will appear here." />}
              {enquiries.map(eq => (
                <div key={eq.id} className="rounded-xl border border-border bg-background p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <h3 className="font-bold">{eq.company_name}</h3>
                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[eq.status] ?? "bg-muted text-muted-foreground"}`}>{eq.status}</span>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground lg:grid-cols-3">
                        <span>👤 {eq.contact_name}</span>
                        <span>📧 {eq.email}</span>
                        <span>📞 {eq.phone}</span>
                        <span>📍 {eq.city}</span>
                        <span>👥 Team: {eq.team_size}</span>
                        <span>📅 {new Date(eq.created_at).toLocaleDateString()}</span>
                      </div>
                      {eq.requirement && <p className="mt-2 text-xs text-muted-foreground">Need: {eq.requirement}</p>}
                      {eq.message && <p className="mt-2 rounded-lg bg-muted p-3 text-xs leading-5">{eq.message}</p>}
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {eq.status === "new" && (
                        <Button size="sm" onClick={() => updateEnquiryStatus(eq.id, "contacted")}>
                          Mark Contacted
                        </Button>
                      )}
                      {eq.status === "contacted" && (
                        <Button size="sm" variant="ghost" onClick={() => updateEnquiryStatus(eq.id, "closed")}>
                          Close
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>

          {/* DRIVERS */}
          <TabsContent value="drivers">
            <DriverAnalyticsPanel drivers={drivers} bookings={bookings} onRefresh={loadAll} />
          </TabsContent>

          {/* FLEET & BAYS */}
          <TabsContent value="fleet">
            <FleetManager drivers={drivers} onRefresh={loadAll} />
          </TabsContent>

          {/* CASH SETTLEMENTS */}
          <TabsContent value="cash">
            <CashSettlementManager drivers={drivers} bookings={bookings} onRefresh={loadAll} />
          </TabsContent>

          {/* GST & INVOICING */}
          <TabsContent value="gst">
            <TabErrorBoundary tabName="GST & Invoicing" onRetry={loadAll}>
              <GSTAccountingManager bookings={bookings} onRefresh={loadAll} />
            </TabErrorBoundary>
          </TabsContent>



        </Tabs>
      </div>
    </section>
  );
}

function DriverAnalyticsPanel({ drivers, bookings, onRefresh }: { drivers: Driver[]; bookings: any[]; onRefresh: () => void }) {
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [fleetVehicles, setFleetVehicles] = useState<any[]>([]);
  const [customEntryDriverId, setCustomEntryDriverId] = useState<string | null>(null);

  async function loadFleet() {
    try {
      const { data } = await supabase.from("fleet_vehicles").select("*").order("plate_number");
      if (data && data.length > 0) {
        setFleetVehicles(data);
      } else {
        const stored = localStorage.getItem("orange_fleet_vehicles");
        if (stored) {
          setFleetVehicles(JSON.parse(stored));
        } else {
          setFleetVehicles(DEFAULT_SAMPLE_FLEET);
        }
      }
    } catch (e) {
      setFleetVehicles(DEFAULT_SAMPLE_FLEET);
    }
  }

  useEffect(() => {
    loadFleet();
    const ch = supabase.channel("admin-fleet-drivers-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "fleet_vehicles" }, () => loadFleet())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, []);

  async function updateFleetVehicleInDbOrLocal(v: any) {
    try {
      await supabase.from("fleet_vehicles").update({
        status: v.status,
        assigned_driver_id: v.assigned_driver_id,
        assigned_at: v.assigned_at,
        bay_number: v.bay_number,
        updated_at: new Date().toISOString()
      }).eq("id", v.id);
    } catch (e) {}

    const stored = localStorage.getItem("orange_fleet_vehicles");
    if (stored) {
      try {
        const list = JSON.parse(stored);
        const updated = list.map((item: any) => (item.id === v.id || item.plate_number === v.plate_number) ? { ...item, ...v } : item);
        localStorage.setItem("orange_fleet_vehicles", JSON.stringify(updated));
      } catch (e) {}
    }
  }

  async function assignBayVehicleToDriver(vehicle: any, driver: Driver) {
    // 1. If driver already has an older vehicle in fleet, return it to bay
    const olderVeh = fleetVehicles.find(v => v.assigned_driver_id === driver.id && v.id !== vehicle.id);
    if (olderVeh) {
      const olderParked = {
        ...olderVeh,
        status: "in_bay",
        assigned_driver_id: null,
        assigned_at: null,
        bay_number: olderVeh.bay_number || "Bay A-1"
      };
      await updateFleetVehicleInDbOrLocal(olderParked);
      toast.info(`🅿️ Older car ${olderVeh.plate_number} parked back in ${olderParked.bay_number}.`);
    }

    // 2. Mark selected vehicle as assigned
    const assigned = {
      ...vehicle,
      status: "assigned",
      assigned_driver_id: driver.id,
      assigned_at: new Date().toISOString()
    };
    await updateFleetVehicleInDbOrLocal(assigned);

    // 3. Update driver in Supabase
    await supabase.from("drivers").update({
      vehicle_number: vehicle.plate_number,
      vehicle_model: vehicle.model
    }).eq("id", driver.id);

    toast.success(`🚗 ${vehicle.plate_number} assigned to ${driver.full_name}! Customer rides & driver console updated.`);
    setEditingVehicleId(null);
    loadFleet();
    onRefresh();
  }

  async function unassignDriverVehicle(driver: Driver) {
    const currVeh = fleetVehicles.find(v => v.assigned_driver_id === driver.id || v.plate_number === driver.vehicle_number);
    if (currVeh) {
      const parked = {
        ...currVeh,
        status: "in_bay",
        assigned_driver_id: null,
        assigned_at: null,
        bay_number: currVeh.bay_number || "Bay A-1"
      };
      await updateFleetVehicleInDbOrLocal(parked);
    }

    await supabase.from("drivers").update({
      vehicle_number: "Unassigned"
    }).eq("id", driver.id);

    toast.success(`🅿️ ${driver.full_name}'s car unassigned and parked in bay.`);
    setEditingVehicleId(null);
    loadFleet();
    onRefresh();
  }

  async function assignCustomVehicle(plate: string, model: string, driver: Driver) {
    await supabase.from("drivers").update({
      vehicle_number: plate,
      vehicle_model: model
    }).eq("id", driver.id);

    toast.success(`Vehicle ${plate} assigned to ${driver.full_name}!`);
    setEditingVehicleId(null);
    onRefresh();
  }


  const filtered = drivers.filter(d =>
    d.full_name.toLowerCase().includes(search.toLowerCase()) ||
    d.city?.toLowerCase().includes(search.toLowerCase()) ||
    d.vehicle_number?.toLowerCase().includes(search.toLowerCase())
  );

  function driverBookings(driverId: string) {
    return bookings.filter(b => b.driver_id === driverId && b.status === "completed");
  }

  function driverStats(driverId: string) {
    const rides = driverBookings(driverId);
    const total = rides.reduce((s, b) => s + Math.round(Number(b.final_fare ?? b.estimated_fare ?? 0)), 0);
    const upi   = rides.filter(b => b.payment_method === "upi").reduce((s, b) => s + Math.round(Number(b.final_fare ?? b.estimated_fare ?? 0)), 0);
    const cash  = rides.filter(b => b.payment_method === "cash").reduce((s, b) => s + Math.round(Number(b.final_fare ?? b.estimated_fare ?? 0)), 0);
    const today = new Date(); today.setHours(0,0,0,0);
    const todayRides = rides.filter(b => new Date(b.completed_at ?? "") >= today);
    const todayTotal = todayRides.reduce((s, b) => s + Math.round(Number(b.final_fare ?? b.estimated_fare ?? 0)), 0);
    return { count: rides.length, total, upi, cash, todayTotal, todayCount: todayRides.length };
  }

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="Search drivers by name, city or vehicle number..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        )}
      </div>

      {filtered.length === 0 && (
        <p className="py-10 text-center text-sm text-muted-foreground">No drivers found.</p>
      )}

      {/* Driver cards */}
      {filtered.map(d => {
        const stats = driverStats(d.id);
        const isExpanded = expanded === d.id;
        const isEditingVehicle = editingVehicleId === d.id;
        const rides = driverBookings(d.id);

        return (
          <div key={d.id} className="rounded-xl border border-border bg-background overflow-hidden">
            {/* Driver header */}
            <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-4">
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
                  {d.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold">{d.full_name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d.is_online ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                      {d.is_online ? "● Online" : "Offline"}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center gap-2 flex-wrap">
                    <span className="text-xs text-muted-foreground">{d.city}</span>
                    <span className="text-muted-foreground text-xs">·</span>
                    <span className="inline-flex items-center gap-1 rounded bg-primary/10 border border-primary/20 px-2 py-0.5 text-xs font-semibold text-primary">
                      <Car className="size-3" />
                      <span>{d.vehicle_model || "Mahindra BE.6"}</span>
                      <span className="font-mono font-bold">
                        {d.vehicle_number && d.vehicle_number !== "Unassigned" ? d.vehicle_number : "⚠️ No car assigned"}
                      </span>
                    </span>
                    <span className="text-muted-foreground text-xs">·</span>
                    <button
                      type="button"
                      onClick={() => {
                        const newPhone = prompt(`Enter phone number for ${d.full_name}:`, d.phone || "");
                        if (newPhone !== null && newPhone.trim() !== "") {
                          supabase.from("drivers").update({ phone: newPhone.trim() }).eq("id", d.id).then(({ error }) => {
                            if (error) toast.error("Could not update phone: " + error.message);
                            else {
                              toast.success("Driver phone updated!");
                              onRefresh();
                            }
                          });
                        }
                      }}
                      className="inline-flex items-center gap-1 text-xs font-mono text-muted-foreground hover:text-primary transition-colors underline cursor-pointer"
                      title="Click to edit driver phone number"
                    >
                      <Phone className="size-3" />
                      <span>{d.phone || "Add Phone ✏️"}</span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => setEditingVehicleId(isEditingVehicle ? null : d.id)}
                >
                  <Car className="size-3.5" />
                  {isEditingVehicle ? "Close" : (d.vehicle_number && d.vehicle_number !== "Unassigned" ? "Change Vehicle" : "Assign Daily Vehicle")}
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-xs"
                  onClick={async () => { await supabase.from("drivers").update({ status: d.status === "active" ? "inactive" : "active" }).eq("id", d.id); onRefresh(); }}>
                  {d.status === "active" ? "Deactivate" : "Activate"}
                </Button>
                <button onClick={() => setExpanded(isExpanded ? null : d.id)} className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors">
                  {isExpanded ? <><ChevronUp className="size-3" /> Hide</> : <><ChevronDown className="size-3" /> View Analytics</>}
                </button>
              </div>
            </div>

            {/* Daily Vehicle Assignment Form */}
            {isEditingVehicle && (() => {
              const bayVehicles = fleetVehicles.filter(v => v.status === "in_bay");

              return (
                <div className="border-t border-border bg-primary/5 p-5 animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <Car className="size-4" /> Daily Vehicle Assignment — {d.full_name}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Select an available vehicle from the bay. Updates customer booking screens & driver console in real-time.
                      </p>
                    </div>
                    <button onClick={() => setEditingVehicleId(null)} className="text-muted-foreground hover:text-foreground">
                      <X className="size-4" />
                    </button>
                  </div>

                  <div className="mt-4 rounded-xl border border-border bg-background p-4 shadow-sm space-y-3">
                    <div>
                      <label className="text-xs font-bold uppercase tracking-wider text-foreground flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <ParkingSquare className="size-3.5 text-blue-600" />
                          Vehicles in Bay Available to Assign ({bayVehicles.length})
                        </span>
                        {d.vehicle_number && d.vehicle_number !== "Unassigned" && (
                          <span className="text-[11px] font-normal text-muted-foreground">
                            Current: <strong className="font-mono text-primary">{d.vehicle_number}</strong>
                          </span>
                        )}
                      </label>

                      <div className="mt-2 flex flex-col sm:flex-row gap-2.5">
                        <select
                          id={`select-bay-veh-${d.id}`}
                          defaultValue=""
                          className="flex-1 rounded-lg border border-border bg-background px-3 py-2.5 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                        >
                          <option value="">-- Choose a Vehicle Currently in Bay --</option>
                          {bayVehicles.map(v => (
                            <option key={v.id || v.plate_number} value={v.id || v.plate_number}>
                              {v.plate_number} · {v.model} — 🅿️ {v.bay_number || "Bay A-1"} (🔋 {v.battery_percentage}%)
                            </option>
                          ))}
                          {bayVehicles.length === 0 && (
                            <option disabled value="">No vehicles currently in bay. Register one or park one back.</option>
                          )}
                        </select>

                        <Button
                          size="sm"
                          className="h-10 px-5 text-xs font-semibold gap-1.5 shrink-0"
                          onClick={async () => {
                            const selectEl = document.getElementById(`select-bay-veh-${d.id}`) as HTMLSelectElement;
                            const selectedVal = selectEl?.value;
                            if (!selectedVal) {
                              toast.error("Please select a vehicle from the bay dropdown");
                              return;
                            }
                            const selectedVeh = fleetVehicles.find(v => (v.id === selectedVal || v.plate_number === selectedVal));
                            if (!selectedVeh) return;

                            await assignBayVehicleToDriver(selectedVeh, d);
                          }}
                        >
                          <Check className="size-3.5" /> Assign Selected Car
                        </Button>

                        {d.vehicle_number && d.vehicle_number !== "Unassigned" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-10 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 shrink-0 gap-1.5"
                            onClick={async () => {
                              await unassignDriverVehicle(d);
                            }}
                          >
                            <ParkingSquare className="size-3.5" /> Return Current Car to Bay
                          </Button>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-muted-foreground flex items-center gap-1.5 pt-1">
                      <Zap className="size-3 text-emerald-600 shrink-0" />
                      Assigning a car moves it out of the bay. If {d.full_name} already has an assigned vehicle, the older one is automatically parked back in the bay.
                    </p>

                    {/* Manual entry fallback */}
                    <div className="pt-2 border-t border-border/70">
                      <button
                        type="button"
                        onClick={() => setCustomEntryDriverId(customEntryDriverId === d.id ? null : d.id)}
                        className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        {customEntryDriverId === d.id ? "▲ Close manual plate entry" : "▼ Need to enter custom / external plate manually?"}
                      </button>

                      {customEntryDriverId === d.id && (
                        <div className="mt-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-muted/40 p-3 rounded-lg border border-border">
                          <div className="sm:col-span-5">
                            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Model</label>
                            <input
                              id={`manual-model-${d.id}`}
                              defaultValue={d.vehicle_model || "Mahindra BE.6"}
                              className="mt-1 w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                            />
                          </div>
                          <div className="sm:col-span-4">
                            <label className="text-[10px] uppercase font-semibold text-muted-foreground">Plate Number</label>
                            <input
                              id={`manual-plate-${d.id}`}
                              placeholder="e.g. DL 01 EV 9999"
                              className="mt-1 w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs font-mono font-bold uppercase outline-none focus:border-primary"
                            />
                          </div>
                          <div className="sm:col-span-3">
                            <Button
                              size="sm"
                              variant="secondary"
                              className="w-full h-8 text-xs font-semibold"
                              onClick={async () => {
                                const m = (document.getElementById(`manual-model-${d.id}`) as HTMLInputElement)?.value;
                                const p = (document.getElementById(`manual-plate-${d.id}`) as HTMLInputElement)?.value;
                                if (!p?.trim()) { toast.error("Please enter a plate number"); return; }
                                await assignCustomVehicle(p.trim().toUpperCase(), m?.trim() || "Mahindra BE.6", d);
                              }}
                            >
                              Assign Custom Plate
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}



            {/* Analytics row — always visible */}
            <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-4 lg:grid-cols-6">
              {[
                { label: "Total Rides", value: stats.count },
                { label: "Total Earned", value: `₹${Math.round(stats.total)}` },
                { label: "UPI", value: `₹${Math.round(stats.upi)}`, color: "text-blue-600" },
                { label: "Cash", value: `₹${Math.round(stats.cash)}`, color: "text-green-600" },
                { label: "Today's Rides", value: stats.todayCount },
                { label: "Today Earned", value: `₹${Math.round(stats.todayTotal)}`, color: "text-primary" },
              ].map(s => (
                <div key={s.label} className="bg-background px-4 py-3">
                  <p className="text-[10px] font-semibold uppercase text-muted-foreground">{s.label}</p>
                  <p className={`mt-1 text-lg font-bold ${s.color ?? ""}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Expandable ride history */}
            {isExpanded && (
              <div className="border-t border-border">
                <div className="px-6 py-3 bg-muted/30">
                  <p className="text-xs font-bold uppercase text-muted-foreground">Ride History ({rides.length} completed)</p>
                </div>
                {rides.length === 0 ? (
                  <p className="px-6 py-6 text-sm text-muted-foreground">No completed rides yet.</p>
                ) : (
                  <div className="divide-y divide-border max-h-72 overflow-y-auto">
                    {rides.slice(0, 50).map(b => {
                      const ridePlate = getBookingVehiclePlate(b, d);
                      return (
                        <div key={b.id} className="flex items-center justify-between px-6 py-3 gap-4 text-sm hover:bg-muted/20">
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-mono text-xs font-bold text-foreground">{b.reference}</p>
                              {ridePlate && (
                                <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                                  {ridePlate}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5">{b.pickup_area} → {b.drop_area}</p>
                            <p className="text-xs text-muted-foreground">{b.completed_at ? new Date(b.completed_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${b.payment_method === "upi" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                            {b.payment_method?.toUpperCase()}
                          </span>
                          <span className="font-bold text-primary">₹{Math.round(b.final_fare ?? b.estimated_fare)}</span>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function KpiCard({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub: string; icon: React.ElementType }) {
  return (
    <div className="rounded-xl border border-border bg-background p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">{label}</p>
        <Icon className="size-4 text-primary" />
      </div>
      <p className="mt-3 text-2xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function CountBadge({ n, color = "primary" }: { n: number; color?: string }) {
  if (n === 0) return null;
  const cls = color === "amber" ? "bg-amber-500" : color === "blue" ? "bg-blue-500" : "bg-primary";
  return <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold text-white ${cls}`}>{n}</span>;
}

function EmptyState({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-border py-16 text-center">
      <BriefcaseBusiness className="size-10 text-muted-foreground/40" />
      <p className="mt-4 font-semibold">{title}</p>
      <p className="mt-2 max-w-xs text-sm text-muted-foreground">{text}</p>
    </div>
  );
}
