// @ts-nocheck
/**
 * Ride Vehicle Plate Registry & Snapshot Resolver
 * Ensures every completed ride permanently preserves the vehicle plate number
 * used during that specific ride, even if the driver is later reallocated to a different vehicle.
 */

const STORAGE_KEY = "orange_ride_vehicle_plates";

export function getStoredRidePlateRegistry(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const s = localStorage.getItem(STORAGE_KEY);
    return s ? JSON.parse(s) : {};
  } catch (e) {
    return {};
  }
}

export function saveRideVehiclePlate(bookingId?: string, plate?: string, reference?: string) {
  if (typeof window === "undefined" || !plate || plate === "Unassigned") return;
  const cleanPlate = plate.trim().toUpperCase();
  if (!cleanPlate) return;

  try {
    const registry = getStoredRidePlateRegistry();
    if (bookingId) registry[bookingId] = cleanPlate;
    if (reference) registry[reference] = cleanPlate;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(registry));
  } catch (e) {}
}

/**
 * Extracts a vehicle plate from compound vehicle_name string,
 * e.g. "Orange Go · DL 01 EV 1001" -> "DL 01 EV 1001"
 */
export function extractPlateFromVehicleName(vehicleName?: string): string | null {
  if (!vehicleName) return null;
  if (vehicleName.includes("·")) {
    const parts = vehicleName.split("·");
    const candidate = parts[parts.length - 1].trim();
    if (candidate.length >= 4 && candidate.toUpperCase() !== "UNASSIGNED") {
      return candidate.toUpperCase();
    }
  }
  if (vehicleName.includes("[") && vehicleName.includes("]")) {
    const match = vehicleName.match(/\[(.*?)\]/);
    if (match && match[1]) return match[1].trim().toUpperCase();
  }
  if (vehicleName.includes("(") && vehicleName.includes(")")) {
    const match = vehicleName.match(/\((.*?)\)/);
    if (match && match[1] && (match[1].startsWith("DL") || match[1].startsWith("HR") || match[1].startsWith("UP"))) {
      return match[1].trim().toUpperCase();
    }
  }
  return null;
}

/**
 * Formats vehicle_name with vehicle plate:
 * "Orange Go" + "DL 01 EV 1001" -> "Orange Go · DL 01 EV 1001"
 */
export function formatVehicleNameWithPlate(baseName?: string, plate?: string): string {
  const base = (baseName || "Orange Go").split("·")[0].split("[")[0].split("(")[0].trim();
  if (!plate || plate === "Unassigned" || plate === "No plate") return base;
  return `${base} · ${plate.trim().toUpperCase()}`;
}

/**
 * Resolves the historical vehicle plate for a specific ride.
 * Checks direct column -> compound vehicle_name -> persistent registry -> driver profile.
 */
export function getBookingVehiclePlate(booking: any, driver?: any): string {
  if (!booking) return driver?.vehicle_number || "DL 01 EV 1001";

  // 1. Direct vehicle_number column if present and populated
  if (booking.vehicle_number && booking.vehicle_number !== "Unassigned" && booking.vehicle_number.trim()) {
    return booking.vehicle_number.trim().toUpperCase();
  }

  // 2. Extracted from vehicle_name e.g. "Orange Go · DL 01 EV 1001"
  const fromName = extractPlateFromVehicleName(booking.vehicle_name);
  if (fromName) return fromName;

  // 3. Persistent client snapshot registry
  const registry = getStoredRidePlateRegistry();
  if (booking.id && registry[booking.id]) return registry[booking.id];
  if (booking.reference && registry[booking.reference]) return registry[booking.reference];

  // 4. For active / searching / in_progress rides: use current driver's vehicle
  const isActive = ["searching", "accepted", "arrived", "in_progress"].includes(booking.status);
  if (isActive) {
    if (driver?.vehicle_number && driver.vehicle_number !== "Unassigned") {
      return driver.vehicle_number;
    }
    return "Plate: Pending";
  }

  // 5. For completed older rides: use driver's current vehicle as initial baseline, or default fleet plate
  if (driver?.vehicle_number && driver.vehicle_number !== "Unassigned") {
    // Save this as the permanent snapshot for this ride so it never changes if driver gets a new car
    saveRideVehiclePlate(booking.id, driver.vehicle_number, booking.reference);
    return driver.vehicle_number;
  }

  return "DL 01 EV 1001";
}

/**
 * Locks the vehicle plate onto the booking in Supabase and local registry
 */
export async function lockBookingVehicle(
  supabaseClient: any,
  bookingId: string,
  plate: string,
  currentVehicleName?: string,
  reference?: string
) {
  if (!bookingId || !plate || plate === "Unassigned") return;
  const cleanPlate = plate.trim().toUpperCase();

  // Save in local registry immediately
  saveRideVehiclePlate(bookingId, cleanPlate, reference);

  const updatedVehicleName = formatVehicleNameWithPlate(currentVehicleName, cleanPlate);

  // Update in Supabase
  try {
    // Try updating both vehicle_number and vehicle_name
    const { error } = await supabaseClient
      .from("bookings")
      .update({
        vehicle_name: updatedVehicleName,
        vehicle_number: cleanPlate,
      })
      .eq("id", bookingId);

    if (error) {
      // If vehicle_number column doesn't exist in Supabase table yet, update vehicle_name only
      await supabaseClient
        .from("bookings")
        .update({
          vehicle_name: updatedVehicleName,
        })
        .eq("id", bookingId);
    }
  } catch (err) {
    // Fallback: update vehicle_name only
    try {
      await supabaseClient
        .from("bookings")
        .update({
          vehicle_name: updatedVehicleName,
        })
        .eq("id", bookingId);
    } catch (e) {}
  }
}
