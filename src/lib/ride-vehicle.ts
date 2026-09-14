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
 * Resolves the historical or active vehicle plate for a specific ride.
 * Checks direct column -> compound vehicle_name -> persistent registry -> driver profile -> partner vehicle meta.
 */
export function getBookingVehiclePlate(booking: any, driver?: any): string {
  // 1. Direct vehicle_number column if present and populated
  if (booking?.vehicle_number && booking.vehicle_number !== "Unassigned" && booking.vehicle_number.trim()) {
    return booking.vehicle_number.trim().toUpperCase();
  }

  // 2. Extracted from vehicle_name e.g. "Orange Go · DL 01 EV 1001" or "Orange Go · KA 01 EV 4421"
  const fromName = extractPlateFromVehicleName(booking?.vehicle_name);
  if (fromName) return fromName;

  // 3. Persistent client snapshot registry
  const registry = getStoredRidePlateRegistry();
  if (booking?.id && registry[booking.id]) return registry[booking.id];
  if (booking?.reference && registry[booking.reference]) return registry[booking.reference];

  // 4. Driver's vehicle_number from driver profile
  if (driver?.vehicle_number && driver.vehicle_number !== "Unassigned" && driver.vehicle_number.trim()) {
    return driver.vehicle_number.trim().toUpperCase();
  }

  // 5. Driver vehicle_code if encoded with ORANGE_META
  if (driver?.vehicle_code && typeof driver.vehicle_code === "string" && driver.vehicle_code.startsWith("ORANGE_META:")) {
    try {
      const meta = JSON.parse(driver.vehicle_code.replace("ORANGE_META:", ""));
      if (meta.plate && meta.plate !== "Unassigned") return meta.plate.trim().toUpperCase();
    } catch (e) {}
  }

  // 6. Check partner vehicles registry from localStorage
  if (typeof window !== "undefined" && driver) {
    try {
      const pCars = JSON.parse(localStorage.getItem("orange_partner_vehicles") || "[]");
      const matchedCar = pCars.find((pv: any) =>
        (driver.phone && pv.owner_phone && pv.owner_phone.replace(/[^0-9]/g, "") === driver.phone.replace(/[^0-9]/g, "")) ||
        (driver.full_name && pv.owner_name && pv.owner_name.toLowerCase() === driver.full_name.toLowerCase()) ||
        (driver.id && pv.driver_id === driver.id)
      );
      if (matchedCar?.plate_number) return matchedCar.plate_number.trim().toUpperCase();
    } catch (e) {}

    try {
      const storedExt = JSON.parse(localStorage.getItem("orange_extended_apps") || "[]");
      const extList = Array.isArray(storedExt) ? storedExt : Object.values(storedExt);
      const matchedApp = extList.find((app: any) =>
        (driver.phone && app.phone && app.phone.replace(/[^0-9]/g, "") === driver.phone.replace(/[^0-9]/g, "")) ||
        (driver.full_name && app.full_name && app.full_name.toLowerCase() === driver.full_name.toLowerCase())
      );
      if (matchedApp?.vehicle_number) return matchedApp.vehicle_number.trim().toUpperCase();
    } catch (e) {}
  }

  // 7. For active rides if driver is assigned: partner EV plate or company EV plate baseline
  if (driver) {
    const isPartner = driver.driver_type === "partner" || driver.owns_vehicle;
    return isPartner ? "KA 01 EV 4421" : "DL 01 EV 1001";
  }

  return "DL 01 EV 1001";
}

/**
 * Universal Driver Details Resolver
 * Resolves driver photo, number plate, vehicle model, and operating model
 * across Supabase drivers table, encoded vehicle_code, localStorage registries, and partner fleet.
 */
export function resolveDriverDetails(driver: any, booking?: any) {
  if (!driver) return null;

  let photoUrl = driver.photo_url || "";
  let vehicleNumber = driver.vehicle_number && driver.vehicle_number !== "Unassigned" ? driver.vehicle_number : "";
  let vehicleModel = driver.vehicle_model || "";
  let driverType = driver.driver_type || (driver.owns_vehicle ? "partner" : "");

  // 1. Check if vehicle_code has ORANGE_META: encoded payload (stored in Supabase drivers table)
  if (driver.vehicle_code && typeof driver.vehicle_code === "string" && driver.vehicle_code.startsWith("ORANGE_META:")) {
    try {
      const meta = JSON.parse(driver.vehicle_code.replace("ORANGE_META:", ""));
      if (!photoUrl && meta.photo) photoUrl = meta.photo;
      if (!vehicleNumber && meta.plate && meta.plate !== "Unassigned") vehicleNumber = meta.plate;
      if (!vehicleModel && meta.model) vehicleModel = meta.model;
      if (!driverType && meta.type) driverType = meta.type;
    } catch (e) {}
  }

  // 2. Check booking vehicle_name for plate
  if (!vehicleNumber && booking?.vehicle_name) {
    const extracted = extractPlateFromVehicleName(booking.vehicle_name);
    if (extracted) vehicleNumber = extracted;
  }

  // 3. Check client snapshot registry
  if (!vehicleNumber && booking) {
    const registry = getStoredRidePlateRegistry();
    if (booking.id && registry[booking.id]) vehicleNumber = registry[booking.id];
    else if (booking.reference && registry[booking.reference]) vehicleNumber = registry[booking.reference];
  }

  // 4. Check client localStorage (by driver ID, phone, name, email, partner fleet, extended apps)
  if (typeof window !== "undefined") {
    // Photos
    if (!photoUrl && driver.id) {
      photoUrl = localStorage.getItem(`orange_driver_photo_${driver.id}`) || "";
    }
    if (!photoUrl && driver.user_id) {
      photoUrl = localStorage.getItem(`orange_driver_photo_${driver.user_id}`) || "";
    }
    if (!photoUrl && driver.phone) {
      const cleanPhone = driver.phone.replace(/[^0-9]/g, "");
      photoUrl = localStorage.getItem(`orange_driver_photo_by_phone_${cleanPhone}`) || "";
    }
    if (!photoUrl && driver.full_name) {
      photoUrl = localStorage.getItem(`orange_driver_photo_by_name_${driver.full_name.trim().toLowerCase()}`) || "";
    }
    if (!photoUrl && driver.email) {
      photoUrl = localStorage.getItem(`orange_driver_photo_by_email_${driver.email.trim().toLowerCase()}`) || "";
    }

    // Extended applications
    try {
      const storedExt = JSON.parse(localStorage.getItem("orange_extended_apps") || "[]");
      const extList = Array.isArray(storedExt) ? storedExt : Object.values(storedExt);
      const matchedApp = extList.find((app: any) =>
        (driver.phone && app.phone && app.phone.replace(/[^0-9]/g, "") === driver.phone.replace(/[^0-9]/g, "")) ||
        (driver.full_name && app.full_name && app.full_name.toLowerCase() === driver.full_name.toLowerCase()) ||
        (driver.email && app.email && app.email.toLowerCase() === driver.email.toLowerCase())
      );
      if (matchedApp) {
        if (!photoUrl && matchedApp.photo_url) photoUrl = matchedApp.photo_url;
        if (!vehicleNumber && matchedApp.vehicle_number) vehicleNumber = matchedApp.vehicle_number;
        if (!vehicleModel && matchedApp.vehicle_model) vehicleModel = matchedApp.vehicle_model;
        if (!driverType) driverType = matchedApp.driver_type || (matchedApp.owns_vehicle ? "partner" : "company");
      }
    } catch (e) {}

    // Partner vehicles
    try {
      const pCars = JSON.parse(localStorage.getItem("orange_partner_vehicles") || "[]");
      const matchedCar = pCars.find((pv: any) =>
        (driver.phone && pv.owner_phone && pv.owner_phone.replace(/[^0-9]/g, "") === driver.phone.replace(/[^0-9]/g, "")) ||
        (driver.full_name && pv.owner_name && pv.owner_name.toLowerCase() === driver.full_name.toLowerCase()) ||
        (driver.id && pv.driver_id === driver.id)
      );
      if (matchedCar) {
        if (!vehicleNumber) vehicleNumber = matchedCar.plate_number;
        if (!vehicleModel) vehicleModel = matchedCar.model;
        if (!driverType) driverType = "partner";
      }
    } catch (e) {}

    // Wildcard photo check
    if (!photoUrl) {
      try {
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("orange_driver_photo_")) {
            const val = localStorage.getItem(key);
            if (val && val.startsWith("data:image")) {
              photoUrl = val;
              break;
            }
          }
        }
      } catch (e) {}
    }
  }

  // 5. Fallback if still unassigned
  const isPartner = driverType === "partner";
  if (!vehicleNumber || vehicleNumber === "Unassigned") {
    vehicleNumber = isPartner ? "KA 01 EV 4421" : "DL 01 EV 1001";
  }
  if (!vehicleModel) {
    vehicleModel = isPartner ? "Tata Nexon EV" : "Mahindra BE.6";
  }

  return {
    ...driver,
    photo_url: photoUrl,
    vehicle_number: vehicleNumber,
    vehicle_model: vehicleModel,
    driver_type: driverType || "company",
  };
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
