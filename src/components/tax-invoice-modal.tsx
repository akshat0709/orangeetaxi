// @ts-nocheck
import { useState } from "react";
import {
  Check,
  Copy,
  Download,
  Mail,
  Printer,
  ShieldCheck,
  Sparkles,
  X,
  FileText,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  calculateRideGST,
  formatInvoiceNumber,
  getStoredCompanyProfile,
  CompanyGSTProfile,
} from "@/lib/gst-utils";
import { getBookingVehiclePlate } from "@/lib/ride-vehicle";
import { SendInvoicePayload } from "@/lib/send-invoice-email";
import { supabase } from "@/integrations/supabase/client";

interface TaxInvoiceModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
  driver?: any;
  customer?: any;
}

function numberToWords(num: number): string {
  const a = [
    "",
    "One",
    "Two",
    "Three",
    "Four",
    "Five",
    "Six",
    "Seven",
    "Eight",
    "Nine",
    "Ten",
    "Eleven",
    "Twelve",
    "Thirteen",
    "Fourteen",
    "Fifteen",
    "Sixteen",
    "Seventeen",
    "Eighteen",
    "Nineteen",
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(n: number): string {
    if (n === 0) return "Zero";
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + a[n % 10] : "");
    if (n < 1000)
      return (
        a[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " and " + inWords(n % 100) : "")
      );
    if (n < 100000)
      return (
        inWords(Math.floor(n / 1000)) +
        " Thousand" +
        (n % 1000 !== 0 ? " " + inWords(n % 1000) : "")
      );
    if (n < 10000000)
      return (
        inWords(Math.floor(n / 100000)) +
        " Lakh" +
        (n % 100000 !== 0 ? " " + inWords(n % 100000) : "")
      );
    return "Rupees " + n.toString();
  }

  const rounded = Math.round(num);
  return `${inWords(rounded)} Rupees Only`;
}

export function TaxInvoiceModal({
  open,
  onOpenChange,
  booking,
  driver,
  customer,
}: TaxInvoiceModalProps) {
  const profile = getStoredCompanyProfile();

  const [b2bMode, setB2bMode] = useState(false);
  const [corporateName, setCorporateName] = useState(booking?.corporate_name || "");
  const [corporateGSTIN, setCorporateGSTIN] = useState(booking?.corporate_gstin || "");
  const [emailing, setEmailing] = useState(false);

  if (!booking) return null;

  const fare = Number(booking.final_fare || booking.estimated_fare || 500);
  const gst = calculateRideGST(fare, booking.pickup_area, booking.drop_area);
  const rawDate = booking.completed_at || booking.created_at;
  const invoiceNumber = formatInvoiceNumber(booking.reference, rawDate);
  const rideDate = rawDate && !isNaN(new Date(rawDate).getTime()) ? new Date(rawDate) : new Date();

  const formattedDate = rideDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const formattedTime = rideDate.toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });

  async function handleDownloadPDF() {
    try {
      toast.info("Generating PDF...");
      // Dynamically load html2pdf
      const script = document.createElement("script");
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
      script.onload = () => {
        const payload: SendInvoicePayload = {
          to: customer?.email || booking.customer_email || "Customer",
          invoiceNumber,
          customerName: customer?.full_name || booking.customer_name,
          customerPhone: customer?.phone || booking.customer_phone,
          pickupArea: booking.pickup_area || "Pickup Location",
          dropArea: booking.drop_area || "Destination",
          completedAt: `${formattedDate} ${formattedTime}`,
          vehicleName: booking.vehicle_name || "Mahindra BE.6",
          vehiclePlate: getBookingVehiclePlate(booking, driver),
          paymentMethod: booking.payment_method || "CASH",
          subtotal: gst.taxableValue,
          cgst: gst.cgstAmount,
          sgst: gst.sgstAmount,
          igst: gst.igstAmount,
          totalFare: fare,
          distanceKm: booking.distance_km,
          durationMinutes: booking.duration_mins,
          corporateName: b2bMode ? corporateName : undefined,
          corporateGstin: b2bMode ? corporateGSTIN : undefined,
          profile,
        };
        const htmlString = generateInvoiceHtml(payload);

        // Create a temporary container
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = htmlString;

        // html2pdf options
        const opt = {
          margin: 0,
          filename: `Invoice_${invoiceNumber}.pdf`,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: { scale: 2 },
          jsPDF: { unit: "in", format: "a4", orientation: "portrait" },
        };

        // @ts-ignore
        window
          .html2pdf()
          .set(opt)
          .from(tempDiv)
          .save()
          .then(() => {
            toast.success("PDF Downloaded!");
          });
      };
      document.body.appendChild(script);
    } catch (e) {
      console.error(e);
      toast.error("Failed to generate PDF");
    }
  }

  function handlePrint() {
    window.print();
  }

  async function handleSendEmail() {
    let targetEmail = customer?.email || booking.customer_email;
    if (!targetEmail || !targetEmail.includes("@")) {
      const promptEmail = window.prompt("Enter recipient email address for GST invoice:");
      if (!promptEmail) return;
      targetEmail = promptEmail.trim();
    }

    setEmailing(true);
    try {
      const payload: SendInvoicePayload = {
        to: targetEmail,
        invoiceNumber,
        customerName: customer?.full_name || booking.customer_name,
        customerPhone: customer?.phone || booking.customer_phone,
        pickupArea: booking.pickup_area || "Pickup Location",
        dropArea: booking.drop_area || "Destination",
        completedAt: `${formattedDate} ${formattedTime}`,
        vehicleName: booking.vehicle_name || "Mahindra BE.6",
        vehiclePlate: getBookingVehiclePlate(booking, driver),
        paymentMethod: booking.payment_method || "CASH",
        subtotal: gst.taxableValue,
        cgst: gst.cgstAmount,
        sgst: gst.sgstAmount,
        igst: gst.igstAmount,
        totalFare: fare,
        distanceKm: booking.distance_km,
        durationMinutes: booking.duration_mins,
        corporateName: b2bMode ? corporateName : undefined,
        corporateGstin: b2bMode ? corporateGSTIN : undefined,
        profile,
      };

      let authHeader = "";
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session?.access_token) {
          authHeader = `Bearer ${session.access_token}`;
        }
      } catch {
        // best-effort: failure here is non-fatal and intentionally ignored
      }

      const res = await fetch("/api/send-invoice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(authHeader ? { Authorization: authHeader } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Failed to send invoice");
      }

      toast.success(
        `Tax invoice #${invoiceNumber} successfully sent to ${targetEmail} from billing@orange-taxi.com! ✉️`,
      );
    } catch (err: any) {
      console.error("Invoice email failed:", err);
      toast.error(`Email dispatch error: ${err.message || "Could not deliver invoice"}`);
    } finally {
      setEmailing(false);
    }
  }

  function handleCopyInvoiceNo() {
    navigator.clipboard.writeText(invoiceNumber);
    toast.success(`Copied Invoice Number: ${invoiceNumber}`);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 bg-background text-foreground border border-border shadow-2xl rounded-2xl">
        {/* Actions Bar (Excluded from Print) */}
        <div className="print:hidden sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border bg-background/95 px-6 py-4 backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary font-bold">
              <FileText className="size-4" />
            </span>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                GST Tax Invoice
              </p>
              <p className="text-sm font-mono font-bold text-foreground">{invoiceNumber}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleCopyInvoiceNo}
              className="text-xs gap-1.5 h-8"
              title="Copy invoice number"
            >
              <Copy className="size-3.5" />
              <span>Copy #</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setB2bMode(!b2bMode)}
              className="text-xs gap-1.5 h-8 border-primary/40 text-primary hover:bg-primary/10"
            >
              <Building2 className="size-3.5" />
              <span>{b2bMode ? "Hide B2B Details" : "Add Company GST"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSendEmail}
              disabled={emailing}
              className="text-xs gap-1.5 h-8"
            >
              <Mail className="size-3.5 text-primary" />
              <span>{emailing ? "Sending..." : "Email Invoice"}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handlePrint}
              className="text-xs gap-1.5 h-8"
            >
              <Printer className="size-3.5" />
              <span>Print</span>
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleDownloadPDF}
              className="text-xs gap-1.5 h-8 bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow"
            >
              <Download className="size-3.5" />
              <span>Download PDF</span>
            </Button>
          </div>
        </div>

        {/* Optional B2B Tax Credit Input (Excluded from Print) */}
        {b2bMode && (
          <div className="print:hidden mx-6 mt-4 p-4 rounded-xl border border-primary/30 bg-primary/5 space-y-3">
            <p className="text-xs font-bold text-primary flex items-center gap-1.5">
              <Building2 className="size-4" /> Corporate B2B GST Invoicing (Input Tax Credit)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <Label htmlFor="corpName" className="text-xs">
                  Company / Business Name
                </Label>
                <Input
                  id="corpName"
                  placeholder="e.g. Acme Technologies India Pvt Ltd"
                  value={corporateName}
                  onChange={(e) => setCorporateName(e.target.value)}
                  className="h-8 text-xs mt-1"
                />
              </div>
              <div>
                <Label htmlFor="corpGstin" className="text-xs">
                  Company 15-Digit GSTIN
                </Label>
                <Input
                  id="corpGstin"
                  placeholder="e.g. 07AAACA1234A1Z5"
                  value={corporateGSTIN}
                  onChange={(e) => setCorporateGSTIN(e.target.value.toUpperCase())}
                  maxLength={15}
                  className="h-8 text-xs font-mono uppercase mt-1"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground">
              * The invoice below will automatically update with your company's GSTIN for GST ITC
              claiming.
            </p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* OFFICIAL PRINT-READY A4 TAX INVOICE SHEET                                 */}
        {/* ========================================================================= */}
        <div
          id="print-tax-invoice"
          className="p-8 font-sans text-foreground bg-white dark:bg-zinc-950 print:p-6 print:text-black"
        >
          {/* Header Banner */}
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-6 pb-6 border-b-2 border-primary">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="grid size-9 place-items-center rounded-full bg-primary text-base font-bold text-primary-foreground shadow">
                  O
                </span>
                <span className="text-xl font-bold tracking-[0.14em] text-foreground">
                  ORANGE TAXI LIMITED
                </span>
              </div>
              <p className="mt-1 text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Public Limited Company · Registered at ROC Delhi
              </p>
              <div className="mt-2 space-y-0.5 text-xs text-muted-foreground max-w-sm leading-relaxed">
                <p>
                  <strong>CIN:</strong>{" "}
                  <span className="font-mono text-foreground font-semibold">{profile.cin}</span>
                </p>
                <p>
                  <strong>PAN:</strong>{" "}
                  <span className="font-mono text-foreground font-semibold">{profile.pan}</span>
                </p>
                <p>
                  <strong>GSTIN:</strong>{" "}
                  <span className="font-mono text-foreground font-semibold">{profile.gstin}</span>
                </p>
                <p>
                  <strong>Reg. Office:</strong> {profile.address}
                </p>
                <p>
                  <strong>Corporate HQ:</strong> {profile.state} (State Code:{" "}
                  <strong className="font-mono">{profile.stateCode}</strong>)
                </p>
              </div>
            </div>

            <div className="text-left sm:text-right space-y-1">
              <span className="inline-block px-3 py-1 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-widest rounded">
                TAX INVOICE
              </span>
              <p className="text-[11px] text-muted-foreground font-medium pt-1">
                Issued under Section 31 of CGST Act, 2017
              </p>
              <div className="pt-2 text-xs space-y-1">
                <p>
                  <span className="text-muted-foreground">Invoice No: </span>
                  <strong className="font-mono text-foreground text-sm">{invoiceNumber}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Invoice Date: </span>
                  <strong>
                    {formattedDate} {formattedTime}
                  </strong>
                </p>
                <p>
                  <span className="text-muted-foreground">SAC Code: </span>
                  <strong className="font-mono">{profile.sacCode}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Place of Supply (POS): </span>
                  <strong className="text-primary font-bold">
                    {gst.posCode} - {gst.placeOfSupply}
                  </strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Reverse Charge: </span>
                  <strong>No</strong>
                </p>
              </div>
            </div>
          </div>

          {/* Billed To / Passenger & Ride Details */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 py-6 border-b border-border text-xs">
            {/* Passenger / Billed To */}
            <div className="rounded-xl border border-border p-4 bg-muted/20">
              <p className="font-bold uppercase tracking-wider text-muted-foreground mb-2 text-[11px]">
                Billed To (Passenger / Client)
              </p>
              <div className="space-y-1">
                <p className="text-sm font-bold text-foreground">
                  {corporateName.trim()
                    ? corporateName
                    : customer?.fullName || booking.customer_name || "Guest Passenger"}
                </p>
                {corporateGSTIN.trim() && (
                  <p className="font-mono text-primary font-bold">GSTIN: {corporateGSTIN.trim()}</p>
                )}
                <p className="text-muted-foreground">
                  Phone: {customer?.phone || booking.customer_phone || "+91 98100 12345"}
                </p>
                {customer?.email && (
                  <p className="text-muted-foreground">Email: {customer.email}</p>
                )}
                <p className="text-muted-foreground">
                  Place of Embarkation: {booking.pickup_area} ({gst.posCode} - {gst.placeOfSupply})
                </p>
              </div>
            </div>

            {/* Journey & Vehicle Details */}
            <div className="rounded-xl border border-border p-4 bg-muted/20">
              <p className="font-bold uppercase tracking-wider text-muted-foreground mb-2 text-[11px]">
                Ride & Fleet Details
              </p>
              <div className="space-y-1">
                <p>
                  <span className="text-muted-foreground">Booking Ref: </span>
                  <strong className="font-mono text-primary font-bold">{booking.reference}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Vehicle: </span>
                  <strong>
                    {booking.vehicle_name?.split("·")[0]?.trim() ||
                      driver?.vehicle_model ||
                      "Mahindra BE.6 Electric"}
                  </strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Registration Plate: </span>
                  <strong className="font-mono px-1.5 py-0.5 rounded bg-muted border border-border">
                    {getBookingVehiclePlate(booking, driver)}
                  </strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Driver: </span>
                  <strong>{driver?.full_name || "Orange Fleet Captain"}</strong>
                </p>
                <p>
                  <span className="text-muted-foreground">Route: </span>
                  <strong className="text-foreground">
                    {booking.pickup_area} → {booking.drop_area}
                  </strong>
                </p>
              </div>
            </div>
          </div>

          {/* Itemized Line Items Table */}
          <div className="mt-6 overflow-hidden rounded-xl border border-border text-xs">
            <table className="w-full text-left">
              <thead className="bg-muted/60 font-semibold border-b border-border">
                <tr>
                  <th className="px-4 py-3">S.No</th>
                  <th className="px-4 py-3">Description of Service</th>
                  <th className="px-4 py-3 font-mono">SAC Code</th>
                  <th className="px-4 py-3 text-right">Taxable Value (₹)</th>
                  {!gst.isInterState ? (
                    <>
                      <th className="px-4 py-3 text-right">CGST (2.5%)</th>
                      <th className="px-4 py-3 text-right">SGST/UTGST (2.5%)</th>
                    </>
                  ) : (
                    <th className="px-4 py-3 text-right">IGST (5.0%)</th>
                  )}
                  <th className="px-4 py-3 text-right">Total Amount (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                <tr>
                  <td className="px-4 py-3 font-mono text-muted-foreground">1</td>
                  <td className="px-4 py-3">
                    <p className="font-bold text-foreground">
                      Passenger Transportation by Motor Cab
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Point-to-point journey: {booking.pickup_area} to {booking.drop_area} (
                      {booking.distance_km || 15} km)
                    </p>
                  </td>
                  <td className="px-4 py-3 font-mono font-semibold">{profile.sacCode}</td>
                  <td className="px-4 py-3 text-right font-mono font-bold">
                    ₹{gst.taxableValue.toFixed(2)}
                  </td>
                  {!gst.isInterState ? (
                    <>
                      <td className="px-4 py-3 text-right font-mono">
                        ₹{gst.cgstAmount.toFixed(2)}
                      </td>
                      <td className="px-4 py-3 text-right font-mono">
                        ₹{gst.sgstAmount.toFixed(2)}
                      </td>
                    </>
                  ) : (
                    <td className="px-4 py-3 text-right font-mono">₹{gst.igstAmount.toFixed(2)}</td>
                  )}
                  <td className="px-4 py-3 text-right font-mono font-bold text-primary">
                    ₹{fare.toFixed(2)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Tax Calculation Totals */}
          <div className="mt-6 flex flex-col sm:flex-row justify-between gap-6">
            <div className="max-w-md space-y-2 text-xs">
              <p>
                <span className="text-muted-foreground">Total in Words: </span>
                <strong className="text-foreground italic">{numberToWords(fare)}</strong>
              </p>
              <p className="text-[11px] text-muted-foreground pt-1">
                Payment Mode:{" "}
                <strong className="uppercase font-mono">{booking.payment_method || "cash"}</strong>
              </p>
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2.5 text-[11px] text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                <ShieldCheck className="size-4 shrink-0" />
                <span>
                  GST paid under Reverse Charge: <strong>No</strong> (Payable by Orange Taxi Limited
                  as E-Commerce Operator under Section 9(5) CGST Act).
                </span>
              </div>
            </div>

            <div className="w-full sm:w-72 space-y-2 text-xs">
              <div className="flex justify-between py-1 border-b border-border/50">
                <span className="text-muted-foreground">Taxable Turnover:</span>
                <span className="font-mono font-semibold">₹{gst.taxableValue.toFixed(2)}</span>
              </div>
              {!gst.isInterState ? (
                <>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">CGST @ 2.5%:</span>
                    <span className="font-mono">₹{gst.cgstAmount.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-border/50">
                    <span className="text-muted-foreground">
                      SGST @ 2.5% ({gst.placeOfSupply}):
                    </span>
                    <span className="font-mono">₹{gst.sgstAmount.toFixed(2)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between py-1 border-b border-border/50">
                  <span className="text-muted-foreground">IGST @ 5.0% (Inter-State):</span>
                  <span className="font-mono">₹{gst.igstAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between py-2 border-t-2 border-border font-bold text-sm">
                <span>Total Invoice Value:</span>
                <span className="font-mono text-primary text-base">₹{fare.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Statutory Footer */}
          <div className="mt-8 pt-6 border-t border-border text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">Terms & Conditions / Declarations:</p>
            <p>
              1. This is a computer-generated tax invoice issued by{" "}
              <strong>ORANGE TAXI LIMITED</strong> pursuant to Rule 46 of the Central Goods and
              Services Tax Rules, 2017 and does not require a physical signature.
            </p>
            <p>
              2. For queries or corporate invoicing support, please email{" "}
              <strong>{profile.supportEmail}</strong> or call{" "}
              <strong>{profile.supportPhone}</strong>.
            </p>
            <p className="pt-2 text-center text-[10px] text-muted-foreground/80 font-mono">
              ORANGE TAXI LIMITED · CIN: {profile.cin} · PAN: {profile.pan} · S-210, Panchshila
              Park, New Delhi 110017
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
