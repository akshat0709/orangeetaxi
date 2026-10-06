// @ts-nocheck

import { useState, useEffect } from "react";
import {
  Percent,
  BadgeIndianRupee,
  Receipt,
  CheckCircle2,
  Clock,
  Search,
  Plus,
  X,
  Check,
  RotateCcw,
  AlertTriangle,
  Copy,
  Users,
  Calendar,
  DollarSign,
  Building2,
  Handshake,
  ShieldCheck,
  Car,
  Phone,
  ArrowUpRight,
  Sparkles,
  ChevronDown,
  ChevronUp,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface CommissionSettlement {
  id: string;
  driver_id: string;
  driver_name: string;
  amount: number;
  payment_mode: "upi" | "bank_transfer" | "cash";
  reference_no?: string;
  collected_by: string;
  notes?: string;
  created_at: string;
}

const DEFAULT_SAMPLE_COMMISSION_SETTLEMENTS: CommissionSettlement[] = [
  {
    id: "comm-1001",
    driver_id: "partner-sample-1",
    driver_name: "Vikramaditya Rao",
    amount: 1450,
    payment_mode: "upi",
    reference_no: "UPI/3981024982/HDFC",
    collected_by: "Admin",
    notes: "Weekly 15% platform fee settlement",
    created_at: new Date(Date.now() - 3 * 86400000).toISOString(),
  },
  {
    id: "comm-1002",
    driver_id: "partner-sample-2",
    driver_name: "Sunil Gowda",
    amount: 2200,
    payment_mode: "bank_transfer",
    reference_no: "NEFT-SBIN00084920",
    collected_by: "Admin",
    notes: "Bi-weekly commission clearance",
    created_at: new Date(Date.now() - 6 * 86400000).toISOString(),
  },
];

interface CommissionLedgerManagerProps {
  drivers: any[];
  bookings: any[];
  onRefresh: () => void;
}

export function CommissionLedgerManager({
  drivers,
  bookings,
  onRefresh,
}: CommissionLedgerManagerProps) {
  const [settlements, setSettlements] = useState<CommissionSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);

  // Settlement recording modal
  const [isRecording, setIsRecording] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [settleAmount, setSettleAmount] = useState<number | "">("");
  const [paymentMode, setPaymentMode] = useState<"upi" | "bank_transfer" | "cash">("upi");
  const [referenceNo, setReferenceNo] = useState("");
  const [collectorName, setCollectorName] = useState("Admin");
  const [settleNotes, setSettleNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load partner vehicles to link any driver-owned cars
  const [partnerVehicles, setPartnerVehicles] = useState<any[]>([]);

  // Load commission settlements
  async function loadSettlements() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("driver_commission_settlements")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        setSettlements(data as CommissionSettlement[]);
      } else {
        const stored = localStorage.getItem("orange_commission_settlements");
        if (stored) {
          try {
            setSettlements(JSON.parse(stored));
          } catch (e) {
            setSettlements(DEFAULT_SAMPLE_COMMISSION_SETTLEMENTS);
          }
        } else {
          setSettlements(DEFAULT_SAMPLE_COMMISSION_SETTLEMENTS);
          localStorage.setItem(
            "orange_commission_settlements",
            JSON.stringify(DEFAULT_SAMPLE_COMMISSION_SETTLEMENTS),
          );
        }
      }
    } catch (e) {
      const stored = localStorage.getItem("orange_commission_settlements");
      if (stored) {
        try {
          setSettlements(JSON.parse(stored));
        } catch (err) {}
      } else {
        setSettlements(DEFAULT_SAMPLE_COMMISSION_SETTLEMENTS);
      }
    }

    // Also load partner vehicles
    const pCars = localStorage.getItem("orange_partner_vehicles");
    if (pCars) {
      try {
        setPartnerVehicles(JSON.parse(pCars));
      } catch (e) {}
    }

    setLoading(false);
  }

  useEffect(() => {
    loadSettlements();

    const handleUpdate = () => loadSettlements();
    window.addEventListener("commission_settlements_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("commission_settlements_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Filter partner drivers
  const partnerDriversList = drivers.filter((d) => {
    if (d.driver_type === "partner" || d.owns_vehicle) return true;
    const hasPartnerCar = partnerVehicles.some(
      (pv) =>
        pv.owner_phone === d.phone || pv.owner_name?.toLowerCase() === d.full_name?.toLowerCase(),
    );
    return hasPartnerCar;
  });

  const activePartnerDrivers =
    partnerDriversList.length > 0
      ? partnerDriversList
      : [
          {
            id: "partner-sample-1",
            full_name: "Vikramaditya Rao",
            phone: "+91 98450 12345",
            city: "Bengaluru",
            vehicle_model: "Tata Nexon EV",
            vehicle_number: "KA 01 EV 4421",
            driver_type: "partner",
          },
          {
            id: "partner-sample-2",
            full_name: "Sunil Gowda",
            phone: "+91 97422 98765",
            city: "Bengaluru",
            vehicle_model: "Mahindra BE.6",
            vehicle_number: "KA 05 EV 8890",
            driver_type: "partner",
          },
        ];

  // Calculate commission metrics for each partner driver
  function getPartnerCommissionStats(driverId: string, driverName?: string) {
    const driverRides = bookings.filter(
      (b) =>
        (b.driver_id === driverId || (driverName && b.driver_name === driverName)) &&
        b.status === "completed",
    );

    let grossFare = driverRides.reduce(
      (sum, b) => sum + Math.round(Number(b.final_fare ?? b.estimated_fare ?? 0)),
      0,
    );
    let ridesCount = driverRides.length;

    if (ridesCount === 0 && driverId === "partner-sample-1") {
      grossFare = 14200;
      ridesCount = 18;
    } else if (ridesCount === 0 && driverId === "partner-sample-2") {
      grossFare = 21500;
      ridesCount = 26;
    }

    const commissionRate = 0.15; // 15% Platform Commission
    const commissionPayable = Math.round(grossFare * commissionRate);

    const driverSettlements = settlements.filter((s) => s.driver_id === driverId);
    const commissionPaid = driverSettlements.reduce(
      (sum, s) => sum + Math.round(Number(s.amount || 0)),
      0,
    );

    const outstandingCommission = Math.max(0, commissionPayable - commissionPaid);
    const partnerNetEarnings = Math.max(0, grossFare - commissionPayable); // 85%

    return {
      grossFare,
      ridesCount,
      commissionRatePct: 15,
      commissionPayable,
      commissionPaid,
      outstandingCommission,
      partnerNetEarnings,
      rides: driverRides,
      settlements: driverSettlements,
    };
  }

  // Aggregate totals across all partner drivers
  const totalPartnerGrossFare = activePartnerDrivers.reduce(
    (sum, d) => sum + getPartnerCommissionStats(d.id, d.full_name).grossFare,
    0,
  );
  const totalCommissionEarned = Math.round(totalPartnerGrossFare * 0.15);
  const totalCommissionPaid = settlements.reduce(
    (sum, s) => sum + Math.round(Number(s.amount || 0)),
    0,
  );
  const totalCommissionOutstanding = Math.max(0, totalCommissionEarned - totalCommissionPaid);

  // Filtered partner drivers
  const filteredDrivers = activePartnerDrivers.filter((d) => {
    const term = search.toLowerCase();
    return (
      d.full_name.toLowerCase().includes(term) ||
      d.phone?.toLowerCase().includes(term) ||
      d.vehicle_number?.toLowerCase().includes(term) ||
      d.vehicle_model?.toLowerCase().includes(term)
    );
  });

  // Handle Recording a Commission Settlement
  async function handleRecordSettlement(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDriverId) {
      toast.error("Please select a partner driver");
      return;
    }
    const amt = Math.round(Number(settleAmount));
    if (!amt || amt <= 0 || isNaN(amt)) {
      toast.error("Please enter a valid amount in whole rupees");
      return;
    }

    const targetDriver = activePartnerDrivers.find((d) => d.id === selectedDriverId);
    if (!targetDriver) return;

    const stats = getPartnerCommissionStats(targetDriver.id, targetDriver.full_name);
    const maxDue = stats.outstandingCommission;

    if (maxDue <= 0) {
      toast.error(`${targetDriver.full_name} has no outstanding commission due (₹0 to be paid).`);
      return;
    }

    if (amt > maxDue) {
      toast.error(
        `The maximum amount that can be collected cannot exceed ₹${maxDue.toLocaleString("en-IN")} (amount to be paid from ${targetDriver.full_name}).`,
      );
      return;
    }

    setSubmitting(true);
    const newRecord: CommissionSettlement = {
      id: "comm-" + Date.now(),
      driver_id: targetDriver.id,
      driver_name: targetDriver.full_name,
      amount: amt,
      payment_mode: paymentMode,
      reference_no: referenceNo.trim() || `REF-${Date.now().toString().slice(-6)}`,
      collected_by: collectorName.trim() || "Admin",
      notes: settleNotes.trim() || "15% platform commission settlement received",
      created_at: new Date().toISOString(),
    };

    // Try Supabase insert
    try {
      await supabase.from("driver_commission_settlements").insert({
        driver_id: newRecord.driver_id,
        amount: newRecord.amount,
        payment_mode: newRecord.payment_mode,
        reference_no: newRecord.reference_no,
        collected_by: newRecord.collected_by,
        notes: newRecord.notes,
      });
    } catch (e) {}

    // Update localStorage
    const stored = localStorage.getItem("orange_commission_settlements");
    const current: CommissionSettlement[] = stored
      ? JSON.parse(stored)
      : [...DEFAULT_SAMPLE_COMMISSION_SETTLEMENTS];
    current.unshift(newRecord);
    localStorage.setItem("orange_commission_settlements", JSON.stringify(current));
    window.dispatchEvent(new Event("commission_settlements_updated"));

    setSettlements(current);
    toast.success(`₹${amt} commission payment recorded for ${targetDriver.full_name}!`);
    setIsRecording(false);
    setSelectedDriverId("");
    setSettleAmount("");
    setReferenceNo("");
    setSettleNotes("");
    setSubmitting(false);
  }

  return (
    <div className="space-y-6">
      {/* Header & Operating Model Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="display-serif text-2xl font-bold">Partner Commission Management</h2>
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/30 text-xs"
            >
              15% Platform Commission
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Track ride revenues collected by partner owner-operators, monitor 15% platform fees owed
            to Orange Taxi, and record settlements.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setIsRecording(true);
              setSelectedDriverId("");
              setSettleAmount("");
            }}
            className="gap-2 text-xs font-semibold h-9 bg-primary"
          >
            <Plus className="size-4" /> Record Commission Payment
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              loadSettlements();
              onRefresh();
            }}
            className="h-9 px-2 text-muted-foreground hover:text-foreground"
            title="Refresh Commission Ledger"
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>

      {/* Model Definition Card */}
      <div className="rounded-xl border border-primary/25 bg-primary/5 p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 text-xs">
        <div className="flex items-start gap-3">
          <div className="size-9 rounded-lg bg-primary/20 flex items-center justify-center text-primary shrink-0">
            <Handshake className="size-5" />
          </div>
          <div className="space-y-0.5">
            <p className="font-bold text-sm text-foreground flex items-center gap-2">
              Partner Owner-Operator Operating Framework
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Drivers bringing their own Orange Standard EV retain <strong>85%</strong> of all ride
              fares. A <strong>15% platform commission</strong> is payable to Orange Taxi Limited.
              Partner drivers do not appear in company depot cash surrender.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="rounded bg-background border border-border px-3 py-1.5 font-mono font-bold text-primary">
            Split: 85% Driver / 15% Company
          </span>
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Gross Fares</span>
            <BadgeIndianRupee className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono">
            ₹{totalPartnerGrossFare.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">All partner rides</p>
        </div>

        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Commission Earned
            </span>
            <Percent className="size-4 text-blue-600" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-blue-600">
            ₹{totalCommissionEarned.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">15% Orange Taxi fee</p>
        </div>

        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Commission Paid
            </span>
            <CheckCircle2 className="size-4 text-emerald-600" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-emerald-600">
            ₹{totalCommissionPaid.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Deposited by partners</p>
        </div>

        <div className="rounded-xl border border-border bg-background p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Outstanding Due
            </span>
            <Clock className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold font-mono text-amber-500">
            ₹{totalCommissionOutstanding.toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">Receivable from drivers</p>
        </div>
      </div>

      {/* Record Commission Payment Modal */}
      {isRecording &&
        (() => {
          const targetDriver = activePartnerDrivers.find((d) => d.id === selectedDriverId);
          const selectedStats = targetDriver
            ? getPartnerCommissionStats(targetDriver.id, targetDriver.full_name)
            : null;
          const maxDue = selectedStats ? selectedStats.outstandingCommission : 0;
          const isExceeding = Boolean(
            selectedDriverId && settleAmount !== "" && Number(settleAmount) > maxDue,
          );

          return (
            <form
              onSubmit={handleRecordSettlement}
              className="rounded-xl border border-primary/40 bg-primary/5 p-5 animate-in fade-in slide-in-from-top-3 duration-200"
            >
              <div className="flex items-center justify-between border-b border-primary/20 pb-3">
                <div className="flex items-center gap-2">
                  <Plus className="size-4 text-primary" />
                  <p className="text-sm font-bold uppercase tracking-wider text-primary">
                    Record Partner Commission Deposit
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRecording(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* Driver Select */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Partner Driver *
                  </label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => {
                      const dId = e.target.value;
                      setSelectedDriverId(dId);
                      if (dId) {
                        const dObj = activePartnerDrivers.find((d) => d.id === dId);
                        const stats = getPartnerCommissionStats(dId, dObj?.full_name);
                        setSettleAmount(
                          stats.outstandingCommission > 0 ? stats.outstandingCommission : "",
                        );
                      } else {
                        setSettleAmount("");
                      }
                    }}
                    required
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="">-- Choose Partner Driver --</option>
                    {activePartnerDrivers.map((d) => {
                      const stats = getPartnerCommissionStats(d.id, d.full_name);
                      return (
                        <option key={d.id} value={d.id}>
                          {d.full_name} ({d.vehicle_number || "Partner EV"}) — Due: ₹
                          {stats.outstandingCommission}
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Amount */}
                <div>
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                      Amount Received (₹) *
                    </label>
                    {selectedDriverId && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Max:{" "}
                        <strong
                          className={
                            maxDue > 0 ? "text-primary font-bold" : "text-muted-foreground"
                          }
                        >
                          ₹{maxDue}
                        </strong>
                      </span>
                    )}
                  </div>
                  <div className="relative mt-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-bold text-xs">
                      ₹
                    </span>
                    <input
                      type="number"
                      min="1"
                      max={maxDue > 0 ? maxDue : undefined}
                      step="1"
                      value={settleAmount}
                      onKeyDown={(e) => {
                        if (
                          e.key === "." ||
                          e.key === "e" ||
                          e.key === "E" ||
                          e.key === "+" ||
                          e.key === "-"
                        ) {
                          e.preventDefault();
                        }
                      }}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "") {
                          setSettleAmount("");
                        } else {
                          const num = Math.round(Number(val));
                          setSettleAmount(isNaN(num) ? "" : num);
                        }
                      }}
                      placeholder={maxDue > 0 ? `Max ₹${maxDue}` : "e.g. 1500"}
                      required
                      className={`w-full rounded-lg border bg-background py-2 pl-7 pr-3 text-xs font-mono font-bold text-foreground outline-none transition-colors ${
                        isExceeding
                          ? "border-destructive focus:border-destructive focus:ring-1 focus:ring-destructive text-destructive"
                          : "border-border focus:border-primary focus:ring-1 focus:ring-primary"
                      }`}
                    />
                  </div>
                  {isExceeding && (
                    <p className="mt-1 text-[11px] font-semibold text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3 shrink-0" />
                      Cannot exceed ₹{maxDue} (commission due from driver)
                    </p>
                  )}
                  {selectedDriverId && maxDue <= 0 && (
                    <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="size-3 shrink-0" />
                      Driver has cleared all commission due (₹0 to be paid)
                    </p>
                  )}
                </div>

                {/* Payment Mode */}
                <div>
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Payment Mode *
                  </label>
                  <select
                    value={paymentMode}
                    onChange={(e) => setPaymentMode(e.target.value as any)}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary focus:ring-1 focus:ring-primary cursor-pointer"
                  >
                    <option value="upi">UPI Transfer</option>
                    <option value="bank_transfer">Bank Transfer (NEFT/IMPS)</option>
                    <option value="cash">Cash Deposit at Depot</option>
                  </select>
                </div>

                {/* Reference No */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Transaction Ref / UTR / Receipt No.
                  </label>
                  <input
                    type="text"
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="e.g. UPI/4019284092/HDFC or Cash Receipt #104"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>

                {/* Notes */}
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Admin Notes
                  </label>
                  <input
                    type="text"
                    value={settleNotes}
                    onChange={(e) => setSettleNotes(e.target.value)}
                    placeholder="e.g. Cleared commission for August rides"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>

              {/* Quick Presets for Partner Driver */}
              {selectedDriverId && maxDue > 0 && (
                <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground pt-2 border-t border-primary/20">
                  <span>Quick Preset (Max ₹{maxDue}):</span>
                  <button
                    type="button"
                    onClick={() => setSettleAmount(maxDue)}
                    className="rounded bg-primary/10 text-primary px-2 py-0.5 font-bold hover:bg-primary/20 border border-primary/30"
                  >
                    Full Outstanding Due (₹{maxDue})
                  </button>
                  {[500, 1000, 2000]
                    .filter((val) => val <= maxDue && val !== maxDue)
                    .map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setSettleAmount(val)}
                        className="rounded border border-border bg-background px-2 py-0.5 text-muted-foreground hover:bg-muted font-mono"
                      >
                        ₹{val}
                      </button>
                    ))}
                </div>
              )}

              <div className="mt-4 flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsRecording(false)}
                  className="text-xs"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={
                    submitting || !settleAmount || !selectedDriverId || isExceeding || maxDue <= 0
                  }
                  className="text-xs font-semibold gap-1.5 disabled:opacity-50"
                >
                  {submitting ? "Saving..." : <Check className="size-3.5" />}
                  Save Commission Settlement
                </Button>
              </div>
            </form>
          );
        })()}

      {/* Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search partner drivers by name, phone, plate, or vehicle model..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-4 text-xs outline-none focus:border-primary focus:ring-1 focus:ring-primary"
          />
        </div>
        {search && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearch("")}
            className="text-xs h-10 px-3"
          >
            Clear
          </Button>
        )}
      </div>

      {/* Partner Drivers Commission Ledger Table */}
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <div className="border-b border-border bg-muted/40 px-6 py-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Handshake className="size-4 text-primary" />
            <h3 className="font-bold text-sm">
              Partner Owner-Operator Accounts ({filteredDrivers.length})
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            Platform Fee: 15% · Retained by Partner: 85%
          </span>
        </div>

        <div className="divide-y divide-border">
          {filteredDrivers.map((d) => {
            const stats = getPartnerCommissionStats(d.id, d.full_name);
            const isExpanded = expandedDriverId === d.id;

            return (
              <div key={d.id} className="hover:bg-muted/15 transition-colors">
                <div className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  {/* Driver & Car info */}
                  <div className="flex items-center gap-3.5">
                    <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary/10 text-base font-bold text-primary">
                      {d.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm text-foreground">{d.full_name}</p>
                        <span className="rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400">
                          Partner Owner
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
                        <span className="font-mono font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                          {d.vehicle_number || "KA 01 EV 4421"}
                        </span>
                        <span>·</span>
                        <span>{d.vehicle_model || "Tata Nexon EV"}</span>
                        <span>·</span>
                        {d.phone && (
                          <a
                            href={`tel:${d.phone.replace(/\s+/g, "")}`}
                            className="font-mono text-muted-foreground hover:text-primary transition-colors flex items-center gap-1"
                          >
                            <Phone className="size-3" /> {d.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Financial Metrics Row */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs shrink-0">
                    <div className="rounded-lg bg-muted/40 p-2.5">
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                        Completed Trips
                      </p>
                      <p className="mt-1 font-bold text-foreground">{stats.ridesCount} rides</p>
                    </div>

                    <div className="rounded-lg bg-muted/40 p-2.5">
                      <p className="text-[10px] uppercase font-semibold text-muted-foreground">
                        Gross Fare
                      </p>
                      <p className="mt-1 font-bold font-mono text-foreground">
                        ₹{stats.grossFare.toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-2.5">
                      <p className="text-[10px] uppercase font-semibold text-blue-600 dark:text-blue-400">
                        15% Comm. Due
                      </p>
                      <p className="mt-1 font-bold font-mono text-blue-600 dark:text-blue-400">
                        ₹{stats.commissionPayable.toLocaleString("en-IN")}
                      </p>
                    </div>

                    <div
                      className={`rounded-lg p-2.5 border ${
                        stats.outstandingCommission > 0
                          ? "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400"
                          : "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      }`}
                    >
                      <p className="text-[10px] uppercase font-semibold">Outstanding</p>
                      <p className="mt-1 font-bold font-mono">
                        {stats.outstandingCommission > 0
                          ? `₹${stats.outstandingCommission.toLocaleString("en-IN")}`
                          : "Cleared ✓"}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <Button
                      size="sm"
                      disabled={stats.outstandingCommission <= 0}
                      onClick={() => {
                        setSelectedDriverId(d.id);
                        setSettleAmount(
                          stats.outstandingCommission > 0 ? stats.outstandingCommission : "",
                        );
                        setIsRecording(true);
                      }}
                      className={`h-8 text-xs font-semibold gap-1 ${
                        stats.outstandingCommission > 0
                          ? "bg-primary"
                          : "opacity-50 cursor-not-allowed"
                      }`}
                      title={
                        stats.outstandingCommission > 0
                          ? `Settle up to ₹${stats.outstandingCommission}`
                          : "Driver has no outstanding commission (₹0 to be paid)"
                      }
                    >
                      <Receipt className="size-3.5" /> Settle
                    </Button>
                    <button
                      type="button"
                      onClick={() => setExpandedDriverId(isExpanded ? null : d.id)}
                      className="h-8 px-2.5 rounded-lg border border-border text-xs font-semibold hover:bg-muted transition-colors flex items-center gap-1"
                    >
                      {isExpanded ? (
                        <ChevronUp className="size-3.5" />
                      ) : (
                        <ChevronDown className="size-3.5" />
                      )}
                      History
                    </button>
                  </div>
                </div>

                {/* Expanded Payment History */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/20 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Receipt className="size-3.5 text-primary" /> Settlement History for{" "}
                        {d.full_name}
                      </h4>
                      <span className="text-xs text-muted-foreground">
                        Net partner take-home (85%):{" "}
                        <strong className="text-emerald-600 font-mono">
                          ₹{stats.partnerNetEarnings.toLocaleString("en-IN")}
                        </strong>
                      </span>
                    </div>

                    {stats.settlements.length === 0 ? (
                      <p className="text-xs text-muted-foreground py-3">
                        No commission settlements recorded yet for this partner.
                      </p>
                    ) : (
                      <div className="divide-y divide-border/60 rounded-lg border border-border bg-background overflow-hidden text-xs">
                        {stats.settlements.map((s) => (
                          <div key={s.id} className="p-3 flex items-center justify-between gap-3">
                            <div className="space-y-0.5">
                              <p className="font-mono font-bold text-foreground">
                                {s.reference_no || s.id}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {new Date(s.created_at).toLocaleDateString("en-IN", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                · Recorded by {s.collected_by}
                              </p>
                              {s.notes && (
                                <p className="text-[11px] text-muted-foreground/80 italic">
                                  {s.notes}
                                </p>
                              )}
                            </div>
                            <div className="text-right shrink-0">
                              <span className="font-mono font-bold text-emerald-600 text-sm">
                                +₹{Math.round(s.amount).toLocaleString("en-IN")}
                              </span>
                              <p className="text-[10px] uppercase font-semibold text-muted-foreground mt-0.5">
                                {s.payment_mode?.replace("_", " ")}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
