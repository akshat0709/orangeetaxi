import { useState } from "react";
import { Building2, Download, FileText, Printer, Save, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  calculateRideGST,
  formatInvoiceNumber,
  generateGSTR1CSV,
  getStoredCompanyProfile,
  saveStoredCompanyProfile,
  CompanyGSTProfile,
} from "@/lib/gst-utils";
import { TaxInvoiceModal } from "@/components/tax-invoice-modal";

interface GSTAccountingManagerProps {
  bookings: any[];
  onRefresh?: () => void;
}

export function GSTAccountingManager({ bookings = [], onRefresh }: GSTAccountingManagerProps) {
  const [profile, setProfile] = useState<CompanyGSTProfile>(getStoredCompanyProfile());
  const [editingGSTIN, setEditingGSTIN] = useState(profile.gstin);
  const [isSavingGSTIN, setIsSavingGSTIN] = useState(false);

  const [dateFilter, setDateFilter] = useState<"today" | "yesterday" | "week" | "month" | "all">(
    "today",
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBookingForInvoice, setSelectedBookingForInvoice] = useState<any | null>(null);

  // Filter completed bookings
  const completedBookings = bookings.filter((b) => b.status === "completed");

  const filteredBookings = completedBookings.filter((b) => {
    const rawDate = b.completed_at || b.created_at;
    const d = rawDate && !isNaN(new Date(rawDate).getTime()) ? new Date(rawDate) : new Date(0);
    const now = new Date();

    if (dateFilter === "today") {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (d < today) return false;
    } else if (dateFilter === "yesterday") {
      const yestStart = new Date();
      yestStart.setDate(yestStart.getDate() - 1);
      yestStart.setHours(0, 0, 0, 0);
      const yestEnd = new Date();
      yestEnd.setDate(yestEnd.getDate() - 1);
      yestEnd.setHours(23, 59, 59, 999);
      if (d < yestStart || d > yestEnd) return false;
    } else if (dateFilter === "week") {
      const weekStart = new Date(Date.now() - 7 * 24 * 3600 * 1000);
      if (d < weekStart) return false;
    } else if (dateFilter === "month") {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      if (d < monthStart) return false;
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const ref = (b.reference || "").toLowerCase();
      const pickup = (b.pickup_area || "").toLowerCase();
      const drop = (b.drop_area || "").toLowerCase();
      const cust = (b.customer_name || "").toLowerCase();
      return ref.includes(q) || pickup.includes(q) || drop.includes(q) || cust.includes(q);
    }

    return true;
  });

  // Calculate Aggregates
  let totalGMV = 0;
  let totalTaxable = 0;
  let totalCGST = 0;
  let totalSGST = 0;
  let totalIGST = 0;
  let cashTotal = 0;
  let upiTotal = 0;
  const intraStates = new Set<string>();

  filteredBookings.forEach((b) => {
    const fare = Number(b.final_fare || b.estimated_fare || 0);
    totalGMV += fare;
    if (b.payment_method === "cash") cashTotal += fare;
    else upiTotal += fare;

    const g = calculateRideGST(fare, b.pickup_area, b.drop_area);
    totalTaxable += g.taxableValue;
    totalCGST += g.cgstAmount;
    totalSGST += g.sgstAmount;
    totalIGST += g.igstAmount;

    if (!g.isInterState && g.placeOfSupply) {
      intraStates.add(`${g.placeOfSupply} (${g.posCode})`);
    }
  });

  const totalGSTLiability = totalCGST + totalSGST + totalIGST;
  const intraStateSubtitle =
    intraStates.size === 1
      ? `${Array.from(intraStates)[0]} · 2.5% + 2.5%`
      : intraStates.size > 1
        ? Array.from(intraStates).join(", ")
        : "CGST (2.5%) + SGST (2.5%)";

  function handleSaveGSTIN() {
    setIsSavingGSTIN(true);
    saveStoredCompanyProfile({ gstin: editingGSTIN.trim().toUpperCase() });
    setProfile(getStoredCompanyProfile());
    toast.success("GSTIN configuration updated!");
    setIsSavingGSTIN(false);
  }

  function handleDownloadCSV() {
    if (filteredBookings.length === 0) {
      toast.error("No completed rides found for the selected period to export.");
      return;
    }

    const csvContent = generateGSTR1CSV(filteredBookings, profile);
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const dateTag = new Date().toISOString().split("T")[0];
    link.href = url;
    link.setAttribute("download", `OrangeTaxi_GSTR1_Export_${dateFilter}_${dateTag}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("GSTR-1 Portal CSV exported successfully!");
  }

  function handlePrintCADailyReport() {
    window.print();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          Tax invoices and GSTR-1 export. SAC 996412, 5% GST, split into CGST/SGST or IGST by place
          of supply.
        </p>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handlePrintCADailyReport}
            className="text-xs gap-1.5 h-9"
            title="Print 1-page financial summary for CA"
          >
            <Printer className="size-3.5 text-primary" />
            <span>CA Daily EOD PDF</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleDownloadCSV}
            className="text-xs gap-1.5 h-9 bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow"
          >
            <Download className="size-3.5" />
            <span>Export GSTR-1 CSV</span>
          </Button>
        </div>
      </div>

      {/* Statutory Corporate Profile Card */}
      <div className="rounded-xl border border-border bg-background p-6 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                <Building2 className="size-4 text-primary" />
                {profile.legalName}
              </h3>
              <Badge className="bg-primary text-primary-foreground text-xs">
                Public Limited · ROC Delhi
              </Badge>
              <Badge variant="outline" className="font-mono text-xs">
                Incorporated: {profile.incorporationDate}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">{profile.address}</p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1 flex-wrap font-mono">
              <span>
                CIN: <strong className="text-foreground">{profile.cin}</strong>
              </span>
              <span>·</span>
              <span>
                PAN: <strong className="text-foreground">{profile.pan}</strong>
              </span>
              <span>·</span>
              <span>
                Principal Reg. HQ:{" "}
                <strong className="text-foreground">
                  {profile.state} (Code {profile.stateCode})
                </strong>
              </span>
            </div>
          </div>

          {/* Quick GSTIN Configurator */}
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="space-y-1">
              <Label htmlFor="gstinInput" className="text-xs text-muted-foreground font-semibold">
                GSTIN (15 Digits)
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  id="gstinInput"
                  value={editingGSTIN}
                  onChange={(e) => setEditingGSTIN(e.target.value.toUpperCase())}
                  maxLength={15}
                  className="h-8 w-44 font-mono font-bold text-xs"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSaveGSTIN}
                  disabled={isSavingGSTIN || editingGSTIN === profile.gstin}
                  className="h-8 text-xs gap-1"
                >
                  <Save className="size-3" /> Save
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Date Filter & Search Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-1.5 rounded-lg border border-border bg-background p-1 text-xs">
          {[
            { id: "today", label: "Today (EOD)" },
            { id: "yesterday", label: "Yesterday" },
            { id: "week", label: "Last 7 Days" },
            { id: "month", label: "This Month" },
            { id: "all", label: "All Rides" },
          ].map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setDateFilter(f.id as any)}
              className={`rounded-md px-3 py-1.5 font-medium transition-all ${
                dateFilter === f.id
                  ? "bg-primary text-primary-foreground font-bold shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
          <Input
            placeholder="Search ref, route, passenger..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 pl-9 text-xs"
          />
        </div>
      </div>

      {/* High-Level Financial & Tax Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs text-muted-foreground font-semibold">Gross Turnover (GMV)</p>
          <p className="mt-1 text-2xl font-semibold font-mono text-foreground">
            ₹{Math.round(totalGMV).toLocaleString("en-IN")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {filteredBookings.length} completed rides
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs text-muted-foreground font-semibold">Taxable Value</p>
          <p className="mt-1 text-2xl font-semibold font-mono text-foreground">
            ₹{totalTaxable.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Excl. 5% GST rate</p>
        </div>

        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs text-muted-foreground font-semibold">Intra-State GST (CGST+SGST)</p>
          <p className="mt-1 text-xl font-bold font-mono text-foreground">
            ₹{(totalCGST + totalSGST).toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1 truncate" title={intraStateSubtitle}>
            {intraStateSubtitle}
          </p>
        </div>

        <div className="rounded-xl border border-border bg-background p-4">
          <p className="text-xs text-muted-foreground font-semibold">Inter-State IGST (5%)</p>
          <p className="mt-1 text-xl font-bold font-mono text-foreground">
            ₹{totalIGST.toFixed(2)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Cross-Border / Inter-State</p>
        </div>

        <div className="col-span-2 sm:col-span-1 rounded-xl border p-4 border-border bg-background">
          <p className="text-sm text-muted-foreground">Total GST Payable</p>
          <p className="mt-1 text-2xl font-semibold font-mono">₹{totalGSTLiability.toFixed(2)}</p>
          <p className="text-xs text-muted-foreground mt-1">Sec 9(5) E-Commerce Deposit</p>
        </div>
      </div>

      {/* Invoiced Rides Table */}
      <div className="rounded-xl border border-border bg-background overflow-hidden">
        <div className="border-b border-border px-6 py-4 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-sm">
              Completed Invoiced Rides ({filteredBookings.length})
            </h3>
            <p className="text-xs text-muted-foreground">
              Each booking is auto-assigned an official GST invoice number
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span>
              Cash: <strong className="text-foreground">₹{Math.round(cashTotal)}</strong>
            </span>
            <span>·</span>
            <span>
              UPI: <strong className="text-foreground">₹{Math.round(upiTotal)}</strong>
            </span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 text-muted-foreground font-semibold">
              <tr>
                <th className="px-4 py-3 text-left">Invoice No</th>
                <th className="px-4 py-3 text-left">Date</th>
                <th className="px-4 py-3 text-left">Route</th>
                <th className="px-4 py-3 text-left">POS</th>
                <th className="px-4 py-3 text-right">Taxable (₹)</th>
                <th className="px-4 py-3 text-right">CGST+SGST</th>
                <th className="px-4 py-3 text-right">IGST</th>
                <th className="px-4 py-3 text-right">Invoice Total</th>
                <th className="px-4 py-3 text-center">Payment</th>
                <th className="px-4 py-3 text-center">Invoice</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredBookings.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-muted-foreground">
                    No completed rides found for this date period.
                  </td>
                </tr>
              ) : (
                filteredBookings.map((b) => {
                  const fare = Number(b.final_fare || b.estimated_fare || 0);
                  const gst = calculateRideGST(fare, b.pickup_area, b.drop_area);
                  const rawDate = b.completed_at || b.created_at;
                  const invNo = formatInvoiceNumber(b.reference, rawDate);
                  const validDate =
                    rawDate && !isNaN(new Date(rawDate).getTime()) ? new Date(rawDate) : new Date();
                  const dateStr = validDate.toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  });

                  return (
                    <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-bold text-foreground">{invNo}</td>
                      <td className="px-4 py-3 text-muted-foreground">{dateStr}</td>
                      <td className="px-4 py-3 max-w-[200px] truncate">
                        <span className="font-semibold text-foreground">{b.pickup_area}</span>
                        <span className="text-muted-foreground"> → </span>
                        <span>{b.drop_area}</span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className="font-mono text-xs font-semibold whitespace-nowrap"
                        >
                          {gst.posCode} · {gst.placeOfSupply}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        ₹{gst.taxableValue.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {!gst.isInterState
                          ? `₹${(gst.cgstAmount + gst.sgstAmount).toFixed(2)}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        {gst.isInterState ? `₹${gst.igstAmount.toFixed(2)}` : "—"}
                      </td>
                      <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                        ₹{fare.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-muted">
                          {b.payment_method || "cash"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setSelectedBookingForInvoice(b)}
                          className="h-7 text-xs text-primary hover:text-primary hover:bg-primary/10 gap-1"
                        >
                          <FileText className="size-3" />
                          <span>View</span>
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

      {/* Tax Invoice Modal for Individual Inspection */}
      {selectedBookingForInvoice && (
        <TaxInvoiceModal
          open={Boolean(selectedBookingForInvoice)}
          onOpenChange={(open) => {
            if (!open) setSelectedBookingForInvoice(null);
          }}
          booking={selectedBookingForInvoice}
        />
      )}
    </div>
  );
}
