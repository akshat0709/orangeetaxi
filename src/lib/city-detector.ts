/**
 * Real-time City & Metro Hub Auto-Detection
 * Resolves the operational hub from driver GPS coordinates
 */

export interface CityHub {
  id: string;
  name: string;
  shortName: string;
  lat: number;
  lng: number;
  radiusKm: number;
}

export const SUPPORTED_CITY_HUBS: CityHub[] = [
  {
    id: "bengaluru",
    name: "Bengaluru Hub",
    shortName: "Bengaluru",
    lat: 12.9716,
    lng: 77.5946,
    radiusKm: 120,
  },
  {
    id: "delhi",
    name: "Delhi NCR Hub",
    shortName: "Delhi NCR",
    lat: 28.6139,
    lng: 77.209,
    radiusKm: 140,
  },
  {
    id: "mumbai",
    name: "Mumbai Hub",
    shortName: "Mumbai",
    lat: 19.076,
    lng: 72.8777,
    radiusKm: 110,
  },
  {
    id: "hyderabad",
    name: "Hyderabad Hub",
    shortName: "Hyderabad",
    lat: 17.385,
    lng: 78.4867,
    radiusKm: 110,
  },
  {
    id: "chennai",
    name: "Chennai Hub",
    shortName: "Chennai",
    lat: 13.0827,
    lng: 80.2707,
    radiusKm: 90,
  },
  { id: "pune", name: "Pune Hub", shortName: "Pune", lat: 18.5204, lng: 73.8567, radiusKm: 90 },
  {
    id: "kolkata",
    name: "Kolkata Hub",
    shortName: "Kolkata",
    lat: 22.5726,
    lng: 88.3639,
    radiusKm: 90,
  },
  {
    id: "ahmedabad",
    name: "Ahmedabad Hub",
    shortName: "Ahmedabad",
    lat: 23.0225,
    lng: 72.5714,
    radiusKm: 90,
  },
  {
    id: "jaipur",
    name: "Jaipur Hub",
    shortName: "Jaipur",
    lat: 26.9124,
    lng: 75.7873,
    radiusKm: 90,
  },
  {
    id: "chandigarh",
    name: "Chandigarh Hub",
    shortName: "Chandigarh",
    lat: 30.7333,
    lng: 76.7794,
    radiusKm: 80,
  },
  { id: "kochi", name: "Kochi Hub", shortName: "Kochi", lat: 9.9312, lng: 76.2673, radiusKm: 80 },
  { id: "goa", name: "Goa Hub", shortName: "Goa", lat: 15.2993, lng: 74.124, radiusKm: 80 },
];

export function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) *
      Math.cos(lat2 * (Math.PI / 180)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function detectCityFromCoords(
  lat?: number | null,
  lng?: number | null,
  fallbackCity?: string,
  includeHubSuffix: boolean = true,
): string {
  if (
    typeof lat !== "number" ||
    typeof lng !== "number" ||
    isNaN(lat) ||
    isNaN(lng) ||
    (lat === 0 && lng === 0)
  ) {
    if (fallbackCity && fallbackCity.trim()) {
      const clean = fallbackCity.replace(/\s+Hub$/i, "").trim();
      return includeHubSuffix ? `${clean} Hub` : clean;
    }
    return includeHubSuffix ? "Bengaluru Hub" : "Bengaluru";
  }

  let nearest = SUPPORTED_CITY_HUBS[0] || {
    name: "Bengaluru Hub",
    shortName: "Bengaluru",
    lat: 12.9716,
    lng: 77.5946,
    radiusKm: 40,
  };
  let minD = Infinity;

  for (const hub of SUPPORTED_CITY_HUBS) {
    const d = getDistanceKm(lat, lng, hub.lat, hub.lng);
    if (d <= hub.radiusKm) {
      return includeHubSuffix ? hub.name : hub.shortName;
    }
    if (d < minD) {
      minD = d;
      nearest = hub;
    }
  }

  if (minD < 300) {
    return includeHubSuffix ? nearest.name : nearest.shortName;
  }

  if (fallbackCity && fallbackCity.trim()) {
    const clean = fallbackCity.replace(/\s+Hub$/i, "").trim();
    return includeHubSuffix ? `${clean} Hub` : clean;
  }

  return includeHubSuffix ? nearest.name : nearest.shortName;
}

export function getCityDefaultCenter(cityName?: string): { lat: number; lng: number } {
  const c = (cityName || "").toLowerCase();
  if (
    c.includes("delhi") ||
    c.includes("ncr") ||
    c.includes("gurgaon") ||
    c.includes("gurugram") ||
    c.includes("noida") ||
    c.includes("faridabad") ||
    c.includes("ghaziabad")
  ) {
    return { lat: 28.6139, lng: 77.209 };
  }
  if (c.includes("mumbai") || c.includes("bombay") || c.includes("navi") || c.includes("thane")) {
    return { lat: 19.076, lng: 72.8777 };
  }
  if (c.includes("hyderabad") || c.includes("secunderabad") || c.includes("cyberabad")) {
    return { lat: 17.385, lng: 78.4867 };
  }
  if (c.includes("chennai") || c.includes("madras")) {
    return { lat: 13.0827, lng: 80.2707 };
  }
  if (c.includes("pune")) {
    return { lat: 18.5204, lng: 73.8567 };
  }
  if (c.includes("kolkata") || c.includes("calcutta")) {
    return { lat: 22.5726, lng: 88.3639 };
  }
  if (c.includes("jaipur")) {
    return { lat: 26.9124, lng: 75.7873 };
  }
  if (c.includes("ahmedabad")) {
    return { lat: 23.0225, lng: 72.5714 };
  }
  if (c.includes("chandigarh")) {
    return { lat: 30.7333, lng: 76.7794 };
  }
  if (c.includes("kochi") || c.includes("cochin")) {
    return { lat: 9.9312, lng: 76.2673 };
  }
  if (c.includes("goa")) {
    return { lat: 15.2993, lng: 74.124 };
  }
  return { lat: 12.9716, lng: 77.5946 }; // Default Bengaluru
}
