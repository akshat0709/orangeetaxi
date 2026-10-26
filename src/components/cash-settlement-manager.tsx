import { useState, useEffect } from "react";
import {
  Banknote,
  Wallet,
  Receipt,
  CheckCircle2,
  Search,
  X,
  Check,
  RotateCcw,
  AlertTriangle,
  Building2,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { isCommissionDriver } from "@/lib/driver-type";
import { toast } from "sonner";
import { UpiQrDialog, type UpiQrRequest } from "@/components/upi-qr-dialog";

export interface CashSettlement {
  id: string;
  driver_id: string;
  amount: number;
  collected_by: string;
  notes?: string;
  created_at: string;
}

interface CashSettlementManagerProps {
  drivers: any[];
  bookings: any[];
  onRefresh: () => void;
}

export function CashSettlementManager({
  drivers,
  bookings,
  onRefresh,
}: CashSettlementManagerProps) {
  const [settlements, setSettlements] = useState<CashSettlement[]>([]);
  const [loading, setLoading] = useState(true);
  const [isUsingFallback, setIsUsingFallback] = useState(false);
  const [search, setSearch] = useState("");

  // Collection form state
  const [isCollecting, setIsCollecting] = useState(false);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [collectionAmount, setCollectionAmount] = useState<number | "">("");
  const [collectionNotes, setCollectionNotes] = useState("");
  const [collectorName, setCollectorName] = useState("Admin");
  const [submitting, setSubmitting] = useState(false);
  // Cash in hand, or the driver pays by scanning a Razorpay UPI QR (money lands in Orange Taxi's account).
  const [collectMode, setCollectMode] = useState<"cash" | "upi">("cash");
  const [depositQr, setDepositQr] = useState<{ req: UpiQrRequest; name: string } | null>(null);

  // Load settlements from Supabase or fallback
  async function loadSettlements() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("driver_cash_settlements")
        .select("*")
        .order("created_at", { ascending: false });

      if (error || !data) {
        setIsUsingFallback(true);
        const stored = localStorage.getItem("orange_cash_settlements");
        if (stored) {
          try {
            setSettlements(JSON.parse(stored));
          } catch (e) {
            setSettlements([]);
          }
        } else {
          setSettlements([]);
        }
      } else {
        setIsUsingFallback(false);
        setSettlements(data as CashSettlement[]);
      }
    } catch (e) {
      setIsUsingFallback(true);
      const stored = localStorage.getItem("orange_cash_settlements");
      if (stored) {
        try {
          setSettlements(JSON.parse(stored));
        } catch {
          // best-effort: failure here is non-fatal and intentionally ignored
        }
      }
    }
    setLoading(false);
  }

  useEffect(() => {
    loadSettlements();

    const channel = supabase
      .channel("cash-settlements-sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_cash_settlements" },
        () => {
          loadSettlements();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  // Compute driver cash balances (Strictly rounded to whole rupees — no decimals)
  function getDriverCashStats(driverId: string) {
    // Total cash from completed rides
    const cashRides = bookings.filter(
      // Money the driver holds: cash, or paid to the driver's own UPI (not company QR / online).
      (b) =>
        b.driver_id === driverId &&
        b.status === "completed" &&
        (b.payment_method === "cash" || b.payment_method === "driver_upi"),
    );
    const totalCashDealt = cashRides.reduce(
      (sum, b) => sum + Math.round(Number(b.final_fare ?? b.estimated_fare ?? 0)),
      0,
    );

    // Total cash submitted/collected by admin
    const driverSettlements = settlements.filter((s) => s.driver_id === driverId);
    const totalCashTaken = driverSettlements.reduce(
      (sum, s) => sum + Math.round(Number(s.amount || 0)),
      0,
    );

    // Current cash holding in driver's hands (to be taken)
    const cashHolding = Math.max(0, totalCashDealt - totalCashTaken);

    return {
      totalCashDealt,
      totalCashTaken,
      cashHolding,
      ridesCount: cashRides.length,
      settlementsCount: driverSettlements.length,
    };
  }

  // Filter only Company-Salaried Drivers (partner owner-operators manage their own cash/fares and operate on a commission model in the Commission Ledger)
  const companyDrivers = drivers.filter((d) => !isCommissionDriver(d));
  const companyDriverIds = new Set(companyDrivers.map((d) => d.id));

  // Fleet-wide cash metrics (Strictly whole rupees for company fleet only)
  const completedCashRides = bookings.filter(
    (b) =>
      b.status === "completed" &&
      (b.payment_method === "cash" || b.payment_method === "driver_upi") &&
      (!b.driver_id || companyDriverIds.has(b.driver_id)),
  );
  const fleetTotalCashDealt = completedCashRides.reduce(
    (sum, b) => sum + Math.round(Number(b.final_fare ?? b.estimated_fare ?? 0)),
    0,
  );
  const fleetTotalCashTaken = settlements
    .filter((s) => companyDriverIds.has(s.driver_id))
    .reduce((sum, s) => sum + Math.round(Number(s.amount || 0)), 0);
  const fleetCashToBeTaken = Math.max(0, fleetTotalCashDealt - fleetTotalCashTaken);

  // Filtered drivers list (Strictly company salaried drivers)
  const filteredDrivers = companyDrivers.filter((d) => {
    const term = search.toLowerCase();
    return (
      d.full_name.toLowerCase().includes(term) ||
      d.phone?.toLowerCase().includes(term) ||
      d.city?.toLowerCase().includes(term)
    );
  });

  // Handle Cash Collection
  async function handleCollectCash(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedDriverId) {
      toast.error("Please choose a driver to collect cash from");
      return;
    }
    const amt = Math.round(Number(collectionAmount));
    if (!amt || amt <= 0 || isNaN(amt)) {
      toast.error("Please enter a valid cash amount in whole rupees");
      return;
    }

    const driver =
      companyDrivers.find((d) => d.id === selectedDriverId) ||
      drivers.find((d) => d.id === selectedDriverId);
    if (!driver) return;

    const stats = getDriverCashStats(driver.id);
    const maxHolding = Math.round(stats.cashHolding);

    if (maxHolding <= 0) {
      toast.error(`${driver.full_name} has no cash holding to collect (₹0 to be paid).`);
      return;
    }

    if (amt > maxHolding) {
      toast.error(
        `The maximum amount that can be collected cannot exceed ₹${maxHolding.toLocaleString("en-IN")} (amount to be paid from ${driver.full_name}).`,
      );
      return;
    }

    if (collectMode === "upi") {
      setDepositQr({
        req: { kind: "cash_deposit", driverId: driver.id, amount: amt },
        name: driver.full_name,
      });
      return;
    }

    setSubmitting(true);
    const newRecord: CashSettlement = {
      id: "settle-" + Date.now(),
      driver_id: driver.id,
      amount: amt,
      collected_by: collectorName.trim() || "Admin",
      notes: collectionNotes.trim() || "Cash deposit received by Admin",
      created_at: new Date().toISOString(),
    };

    if (!isUsingFallback) {
      const { data, error } = await supabase
        .from("driver_cash_settlements")
        .insert({
          driver_id: newRecord.driver_id,
          amount: newRecord.amount,
          collected_by: newRecord.collected_by,
          notes: newRecord.notes ?? null,
        })
        .select()
        .single();

      if (error) {
        toast.error("Could not record in cloud: " + error.message);
        setSubmitting(false);
        return;
      }
      if (data) newRecord.id = data.id;
    }

    const updated = [newRecord, ...settlements];
    setSettlements(updated);
    if (isUsingFallback) {
      localStorage.setItem("orange_cash_settlements", JSON.stringify(updated));
    }
    if (typeof window !== "undefined") {
      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("cash_settlements_updated"));
    }

    toast.success(`₹${amt} collected from ${driver.full_name}! Driver cash holding reduced.`);
    setIsCollecting(false);
    setSelectedDriverId("");
    setCollectionAmount("");
    setCollectionNotes("");
    setSubmitting(false);
    onRefresh();
  }

  // Open quick collection modal preselected for a driver
  function openQuickCollectionForDriver(driverId: string) {
    const stats = getDriverCashStats(driverId);
    if (stats.cashHolding <= 0) {
      toast.info("This driver has fully settled all cash holdings (₹0 to be paid).");
      return;
    }
    setSelectedDriverId(driverId);
    setCollectionAmount(Math.round(stats.cashHolding));
    setCollectionNotes(`Handover of cash collected from rides`);
    setIsCollecting(true);
  }

  return (
    <div className="space-y-6">
      <UpiQrDialog
        request={depositQr?.req ?? null}
        title={`Cash hand-in – ${depositQr?.name ?? ""}`}
        onClose={() => setDepositQr(null)}
        onPaid={() => {
          toast.success(
            `UPI payment received from ${depositQr?.name ?? "driver"}. Holding reduced.`,
          );
          setIsCollecting(false);
          setSelectedDriverId("");
          setCollectionAmount("");
          setCollectionNotes("");
          loadSettlements();
          onRefresh();
        }}
      />
      {/* Fallback Banner */}
      {isUsingFallback && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          <div className="flex items-center gap-2.5">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-bold">Settlements database unavailable</p>
              <p className="text-[11px] opacity-80">
                driver_cash_settlements could not be loaded (it is admin-only; see migration
                20261022_comprehensive_security_remediation.sql). Entries made now are kept only in
                this browser and are not a record of cash collected.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Operating Model Note */}
      <div className="rounded-xl border border-blue-500/25 bg-blue-500/5 p-3.5 flex items-center justify-between gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-2.5">
          <Building2 className="size-4 text-blue-600 shrink-0" />
          <span>
            <strong>Company Depot Cash Settlement:</strong> Tracking company-salaried fleet drivers
            depositing trip cash at depot. Partner owner-operators manage their fares independently
            and are tracked under the <strong>Commission Ledger</strong>.
          </span>
        </div>
      </div>

      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="display-serif text-2xl font-bold">Company Driver Cash Settlement</h2>
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-xs"
            >
              Depot Operations
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Collect physical cash fares from salaried fleet drivers, settle balances, and maintain a
            full ledger of handovers.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => {
              setIsCollecting(true);
              setSelectedDriverId("");
              setCollectionAmount("");
              setCollectionNotes("");
            }}
            className="gap-2 text-xs font-semibold h-9 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Banknote className="size-4" /> Collect Cash from Driver
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              loadSettlements();
              onRefresh();
            }}
            className="h-9 px-2 text-muted-foreground hover:text-foreground"
            title="Refresh Settlements"
          >
            <RotateCcw className="size-4" />
          </Button>
        </div>
      </div>

      {/* 3 Main KPI Metrics */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* 1. Cash Dealt */}
        <div className="rounded-xl border border-border bg-background p-5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Total Cash Dealt
            </span>
            <div className="grid size-8 place-items-center rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-950/40">
              <Banknote className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold text-foreground">
            ₹{Math.round(fleetTotalCashDealt)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Collected by drivers across {completedCashRides.length} cash trips
          </p>
        </div>

        {/* 2. Cash Taken / Collected */}
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-5 shadow-sm dark:border-emerald-950 dark:bg-emerald-950/20">
          <div className="flex items-center justify-between text-emerald-800 dark:text-emerald-300">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Cash Taken by Admin
            </span>
            <div className="grid size-8 place-items-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50">
              <CheckCircle2 className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold text-emerald-700 dark:text-emerald-400">
            ₹{Math.round(fleetTotalCashTaken)}
          </p>
          <p className="text-xs text-emerald-600/80 dark:text-emerald-400/70 mt-1">
            Deposited into Admin vault across {settlements.length} collections
          </p>
        </div>

        {/* 3. Cash to be Taken */}
        <div className="rounded-xl border border-amber-300 bg-amber-50/50 p-5 shadow-sm dark:border-amber-900/60 dark:bg-amber-950/20">
          <div className="flex items-center justify-between text-amber-900 dark:text-amber-300">
            <span className="text-[11px] font-semibold uppercase tracking-wider">
              Cash to be Taken (Holding)
            </span>
            <div className="grid size-8 place-items-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-900/50">
              <Wallet className="size-4" />
            </div>
          </div>
          <p className="mt-2 text-3xl font-bold text-amber-700 dark:text-amber-400">
            ₹{Math.round(fleetCashToBeTaken)}
          </p>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/70 mt-1">
            Currently held in drivers' pockets pending deposit
          </p>
        </div>
      </div>

      {/* Collect Cash Drawer / Form */}
      {isCollecting &&
        (() => {
          const selectedStats = selectedDriverId ? getDriverCashStats(selectedDriverId) : null;
          const maxHolding = selectedStats ? Math.round(selectedStats.cashHolding) : 0;
          const isExceeding = Boolean(
            selectedDriverId && collectionAmount !== "" && Number(collectionAmount) > maxHolding,
          );

          return (
            <form
              onSubmit={handleCollectCash}
              className="rounded-xl border border-emerald-400/50 bg-emerald-50/40 p-5 shadow-md  slide-in-from-top-3 duration-200 dark:border-emerald-900 dark:bg-emerald-950/30"
            >
              <div className="flex items-center justify-between border-b border-emerald-200 dark:border-emerald-900 pb-3">
                <div className="flex items-center gap-2">
                  <Banknote className="size-5 text-emerald-600" />
                  <p className="text-sm font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
                    Record Cash Received from Driver
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsCollecting(false)}
                  className="text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-semibold uppercase text-muted-foreground">
                  Driver pays by
                </span>
                {(["cash", "upi"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCollectMode(m)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                      collectMode === m
                        ? "border-emerald-600 bg-emerald-600 text-white"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {m === "cash" ? "Cash" : "UPI (show QR)"}
                  </button>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-12 gap-3.5 items-end">
                {/* Driver Selector */}
                <div className="sm:col-span-4">
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Driver Paying Cash *
                  </label>
                  <select
                    value={selectedDriverId}
                    onChange={(e) => {
                      const dId = e.target.value;
                      setSelectedDriverId(dId);
                      if (dId) {
                        const stats = getDriverCashStats(dId);
                        setCollectionAmount(
                          stats.cashHolding > 0 ? Math.round(stats.cashHolding) : "",
                        );
                      } else {
                        setCollectionAmount("");
                      }
                    }}
                    required
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-medium outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer"
                  >
                    <option value="">-- Choose Driver --</option>
                    {companyDrivers.map((d) => {
                      const stats = getDriverCashStats(d.id);
                      return (
                        <option key={d.id} value={d.id}>
                          {d.full_name} — Holding: ₹{Math.round(stats.cashHolding)} cash
                        </option>
                      );
                    })}
                  </select>
                </div>

                {/* Amount to collect */}
                <div className="sm:col-span-3">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                      Amount to Collect (₹) *
                    </label>
                    {selectedDriverId && (
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Max:{" "}
                        <strong
                          className={
                            maxHolding > 0
                              ? "text-emerald-700 dark:text-emerald-400 font-bold"
                              : "text-muted-foreground"
                          }
                        >
                          ₹{maxHolding}
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
                      max={maxHolding > 0 ? maxHolding : undefined}
                      step="1"
                      value={collectionAmount}
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
                          setCollectionAmount("");
                        } else {
                          const num = Math.round(Number(val));
                          setCollectionAmount(isNaN(num) ? "" : num);
                        }
                      }}
                      placeholder={maxHolding > 0 ? `Max ₹${maxHolding}` : "e.g. 1200"}
                      required
                      className={`w-full rounded-lg border bg-background py-2 pl-7 pr-3 text-xs font-mono font-bold text-foreground outline-none transition-colors ${
                        isExceeding
                          ? "border-destructive focus:border-destructive focus:ring-1 focus:ring-destructive text-destructive"
                          : "border-border focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                      }`}
                    />
                  </div>
                  {isExceeding && (
                    <p className="mt-1 text-[11px] font-semibold text-destructive flex items-center gap-1">
                      <AlertCircle className="size-3 shrink-0" />
                      Cannot exceed ₹{maxHolding} (driver's cash holding)
                    </p>
                  )}
                  {selectedDriverId && maxHolding <= 0 && (
                    <p className="mt-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="size-3 shrink-0" />
                      Driver has cleared all cash holdings (₹0 to be paid)
                    </p>
                  )}
                </div>

                {/* Notes / Reason */}
                <div className="sm:col-span-3">
                  <label className="text-[11px] font-semibold uppercase text-muted-foreground">
                    Handover Notes / Reason
                  </label>
                  <input
                    type="text"
                    value={collectionNotes}
                    onChange={(e) => setCollectionNotes(e.target.value)}
                    placeholder="e.g. End of shift deposit"
                    className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-xs outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                  />
                </div>

                {/* Submit */}
                <div className="sm:col-span-2 flex gap-2">
                  <Button
                    type="submit"
                    disabled={
                      submitting ||
                      !collectionAmount ||
                      !selectedDriverId ||
                      isExceeding ||
                      maxHolding <= 0
                    }
                    className="w-full h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                  >
                    {submitting ? (
                      "Saving..."
                    ) : (
                      <>
                        <Check className="size-3.5 mr-1" />{" "}
                        {collectMode === "upi" ? "Show UPI QR" : "Record Cash"}
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Quick presets for the selected driver */}
              {selectedDriverId && maxHolding > 0 && (
                <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px] text-muted-foreground pt-2 border-t border-emerald-200/60 dark:border-emerald-900/60">
                  <span>Quick Preset (Max ₹{maxHolding}):</span>
                  <button
                    type="button"
                    onClick={() => setCollectionAmount(maxHolding)}
                    className="rounded bg-emerald-600/10 text-emerald-700 dark:text-emerald-300 px-2 py-0.5 font-bold hover:bg-emerald-600/20 border border-emerald-300 dark:border-emerald-800"
                  >
                    Full Balance (₹{maxHolding})
                  </button>
                  {[500, 1000, 2000]
                    .filter((val) => val <= maxHolding && val !== maxHolding)
                    .map((val) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => setCollectionAmount(val)}
                        className="rounded border border-border bg-background px-2 py-0.5 text-muted-foreground hover:bg-muted font-mono"
                      >
                        ₹{val}
                      </button>
                    ))}
                </div>
              )}
            </form>
          );
        })()}

      {/* Driver Cash Holding Breakdown Table */}
      <div className="rounded-xl border border-border bg-background overflow-hidden shadow-sm">
        <div className="border-b border-border bg-muted/40 px-6 py-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-primary/10 text-primary">
              <Wallet className="size-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm">Driver Cash Holding Balances</h3>
              <p className="text-xs text-muted-foreground">
                Shows cash dealt, cash collected by admin, and pending holding per driver
              </p>
            </div>
          </div>

          {/* Driver Search */}
          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search driver by name..."
              className="w-full rounded-lg border border-border bg-background py-1.5 pl-8 pr-7 text-xs outline-none focus:border-primary"
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3" />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/30 border-b border-border">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">
                  Driver
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">
                  City & Phone
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">
                  Cash Dealt (Rides)
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">
                  Cash Taken by Admin
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">
                  Pending Holding
                </th>
                <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">
                  Action
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredDrivers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-xs text-muted-foreground">
                    No drivers found.
                  </td>
                </tr>
              ) : (
                filteredDrivers.map((d) => {
                  const stats = getDriverCashStats(d.id);
                  const hasPending = stats.cashHolding > 0;

                  return (
                    <tr key={d.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                            {d.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground text-xs">{d.full_name}</p>
                            <span
                              className={`inline-block rounded-full px-1.5 py-0.2 text-[9px] font-semibold ${d.is_online ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}
                            >
                              {d.is_online ? "● Online" : "Offline"}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-3.5 text-xs text-muted-foreground">
                        <p>{d.city || "Delhi NCR"}</p>
                        <p className="font-mono text-[11px]">{d.phone || "—"}</p>
                      </td>

                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-xs text-foreground">
                        ₹{Math.round(stats.totalCashDealt)}
                        <span className="block text-[10px] text-muted-foreground font-normal">
                          {stats.ridesCount} cash ride{stats.ridesCount !== 1 ? "s" : ""}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right font-mono font-semibold text-xs text-emerald-600">
                        ₹{Math.round(stats.totalCashTaken)}
                        <span className="block text-[10px] text-muted-foreground font-normal">
                          {stats.settlementsCount} deposit{stats.settlementsCount !== 1 ? "s" : ""}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        {hasPending ? (
                          <span className="inline-flex flex-col items-end">
                            <span className="rounded bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 font-mono font-bold text-xs text-amber-700 dark:text-amber-300">
                              ₹{Math.round(stats.cashHolding)}
                            </span>
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5 font-medium">
                              To be collected
                            </span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-600">
                            <CheckCircle2 className="size-3" /> Fully Settled
                          </span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <Button
                          size="sm"
                          variant={hasPending ? "default" : "outline"}
                          disabled={!hasPending}
                          className={`h-7 text-xs font-semibold gap-1 ${
                            hasPending
                              ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                              : "opacity-50 cursor-not-allowed"
                          }`}
                          onClick={() => openQuickCollectionForDriver(d.id)}
                          title={
                            hasPending
                              ? `Collect up to ₹${Math.round(stats.cashHolding)}`
                              : "Driver has cleared all cash holdings (₹0 to be collected)"
                          }
                        >
                          <Banknote className="size-3" /> Collect
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cash Transaction Log / History */}
      <div className="rounded-xl border border-border bg-background overflow-hidden shadow-sm">
        <div className="border-b border-border bg-muted/40 px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <Receipt className="size-4" />
            </span>
            <div>
              <h3 className="font-bold text-sm">Cash Handover Ledger</h3>
              <p className="text-xs text-muted-foreground">
                Chronological log of all cash collections deposited with Admin
              </p>
            </div>
          </div>

          <Badge variant="outline" className="text-xs">
            {settlements.length} Handover{settlements.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {settlements.length === 0 ? (
          <p className="p-8 text-center text-xs text-muted-foreground">
            No cash handover transactions recorded yet. Click "Collect Cash from Driver" to record
            your first collection.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/30 border-b border-border">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Date & Time
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Driver
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Handover Notes
                  </th>
                  <th className="px-5 py-3 text-left text-xs font-semibold text-muted-foreground">
                    Received By
                  </th>
                  <th className="px-5 py-3 text-right text-xs font-semibold text-muted-foreground">
                    Amount Taken
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {settlements.map((s) => {
                  const driver = drivers.find((d) => d.id === s.driver_id);
                  const dateStr = s.created_at
                    ? new Date(s.created_at).toLocaleDateString("en-IN", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : "—";

                  return (
                    <tr key={s.id} className="hover:bg-muted/20 transition-colors">
                      <td className="px-5 py-3 text-xs text-muted-foreground font-mono">
                        {dateStr}
                      </td>

                      <td className="px-5 py-3">
                        <span className="font-semibold text-xs text-foreground">
                          {driver ? driver.full_name : "Unknown Driver"}
                        </span>
                      </td>

                      <td className="px-5 py-3 text-xs text-muted-foreground">
                        {s.notes?.includes("UTR") || s.notes?.includes("UPI") ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="inline-flex items-center gap-1 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 px-2 py-0.5 text-[10px] font-bold border border-orange-500/20">
                              UPI Online Deposit
                            </span>
                            <span className="font-mono font-semibold text-foreground text-[11px]">
                              {s.notes}
                            </span>
                          </div>
                        ) : (
                          s.notes || "Shift cash deposit"
                        )}
                      </td>

                      <td className="px-5 py-3 text-xs">
                        <span
                          className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold ${s.collected_by?.includes("UPI") || s.collected_by?.includes("Driver") ? "bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20" : "bg-muted text-muted-foreground"}`}
                        >
                          {s.collected_by || "Admin"}
                        </span>
                      </td>

                      <td className="px-5 py-3 text-right">
                        <span className="font-mono font-bold text-sm text-emerald-600">
                          +₹{Math.round(s.amount)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
