import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, BriefcaseBusiness, Car, CheckCircle, Loader2, MoreHorizontal, Users, X } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — Orange Taxi" }] }),
  component: AdminPage,
});

interface Booking { id: string; reference: string; status: string; pickup_area: string; drop_area: string; estimated_fare: number; vehicle_name: string; payment_method: string; created_at: string; driver_id: string | null; customer_id: string; }
interface Application { id: string; full_name: string; email: string; phone: string; city: string; licence_number: string; experience_years: number; owns_vehicle: boolean; message: string; status: string; admin_notes: string; created_at: string; }
interface Enquiry { id: string; company_name: string; contact_name: string; email: string; phone: string; city: string; team_size: string; requirement: string; message: string; status: string; created_at: string; }
interface Driver { id: string; full_name: string; phone: string; city: string; is_online: boolean; rating: number; total_rides: number; status: string; vehicle_model: string; vehicle_number: string; }

const STATUS_BADGE: Record<string, string> = {
  searching: "bg-amber-100 text-amber-700",
  accepted: "bg-blue-100 text-blue-700",
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
    setBookings((b as Booking[]) ?? []);
    setApplications((a as Application[]) ?? []);
    setEnquiries((e as Enquiry[]) ?? []);
    setDrivers((d as Driver[]) ?? []);
    setLoading(false);
  }

  // Stats
  const stats = {
    totalBookings: bookings.length,
    activeBookings: bookings.filter(b => ["searching", "accepted", "arrived", "in_progress"].includes(b.status)).length,
    completedBookings: bookings.filter(b => b.status === "completed").length,
    totalRevenue: bookings.filter(b => b.status === "completed").reduce((s, b) => s + b.estimated_fare, 0),
    onlineDrivers: drivers.filter(d => d.is_online).length,
    pendingApplications: applications.filter(a => a.status === "new").length,
    newEnquiries: enquiries.filter(e => e.status === "new").length,
  };

  async function updateApplicationStatus(id: string, status: string, email?: string) {
    await supabase.from("driver_applications").update({ status }).eq("id", id);

    if (status === "approved" && email) {
      // Grant driver role via RPC
      const { data: result } = await supabase.rpc("admin_set_role" as any, { _email: email, _role: "driver", _grant: true });
      if (result !== "ok") toast.error(`Could not grant driver role: ${result}`);
      else {
        // Create driver profile if not exists — basic placeholder
        toast.success("Driver role granted. Have the driver log into /driver-console to set up their profile.");
      }
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
    const { error } = await supabase.from("bookings").update({ driver_id: driverId, status: "accepted", accepted_at: new Date().toISOString() }).eq("id", bookingId);
    if (error) { toast.error("Assignment failed"); return; }
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
        <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
          <KpiCard label="Total Bookings" value={stats.totalBookings} sub={`${stats.activeBookings} active`} icon={Car} />
          <KpiCard label="Revenue" value={`₹${Math.round(stats.totalRevenue)}`} sub={`${stats.completedBookings} completed`} icon={BadgeCheck} />
          <KpiCard label="Drivers Online" value={stats.onlineDrivers} sub={`of ${drivers.length} total`} icon={Users} />
          <KpiCard label="Pending" value={stats.pendingApplications + stats.newEnquiries} sub={`${stats.pendingApplications} apps · ${stats.newEnquiries} enquiries`} icon={MoreHorizontal} />
        </div>

        {/* Main tabs */}
        <Tabs defaultValue="bookings" className="mt-10">
          <TabsList className="mb-6 flex flex-wrap gap-1">
            <TabsTrigger value="bookings">Bookings <CountBadge n={stats.activeBookings} /></TabsTrigger>
            <TabsTrigger value="applications">Applications <CountBadge n={stats.pendingApplications} color="amber" /></TabsTrigger>
            <TabsTrigger value="enquiries">Enquiries <CountBadge n={stats.newEnquiries} color="blue" /></TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
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
                      {["Reference", "Route", "Vehicle", "Fare", "Status", "Driver", "Date", "Actions"].map(h => (
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
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[b.status] ?? "bg-muted text-muted-foreground"}`}>{b.status.replace("_", " ")}</span>
                        </td>
                        <td className="px-4 py-3">
                          {b.status === "searching" ? (
                            <Select onValueChange={v => assignDriver(b.id, v)}>
                              <SelectTrigger className="h-7 w-36 text-xs"><SelectValue placeholder="Assign driver" /></SelectTrigger>
                              <SelectContent>
                                {drivers.filter(d => d.is_online).map(d => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          ) : (
                            <span className="text-xs text-muted-foreground">{b.driver_id ? drivers.find(d => d.id === b.driver_id)?.full_name ?? "Assigned" : "—"}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{new Date(b.created_at).toLocaleDateString()}</td>
                        <td className="px-4 py-3">
                          {["searching", "accepted"].includes(b.status) && (
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
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              <div className="border-b border-border px-6 py-4">
                <h3 className="font-semibold">All Drivers</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {["Name", "City", "Vehicle", "Status", "Rating", "Rides", "Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {drivers.map(d => (
                      <tr key={d.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-semibold">{d.full_name}</td>
                        <td className="px-4 py-3 text-muted-foreground">{d.city}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{d.vehicle_model || "—"} {d.vehicle_number && `· ${d.vehicle_number}`}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${d.is_online ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                            {d.is_online ? "Online" : "Offline"}
                          </span>
                        </td>
                        <td className="px-4 py-3">{d.rating.toFixed(1)} ⭐</td>
                        <td className="px-4 py-3">{d.total_rides}</td>
                        <td className="px-4 py-3">
                          <Button size="sm" variant="ghost" className="text-xs"
                            onClick={async () => { await supabase.from("drivers").update({ status: d.status === "active" ? "inactive" : "active" }).eq("id", d.id); loadAll(); }}>
                            {d.status === "active" ? "Deactivate" : "Activate"}
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {drivers.length === 0 && <p className="p-8 text-center text-sm text-muted-foreground">No drivers yet. Approve a driver application to add them.</p>}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </section>
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
