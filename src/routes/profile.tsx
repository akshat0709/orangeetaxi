// @ts-nocheck

import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  User,
  MapPin,
  Navigation,
  Star,
  TrendingUp,
  Clock,
  Loader2,
  Save,
  Phone,
  Mail,
  Check,
  ShieldAlert,
  FileText,
  Calendar,
  X,
  Home,
  Briefcase,
  Map as MapIcon,
  Trash2,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { TaxInvoiceModal } from "@/components/tax-invoice-modal";
import { MapPicker, MapLocation } from "@/components/map-picker";

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
  scheduled: {
    label: "Scheduled",
    className:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300 border border-orange-300 dark:border-orange-800",
  },
  completed: {
    label: "Completed",
    className: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
  },
  searching: {
    label: "Searching",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400",
  },
  accepted: {
    label: "Accepted",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  },
  arrived: {
    label: "Arrived",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  },
  in_progress: {
    label: "In Progress",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400",
  },
};

function getInitials(name) {
  if (!name?.trim()) return "?";
  return name
    .trim()
    .split(/\s+/)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

function formatDate(dateStr) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
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

  // Saved Places (Home & Work) with Map Picker
  const [homeAddress, setHomeAddress] = useState("");
  const [homeCoords, setHomeCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [workAddress, setWorkAddress] = useState("");
  const [workCoords, setWorkCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapPickerTarget, setMapPickerTarget] = useState<"home" | "work" | null>(null);
  const [areas, setAreas] = useState([]);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const s = localStorage.getItem("orange_guardian_contact");
      if (s) {
        const p = JSON.parse(s);
        if (p.name) setGuardianName(p.name);
        if (p.phone) setGuardianPhone(p.phone);
      }

      const h =
        localStorage.getItem("@orange_user_home_address") ||
        localStorage.getItem("orange_user_home_address");
      if (h) setHomeAddress(h);
      const hc =
        localStorage.getItem("@orange_user_home_coords") ||
        localStorage.getItem("orange_user_home_coords");
      if (hc) setHomeCoords(JSON.parse(hc));

      const w =
        localStorage.getItem("@orange_user_work_address") ||
        localStorage.getItem("orange_user_work_address");
      if (w) setWorkAddress(w);
      const wc =
        localStorage.getItem("@orange_user_work_coords") ||
        localStorage.getItem("orange_user_work_coords");
      if (wc) setWorkCoords(JSON.parse(wc));
    } catch (e) {}

    async function loadAreas() {
      try {
        const { data } = await supabase.from("service_areas").select("*");
        if (data) setAreas(data);
      } catch (err) {}
    }
    loadAreas();
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

  function handleSaveMapPlace(location: MapLocation) {
    if (!mapPickerTarget) return;
    const cleaned = location.name;
    const coords = { lat: location.lat, lng: location.lng };
    if (mapPickerTarget === "home") {
      setHomeAddress(cleaned);
      setHomeCoords(coords);
      localStorage.setItem("@orange_user_home_address", cleaned);
      localStorage.setItem("@orange_user_home_coords", JSON.stringify(coords));
      toast.success("Home address saved on map! 🏠", {
        description: cleaned,
      });
    } else {
      setWorkAddress(cleaned);
      setWorkCoords(coords);
      localStorage.setItem("@orange_user_work_address", cleaned);
      localStorage.setItem("@orange_user_work_coords", JSON.stringify(coords));
      toast.success("Work address saved on map! 💼", {
        description: cleaned,
      });
    }
    setMapPickerTarget(null);
  }

  function handleClearPlace(target: "home" | "work") {
    if (target === "home") {
      setHomeAddress("");
      setHomeCoords(null);
      localStorage.removeItem("@orange_user_home_address");
      localStorage.removeItem("@orange_user_home_coords");
      toast.info("Home address removed");
    } else {
      setWorkAddress("");
      setWorkCoords(null);
      localStorage.removeItem("@orange_user_work_address");
      localStorage.removeItem("@orange_user_work_coords");
      toast.info("Work address removed");
    }
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

  async function fetchBookings() {
    if (!user) return;
    setBookingsLoading(true);
    try {
      const { data, error } = await supabase
        .from("bookings")
        .select(
          "id, reference, status, pickup_area, drop_area, estimated_fare, final_fare, created_at, completed_at, scheduled_at, vehicle_name, payment_method, rating, driver_id, drivers(full_name, phone, vehicle_number)",
        )
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      let list = data || [];

      // Also merge any bookings created in this browser stored in localStorage
      try {
        const stored =
          localStorage.getItem("@orange_booking_history_ids") ||
          localStorage.getItem("orange_booking_history_ids");
        const idList: string[] = stored ? JSON.parse(stored) : [];
        const missingIds = idList.filter((id) => !list.some((b) => b.id === id));
        if (missingIds.length > 0) {
          const { data: extra } = await supabase
            .from("bookings")
            .select(
              "id, reference, status, pickup_area, drop_area, estimated_fare, final_fare, created_at, completed_at, scheduled_at, vehicle_name, payment_method, rating, driver_id, drivers(full_name, phone, vehicle_number)",
            )
            .in("id", missingIds);
          if (extra && extra.length > 0) {
            list = [...list, ...extra];
            list.sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
            );
          }
        }
      } catch (err) {}

      setBookings(list);
    } catch (e) {
      console.warn("Error fetching bookings:", e);
    } finally {
      setBookingsLoading(false);
    }
  }

  useEffect(() => {
    fetchBookings();
  }, [user]);

  async function handleCancelScheduledRide(booking: any) {
    if (
      !confirm(
        `Are you sure you want to cancel scheduled ride #${booking.reference}? (Zero cancellation fee)`,
      )
    ) {
      return;
    }
    const { error } = await supabase
      .from("bookings")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", booking.id);
    if (error) {
      toast.error("Failed to cancel: " + error.message);
    } else {
      toast.success("Scheduled ride cancelled. Zero cancellation fee applied.");
      fetchBookings();
    }
  }

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

  async function handleDeleteAccount() {
    if (deleteConfirmText.trim() !== "DELETE") {
      toast.error("Please type DELETE to confirm account erasure.");
      return;
    }

    setDeletingAccount(true);
    try {
      const { data, error } = await (supabase as any).rpc("delete_user_account");
      if (error) {
        throw error;
      }

      toast.success(data?.message || "Your account and personal data have been permanently erased.");
      setDeleteModalOpen(false);

      if (typeof window !== "undefined") {
        try {
          localStorage.clear();
        } catch {}
      }

      await supabase.auth.signOut();
      navigate({ to: "/" });
    } catch (err: any) {
      console.error("Account deletion failed:", err);
      toast.error(
        err.message ||
          "Failed to delete account. Please complete any active rides and try again, or contact privacy@orange-taxi.com",
      );
    } finally {
      setDeletingAccount(false);
    }
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
  const totalSpent = completedRides.reduce(
    (sum, b) => sum + (b.final_fare ?? b.estimated_fare ?? 0),
    0,
  );
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
                      <Label
                        htmlFor="fullName"
                        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
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
                      <Label
                        htmlFor="phone"
                        className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                      >
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
                      <Input
                        className="mt-1.5 cursor-not-allowed opacity-60"
                        value={user.email ?? ""}
                        readOnly
                      />
                    </div>
                    <Button className="w-full" onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <Loader2 className="size-4 animate-spin" />
                      ) : savedOnce ? (
                        <>
                          <Check className="size-4" /> Saved
                        </>
                      ) : (
                        <>
                          <Save className="size-4" /> Save Profile
                        </>
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
                  <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Guardian Emergency Contact
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    1-tap call & live tracking alerts during rides
                  </p>
                </div>
              </div>

              <div className="mt-4 space-y-3">
                <div>
                  <Label
                    htmlFor="guardianName"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
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
                  <Label
                    htmlFor="guardianPhone"
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground"
                  >
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
                  {guardianSavedOnce ? (
                    <>
                      <Check className="size-3.5" /> Guardian Saved
                    </>
                  ) : (
                    "Save Guardian Contact"
                  )}
                </Button>
              </div>
            </div>

            {/* Saved Places Card (Home & Work with Interactive Map Picker) */}
            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <MapPin className="size-4" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-foreground">
                      Saved Places
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Pin exact gate / curb on map for 1-click rides
                    </p>
                  </div>
                </div>
              </div>

              {/* Home */}
              <div className="rounded-xl border border-border/70 p-3.5 bg-background/50 hover:border-orange-500/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-orange-500/10 text-orange-500 flex items-center justify-center">
                      <Home className="size-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground">Home</span>
                      {homeCoords && (
                        <span className="ml-2 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          GPS Pinned
                        </span>
                      )}
                    </div>
                  </div>
                  {homeAddress && (
                    <button
                      type="button"
                      onClick={() => handleClearPlace("home")}
                      className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                      title="Clear home address"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>

                <p className="mt-2 text-xs text-muted-foreground line-clamp-2 min-h-[1.5rem]">
                  {homeAddress
                    ? homeAddress
                    : "No home address set yet. Tap Choose on Map to pinpoint your exact gate or flat."}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 border-orange-500/40 text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 text-xs font-semibold h-8"
                    onClick={() => setMapPickerTarget("home")}
                  >
                    <MapIcon className="size-3.5" />
                    {homeAddress ? "Change on Map" : "Choose on Map"}
                  </Button>
                </div>
              </div>

              {/* Work */}
              <div className="rounded-xl border border-border/70 p-3.5 bg-background/50 hover:border-blue-500/40 transition-colors">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="size-7 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center">
                      <Briefcase className="size-3.5" />
                    </div>
                    <div>
                      <span className="text-xs font-bold text-foreground">Work</span>
                      {workCoords && (
                        <span className="ml-2 inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 bg-emerald-500/10 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          GPS Pinned
                        </span>
                      )}
                    </div>
                  </div>
                  {workAddress && (
                    <button
                      type="button"
                      onClick={() => handleClearPlace("work")}
                      className="p-1 text-muted-foreground hover:text-red-500 transition-colors"
                      title="Clear work address"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </div>

                <p className="mt-2 text-xs text-muted-foreground line-clamp-2 min-h-[1.5rem]">
                  {workAddress
                    ? workAddress
                    : "No work address set yet. Tap Choose on Map to pinpoint your office or building."}
                </p>

                <div className="mt-3 flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10 text-xs font-semibold h-8"
                    onClick={() => setMapPickerTarget("work")}
                  >
                    <MapIcon className="size-3.5" />
                    {workAddress ? "Change on Map" : "Choose on Map"}
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs defaultValue="history">
            <TabsList className="w-full">
              <TabsTrigger value="history" className="flex-1">
                Ride History
              </TabsTrigger>
              <TabsTrigger value="stats" className="flex-1">
                Stats
              </TabsTrigger>
            </TabsList>

            {/* Ride History */}
            <TabsContent value="history" className="mt-6">
              <div className="flex gap-2 flex-wrap">
                {["all", "scheduled", "completed", "cancelled"].map((f) => {
                  const count =
                    f === "scheduled"
                      ? bookings.filter((b) => b.status === "scheduled").length
                      : f === "completed"
                        ? bookings.filter((b) => b.status === "completed").length
                        : f === "cancelled"
                          ? bookings.filter((b) => b.status === "cancelled").length
                          : bookings.length;
                  return (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`rounded-full px-4 py-1.5 text-xs font-semibold capitalize transition-colors flex items-center gap-1.5 ${
                        filter === f
                          ? "bg-primary text-primary-foreground"
                          : "border border-border bg-background text-muted-foreground hover:border-primary hover:text-foreground"
                      }`}
                    >
                      <span>
                        {f === "all"
                          ? "All Trips"
                          : f === "scheduled"
                            ? "Scheduled & Upcoming"
                            : f.charAt(0).toUpperCase() + f.slice(1)}
                      </span>
                      {count > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                            filter === f
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : f === "scheduled"
                                ? "bg-orange-600 text-white"
                                : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Upcoming Scheduled Trips Alert Banner */}
              {bookings.filter((b) => b.status === "scheduled").length > 0 && filter === "all" && (
                <div className="mt-4 rounded-xl border border-orange-300 dark:border-orange-800 bg-orange-50/80 dark:bg-orange-950/30 p-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="grid size-8 place-items-center rounded-lg bg-orange-600 text-white shrink-0">
                      <Calendar className="size-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-orange-900 dark:text-orange-200">
                        {bookings.filter((b) => b.status === "scheduled").length} Upcoming Scheduled
                        Ride{bookings.filter((b) => b.status === "scheduled").length > 1 ? "s" : ""}
                      </p>
                      <p className="text-[11px] text-orange-700 dark:text-orange-400">
                        Zero surge locked fare • Dedicated EV Chauffeur dispatch
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setFilter("scheduled")}
                    className="h-7 text-xs border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-800 dark:text-orange-300"
                  >
                    View Scheduled
                  </Button>
                </div>
              )}

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
                      {filter === "all"
                        ? "Your ride history will appear here."
                        : `No ${filter} rides found.`}
                    </p>
                    <Button asChild className="mt-6" size="sm">
                      <Link to="/book">Book Your First Ride</Link>
                    </Button>
                  </div>
                ) : (
                  filteredBookings.map((booking) => {
                    const isScheduled = booking.status === "scheduled";
                    const schedDate = booking.scheduled_at ? new Date(booking.scheduled_at) : null;
                    const schedText = schedDate
                      ? schedDate.toLocaleDateString("en-IN", {
                          weekday: "short",
                          day: "numeric",
                          month: "short",
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        })
                      : "Advance Booking";

                    const style = STATUS_STYLES[booking.status] ?? {
                      label: booking.status,
                      className: "bg-muted text-muted-foreground",
                    };
                    const displayFare = booking.final_fare ?? booking.estimated_fare;
                    return (
                      <div
                        key={booking.id}
                        className={`rounded-xl border p-5 shadow-sm transition-all hover:shadow-md ${
                          isScheduled
                            ? "border-orange-300 bg-orange-500/[0.03] dark:border-orange-800 dark:bg-orange-950/20"
                            : "border-border bg-card"
                        }`}
                      >
                        {isScheduled && (
                          <div className="mb-3 flex items-center justify-between rounded-lg bg-orange-100 dark:bg-orange-950/60 px-3 py-2 text-xs font-semibold text-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-800">
                            <div className="flex items-center gap-2">
                              <Calendar className="size-4 text-orange-600 dark:text-orange-400 shrink-0" />
                              <span>
                                Scheduled Departure: <strong>{schedText}</strong>
                              </span>
                            </div>
                            <span className="rounded-full bg-orange-600 text-white text-[10px] font-bold px-2 py-0.5">
                              Guaranteed
                            </span>
                          </div>
                        )}

                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-foreground">
                                #{booking.reference}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${style.className}`}
                              >
                                {style.label}
                              </span>
                              {booking.rating && (
                                <span className="flex items-center gap-0.5 text-xs text-yellow-500">
                                  <Star className="size-3 fill-yellow-400" />
                                  {booking.rating}
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
                            <p className="text-lg font-bold text-primary">
                              ₹{Math.round(displayFare ?? 0)}
                            </p>
                            {booking.final_fare == null && (
                              <p className="text-[10px] text-muted-foreground">est.</p>
                            )}

                            {isScheduled ? (
                              <div className="mt-2 flex items-center gap-2">
                                <Button
                                  asChild
                                  size="sm"
                                  className="h-7 px-3 text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white"
                                >
                                  <Link to="/track" search={{ ref: booking.reference }}>
                                    Track →
                                  </Link>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleCancelScheduledRide(booking)}
                                  className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                                >
                                  Cancel
                                </Button>
                              </div>
                            ) : booking.status === "completed" ? (
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
                            ) : null}
                          </div>
                        </div>

                        {/* 7-Day Driver Contact for Lost Items (Clause 14.11 MV Aggregator Guidelines) */}
                        {booking.status === "completed" &&
                          booking.drivers?.phone &&
                          (() => {
                            const completedDate = booking.completed_at
                              ? new Date(booking.completed_at).getTime()
                              : new Date(booking.created_at).getTime();
                            const isWithin7Days =
                              Date.now() - completedDate <= 7 * 24 * 60 * 60 * 1000;
                            if (!isWithin7Days) return null;
                            const cleanPhone = booking.drivers.phone.replace(/[^0-9+]/g, "");
                            return (
                              <div className="mt-3.5 pt-3 border-t border-border flex items-center justify-between flex-wrap gap-2 text-xs">
                                <div className="flex items-center gap-1.5 text-muted-foreground">
                                  <Phone className="size-3 text-primary" />
                                  <span>
                                    Driver:{" "}
                                    <strong className="text-foreground">
                                      {booking.drivers.full_name}
                                    </strong>{" "}
                                    ({booking.drivers.phone})
                                  </span>
                                </div>
                                <a
                                  href={`tel:${cleanPhone}`}
                                  className="text-primary hover:underline font-semibold text-[11px] flex items-center gap-1"
                                >
                                  Call Driver (Lost Property)
                                </a>
                              </div>
                            );
                          })()}
                      </div>
                    );
                  })
                )}
              </div>
            </TabsContent>

            {/* Stats */}
            <TabsContent value="stats" className="mt-6">
              <div className="grid grid-cols-2 gap-4">
                <StatCard
                  icon={<TrendingUp className="size-5 text-primary" />}
                  label="Total Rides"
                  value={bookings.length.toString()}
                />
                <StatCard
                  icon={<Star className="size-5 text-primary" />}
                  label="Total Spent"
                  value={`₹${Math.round(totalSpent).toLocaleString("en-IN")}`}
                />
                <StatCard
                  icon={<Navigation className="size-5 text-primary" />}
                  label="Avg Fare"
                  value={completedRides.length > 0 ? `₹${Math.round(avgFare)}` : "—"}
                />
                <StatCard
                  icon={<Clock className="size-5 text-primary" />}
                  label="Member Since"
                  value={memberSince}
                />
              </div>

              {completedRides.length > 0 && (
                <div className="mt-6 rounded-xl border border-border bg-card p-5">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Quick Summary
                  </p>
                  <div className="mt-4 space-y-3">
                    <SummaryRow label="Completed Rides" value={completedRides.length.toString()} />
                    <SummaryRow
                      label="Scheduled Rides"
                      value={bookings.filter((b) => b.status === "scheduled").length.toString()}
                    />
                    <SummaryRow
                      label="Cancelled Rides"
                      value={bookings.filter((b) => b.status === "cancelled").length.toString()}
                    />
                    <SummaryRow
                      label="Active In-Progress Rides"
                      value={bookings
                        .filter((b) =>
                          ["searching", "accepted", "arrived", "in_progress"].includes(b.status),
                        )
                        .length.toString()}
                    />
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>

          {/* Privacy & Account Erasure (DPDP Act, 2023) */}
          <div className="mt-10 rounded-2xl border border-destructive/25 bg-destructive/5 p-6 space-y-4">
            <div className="flex items-center gap-2.5 text-destructive">
              <Trash2 className="size-5 shrink-0" />
              <h3 className="font-bold text-base">Privacy & Account Erasure (DPDP Act, 2023)</h3>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Under India's Digital Personal Data Protection Act, 2023, you have the right to request the permanent erasure of your account, contact information, saved places, and personal identifiers. Statutory tax invoices are retained in anonymized form for 72 months to satisfy mandatory Central GST (CGST) audit compliance.
            </p>
            <div className="pt-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-t border-destructive/15">
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Irreversible action:</span> All active sessions will be terminated.
              </div>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  setDeleteConfirmText("");
                  setDeleteModalOpen(true);
                }}
                className="gap-2 shrink-0 font-semibold text-xs"
              >
                <Trash2 className="size-3.5" />
                Delete My Account
              </Button>
            </div>
          </div>
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

      {/* Map Picker Modal for Home / Work Saved Places */}
      <Dialog
        open={mapPickerTarget !== null}
        onOpenChange={(open) => {
          if (!open) setMapPickerTarget(null);
        }}
      >
        <DialogContent className="max-w-3xl p-0 overflow-hidden bg-background border border-border sm:rounded-2xl">
          <DialogHeader className="sr-only">
            <DialogTitle>Pick {mapPickerTarget === "home" ? "Home" : "Work"} Location</DialogTitle>
            <DialogDescription>
              Select your exact {mapPickerTarget === "home" ? "home" : "work"} address on the
              interactive map
            </DialogDescription>
          </DialogHeader>

          <div className="h-[80vh] max-h-[720px] w-full flex flex-col">
            <MapPicker
              label={mapPickerTarget === "home" ? "Pin Home Address" : "Pin Work Address"}
              placeholder={
                mapPickerTarget === "home"
                  ? "Search house, society, landmark, or drag map..."
                  : "Search office, building, IT park, or drag map..."
              }
              areas={areas}
              apiKey={import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ""}
              initialLocation={
                mapPickerTarget === "home" && homeCoords
                  ? { name: homeAddress || "Home", lat: homeCoords.lat, lng: homeCoords.lng }
                  : mapPickerTarget === "work" && workCoords
                    ? { name: workAddress || "Work", lat: workCoords.lat, lng: workCoords.lng }
                    : null
              }
              onConfirm={handleSaveMapPlace}
              onBack={() => setMapPickerTarget(null)}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Account Confirmation Modal */}
      <Dialog open={deleteModalOpen} onOpenChange={setDeleteModalOpen}>
        <DialogContent className="sm:max-w-md bg-background border-border text-foreground">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <ShieldAlert className="size-5" />
              Permanently Delete Your Account?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground pt-2 space-y-2">
              <span>
                This action is <strong>irreversible</strong> and will permanently:
              </span>
              <ul className="list-disc list-inside space-y-1 text-foreground/80 pl-1 mt-1">
                <li>Purge your profile, phone, email, and authentication credentials.</li>
                <li>Clear all saved places (Home/Work) and emergency contacts.</li>
                <li>Anonymize your ride history and redact trip pickup/drop locations.</li>
                <li>Revoke active login sessions across all devices.</li>
              </ul>
              <span className="block text-[11px] text-muted-foreground pt-1">
                Note: Anonymized trip records with financial tax amounts are retained for 72 months solely to comply with Section 36 of the CGST Act, 2017.
              </span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <Label htmlFor="del-confirm" className="text-xs font-semibold">
                To confirm, type <span className="font-mono text-destructive font-bold">DELETE</span> below:
              </Label>
              <Input
                id="del-confirm"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                className="mt-1.5 font-mono text-sm uppercase"
                disabled={deletingAccount}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setDeleteModalOpen(false)}
              disabled={deletingAccount}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleDeleteAccount}
              disabled={deleteConfirmText.trim() !== "DELETE" || deletingAccount}
              className="gap-1.5"
            >
              {deletingAccount ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Erasing Account...
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  Erase My Data & Delete
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
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
