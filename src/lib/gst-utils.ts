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
  supportEmail: "billing@orange-taxi.com",
  supportPhone: "+91 11 4000 7000",
};

export function getStoredCompanyProfile(): CompanyGSTProfile {
  if (typeof window === "undefined") return DEFAULT_COMPANY_PROFILE;
  try {
    const s = localStorage.getItem("orange_company_gst_profile");
    if (s) {
      const parsed = JSON.parse(s);
      if (parsed.supportEmail === "support@orange-taxi.com") {
        parsed.supportEmail = "billing@orange-taxi.com";
      }
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
 * Comprehensive Indian States and GST State Codes
 */
export const INDIAN_STATE_GST_MAP: Array<{ code: string; state: string; keywords: string[] }> = [
  // Karnataka (Code 29) - Bengaluru Metro, Mysuru, Mangaluru, etc.
  {
    code: "29",
    state: "Karnataka",
    keywords: [
      "bengaluru", "bangalore", "karnataka", "whitefield", "koramangala",
      "indiranagar", "hsr layout", "hsr", "bellandur", "electronic city",
      "kempegowda", "kia", "mg road", "hal airport", "marathahalli",
      "jayanagar", "jp nagar", "rajajinagar", "malleshwaram", "hebbal",
      "manyata", "mysuru", "mysore", "mangalore", "mangaluru", "ub city",
      "orion mall", "ecoworld", "btm layout", "sarjapur", "yelahanka",
      "bannerghatta", "cross road", "smvt"
    ],
  },
  // Maharashtra (Code 27) - Mumbai, Pune, Navi Mumbai, etc.
  {
    code: "27",
    state: "Maharashtra",
    keywords: [
      "mumbai", "pune", "maharashtra", "navi mumbai", "thane", "bandra",
      "andheri", "borivali", "bkc", "nariman point", "dadar", "powai",
      "csia", "chhatrapati shivaji", "hinjewadi", "viman nagar", "kothrud",
      "wakad", "hadapsar", "magarpatta", "nagpur", "nashik"
    ],
  },
  // Telangana (Code 36) - Hyderabad, Secunderabad, etc.
  {
    code: "36",
    state: "Telangana",
    keywords: [
      "hyderabad", "telangana", "secunderabad", "gachibowli", "hitec city",
      "madhapur", "jubilee hills", "banjara hills", "kondapur", "rgia",
      "shamshabad", "begumpet", "kukatpally"
    ],
  },
  // Tamil Nadu (Code 33) - Chennai, Coimbatore, etc.
  {
    code: "33",
    state: "Tamil Nadu",
    keywords: [
      "chennai", "tamil nadu", "coimbatore", "madurai", "omr", "guindy",
      "t nagar", "velachery", "meenambakkam", "annanagar"
    ],
  },
  // West Bengal (Code 19) - Kolkata, Howrah, etc.
  {
    code: "19",
    state: "West Bengal",
    keywords: [
      "kolkata", "calcutta", "west bengal", "salt lake", "new town",
      "howrah", "park street", "dum dum"
    ],
  },
  // Gujarat (Code 24) - Ahmedabad, Surat, Gandhinagar, etc.
  {
    code: "24",
    state: "Gujarat",
    keywords: [
      "ahmedabad", "gujarat", "surat", "vadodara", "gandhinagar", "gift city"
    ],
  },
  // Rajasthan (Code 08) - Jaipur, Udaipur, etc.
  {
    code: "08",
    state: "Rajasthan",
    keywords: [
      "jaipur", "rajasthan", "udaipur", "jodhpur", "kota"
    ],
  },
  // Haryana (Code 06) - Gurugram, Faridabad, etc.
  {
    code: "06",
    state: "Haryana",
    keywords: [
      "gurugram", "gurgaon", "cyber city", "faridabad", "manesar",
      "haryana", "panipat", "ambala", "rohtak"
    ],
  },
  // Uttar Pradesh (Code 09) - Noida, Greater Noida, Ghaziabad, Lucknow, etc.
  {
    code: "09",
    state: "Uttar Pradesh",
    keywords: [
      "noida", "greater noida", "ghaziabad", "uttar pradesh", "lucknow",
      "kanpur", "agra", "varanasi"
    ],
  },
  // Chandigarh (Code 04)
  {
    code: "04",
    state: "Chandigarh",
    keywords: [
      "chandigarh", "mohali", "panchkula"
    ],
  },
  // Kerala (Code 32)
  {
    code: "32",
    state: "Kerala",
    keywords: [
      "kochi", "cochin", "kerala", "thiruvananthapuram", "trivandrum", "kozhikode"
    ],
  },
  // Goa (Code 30)
  {
    code: "30",
    state: "Goa",
    keywords: [
      "goa", "panaji", "mopa", "dabolim"
    ],
  },
  // Delhi (Code 07)
  {
    code: "07",
    state: "Delhi",
    keywords: [
      "delhi", "new delhi", "igi airport", "connaught place", "aerocity",
      "malviya nagar", "saket", "dwarka", "rohini", "nehru place",
      "karol bagh", "hauz khas", "vasant kunj", "lajpat nagar", "panchshila"
    ],
  },
];

/**
 * Resolve Indian State and GST State Code from Location/Address/GPS string
 */
export function resolveStateFromLocation(locationName: string): { state: string; code: string } {
  const loc = (locationName || "").toLowerCase().trim();
  if (!loc) return { state: "Karnataka", code: "29" };

  // 1. Check coordinates if available (e.g. "Indiranagar (12.978, 77.641)")
  const coordsMatch = loc.match(/\((-?\d+\.?\d*),\s*(-?\d+\.?\d*)\)/);
  if (coordsMatch) {
    const lat = parseFloat(coordsMatch[1]);
    const lng = parseFloat(coordsMatch[2]);
    if (lat >= 11.5 && lat <= 18.5 && lng >= 74.0 && lng <= 78.6) {
      return { state: "Karnataka", code: "29" };
    }
    if (lat >= 28.2 && lat <= 28.9 && lng >= 76.8 && lng <= 77.5) {
      return { state: "Delhi", code: "07" };
    }
    if (lat >= 18.5 && lat <= 20.2 && lng >= 72.5 && lng <= 73.5) {
      return { state: "Maharashtra", code: "27" };
    }
    if (lat >= 17.0 && lat <= 17.7 && lng >= 78.1 && lng <= 78.7) {
      return { state: "Telangana", code: "36" };
    }
  }

  // 2. Keyword matching across Indian state database
  for (const item of INDIAN_STATE_GST_MAP) {
    if (item.keywords.some((kw) => loc.includes(kw))) {
      return { state: item.state, code: item.code };
    }
  }

  // Default to Karnataka (Code 29) as primary operating hub if unmapped
  return { state: "Karnataka", code: "29" };
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
  pickupState: string;
  dropState: string;
}

/**
 * Calculates GST for passenger transport services under SAC 996412.
 * Under Section 12(9) of the IGST Act, 2017:
 * Place of Supply (POS) for passenger transportation is the place where
 * the passenger embarks on the conveyance (the pickup state).
 *
 * If pickup and drop are in the same state: 2.5% CGST + 2.5% SGST (Intra-state)
 * If crossing state border (e.g. Delhi to Haryana or Karnataka to TN): 5.0% IGST (Inter-state)
 */
export function calculateRideGST(
  totalFare: number,
  pickupArea?: string,
  dropArea?: string
): GSTBreakdown {
  const fare = Math.max(0, Number(totalFare) || 0);
  const pickupState = resolveStateFromLocation(pickupArea || "");
  const dropState = resolveStateFromLocation(dropArea || pickupArea || "");

  // Section 12(9) IGST Act: Place of supply is where the passenger embarks
  const placeOfSupply = pickupState.state;
  const posCode = pickupState.code;
  const isInterState = pickupState.code !== dropState.code;

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
    pickupState: pickupState.state,
    dropState: dropState.state,
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
