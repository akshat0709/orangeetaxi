// @ts-nocheck
import { getBookingVehiclePlate } from "@/lib/ride-vehicle";

export interface CompanyGSTProfile {
  legalName: string;
  tradeName: string;
  pan: string;
  cin: string;
  gstin: string;
  incorporationDate: string;
  address: string;
  state: string;
  stateCode: string;
  sacCode: string;
  taxRatePercent: number;
  supportEmail: string;
  supportPhone: string;
}

export const DEFAULT_COMPANY_PROFILE: CompanyGSTProfile = {
  legalName: "ORANGE TAXI LIMITED",
  tradeName: "Orange Taxi",
  pan: "AAFCO0132P",
  cin: "U49224DL2026PLC461350",
  gstin: "07AAFCO0132P1ZD",
  incorporationDate: "08/01/2026",
  address: "S-210, 2ND FLOOR, PANCHSHILA PARK, South Malviya Nagar, South Delhi, New Delhi, Delhi, India, 110017",
  state: "Delhi",
  stateCode: "07",
  sacCode: "996412", // Passenger transportation services by taxi
  taxRatePercent: 5.0, // 5% GST on passenger transport
  supportEmail: "support@orangetaxi.in",
  supportPhone: "+91 98100 12345",
};

export function getStoredCompanyProfile(): CompanyGSTProfile {
  if (typeof window === "undefined") return DEFAULT_COMPANY_PROFILE;
  try {
    const s = localStorage.getItem("orange_company_gst_profile");
    if (s) {
      const parsed = JSON.parse(s);
      return { ...DEFAULT_COMPANY_PROFILE, ...parsed };
    }
  } catch (e) {}
  return DEFAULT_COMPANY_PROFILE;
}

export function saveStoredCompanyProfile(profile: Partial<CompanyGSTProfile>) {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredCompanyProfile();
    const updated = { ...current, ...profile };
    localStorage.setItem("orange_company_gst_profile", JSON.stringify(updated));
  } catch (e) {}
}

/**
 * Resolve Indian State and GST State Code from Area/City name in Delhi-NCR
 */
export function resolveStateFromLocation(locationName: string): { state: string; code: string } {
  const loc = (locationName || "").toLowerCase();

  // Haryana (Gurugram, Faridabad, Manesar)
  if (
    loc.includes("gurugram") ||
    loc.includes("gurgaon") ||
    loc.includes("cyber city") ||
    loc.includes("faridabad") ||
    loc.includes("manesar") ||
    loc.includes("haryana")
  ) {
    return { state: "Haryana", code: "06" };
  }

  // Uttar Pradesh (Noida, Greater Noida, Ghaziabad)
  if (
    loc.includes("noida") ||
    loc.includes("greater noida") ||
    loc.includes("ghaziabad") ||
    loc.includes("uttar pradesh") ||
    loc.includes("up")
  ) {
    return { state: "Uttar Pradesh", code: "09" };
  }

  // Delhi (IGI Airport, Connaught Place, Aerocity, Malviya Nagar, Saket, etc.)
  return { state: "Delhi", code: "07" };
}

export interface GSTBreakdown {
  taxableValue: number;
  taxRate: number;
  cgstRate: number;
  cgstAmount: number;
  sgstRate: number;
  sgstAmount: number;
  igstRate: number;
  igstAmount: number;
  totalGst: number;
  totalFare: number;
  isInterState: boolean;
  placeOfSupply: string;
  posCode: string;
}

/**
 * Calculates GST for passenger transport services under SAC 996412.
 * If pickup and drop are in Delhi: 2.5% CGST + 2.5% SGST (Intra-state)
 * If crossing state border (e.g., Delhi to Gurugram or Noida): 5.0% IGST (Inter-state)
 */
export function calculateRideGST(
  totalFare: number,
  pickupArea?: string,
  dropArea?: string
): GSTBreakdown {
  const fare = Math.max(0, Number(totalFare) || 0);
  const pickupState = resolveStateFromLocation(pickupArea || "Delhi");
  const dropState = resolveStateFromLocation(dropArea || "Delhi");

  // Place of supply in passenger transport is where passenger embarks (CGST Act Section 12(9))
  // However for interstate trips from Delhi to Haryana/UP, place of supply across border triggers IGST
  const isInterState = pickupState.code !== dropState.code;
  const placeOfSupply = dropState.state;
  const posCode = dropState.code;

  // 5% inclusive calculation: Taxable = Fare / 1.05
  const taxableValue = Number((fare / 1.05).toFixed(2));
  const totalGst = Number((fare - taxableValue).toFixed(2));

  let cgstRate = 0;
  let cgstAmount = 0;
  let sgstRate = 0;
  let sgstAmount = 0;
  let igstRate = 0;
  let igstAmount = 0;

  if (isInterState) {
    igstRate = 5.0;
    igstAmount = totalGst;
  } else {
    cgstRate = 2.5;
    sgstRate = 2.5;
    cgstAmount = Number((totalGst / 2).toFixed(2));
    sgstAmount = Number((totalGst - cgstAmount).toFixed(2));
  }

  return {
    taxableValue,
    taxRate: 5.0,
    cgstRate,
    cgstAmount,
    sgstRate,
    sgstAmount,
    igstRate,
    igstAmount,
    totalGst,
    totalFare: fare,
    isInterState,
    placeOfSupply,
    posCode,
  };
}

/**
 * Generates an official sequential invoice number for a booking
 * Format: OT/2026-27/REF-XXXX
 */
export function formatInvoiceNumber(reference?: string, dateStr?: string): string {
  const d = dateStr && !isNaN(new Date(dateStr).getTime()) ? new Date(dateStr) : new Date();
  const year = d.getFullYear();
  const month = d.getMonth(); // 0-indexed
  // Indian Financial Year: April (3) to March
  const fyStart = month >= 3 ? year % 100 : (year - 1) % 100;
  const fyEnd = fyStart + 1;
  const fyStr = `${fyStart.toString().padStart(2, "0")}-${fyEnd.toString().padStart(2, "0")}`;

  const cleanRef = (reference || "0000").replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase() || "0000";
  return `OT/${fyStr}/${cleanRef}`;
}

/**
 * Generates GSTR-1 Compliant CSV content ready for GST Portal offline tool / CA filing
 */
export function generateGSTR1CSV(bookings: any[] = [], profile: CompanyGSTProfile = DEFAULT_COMPANY_PROFILE): string {
  const headers = [
    "Invoice Number",
    "Invoice Date",
    "Invoice Value (INR)",
    "Place of Supply (POS)",
    "Applicable Tax Rate (%)",
    "Rate Category",
    "Taxable Value (INR)",
    "CGST Amount (INR)",
    "SGST Amount (INR)",
    "IGST Amount (INR)",
    "Cess Amount (INR)",
    "Reverse Charge",
    "Invoice Type",
    "E-Commerce GSTIN",
    "Customer GSTIN",
    "Customer Name",
    "Vehicle Plate",
    "Route Description",
    "Payment Mode",
  ];

  const rows = (bookings || []).map((b) => {
    const fare = Number(b?.final_fare || b?.estimated_fare || 0);
    const rawDate = b?.completed_at || b?.created_at;
    const date = rawDate && !isNaN(new Date(rawDate).getTime()) ? new Date(rawDate) : new Date();
    const dateFormatted = date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).replace(/\//g, "-");

    const invNum = formatInvoiceNumber(b?.reference, rawDate);
    const gst = calculateRideGST(fare, b?.pickup_area, b?.drop_area);

    const isB2B = Boolean(b?.corporate_gstin || b?.customer_gstin);
    const invoiceType = isB2B ? "B2B (Regular)" : "B2C (Others)";

    return [
      `"${invNum}"`,
      `"${dateFormatted}"`,
      fare.toFixed(2),
      `"${gst.posCode}-${gst.placeOfSupply}"`,
      "5.00",
      `"SAC 996412"`,
      gst.taxableValue.toFixed(2),
      gst.cgstAmount.toFixed(2),
      gst.sgstAmount.toFixed(2),
      gst.igstAmount.toFixed(2),
      "0.00",
      `"N"`,
      `"${invoiceType}"`,
      `"${profile.gstin}"`,
      `"${b?.corporate_gstin || b?.customer_gstin || "URP"}"`, // URP = Unregistered Person
      `"${(b?.customer_name || "Passenger").replace(/"/g, '""')}"`,
      `"${getBookingVehiclePlate(b)}"`,
      `"${(b?.pickup_area || "")} to ${(b?.drop_area || "")}"`,
      `"${(b?.payment_method || "cash").toUpperCase()}"`,
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\r\n");
}
