// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import {
  APIProvider,
  Map,
  AdvancedMarker,
  useMap,
  useMapsLibrary,
} from "@vis.gl/react-google-maps";
import {
  MapPin,
  Navigation,
  Search,
  Loader2,
  Crosshair,
  Sparkles,
  Check,
  List,
  Map as MapIcon,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export interface MapLocation {
  name: string;
  lat: number;
  lng: number;
}

interface MapPickerProps {
  label: string;
  placeholder?: string;
  onConfirm: (location: MapLocation) => void;
  onBack?: () => void;
  apiKey?: string;
  areas?: Array<{ id: string; name: string; lat: number; lng: number; is_airport?: boolean }>;
  initialLocation?: MapLocation | null;
  fallbackCenter?: MapLocation | null;
}

// Comprehensive quick-select and search-priority presets across major Indian Metros
export const PAN_INDIA_PRESETS = [
  // Bengaluru
  {
    name: "Kempegowda Int'l Airport (BLR) - Terminal 1 & 2",
    city: "Bengaluru",
    lat: 13.1986,
    lng: 77.7066,
    tag: "✈️ BLR Airport",
    is_airport: true,
    keywords: [
      "airport",
      "blr",
      "kempegowda",
      "bangalore airport",
      "bengaluru airport",
      "kial",
      "kia",
      "t1",
      "t2",
      "terminal 1",
      "terminal 2",
      "devanahalli",
      "flight",
      "departure",
      "arrival",
    ],
  },
  {
    name: "Kempegowda Airport T2 (Garden Terminal)",
    city: "Bengaluru",
    lat: 13.2045,
    lng: 77.7125,
    tag: "✈️ BLR T2",
    is_airport: true,
    keywords: ["airport", "t2", "terminal 2", "blr t2", "kempegowda t2", "garden terminal"],
  },
  {
    name: "HAL Old Airport Road, Bengaluru",
    city: "Bengaluru",
    lat: 12.956,
    lng: 77.665,
    tag: "📍 HAL Airport",
    keywords: ["hal", "old airport", "airport road", "marathahalli", "vibhootipura"],
  },
  {
    name: "Indiranagar 100ft Road, Bengaluru",
    city: "Bengaluru",
    lat: 12.9784,
    lng: 77.6408,
    tag: "📍 Indiranagar",
    keywords: [
      "indiranagar",
      "100ft road",
      "12th main",
      "cmh road",
      "metro station",
      "defence colony",
    ],
  },
  {
    name: "Koramangala 4th Block, Bengaluru",
    city: "Bengaluru",
    lat: 12.9345,
    lng: 77.6266,
    tag: "🏢 Koramangala",
    keywords: [
      "koramangala",
      "sony world",
      "kora",
      "4th block",
      "5th block",
      "forum mall",
      "oasis mall",
    ],
  },
  {
    name: "Whitefield ITPL, Bengaluru",
    city: "Bengaluru",
    lat: 12.9863,
    lng: 77.7308,
    tag: "💼 Whitefield",
    keywords: ["whitefield", "itpl", "hope farm", "kadugodi", "tech park", "pattandur agrahara"],
  },
  {
    name: "Electronic City Phase 1, Bengaluru",
    city: "Bengaluru",
    lat: 12.8452,
    lng: 77.6602,
    tag: "⚡ Electronic City",
    keywords: [
      "electronic city",
      "ecity",
      "phase 1",
      "phase 2",
      "infosys",
      "wipro ecity",
      "velankani",
    ],
  },
  {
    name: "HSR Layout Sector 1 to 7, Bengaluru",
    city: "Bengaluru",
    lat: 12.9116,
    lng: 77.6474,
    tag: "📍 HSR Layout",
    keywords: ["hsr layout", "hsr", "27th main", "sector 1", "sector 2", "sector 3", "silk board"],
  },
  {
    name: "Bellandur / EcoWorld Tech Park, Bengaluru",
    city: "Bengaluru",
    lat: 12.926,
    lng: 77.6762,
    tag: "🏢 EcoWorld",
    keywords: [
      "bellandur",
      "ecoworld",
      "ecospace",
      "outer ring road",
      "orr",
      "marathahalli orr",
      "devarabisanahalli",
    ],
  },
  {
    name: "Manyata Tech Park, Bengaluru",
    city: "Bengaluru",
    lat: 13.0475,
    lng: 77.6214,
    tag: "💼 Manyata",
    keywords: [
      "manyata",
      "manyata tech park",
      "nagavara",
      "hebbal",
      "karle town",
      "outer ring road north",
    ],
  },
  {
    name: "MG Road Metro Station, Bengaluru",
    city: "Bengaluru",
    lat: 12.9756,
    lng: 77.6066,
    tag: "🛍️ MG Road",
    keywords: [
      "mg road",
      "brigade road",
      "church street",
      "metro",
      "commercial street",
      "residency road",
    ],
  },
  {
    name: "KSR Bengaluru City Railway Station (Majestic)",
    city: "Bengaluru",
    lat: 12.9781,
    lng: 77.5696,
    tag: "🚆 Majestic Station",
    is_railway: true,
    keywords: [
      "railway station",
      "railway",
      "majestic",
      "ksr",
      "train",
      "bangalore railway station",
      "central railway",
    ],
  },
  {
    name: "Yeshwanthpur Junction Railway Station (YPR)",
    city: "Bengaluru",
    lat: 13.0238,
    lng: 77.5503,
    tag: "🚆 Yeshwanthpur",
    is_railway: true,
    keywords: [
      "railway station",
      "railway",
      "yeshwanthpur",
      "yeshwantpur",
      "ypr",
      "train",
      "gorguntepalya",
    ],
  },
  {
    name: "SMVT Bengaluru Railway Terminal",
    city: "Bengaluru",
    lat: 13.0039,
    lng: 77.6534,
    tag: "🚆 SMVT Terminal",
    is_railway: true,
    keywords: ["smvt", "baiyappanahalli", "railway terminal", "train", "sir m visvesvaraya"],
  },
  {
    name: "Phoenix Marketcity / VR Mall, Bengaluru",
    city: "Bengaluru",
    lat: 12.9961,
    lng: 77.6963,
    tag: "🏬 Phoenix Mall",
    keywords: [
      "phoenix",
      "phoenix marketcity",
      "vr mall",
      "mall",
      "whitefield road",
      "mahadevapura",
    ],
  },
  {
    name: "Orion Mall Rajajinagar, Bengaluru",
    city: "Bengaluru",
    lat: 13.0112,
    lng: 77.555,
    tag: "🏬 Orion Mall",
    keywords: [
      "orion",
      "orion mall",
      "brigade gateway",
      "rajajinagar",
      "mall",
      "world trade center",
    ],
  },
  {
    name: "UB City, Bengaluru",
    city: "Bengaluru",
    lat: 12.9719,
    lng: 77.5958,
    tag: "🏢 UB City",
    keywords: ["ub city", "vittal mallya", "lavelle road", "kasturba road", "cubbon park"],
  },
  {
    name: "Majestic Kempegowda Bus Station",
    city: "Bengaluru",
    lat: 12.9767,
    lng: 77.5713,
    tag: "🚌 Majestic Bus Stand",
    keywords: ["bus stand", "busstand", "majestic bus", "bmtc", "ksrtc", "central bus stand"],
  },

  // Delhi NCR
  {
    name: "IGI Airport Terminal 3, Delhi",
    city: "Delhi NCR",
    lat: 28.5562,
    lng: 77.0856,
    tag: "✈️ Delhi T3",
    is_airport: true,
    keywords: [
      "airport",
      "delhi airport",
      "igi",
      "t3",
      "terminal 3",
      "indira gandhi airport",
      "flight",
    ],
  },
  {
    name: "IGI Airport Terminal 1, Delhi",
    city: "Delhi NCR",
    lat: 28.5684,
    lng: 77.1121,
    tag: "✈️ Delhi T1",
    is_airport: true,
    keywords: ["airport", "delhi airport", "igi", "t1", "terminal 1", "domestic terminal"],
  },
  {
    name: "DLF Cyber City, Gurugram",
    city: "Delhi NCR",
    lat: 28.4986,
    lng: 77.0878,
    tag: "🏢 Cyber City",
    keywords: ["cyber city", "dlf cyber hub", "gurgaon", "gurugram", "cyber park"],
  },
  {
    name: "Connaught Place Inner Circle, Delhi",
    city: "Delhi NCR",
    lat: 28.6315,
    lng: 77.2167,
    tag: "📍 Connaught Place",
    keywords: ["connaught place", "cp", "inner circle", "outer circle", "rajiv chowk"],
  },
  {
    name: "Aerocity Worldmark, Delhi",
    city: "Delhi NCR",
    lat: 28.5501,
    lng: 77.1199,
    tag: "🏨 Aerocity",
    keywords: ["aerocity", "worldmark", "delhi aerocity", "hospitality district"],
  },
  {
    name: "New Delhi Railway Station (NDLS)",
    city: "Delhi NCR",
    lat: 28.6415,
    lng: 77.2195,
    tag: "🚆 New Delhi Stn",
    is_railway: true,
    keywords: ["railway station", "railway", "ndls", "new delhi station", "train", "paharganj"],
  },
  {
    name: "Noida Sector 18 / Mall of India",
    city: "Delhi NCR",
    lat: 28.5708,
    lng: 77.3271,
    tag: "🏬 Noida Sec 18",
    keywords: ["noida", "sector 18", "mall of india", "dlf mall", "atta market"],
  },

  // Mumbai & MMR
  {
    name: "CSMIA Airport Terminal 2, Mumbai",
    city: "Mumbai",
    lat: 19.0896,
    lng: 72.8656,
    tag: "✈️ Mumbai T2",
    is_airport: true,
    keywords: [
      "airport",
      "mumbai airport",
      "csia",
      "t2",
      "terminal 2",
      "sahar",
      "chhatrapati shivaji",
    ],
  },
  {
    name: "CSMIA Airport Terminal 1, Mumbai",
    city: "Mumbai",
    lat: 19.0968,
    lng: 72.8524,
    tag: "✈️ Mumbai T1",
    is_airport: true,
    keywords: ["airport", "mumbai airport", "t1", "terminal 1", "santacruz domestic"],
  },
  {
    name: "Bandra Kurla Complex (BKC), Mumbai",
    city: "Mumbai",
    lat: 19.0664,
    lng: 72.8687,
    tag: "🏢 Mumbai BKC",
    keywords: ["bkc", "bandra kurla complex", "jiocabs", "mca", "us consulate"],
  },
  {
    name: "Nariman Point / Marine Drive, Mumbai",
    city: "Mumbai",
    lat: 18.9256,
    lng: 72.8242,
    tag: "🌊 Marine Drive",
    keywords: ["nariman point", "marine drive", "ncpa", "colaba", "churchgate"],
  },
  {
    name: "Andheri West / Lokhandwala, Mumbai",
    city: "Mumbai",
    lat: 19.1363,
    lng: 72.8277,
    tag: "📍 Andheri West",
    keywords: ["andheri", "lokhandwala", "andheri west", "infinity mall", "link road"],
  },

  // Hyderabad
  {
    name: "RGIA Airport Shamshabad, Hyderabad",
    city: "Hyderabad",
    lat: 17.2403,
    lng: 78.4294,
    tag: "✈️ HYD Airport",
    is_airport: true,
    keywords: ["airport", "hyderabad airport", "rgia", "shamshabad", "rajiv gandhi airport"],
  },
  {
    name: "HITEC City / Cyber Towers, Hyderabad",
    city: "Hyderabad",
    lat: 17.4474,
    lng: 78.3762,
    tag: "🏢 HITEC City",
    keywords: ["hitec city", "cyber towers", "madhapur", "gachibowli", "raheja mindspace"],
  },
  {
    name: "Jubilee Hills Road No. 36, Hyderabad",
    city: "Hyderabad",
    lat: 17.4325,
    lng: 78.4071,
    tag: "📍 Jubilee Hills",
    keywords: ["jubilee hills", "banjara hills", "road 36", "road 10"],
  },

  // Chennai
  {
    name: "Chennai Int'l Airport (MAA)",
    city: "Chennai",
    lat: 12.9941,
    lng: 80.1709,
    tag: "✈️ MAA Airport",
    is_airport: true,
    keywords: ["airport", "chennai airport", "maa", "meenambakkam", "terminal"],
  },
  {
    name: "T. Nagar / Pondy Bazaar, Chennai",
    city: "Chennai",
    lat: 13.0418,
    lng: 80.2341,
    tag: "🛍️ T. Nagar",
    keywords: ["t nagar", "pondy bazaar", "panagal park", "shopping"],
  },

  // Pune
  {
    name: "Pune Airport (PNQ) / Viman Nagar",
    city: "Pune",
    lat: 18.5822,
    lng: 73.9197,
    tag: "✈️ Pune Airport",
    is_airport: true,
    keywords: ["airport", "pune airport", "pnq", "lohegaon", "viman nagar"],
  },
  {
    name: "Koregaon Park / Kalyani Nagar, Pune",
    city: "Pune",
    lat: 18.5362,
    lng: 73.894,
    tag: "📍 Koregaon Park",
    keywords: ["koregaon park", "kp", "kalyani nagar", "german bakery"],
  },

  // Kolkata
  {
    name: "Netaji Subhash Airport (CCU), Kolkata",
    city: "Kolkata",
    lat: 22.6547,
    lng: 88.4467,
    tag: "✈️ CCU Airport",
    is_airport: true,
    keywords: ["airport", "kolkata airport", "ccu", "dum dum airport", "subhash chandra bose"],
  },
  {
    name: "Park Street / Chowringhee, Kolkata",
    city: "Kolkata",
    lat: 22.5513,
    lng: 88.3524,
    tag: "📍 Park Street",
    keywords: ["park street", "chowringhee", "victoria memorial", "esplanade"],
  },

  // Jaipur
  {
    name: "Jaipur Int'l Airport (JAI)",
    city: "Jaipur",
    lat: 26.8289,
    lng: 75.8056,
    tag: "✈️ Jaipur Airport",
    is_airport: true,
    keywords: ["airport", "jaipur airport", "jai", "sanganer airport"],
  },
  {
    name: "C-Scheme / MI Road, Jaipur",
    city: "Jaipur",
    lat: 26.9124,
    lng: 75.8032,
    tag: "📍 C-Scheme",
    keywords: ["c scheme", "mi road", "civil lines", "raja park"],
  },
];

const MAJOR_INDIAN_CITIES = [
  { name: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { name: "Delhi NCR", state: "Delhi", lat: 28.6139, lng: 77.209 },
  { name: "Mumbai", state: "Maharashtra", lat: 19.076, lng: 72.8777 },
  { name: "Hyderabad", state: "Telangana", lat: 17.385, lng: 78.4867 },
  { name: "Chennai", state: "Tamil Nadu", lat: 13.0827, lng: 80.2707 },
  { name: "Kolkata", state: "West Bengal", lat: 22.5726, lng: 88.3639 },
  { name: "Pune", state: "Maharashtra", lat: 18.5204, lng: 73.8567 },
  { name: "Ahmedabad", state: "Gujarat", lat: 23.0225, lng: 72.5714 },
  { name: "Jaipur", state: "Rajasthan", lat: 26.9124, lng: 75.7873 },
  { name: "Chandigarh", state: "Punjab/Haryana", lat: 30.7333, lng: 76.7794 },
  { name: "Lucknow", state: "Uttar Pradesh", lat: 26.8467, lng: 80.9462 },
  { name: "Kochi", state: "Kerala", lat: 9.9312, lng: 76.2673 },
  { name: "Goa", state: "Goa", lat: 15.4909, lng: 73.8278 },
  { name: "Indore", state: "Madhya Pradesh", lat: 22.7196, lng: 75.8577 },
  { name: "Nagpur", state: "Maharashtra", lat: 21.1458, lng: 79.0882 },
  { name: "Surat", state: "Gujarat", lat: 21.1702, lng: 72.8311 },
  { name: "Bhopal", state: "Madhya Pradesh", lat: 23.2599, lng: 77.4126 },
  { name: "Visakhapatnam", state: "Andhra Pradesh", lat: 17.6868, lng: 83.2185 },
  { name: "Patna", state: "Bihar", lat: 25.5941, lng: 85.1376 },
  { name: "Vadodara", state: "Gujarat", lat: 22.3072, lng: 73.1812 },
  { name: "Coimbatore", state: "Tamil Nadu", lat: 11.0168, lng: 76.9558 },
  { name: "Mysuru", state: "Karnataka", lat: 12.2958, lng: 76.6394 },
  { name: "Guwahati", state: "Assam", lat: 26.1445, lng: 91.7362 },
  { name: "Bhubaneswar", state: "Odisha", lat: 20.2961, lng: 85.8245 },
  { name: "Dehradun", state: "Uttarakhand", lat: 30.3165, lng: 78.0322 },
  { name: "Amritsar", state: "Punjab", lat: 31.634, lng: 74.8723 },
];

function calcHaversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function MapPanController({
  target,
  onPanned,
}: {
  target: MapLocation | null;
  onPanned: () => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (map && target) {
      map.panTo({ lat: target.lat, lng: target.lng });
      map.setZoom(16);
      onPanned();
    }
  }, [map, target, onPanned]);
  return null;
}

export function MapPicker({
  label,
  placeholder = "Search street, landmark, or drag map...",
  onConfirm,
  onBack,
  apiKey,
  areas = [],
  initialLocation = null,
  fallbackCenter = null,
}: MapPickerProps) {
  const reverseTimeoutRef = useRef<any>(null);
  const searchTimeoutRef = useRef<any>(null);

  const [mode, setMode] = useState<"map" | "list">("map");
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(initialLocation);
  const [searchValue, setSearchValue] = useState(initialLocation?.name || "");
  const [searchResults, setSearchResults] = useState<
    Array<{ name: string; lat: number; lng: number; sub?: string; placeId?: string }>
  >([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [panTarget, setPanTarget] = useState<MapLocation | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [activeCityTab, setActiveCityTab] = useState<string>("All");

  // Dynamically load Google Maps JS SDK with Places library if apiKey provided
  useEffect(() => {
    if (!apiKey) return;
    if (typeof window !== "undefined" && window.google?.maps?.places) return;

    const scriptId = "google-maps-places-sdk";
    if (!document.getElementById(scriptId)) {
      const script = document.createElement("script");
      script.id = scriptId;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.onerror = () =>
        console.warn("Google Maps JS API notice: falling back to local/OSM geocoder.");
      document.head.appendChild(script);
    }
  }, [apiKey]);

  // Initial center: Delhi NCR default
  const defaultCenter = initialLocation
    ? { lat: initialLocation.lat, lng: initialLocation.lng }
    : fallbackCenter
      ? { lat: fallbackCenter.lat, lng: fallbackCenter.lng }
      : { lat: 28.6139, lng: 77.209 };

  // Reverse geocode coordinate to friendly street address
  function handleMapMoveEnd(lat: number, lng: number) {
    if (reverseTimeoutRef.current) clearTimeout(reverseTimeoutRef.current);

    setIsResolvingAddress(true);

    reverseTimeoutRef.current = setTimeout(async () => {
      // 1. Try Google Geocoder if loaded
      if (typeof window !== "undefined" && window.google?.maps?.Geocoder) {
        try {
          const geocoder = new window.google.maps.Geocoder();
          const googleAddress: string | null = await new Promise((resolve) => {
            geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
              if (status === "OK" && results?.[0]?.formatted_address) {
                const parts = results[0].formatted_address.split(",").map((s: string) => s.trim());
                resolve(parts.slice(0, 3).join(", "));
              } else {
                resolve(null);
              }
            });
          });

          if (googleAddress) {
            setSelectedLocation({ name: googleAddress, lat, lng });
            setSearchValue(googleAddress);
            setIsResolvingAddress(false);
            return;
          }
        } catch (e) {
          // fallback to OSM Nominatim
        }
      }

      // 2. OpenStreetMap Nominatim with structured Indian address extraction
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            const formatted = data.results[0].formatted_address;
            setSearchValue(formatted);
            setSelectedLocation({ name: formatted, lat, lng });
            if (onConfirm) onConfirm({ name: formatted, lat, lng });
          } else {
            setSearchValue("Unknown Location");
          }
        }
      } catch (e) {
        // Silently catch network errors
      }

      // 3. Pan-India Intelligent Proximity Fallback
      const nearestPreset = findNearestPreset(lat, lng);
      if (nearestPreset && nearestPreset.distKm < 4) {
        const fallbackName = nearestPreset.preset.name;
        setSelectedLocation({ name: fallbackName, lat, lng });
        setSearchValue(fallbackName);
        setIsResolvingAddress(false);
        return;
      }

      const nearestCity = findNearestIndianCity(lat, lng);
      if (nearestCity && nearestCity.distKm < 60) {
        const fallbackName = `${nearestCity.city.name}, ${nearestCity.city.state} (${lat.toFixed(3)}, ${lng.toFixed(3)})`;
        setSelectedLocation({ name: fallbackName, lat, lng });
        setSearchValue(fallbackName);
        setIsResolvingAddress(false);
        return;
      }

      const fallbackGeneric = `Pin Location (${lat.toFixed(4)}, ${lng.toFixed(4)}) · India`;
      setSelectedLocation({ name: fallbackGeneric, lat, lng });
      setSearchValue(fallbackGeneric);
      setIsResolvingAddress(false);
    }, 400);
  }

  // Find closest pre-defined area by distance
  function findNearestPreset(lat: number, lng: number) {
    const list = [...areas, ...PAN_INDIA_PRESETS];
    if (!list.length) return null;
    let closest = list[0];
    let minDist = Infinity;
    list.forEach((item) => {
      const d = calcHaversineKm(lat, lng, item.lat, item.lng);
      if (d < minDist) {
        minDist = d;
        closest = item;
      }
    });
    return { preset: closest, distKm: minDist };
  }

  function findNearestIndianCity(lat: number, lng: number) {
    let closest = MAJOR_INDIAN_CITIES[0];
    let minDist = Infinity;
    MAJOR_INDIAN_CITIES.forEach((c) => {
      const d = calcHaversineKm(lat, lng, c.lat, c.lng);
      if (d < minDist) {
        minDist = d;
        closest = c;
      }
    });
    return { city: closest, distKm: minDist };
  }

  // Live search handler with smart proximity sorting and bus stop exclusion
  function handleSearchInput(query: string) {
    setSearchValue(query);
    if (!query.trim()) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);

    searchTimeoutRef.current = setTimeout(async () => {
      const qLower = query.trim().toLowerCase();
      const refLat = selectedLocation?.lat || initialLocation?.lat || 12.9716;
      const refLng = selectedLocation?.lng || initialLocation?.lng || 77.5946;

      const matchedPresets: Array<{
        name: string;
        lat: number;
        lng: number;
        sub?: string;
        distKm: number;
        isAirport?: boolean;
      }> = [];

      // 1. Instant match against curated Pan-India presets & service areas
      [...PAN_INDIA_PRESETS, ...areas].forEach((item) => {
        const keywords = (item as any).keywords || [];
        const fullTokens =
          `${item.name} ${item.city || ""} ${item.tag || ""} ${keywords.join(" ")}`.toLowerCase();

        // Exact substring match or multi-word match
        const isMatch =
          fullTokens.includes(qLower) ||
          qLower.split(/\s+/).every((word) => word.length >= 2 && fullTokens.includes(word));

        if (isMatch && !matchedPresets.some((m) => m.name === item.name)) {
          const distKm = calcHaversineKm(refLat, refLng, item.lat, item.lng);
          matchedPresets.push({
            name: item.name,
            lat: item.lat,
            lng: item.lng,
            sub: item.city
              ? `${item.city} Hub · ${item.tag || "Orange Hub"}`
              : item.is_airport
                ? "Airport Hub"
                : "Orange Service Area",
            distKm,
            isAirport: !!item.is_airport,
          });
        }
      });

      // Sort matched presets: nearest to current location first!
      matchedPresets.sort((a, b) => a.distKm - b.distKm);

      const combinedResults: Array<{
        name: string;
        lat: number;
        lng: number;
        sub?: string;
        placeId?: string;
      }> = [...matchedPresets.map((p) => ({ name: p.name, lat: p.lat, lng: p.lng, sub: p.sub }))];

      // 2. Query Google Places Autocomplete API natively via Maps JS SDK
      if (typeof window !== "undefined" && window.google?.maps?.places) {
        try {
          const autocomplete = new window.google.maps.places.AutocompleteService();
          const response = await new Promise((resolve) => {
            autocomplete.getPlacePredictions(
              {
                input: query,
                componentRestrictions: { country: "IN" },
              },
              (predictions, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                  resolve(predictions);
                } else {
                  resolve([]);
                }
              },
            );
          });

          (response as any[]).forEach((p) => {
            if (
              !combinedResults.some(
                (m) => m.name.toLowerCase() === p.structured_formatting.main_text.toLowerCase(),
              )
            ) {
              combinedResults.push({
                name: p.structured_formatting.main_text,
                sub: p.structured_formatting.secondary_text,
                lat: 0, // Will be resolved on select
                lng: 0,
                placeId: p.place_id,
              });
            }
          });
        } catch (e) {
          console.error("Places API error", e);
        }
      }

      setSearchResults(combinedResults);
      setIsSearching(false);
    }, 250);
  }

  // Select a location and resolve precise GPS coordinates anywhere in India
  async function selectTargetLocation(loc: {
    name: string;
    lat: number;
    lng: number;
    placeId?: string;
  }) {
    setSearchValue(loc.name);

    // Always clone the object to ensure React triggers a state update!
    const finalLoc = { ...loc };

    // Resolve Place ID to coordinates using Places API (guaranteed to work if Autocomplete worked)
    if (
      finalLoc.placeId &&
      finalLoc.lat === 0 &&
      finalLoc.lng === 0 &&
      typeof window !== "undefined" &&
      window.google?.maps?.places
    ) {
      try {
        await new Promise<void>((resolve) => {
          const placesService = new window.google.maps.places.PlacesService(
            document.createElement("div"),
          );
          placesService.getDetails(
            { placeId: finalLoc.placeId, fields: ["geometry", "name"] },
            (place, status) => {
              if (
                status === window.google.maps.places.PlacesServiceStatus.OK &&
                place?.geometry?.location
              ) {
                const location = place.geometry.location;
                finalLoc.lat =
                  typeof location.lat === "function" ? location.lat() : (location.lat as number);
                finalLoc.lng =
                  typeof location.lng === "function" ? location.lng() : (location.lng as number);
                if (place.name) {
                  finalLoc.name = place.name;
                  setSearchValue(finalLoc.name);
                }
              } else {
                console.error("Places API getDetails failed:", status);
              }
              resolve();
            },
          );
        });
      } catch (err) {
        console.error("PlacesService exception:", err);
      }
    }

    // Extreme Fallback: If PlacesService fails or isn't available, fallback to pure HTTP Places Details API
    // We use Places Details instead of Geocoding, because the user might not have Geocoding API enabled on GCP!
    if (finalLoc.placeId && finalLoc.lat === 0 && finalLoc.lng === 0 && apiKey) {
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${finalLoc.placeId}&fields=geometry,name&key=${apiKey}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.result && data.result.geometry && data.result.geometry.location) {
            finalLoc.lat = data.result.geometry.location.lat;
            finalLoc.lng = data.result.geometry.location.lng;
            if (data.result.name) {
              finalLoc.name = data.result.name;
              setSearchValue(finalLoc.name);
            }
          }
        }
      } catch (err) {
        console.error("Places Details fetch fallback failed", err);
      }
    }

    setSelectedLocation(finalLoc);
    setSearchResults([]);

    if (mode === "map") {
      setPanTarget(finalLoc);
    }
    if (onConfirm) onConfirm(finalLoc);
  }

  // Robust coordinate resolution fallback via Google Geocoding API
  async function fallbackResolvePlace(loc: { name: string; lat: number; lng: number }) {
    if (apiKey) {
      try {
        const res = await fetch(
          `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(loc.name)}&components=country:IN&key=${apiKey}`,
        );
        if (res.ok) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            const lat = data.results[0].geometry.location.lat;
            const lng = data.results[0].geometry.location.lng;
            const resolved = { name: loc.name, lat, lng };
            setSelectedLocation(resolved);
            setSearchValue(loc.name);
            setSearchResults([]);
            setIsResolvingAddress(false);
            if (mode === "map") {
              setPanTarget(resolved);
            }
            if (onConfirm) onConfirm(resolved);
            return;
          }
        }
      } catch {
        // best-effort: failure here is non-fatal and intentionally ignored
      }
    }

    setIsResolvingAddress(false);
    setSelectedLocation(loc);
    setSearchValue(loc.name);
    setSearchResults([]);
    if (onConfirm) onConfirm(loc);
  }

  // GPS Locate current position
  function detectCurrentLocation() {
    if (!navigator.geolocation) return;
    setLoadingGPS(true);

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (mode === "map") {
          setPanTarget({ name: "Current Location", lat, lng });
        }
        handleMapMoveEnd(lat, lng);
        setLoadingGPS(false);
      },
      (err) => {
        console.warn("GPS location error:", err);
        setLoadingGPS(false);
        if (mode === "map") {
          setPanTarget({ name: "Default", lat: 28.6139, lng: 77.209 });
        }
      },
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }

  return (
    <div className="flex flex-col gap-3 sm:gap-4 text-foreground min-w-0 max-w-full overflow-hidden">
      {/* Header with Mode Switcher */}
      <div className="flex items-center justify-between gap-2 min-w-0 max-w-full">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary truncate">
            {label}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
            {mode === "map"
              ? "Drag pin or search your destination"
              : "Select from popular hubs across India"}
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center shrink-0 rounded-lg border border-input bg-muted p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("map")}
            className={`flex items-center gap-1 sm:gap-1.5 rounded-md px-2 sm:px-2.5 py-1 font-medium transition-colors ${
              mode === "map"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MapIcon className="size-3.5" /> <span className="text-xs">Map</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("list")}
            className={`flex items-center gap-1 sm:gap-1.5 rounded-md px-2 sm:px-2.5 py-1 font-medium transition-colors ${
              mode === "list"
                ? "bg-primary text-primary-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <List className="size-3.5" /> <span className="text-xs">Hubs</span>
          </button>
        </div>
      </div>

      {/* Search Input Bar + Locate Button */}
      <div className="relative z-20 flex gap-2 min-w-0 max-w-full">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            type="text"
            className="w-full rounded-xl border border-input bg-muted/90 text-foreground placeholder:text-neutral-400 py-2.5 sm:py-3 pl-9 sm:pl-10 pr-9 text-xs sm:text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/30 shadow-xs truncate"
            placeholder={placeholder}
            value={searchValue}
            onChange={(e) => handleSearchInput(e.target.value)}
          />
          {searchValue && (
            <button
              type="button"
              onClick={() => {
                setSearchValue("");
                setSearchResults([]);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-foreground p-1"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>

        {/* Quick GPS Auto-locate Button */}
        <Button
          type="button"
          variant="secondary"
          onClick={detectCurrentLocation}
          disabled={loadingGPS}
          title="Use my current GPS location"
          className="shrink-0 rounded-xl border border-input bg-muted hover:bg-white/20 text-foreground px-2.5 sm:px-3 h-auto py-2 sm:py-2.5"
        >
          {loadingGPS ? (
            <Loader2 className="size-4 animate-spin text-primary" />
          ) : (
            <Crosshair className="size-4 text-primary" />
          )}
          <span className="hidden sm:inline text-xs font-semibold ml-1.5">My Location</span>
        </Button>

        {/* Autocomplete Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-input bg-muted p-1.5 shadow-2xl z-50 text-foreground">
            {searchResults.map((result, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectTargetLocation(result)}
                className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-muted"
              >
                <MapPin className="size-3.5 shrink-0 text-primary mt-0.5" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground truncate">{result.name}</p>
                  {result.sub && <p className="text-[10px] text-muted-foreground">{result.sub}</p>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Quick Location Chips (Pan-India Popular) */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none min-w-0 max-w-full touch-pan-x">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0 flex items-center gap-1">
          <Sparkles className="size-3 text-primary" /> Popular:
        </span>
        {PAN_INDIA_PRESETS.slice(0, 8).map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => selectTargetLocation(preset)}
            className="shrink-0 rounded-full border border-input bg-muted px-2.5 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/20 active:scale-95"
          >
            {preset.tag}
          </button>
        ))}
      </div>

      {/* MAP VIEW */}
      {mode === "map" && (
        <div className="relative h-64 sm:h-72 w-full overflow-hidden rounded-2xl border border-input bg-muted shadow-inner min-w-0 max-w-full touch-none">
          <Map
            defaultCenter={defaultCenter}
            gestureHandling="greedy"
            mapId="orange-taxi-picker"
            defaultZoom={initialLocation ? 15 : 13}
            disableDefaultUI={true}
            onDragend={(e) => {
              if (e.map.getCenter()) {
                const center = e.map.getCenter();
                handleMapMoveEnd(center.lat(), center.lng());
              }
            }}
            style={{ width: "100%", height: "100%" }}
          >
            <MapPanController target={panTarget} onPanned={() => setPanTarget(null)} />
          </Map>

          {/* Center Target Pin (Fixed overlay in center of map) */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="flex flex-col items-center -translate-y-5 transition-transform duration-150">
              {/* Animated Orange Pin */}
              <div className="flex size-11 items-center justify-center rounded-full bg-primary text-foreground shadow-2xl ring-4 ring-primary/30 animate-gentle-pulse">
                <MapPin className="size-5 fill-current" />
              </div>
              {/* Drop Target Shadow */}
              <div className="mt-1 h-1.5 w-6 rounded-full bg-black/50 blur-xs" />
            </div>
          </div>

          {/* GPS Current Location Float Button */}
          <button
            type="button"
            onClick={detectCurrentLocation}
            disabled={loadingGPS}
            aria-label="Find my current location"
            className="absolute bottom-3 right-3 z-10 flex size-10 items-center justify-center rounded-full border border-input bg-muted text-foreground shadow-lg transition-all hover:bg-background hover:border-primary active:scale-95"
          >
            {loadingGPS ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <Crosshair className="size-4 text-primary" />
            )}
          </button>

          {/* Map Status Hint */}
          <div className="absolute bottom-2.5 left-3 z-10">
            <span className="rounded-full bg-black/80 border border-input px-2.5 py-0.5 text-[10px] font-medium text-foreground/80 backdrop-blur-xs shadow-xs">
              {isResolvingAddress
                ? "📍 Resolving address..."
                : "Pan or drag pin anywhere across India"}
            </span>
          </div>
        </div>
      )}

      {/* QUICK LIST VIEW (Categorized by City) */}
      {mode === "list" && (
        <div className="rounded-2xl border border-input bg-card p-4 space-y-3 shadow-xs">
          {/* City Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-border">
            {["All", "Bengaluru", "Delhi NCR", "Mumbai", "Hyderabad", "Other Metros"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCityTab(c)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  activeCityTab === c
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
            {PAN_INDIA_PRESETS.filter((item) => {
              if (activeCityTab === "All") return true;
              if (activeCityTab === "Other Metros") {
                return !["Bengaluru", "Delhi NCR", "Mumbai", "Hyderabad"].includes(item.city);
              }
              return item.city === activeCityTab;
            }).map((item: any, i) => {
              const isSelected = selectedLocation?.name === item.name;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => selectTargetLocation(item)}
                  className={`flex items-center justify-between rounded-xl border p-3 text-left transition-all ${
                    isSelected
                      ? "border-primary bg-primary/20 text-primary font-semibold shadow-xs"
                      : "border-white/15 bg-card hover:border-primary/50 hover:bg-muted text-foreground"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MapPin
                      className={`size-4 shrink-0 ${isSelected ? "text-primary" : "text-primary/70"}`}
                    />
                    <div className="min-w-0">
                      <p className="text-xs truncate font-medium">{item.name}</p>
                      <p className="text-[10px] text-foreground/50">{item.city} · Pan-India Hub</p>
                    </div>
                  </div>
                  {item.is_airport || item.tag?.includes("Airport") ? (
                    <span className="shrink-0 text-[10px] rounded-full bg-amber-500/20 text-amber-300 font-semibold px-2 py-0.5">
                      Airport
                    </span>
                  ) : isSelected ? (
                    <Check className="size-3.5 text-primary shrink-0" />
                  ) : null}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Confirmed Location Badge */}
      {selectedLocation && (
        <div className="flex items-center gap-2.5 rounded-xl border border-primary/40 bg-primary/15 px-3.5 sm:px-4 py-2.5 sm:py-3 text-xs min-w-0 max-w-full">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-foreground">
            <Check className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase font-bold tracking-wider text-primary">
              Selected {label}
            </p>
            <p className="font-semibold text-foreground truncate">{selectedLocation.name}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2.5 sm:gap-3 pt-1 min-w-0 max-w-full">
        {onBack && (
          <Button
            type="button"
            variant="ghost"
            className="flex-1 text-muted-foreground hover:text-foreground text-xs sm:text-sm"
            onClick={onBack}
          >
            Back
          </Button>
        )}
        <Button
          type="button"
          className="flex-1 text-xs sm:text-sm font-semibold"
          disabled={!selectedLocation}
          onClick={() => selectedLocation && onConfirm(selectedLocation)}
        >
          Confirm {label} →
        </Button>
      </div>
    </div>
  );
}
