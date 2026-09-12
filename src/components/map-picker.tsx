// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, Search, Loader2, Crosshair, Sparkles, Check, List, Map as MapIcon, X } from "lucide-react";
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
}

// Popular quick-select presets across major Indian Metros
export const PAN_INDIA_PRESETS = [
  // Bengaluru
  { name: "Kempegowda Int'l Airport (BLR)", city: "Bengaluru", lat: 13.1986, lng: 77.7066, tag: "✈️ BLR Airport", is_airport: true },
  { name: "Indiranagar 100ft Road, Bengaluru", city: "Bengaluru", lat: 12.9784, lng: 77.6408, tag: "📍 Indiranagar" },
  { name: "Koramangala 4th Block, Bengaluru", city: "Bengaluru", lat: 12.9345, lng: 77.6266, tag: "🏢 Koramangala" },
  { name: "Whitefield ITPL, Bengaluru", city: "Bengaluru", lat: 12.9863, lng: 77.7308, tag: "💼 Whitefield" },
  { name: "Electronic City Phase 1, Bengaluru", city: "Bengaluru", lat: 12.8452, lng: 77.6602, tag: "⚡ Electronic City" },
  { name: "MG Road Metro Station, Bengaluru", city: "Bengaluru", lat: 12.9756, lng: 77.6066, tag: "🛍️ MG Road" },

  // Delhi NCR
  { name: "IGI Airport Terminal 3, Delhi", city: "Delhi NCR", lat: 28.5562, lng: 77.0856, tag: "✈️ Delhi T3", is_airport: true },
  { name: "IGI Airport Terminal 1, Delhi", city: "Delhi NCR", lat: 28.5684, lng: 77.1121, tag: "✈️ Delhi T1", is_airport: true },
  { name: "DLF Cyber City, Gurugram", city: "Delhi NCR", lat: 28.4986, lng: 77.0878, tag: "🏢 Cyber City" },
  { name: "Connaught Place Inner Circle, Delhi", city: "Delhi NCR", lat: 28.6315, lng: 77.2167, tag: "📍 Connaught Place" },
  { name: "Aerocity Worldmark, Delhi", city: "Delhi NCR", lat: 28.5501, lng: 77.1199, tag: "🏨 Aerocity" },
  { name: "Noida Sector 18 / Mall of India", city: "Delhi NCR", lat: 28.5708, lng: 77.3271, tag: "🏬 Noida Sec 18" },

  // Mumbai & MMR
  { name: "CSMIA Airport Terminal 2, Mumbai", city: "Mumbai", lat: 19.0896, lng: 72.8656, tag: "✈️ Mumbai T2", is_airport: true },
  { name: "Bandra Kurla Complex (BKC), Mumbai", city: "Mumbai", lat: 19.0664, lng: 72.8687, tag: "🏢 Mumbai BKC" },
  { name: "Nariman Point / Marine Drive, Mumbai", city: "Mumbai", lat: 18.9256, lng: 72.8242, tag: "🌊 Marine Drive" },
  { name: "Andheri West / Lokhandwala, Mumbai", city: "Mumbai", lat: 19.1363, lng: 72.8277, tag: "📍 Andheri West" },

  // Hyderabad
  { name: "RGIA Airport Shamshabad, Hyderabad", city: "Hyderabad", lat: 17.2403, lng: 78.4294, tag: "✈️ HYD Airport", is_airport: true },
  { name: "HITEC City / Cyber Towers, Hyderabad", city: "Hyderabad", lat: 17.4474, lng: 78.3762, tag: "🏢 HITEC City" },
  { name: "Jubilee Hills Road No. 36, Hyderabad", city: "Hyderabad", lat: 17.4325, lng: 78.4071, tag: "📍 Jubilee Hills" },

  // Chennai
  { name: "Chennai Int'l Airport (MAA)", city: "Chennai", lat: 12.9941, lng: 80.1709, tag: "✈️ MAA Airport", is_airport: true },
  { name: "T. Nagar / Pondy Bazaar, Chennai", city: "Chennai", lat: 13.0418, lng: 80.2341, tag: "🛍️ T. Nagar" },

  // Pune
  { name: "Pune Airport (PNQ) / Viman Nagar", city: "Pune", lat: 18.5822, lng: 73.9197, tag: "✈️ Pune Airport", is_airport: true },
  { name: "Koregaon Park / Kalyani Nagar, Pune", city: "Pune", lat: 18.5362, lng: 73.8940, tag: "📍 Koregaon Park" },

  // Kolkata
  { name: "Netaji Subhash Airport (CCU), Kolkata", city: "Kolkata", lat: 22.6547, lng: 88.4467, tag: "✈️ CCU Airport", is_airport: true },
  { name: "Park Street / Chowringhee, Kolkata", city: "Kolkata", lat: 22.5513, lng: 88.3524, tag: "📍 Park Street" },

  // Jaipur
  { name: "Jaipur Int'l Airport (JAI)", city: "Jaipur", lat: 26.8289, lng: 75.8056, tag: "✈️ Jaipur Airport", is_airport: true },
  { name: "C-Scheme / MI Road, Jaipur", city: "Jaipur", lat: 26.9124, lng: 75.8032, tag: "📍 C-Scheme" },
];

const MAJOR_INDIAN_CITIES = [
  { name: "Bengaluru", state: "Karnataka", lat: 12.9716, lng: 77.5946 },
  { name: "Delhi NCR", state: "Delhi", lat: 28.6139, lng: 77.2090 },
  { name: "Mumbai", state: "Maharashtra", lat: 19.0760, lng: 72.8777 },
  { name: "Hyderabad", state: "Telangana", lat: 17.3850, lng: 78.4867 },
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
  { name: "Amritsar", state: "Punjab", lat: 31.6340, lng: 74.8723 },
];

function calcHaversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function MapPicker({
  label,
  placeholder = "Search street, landmark, or drag map...",
  onConfirm,
  onBack,
  apiKey,
  areas = [],
  initialLocation = null,
}: MapPickerProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const reverseTimeoutRef = useRef<any>(null);
  const searchTimeoutRef = useRef<any>(null);

  const [mode, setMode] = useState<"map" | "list">("map");
  const [selectedLocation, setSelectedLocation] = useState<MapLocation | null>(initialLocation);
  const [searchValue, setSearchValue] = useState(initialLocation?.name || "");
  const [searchResults, setSearchResults] = useState<Array<{ name: string; lat: number; lng: number; sub?: string; placeId?: string }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
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
      script.onerror = () => console.warn("Google Maps JS API notice: falling back to local/OSM geocoder.");
      document.head.appendChild(script);
    }
  }, [apiKey]);

  // Initial center: Delhi NCR default
  const defaultCenter = initialLocation
    ? { lat: initialLocation.lat, lng: initialLocation.lng }
    : { lat: 28.6139, lng: 77.2090 };

  // Load Leaflet dynamically via CDN
  useEffect(() => {
    let isMounted = true;

    async function initLeaflet() {
      try {
        // Ensure Leaflet CSS is in document head
        if (!document.getElementById("leaflet-cdn-css")) {
          const link = document.createElement("link");
          link.id = "leaflet-cdn-css";
          link.rel = "stylesheet";
          link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
          document.head.appendChild(link);
        }

        // Load Leaflet JS if not already loaded
        if (!window.L) {
          await new Promise<void>((resolve, reject) => {
            const existingScript = document.getElementById("leaflet-cdn-js");
            if (existingScript) {
              existingScript.addEventListener("load", () => resolve());
              existingScript.addEventListener("error", () => reject(new Error("Failed to load Leaflet")));
              return;
            }
            const script = document.createElement("script");
            script.id = "leaflet-cdn-js";
            script.src = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.js";
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error("Failed to load Leaflet script"));
            document.head.appendChild(script);
          });
        }

        if (!isMounted || !mapContainerRef.current) return;

        // Cleanup existing map if re-initializing
        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const L = window.L;
        const map = L.map(mapContainerRef.current, {
          center: [defaultCenter.lat, defaultCenter.lng],
          zoom: initialLocation ? 15 : 13,
          zoomControl: false,
          attributionControl: false,
          minZoom: 4,
          maxZoom: 20,
        });

        // Clean Google Maps roadmap tiles: fast CDN, highly detailed Indian landmarks/roads, zero watermarks
        L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          subdomains: "0123",
          maxZoom: 20,
          attribution: "© Google Maps",
        }).addTo(map);

        // Add subtle zoom control in top right
        L.control.zoom({ position: "topright" }).addTo(map);

        mapInstanceRef.current = map;
        setMapLoaded(true);

        // Handle user dragging map -> reverse geocode new center pin
        map.on("dragend", () => {
          const center = map.getCenter();
          handleMapMoveEnd(center.lat, center.lng);
        });

        // Invalidate size after container rendering animation
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 200);

        // Auto-center map view to user's general area without forcing selection
        if (!initialLocation && navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (pos) => {
              if (!isMounted || !mapInstanceRef.current) return;
              const lat = pos.coords.latitude;
              const lng = pos.coords.longitude;
              mapInstanceRef.current.setView([lat, lng], 13);
            },
            () => {},
            { enableHighAccuracy: false, timeout: 4000 }
          );
        }
      } catch (err) {
        console.warn("Leaflet map initialization notice:", err);
        if (isMounted) {
          setLoadError(true);
          setMode("list"); // Auto-fallback to clean list mode if CDN blocked
        }
      }
    }

    if (mode === "map") {
      initLeaflet();
    }

    return () => {
      isMounted = false;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
      if (reverseTimeoutRef.current) clearTimeout(reverseTimeoutRef.current);
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [mode]);

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
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        if (res.ok) {
          const data = await res.json();
          const addr = data.address || {};
          
          // Build clean, human-readable Indian location name
          const road = addr.road || addr.street || "";
          const locality = addr.suburb || addr.neighbourhood || addr.residential || addr.commercial || addr.quarter || "";
          const city = addr.city || addr.town || addr.municipality || addr.city_district || addr.county || addr.state_district || "";
          const state = addr.state || "";

          const primaryTokens = [road, locality].filter(Boolean);
          const secondaryTokens = [city, state].filter(Boolean);

          let formatted = "";
          if (primaryTokens.length > 0 && secondaryTokens.length > 0) {
            formatted = `${primaryTokens.join(", ")}, ${secondaryTokens[0]}`;
          } else if (primaryTokens.length > 0) {
            formatted = primaryTokens.join(", ");
          } else if (secondaryTokens.length > 0) {
            formatted = secondaryTokens.join(", ");
          } else if (data.display_name) {
            formatted = data.display_name.split(",").slice(0, 3).map((s: string) => s.trim()).join(", ");
          }

          if (formatted) {
            setSelectedLocation({ name: formatted, lat, lng });
            setSearchValue(formatted);
            setIsResolvingAddress(false);
            return;
          }
        }
      } catch (e) {
        // Silently catch network errors
      }

      // 3. Pan-India Intelligent Proximity Fallback (Never mislabels Bengaluru as Delhi!)
      const nearestPreset = findNearestPreset(lat, lng);
      if (nearestPreset && nearestPreset.distKm < 15) {
        const fallbackName = `Near ${nearestPreset.preset.name}`;
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

  // Live search handler with suggestions
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
      const qLower = query.toLowerCase();
      const localMatches: Array<{ name: string; lat: number; lng: number; sub?: string; placeId?: string }> = [];

      // 1. Instant match against Pan-India presets & areas
      [...PAN_INDIA_PRESETS, ...areas].forEach((item) => {
        const fullStr = `${item.name} ${item.city || ""} ${item.tag || ""}`.toLowerCase();
        if (fullStr.includes(qLower) && !localMatches.some((m) => m.name === item.name)) {
          localMatches.push({
            name: item.name,
            lat: item.lat,
            lng: item.lng,
            sub: item.city ? `${item.city} Hub` : item.is_airport ? "Airport Hub" : "Orange Service Area",
          });
        }
      });

      // 2. Query Google Places Autocomplete (Restricted to entire country: India)
      if (typeof window !== "undefined" && window.google?.maps?.places?.AutocompleteService) {
        try {
          const autoService = new window.google.maps.places.AutocompleteService();
          const googleMatches: any[] = await new Promise((resolve) => {
            autoService.getPlacePredictions(
              {
                input: query,
                componentRestrictions: { country: "in" },
              },
              (predictions: any, status: any) => {
                if (status === window.google.maps.places.PlacesServiceStatus.OK && predictions) {
                  resolve(
                    predictions.slice(0, 5).map((p: any) => ({
                      name: p.description,
                      lat: 0,
                      lng: 0,
                      placeId: p.place_id,
                      sub: "Google Verified Location · India",
                    }))
                  );
                } else {
                  resolve([]);
                }
              }
            );
          });

          if (googleMatches.length > 0) {
            setSearchResults([...localMatches, ...googleMatches]);
            setIsSearching(false);
            return;
          }
        } catch (err) {
          // fallback to OSM Nominatim
        }
      }

      // 3. Pan-India Nominatim geocoder (Bengaluru, Delhi, Mumbai, Hyderabad, Kolkata, Chennai, etc.)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&addressdetails=1&limit=6`,
          { headers: { "Accept-Language": "en" } }
        );
        if (res.ok) {
          const apiData = await res.json();
          apiData.forEach((item: any) => {
            const shortName = item.display_name.split(",").slice(0, 3).join(", ");
            const addr = item.address || {};
            const city = addr.city || addr.town || addr.municipality || addr.state_district || "";
            const state = addr.state || "India";
            const subLabel = [city, state].filter(Boolean).join(", ") || "India Location";

            if (!localMatches.some((m) => m.name.toLowerCase() === shortName.toLowerCase())) {
              localMatches.push({
                name: shortName,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                sub: subLabel,
              });
            }
          });
        }
      } catch (err) {
        // Fall back to local matches
      }

      setSearchResults(localMatches);
      setIsSearching(false);
    }, 280);
  }

  // Select a location and resolve precise GPS coordinates anywhere in India
  function selectTargetLocation(loc: { name: string; lat: number; lng: number; placeId?: string }) {
    // If location is from Google Places and has a placeId with 0 coordinates:
    if (loc.placeId && (!loc.lat || !loc.lng)) {
      setIsResolvingAddress(true);

      // Attempt A: PlacesService getDetails (works with Places API, doesn't need Geocoding API)
      if (typeof window !== "undefined" && window.google?.maps?.places?.PlacesService) {
        try {
          const dummyNode = document.createElement("div");
          const placesService = new window.google.maps.places.PlacesService(dummyNode);
          placesService.getDetails(
            { placeId: loc.placeId, fields: ["geometry", "formatted_address", "name"] },
            (place: any, status: any) => {
              if (status === window.google.maps.places.PlacesServiceStatus.OK && place?.geometry?.location) {
                const gLat = place.geometry.location.lat();
                const gLng = place.geometry.location.lng();
                const resolved = { name: place.formatted_address || loc.name, lat: gLat, lng: gLng };
                setSelectedLocation(resolved);
                setSearchValue(resolved.name);
                setSearchResults([]);
                setIsResolvingAddress(false);
                if (mode === "map" && mapInstanceRef.current) {
                  mapInstanceRef.current.flyTo([gLat, gLng], 16, { duration: 1 });
                }
                if (onConfirm) onConfirm(resolved);
                return;
              }
              fallbackResolvePlace(loc);
            }
          );
          return;
        } catch (e) {
          fallbackResolvePlace(loc);
          return;
        }
      }

      fallbackResolvePlace(loc);
      return;
    }

    setSelectedLocation(loc);
    setSearchValue(loc.name);
    setSearchResults([]);

    if (mode === "map" && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([loc.lat, loc.lng], 16, { duration: 1 });
    }
    if (onConfirm) onConfirm(loc);
  }

  // Robust coordinate resolution fallback via Nominatim search
  async function fallbackResolvePlace(loc: { name: string; lat: number; lng: number }) {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(loc.name)}&countrycodes=in&limit=1`,
        { headers: { "Accept-Language": "en" } }
      );
      if (res.ok) {
        const data = await res.json();
        if (data && data[0]) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          const resolved = { name: loc.name, lat, lng };
          setSelectedLocation(resolved);
          setSearchValue(loc.name);
          setSearchResults([]);
          setIsResolvingAddress(false);
          if (mode === "map" && mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1 });
          }
          if (onConfirm) onConfirm(resolved);
          return;
        }
      }
    } catch (e) {}

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

        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([lat, lng], 16, { duration: 1.2 });
        }
        handleMapMoveEnd(lat, lng);
        setLoadingGPS(false);
      },
      (err) => {
        console.warn("GPS location error:", err);
        setLoadingGPS(false);
        if (mapInstanceRef.current) {
          mapInstanceRef.current.flyTo([28.6139, 77.2090], 14);
        }
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  return (
    <div className="flex flex-col gap-4 text-background">
      {/* Header with Mode Switcher */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{label}</p>
          <p className="text-xs text-background/60 mt-0.5">
            {mode === "map" ? "Drag anywhere in India or search your city" : "Select from popular hubs across India"}
          </p>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center rounded-lg border border-background/20 bg-background/10 p-0.5 text-xs">
          <button
            type="button"
            onClick={() => setMode("map")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
              mode === "map" ? "bg-primary text-primary-foreground shadow-xs" : "text-background/60 hover:text-background"
            }`}
          >
            <MapIcon className="size-3.5" /> Map
          </button>
          <button
            type="button"
            onClick={() => setMode("list")}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors ${
              mode === "list" ? "bg-primary text-primary-foreground shadow-xs" : "text-background/60 hover:text-background"
            }`}
          >
            <List className="size-3.5" /> Quick Hubs
          </button>
        </div>
      </div>

      {/* Search Input Bar + Locate Button */}
      <div className="relative z-20 flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="w-full rounded-xl border border-background/20 bg-background text-foreground py-3 pl-10 pr-10 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/30 shadow-xs"
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
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
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
          className="shrink-0 rounded-xl border border-background/20 bg-background/10 hover:bg-background/20 text-background px-3"
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
          <div className="absolute left-0 right-0 top-full mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-border bg-background p-1.5 shadow-2xl z-50 text-foreground">
            {searchResults.map((result, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => selectTargetLocation(result)}
                className="flex w-full items-start gap-2.5 rounded-lg px-3 py-2 text-left text-xs transition-colors hover:bg-accent"
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
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-background/60 shrink-0 flex items-center gap-1">
          <Sparkles className="size-3 text-primary" /> Popular:
        </span>
        {PAN_INDIA_PRESETS.slice(0, 8).map((preset, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => selectTargetLocation(preset)}
            className="shrink-0 rounded-full border border-background/20 bg-background/10 px-2.5 py-1 text-[11px] font-medium text-background/90 transition-colors hover:border-primary hover:bg-primary/20 active:scale-95"
          >
            {preset.tag}
          </button>
        ))}
      </div>

      {/* MAP VIEW */}
      {mode === "map" && (
        <div className="relative h-72 w-full overflow-hidden rounded-2xl border border-background/20 bg-neutral-900 shadow-inner">
          <div ref={mapContainerRef} className="size-full z-0" />

          {/* Center Target Pin (Fixed overlay in center of map) */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center z-10">
            <div className="flex flex-col items-center -translate-y-5 transition-transform duration-150">
              {/* Animated Orange Pin */}
              <div className="flex size-11 items-center justify-center rounded-full bg-primary text-white shadow-2xl ring-4 ring-primary/30 animate-gentle-pulse">
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
            className="absolute bottom-3 right-3 z-10 flex size-10 items-center justify-center rounded-full border border-border bg-background text-foreground shadow-lg transition-all hover:bg-accent hover:border-primary active:scale-95"
          >
            {loadingGPS ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <Crosshair className="size-4 text-primary" />
            )}
          </button>

          {/* Map Loading State */}
          {!mapLoaded && !loadError && (
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 bg-night/90 backdrop-blur-xs">
              <Loader2 className="size-6 animate-spin text-primary" />
              <p className="text-xs font-medium text-background/70">Loading High-Definition Indian Map...</p>
            </div>
          )}

          {/* Map Status Hint */}
          <div className="absolute bottom-2.5 left-3 z-10">
            <span className="rounded-full bg-night/80 border border-background/20 px-2.5 py-0.5 text-[10px] font-medium text-background/80 backdrop-blur-xs shadow-xs">
              {isResolvingAddress ? "📍 Resolving address..." : "Pan or drag pin anywhere across India"}
            </span>
          </div>
        </div>
      )}

      {/* QUICK LIST VIEW (Categorized by City) */}
      {mode === "list" && (
        <div className="rounded-2xl border border-background/20 bg-background/5 p-4 space-y-3 shadow-xs">
          {/* City Category Filter Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-background/10">
            {["All", "Bengaluru", "Delhi NCR", "Mumbai", "Hyderabad", "Other Metros"].map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setActiveCityTab(c)}
                className={`shrink-0 rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors ${
                  activeCityTab === c
                    ? "bg-primary text-primary-foreground"
                    : "text-background/60 hover:text-background hover:bg-background/10"
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
                      : "border-background/15 bg-background/5 hover:border-primary/50 hover:bg-background/10 text-background"
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <MapPin className={`size-4 shrink-0 ${isSelected ? "text-primary" : "text-primary/70"}`} />
                    <div className="min-w-0">
                      <p className="text-xs truncate font-medium">{item.name}</p>
                      <p className="text-[10px] text-background/50">{item.city} · Pan-India Hub</p>
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
        <div className="flex items-center gap-2.5 rounded-xl border border-primary/40 bg-primary/15 px-4 py-3 text-xs">
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary text-white">
            <Check className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase font-bold tracking-wider text-primary">Selected {label}</p>
            <p className="font-semibold text-background truncate">{selectedLocation.name}</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 pt-1">
        {onBack && (
          <Button type="button" variant="ghost" className="flex-1 text-background/70 hover:text-background" onClick={onBack}>
            Back
          </Button>
        )}
        <Button
          type="button"
          className="flex-1"
          disabled={!selectedLocation}
          onClick={() => selectedLocation && onConfirm(selectedLocation)}
        >
          Confirm {label} →
        </Button>
      </div>
    </div>
  );
}
