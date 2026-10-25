// @ts-nocheck

export type CabinClimate = "chilled" | "pleasant" | "eco";

export interface RidePreferences {
  cabinClimate?: CabinClimate;
  quietRide?: boolean;
  pickupPillar?: string;
}

/**
 * Encodes geographic coordinates with serialized passenger comfort preferences
 * into a single unified string stored in Supabase bookings.pickup_address.
 * Example output: "12.9784,77.6408|PREF:%7B%22cabinClimate%22%3A%22chilled%22%2C%22quietRide%22%3Atrue%7D"
 */
export function encodePickupAddressWithPrefs(
  coords: { lat: number; lng: number } | string,
  prefs: RidePreferences,
): string {
  let coordStr = "";
  if (typeof coords === "string") {
    coordStr = coords.split("|PREF:")[0].trim();
  } else if (coords && typeof coords.lat === "number" && typeof coords.lng === "number") {
    coordStr = `${coords.lat},${coords.lng}`;
  }

  const cleanPrefs: RidePreferences = {};
  if (prefs.cabinClimate) cleanPrefs.cabinClimate = prefs.cabinClimate;
  if (typeof prefs.quietRide === "boolean") cleanPrefs.quietRide = prefs.quietRide;
  if (prefs.pickupPillar && prefs.pickupPillar.trim())
    cleanPrefs.pickupPillar = prefs.pickupPillar.trim();

  if (Object.keys(cleanPrefs).length === 0) {
    return coordStr;
  }

  return `${coordStr}|PREF:${encodeURIComponent(JSON.stringify(cleanPrefs))}`;
}

/**
 * Extracts pure latitude and longitude numbers from a compound coordinate or address string,
 * cleanly ignoring any embedded preference tokens.
 */
export function parseCleanCoords(
  coordsOrAddress?: string | null,
): { lat: number; lng: number } | null {
  if (!coordsOrAddress || typeof coordsOrAddress !== "string") return null;

  const cleanPart = coordsOrAddress.split("|PREF:")[0].trim();
  const match = cleanPart.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/);
  if (match) {
    const lat = parseFloat(match[1]);
    const lng = parseFloat(match[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  // Check parenthesized coordinates: e.g. "Indiranagar (12.9784, 77.6408)"
  const parenMatch = cleanPart.match(/\((-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)\)/);
  if (parenMatch) {
    const lat = parseFloat(parenMatch[1]);
    const lng = parseFloat(parenMatch[2]);
    if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
      return { lat, lng };
    }
  }

  return null;
}

/**
 * Extracts passenger comfort preferences (AC temperature, Quiet Mode, Hub/Pillar)
 * from booking pickup_address or local device storage.
 */
export function parseRidePreferences(
  pickupAddress?: string | null,
  bookingIdOrRef?: string | null,
): RidePreferences {
  const prefs: RidePreferences = {};

  // 1. Try reading from pickupAddress embedded |PREF: metadata
  if (pickupAddress && typeof pickupAddress === "string" && pickupAddress.includes("|PREF:")) {
    try {
      const rawPayload = pickupAddress.split("|PREF:")[1].trim();
      let decodedStr = rawPayload;
      try {
        decodedStr = decodeURIComponent(rawPayload);
      } catch {
        // best-effort: failure here is non-fatal and intentionally ignored
      }

      const parsed = JSON.parse(decodedStr);
      if (parsed) {
        if (parsed.cabinClimate) prefs.cabinClimate = parsed.cabinClimate;
        if (typeof parsed.quietRide === "boolean") prefs.quietRide = parsed.quietRide;
        if (parsed.pickupPillar) prefs.pickupPillar = parsed.pickupPillar;
        if (parsed.pillar) prefs.pickupPillar = parsed.pillar;
      }
    } catch (err) {
      console.warn("Could not parse embedded ride preferences:", err);
    }
  }

  // 2. Check local device storage fallback (if booked on or synced to this browser)
  if (typeof window !== "undefined" && bookingIdOrRef) {
    try {
      const stored =
        localStorage.getItem(`orange_ride_pref_${bookingIdOrRef}`) ||
        localStorage.getItem(`orange_ride_pref_${String(bookingIdOrRef).trim()}`);
      if (stored) {
        const localParsed = JSON.parse(stored);
        if (!prefs.cabinClimate && localParsed.cabinClimate)
          prefs.cabinClimate = localParsed.cabinClimate;
        if (typeof prefs.quietRide !== "boolean" && typeof localParsed.quietRide === "boolean") {
          prefs.quietRide = localParsed.quietRide;
        }
        if (!prefs.pickupPillar && (localParsed.pickupPillar || localParsed.pillar)) {
          prefs.pickupPillar = localParsed.pickupPillar || localParsed.pillar;
        }
      }
    } catch {
      // best-effort: failure here is non-fatal and intentionally ignored
    }
  }

  return prefs;
}

/**
 * Returns human-readable label for the chosen cabin climate
 */
export function getCabinClimateLabel(climate?: CabinClimate | string): string {
  switch (climate) {
    case "chilled":
      return "Pre-cool AC: Chilled (20°C)";
    case "pleasant":
      return "Pre-cool AC: Pleasant (23°C)";
    case "eco":
      return "AC: Eco / Fresh Air";
    default:
      return "AC: Normal (22°C)";
  }
}

/**
 * Returns short badge label with icon
 */
export function getCabinClimateBadge(climate?: CabinClimate | string): {
  icon: string;
  label: string;
  temp: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
} {
  switch (climate) {
    case "chilled":
      return {
        icon: "❄️",
        label: "Chilled AC (20°C)",
        temp: "20°C",
        bgClass: "bg-sky-500/10 dark:bg-sky-950/40",
        borderClass: "border-sky-500/30 dark:border-sky-800",
        textClass: "text-sky-600 dark:text-sky-400",
      };
    case "pleasant":
      return {
        icon: "🍃",
        label: "Pleasant AC (23°C)",
        temp: "23°C",
        bgClass: "bg-emerald-500/10 dark:bg-emerald-950/40",
        borderClass: "border-emerald-500/30 dark:border-emerald-800",
        textClass: "text-emerald-600 dark:text-emerald-400",
      };
    case "eco":
      return {
        icon: "🌿",
        label: "Eco / Fresh Air",
        temp: "Fresh Air",
        bgClass: "bg-teal-500/10 dark:bg-teal-950/40",
        borderClass: "border-teal-500/30 dark:border-teal-800",
        textClass: "text-teal-600 dark:text-teal-400",
      };
    default:
      return {
        icon: "❄️",
        label: "AC Standard",
        temp: "22°C",
        bgClass: "bg-sky-500/10 dark:bg-sky-950/40",
        borderClass: "border-sky-500/30 dark:border-sky-800",
        textClass: "text-sky-600 dark:text-sky-400",
      };
  }
}
