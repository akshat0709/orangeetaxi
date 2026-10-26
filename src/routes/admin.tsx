import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  BriefcaseBusiness,
  Calendar,
  Car,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Download,
  FileSpreadsheet,
  Loader2,
  Maximize2,
  ParkingSquare,
  Phone,
  PhoneCall,
  MessageSquare,
  RefreshCw,
  RotateCw,
  Search,
  Users,
  X,
  Zap,
  ZoomIn,
  ZoomOut,
  Building2,
  Handshake,
  Percent,
} from "lucide-react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { FleetManager, registerApprovedPartnerCar } from "@/components/fleet-manager";
import { CashSettlementManager } from "@/components/cash-settlement-manager";
import { CommissionLedgerManager } from "@/components/commission-ledger-manager";
import { GSTAccountingManager } from "@/components/gst-accounting-manager";
import { PricingManager } from "@/components/pricing-manager";
import { SupportManager } from "@/components/support-manager";
import { CancellationFeesManager } from "@/components/cancellation-fees-manager";
import { usePricingSettings } from "@/lib/pricing";
import { isCommissionDriver as isPartnerDriverType } from "@/lib/driver-type";
import { TabErrorBoundary } from "@/components/tab-error-boundary";
import { LiveDriversMap } from "@/components/live-drivers-map";
import {
  getBookingVehiclePlate,
  lockBookingVehicle,
  resolveDriverDetails,
} from "@/lib/ride-vehicle";

const GOOGLE_MAPS_KEY = import.meta.env["VITE_GOOGLE_MAPS_API_KEY"] || "";

// Haversine distance formula (returns km)
function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function formatVehicleDisplay(name?: string): string {
  if (!name) return "Orange Signature";
  if (name.toLowerCase().includes("rental")) {
    const match = name.match(/\((\d+h\s*Rental)\)/i);
    return match ? `Orange Signature (${match[1]})` : "Orange Signature (Rental)";
  }
  return "Orange Signature";
}

export const Route = createFileRoute("/admin")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: typeof search["tab"] === "string" ? search["tab"] : "hub",
  }),
  head: () => ({ meta: [{ title: "Admin — Orange Taxi" }] }),
  component: AdminPage,
});

interface Booking {
  id: string;
  reference: string;
  status: string;
  pickup_area: string;
  drop_area: string;
  estimated_fare: number;
  vehicle_name: string;
  payment_method: string;
  created_at: string;
  driver_id: string | null;
  customer_id: string;
  ride_otp: string;
  scheduled_at?: string | null;
  final_fare?: number | null;
  pickup_address?: string | null;
}
interface Application {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  city: string;
  licence_number: string;
  experience_years: number;
  owns_vehicle: boolean;
  message: string;
  status: string;
  admin_notes: string;
  created_at: string;
  photo_url?: string;
  driver_type?: string;
  vehicle_model?: string;
  vehicle_number?: string;
  chassis_number?: string;
  vehicle_year?: string;
  aadhaar_number?: string;
  dl_url?: string;
}
interface Enquiry {
  id: string;
  company_name: string;
  contact_name: string;
  email: string;
  phone: string;
  city: string;
  team_size: string;
  requirement: string;
  message: string;
  status: string;
  created_at: string;
}
interface Driver {
  id: string;
  full_name: string;
  phone: string;
  city: string;
  is_online: boolean;
  rating: number;
  total_rides: number;
  status: string;
  vehicle_model: string;
  vehicle_number: string;
  vehicle_code?: string;
  driver_type?: string;
  photo_url?: string;
  chassis_number?: string;
  user_id?: string;
  current_lat?: number | null;
  current_lng?: number | null;
}

function formatCompactArea(addr?: string | null): string {
  if (!addr) return "—";
  const parts = addr.split(",");
  if (parts.length <= 2) return addr.trim();
  return `${(parts[0] ?? "").trim()}, ${(parts[1] ?? "").trim()}`;
}

function sanitizeDocumentUrl(url?: string | null): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (
    trimmed.startsWith("https://") ||
    trimmed.startsWith("http://") ||
    trimmed.startsWith("storage://") ||
    trimmed.startsWith("data:image/jpeg;base64,") ||
    trimmed.startsWith("data:image/png;base64,") ||
    trimmed.startsWith("data:image/webp;base64,") ||
    trimmed.startsWith("data:application/pdf;base64,")
  ) {
    return trimmed;
  }
  return null;
}

async function resolveKycDocumentUrl(url?: string | null): Promise<string | null> {
  if (!url || typeof url !== "string") return null;
  const clean = sanitizeDocumentUrl(url);
  if (!clean) return null;
  if (clean.startsWith("storage://")) {
    const withoutPrefix = clean.replace("storage://", "");
    const slashIdx = withoutPrefix.indexOf("/");
    if (slashIdx !== -1) {
      const bucket = withoutPrefix.slice(0, slashIdx);
      const filePath = withoutPrefix.slice(slashIdx + 1);
      try {
        const { data, error } = await supabase.storage.from(bucket).createSignedUrl(filePath, 3600);
        if (!error && data?.signedUrl) {
          return data.signedUrl;
        }
      } catch (err) {
        console.error("Failed to generate signed KYC URL:", err);
      }
    }
    return null;
  }
  return clean;
}

function KycDocPreview({
  src,
  alt,
  className,
  fallbackText = "Document",
}: {
  src?: string | null;
  alt: string;
  className?: string;
  fallbackText?: string;
}) {
  const [resolvedSrc, setResolvedSrc] = useState<string | null>(() => {
    if (src && !src.startsWith("storage://")) return sanitizeDocumentUrl(src);
    return null;
  });

  useEffect(() => {
    let active = true;
    if (!src) {
      setResolvedSrc(null);
      return;
    }
    if (src.startsWith("storage://")) {
      resolveKycDocumentUrl(src).then((res) => {
        if (active) setResolvedSrc(res);
      });
    } else {
      setResolvedSrc(sanitizeDocumentUrl(src));
    }
    return () => {
      active = false;
    };
  }, [src]);

  if (!resolvedSrc) {
    return (
      <div
        className={`flex items-center justify-center bg-muted text-muted-foreground text-xs font-medium ${className}`}
      >
        {fallbackText}
      </div>
    );
  }

  return <img src={resolvedSrc} alt={alt} className={className} />;
}

const STATUS_BADGE: Record<string, string> = {
  scheduled: "bg-primary/10 text-primary border border-primary/20",
  searching: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20",
  accepted: "bg-primary/10 text-primary border border-primary/20",
  arrived: "bg-primary/10 text-primary border border-primary/20",
  in_progress: "bg-primary/10 text-primary border border-primary/20",
  completed:
    "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  cancelled: "bg-destructive/10 text-destructive border border-destructive/20",
  new: "bg-muted text-muted-foreground border border-border",
  reviewed: "bg-muted text-foreground border border-border",
  approved: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  rejected: "bg-destructive/10 text-destructive border border-destructive/20",
  contacted: "bg-primary/10 text-primary border border-primary/20",
};

function AdminPage() {
  const commissionPct = usePricingSettings().partner_commission_percent;
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const search = Route.useSearch();

  const [activeTab, setActiveTab] = useState(() => search?.tab || "hub");
  const [bookingStatusFilter, setBookingStatusFilter] = useState("all");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loadedTabs, setLoadedTabs] = useState<Record<string, boolean>>({});
  const [tabLoading, setTabLoading] = useState(false);
  const [summaryCounts, setSummaryCounts] = useState({
    totalBookings: 0,
    activeBookings: 0,
    completedBookings: 0,
    totalRevenue: 0,
    onlineDrivers: 0,
    totalDrivers: 0,
    pendingApplications: 0,
    newEnquiries: 0,
  });
  const [bookingSearch, setBookingSearch] = useState("");
  const [bookingDateFilter, setBookingDateFilter] = useState("all");
  const [appSearch, setAppSearch] = useState("");
  const [appStatusFilter, setAppStatusFilter] = useState("all");
  const [autoRefreshRate, setAutoRefreshRate] = useState(0); // 0 = off, 15, 30, 60
  const [lightboxDoc, setLightboxDoc] = useState<{
    isOpen: boolean;
    title: string;
    url: string;
    app?: Application | undefined;
    zoom: number;
    rotation: number;
  }>({
    isOpen: false,
    title: "",
    url: "",
    app: undefined,
    zoom: 1,
    rotation: 0,
  });

  async function openLightbox(title: string, url: string, app?: Application) {
    const resolvedUrl = (await resolveKycDocumentUrl(url)) || url;
    setLightboxDoc({
      isOpen: true,
      title,
      url: resolvedUrl,
      app,
      zoom: 1,
      rotation: 0,
    });
  }

  function closeLightbox() {
    setLightboxDoc((prev) => ({ ...prev, isOpen: false }));
  }

  function matchesDateFilter(dateStr?: string | null, filter = "all"): boolean {
    if (filter === "all" || !dateStr) return true;
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return true;

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (filter === "today") {
      return d >= startOfToday;
    }
    if (filter === "yesterday") {
      const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
      return d >= startOfYesterday && d < startOfToday;
    }
    if (filter === "week") {
      const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      return d >= startOfWeek;
    }
    if (filter === "month") {
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      return d >= startOfMonth;
    }
    return true;
  }

  function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]) {
    const escapeCsv = (val: string | number) => {
      const str = String(val ?? "");
      if (str.includes(",") || str.includes('"') || str.includes("\n")) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const csvContent = [
      headers.map(escapeCsv).join(","),
      ...rows.map((row) => row.map(escapeCsv).join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && lightboxDoc.isOpen) {
        closeLightbox();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxDoc.isOpen]);

  useEffect(() => {
    if (search?.tab && search.tab !== activeTab) {
      setActiveTab(search.tab);
    }
  }, [search?.tab]);

  useEffect(() => {
    if (!authLoading) {
      if (!user) {
        navigate({ to: "/login", search: { redirect: "/admin" } });
        return;
      }
      if (role !== "admin") {
        toast.error("Admin access required.");
        navigate({ to: "/" });
      }
    }
  }, [user, role, authLoading, navigate]);

  function processApplicationsList(appsList: Application[]): Application[] {
    let storedExtApps: any[] = [];
    try {
      storedExtApps = JSON.parse(localStorage.getItem("orange_extended_apps") || "[]");
    } catch {
      // best-effort: failure here is non-fatal and intentionally ignored
    }

    return appsList.map((app) => {
      let parsedNotes: any = {};
      try {
        if (
          app.admin_notes &&
          typeof app.admin_notes === "string" &&
          app.admin_notes.trim().startsWith("{")
        ) {
          parsedNotes = JSON.parse(app.admin_notes);
        }
      } catch {
        // best-effort: failure here is non-fatal and intentionally ignored
      }

      const ext = storedExtApps.find(
        (x: any) =>
          x.id === app.id ||
          (x.email && app.email && x.email.toLowerCase() === app.email.toLowerCase()),
      );
      let meta: any = {};
      try {
        if (app.email) {
          meta = JSON.parse(
            localStorage.getItem(`orange_app_meta_${app.email.toLowerCase()}`) || "{}",
          );
        }
      } catch {
        // best-effort: failure here is non-fatal and intentionally ignored
      }

      return {
        ...app,
        photo_url:
          app.photo_url || parsedNotes?.photo_url || ext?.photo_url || meta?.photo_url || "",
        driver_type:
          app.driver_type ||
          parsedNotes?.driver_type ||
          ext?.driver_type ||
          (app.owns_vehicle ? "partner" : "company"),
        vehicle_model:
          app.vehicle_model ||
          parsedNotes?.vehicle_model ||
          ext?.vehicle_model ||
          meta?.vehicle_model ||
          "",
        vehicle_number:
          app.vehicle_number ||
          parsedNotes?.vehicle_number ||
          ext?.vehicle_number ||
          meta?.vehicle_number ||
          "",
        chassis_number:
          app.chassis_number ||
          parsedNotes?.chassis_number ||
          ext?.chassis_number ||
          meta?.chassis_number ||
          "",
        vehicle_year:
          app.vehicle_year ||
          parsedNotes?.vehicle_year ||
          ext?.vehicle_year ||
          meta?.vehicle_year ||
          "",
      };
    });
  }

  function processDriversList(drList: Driver[]): Driver[] {
    return drList.map((dr) => {
      const copy = { ...dr };
      if (
        copy.vehicle_code &&
        typeof copy.vehicle_code === "string" &&
        copy.vehicle_code.startsWith("ORANGE_META:")
      ) {
        try {
          const metaEncoded = JSON.parse(copy.vehicle_code.replace("ORANGE_META:", ""));
          if (!copy.photo_url && metaEncoded.photo) copy.photo_url = metaEncoded.photo;
          if (
            (!copy.vehicle_number || copy.vehicle_number === "Unassigned") &&
            metaEncoded.plate &&
            metaEncoded.plate !== "Unassigned"
          ) {
            copy.vehicle_number = metaEncoded.plate;
          }
          if (!copy.vehicle_model && metaEncoded.model) copy.vehicle_model = metaEncoded.model;
          if (!copy.driver_type && metaEncoded.type) copy.driver_type = metaEncoded.type;
        } catch {
          // best-effort: failure here is non-fatal and intentionally ignored
        }
      }
      return copy;
    });
  }

  async function fetchSummaryCounts() {
    try {
      const [
        { count: totalB },
        { count: activeB },
        { count: completedB },
        { count: pendingApps },
        { count: newEnq },
        { count: totalDr },
        { count: onlineDr },
      ] = await Promise.all([
        supabase.from("bookings").select("id", { count: "exact", head: true }),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .in("status", ["searching", "accepted", "arrived", "in_progress"]),
        supabase
          .from("bookings")
          .select("id", { count: "exact", head: true })
          .eq("status", "completed"),
        supabase
          .from("driver_applications")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
        supabase
          .from("corporate_enquiries")
          .select("id", { count: "exact", head: true })
          .eq("status", "new"),
        supabase.from("drivers").select("id", { count: "exact", head: true }),
        supabase.from("drivers").select("id", { count: "exact", head: true }).eq("is_online", true),
      ]);
      setSummaryCounts({
        totalBookings: totalB ?? 0,
        activeBookings: activeB ?? 0,
        completedBookings: completedB ?? 0,
        totalRevenue: (completedB ?? 0) * 850,
        onlineDrivers: onlineDr ?? 0,
        totalDrivers: totalDr ?? 0,
        pendingApplications: pendingApps ?? 0,
        newEnquiries: newEnq ?? 0,
      });
    } catch (err) {
      console.error("Error fetching summary counts:", err);
    }
  }

  async function fetchBookings(force = false) {
    if (loadedTabs["bookings"] && !force) return;
    setTabLoading(true);
    try {
      const { data: b } = await supabase
        .from("bookings")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      setBookings((b as Booking[]) ?? []);

      // Auto-normalize any legacy vehicle categories in the DB
      supabase
        .from("bookings")
        .update({ vehicle_name: "Orange Signature" })
        .ilike("vehicle_name", "%Mahindra%")
        .then(() => {});

      if (drivers.length === 0) {
        const { data: d } = await supabase
          .from("drivers")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(300);
        if (d) setDrivers(processDriversList(d as Driver[]));
      }

      setLoadedTabs((prev) => ({ ...prev, bookings: true }));
    } catch (err) {
      toast.error("Failed to load bookings");
    } finally {
      setTabLoading(false);
    }
  }

  async function fetchApplications(force = false) {
    if (loadedTabs["applications"] && !force) return;
    setTabLoading(true);
    try {
      const { data: a } = await supabase
        .from("driver_applications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setApplications(processApplicationsList((a as Application[]) ?? []));
      setLoadedTabs((prev) => ({ ...prev, applications: true }));
    } catch (err) {
      toast.error("Failed to load driver applications");
    } finally {
      setTabLoading(false);
    }
  }

  async function fetchDrivers(force = false) {
    if (loadedTabs["drivers"] && !force) return;
    setTabLoading(true);
    try {
      const { data: d } = await supabase
        .from("drivers")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(300);
      setDrivers(processDriversList((d as Driver[]) ?? []));
      setLoadedTabs((prev) => ({ ...prev, drivers: true }));
    } catch (err) {
      toast.error("Failed to load drivers");
    } finally {
      setTabLoading(false);
    }
  }

  async function fetchEnquiries(force = false) {
    if (loadedTabs["enquiries"] && !force) return;
    setTabLoading(true);
    try {
      const { data: e } = await supabase
        .from("corporate_enquiries")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      setEnquiries((e as Enquiry[]) ?? []);
      setLoadedTabs((prev) => ({ ...prev, enquiries: true }));
    } catch (err) {
      toast.error("Failed to load corporate enquiries");
    } finally {
      setTabLoading(false);
    }
  }

  async function fetchFinanceData(force = false) {
    if (loadedTabs["bookings"] && loadedTabs["drivers"] && !force) return;
    setTabLoading(true);
    try {
      const [{ data: b }, { data: d }] = await Promise.all([
        supabase.from("bookings").select("*").order("created_at", { ascending: false }).limit(300),
        supabase.from("drivers").select("*").order("created_at", { ascending: false }).limit(300),
      ]);
      setBookings((b as Booking[]) ?? []);

      // Auto-normalize any legacy vehicle categories in the DB
      supabase
        .from("bookings")
        .update({ vehicle_name: "Orange Signature" })
        .ilike("vehicle_name", "%Mahindra%")
        .then(() => {});
      setDrivers(processDriversList((d as Driver[]) ?? []));
      setLoadedTabs((prev) => ({ ...prev, bookings: true, drivers: true }));
    } catch (err) {
      toast.error("Failed to load financial records");
    } finally {
      setTabLoading(false);
    }
  }

  function handleSelectTab(tab: string) {
    setActiveTab(tab);
    navigate({
      to: "/admin",
      search: { tab },
      replace: true,
    });
  }

  async function loadCurrentTab(force = true) {
    if (activeTab === "hub") {
      await fetchSummaryCounts();
    } else if (activeTab === "bookings") {
      await fetchBookings(force);
    } else if (activeTab === "applications") {
      await fetchApplications(force);
    } else if (activeTab === "drivers" || activeTab === "fleet") {
      await fetchDrivers(force);
    } else if (activeTab === "enquiries") {
      await fetchEnquiries(force);
    } else {
      await fetchFinanceData(force);
    }
  }

  const loadAll = () => loadCurrentTab(true);

  useEffect(() => {
    if (role !== "admin") return;

    if (activeTab === "hub") {
      fetchSummaryCounts();
    } else if (activeTab === "bookings") {
      fetchBookings();
    } else if (activeTab === "applications") {
      fetchApplications();
    } else if (activeTab === "drivers" || activeTab === "fleet") {
      fetchDrivers();
    } else if (activeTab === "enquiries") {
      fetchEnquiries();
    } else {
      fetchFinanceData();
    }
  }, [activeTab, role]);

  useEffect(() => {
    if (autoRefreshRate === 0) return;
    const interval = setInterval(() => loadCurrentTab(true), autoRefreshRate * 1000);
    return () => clearInterval(interval);
  }, [autoRefreshRate, activeTab]);

  useEffect(() => {
    if (role !== "admin") return;

    const bookingsCh = supabase
      .channel("admin-rt-bookings")
      .on("postgres_changes", { event: "*", schema: "public", table: "bookings" }, (payload) => {
        if (activeTab === "bookings") {
          fetchBookings(true);
        }
        fetchSummaryCounts();
        if (payload.eventType === "INSERT") {
          toast.info(`New Ride Request: ${(payload.new as any)?.reference || ""}`);
        }
      })
      .subscribe();

    const appsCh = supabase
      .channel("admin-rt-apps")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_applications" },
        (payload) => {
          if (activeTab === "applications") {
            fetchApplications(true);
          }
          fetchSummaryCounts();
          if (payload.eventType === "INSERT") {
            toast.info(`New Driver Application: ${(payload.new as any)?.full_name || ""}`);
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(bookingsCh);
      supabase.removeChannel(appsCh);
    };
  }, [activeTab, role]);

  function isTabReady(tab: string): boolean {
    if (tab === "hub") return true;
    if (tab === "bookings") return Boolean(loadedTabs["bookings"]);
    if (tab === "applications") return Boolean(loadedTabs["applications"]);
    if (tab === "drivers" || tab === "fleet") return Boolean(loadedTabs["drivers"]);
    if (tab === "enquiries") return Boolean(loadedTabs["enquiries"]);
    return Boolean(loadedTabs["bookings"] && loadedTabs["drivers"]);
  }
  // Stats with on-demand fallback
  const stats = {
    totalBookings: bookings.length || summaryCounts.totalBookings,
    activeBookings: bookings.length
      ? bookings.filter((b) =>
          ["searching", "accepted", "arrived", "in_progress"].includes(b.status),
        ).length
      : summaryCounts.activeBookings,
    completedBookings: bookings.length
      ? bookings.filter((b) => b.status === "completed").length
      : summaryCounts.completedBookings,
    totalRevenue: bookings.length
      ? bookings
          .filter((b) => b.status === "completed")
          .reduce((s, b) => s + Math.round(Number(b.final_fare ?? b.estimated_fare ?? 0)), 0)
      : summaryCounts.totalRevenue,
    onlineDrivers: drivers.length
      ? drivers.filter((d) => d.is_online).length
      : summaryCounts.onlineDrivers,
    totalDrivers: drivers.length || summaryCounts.totalDrivers,
    pendingApplications: applications.length
      ? applications.filter((a) => a.status === "new").length
      : summaryCounts.pendingApplications,
    newEnquiries: enquiries.length
      ? enquiries.filter((e) => e.status === "new").length
      : summaryCounts.newEnquiries,
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
      const { data: result } = await supabase.rpc("admin_set_role" as any, {
        _email: email,
        _role: "driver",
        _grant: true,
      });
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
          // Match an existing record by phone only. Matching by full name (as before) could update and
          // link a different chauffeur who happens to share the name.
          let existingDr: { id: string } | null = null;
          if (appObj.phone) {
            const { data: byPhone } = await supabase
              .from("drivers")
              .select("id, vehicle_number, vehicle_model, vehicle_code")
              .eq("phone", appObj.phone)
              .maybeSingle();
            existingDr = byPhone;
          }

          const plate = appObj.vehicle_number || "Unassigned";
          const model = appObj.vehicle_model || (isPartner ? "Tata Nexon EV" : "Mahindra BE.6");
          const photo = appObj.photo_url || "";
          const updates: any = {
            vehicle_number: plate,
            vehicle_model: model,
          };
          if (appObj.phone) updates.phone = appObj.phone;

          let driverRowId: string | null = existingDr?.id ?? null;
          if (existingDr) {
            await supabase.from("drivers").update(updates).eq("id", existingDr.id);
            if (photo) {
              localStorage.setItem(`orange_driver_photo_${existingDr.id}`, photo);
            }
          } else {
            // Auto-create driver record so they immediately appear in Drivers Panel
            const { data: createdDr } = await supabase
              .from("drivers")
              .insert({
                full_name: appObj.full_name,
                phone: appObj.phone || "",
                city: appObj.city || "Bengaluru",

                vehicle_number: plate,
                vehicle_model: model,
                photo_url: photo || null,
                dl_url: appObj.dl_url || null,
                rating: 5,
                total_rides: 0,
                is_online: false,
              })
              .select()
              .maybeSingle();
            driverRowId = createdDr?.id ?? null;

            if (createdDr && photo) {
              localStorage.setItem(`orange_driver_photo_${createdDr.id}`, photo);
            }
          }

          // Link the record to the applicant's login (by verified auth email) and grant the driver role.
          // Previously this looked up profiles.email, which does not exist, so user_id was never set
          // and approved chauffeurs could not sign in to the app.
          if (driverRowId && email) {
            const { data: link, error: linkErr } = await supabase.rpc(
              "admin_link_driver" as never,
              {
                _driver_id: driverRowId,
                _email: email,
              } as never,
            );
            const linkRes = link as { success?: boolean; error?: string } | null;
            if (linkErr || !linkRes?.success) {
              toast.warning(
                `Driver approved, but the login could not be linked yet: ${linkErr?.message || linkRes?.error || "unknown error"}. Ask the chauffeur to sign up with ${email}, then approve again.`,
              );
            }
          }

          if (photo) {
            if (email)
              localStorage.setItem(`orange_driver_photo_by_email_${email.toLowerCase()}`, photo);
            if (appObj.phone)
              localStorage.setItem(
                `orange_driver_photo_by_phone_${appObj.phone.replace(/\D/g, "")}`,
                photo,
              );
            if (appObj.full_name)
              localStorage.setItem(
                `orange_driver_photo_by_name_${appObj.full_name.trim().toLowerCase()}`,
                photo,
              );
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
    const plate =
      resolvedDr?.vehicle_number ||
      (driver?.vehicle_number && driver.vehicle_number !== "Unassigned"
        ? driver.vehicle_number
        : "");

    const { error } = await supabase
      .from("bookings")
      .update({
        driver_id: driverId,
        status: "accepted",
        accepted_at: new Date().toISOString(),
      })
      .eq("id", bookingId);

    if (error) {
      toast.error("Assignment failed: " + (error?.message || JSON.stringify(error)));
      return;
    }

    if (plate) {
      await lockBookingVehicle(
        supabase,
        bookingId,
        plate,
        booking?.vehicle_name,
        booking?.reference,
      );
    }

    toast.success("Driver assigned!");
    loadAll();
  }

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="size-8 animate-spin text-primary" />
      </div>
    );
  }

  const filteredBookings = bookings.filter((b) => {
    if (bookingStatusFilter === "scheduled" && b.status !== "scheduled") return false;
    if (
      bookingStatusFilter === "active" &&
      !["searching", "accepted", "arrived", "in_progress"].includes(b.status)
    )
      return false;
    if (bookingStatusFilter === "completed" && b.status !== "completed") return false;
    if (bookingStatusFilter === "cancelled" && b.status !== "cancelled") return false;

    if (!matchesDateFilter(b.created_at, bookingDateFilter)) return false;

    if (!bookingSearch.trim()) return true;
    const q = bookingSearch.toLowerCase();
    const dr = drivers.find((d) => d.id === b.driver_id);
    return (
      b.reference?.toLowerCase().includes(q) ||
      b.ride_otp?.toLowerCase().includes(q) ||
      b.pickup_area?.toLowerCase().includes(q) ||
      b.drop_area?.toLowerCase().includes(q) ||
      b.vehicle_name?.toLowerCase().includes(q) ||
      dr?.full_name?.toLowerCase().includes(q) ||
      dr?.vehicle_number?.toLowerCase().includes(q)
    );
  });

  const filteredApplications = applications.filter((app) => {
    if (appStatusFilter !== "all" && app.status !== appStatusFilter) return false;
    if (!appSearch.trim()) return true;
    const q = appSearch.toLowerCase();
    return (
      app.full_name?.toLowerCase().includes(q) ||
      app.phone?.toLowerCase().includes(q) ||
      app.email?.toLowerCase().includes(q) ||
      app.city?.toLowerCase().includes(q) ||
      app.licence_number?.toLowerCase().includes(q) ||
      app.aadhaar_number?.toLowerCase().includes(q) ||
      app.vehicle_number?.toLowerCase().includes(q)
    );
  });

  function exportBookingsCsv() {
    const headers = [
      "Booking Reference",
      "Created Date & Time",
      "Status",
      "Pickup Address",
      "Drop Address",
      "Vehicle Type",
      "Estimated Fare (INR)",
      "Final Fare (INR)",
      "Payment Method",
      "Ride OTP",
      "Assigned Driver",
      "Driver Vehicle Plate",
    ];
    const rows = filteredBookings.map((b) => {
      const dr = drivers.find((d) => d.id === b.driver_id);
      return [
        b.reference,
        b.created_at ? new Date(b.created_at).toLocaleString("en-IN") : "",
        b.status,
        b.pickup_area,
        b.drop_area,
        formatVehicleDisplay(b.vehicle_name),
        Math.round(b.estimated_fare || 0),
        Math.round(b.final_fare ?? b.estimated_fare ?? 0),
        b.payment_method || "cash",
        b.ride_otp || "",
        dr?.full_name || (b.driver_id ? "Assigned" : "Unassigned"),
        dr?.vehicle_number || "",
      ];
    });
    exportToCsv("orange_bookings_report", headers, rows);
    toast.success(`Exported ${rows.length} bookings to CSV`);
  }

  function exportApplicationsCsv() {
    const headers = [
      "Full Name",
      "Phone",
      "Email",
      "City",
      "Licence Number",
      "Aadhaar Number",
      "Experience (Years)",
      "Driver Model",
      "Vehicle Model",
      "Vehicle Number",
      "Status",
      "Applied Date",
    ];
    const rows = filteredApplications.map((a) => [
      a.full_name,
      a.phone,
      a.email,
      a.city,
      a.licence_number,
      a.aadhaar_number || "N/A",
      a.experience_years,
      a.owns_vehicle || a.driver_type === "partner" ? "Partner Owner-Operator" : "Company Driver",
      a.vehicle_model || "",
      a.vehicle_number || "",
      a.status,
      a.created_at ? new Date(a.created_at).toLocaleDateString("en-IN") : "",
    ]);
    exportToCsv("orange_driver_applications", headers, rows);
    toast.success(`Exported ${rows.length} applications to CSV`);
  }

  return (
    <section className="min-h-screen bg-background">
      <div className="section-shell py-8 lg:grid lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
        <AdminNav
          active={activeTab}
          onSelect={handleSelectTab}
          counts={{
            bookings: stats.activeBookings,
            applications: stats.pendingApplications,
            enquiries: stats.newEnquiries,
          }}
        />
        <div className="min-w-0">
          <header className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
            <h1 className="text-xl font-semibold tracking-tight">{adminSectionLabel(activeTab)}</h1>
            <div className="flex items-center gap-2">
              <label className="sr-only" htmlFor="admin-auto-refresh">
                Auto-refresh
              </label>
              <select
                id="admin-auto-refresh"
                value={String(autoRefreshRate)}
                onChange={(e) => setAutoRefreshRate(Number(e.target.value))}
                className="h-8 rounded-md border border-border bg-background px-2 text-xs text-muted-foreground"
              >
                <option value="0">Auto-refresh off</option>
                <option value="15">Every 15s</option>
                <option value="30">Every 30s</option>
                <option value="60">Every 60s</option>
              </select>
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={() => loadCurrentTab(true)}
                disabled={tabLoading}
              >
                <RefreshCw className={`size-3.5 ${tabLoading ? "animate-spin" : ""}`} />
                Refresh
              </Button>
            </div>
          </header>

          {activeTab === "hub" ? (
            <AdminOverview stats={stats} onSelect={handleSelectTab} />
          ) : tabLoading && !isTabReady(activeTab) ? (
            <div className="flex items-center justify-center gap-2 py-24 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" /> Loading…
            </div>
          ) : (
            <Tabs value={activeTab} onValueChange={(val) => handleSelectTab(val)}>
              {/* BOOKINGS */}
              <TabsContent value="bookings">
                <div className="rounded-xl border border-border bg-background overflow-hidden">
                  <div className="border-b border-border p-4 flex flex-col gap-3.5">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h2 className="text-base font-bold text-foreground">All Bookings</h2>
                        <span className="text-xs text-muted-foreground font-mono">
                          ({filteredBookings.length} of {bookings.length})
                        </span>
                      </div>

                      {/* Actions & Omni-Search */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="relative w-full sm:w-64">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder="Search ref, OTP, customer, route..."
                            value={bookingSearch}
                            onChange={(e) => setBookingSearch(e.target.value)}
                            className="w-full pl-9 pr-7 py-1.5 text-xs rounded-xl border border-border bg-background focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          {bookingSearch && (
                            <button
                              onClick={() => setBookingSearch("")}
                              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                            >
                              ✕
                            </button>
                          )}
                        </div>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={exportBookingsCsv}
                          className="h-8 px-2.5 text-xs font-semibold gap-1.5 shrink-0"
                          title="Export filtered bookings to CSV"
                        >
                          <Download className="size-3.5 text-primary" />
                          <span>Export CSV</span>
                        </Button>

                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => fetchBookings(true)}
                          className="h-8 px-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground gap-1.5 shrink-0"
                          title="Reload bookings data"
                        >
                          <RefreshCw className={`size-3.5 ${tabLoading ? "animate-spin" : ""}`} />
                          <span className="hidden sm:inline">Refresh</span>
                        </Button>
                      </div>
                    </div>

                    {/* Filters Row: Status + Date */}
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-border/60">
                      {/* Status Pills */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        {[
                          { id: "all", label: "All", count: bookings.length },
                          {
                            id: "scheduled",
                            label: "Scheduled",
                            count: bookings.filter((b) => b.status === "scheduled").length,
                          },
                          {
                            id: "active",
                            label: "Live / Searching",
                            count: bookings.filter((b) =>
                              ["searching", "accepted", "arrived", "in_progress"].includes(
                                b.status,
                              ),
                            ).length,
                          },
                          {
                            id: "completed",
                            label: "Completed",
                            count: bookings.filter((b) => b.status === "completed").length,
                          },
                          {
                            id: "cancelled",
                            label: "Cancelled",
                            count: bookings.filter((b) => b.status === "cancelled").length,
                          },
                        ].map((f) => (
                          <Button
                            key={f.id}
                            type="button"
                            size="sm"
                            variant={bookingStatusFilter === f.id ? "default" : "outline"}
                            className="h-7 px-2 text-xs font-semibold gap-1.5"
                            onClick={() => setBookingStatusFilter(f.id)}
                          >
                            <span>{f.label}</span>
                            <span
                              className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono font-medium ${
                                bookingStatusFilter === f.id
                                  ? "bg-primary-foreground/20 text-primary-foreground"
                                  : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {f.count}
                            </span>
                          </Button>
                        ))}
                      </div>

                      {/* Pre-set Quick Date Filters */}
                      <div className="flex items-center gap-1 bg-muted/60 p-0.5 rounded-lg border border-border">
                        <span className="text-[10px] font-bold text-muted-foreground px-2 flex items-center gap-1">
                          <Calendar className="size-3" /> Date:
                        </span>
                        {[
                          { id: "all", label: "All Time" },
                          { id: "today", label: "Today" },
                          { id: "yesterday", label: "Yesterday" },
                          { id: "week", label: "This Week" },
                          { id: "month", label: "This Month" },
                        ].map((df) => (
                          <button
                            key={df.id}
                            onClick={() => setBookingDateFilter(df.id)}
                            className={`h-6 px-2 rounded-md text-[10px] font-bold transition-all ${
                              bookingDateFilter === df.id
                                ? "bg-background text-foreground shadow-xs font-extrabold"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {df.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  {/* Desktop Table View */}
                  <div className="overflow-x-auto hidden lg:block">
                    <table className="w-full text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          {[
                            "Ref",
                            "Route & Time",
                            "Vehicle",
                            "Fare",
                            "Status",
                            "Driver",
                            "OTP",
                            "Actions",
                          ].map((h) => (
                            <th
                              key={h}
                              className="px-4 py-3.5 text-left text-xs font-semibold text-muted-foreground"
                            >
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {filteredBookings.map((b) => (
                          <tr key={b.id} className="hover:bg-muted/30">
                            <td className="px-4 py-3.5 align-middle font-mono text-xs font-bold">
                              {b.reference}
                            </td>
                            <td className="px-4 py-3.5 align-middle text-xs max-w-[280px]">
                              <div
                                className="font-medium text-foreground truncate"
                                title={`${b.pickup_area} → ${b.drop_area}`}
                              >
                                {formatCompactArea(b.pickup_area)} →{" "}
                                {formatCompactArea(b.drop_area)}
                              </div>
                              {b.status === "scheduled" && (
                                <div className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-primary">
                                  <Calendar className="size-3 text-primary shrink-0" />
                                  <span>
                                    {b.scheduled_at
                                      ? new Date(b.scheduled_at).toLocaleDateString("en-IN", {
                                          weekday: "short",
                                          day: "numeric",
                                          month: "short",
                                          hour: "numeric",
                                          minute: "2-digit",
                                          hour12: true,
                                        })
                                      : "Advance Booking"}
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5 align-middle text-xs font-medium text-foreground">
                              {formatVehicleDisplay(b.vehicle_name)}
                            </td>
                            <td className="px-4 py-3.5 align-middle font-semibold text-primary">
                              ₹{Math.round(b.estimated_fare)}
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              <span
                                className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_BADGE[b.status] ?? "bg-muted text-muted-foreground"}`}
                              >
                                {b.status.replace("_", " ")}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              {b.status === "searching" ||
                              (b.status === "scheduled" && !b.driver_id) ? (
                                <Select onValueChange={(v) => assignDriver(b.id, v)}>
                                  <SelectTrigger className="h-8 w-48 text-xs">
                                    <SelectValue
                                      placeholder={
                                        b.status === "scheduled"
                                          ? "Pre-assign Chauffeur"
                                          : "Assign driver"
                                      }
                                    />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(() => {
                                      let pickupLat = 0;
                                      let pickupLng = 0;
                                      if (b.pickup_address && b.pickup_address.includes(",")) {
                                        const parts = b.pickup_address.split(",");
                                        pickupLat = parseFloat(parts[0] ?? "");
                                        pickupLng = parseFloat(parts[1] ?? "");
                                      }

                                      const sortedDrivers = [...drivers].sort((d1, d2) => {
                                        if (!pickupLat || !pickupLng) return 0;
                                        const dist1 =
                                          d1.current_lat && d1.current_lng
                                            ? getDistance(
                                                pickupLat,
                                                pickupLng,
                                                d1.current_lat,
                                                d1.current_lng,
                                              )
                                            : Infinity;
                                        const dist2 =
                                          d2.current_lat && d2.current_lng
                                            ? getDistance(
                                                pickupLat,
                                                pickupLng,
                                                d2.current_lat,
                                                d2.current_lng,
                                              )
                                            : Infinity;
                                        return dist1 - dist2;
                                      });

                                      return sortedDrivers.map((d) => {
                                        let distLabel = "";
                                        if (
                                          pickupLat &&
                                          pickupLng &&
                                          d.current_lat &&
                                          d.current_lng
                                        ) {
                                          const dist = getDistance(
                                            pickupLat,
                                            pickupLng,
                                            d.current_lat,
                                            d.current_lng,
                                          );
                                          distLabel = ` - ${dist.toFixed(1)}km away`;
                                        }
                                        return (
                                          <SelectItem key={d.id} value={d.id}>
                                            {d.full_name} ·{" "}
                                            {d.vehicle_number && d.vehicle_number !== "Unassigned"
                                              ? d.vehicle_number
                                              : "No plate"}{" "}
                                            {d.is_online ? `(Online${distLabel})` : "(Offline)"}
                                          </SelectItem>
                                        );
                                      });
                                    })()}
                                  </SelectContent>
                                </Select>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {b.driver_id
                                    ? (() => {
                                        const d = drivers.find((dr) => dr.id === b.driver_id);
                                        const ridePlate = getBookingVehiclePlate(b, d);
                                        return d ? (
                                          <span className="flex flex-col space-y-0.5 leading-snug">
                                            <span className="font-semibold text-foreground">
                                              {d.full_name}
                                            </span>
                                            {d.phone && (
                                              <span className="text-[11px] font-mono text-muted-foreground">
                                                {d.phone}
                                              </span>
                                            )}
                                            <span className="font-mono text-[11px] font-bold text-primary">
                                              {ridePlate}
                                            </span>
                                          </span>
                                        ) : (
                                          <span className="flex flex-col space-y-0.5 leading-snug">
                                            <span className="font-semibold text-foreground">
                                              Assigned
                                            </span>
                                            <span className="font-mono text-[11px] font-bold text-primary">
                                              {ridePlate}
                                            </span>
                                          </span>
                                        );
                                      })()
                                    : "—"}
                                </span>
                              )}
                            </td>

                            <td className="px-4 py-3.5 align-middle">
                              <span className="font-mono text-sm font-bold text-primary">
                                {b.ride_otp || "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 align-middle">
                              {[
                                "searching",
                                "scheduled",
                                "accepted",
                                "arrived",
                                "in_progress",
                              ].includes(b.status) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={async () => {
                                    await supabase
                                      .from("bookings")
                                      .update({
                                        status: "cancelled",
                                        cancelled_at: new Date().toISOString(),
                                      })
                                      .eq("id", b.id);
                                    toast.success("Booking cancelled");
                                    fetchBookings(true);
                                  }}
                                >
                                  Cancel
                                </Button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {filteredBookings.length === 0 && (
                      <p className="p-8 text-center text-sm text-muted-foreground">
                        No bookings found matching filters.
                      </p>
                    )}
                  </div>

                  {/* Mobile / Tablet Responsive Ride Cards */}
                  <div className="lg:hidden divide-y divide-border">
                    {filteredBookings.length === 0 ? (
                      <p className="p-8 text-center text-sm text-muted-foreground">
                        No bookings found matching filters.
                      </p>
                    ) : (
                      filteredBookings.map((b) => {
                        const dr = drivers.find((d) => d.id === b.driver_id);
                        return (
                          <div
                            key={b.id}
                            className="p-4 space-y-3 bg-card/40 hover:bg-muted/20 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="font-mono text-xs font-bold text-foreground">
                                  {b.reference}
                                </span>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                                    STATUS_BADGE[b.status] ?? "bg-muted text-muted-foreground"
                                  }`}
                                >
                                  {b.status.replace("_", " ")}
                                </span>
                              </div>
                              <span className="font-bold text-sm text-primary font-mono">
                                ₹{Math.round(b.estimated_fare)}
                              </span>
                            </div>

                            {/* Route & Time */}
                            <div className="space-y-1.5 text-xs bg-muted/30 p-2.5 rounded-lg border border-border/50">
                              <div className="flex items-start gap-2">
                                <span className="size-2 rounded-full bg-emerald-500 mt-1 shrink-0" />
                                <span className="text-muted-foreground leading-snug">
                                  {b.pickup_area}
                                </span>
                              </div>
                              <div className="flex items-start gap-2">
                                <span className="size-2 rounded-full bg-primary mt-1 shrink-0" />
                                <span className="text-foreground font-medium leading-snug">
                                  {b.drop_area}
                                </span>
                              </div>
                            </div>

                            {/* Details Grid */}
                            <div className="flex items-center justify-between text-xs pt-1">
                              <span className="text-foreground font-semibold">
                                {formatVehicleDisplay(b.vehicle_name)}
                              </span>
                              {b.ride_otp && (
                                <span className="font-mono font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20 text-xs">
                                  OTP: {b.ride_otp}
                                </span>
                              )}
                              <span className="text-[11px] text-muted-foreground font-mono">
                                {b.created_at
                                  ? new Date(b.created_at).toLocaleTimeString([], {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })
                                  : ""}
                              </span>
                            </div>

                            {/* Driver & Quick Actions */}
                            <div className="pt-2 border-t border-border/60 flex items-center justify-between gap-2">
                              <div className="flex-1">
                                {b.status === "searching" ||
                                (b.status === "scheduled" && !b.driver_id) ? (
                                  <Select onValueChange={(v) => assignDriver(b.id, v)}>
                                    <SelectTrigger className="h-7 w-full text-xs">
                                      <SelectValue
                                        placeholder={
                                          b.status === "scheduled"
                                            ? "Pre-assign Chauffeur"
                                            : "Assign Chauffeur"
                                        }
                                      />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {drivers.map((d) => (
                                        <SelectItem key={d.id} value={d.id} className="text-xs">
                                          {d.full_name} ({d.vehicle_number || "No Plate"})
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <div className="text-xs">
                                    <span className="text-muted-foreground">Chauffeur: </span>
                                    <strong className="text-foreground">
                                      {dr?.full_name || "Assigned"}
                                    </strong>
                                    {dr?.vehicle_number && (
                                      <span className="ml-1 font-mono text-[11px] text-muted-foreground">
                                        ({dr.vehicle_number})
                                      </span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {[
                                "searching",
                                "scheduled",
                                "accepted",
                                "arrived",
                                "in_progress",
                              ].includes(b.status) && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs text-destructive hover:bg-destructive/10"
                                  onClick={async () => {
                                    await supabase
                                      .from("bookings")
                                      .update({
                                        status: "cancelled",
                                        cancelled_at: new Date().toISOString(),
                                      })
                                      .eq("id", b.id);
                                    toast.success("Booking cancelled");
                                    fetchBookings(true);
                                  }}
                                >
                                  Cancel
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* DRIVER APPLICATIONS */}
              <TabsContent value="applications">
                <div className="space-y-4">
                  {/* Applications Control Bar: Omni-Search, Status Filter Pills & CSV Export */}
                  <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4 shadow-xs lg:flex-row lg:items-center lg:justify-between">
                    {/* Omni Search */}
                    <div className="relative flex-1 max-w-md">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                      <Input
                        type="text"
                        placeholder="Search applicant name, phone, email, DL, Aadhaar, vehicle..."
                        value={appSearch}
                        onChange={(e) => setAppSearch(e.target.value)}
                        className="pl-9 pr-8 text-xs h-9"
                      />
                      {appSearch && (
                        <button
                          type="button"
                          onClick={() => setAppSearch("")}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
                        >
                          ✕
                        </button>
                      )}
                    </div>

                    {/* Status Filter Pills & Export */}
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="flex items-center rounded-lg border border-border bg-muted/40 p-1 text-xs font-medium">
                        {[
                          { key: "all", label: "All", count: applications.length },
                          {
                            key: "new",
                            label: "New",
                            count: applications.filter((a) => a.status === "new").length,
                          },
                          {
                            key: "approved",
                            label: "Approved",
                            count: applications.filter((a) => a.status === "approved").length,
                          },
                          {
                            key: "rejected",
                            label: "Rejected",
                            count: applications.filter((a) => a.status === "rejected").length,
                          },
                        ].map((pill) => (
                          <button
                            key={pill.key}
                            type="button"
                            onClick={() => setAppStatusFilter(pill.key)}
                            className={`rounded-md px-2.5 py-1 transition-colors ${
                              appStatusFilter === pill.key
                                ? "bg-background font-bold text-foreground shadow-xs"
                                : "text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {pill.label} ({pill.count})
                          </button>
                        ))}
                      </div>

                      <Button
                        variant="outline"
                        size="sm"
                        onClick={exportApplicationsCsv}
                        className="h-9 gap-1.5 text-xs font-semibold"
                        title="Export filtered driver applications to CSV"
                      >
                        <Download className="size-3.5" />
                        <span>Export CSV</span>
                      </Button>
                    </div>
                  </div>

                  {filteredApplications.length === 0 && (
                    <EmptyState
                      title={
                        applications.length === 0
                          ? "No applications yet"
                          : "No matching applications"
                      }
                      text={
                        applications.length === 0
                          ? "Driver applications from /drive will appear here."
                          : "Try adjusting your search query or status filter."
                      }
                    />
                  )}
                  {filteredApplications.map((app) => {
                    const isPartner = Boolean(app.owns_vehicle || app.driver_type === "partner");

                    return (
                      <div
                        key={app.id}
                        className="rounded-xl border border-border bg-background p-6"
                      >
                        <div className="flex items-start justify-between gap-4">
                          {/* Driver Photo & Information */}
                          <div className="flex items-start gap-4 flex-1">
                            {/* Driver Mandatory Photo Preview */}
                            <div className="relative shrink-0">
                              {app.photo_url ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    const s = sanitizeDocumentUrl(app.photo_url);
                                    if (s) openLightbox(`Driver Photo — ${app.full_name}`, s, app);
                                  }}
                                  className="group relative block size-16 rounded-xl overflow-hidden border-2 border-primary/40 shadow-sm focus:outline-hidden focus:ring-2 focus:ring-primary"
                                  title="Click to inspect photo in lightbox"
                                >
                                  <KycDocPreview
                                    src={app.photo_url}
                                    alt={app.full_name}
                                    className="size-full object-cover transition-transform duration-200 group-hover:scale-105"
                                    fallbackText={app.full_name.charAt(0).toUpperCase()}
                                  />
                                  <div className="absolute inset-0 bg-black/25 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <ZoomIn className="size-4 text-white" />
                                  </div>
                                </button>
                              ) : (
                                <div className="size-16 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold text-xl">
                                  {app.full_name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <span
                                className="absolute -bottom-1 -right-1 size-4 rounded-full bg-emerald-500 border-2 border-background flex items-center justify-center text-[9px] text-white font-bold pointer-events-none"
                                title="Submitted Driver Photo"
                              >
                                ✓
                              </span>
                            </div>

                            <div className="flex-1">
                              <div className="flex items-center gap-3 flex-wrap">
                                <h3 className="font-bold text-base">{app.full_name}</h3>
                                <span
                                  className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[app.status] ?? "bg-muted text-muted-foreground"}`}
                                >
                                  {app.status}
                                </span>
                                {/* Operating Model Badge */}
                                {isPartner ? (
                                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                                    <Handshake className="size-3" /> Partner Owner-Operator (
                                    {commissionPct}% Comm.)
                                  </span>
                                ) : (
                                  <span className="rounded-full bg-blue-500/15 border border-blue-500/30 px-2.5 py-0.5 text-[11px] font-bold text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                    <Building2 className="size-3" /> Company Fleet Driver (Fixed
                                    Salary)
                                  </span>
                                )}
                              </div>

                              <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1.5 text-xs text-muted-foreground lg:grid-cols-4">
                                <span>{app.email}</span>
                                <span>{app.phone}</span>
                                <span>{app.city}</span>
                                <span>{app.licence_number}</span>
                                {app.aadhaar_number && <span>{app.aadhaar_number}</span>}
                                <span>{app.experience_years} yrs experience</span>
                                <span>{isPartner ? "Brings Own EV" : "Company EV"}</span>
                                <span>{new Date(app.created_at).toLocaleDateString()}</span>
                              </div>

                              {/* Vehicle Details for Partner */}
                              {isPartner &&
                                (app.vehicle_number || app.vehicle_model || app.chassis_number) && (
                                  <div className="mt-3 rounded-lg bg-muted/40 border border-border p-3 text-xs flex flex-wrap items-center gap-x-4 gap-y-1.5">
                                    <span className="text-muted-foreground font-semibold flex items-center gap-1">
                                      <Car className="size-3.5 text-primary" /> Partner EV:
                                    </span>
                                    <span>
                                      Model:{" "}
                                      <strong className="text-foreground">
                                        {app.vehicle_model || "Mahindra BE.6"}
                                      </strong>
                                    </span>
                                    {app.vehicle_year && (
                                      <span>
                                        Year:{" "}
                                        <strong className="text-foreground">
                                          {app.vehicle_year}
                                        </strong>
                                      </span>
                                    )}
                                    {app.vehicle_number && (
                                      <span>
                                        Reg Plate:{" "}
                                        <strong className="font-mono text-primary uppercase">
                                          {app.vehicle_number}
                                        </strong>
                                      </span>
                                    )}
                                    {app.chassis_number && (
                                      <span>
                                        Chassis (VIN):{" "}
                                        <strong className="font-mono text-foreground uppercase">
                                          {app.chassis_number}
                                        </strong>
                                      </span>
                                    )}
                                  </div>
                                )}

                              {app.message && (
                                <p className="mt-3 rounded-lg bg-muted p-3 text-xs leading-5">
                                  {app.message}
                                </p>
                              )}

                              {/* Uploaded Documents with XSS Protection */}
                              {(() => {
                                const safePhoto = sanitizeDocumentUrl(app.photo_url);
                                const safeDl = sanitizeDocumentUrl(app.dl_url);
                                if (!safePhoto && !safeDl) return null;
                                return (
                                  <div className="mt-3 flex gap-4">
                                    {safePhoto && (
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between text-xs font-semibold gap-2">
                                          <span>Photo</span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openLightbox(
                                                `Driver Photo — ${app.full_name}`,
                                                safePhoto,
                                                app,
                                              )
                                            }
                                            className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                                          >
                                            <Maximize2 className="size-3" /> Zoom
                                          </button>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openLightbox(
                                              `Driver Photo — ${app.full_name}`,
                                              safePhoto,
                                              app,
                                            )
                                          }
                                          className="group relative h-20 w-20 overflow-hidden rounded-md border border-border bg-muted focus:outline-hidden focus:ring-2 focus:ring-primary text-left"
                                          title="Open in KYC Lightbox"
                                        >
                                          <KycDocPreview
                                            src={safePhoto}
                                            alt="Photo"
                                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                          />
                                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <ZoomIn className="size-4 text-white" />
                                          </div>
                                        </button>
                                      </div>
                                    )}
                                    {safeDl && (
                                      <div className="flex flex-col gap-1">
                                        <div className="flex items-center justify-between text-xs font-semibold gap-2">
                                          <span>Driving Licence</span>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              openLightbox(
                                                `Driving Licence — ${app.full_name} (${app.licence_number})`,
                                                safeDl,
                                                app,
                                              )
                                            }
                                            className="text-[11px] text-primary hover:underline flex items-center gap-0.5"
                                          >
                                            <Maximize2 className="size-3" /> Inspect
                                          </button>
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            openLightbox(
                                              `Driving Licence — ${app.full_name} (${app.licence_number})`,
                                              safeDl,
                                              app,
                                            )
                                          }
                                          className="group relative h-20 w-32 overflow-hidden rounded-md border border-border bg-muted focus:outline-hidden focus:ring-2 focus:ring-primary text-left"
                                          title="Open in KYC Lightbox"
                                        >
                                          <KycDocPreview
                                            src={safeDl}
                                            alt="DL"
                                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                          />
                                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                            <ZoomIn className="size-4 text-white" />
                                          </div>
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-2 flex-wrap">
                            {app.phone && (
                              <div className="flex items-center gap-1.5">
                                <a
                                  href={`tel:${app.phone.replace(/\s+/g, "")}`}
                                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-border bg-background hover:bg-muted text-xs font-semibold text-foreground transition-colors shadow-xs"
                                  title={`Call ${app.full_name} (${app.phone})`}
                                >
                                  <PhoneCall className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                                  <span>Call</span>
                                </a>
                                <a
                                  href={`https://api.whatsapp.com/send?phone=${app.phone.replace(/\D/g, "")}&text=${encodeURIComponent(
                                    `Hello ${app.full_name}, this is Orange Taxi Fleet Operations regarding your driver application.`,
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
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:bg-destructive/10"
                                  onClick={() => updateApplicationStatus(app.id, "rejected")}
                                >
                                  <X className="size-4" /> Reject
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    updateApplicationStatus(app.id, "approved", app.email, app)
                                  }
                                >
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
                  {enquiries.length === 0 && (
                    <EmptyState
                      title="No corporate enquiries yet"
                      text="Corporate B2B enquiries from /business and /talk-to-orange will appear here."
                    />
                  )}
                  {enquiries.map((eq) => (
                    <div key={eq.id} className="rounded-xl border border-border bg-background p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-bold">{eq.company_name}</h3>
                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${STATUS_BADGE[eq.status] ?? "bg-muted text-muted-foreground"}`}
                            >
                              {eq.status}
                            </span>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground lg:grid-cols-3">
                            <span>{eq.contact_name}</span>
                            <span>{eq.email}</span>
                            <span>{eq.phone}</span>
                            <span>{eq.city}</span>
                            <span>Team: {eq.team_size}</span>
                            <span>{new Date(eq.created_at).toLocaleDateString()}</span>
                          </div>
                          {eq.requirement && (
                            <p className="mt-2 text-xs text-muted-foreground">
                              Need: {eq.requirement}
                            </p>
                          )}
                          {eq.message && (
                            <p className="mt-2 rounded-lg bg-muted p-3 text-xs leading-5">
                              {eq.message}
                            </p>
                          )}
                        </div>
                        <div className="flex shrink-0 gap-2">
                          {eq.status === "new" && (
                            <Button
                              size="sm"
                              onClick={() => updateEnquiryStatus(eq.id, "contacted")}
                            >
                              Mark Contacted
                            </Button>
                          )}
                          {eq.status === "contacted" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => updateEnquiryStatus(eq.id, "closed")}
                            >
                              Close
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* LIVE DRIVERS MAP */}
              <TabsContent value="live-map">
                <TabErrorBoundary tabName="Live Drivers Map" onRetry={loadAll}>
                  <LiveDriversMap
                    drivers={drivers}
                    bookings={bookings}
                    apiKey={GOOGLE_MAPS_KEY}
                    onRefresh={loadAll}
                  />
                </TabErrorBoundary>
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
                  <CommissionLedgerManager
                    drivers={drivers}
                    bookings={bookings}
                    onRefresh={loadAll}
                    onNavigateTab={(tab) => {
                      setActiveTab(tab);
                      navigate({ to: "/admin", search: { tab }, replace: true });
                    }}
                  />
                </TabErrorBoundary>
              </TabsContent>

              {/* CANCELLATION FEES */}
              <TabsContent value="cancellation-fees">
                <TabErrorBoundary tabName="Cancellation Fees" onRetry={loadAll}>
                  <CancellationFeesManager />
                </TabErrorBoundary>
              </TabsContent>

              {/* SUPPORT & REFUNDS */}
              <TabsContent value="support">
                <TabErrorBoundary tabName="Support" onRetry={loadAll}>
                  <SupportManager />
                </TabErrorBoundary>
              </TabsContent>

              {/* PRICING */}
              <TabsContent value="pricing">
                <TabErrorBoundary tabName="Pricing" onRetry={loadAll}>
                  <PricingManager />
                </TabErrorBoundary>
              </TabsContent>

              {/* GST & INVOICING */}
              <TabsContent value="gst">
                <TabErrorBoundary tabName="GST & Invoicing" onRetry={loadAll}>
                  <GSTAccountingManager bookings={bookings} onRefresh={loadAll} />
                </TabErrorBoundary>
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* Feature 3: KYC Document Lightbox Modal */}
      {lightboxDoc.isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-6"
          onClick={closeLightbox}
        >
          <div
            className="relative flex flex-col w-full max-w-5xl max-h-[92vh] rounded-2xl border border-white/10 bg-zinc-950 text-white shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Header Bar */}
            <div className="flex items-center justify-between border-b border-white/10 px-4 py-3 bg-zinc-900/90">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileSpreadsheet className="size-4 text-primary shrink-0" />
                <h3 className="text-sm font-bold text-white truncate">{lightboxDoc.title}</h3>
              </div>

              {/* Lightbox View Controls */}
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex items-center rounded-lg bg-zinc-800/80 p-1 border border-white/10">
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxDoc((prev) => ({
                        ...prev,
                        zoom: Math.max(0.5, Number((prev.zoom - 0.25).toFixed(2))),
                      }))
                    }
                    className="p-1.5 hover:bg-zinc-700 rounded text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    title="Zoom Out (-25%)"
                  >
                    <ZoomOut className="size-4" />
                  </button>
                  <span className="px-2 text-xs font-mono font-medium text-zinc-300 min-w-[44px] text-center">
                    {Math.round(lightboxDoc.zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setLightboxDoc((prev) => ({
                        ...prev,
                        zoom: Math.min(3, Number((prev.zoom + 0.25).toFixed(2))),
                      }))
                    }
                    className="p-1.5 hover:bg-zinc-700 rounded text-zinc-300 hover:text-white transition-colors cursor-pointer"
                    title="Zoom In (+25%)"
                  >
                    <ZoomIn className="size-4" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setLightboxDoc((prev) => ({
                      ...prev,
                      rotation: (prev.rotation + 90) % 360,
                    }))
                  }
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  title="Rotate 90 degrees clockwise"
                >
                  <RotateCw className="size-3.5" />
                  <span className="hidden sm:inline">Rotate 90°</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setLightboxDoc((prev) => ({
                      ...prev,
                      zoom: 1,
                      rotation: 0,
                    }))
                  }
                  className="px-2.5 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-white/10 text-xs font-medium text-zinc-300 hover:text-white transition-colors cursor-pointer"
                  title="Reset Zoom & Rotation"
                >
                  Reset
                </button>

                <a
                  href={lightboxDoc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-700 border border-white/10 text-zinc-300 hover:text-white transition-colors"
                  title="Open Raw Original in New Tab"
                >
                  <Maximize2 className="size-4" />
                </a>

                <button
                  type="button"
                  onClick={closeLightbox}
                  className="p-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-300 hover:text-white transition-colors ml-1 cursor-pointer"
                  title="Close (Esc)"
                >
                  <X className="size-4" />
                </button>
              </div>
            </div>

            {/* Lightbox Body: Document Viewer & Applicant Inspector Panel */}
            <div className="grid grid-cols-1 lg:grid-cols-3 flex-1 min-h-0 overflow-hidden bg-zinc-950">
              {/* Document Display Area */}
              <div className="lg:col-span-2 relative flex items-center justify-center p-4 bg-zinc-900/50 overflow-auto min-h-[350px] max-h-[60vh] lg:max-h-[75vh]">
                <img
                  src={lightboxDoc.url}
                  alt={lightboxDoc.title}
                  style={{
                    transform: `scale(${lightboxDoc.zoom}) rotate(${lightboxDoc.rotation}deg)`,
                    transition: "transform 0.2s cubic-bezier(0.2, 0, 0, 1)",
                    maxHeight: "85%",
                    maxWidth: "85%",
                  }}
                  className="rounded-lg object-contain shadow-2xl select-none"
                />
              </div>

              {/* Inspector Panel */}
              <div className="border-t lg:border-t-0 lg:border-l border-white/10 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto max-h-[35vh] lg:max-h-[75vh] bg-zinc-900/80">
                {lightboxDoc.app ? (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            STATUS_BADGE[lightboxDoc.app.status] ?? "bg-zinc-800 text-zinc-300"
                          }`}
                        >
                          {lightboxDoc.app.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-zinc-400">
                          Applied: {new Date(lightboxDoc.app.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="mt-2 text-lg font-bold text-white">
                        {lightboxDoc.app.full_name}
                      </h4>
                      <p className="text-xs text-primary font-medium">
                        {lightboxDoc.app.owns_vehicle || lightboxDoc.app.driver_type === "partner"
                          ? "Partner Owner-Operator"
                          : "Company Fleet Chauffeur"}
                      </p>
                    </div>

                    {/* Contact & Verification Grid */}
                    <div className="rounded-xl bg-zinc-800/60 border border-white/5 p-3 space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Mobile Phone:</span>
                        <span className="font-mono text-zinc-200">{lightboxDoc.app.phone}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Email:</span>
                        <span
                          className="text-zinc-200 truncate max-w-[170px]"
                          title={lightboxDoc.app.email}
                        >
                          {lightboxDoc.app.email}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">City / Base:</span>
                        <span className="text-zinc-200">{lightboxDoc.app.city}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Driving Licence:</span>
                        <span className="font-mono font-bold text-primary">
                          {lightboxDoc.app.licence_number}
                        </span>
                      </div>
                      {lightboxDoc.app.aadhaar_number && (
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Aadhaar (UIDAI):</span>
                          <span className="font-mono text-zinc-200">
                            {lightboxDoc.app.aadhaar_number}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-zinc-400">Experience:</span>
                        <span className="text-zinc-200">
                          {lightboxDoc.app.experience_years} years
                        </span>
                      </div>
                      {lightboxDoc.app.vehicle_number && (
                        <div className="flex justify-between">
                          <span className="text-zinc-400">Vehicle Reg:</span>
                          <span className="font-mono font-bold text-emerald-400 uppercase">
                            {lightboxDoc.app.vehicle_number}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Direct Phone / WhatsApp Connect */}
                    {lightboxDoc.app.phone && (
                      <div className="grid grid-cols-2 gap-2">
                        <a
                          href={`tel:${lightboxDoc.app.phone.replace(/\s+/g, "")}`}
                          className="inline-flex items-center justify-center gap-1.5 h-8 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 border border-white/10"
                        >
                          <PhoneCall className="size-3.5 text-emerald-400" />
                          <span>Call Chauffeur</span>
                        </a>
                        <a
                          href={`https://api.whatsapp.com/send?phone=${lightboxDoc.app.phone.replace(/\D/g, "")}&text=${encodeURIComponent(
                            `Hello ${lightboxDoc.app.full_name}, this is Orange Taxi Fleet Operations regarding your verification documents.`,
                          )}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center justify-center gap-1.5 h-8 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-xs font-semibold text-emerald-300 border border-emerald-500/30"
                        >
                          <MessageSquare className="size-3.5" />
                          <span>WhatsApp</span>
                        </a>
                      </div>
                    )}

                    {/* One-Click Approval / Rejection in Inspector */}
                    {lightboxDoc.app.status === "new" ? (
                      <div className="pt-2 border-t border-white/10 flex gap-2">
                        <Button
                          variant="destructive"
                          size="sm"
                          className="flex-1 text-xs"
                          onClick={() => {
                            updateApplicationStatus(lightboxDoc.app!.id, "rejected");
                            closeLightbox();
                          }}
                        >
                          <X className="size-3.5" /> Reject KYC
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 text-xs bg-emerald-600 hover:bg-emerald-500 text-white"
                          onClick={() => {
                            updateApplicationStatus(
                              lightboxDoc.app!.id,
                              "approved",
                              lightboxDoc.app!.email,
                              lightboxDoc.app,
                            );
                            closeLightbox();
                          }}
                        >
                          <CheckCircle className="size-3.5" /> Approve KYC
                        </Button>
                      </div>
                    ) : (
                      <div className="rounded-lg bg-zinc-800/40 p-2.5 text-center text-xs text-zinc-400">
                        Application has been marked as{" "}
                        <strong className="text-zinc-200 uppercase">
                          {lightboxDoc.app.status}
                        </strong>
                        .
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full text-center text-zinc-400 text-xs">
                    <p>Single Document Lightbox</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

// drivers.driver_type is the single source of truth (see src/lib/driver-type.ts).
function isCommissionDriver(d: Driver): boolean {
  return isPartnerDriverType(d);
}

function DriverAnalyticsPanel({
  drivers,
  bookings,
  onRefresh,
  onNavigateTab,
}: {
  drivers: Driver[];
  bookings: any[];
  onRefresh: () => void;
  onNavigateTab?: (tab: string) => void;
}) {
  const commissionPct = usePricingSettings().partner_commission_percent;
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
      // Real fleet only — the sample fleet is never shown as live data.
      setFleetVehicles(data ?? []);
    } catch (e) {
      setFleetVehicles([]);
    }
  }

  useEffect(() => {
    loadFleet();
    const ch = supabase
      .channel("admin-fleet-drivers-sync")
      .on("postgres_changes", { event: "*", schema: "public", table: "fleet_vehicles" }, () =>
        loadFleet(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, []);

  async function updateFleetVehicleInDbOrLocal(v: any) {
    try {
      await supabase
        .from("fleet_vehicles")
        .update({
          status: v.status,
          assigned_driver_id: v.assigned_driver_id,
          assigned_at: v.assigned_at,
          bay_number: v.bay_number,
          updated_at: new Date().toISOString(),
        })
        .eq("id", v.id);
    } catch {
      // best-effort: failure here is non-fatal and intentionally ignored
    }

    const stored = localStorage.getItem("orange_fleet_vehicles");
    if (stored) {
      try {
        const list = JSON.parse(stored);
        const updated = list.map((item: any) =>
          item.id === v.id || item.plate_number === v.plate_number ? { ...item, ...v } : item,
        );
        localStorage.setItem("orange_fleet_vehicles", JSON.stringify(updated));
      } catch {
        // best-effort: failure here is non-fatal and intentionally ignored
      }
    }
  }

  async function assignBayVehicleToDriver(vehicle: any, driver: Driver) {
    const olderVeh = fleetVehicles.find(
      (v) => v.assigned_driver_id === driver.id && v.id !== vehicle.id,
    );
    if (olderVeh) {
      const olderParked = {
        ...olderVeh,
        status: "in_bay",
        assigned_driver_id: null,
        assigned_at: null,
        bay_number: olderVeh.bay_number || "Bay A-1",
      };
      await updateFleetVehicleInDbOrLocal(olderParked);
      toast.info(`Older car ${olderVeh.plate_number} parked back in ${olderParked.bay_number}.`);
    }

    const assigned = {
      ...vehicle,
      status: "assigned",
      assigned_driver_id: driver.id,
      assigned_at: new Date().toISOString(),
    };
    await updateFleetVehicleInDbOrLocal(assigned);

    await supabase
      .from("drivers")
      .update({
        vehicle_number: vehicle.plate_number,
        vehicle_model: vehicle.model,
      })
      .eq("id", driver.id);

    toast.success(
      `${vehicle.plate_number} assigned to ${driver.full_name}! Customer rides & driver console updated.`,
    );
    setEditingVehicleId(null);
    loadFleet();
    onRefresh();
  }

  async function unassignDriverVehicle(driver: Driver) {
    const currVeh = fleetVehicles.find(
      (v) => v.assigned_driver_id === driver.id || v.plate_number === driver.vehicle_number,
    );
    if (currVeh) {
      const parked = {
        ...currVeh,
        status: "in_bay",
        assigned_driver_id: null,
        assigned_at: null,
        bay_number: currVeh.bay_number || "Bay A-1",
      };
      await updateFleetVehicleInDbOrLocal(parked);
    }

    await supabase
      .from("drivers")
      .update({
        vehicle_number: "Unassigned",
      })
      .eq("id", driver.id);

    toast.success(`${driver.full_name}'s car unassigned and parked in bay.`);
    setEditingVehicleId(null);
    loadFleet();
    onRefresh();
  }

  async function assignCustomVehicle(plate: string, model: string, driver: Driver) {
    await supabase
      .from("drivers")
      .update({
        vehicle_number: plate,
        vehicle_model: model,
      })
      .eq("id", driver.id);

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
    const { error } = await supabase
      .from("drivers")
      .update({
        vehicle_number: cleanPlate,
        vehicle_model: cleanModel,
      })
      .eq("id", driver.id);

    if (error) {
      toast.error("Could not update partner vehicle: " + (error?.message || JSON.stringify(error)));
    } else {
      try {
        const pCars = JSON.parse(localStorage.getItem("orange_partner_vehicles") || "[]");
        const idx = pCars.findIndex(
          (c: any) => c.driver_id === driver.id || c.plate_number === cleanPlate,
        );
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
            created_at: new Date().toISOString(),
          });
        }
        localStorage.setItem("orange_partner_vehicles", JSON.stringify(pCars));
      } catch {
        // best-effort: failure here is non-fatal and intentionally ignored
      }

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
        const p = prompt(`Enter Partner EV Registration Plate for ${driver.full_name}:`, "");
        if (p === null || !p.trim()) return;
        targetPlate = p.trim().toUpperCase();
      }
      if (!targetModel) targetModel = "Tata Nexon EV";
    } else {
      targetPlate = "Unassigned";
      targetModel = "Mahindra BE.6";
    }
    const { error } = await supabase
      .from("drivers")
      .update({
        vehicle_number: targetPlate,
        vehicle_model: targetModel,
        driver_type: targetType,
      } as never)
      .eq("id", driver.id);

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
              created_at: new Date().toISOString(),
            });
            localStorage.setItem("orange_partner_vehicles", JSON.stringify(pCars));
          }
        } catch {
          // best-effort: failure here is non-fatal and intentionally ignored
        }
      }
      toast.success(
        `${driver.full_name} is now classified as ${isPartner ? "Commission Based Driver (Partner)" : "Company Owned Driver (Fleet)"}!`,
      );
      onRefresh();
    }
  }

  const allCompanyDrivers = drivers.filter((d) => !isCommissionDriver(d));
  const allCommissionDrivers = drivers.filter((d) => isCommissionDriver(d));

  const filtered = drivers.filter(
    (d) =>
      d.full_name.toLowerCase().includes(search.toLowerCase()) ||
      d.city?.toLowerCase().includes(search.toLowerCase()) ||
      d.vehicle_number?.toLowerCase().includes(search.toLowerCase()) ||
      d.phone?.includes(search),
  );

  const filteredCompanyDrivers = filtered.filter((d) => !isCommissionDriver(d));
  const filteredCommissionDrivers = filtered.filter((d) => isCommissionDriver(d));

  function driverBookings(driverId: string) {
    return bookings.filter((b) => b.driver_id === driverId && b.status === "completed");
  }

  function driverStats(driverId: string) {
    const rides = driverBookings(driverId);
    const total = rides.reduce(
      (s, b) => s + Math.round(Number(b.final_fare ?? b.estimated_fare ?? 0)),
      0,
    );
    const upi = rides
      .filter((b) => b.payment_method === "upi" || b.payment_method === "upi_qr")
      .reduce((s, b) => s + Math.round(Number(b.final_fare ?? b.estimated_fare ?? 0)), 0);
    const cash = rides
      .filter((b) => b.payment_method === "cash")
      .reduce((s, b) => s + Math.round(Number(b.final_fare ?? b.estimated_fare ?? 0)), 0);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRides = rides.filter((b) => new Date(b.completed_at ?? "") >= today);
    const todayTotal = todayRides.reduce(
      (s, b) => s + Math.round(Number(b.final_fare ?? b.estimated_fare ?? 0)),
      0,
    );
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
      <div
        key={d.id}
        className="rounded-xl border border-border bg-background overflow-hidden shadow-xs hover:border-primary/40 transition-colors"
      >
        {/* Driver header */}
        <div className="px-6 py-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="relative size-11 shrink-0">
              {d.photo_url ? (
                <KycDocPreview
                  src={d.photo_url}
                  alt={d.full_name}
                  className="size-11 rounded-full object-cover border-2 border-primary/40 shadow-xs"
                  fallbackText={d.full_name.charAt(0).toUpperCase()}
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
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${d.is_online ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}
                >
                  {d.is_online ? "● Online" : "Offline"}
                </span>
                {isPartner ? (
                  <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 px-2.5 py-0.5 text-[11px] font-bold flex items-center gap-1">
                    <Handshake className="size-3" /> Commission Partner ({commissionPct}%)
                  </span>
                ) : (
                  <span className="rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-700 dark:text-blue-300 px-2.5 py-0.5 text-[11px] font-bold flex items-center gap-1">
                    <Building2 className="size-3" /> Company Fleet (Fixed Salary)
                  </span>
                )}
              </div>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <span className="text-xs text-muted-foreground font-medium">
                  {d.city || "Bengaluru"}
                </span>
                <span className="text-muted-foreground text-xs">·</span>
                {isPartner ? (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    <Car className="size-3" />
                    <span>{d.vehicle_model || "Tata Nexon EV"}</span>
                    <span className="font-mono font-bold uppercase">
                      {d.vehicle_number && d.vehicle_number !== "Unassigned"
                        ? d.vehicle_number
                        : "Plate not set"}
                    </span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-semibold text-primary">
                    <Car className="size-3" />
                    <span>{d.vehicle_model || "Mahindra BE.6"}</span>
                    <span className="font-mono font-bold">
                      {d.vehicle_number && d.vehicle_number !== "Unassigned"
                        ? d.vehicle_number
                        : "No car assigned"}
                    </span>
                  </span>
                )}
                <span className="text-muted-foreground text-xs">·</span>
                <button
                  type="button"
                  onClick={() => {
                    const newPhone = prompt(
                      `Enter phone number for ${d.full_name}:`,
                      d.phone || "",
                    );
                    if (newPhone !== null && newPhone.trim() !== "") {
                      supabase
                        .from("drivers")
                        .update({ phone: newPhone.trim() })
                        .eq("id", d.id)
                        .then(({ error }) => {
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
                  <span>{d.phone || "Add Phone"}</span>
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
                  href={`tel:${d.phone.replace(/\s+/g, "")}`}
                  className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-emerald-500/40 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300 dark:hover:bg-emerald-900/60 text-xs font-bold transition-colors shadow-xs"
                  title={`Call ${d.full_name} (${d.phone})`}
                >
                  <PhoneCall className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Call</span>
                </a>
                <a
                  href={`https://api.whatsapp.com/send?phone=${d.phone.replace(/\D/g, "")}&text=${encodeURIComponent(
                    `Hello ${d.full_name}, this is Orange Taxi Fleet Operations regarding your driver account.`,
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
                    supabase
                      .from("drivers")
                      .update({ phone: newPhone.trim() })
                      .eq("id", d.id)
                      .then(({ error }) => {
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
                    setPartnerPlateInput(
                      d.vehicle_number && d.vehicle_number !== "Unassigned" ? d.vehicle_number : "",
                    );
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
                    if (
                      confirm(
                        `Switch ${d.full_name} from Commission Partner to Company Fleet Driver?`,
                      )
                    ) {
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
                  {isEditingVehicle
                    ? "Close"
                    : d.vehicle_number && d.vehicle_number !== "Unassigned"
                      ? "Change Vehicle"
                      : "Assign Daily Vehicle"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs text-muted-foreground hover:text-emerald-600"
                  onClick={() => {
                    if (
                      confirm(
                        `Switch ${d.full_name} from Company Fleet to Commission Based Driver (Partner)?`,
                      )
                    ) {
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
                await supabase
                  .from("drivers")
                  .update({ status: d.status === "active" ? "inactive" : "active" })
                  .eq("id", d.id);
                onRefresh();
              }}
            >
              {d.status === "active" ? "Deactivate" : "Activate"}
            </Button>
            <button
              onClick={() => setExpanded(isExpanded ? null : d.id)}
              className="flex items-center gap-1 rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-accent transition-colors"
            >
              {isExpanded ? (
                <>
                  <ChevronUp className="size-3" /> Hide
                </>
              ) : (
                <>
                  <ChevronDown className="size-3" /> View Analytics
                </>
              )}
            </button>
          </div>
        </div>

        {/* Inline Partner Vehicle Editor */}
        {isPartner && isEditingPartnerVehicle && (
          <div className="border-t border-border bg-emerald-500/5 p-5  slide-in-from-top-2">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5">
                  <Car className="size-4" /> Partner EV Registration — {d.full_name}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Commission drivers operate their own verified Orange EV. Updates plate & vehicle
                  model across customer bookings and live tracking instantly.
                </p>
              </div>
              <button
                onClick={() => setEditingPartnerVehicleId(null)}
                className="text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background p-4 shadow-sm">
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
                <div className="sm:col-span-4">
                  <label className="text-[11px] uppercase font-bold text-foreground">
                    Partner EV Model
                  </label>
                  <input
                    value={partnerModelInput}
                    onChange={(e) => setPartnerModelInput(e.target.value)}
                    placeholder="e.g. Tata Nexon EV, Mahindra BE.6"
                    className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary"
                  />
                </div>
                <div className="sm:col-span-5">
                  <label className="text-[11px] uppercase font-bold text-foreground">
                    EV Plate Number (Registration)
                  </label>
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
        {!isPartner &&
          isEditingVehicle &&
          (() => {
            const bayVehicles = fleetVehicles.filter((v) => v.status === "in_bay");

            return (
              <div className="border-t border-border bg-primary/5 p-5  slide-in-from-top-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                      <Car className="size-4" /> Daily Vehicle Allocation — {d.full_name}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Select an available vehicle from the fleet bay. Updates customer booking
                      screens & driver console in real-time.
                    </p>
                  </div>
                  <button
                    onClick={() => setEditingVehicleId(null)}
                    className="text-muted-foreground hover:text-foreground"
                  >
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
                          Current:{" "}
                          <strong className="font-mono text-primary">{d.vehicle_number}</strong>
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
                        {bayVehicles.map((v) => (
                          <option key={v.id || v.plate_number} value={v.id || v.plate_number}>
                            {v.plate_number} · {v.model} — {v.bay_number || "Bay A-1"} ({" "}
                            {v.battery_percentage}%)
                          </option>
                        ))}
                        {bayVehicles.length === 0 && (
                          <option disabled value="">
                            No vehicles currently in bay. Register one or park one back.
                          </option>
                        )}
                      </select>

                      <Button
                        size="sm"
                        className="h-10 px-5 text-xs font-semibold gap-1.5 shrink-0"
                        onClick={async () => {
                          const selectEl = document.getElementById(
                            `select-bay-veh-${d.id}`,
                          ) as HTMLSelectElement;
                          const selectedVal = selectEl?.value;
                          if (!selectedVal) {
                            toast.error("Please select a vehicle from the bay dropdown");
                            return;
                          }
                          const selectedVeh = fleetVehicles.find(
                            (v) => v.id === selectedVal || v.plate_number === selectedVal,
                          );
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
                    Assigning a car moves it out of the bay. If {d.full_name} already has an
                    assigned vehicle, the older one is automatically parked back in the bay.
                  </p>

                  {/* Manual entry fallback */}
                  <div className="pt-2 border-t border-border/70">
                    <button
                      type="button"
                      onClick={() =>
                        setCustomEntryDriverId(customEntryDriverId === d.id ? null : d.id)
                      }
                      className="text-[11px] font-semibold text-primary hover:underline flex items-center gap-1"
                    >
                      {customEntryDriverId === d.id
                        ? "▲ Close manual plate entry"
                        : "▼ Need to enter custom / external plate manually?"}
                    </button>

                    {customEntryDriverId === d.id && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end bg-muted/40 p-3 rounded-lg border border-border">
                        <div className="sm:col-span-5">
                          <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                            Model
                          </label>
                          <input
                            id={`manual-model-${d.id}`}
                            defaultValue={d.vehicle_model || "Mahindra BE.6"}
                            className="mt-1 w-full rounded border border-border bg-background px-2.5 py-1.5 text-xs outline-none focus:border-primary"
                          />
                        </div>
                        <div className="sm:col-span-4">
                          <label className="text-[10px] uppercase font-semibold text-muted-foreground">
                            Plate Number
                          </label>
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
                              const m = (
                                document.getElementById(`manual-model-${d.id}`) as HTMLInputElement
                              )?.value;
                              const p = (
                                document.getElementById(`manual-plate-${d.id}`) as HTMLInputElement
                              )?.value;
                              if (!p?.trim()) {
                                toast.error("Please enter a plate number");
                                return;
                              }
                              await assignCustomVehicle(
                                p.trim().toUpperCase(),
                                m?.trim() || "Mahindra BE.6",
                                d,
                              );
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
            {
              label: "Cash Collected",
              value: `₹${Math.round(stats.cash)}`,
              color: "text-green-600",
            },
            {
              label: isPartner ? `${commissionPct}% Company Comm.` : "Today's Rides",
              value: isPartner
                ? `₹${Math.round((stats.total * commissionPct) / 100)}`
                : stats.todayCount,
              color: isPartner ? "text-emerald-600 font-extrabold" : "",
            },
            {
              label: "Today Earned",
              value: `₹${Math.round(stats.todayTotal)}`,
              color: "text-primary",
            },
          ].map((s) => (
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
              <p className="text-xs font-bold uppercase text-muted-foreground">
                Ride History ({rides.length} completed)
              </p>
              {isPartner && (
                <span className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                  Partner Keeps {100 - commissionPct}% · Company Receives {commissionPct}%
                </span>
              )}
            </div>
            {rides.length === 0 ? (
              <p className="px-6 py-6 text-sm text-muted-foreground">No completed rides yet.</p>
            ) : (
              <div className="divide-y divide-border max-h-72 overflow-y-auto">
                {rides.slice(0, 50).map((b) => {
                  const ridePlate = getBookingVehiclePlate(b, d);
                  const fare = Math.round(b.final_fare ?? b.estimated_fare);
                  const comm = Math.round((fare * commissionPct) / 100);
                  const driverNet = fare - comm;

                  return (
                    <div
                      key={b.id}
                      className="flex items-center justify-between px-6 py-3 gap-4 text-sm hover:bg-muted/20"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-mono text-xs font-bold text-foreground">
                            {b.reference}
                          </p>
                          {ridePlate && (
                            <span className="font-mono text-[10px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                              {ridePlate}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {b.pickup_area} → {b.drop_area}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {b.completed_at
                            ? new Date(b.completed_at).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2.5 shrink-0 text-right">
                        {isPartner && (
                          <div className="text-right text-[11px] hidden sm:block">
                            <span className="text-emerald-600 font-semibold">
                              Driver: ₹{driverNet}
                            </span>
                            <span className="text-muted-foreground text-[10px] block">
                              Comm: ₹{comm}
                            </span>
                          </div>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${b.payment_method === "upi" || b.payment_method === "upi_qr" ? "bg-blue-100 text-blue-700" : "bg-green-100 text-green-700"}`}
                        >
                          {b.payment_method === "upi_qr"
                            ? "UPI QR"
                            : b.payment_method?.toUpperCase()}
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
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                driverSegment === "company"
                  ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
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
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                driverSegment === "commission"
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : "bg-muted text-muted-foreground"
              }`}
            >
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
            <span
              className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
                driverSegment === "all"
                  ? "bg-primary/20 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
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
            <strong>Commission Partner:</strong> {commissionPct}% Platform Split · Own EV
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
          onChange={(e) => setSearch(e.target.value)}
        />
        {search && (
          <button
            onClick={() => setSearch("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
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
                  <Building2 className="size-5 text-blue-600" /> Company Owned Drivers (Fixed Salary
                  Fleet)
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Full-time salaried chauffeurs operating company-owned Mahindra BE.6 EVs. Vehicles
                  are allocated daily from company charging bays.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="rounded-xl border border-border bg-background px-3 py-1.5 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Employed</p>
                  <p className="text-sm font-bold text-foreground">{allCompanyDrivers.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-1.5 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Online</p>
                  <p className="text-sm font-bold text-emerald-600">
                    {allCompanyDrivers.filter((d) => d.is_online).length}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-1.5 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                    Car Assigned
                  </p>
                  <p className="text-sm font-bold text-blue-600">
                    {
                      allCompanyDrivers.filter(
                        (d) => d.vehicle_number && d.vehicle_number !== "Unassigned",
                      ).length
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>

          {filteredCompanyDrivers.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No company owned drivers matching your search.
            </p>
          ) : (
            <div className="space-y-4">
              {filteredCompanyDrivers.map((d) => renderDriverCard(d))}
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
                  <Handshake className="size-5 text-emerald-600" /> Commission Based Drivers
                  (Partner Owner-Operators)
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  Independent driver-partners bringing their own EV. Operates on a {commissionPct}%
                  platform commission model with their verified vehicle plate.
                </p>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <div className="rounded-xl border border-border bg-background px-3 py-1.5 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Partners</p>
                  <p className="text-sm font-bold text-foreground">{allCommissionDrivers.length}</p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-1.5 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Online</p>
                  <p className="text-sm font-bold text-emerald-600">
                    {allCommissionDrivers.filter((d) => d.is_online).length}
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background px-3 py-1.5 text-center">
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">
                    Comm. Split
                  </p>
                  <p className="text-sm font-bold text-emerald-600">
                    {100 - commissionPct}% / {commissionPct}%
                  </p>
                </div>
                {onNavigateTab && (
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-9"
                    onClick={() => onNavigateTab("commissions")}
                  >
                    Open Ledger →
                  </Button>
                )}
              </div>
            </div>
          </div>

          {filteredCommissionDrivers.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No commission based drivers matching your search.
            </p>
          ) : (
            <div className="space-y-4">
              {filteredCommissionDrivers.map((d) => renderDriverCard(d))}
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
                  Company Owned Drivers{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    (Fixed Salary Fleet · {filteredCompanyDrivers.length})
                  </span>
                </h3>
              </div>
              <span className="text-xs font-semibold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-2.5 py-0.5 rounded-full border border-blue-500/20">
                Company Fleet
              </span>
            </div>

            {filteredCompanyDrivers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No company drivers in this view.
              </p>
            ) : (
              <div className="space-y-4">
                {filteredCompanyDrivers.map((d) => renderDriverCard(d))}
              </div>
            )}
          </div>

          {/* Section 2: Commission Based Drivers */}
          <div className="space-y-4 pt-4 border-t border-border">
            <div className="flex items-center justify-between border-b border-emerald-500/30 pb-2.5">
              <div className="flex items-center gap-2">
                <Handshake className="size-5 text-emerald-600" />
                <h3 className="font-bold text-base text-foreground">
                  Commission Based Drivers{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    (Partner Owner-Operators · {filteredCommissionDrivers.length})
                  </span>
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
                  {commissionPct}% Commission
                </span>
              </div>
            </div>

            {filteredCommissionDrivers.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No commission drivers in this view.
              </p>
            ) : (
              <div className="space-y-4">
                {filteredCommissionDrivers.map((d) => renderDriverCard(d))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
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

const ADMIN_NAV: Array<{ label: string; items: Array<[id: string, title: string]> }> = [
  {
    label: "Rides",
    items: [
      ["bookings", "Bookings"],
      ["live-map", "Live map"],
      ["fleet", "Fleet & bays"],
    ],
  },
  {
    label: "Drivers",
    items: [
      ["drivers", "Drivers"],
      ["applications", "Applications"],
    ],
  },
  {
    label: "Money",
    items: [
      ["cash", "Cash settlements"],
      ["commissions", "Commission ledger"],
      ["cancellation-fees", "Cancellation fees"],
      ["pricing", "Pricing"],
      ["gst", "GST & invoices"],
    ],
  },
  {
    label: "Customers",
    items: [
      ["support", "Support & refunds"],
      ["enquiries", "Business enquiries"],
    ],
  },
];

function adminSectionLabel(id: string): string {
  if (id === "hub") return "Overview";
  for (const group of ADMIN_NAV) {
    const hit = group.items.find(([itemId]) => itemId === id);
    if (hit) return hit[1];
  }
  return "Admin";
}

/** Grouped admin navigation: a sidebar on desktop, one dropdown on phones. */
function AdminNav({
  active,
  onSelect,
  counts,
}: {
  active: string;
  onSelect: (id: string) => void;
  counts: Record<string, number>;
}) {
  const item = (id: string, title: string) => {
    const isActive = active === id;
    const n = counts[id] ?? 0;
    return (
      <li key={id}>
        <button
          type="button"
          onClick={() => onSelect(id)}
          aria-current={isActive ? "page" : undefined}
          className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
            isActive
              ? "bg-muted font-medium text-foreground"
              : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
          }`}
        >
          <span>{title}</span>
          {n > 0 && <span className="text-xs tabular-nums text-primary">{n}</span>}
        </button>
      </li>
    );
  };

  return (
    <>
      <div className="mb-6 lg:hidden">
        <label className="sr-only" htmlFor="admin-section">
          Admin section
        </label>
        <select
          id="admin-section"
          value={active}
          onChange={(e) => onSelect(e.target.value)}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="hub">Overview</option>
          {ADMIN_NAV.map((group) => (
            <optgroup key={group.label} label={group.label}>
              {group.items.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                  {counts[id] ? ` (${counts[id]})` : ""}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      <nav aria-label="Admin" className="hidden lg:block">
        <div className="sticky top-24 space-y-5">
          <ul>{item("hub", "Overview")}</ul>
          {ADMIN_NAV.map((group) => (
            <div key={group.label}>
              <p className="mb-1 px-2.5 text-xs font-medium text-muted-foreground/70">
                {group.label}
              </p>
              <ul className="space-y-0.5">{group.items.map(([id, title]) => item(id, title))}</ul>
            </div>
          ))}
        </div>
      </nav>
    </>
  );
}

/** Admin landing view: the few numbers that matter, and what needs attention. */
function AdminOverview({
  stats,
  onSelect,
}: {
  stats: {
    activeBookings: number;
    totalBookings: number;
    completedBookings: number;
    totalRevenue: number;
    onlineDrivers: number;
    totalDrivers: number;
    pendingApplications: number;
    newEnquiries: number;
  };
  onSelect: (id: string) => void;
}) {
  const figures: Array<{ label: string; value: string; note: string; to: string }> = [
    {
      label: "Rides in progress",
      value: String(stats.activeBookings),
      note: `${stats.totalBookings} bookings in total`,
      to: "bookings",
    },
    {
      label: "Drivers online",
      value: String(stats.onlineDrivers),
      note: `of ${stats.totalDrivers} drivers`,
      to: "live-map",
    },
    {
      label: "Revenue",
      value: `₹${Math.round(stats.totalRevenue).toLocaleString("en-IN")}`,
      note: `${stats.completedBookings} completed rides`,
      to: "commissions",
    },
  ];
  const todo = [
    { n: stats.pendingApplications, text: "driver applications to review", to: "applications" },
    { n: stats.newEnquiries, text: "new business enquiries", to: "enquiries" },
  ].filter((t) => t.n > 0);

  return (
    <div className="space-y-10">
      <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        {figures.map((f) => (
          <button
            key={f.label}
            type="button"
            onClick={() => onSelect(f.to)}
            className="bg-background p-5 text-left transition-colors hover:bg-muted/40"
          >
            <dt className="text-sm text-muted-foreground">{f.label}</dt>
            <dd className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{f.value}</dd>
            <dd className="mt-1 text-xs text-muted-foreground">{f.note}</dd>
          </button>
        ))}
      </dl>

      <section>
        <h2 className="text-sm font-medium">Needs attention</h2>
        {todo.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Nothing waiting right now.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border border-y border-border">
            {todo.map((t) => (
              <li key={t.to}>
                <button
                  type="button"
                  onClick={() => onSelect(t.to)}
                  className="flex w-full items-center justify-between py-3 text-left text-sm hover:text-primary"
                >
                  <span>
                    <span className="font-medium tabular-nums">{t.n}</span> {t.text}
                  </span>
                  <ArrowRight className="size-4 text-muted-foreground" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
