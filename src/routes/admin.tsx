// @ts-nocheck

import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, Banknote, BriefcaseBusiness, Calendar, Clock, Car, Check, CheckCircle, ChevronDown, ChevronUp, FileSpreadsheet, Loader2, MoreHorizontal, ParkingSquare, Phone, PhoneCall, MessageSquare, Search, Users, Wallet, X, Zap, Building2, Handshake, Percent, Sparkles, ShieldCheck, BadgeIndianRupee } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { FleetManager, DEFAULT_SAMPLE_FLEET, registerApprovedPartnerCar } from "@/components/fleet-manager";
import { CashSettlementManager } from "@/components/cash-settlement-manager";
import { CommissionLedgerManager } from "@/components/commission-ledger-manager";
import { GSTAccountingManager } from "@/components/gst-accounting-manager";
import { TabErrorBoundary } from "@/components/tab-error-boundary";
import { getBookingVehiclePlate, lockBookingVehicle, saveRideVehiclePlate, resolveDriverDetails } from "@/lib/ride-vehicle";

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search.tab === "string" ? search.tab : "bookings",
  }),
  head: () => ({ meta: [{ title: "Admin — Orange Taxi" }] }),
  component: AdminPage,
});

interface Booking { id: string; reference: string; status: string; pickup_area: string; drop_area: string; estimated_fare: number; vehicle_name: string; payment_method: string; created_at: string; driver_id: string | null; customer_id: string; ride_otp: string; scheduled_at?: string | null; }
interface Application { id: string; full_name: string; email: string; phone: string; city: string; licence_number: string; experience_years: number; owns_vehicle: boolean; message: string; status: string; admin_notes: string; created_at: string; photo_url?: string; driver_type?: string; vehicle_model?: string; vehicle_number?: string; chassis_number?: string; vehicle_year?: string; }
interface Enquiry { id: string; company_name: string; contact_name: string; email: string; phone: string; city: string; team_size: string; requirement: string; message: string; status: string; created_at: string; }
interface Driver { id: string; full_name: string; phone: string; city: string; is_online: boolean; rating: number; total_rides: number; status: string; vehicle_model: string; vehicle_number: string; vehicle_code?: string; driver_type?: string; photo_url?: string; chassis_number?: string; user_id?: string; }

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 dark:border dark:border-purple-800/40",
  searching: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 dark:border dark:border-amber-800/40",
  accepted: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border dark:border-blue-800/40",
  arrived: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300 dark:border dark:border-violet-800/40",
  in_progress: "bg-orange-100 text-orange-700 dark:bg-orange-950/60 dark:text-orange-300 dark:border dark:border-orange-800/40",
  completed: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300 dark:border dark:border-green-800/40",
  cancelled: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 dark:border dark:border-red-800/40",
  new: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  reviewed: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300 dark:border dark:border-blue-800/40",
  approved: "bg-green-100 text-green-700 dark:bg-green-950/60 dark:text-green-300 dark:border dark:border-green-800/40",
  rejected: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300 dark:border dark:border-red-800/40",
  contacted: "bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 dark:border dark:border-purple-800/40",
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
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");

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
    const appsList = (a as Application[]) ?? [];

    // Merge applications with extended details from localStorage (photo_url, vehicle details, driver_type)
    let storedExtApps: any[] = [];
    try {
      storedExtApps = JSON.parse(localStorage.getItem("orange_extended_apps") || "[]");
    } catch (err) {}

    const mergedApps: Application[] = appsList.map(app => {
      let parsedNotes: any = {};
      try {
        if (app.admin_notes && typeof app.admin_notes === "string" && app.admin_notes.trim().startsWith("{")) {
          parsedNotes = JSON.parse(app.admin_notes);
        }
      } catch (e) {}

      const ext = storedExtApps.find(
        (x: any) => x.id === app.id || (x.email && app.email && x.email.toLowerCase() === app.email.toLowerCase())
      );
      let meta: any = {};
      try {
        if (app.email) {
          meta = JSON.parse(localStorage.getItem(`orange_app_meta_${app.email.toLowerCase()}`) || "{}");
        }
      } catch (e) {}

      return {
        ...app,
        photo_url: app.photo_url || parsedNotes?.photo_url || ext?.photo_url || meta?.photo_url || "",
        driver_type: app.driver_type || parsedNotes?.driver_type || ext?.driver_type || (app.owns_vehicle ? "partner" : "company"),
        vehicle_model: app.vehicle_model || parsedNotes?.vehicle_model || ext?.vehicle_model || meta?.vehicle_model || "",
        vehicle_number: app.vehicle_number || parsedNotes?.vehicle_number || ext?.vehicle_number || meta?.vehicle_number || "",
        chassis_number: app.chassis_number || parsedNotes?.chassis_number || ext?.chassis_number || meta?.chassis_number || "",
        vehicle_year: app.vehicle_year || parsedNotes?.vehicle_year || ext?.vehicle_year || meta?.vehicle_year || "",
      };
    });

    // Automatically resolve and backfill phone numbers, photos & vehicle plates into drivers table
    for (const dr of fetchedDrivers) {
      // Decode existing vehicle_code if encoded with ORANGE_META
      let metaEncoded: any = {};
      if (dr.vehicle_code && typeof dr.vehicle_code === "string" && dr.vehicle_code.startsWith("ORANGE_META:")) {
        try {
          metaEncoded = JSON.parse(dr.vehicle_code.replace("ORANGE_META:", ""));
          if (!dr.photo_url && metaEncoded.photo) dr.photo_url = metaEncoded.photo;
          if ((!dr.vehicle_number || dr.vehicle_number === "Unassigned") && metaEncoded.plate && metaEncoded.plate !== "Unassigned") {
            dr.vehicle_number = metaEncoded.plate;
          }
          if (!dr.vehicle_model && metaEncoded.model) dr.vehicle_model = metaEncoded.model;
          if (!dr.driver_type && metaEncoded.type) dr.driver_type = metaEncoded.type;
        } catch (e) {}
      }

      if (!dr.phone || dr.phone.trim() === "") {
        try {
          if (dr.user_id) {
            const { data: prof } = await supabase.from("profiles").select("phone").eq("id", dr.user_id).maybeSingle();
            if (prof?.phone && prof.phone.trim()) {
              dr.phone = prof.phone.trim();
              await supabase.from("drivers").update({ phone: dr.phone }).eq("id", dr.id);
            }
          }
          if (!dr.phone || dr.phone.trim() === "") {
            const matchingApp = mergedApps.find(app => app.full_name?.toLowerCase() === dr.full_name?.toLowerCase() && app.phone);
            if (matchingApp?.phone && matchingApp.phone.trim()) {
              dr.phone = matchingApp.phone.trim();
              await supabase.from("drivers").update({ phone: dr.phone }).eq("id", dr.id);
            }
          }
        } catch (err) {
          console.warn("Could not backfill driver phone in admin:", err);
        }
      }

      // Backfill driver photo, vehicle_number & driver_type from applications
      const matchingApp = mergedApps.find(
        app => (dr.phone && app.phone && app.phone.replace(/\D/g, "") === dr.phone.replace(/\D/g, "")) ||
               (app.full_name && dr.full_name && app.full_name.trim().toLowerCase() === dr.full_name.trim().toLowerCase())
      );
      if (matchingApp) {
        if (!dr.photo_url && matchingApp.photo_url) {
          dr.photo_url = matchingApp.photo_url;
        }
        if (!dr.driver_type) {
          dr.driver_type = matchingApp.driver_type || (matchingApp.owns_vehicle ? "partner" : "company");
        }
        if (!dr.chassis_number && matchingApp.chassis_number) {
          dr.chassis_number = matchingApp.chassis_number;
        }
        if ((!dr.vehicle_number || dr.vehicle_number === "Unassigned") && matchingApp.vehicle_number) {
          dr.vehicle_number = matchingApp.vehicle_number;
        }
        if (!dr.vehicle_model && matchingApp.vehicle_model) {
          dr.vehicle_model = matchingApp.vehicle_model;
        }
      }

      if (!dr.photo_url) {
        const storedPhoto = localStorage.getItem(`orange_driver_photo_${dr.id}`) ||
          (dr.user_id ? localStorage.getItem(`orange_driver_photo_${dr.user_id}`) : null) ||
          (dr.phone ? localStorage.getItem(`orange_driver_photo_by_phone_${dr.phone.replace(/\D/g, "")}`) : null) ||
          (dr.full_name ? localStorage.getItem(`orange_driver_photo_by_name_${dr.full_name.trim().toLowerCase()}`) : null);
        if (storedPhoto) dr.photo_url = storedPhoto;
      }

      // Persist resolved photo and vehicle data back to drivers table if missing
      const isPartnerDriver = dr.driver_type === "partner";
      if (!dr.vehicle_number || dr.vehicle_number === "Unassigned") {
        dr.vehicle_number = isPartnerDriver ? "KA 01 EV 4421" : "DL 01 EV 1001";
      }
      if (!dr.vehicle_model) {
        dr.vehicle_model = isPartnerDriver ? "Tata Nexon EV" : "Mahindra BE.6";
      }

      const metaObj = {
        photo: dr.photo_url || "",
        plate: dr.vehicle_number,
        model: dr.vehicle_model,
        type: dr.driver_type || (isPartnerDriver ? "partner" : "company"),
      };
      const updatedCode = "ORANGE_META:" + JSON.stringify(metaObj);

      try {
        await supabase.from("drivers").update({
          vehicle_number: dr.vehicle_number,
          vehicle_model: dr.vehicle_model,
          vehicle_code: updatedCode,
        }).eq("id", dr.id);
        dr.vehicle_code = updatedCode;
      } catch (err) {
        console.warn("Could not sync driver meta in admin:", err);
      }

      // Sync photos to localStorage for fast local access
      if (dr.photo_url) {
        try {
          localStorage.setItem(`orange_driver_photo_${dr.id}`, dr.photo_url);
          if (dr.user_id) localStorage.setItem(`orange_driver_photo_${dr.user_id}`, dr.photo_url);
          if (dr.phone) localStorage.setItem(`orange_driver_photo_by_phone_${dr.phone.replace(/\D/g, "")}`, dr.photo_url);
          if (dr.full_name) localStorage.setItem(`orange_driver_photo_by_name_${dr.full_name.trim().toLowerCase()}`, dr.photo_url);
        } catch (e) {}
      }
    }

    // Automatically snapshot and freeze vehicle registration numbers for existing completed rides
    fetchedBookings.forEach((booking) => {
      if (booking.driver_id && ["completed", "in_progress"].includes(booking.status)) {
        const dr = fetchedDrivers.find((x) => x.id === booking.driver_id);
        if (dr?.vehicle_number && dr.vehicle_number !== "Unassigned") {
          saveRideVehiclePlate(booking.id, dr.vehicle_number, booking.reference);
        }
      }
    });

    // Ensure approved driver applicants & partner operators exist in drivers panel
    for (const app of mergedApps) {
      if (app.status === "approved") {
        const isPartner = Boolean(app.owns_vehicle || app.driver_type === "partner");
        const alreadyExists = fetchedDrivers.some(
          dr => (dr.phone && app.phone && dr.phone.replace(/\D/g, "") === app.phone.replace(/\D/g, "")) ||
                (dr.full_name && app.full_name && dr.full_name.trim().toLowerCase() === app.full_name.trim().toLowerCase())
        );

        if (!alreadyExists) {
          const plate = app.vehicle_number || (isPartner ? "KA 01 EV 4421" : "DL 01 EV 1001");
          const model = app.vehicle_model || (isPartner ? "Tata Nexon EV" : "Mahindra BE.6");
          const photo = app.photo_url || "";
          const metaObj = {
            photo,
            plate,
            model,
            type: isPartner ? "partner" : "company",
          };
          const newDrRecord: any = {
            full_name: app.full_name,
            phone: app.phone || "",
            city: app.city || "Bengaluru",
            status: "active",
            vehicle_code: "ORANGE_META:" + JSON.stringify(metaObj),
            vehicle_number: plate,
            vehicle_model: model,
            rating: 5,
            total_rides: 0,
            is_online: false,
          };

          try {
            const { data: createdDr } = await supabase.from("drivers").insert(newDrRecord).select().maybeSingle();
            if (createdDr) {
              const fullCreatedDr: Driver = {
                ...createdDr,
                driver_type: isPartner ? "partner" : "company",
                photo_url: photo,
              };
              fetchedDrivers.push(fullCreatedDr);
              if (photo) {
                localStorage.setItem(`orange_driver_photo_${createdDr.id}`, photo);
              }
            } else {
              fetchedDrivers.push({
                id: "app-dr-" + app.id,
                ...newDrRecord,
                driver_type: isPartner ? "partner" : "company",
                photo_url: photo,
              });
            }
          } catch (e) {
            fetchedDrivers.push({
              id: "app-dr-" + app.id,
              ...newDrRecord,
              driver_type: isPartner ? "partner" : "company",
              photo_url: photo,
            });
          }
        }
      }
    }

    setBookings(fetchedBookings);
    setApplications(mergedApps);
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

  async function updateApplicationStatus(id: string, status: string, email?: string, appObj?: any) {
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

      // If partner driver bringing their own vehicle, automatically register in Partner Fleet
      const isPartner = Boolean(appObj?.owns_vehicle || appObj?.driver_type === "partner");
      if (isPartner && appObj?.vehicle_number) {
        await registerApprovedPartnerCar({
          plate_number: appObj.vehicle_number,
          chassis_number: appObj.chassis_number || "N/A",
          model: appObj.vehicle_model || "Mahindra BE.6",
          year: appObj.vehicle_year || "2024",
          owner_name: appObj.full_name,
          owner_phone: appObj.phone || "",
          owner_email: email,
        });
        toast.success(`Partner EV ${appObj.vehicle_number} added to Partner Fleet!`);
      }

      // Sync driver table record if driver exists
      if (appObj) {
        try {
          let { data: existingDr } = await supabase
            .from("drivers")
            .select("id, vehicle_number, vehicle_model, vehicle_code")
            .eq("full_name", appObj.full_name)
            .maybeSingle();

          if (!existingDr && appObj.phone) {
            const { data: byPhone } = await supabase
              .from("drivers")
              .select("id, vehicle_number, vehicle_model, vehicle_code")
              .eq("phone", appObj.phone)
              .maybeSingle();
            existingDr = byPhone;
          }

          const plate = appObj.vehicle_number || (isPartner ? "KA 01 EV 4421" : "DL 01 EV 1001");
          const model = appObj.vehicle_model || (isPartner ? "Tata Nexon EV" : "Mahindra BE.6");
          const photo = appObj.photo_url || "";
          const metaObj = {
            photo,
            plate,
            model,
            type: isPartner ? "partner" : "company",
          };

          const updates: any = {
            vehicle_code: "ORANGE_META:" + JSON.stringify(metaObj),
            vehicle_number: plate,
            vehicle_model: model,
          };
          if (appObj.phone) updates.phone = appObj.phone;

          if (existingDr) {
            await supabase.from("drivers").update(updates).eq("id", existingDr.id);
            if (photo) {
              localStorage.setItem(`orange_driver_photo_${existingDr.id}`, photo);
            }
          } else {
            // Auto-create driver record so they immediately appear in Drivers Panel
            const { data: createdDr } = await supabase.from("drivers").insert({
              full_name: appObj.full_name,
              phone: appObj.phone || "",
              city: appObj.city || "Bengaluru",
              status: "active",
              vehicle_code: updates.vehicle_code,
              vehicle_number: plate,
              vehicle_model: model,
              rating: 5,
              total_rides: 0,
              is_online: false,
            }).select().maybeSingle();

            if (createdDr && photo) {
              localStorage.setItem(`orange_driver_photo_${createdDr.id}`, photo);
            }
          }

          if (photo) {
            if (email) localStorage.setItem(`orange_driver_photo_by_email_${email.toLowerCase()}`, photo);
            if (appObj.phone) localStorage.setItem(`orange_driver_photo_by_phone_${appObj.phone.replace(/\D/g, "")}`, photo);
            if (appObj.full_name) localStorage.setItem(`orange_driver_photo_by_name_${appObj.full_name.trim().toLowerCase()}`, photo);
          }
        } catch (e) {
          console.warn("Could not sync driver on approval:", e);
        }
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
    const driver = drivers.find((d) => d.id === driverId);
    const booking = bookings.find((b) => b.id === bookingId);
    const resolvedDr = resolveDriverDetails(driver, booking);
    const plate = resolvedDr?.vehicle_number || (driver?.vehicle_number && driver.vehicle_number !== "Unassigned" ? driver.vehicle_number : "KA 01 EV 4421");

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
            <TabsTrigger value="commissions" className="gap-1.5 font-semibold">
              <Percent className="size-3.5 text-blue-600" /> Commission Ledger
            </TabsTrigger>
            <TabsTrigger value="gst" className="gap-1.5 font-semibold">
              <FileSpreadsheet className="size-3.5 text-amber-600" /> GST & Invoicing
            </TabsTrigger>
            <TabsTrigger value="drivers">Drivers</TabsTrigger>
            <TabsTrigger value="applications">Applications <CountBadge n={stats.pendingApplications} color="amber" /></TabsTrigger>
            <TabsTrigger value="enquiries">Enquiries <CountBadge n={stats.newEnquiries} color="blue" /></TabsTrigger>
          </TabsList>



          {/* BOOKINGS */}
          <TabsContent value="bookings">
            <div className="rounded-xl border border-border bg-background overflow-hidden">
              <div className="border-b border-border px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3 flex-wrap">
                  <h3 className="font-semibold">All Bookings</h3>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { id: "all", label: "All", count: bookings.length },
                      { id: "scheduled", label: "Scheduled Advance", count: bookings.filter(b => b.status === "scheduled").length, color: "text-purple-600 font-bold" },
                      { id: "active", label: "Live / Searching", count: bookings.filter(b => ["searching", "accepted", "arrived", "in_progress"].includes(b.status)).length },
                      { id: "completed", label: "Completed", count: bookings.filter(b => b.status === "completed").length },
                      { id: "cancelled", label: "Cancelled", count: bookings.filter(b => b.status === "cancelled").length },
                    ].map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => setBookingStatusFilter(f.id)}
                        className={`px-2.5 py-1 rounded-md text-xs transition-colors flex items-center gap-1 ${
                          bookingStatusFilter === f.id
                            ? "bg-primary text-primary-foreground font-bold shadow-xs"
                            : "bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        <span>{f.label}</span>
                        <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${bookingStatusFilter === f.id ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background text-foreground"}`}>{f.count}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={loadAll}>Refresh</Button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      {["Ref", "Route & Time", "Vehicle", "Fare", "Status", "Driver", "OTP", "Actions"].map(h => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {bookings
                      .filter(b => {
                        if (bookingStatusFilter === "scheduled") return b.status === "scheduled";
                        if (bookingStatusFilter === "active") return ["searching", "accepted", "arrived", "in_progress"].includes(b.status);
                        if (bookingStatusFilter === "completed") return b.status === "completed";
                        if (bookingStatusFilter === "cancelled") return b.status === "cancelled";
                        return true;
                      })
                      .map(b => (
                      <tr key={b.id} className="hover:bg-muted/30">
                        <td className="px-4 py-3 font-mono text-xs font-bold">{b.reference}</td>
                        <td className="px-4 py-3 text-xs">
                          <div className="font-medium text-foreground">{b.pickup_area} → {b.drop_area}</div>
                          {b.status === "scheduled" && (
                            <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-purple-700 dark:text-purple-300">
                              <Calendar className="size-3 text-purple-600" />
                              <span>{b.scheduled_at ? new Date(b.scheduled_at).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true }) : "Advance Booking"}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{b.vehicle_name}</td>
                        <td className="px-4 py-3 font-semibold text-primary">₹{Math.round(b.estimated_fare)}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[b.status] ?? "bg-muted text-muted-foreground"}`}>{b.status.replace("_", " ")}</span>
                        </td>
                        <td className="px-4 py-3">
                          {b.status === "searching" || (b.status === "scheduled" && !b.driver_id) ? (
                            <Select onValueChange={v => assignDriver(b.id, v)}>
                              <SelectTrigger className="h-7 w-48 text-xs">
                                <SelectValue placeholder={b.status === "scheduled" ? "Pre-assign Chauffeur" : "Assign driver"} />
                              </SelectTrigger>
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
                                    {d.phone && <span className="text-[11px] font-mono text-muted-foreground">📞 {d.phone}</span>}
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
                          {["searching", "scheduled", "accepted", "arrived", "in_progress"].includes(b.status) && (
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
              {applications.map(app => {
                const isPartner = Boolean(app.owns_vehicle || app.driver_type === "partner");

                return (
                  <div key={app.id} className="rounded-xl border border-border bg-background p-6">
                    <div className="flex items-start justify-between gap-4">
                      {/* Driver Photo & Information */}
                      <div className="flex items-start gap-4 flex-1">
                        {/* Driver Mandatory Photo Preview */}
                        <div className="relative shrink-0">
                          {app.photo_url ? (
                            <img
                              src={app.photo_url}
                              alt={app.full_name}
                              className="size-16 rounded-xl object-cover border-2 border-primary/40 shadow-sm"
                            />
                          ) : (
                            <div className="size-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                              {app.full_name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          <span
                            className="absolute -bottom-1 -right-1 size-4 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center text-[9px] text-white font-bold"
                            title="Submitted Driver Photo"
                          >
                            ✓
                          </span>
                        </div>

                        <div className="flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-bold text-base">{app.full_name}</h3>
                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[app.status] ?? "bg-muted text-muted-foreground"}`}>
                              {app.status}
                            </span>
                            {/* Operating Model Badge */}
                            {isPartner ? (
                              <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                <Handshake className="size-3" /> Partner Owner-Operator (15% Comm.)
                              </span>
                            ) : (
                              <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                <Building2 className="size-3" /> Company Fleet Driver (Fixed Salary)
                              </span>
                            )}
                          </div>

                          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-muted-foreground lg:grid-cols-4">
                            <span>📧 {app.email}</span>
                            <span>📞 {app.phone}</span>
                            <span>📍 {app.city}</span>
                            <span>🪪 {app.licence_number}</span>
                            <span>🚗 {app.experience_years} yrs experience</span>
                            <span>{isPartner ? "⚡ Brings Own EV" : "🏢 Company EV"}</span>
                            <span>📅 {new Date(app.created_at).toLocaleDateString()}</span>
                          </div>

                          {/* Vehicle Details for Partner */}
                          {isPartner && (app.vehicle_number || app.vehicle_model || app.chassis_number) && (
                            <div className="mt-3 rounded-lg bg-muted/40 border border-border p-3 text-xs flex flex-wrap items-center gap-x-4 gap-y-1.5">
                              <span className="text-muted-foreground font-semibold flex items-center gap-1">
                                <Car className="size-3.5 text-primary" /> Partner EV:
                              </span>
                              <span>Model: <strong className="text-foreground">{app.vehicle_model || "Mahindra BE.6"}</strong></span>
                              {app.vehicle_year && <span>Year: <strong className="text-foreground">{app.vehicle_year}</strong></span>}
                              {app.vehicle_number && <span>Reg Plate: <strong className="font-mono text-primary uppercase">{app.vehicle_number}</strong></span>}
                              {app.chassis_number && <span>Chassis (VIN): <strong className="font-mono text-foreground uppercase">{app.chassis_number}</strong></span>}
                            </div>
                          )}

                          {app.message && <p className="mt-3 rounded-lg bg-muted p-3 text-xs leading-5">{app.message}</p>}
                        </div>
                      </div>

                      <div className="flex shrink-0 items-center gap-2 flex-wrap">
                        {app.phone && (
                          <div className="flex items-center gap-1.5">
                            <a
                              href={`tel:${app.phone.replace(/\s+/g, '')}`}
                              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors shadow-xs"
                              title={`Call ${app.full_name} (${app.phone})`}
                            >
                              <PhoneCall className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>Call</span>
                            </a>
                            <a
                              href={`https://api.whatsapp.com/send?phone=${app.phone.replace(/\D/g, '')}&text=${encodeURIComponent(
                                `Hello ${app.full_name}, this is Orange Taxi Fleet Operations regarding your driver application.`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-xs font-semibold transition-colors shadow-xs"
                              title={`Chat with ${app.full_name} on WhatsApp`}
                            >
                              <MessageSquare className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                              <span>WhatsApp</span>
                            </a>
                          </div>
                        )}

                        {app.status === "approved" && (
                          <button
                            type="button"
                            onClick={() => setActiveTab("drivers")}
                            className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400 hover:underline font-semibold"
                          >
                            <span>✓ In Fleet (View in Drivers →)</span>
                          </button>
                        )}

                        {app.status === "new" && (
                          <div className="flex gap-2">
                            <Button size="sm" variant="ghost" className="text-destructive hover:bg-destructive/10"
                              onClick={() => updateApplicationStatus(app.id, "rejected")}>
                              <X className="size-4" /> Reject
                            </Button>
                            <Button size="sm" onClick={() => updateApplicationStatus(app.id, "approved", app.email, app)}>
                              <CheckCircle className="size-4" /> Approve
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
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
            <DriverAnalyticsPanel
              drivers={drivers}
              bookings={bookings}
              onRefresh={loadAll}
              onNavigateTab={(tab) => {
                setActiveTab(tab);
                navigate({ to: "/admin", search: { tab }, replace: true });
              }}
            />
          </TabsContent>

          {/* FLEET & BAYS */}
          <TabsContent value="fleet">
            <FleetManager drivers={drivers} onRefresh={loadAll} />
          </TabsContent>

          {/* CASH SETTLEMENTS */}
          <TabsContent value="cash">
            <CashSettlementManager drivers={drivers} bookings={bookings} onRefresh={loadAll} />
          </TabsContent>

          {/* COMMISSION LEDGER */}
          <TabsContent value="commissions">
            <TabErrorBoundary tabName="Commission Ledger" onRetry={loadAll}>
              <CommissionLedgerManager drivers={drivers} bookings={bookings} onRefresh={loadAll} />
            </TabErrorBoundary>
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

function isCommissionDriver(d: Driver): boolean {
  if (d.driver_type === "partner") return true;
  if (d.driver_type === "company") return false;
  if ((d as any).owns_vehicle) return true;
  if (d.vehicle_code && typeof d.vehicle_code === "string") {
    if (d.vehicle_code.includes('"type":"partner"')) return true;
    if (d.vehicle_code.includes('"type":"company"')) return false;
  }
  if (typeof window !== "undefined") {
    try {
      const pCars = JSON.parse(localStorage.getItem("orange_partner_vehicles") || "[]");
      if (pCars.some((pv: any) =>
        (d.id && pv.driver_id === d.id) ||
        (d.phone && pv.owner_phone && pv.owner_phone.replace(/\D/g, "") === d.phone.replace(/\D/g, "")) ||
        (d.full_name && pv.owner_name && pv.owner_name.toLowerCase() === d.full_name.toLowerCase())
      )) {
        return true;
      }
    } catch (e) {}

    try {
      const extApps = JSON.parse(localStorage.getItem("orange_extended_apps") || "[]");
      if (extApps.some((ea: any) =>
        (ea.owns_vehicle || ea.driver_type === "partner") &&
        ((d.phone && ea.phone && ea.phone.replace(/\D/g, "") === d.phone.replace(/\D/g, "")) ||
         (d.full_name && ea.full_name && ea.full_name.toLowerCase() === d.full_name.toLowerCase()))
      )) {
        return true;
      }
    } catch (e) {}
  }
  return false;
}

function DriverAnalyticsPanel({
  drivers,
  bookings,
  onRefresh,
  onNavigateTab
}: {
  drivers: Driver[];
  bookings: any[];
  onRefresh: () => void;
  onNavigateTab?: (tab: string) => void;
}) {
  const [search, setSearch] = useState("");
  const [driverSegment, setDriverSegment] = useState<"company" | "commission" | "all">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null);
  const [editingPartnerVehicleId, setEditingPartnerVehicleId] = useState<string | null>(null);
  const [partnerPlateInput, setPartnerPlateInput] = useState("");
  const [partnerModelInput, setPartnerModelInput] = useState("");
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

    const assigned = {
      ...vehicle,
      status: "assigned",
      assigned_driver_id: driver.id,
      assigned_at: new Date().toISOString()
    };
    await updateFleetVehicleInDbOrLocal(assigned);

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

  async function updatePartnerVehicle(driver: Driver, plate: string, model: string) {
    if (!plate || !plate.trim()) {
      toast.error("Please enter a valid EV registration number");
      return;
    }
    const cleanPlate = plate.trim().toUpperCase();
    const cleanModel = model.trim() || "Tata Nexon EV";

    const metaObj = {
      photo: driver.photo_url || "",
      plate: cleanPlate,
      model: cleanModel,
      type: "partner",
    };
    const updatedCode = "ORANGE_META:" + JSON.stringify(metaObj);

    const { error } = await supabase.from("drivers").update({
      vehicle_number: cleanPlate,
      vehicle_model: cleanModel,
      vehicle_code: updatedCode,
    }).eq("id", driver.id);

    if (error) {
      toast.error("Could not update partner vehicle: " + error.message);
    } else {
      try {
        const pCars = JSON.parse(localStorage.getItem("orange_partner_vehicles") || "[]");
        const idx = pCars.findIndex((c: any) => c.driver_id === driver.id || c.plate_number === cleanPlate);
        if (idx >= 0) {
          pCars[idx].plate_number = cleanPlate;
          pCars[idx].model = cleanModel;
        } else {
          pCars.unshift({
            id: "car-pv-" + Date.now(),
            plate_number: cleanPlate,
            model: cleanModel,
            owner_name: driver.full_name,
            owner_phone: driver.phone || "",
            driver_id: driver.id,
            status: "active",
            is_ev: true,
            created_at: new Date().toISOString()
          });
        }
        localStorage.setItem("orange_partner_vehicles", JSON.stringify(pCars));
      } catch (e) {}

      toast.success(`Partner EV updated to ${cleanPlate} (${cleanModel})!`);
      setEditingPartnerVehicleId(null);
      onRefresh();
    }
  }

  async function switchDriverType(driver: Driver, targetType: "company" | "partner") {
    const isPartner = targetType === "partner";
    let targetPlate = driver.vehicle_number;
    let targetModel = driver.vehicle_model;

    if (isPartner) {
      if (!targetPlate || targetPlate === "Unassigned") {
        const p = prompt(`Enter Partner EV Registration Plate for ${driver.full_name}:`, "KA 01 EV 4421");
        if (p === null) return;
        targetPlate = p.trim().toUpperCase() || "KA 01 EV 4421";
      }
      if (!targetModel) targetModel = "Tata Nexon EV";
    } else {
      targetPlate = "Unassigned";
      targetModel = "Mahindra BE.6";
    }

    const metaObj = {
      photo: driver.photo_url || "",
      plate: targetPlate,
      model: targetModel,
      type: targetType,
    };
    const updatedCode = "ORANGE_META:" + JSON.stringify(metaObj);

    const { error } = await supabase.from("drivers").update({
      vehicle_number: targetPlate,
      vehicle_model: targetModel,
      vehicle_code: updatedCode,
    }).eq("id", driver.id);

    if (error) {
      toast.error("Could not update driver classification: " + error.message);
    } else {
      if (isPartner) {
        try {
          const pCars = JSON.parse(localStorage.getItem("orange_partner_vehicles") || "[]");
          if (!pCars.some((c: any) => c.plate_number === targetPlate)) {
            pCars.unshift({
              id: "car-pv-" + Date.now(),
              plate_number: targetPlate,
              model: targetModel,
              owner_name: driver.full_name,
              owner_phone: driver.phone || "",
              driver_id: driver.id,
              status: "active",
              is_ev: true,
              created_at: new Date().toISOString()
            });
            localStorage.setItem("orange_partner_vehicles", JSON.stringify(pCars));
          }
        } catch (e) {}
      }
      toast.success(`${driver.full_name} is now classified as ${isPartner ? "Commission Based Driver (Partner)" : "Company Owned Driver (Fleet)"}!`);
      onRefresh();
    }
  }

  const allCompanyDrivers = drivers.filter(d => !isCommissionDriver(d));
  const allCommissionDrivers = drivers.filter(d => isCommissionDriver(d));

  const filtered = drivers.filter(d =>
    d.full_name.toLowerCase().includes(search.toLowerCase()) ||
    d.city?.toLowerCase().includes(search.toLowerCase()) ||
    d.vehicle_number?.toLowerCase().includes(search.toLowerCase()) ||
    d.phone?.includes(search)
  );

  const filteredCompanyDrivers = filtered.filter(d => !isCommissionDriver(d));
  const filteredCommissionDrivers = filtered.filter(d => isCommissionDriver(d));

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

  function renderDriverCard(d: Driver) {
    const isPartner = isCommissionDriver(d);
    const stats = driverStats(d.id);
    const isExpanded = expanded === d.id;
    const isEditingVehicle = editingVehicleId === d.id;
    const isEditingPartnerVehicle = editingPartnerVehicleId === d.id;
    const rides = driverBookings(d.id);

    return (
      <div key={d.id} className="rounded-xl border border-border bg-background overflow-hidden shadow-xs hover:border-primary/40 transition-colors">
        {/* Driver header */}
        <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="relative size-11 shrink-0">
              {d.photo_url ? (
                <img
                  src={d.photo_url}
                  alt={d.full_name}
                  className="size-11 rounded-full object-cover border-2 border-primary/40 shadow-xs"
                />
              ) : (
                <div className="grid size-11 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary border border-primary/20">
                  {d.full_name.charAt(0).toUpperCase()}
                </div>
              )}
              <span
                className={`absolute -bottom-0.5 -right-0.5 size-3.5 rounded-full border-2 border-background ${
                  d.is_online ? "bg-emerald-500" : "bg-muted-foreground"
                }`}
                title={d.is_online ? "Online & Ready" : "Offline"}
              />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="font-bold text-base text-foreground">{d.full_name}</p>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d.is_online ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>
                  {d.is_online ? "● Online" : "Offline"}
                </span>
                {isPartner ? (
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-bold flex items-center gap-1">
                    <Handshake className="size-3" /> Commission Partner (15%)
                  </span>
                ) : (
                  <span className="rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 text-[11px] font-bold flex items-center gap-1">
                    <Building2 className="size-3" /> Company Fleet (Fixed Salary)
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-medium">{d.city || "Bengaluru"}</span>
                <span className="text-muted-foreground text-xs">·</span>
                {isPartner ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <Car className="size-3" />
                    <span>{d.vehicle_model || "Tata Nexon EV"}</span>
                    <span className="font-mono font-bold uppercase">
                      {d.vehicle_number && d.vehicle_number !== "Unassigned" ? d.vehicle_number : "KA 01 EV 4421"}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <Car className="size-3" />
                    <span>{d.vehicle_model || "Mahindra BE.6"}</span>
                    <span className="font-mono font-bold">
                      {d.vehicle_number && d.vehicle_number !== "Unassigned" ? d.vehicle_number : "⚠️ No car assigned"}
                    </span>
                  </span>
                )}
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

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Direct Connect Options: Call & WhatsApp */}
            {d.phone && d.phone.trim() ? (
              <div className="flex items-center gap-1.5">
                <a
                  href={`tel:${d.phone.replace(/\s+/g, '')}`}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-emerald-500/40 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 text-xs font-bold transition-colors shadow-xs"
                  title={`Call ${d.full_name} (${d.phone})`}
                >
                  <PhoneCall className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Call</span>
                </a>
                <a
                  href={`https://api.whatsapp.com/send?phone=${d.phone.replace(/\D/g, '')}&text=${encodeURIComponent(
                    `Hello ${d.full_name}, this is Orange Taxi Fleet Operations regarding your driver account.`
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-emerald-500/40 bg-emerald-500/10 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300 text-xs font-bold transition-colors shadow-xs"
                  title={`Chat with ${d.full_name} on WhatsApp`}
                >
                  <MessageSquare className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>WhatsApp</span>
                </a>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  const newPhone = prompt(`Enter phone number for ${d.full_name} to connect:`);
                  if (newPhone !== null && newPhone.trim() !== "") {
                    supabase.from("drivers").update({ phone: newPhone.trim() }).eq("id", d.id).then(({ error }) => {
                      if (error) toast.error("Could not update phone: " + error.message);
                      else {
                        toast.success("Phone saved! You can now call or WhatsApp this driver.");
                        onRefresh();
                      }
                    });
                  }
                }}
                className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-medium text-muted-foreground transition-colors"
                title="Add phone number to enable direct Call & WhatsApp"
              >
                <Phone className="size-3.5" />
                <span>Connect (Add Phone)</span>
              </button>
            )}

            {isPartner ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 border-emerald-500/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/10"
                  onClick={() => {
                    setEditingPartnerVehicleId(isEditingPartnerVehicle ? null : d.id);
                    setPartnerPlateInput(d.vehicle_number && d.vehicle_number !== "Unassigned" ? d.vehicle_number : "KA 01 EV 4421");
                    setPartnerModelInput(d.vehicle_model || "Tata Nexon EV");
                  }}
                >
                  <Car className="size-3.5" />
                  {isEditingPartnerVehicle ? "Close" : "Edit Partner EV"}
                </Button>
                {onNavigateTab && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs gap-1.5 border-border hover:bg-muted text-muted-foreground hover:text-foreground"
                    onClick={() => onNavigateTab("commissions")}
                  >
                    <Percent className="size-3.5 text-emerald-600" />
                    Commission Ledger
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => {
                    if (confirm(`Switch ${d.full_name} from Commission Partner to Company Fleet Driver?`)) {
                      switchDriverType(d, "company");
                    }
                  }}
                  title="Convert to Company Fleet (Fixed Salary) Driver"
                >
                  ⇄ To Company Fleet
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => setEditingVehicleId(isEditingVehicle ? null : d.id)}
                >
                  <Car className="size-3.5" />
                  {isEditingVehicle ? "Close" : (d.vehicle_number && d.vehicle_number !== "Unassigned" ? "Change Vehicle" : "Assign Daily Vehicle")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-muted-foreground hover:text-emerald-600"
                  onClick={() => {
                    if (confirm(`Switch ${d.full_name} from Company Fleet to Commission Based Driver (Partner)?`)) {
                      switchDriverType(d, "partner");
                    }
                  }}
                  title="Convert to Commission Based Driver (Partner Owner-Operator)"
                >
                  ⇄ To Commission Driver
                </Button>
              </>
            )}

            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              onClick={async () => {
                await supabase.from("drivers").update({ status: d.status === "active" ? "inactive" : "active" }).eq("id", d.id);
                onRefresh();
              }}
            >
              {d.status === "active" ? "Deactivate" : "Activate"}
            </Button>
            <button
              onClick={() => setExpanded(isExpanded ? null : d.id)}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors"
            >
              {isExpanded ? <><ChevronUp className="size-3" /> Hide</> : <><ChevronDown className="size-3" /> View Analytics</>}
            </button>
          </div>
        </div>

        {/* Inline Partner Vehicle Editor */}
        {isPartner && isEditingPartnerVehicle && (
          <div className="border-t border-border bg-emerald-500/5 p-5 animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Car className="size-4" /> Partner EV Registration — {d.full_name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Commission drivers operate their own verified Orange EV. Updates plate & vehicle model across customer bookings and live tracking instantly.
                </p>
              </div>
              <button onClick={() => setEditingPartnerVehicleId(null)} className="text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background p-4 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-4">
                  <label className="text-[11px] uppercase font-bold text-foreground">Partner EV Model</label>
                  <input
                    value={partnerModelInput}
                    onChange={(e) => setPartnerModelInput(e.target.value)}
                    placeholder="e.g. Tata Nexon EV, Mahindra BE.6"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="text-[11px] uppercase font-bold text-foreground">EV Plate Number (Registration)</label>
                  <input
                    value={partnerPlateInput}
                    onChange={(e) => setPartnerPlateInput(e.target.value)}
                    placeholder="e.g. KA 01 EV 4421"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono font-bold uppercase outline-none focus:border-primary"
                  />
                </div>
                <div className="sm:col-span-3">
                  <Button
                    size="sm"
                    className="w-full h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    onClick={() => updatePartnerVehicle(d, partnerPlateInput, partnerModelInput)}
                  >
                    <Check className="size-3.5" /> Save Partner EV
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Company Daily Vehicle Assignment Form */}
        {!isPartner && isEditingVehicle && (() => {
          const bayVehicles = fleetVehicles.filter(v => v.status === "in_bay");

          return (
            <div className="border-t border-border bg-primary/5 p-5 animate-in fade-in slide-in-from-top-2">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                    <Car className="size-4" /> Daily Vehicle Allocation — {d.full_name}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Select an available vehicle from the fleet bay. Updates customer booking screens & driver console in real-time.
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
        <div className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: "Total Rides", value: stats.count },
            { label: "Gross Earned", value: `₹${Math.round(stats.total)}` },
            { label: "UPI", value: `₹${Math.round(stats.upi)}`, color: "text-blue-600" },
            { label: "Cash Collected", value: `₹${Math.round(stats.cash)}`, color: "text-green-600" },
            {
              label: isPartner ? "15% Company Comm." : "Today's Rides",
              value: isPartner ? `₹${Math.round(stats.total * 0.15)}` : stats.todayCount,
              color: isPartner ? "text-emerald-600 font-extrabold" : ""
            },
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
            <div className="px-6 py-3 bg-muted/30 flex items-center justify-between">
              <p className="text-xs font-bold uppercase text-muted-foreground">Ride History ({rides.length} completed)</p>
              {isPartner && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  Partner Keeps 85% · Company Receives 15%
                </span>
              )}
            </div>
            {rides.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted-foreground">No completed rides yet.</p>
            ) : (
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {rides.slice(0, 50).map(b => {
                  const ridePlate = getBookingVehiclePlate(b, d);
                  const fare = Math.round(b.final_fare ?? b.estimated_fare);
                  const comm = Math.round(fare * 0.15);
                  const driverNet = fare - comm;

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
                      <div className="flex items-center gap-2.5 shrink-0 text-right">
                        {isPartner && (
                          <div className="text-right text-[11px] hidden sm:block">
                            <span className="text-emerald-600 font-semibold">Driver: ₹{driverNet}</span>
                            <span className="text-muted-foreground text-[10px] block">Comm: ₹{comm}</span>
                          </div>
                        )}
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${b.payment_method === "upi" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}>
                          {b.payment_method?.toUpperCase()}
                        </span>
                        <span className="font-bold text-primary">₹{fare}</span>
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
  }

  return (
    <div className="space-y-6">
      {/* Division Navigation Pills */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3">
        <div className="flex items-center gap-1.5 p-1 bg-muted/70 rounded-xl border border-border">
          <button
            type="button"
            onClick={() => setDriverSegment("company")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              driverSegment === "company"
                ? "bg-background text-foreground shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Building2 className="size-3.5 text-blue-600" />
            <span>Company Owned Drivers</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              driverSegment === "company" ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300" : "bg-muted text-muted-foreground"
            }`}>
              {allCompanyDrivers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDriverSegment("commission")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              driverSegment === "commission"
                ? "bg-background text-foreground shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Handshake className="size-3.5 text-emerald-600" />
            <span>Commission Based Drivers</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              driverSegment === "commission" ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"
            }`}>
              {allCommissionDrivers.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setDriverSegment("all")}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
              driverSegment === "all"
                ? "bg-background text-foreground shadow-xs border border-border"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="size-3.5 text-foreground" />
            <span>All Drivers</span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              driverSegment === "all" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
            }`}>
              {drivers.length}
            </span>
          </button>
        </div>

        {/* Legend */}
        <div className="text-xs text-muted-foreground hidden md:flex items-center gap-4">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-blue-500" />
            <strong>Company Fleet:</strong> Fixed Salary · Daily Bay Allocation
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-full bg-emerald-500" />
            <strong>Commission Partner:</strong> 15% Platform Split · Own EV
          </span>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder="Search by driver name, phone, city, or EV number plate..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        {search && (
          <button onClick={() => setSearch("")} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* VIEW: COMPANY OWNED DRIVERS ONLY */}
      {driverSegment === "company" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-blue-900 dark:text-blue-200 flex items-center gap-2">
                  <Building2 className="size-5 text-blue-600" /> Company Owned Drivers (Fixed Salary Fleet)
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Full-time salaried chauffeurs operating company-owned Mahindra BE.6 EVs. Vehicles are allocated daily from company charging bays.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="rounded-xl border border-border bg-background px-3 py-1.5 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Employed</p>
                  <p className="text-sm font-bold text-foreground">{allCompanyDrivers.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-1.5 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Online</p>
                  <p className="text-sm font-bold text-emerald-600">{allCompanyDrivers.filter(d => d.is_online).length}</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-1.5 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Car Assigned</p>
                  <p className="text-sm font-bold text-blue-600">
                    {allCompanyDrivers.filter(d => d.vehicle_number && d.vehicle_number !== "Unassigned").length}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {filteredCompanyDrivers.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No company owned drivers matching your search.</p>
          ) : (
            <div className="space-y-4">
              {filteredCompanyDrivers.map(d => renderDriverCard(d))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: COMMISSION BASED DRIVERS ONLY */}
      {driverSegment === "commission" && (
        <div className="space-y-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h3 className="text-base font-bold text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <Handshake className="size-5 text-emerald-600" /> Commission Based Drivers (Partner Owner-Operators)
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Independent driver-partners bringing their own EV. Operates on a 15% platform commission model with their verified vehicle plate.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="rounded-xl border border-border bg-background px-3 py-1.5 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Partners</p>
                  <p className="text-sm font-bold text-foreground">{allCommissionDrivers.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-1.5 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Online</p>
                  <p className="text-sm font-bold text-emerald-600">{allCommissionDrivers.filter(d => d.is_online).length}</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-1.5 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Comm. Split</p>
                  <p className="text-sm font-bold text-emerald-600">85% / 15%</p>
                </div>
                {onNavigateTab && (
                  <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9" onClick={() => onNavigateTab("commissions")}>
                    Open Ledger →
                  </Button>
                )}
              </div>
            </div>
          </div>

          {filteredCommissionDrivers.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">No commission based drivers matching your search.</p>
          ) : (
            <div className="space-y-4">
              {filteredCommissionDrivers.map(d => renderDriverCard(d))}
            </div>
          )}
        </div>
      )}

      {/* VIEW: ALL DRIVERS DIVIDED INTO TWO CLEAR SECTIONS */}
      {driverSegment === "all" && (
        <div className="space-y-8">
          {/* Section 1: Company Owned Drivers */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-blue-500/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Building2 className="size-5 text-blue-600" />
                <h3 className="font-bold text-base text-foreground">
                  Company Owned Drivers <span className="text-sm font-normal text-muted-foreground">(Fixed Salary Fleet · {filteredCompanyDrivers.length})</span>
                </h3>
              </div>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                Company Fleet
              </span>
            </div>

            {filteredCompanyDrivers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No company drivers in this view.</p>
            ) : (
              <div className="space-y-4">
                {filteredCompanyDrivers.map(d => renderDriverCard(d))}
              </div>
            )}
          </div>

          {/* Section 2: Commission Based Drivers */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Handshake className="size-5 text-emerald-600" />
                <h3 className="font-bold text-base text-foreground">
                  Commission Based Drivers <span className="text-sm font-normal text-muted-foreground">(Partner Owner-Operators · {filteredCommissionDrivers.length})</span>
                </h3>
              </div>
              <div className="flex items-center gap-2">
                {onNavigateTab && (
                  <button
                    type="button"
                    onClick={() => onNavigateTab("commissions")}
                    className="text-xs text-emerald-600 hover:underline font-semibold flex items-center gap-1"
                  >
                    View Commission Ledger →
                  </button>
                )}
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-0.5 rounded-full border border-emerald-500/20">
                  15% Commission
                </span>
              </div>
            </div>

            {filteredCommissionDrivers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">No commission drivers in this view.</p>
            ) : (
              <div className="space-y-4">
                {filteredCommissionDrivers.map(d => renderDriverCard(d))}
              </div>
            )}
          </div>
        </div>
      )}
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
