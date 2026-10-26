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
import { isCommissionDriver, partnerLedger } from "@/lib/driver-type";
import { usePricingSettings } from "@/lib/pricing";
import { toast } from "sonner";
import { UpiQrDialog, type UpiQrRequest } from "@/components/upi-qr-dialog";

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
  direction?: "driver_to_company" | "company_to_driver";
}

const DEFAULT_SAMPLE_COMMISSION_SETTLEMENTS: CommissionSettlement[] = [];

// Clean up any stale dummy data from localStorage so old sample values never contaminate live state
function cleanupDummyData() {
  if (typeof window === "undefined") return;
  try {
    const storedComm = localStorage.getItem("orange_commission_settlements");
    if (storedComm) {
      const comms = JSON.parse(storedComm);
      const cleaned = comms.filter(
        (c: any) =>
          c.id !== "comm-1001" &&
          c.id !== "comm-1002" &&
          c.driver_id !== "partner-sample-1" &&
          c.driver_id !== "partner-sample-2" &&
          c.driver_name !== "Vikramaditya Rao" &&
          c.driver_name !== "Sunil Gowda",
      );
      localStorage.setItem("orange_commission_settlements", JSON.stringify(cleaned));
    }
    const storedPV = localStorage.getItem("orange_partner_vehicles");
    if (storedPV) {
      const pvs = JSON.parse(storedPV);
      const cleaned = pvs.filter(
        (pv: any) =>
          pv.id !== "pv-2001" &&
          pv.id !== "pv-2002" &&
          pv.owner_name !== "Vikramaditya Rao" &&
          pv.owner_name !== "Sunil Gowda",
      );
      localStorage.setItem("orange_partner_vehicles", JSON.stringify(cleaned));
    }
  } catch {
    // best-effort: failure here is non-fatal and intentionally ignored
  }
}

interface CommissionLedgerManagerProps {
  drivers: any[];
  bookings: any[];
  onRefresh: () => void;
  onNavigateTab?: (tab: string) => void;
}

export function CommissionLedgerManager({
  drivers,
  bookings,
  onRefresh,
  onNavigateTab,
}: CommissionLedgerManagerProps) {
  const [settlements, setSettlements] = useState<CommissionSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedDriverId, setExpandedDriverId] = useState<string | null>(null);

  // Settlement recording modal
  const [isRecording, setIsRecording] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [settleAmount, setSettleAmount] = useState<number | "">("");
  const [paymentMode, setPaymentMode] = useState<"upi_qr" | "upi" | "bank_transfer" | "cash">(
    "upi_qr",
  );
  const [commissionQr, setCommissionQr] = useState<{ req: UpiQrRequest; name: string } | null>(
    null,
  );
  const [direction, setDirection] = useState<"driver_to_company" | "company_to_driver">(
    "driver_to_company",
  );
  useEffect(() => {
    if (direction === "company_to_driver" && paymentMode === "upi_qr") setPaymentMode("upi");
  }, [direction, paymentMode]);
  const [referenceNo, setReferenceNo] = useState("");
  const [collectorName, setCollectorName] = useState("Admin");
  const [settleNotes, setSettleNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Load partner vehicles to link any driver-owned cars
  const [partnerVehicles, setPartnerVehicles] = useState<any[]>([]);

  // Load commission settlements
  async function loadSettlements() {
    setLoading(true);
    cleanupDummyData();
    const { data, error } = await supabase
      .from("driver_commission_settlements")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Could not load commission settlements: " + error.message);
    setSettlements((data as unknown as CommissionSettlement[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    cleanupDummyData();
    loadSettlements();

    const handleUpdate = () => loadSettlements();
    window.addEventListener("commission_settlements_updated", handleUpdate);
    window.addEventListener("storage", handleUpdate);

    return () => {
      window.removeEventListener("commission_settlements_updated", handleUpdate);
      window.removeEventListener("storage", handleUpdate);
    };
  }, []);

  // Commission drivers = drivers.driver_type 'partner' (set in Admin → Drivers). Company drivers
  // are in Cash Settlements instead, so each driver appears in exactly one place.
  const activePartnerDrivers = drivers.filter(isCommissionDriver);
  const pricing = usePricingSettings();
  const pct = pricing.partner_commission_percent;

  // Cash / own-UPI rides: the driver holds the fare and owes the company its commission.
  // Online / wallet rides: the company holds the fare and owes the driver their share.
  function getPartnerCommissionStats(driverId: string, _driverName?: string) {
    const driverRides = bookings.filter(
      (b) => b.driver_id === driverId && b.status === "completed",
    );
    const driverSettlements = settlements.filter((s) => s.driver_id === driverId);
    const l = partnerLedger(driverRides, driverSettlements, pct);
    return {
      ...l,
      ridesCount: l.rides,
      commissionRatePct: l.commissionPct,
      commissionPayable: l.commissionOnCash,
      commissionPaid: l.paidByDriver,
      outstandingCommission: Math.max(0, l.balance),
      owedToDriver: Math.max(0, -l.balance),
      partnerNetEarnings: l.grossFare - l.commissionTotal,
      rides: driverRides,
      settlements: driverSettlements,
    };
  }

  const allStats = activePartnerDrivers.map((d) => getPartnerCommissionStats(d.id));
  const totalPartnerGrossFare = allStats.reduce((sum, x) => sum + x.grossFare, 0);
  const totalCommissionEarned = allStats.reduce((sum, x) => sum + x.commissionTotal, 0);
  const totalCommissionPaid = allStats.reduce((sum, x) => sum + x.paidByDriver, 0);
  const totalCommissionOutstanding = allStats.reduce((sum, x) => sum + x.outstandingCommission, 0);
  const totalOwedToDrivers = allStats.reduce((sum, x) => sum + x.owedToDriver, 0);

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
    const toCompany = direction === "driver_to_company";
    const maxDue = toCompany ? stats.outstandingCommission : stats.owedToDriver;

    if (maxDue <= 0) {
      toast.error(
        toCompany
          ? `${targetDriver.full_name} owes no commission right now.`
          : `Nothing is owed to ${targetDriver.full_name} right now.`,
      );
      return;
    }
    if (amt > maxDue) {
      toast.error(`The amount can't be more than ₹${maxDue.toLocaleString("en-IN")}.`);
      return;
    }

    if (paymentMode === "upi_qr") {
      if (!toCompany) {
        toast.error("A UPI QR collects money from the driver. Pick another mode for payouts.");
        return;
      }
      setCommissionQr({
        req: { kind: "commission", driverId: targetDriver.id, amount: amt },
        name: targetDriver.full_name,
      });
      return;
    }

    setSubmitting(true);
    const { error } = await supabase.from("driver_commission_settlements").insert({
      driver_id: targetDriver.id,
      driver_name: targetDriver.full_name,
      amount: amt,
      direction,
      payment_mode: paymentMode,
      reference_no: referenceNo.trim() || `REF-${Date.now().toString().slice(-6)}`,
      collected_by: collectorName.trim() || "Admin",
      notes:
        settleNotes.trim() ||
        (toCompany
          ? `${pct}% commission received from driver`
          : "Driver's share of online / wallet rides paid out"),
    } as never);
    setSubmitting(false);
    if (error) {
      toast.error("Could not record the payment: " + error.message);
      return;
    }
    toast.success(
      toCompany
        ? `₹${amt} commission received from ${targetDriver.full_name}.`
        : `₹${amt} paid out to ${targetDriver.full_name}.`,
    );
    await loadSettlements();
    setIsRecording(false);
    setSelectedDriverId("");
    setSettleAmount("");
    setReferenceNo("");
    setSettleNotes("");
  }

  return (
    <div className="space-y-6">
      <UpiQrDialog
        request={commissionQr?.req ?? null}
        title={`Commission – ${commissionQr?.name ?? ""}`}
        onClose={() => setCommissionQr(null)}
        onPaid={() => {
          toast.success(`Commission received from ${commissionQr?.name ?? "driver"} by UPI.`);
          setIsRecording(false);
          setSelectedDriverId("");
          setSettleAmount("");
          setReferenceNo("");
          setSettleNotes("");
          loadSettlements();
        }}
      />
      {/* Header & Operating Model Badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="display-serif text-2xl font-bold">Partner Commission Management</h2>
            <Badge
              variant="outline"
              className="bg-primary/10 text-primary border-primary/30 text-xs"
            >
              {pct}% Platform Commission
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Everything for commission drivers: rides, commission owed on cash rides, their share of
            online rides, and payments in both directions.
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
              Drivers bringing their own EV keep <strong>{100 - pct}%</strong> of each fare; Orange
              Taxi keeps <strong>{pct}%</strong>. On cash rides the driver owes the company its{" "}
              {pct}%; on online / wallet rides the company owes the driver their {100 - pct}%.
              Commission drivers never appear in company cash settlements.
            </p>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className="rounded bg-background border border-border px-3 py-1.5 font-mono font-bold text-primary">
            Split: {100 - pct}% Driver / {pct}% Company
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
          <p className="text-xs text-muted-foreground mt-0.5">{pct}% of all partner rides</p>
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
          <p className="text-xs text-muted-foreground mt-0.5">
            Receivable from drivers · we owe drivers ₹{totalOwedToDrivers.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      {/* Record Commission Payment Modal */}
      {isRecording &&
        (() => {
          const targetDriver = activePartnerDrivers.find((d) => d.id === selectedDriverId);
          const selectedStats = targetDriver
            ? getPartnerCommissionStats(targetDriver.id, targetDriver.full_name)
            : null;
          const maxDue = selectedStats
            ? direction === "driver_to_company"
              ? selectedStats.outstandingCommission
              : selectedStats.owedToDriver
            : 0;
          const isExceeding = Boolean(
            selectedDriverId && settleAmount !== "" && Number(settleAmount) > maxDue,
          );

          return (
            <form
              onSubmit={handleRecordSettlement}
              className="rounded-xl border border-primary/40 bg-primary/5 p-5  slide-in-from-top-3 duration-200"
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
                        const dir =
                          stats.owedToDriver > 0 ? "company_to_driver" : "driver_to_company";
                        setDirection(dir);
                        const due =
                          dir === "company_to_driver"
                            ? stats.owedToDriver
                            : stats.outstandingCommission;
                        setSettleAmount(due > 0 ? due : "");
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
                          {d.full_name} ({d.vehicle_number || "Partner EV"}) —{" "}
                          {stats.owedToDriver > 0
                            ? `we owe ₹${stats.owedToDriver}`
                            : `owes ₹${stats.outstandingCommission}`}
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
                      Cannot exceed ₹{maxDue}
                    </p>
                  )}
                  {selectedDriverId && maxDue <= 0 && (
                    <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="size-3 shrink-0" />
                      Nothing is due in this direction (₹0)
                    </p>
                  )}
                </div>

                {/* Direction */}
                <div>
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Who paid whom *
                  </label>
                  <select
                    value={direction}
                    onChange={(e) => {
                      const dir = e.target.value as typeof direction;
                      setDirection(dir);
                      if (selectedStats) {
                        const due =
                          dir === "company_to_driver"
                            ? selectedStats.owedToDriver
                            : selectedStats.outstandingCommission;
                        setSettleAmount(due > 0 ? due : "");
                      }
                    }}
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-primary"
                  >
                    <option value="driver_to_company">Driver paid commission to company</option>
                    <option value="company_to_driver">Company paid driver their share</option>
                  </select>
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
                    {direction === "driver_to_company" && (
                      <option value="upi_qr">UPI – show QR (auto-recorded)</option>
                    )}
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
                  {paymentMode === "upi_qr" && direction === "driver_to_company"
                    ? "Show UPI QR"
                    : "Save Commission Settlement"}
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
              Partner Owner-Operator Accounts ({activePartnerDrivers.length})
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            Platform Fee: {pct}% · Retained by Partner: {100 - pct}%
          </span>
        </div>

        <div className="divide-y divide-border">
          {activePartnerDrivers.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="size-14 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
                <Handshake className="size-7" />
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <h4 className="font-bold text-base text-foreground">No Partner Drivers Yet</h4>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Currently, all active drivers are company fleet drivers. Partner owner-operators
                  who bring their own EV keep {100 - pct}% of each fare and pay a {pct}% commission.
                  Mark a driver as a commission driver in Admin → Drivers.
                </p>
              </div>
              <div className="pt-2 flex items-center justify-center gap-3">
                {onNavigateTab && (
                  <Button
                    size="sm"
                    onClick={() => onNavigateTab("drivers")}
                    className="text-xs font-semibold gap-1.5"
                  >
                    <Users className="size-3.5" /> Manage Drivers
                  </Button>
                )}
                {onNavigateTab && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigateTab("applications")}
                    className="text-xs font-semibold gap-1.5"
                  >
                    Review Applications
                  </Button>
                )}
              </div>
            </div>
          ) : filteredDrivers.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No partner drivers matching &quot;{search}&quot;.
            </p>
          ) : (
            filteredDrivers.map((d) => {
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
                            {d.vehicle_number || "Partner EV"}
                          </span>
                          <span>·</span>
                          <span>{d.vehicle_model || "Electric Vehicle"}</span>
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
                          {pct}% Comm. on cash rides
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
                        <p className="text-[10px] uppercase font-semibold">Balance</p>
                        <p className="mt-1 font-bold font-mono">
                          {stats.outstandingCommission > 0
                            ? `Driver owes ₹${stats.outstandingCommission.toLocaleString("en-IN")}`
                            : stats.owedToDriver > 0
                              ? `We owe ₹${stats.owedToDriver.toLocaleString("en-IN")}`
                              : "Cleared ✓"}
                        </p>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        disabled={stats.outstandingCommission <= 0 && stats.owedToDriver <= 0}
                        onClick={() => {
                          setSelectedDriverId(d.id);
                          const dir =
                            stats.owedToDriver > 0 ? "company_to_driver" : "driver_to_company";
                          setDirection(dir);
                          setSettleAmount(
                            dir === "company_to_driver"
                              ? stats.owedToDriver
                              : stats.outstandingCommission,
                          );
                          setIsRecording(true);
                        }}
                        className={`h-8 text-xs font-semibold gap-1 ${
                          stats.outstandingCommission > 0 || stats.owedToDriver > 0
                            ? "bg-primary"
                            : "opacity-50 cursor-not-allowed"
                        }`}
                        title={
                          stats.outstandingCommission > 0
                            ? `Driver owes ₹${stats.outstandingCommission}`
                            : stats.owedToDriver > 0
                              ? `We owe the driver ₹${stats.owedToDriver}`
                              : "Nothing due either way"
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
                          Cash rides ₹{stats.cashFare.toLocaleString("en-IN")} · Online rides ₹
                          {stats.onlineFare.toLocaleString("en-IN")} · Net partner take-home (
                          {100 - pct}%):{" "}
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
                                <span
                                  className={`font-mono font-bold text-sm ${s.direction === "company_to_driver" ? "text-blue-600" : "text-emerald-600"}`}
                                >
                                  {s.direction === "company_to_driver" ? "Paid out " : "Received "}₹
                                  {Math.round(s.amount).toLocaleString("en-IN")}
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
            })
          )}
        </div>
      </div>
    </div>
  );
}
