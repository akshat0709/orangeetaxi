// @ts-nocheck

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { User, MapPin, Navigation, Star, TrendingUp, Clock, Loader2, Save, Phone, Mail, Check, ShieldAlert, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { TaxInvoiceModal } from "@/components/tax-invoice-modal";

export const Route = createFileRoute("/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Orange Taxi" },
      { name: "description", content: "View your Orange Taxi profile, ride history and stats." },
    ],
  }),
  component: ProfilePage,
});

const STATUS_STYLES = {
  completed:   { label: "Completed",   className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" },
  cancelled:   { label: "Cancelled",   className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
  searching:   { label: "Searching",   className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400" },
  accepted:    { label: "Accepted",    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  arrived:     { label: "Arrived",     className: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-400" },
  in_progress: { label: "In Progress", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400" },
};

function getInitials(name) {
  if (!name?.trim()) return "?";
  return name.trim().split(/\s+/).map((w) => w[0]?.toUpperCase() ?? "").slice(0, 2).join("");
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function ProfilePage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [savedOnce, setSavedOnce] = useState(false);

  // Guardian contact state
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [guardianSavedOnce, setGuardianSavedOnce] = useState(false);
  const [selectedInvoiceBooking, setSelectedInvoiceBooking] = useState<any>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const s = localStorage.getItem("orange_guardian_contact");
      if (s) {
        const p = JSON.parse(s);
        if (p.name) setGuardianName(p.name);
        if (p.phone) setGuardianPhone(p.phone);
      }
    } catch (e) {}
  }, []);

  function handleSaveGuardian() {
    if (!guardianName.trim() || !guardianPhone.trim()) {
      toast.error("Please enter both guardian name and phone number");
      return;
    }
    const contact = { name: guardianName.trim(), phone: guardianPhone.trim() };
    localStorage.setItem("orange_guardian_contact", JSON.stringify(contact));
    if (typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("guardian_contact_updated", { detail: contact }));
    }
    toast.success("Guardian emergency contact saved!");
    setGuardianSavedOnce(true);
    setTimeout(() => setGuardianSavedOnce(false), 2000);
  }

  const [bookings, setBookings] = useState([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    if (!authLoading && !user) {
      navigate({ to: "/login", search: { redirect: "/profile" } });
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    async function fetchProfile() {
      setProfileLoading(true);
      const { data } = await supabase
        .from("profiles")
        .select("full_name, phone, updated_at")
        .eq("id", user.id)
        .single();
      if (data) {
        setFullName(data.full_name ?? "");
        setPhone(data.phone ?? "");
      }
      setProfileLoading(false);
    }
    fetchProfile();
  }, [user]);

  useEffect(() => {
    if (!user) return;
    async function fetchBookings() {
      setBookingsLoading(true);
      const { data, error } = await supabase
        .from("bookings")
        .select("id, reference, status, pickup_area, drop_area, estimated_fare, final_fare, created_at, completed_at, vehicle_name, payment_method, rating")
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });
      if (!error && data) setBookings(data);
      setBookingsLoading(false);
    }
    fetchBookings();
  }, [user]);

  async function handleSave() {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").upsert({
      id: user.id,
      full_name: fullName.trim(),
      phone: phone.trim(),
      updated_at: new Date().toISOString(),
    });
    if (error) {
      toast.error("Failed to save profile");
    } else {
      setSavedOnce(true);
      toast.success("Profile saved!");
      setTimeout(() => setSavedOnce(false), 2000);
    }
    setSaving(false);
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const completedRides = bookings.filter((b) => b.status === "completed");
  const totalSpent = completedRides.reduce((sum, b) => sum + (b.final_fare ?? b.estimated_fare ?? 0), 0);
  const avgFare = completedRides.length > 0 ? totalSpent / completedRides.length : 0;
  const memberSince = user.created_at ? formatDate(user.created_at) : "—";

  const filteredBookings =
    filter === "all" ? bookings : bookings.filter((b) => b.status === filter);

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-warm/30">
        <div className="section-shell py-8">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Account</p>
          <h1 className="display-serif mt-2 text-4xl md:text-5xl">My Profile</h1>
        </div>
      </div>

      <div className="section-shell py-10">
        <div className="grid gap-10 lg:grid-cols-[340px_1fr] lg:items-start">

          <div className="space-y-6">
            {/* Profile Card */}
            <div className="rounded-2xl border border-border bg-card p-7 shadow-sm">
              {profileLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="size-7 animate-spin text-primary" />
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center text-center">
                    <div className="grid size-24 place-items-center rounded-full bg-primary text-3xl font-bold text-primary-foreground shadow-lg">
                      {getInitials(fullName || user.email?.split("@")[0] || "")}
                    </div>
                    <p className="mt-4 text-lg font-bold text-foreground">
                      {fullName || user.email?.split("@")[0]}
                    </p>
                    <p className="text-sm text-muted-foreground">{user.email}</p>
                  </div>

                  <div className="mt-8 space-y-5">
                    <div>
                      <Label htmlFor="fullName" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <User className="size-3" /> Full Name
                      </Label>
                      <Input
                        id="fullName"
                        className="mt-1.5"
                        placeholder="Your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label htmlFor="phone" className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <Phone className="size-3" /> Phone
                      </Label>
                      <Input
                        id="phone"
                        className="mt-1.5"
                        placeholder="+91 98765 43210"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                        <Mail className="size-3" /> Email
                      </Label>
                      <Input className="mt-1.5 cursor-not-allowed opacity-60" value={user.email ?? ""} readOnly />
                    </div>
                    <Button className="w-full" onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : savedOnce ? (
                        <><Check className="size-4" /> Saved</>
                      ) : (
                        <><Save className="size-4" /> Save Profile</>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </div>

            {/* Guardian & Emergency Safety Card */}
            <div className="rounded-2xl border border-amber-500/30 bg-card p-6 shadow-sm">
              <div className="flex items-center gap-2.5 border-b border-border pb-3">
                <div className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500">
                  <ShieldAlert className="size-4" />
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground">Guardian Emergency Contact</p>
                  <p className="text-[11px] text-muted-foreground">1-tap call & live tracking alerts during rides</p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <Label htmlFor="guardianName" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Guardian Name / Relationship
                  </Label>
                  <Input
                    id="guardianName"
                    className="mt-1.5"
                    placeholder="e.g. Mom, Brother, Rohit"
                    value={guardianName}
                    onChange={(e) => setGuardianName(e.target.value)}
                  />
                </div>

                <div>
                  <Label htmlFor="guardianPhone" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Guardian Phone Number
                  </Label>
                  <Input
                    id="guardianPhone"
                    className="mt-1.5 font-mono"
                    placeholder="e.g. +91 98765 43210"
                    value={guardianPhone}
                    onChange={(e) => setGuardianPhone(e.target.value)}
                  />
                </div>

                <Button
                  variant="outline"
                  className="w-full border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 text-xs font-bold mt-1"
                  onClick={handleSaveGuardian}
                >
                  {guardianSavedOnce ? <><Check className="size-3.5" /> Guardian Saved</> : "Save Guardian Contact"}
                </Button>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="history">
            <TabsList className="w-full">
              <TabsTrigger value="history" className="flex-1">Ride History</TabsTrigger>
              <TabsTrigger value="stats" className="flex-1">Stats</TabsTrigger>
            </TabsList>

            {/* Ride History */}
            <TabsContent value="history" className="mt-6">
              <div className="flex gap-2 flex-wrap">
                {["all", "completed", "cancelled"].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors ${
                      filter === f
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground"
                    }`}
                  >
                    {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>

              <div className="mt-5 space-y-3">
                {bookingsLoading ? (
                  <div className="flex justify-center py-16">
                    <Loader2 className="size-7 animate-spin text-primary" />
                  </div>
                ) : filteredBookings.length === 0 ? (
                  <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border py-16 text-center">
                    <Clock className="size-10 text-muted-foreground/50" />
                    <p className="mt-4 font-semibold text-muted-foreground">No rides yet</p>
                    <p className="mt-1 text-sm text-muted-foreground/70">
                      {filter === "all" ? "Your ride history will appear here." : `No ${filter} rides found.`}
                    </p>
                    <Button asChild className="mt-6" size="sm">
                      <Link to="/book">Book Your First Ride</Link>
                    </Button>
                  </div>
                ) : (
                  filteredBookings.map((booking) => {
                    const style = STATUS_STYLES[booking.status] ?? { label: booking.status, className: "bg-muted text-muted-foreground" };
                    const displayFare = booking.final_fare ?? booking.estimated_fare;
                    return (
                      <div key={booking.id} className="rounded-xl border border-border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-foreground">#{booking.reference}</span>
                              <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.className}`}>
                                {style.label}
                              </span>
                              {booking.rating && (
                                <span className="flex items-center gap-0.5 text-xs text-yellow-500">
                                  <Star className="size-3 fill-yellow-400" />{booking.rating}
                                </span>
                              )}
                            </div>
                            <div className="mt-2.5 flex items-center gap-1.5 text-sm text-foreground">
                              <MapPin className="size-3.5 shrink-0 text-primary" />
                              <span className="truncate font-medium">{booking.pickup_area}</span>
                              <Navigation className="size-3 shrink-0 text-muted-foreground" />
                              <span className="truncate">{booking.drop_area}</span>
                            </div>
                            <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                              <span>{booking.vehicle_name}</span>
                              <span>·</span>
                              <span>{formatDate(booking.created_at)}</span>
                              <span>·</span>
                              <span className="capitalize">{booking.payment_method}</span>
                            </div>
                          </div>
                          <div className="shrink-0 text-right flex flex-col items-end">
                            <p className="text-lg font-bold text-primary">₹{Math.round(displayFare ?? 0)}</p>
                            {booking.final_fare == null && <p className="text-[10px] text-muted-foreground">est.</p>}
                            {booking.status === "completed" && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setSelectedInvoiceBooking(booking)}
                                className="mt-2 h-7 px-2.5 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10 shadow-xs"
                                title="View & download official GST tax invoice"
                              >
                                <FileText className="size-3" />
                                <span>Invoice</span>
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* Stats */}
            <TabsContent value="stats" className="mt-6">
              <div className="grid grid-cols-2 gap-4">
                <StatCard icon={<TrendingUp className="size-5 text-primary" />} label="Total Rides" value={bookings.length.toString()} />
                <StatCard icon={<Star className="size-5 text-primary" />} label="Total Spent" value={`₹${Math.round(totalSpent).toLocaleString("en-IN")}`} />
                <StatCard icon={<Navigation className="size-5 text-primary" />} label="Avg Fare" value={completedRides.length > 0 ? `₹${Math.round(avgFare)}` : "—"} />
                <StatCard icon={<Clock className="size-5 text-primary" />} label="Member Since" value={memberSince} />
              </div>

              {completedRides.length > 0 && (
                <div className="mt-6 rounded-xl border border-border bg-card p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Quick Summary</p>
                  <div className="mt-4 space-y-3">
                    <SummaryRow label="Completed Rides" value={completedRides.length.toString()} />
                    <SummaryRow label="Cancelled Rides" value={bookings.filter((b) => b.status === "cancelled").length.toString()} />
                    <SummaryRow label="Active Rides" value={bookings.filter((b) => ["searching","accepted","arrived","in_progress"].includes(b.status)).length.toString()} />
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {selectedInvoiceBooking && (
        <TaxInvoiceModal
          open={Boolean(selectedInvoiceBooking)}
          onOpenChange={(open) => {
            if (!open) setSelectedInvoiceBooking(null);
          }}
          booking={selectedInvoiceBooking}
          customer={{ fullName, phone, email: user?.email }}
        />
      )}
    </div>
  );
}

function StatCard({ icon, label, value }) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="grid size-9 place-items-center rounded-full bg-primary/10">{icon}</div>
      <div>
        <p className="text-2xl font-bold text-foreground">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function SummaryRow({ label, value }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold text-foreground">{value}</span>
    </div>
  );
}
