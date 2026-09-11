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

// Popular quick-select presets for Delhi NCR & Airport
const QUICK_PRESETS = [
  { name: "IGI Airport Terminal 3 (Bay 2)", lat: 28.5562, lng: 77.0856, tag: "✈️ Airport T3" },
  { name: "IGI Airport Terminal 1 (Bay 1)", lat: 28.5684, lng: 77.1121, tag: "✈️ Airport T1" },
  { name: "DLF Cyber City, Gurugram", lat: 28.4986, lng: 77.0878, tag: "🏢 Cyber City" },
  { name: "Connaught Place, Inner Circle", lat: 28.6315, lng: 77.2167, tag: "📍 Connaught Place" },
  { name: "Aerocity Worldmark, Delhi", lat: 28.5501, lng: 77.1199, tag: "🏨 Aerocity" },
  { name: "Noida Sector 18 / Mall of India", lat: 28.5708, lng: 77.3271, tag: "🏬 Noida Sec 18" },
];

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
          zoom: 14,
          zoomControl: false,
          attributionControl: false,
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

        // Handle drag end -> reverse geocode center pin
        map.on("moveend", () => {
          const center = map.getCenter();
          handleMapMoveEnd(center.lat, center.lng);
        });

        // Invalidate size after container rendering animation
        setTimeout(() => {
          if (mapInstanceRef.current) {
            mapInstanceRef.current.invalidateSize();
          }
        }, 200);

        // If no initial location, set initial address for default center
        if (!selectedLocation) {
          handleMapMoveEnd(defaultCenter.lat, defaultCenter.lng);
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

      // 2. Fallback to OpenStreetMap Nominatim
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        if (res.ok) {
          const data = await res.json();
          let formatted = "";
          if (data.display_name) {
            const parts = data.display_name.split(",").map((s: string) => s.trim());
            formatted = parts.slice(0, 3).join(", ");
          } else if (data.name) {
            formatted = data.name;
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

      // 3. Fallback: match nearest service area
      const nearest = findNearestArea(lat, lng);
      const fallbackName = nearest ? `Near ${nearest.name}` : `Pin Location (${lat.toFixed(4)}, ${lng.toFixed(4)})`;
      setSelectedLocation({ name: fallbackName, lat, lng });
      setSearchValue(fallbackName);
      setIsResolvingAddress(false);
    }, 450);
  }

  // Find closest pre-defined area by distance
  function findNearestArea(lat: number, lng: number) {
    const list = [...areas, ...QUICK_PRESETS];
    if (!list.length) return null;
    let closest = list[0];
    let minDist = Infinity;
    list.forEach((item) => {
      const d = Math.hypot(item.lat - lat, item.lng - lng);
      if (d < minDist) {
        minDist = d;
        closest = item;
      }
    });
    return closest;
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
      // 1. Check local preset areas & areas table first (Instant!)
      const localMatches: Array<{ name: string; lat: number; lng: number; sub?: string; placeId?: string }> = [];

      [...areas, ...QUICK_PRESETS].forEach((item) => {
        if (item.name.toLowerCase().includes(qLower) && !localMatches.some((m) => m.name === item.name)) {
          localMatches.push({
            name: item.name,
            lat: item.lat,
            lng: item.lng,
            sub: item.is_airport ? "Airport Hub" : "Orange Service Area",
          });
        }
      });

      // 2. Query Google Places Autocomplete if available
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
                    predictions.slice(0, 4).map((p: any) => ({
                      name: p.description,
                      lat: 0,
                      lng: 0,
                      placeId: p.place_id,
                      sub: "Google Verified Landmark",
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

      // 3. Fallback: Query Nominatim for live street/landmark matching in India
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=in&limit=4`,
          { headers: { "Accept-Language": "en" } }
        );
        if (res.ok) {
          const apiData = await res.json();
          apiData.forEach((item: any) => {
            const shortName = item.display_name.split(",").slice(0, 3).join(", ");
            if (!localMatches.some((m) => m.name.toLowerCase() === shortName.toLowerCase())) {
              localMatches.push({
                name: shortName,
                lat: parseFloat(item.lat),
                lng: parseFloat(item.lon),
                sub: "Delhi NCR Address",
              });
            }
          });
        }
      } catch (err) {
        // Fall back to local matches
      }

      setSearchResults(localMatches);
      setIsSearching(false);
    }, 300);
  }

  // Select a location from search or quick preset
  function selectTargetLocation(loc: { name: string; lat: number; lng: number; placeId?: string }) {
    // If location has placeId from Google Places and needs coordinates resolved:
    if (loc.placeId && (!loc.lat || !loc.lng) && typeof window !== "undefined" && window.google?.maps?.Geocoder) {
      setIsResolvingAddress(true);
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ placeId: loc.placeId }, (results: any, status: any) => {
        setIsResolvingAddress(false);
        if (status === "OK" && results?.[0]?.geometry?.location) {
          const gLat = results[0].geometry.location.lat();
          const gLng = results[0].geometry.location.lng();
          const resolved = { name: loc.name, lat: gLat, lng: gLng };
          setSelectedLocation(resolved);
          setSearchValue(loc.name);
          setSearchResults([]);
          if (mode === "map" && mapInstanceRef.current) {
            mapInstanceRef.current.flyTo([gLat, gLng], 16, { duration: 1 });
          }
          return;
        }
        // If geocode fails, just save name
        setSelectedLocation(loc as any);
        setSearchValue(loc.name);
        setSearchResults([]);
      });
      return;
    }

    setSelectedLocation(loc);
    setSearchValue(loc.name);
    setSearchResults([]);

    if (mode === "map" && mapInstanceRef.current) {
      mapInstanceRef.current.flyTo([loc.lat, loc.lng], 16, { duration: 1 });
    }
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
            {mode === "map" ? "Drag map to position pin or search" : "Select from approved service zones"}
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
            <List className="size-3.5" /> Quick List
          </button>
        </div>
      </div>

      {/* Search Input Bar */}
      <div className="relative z-20">
        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            className="w-full rounded-xl border border-background/20 bg-background text-foreground py-3 pl-10 pr-10 text-sm outline-none transition-all focus:border-primary focus:ring-2 focus:ring-primary/30"
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

        {/* Autocomplete Dropdown */}
        {searchResults.length > 0 && (
          <div className="absolute left-0 right-0 top-full mt-1.5 max-h-56 overflow-y-auto rounded-xl border border-border bg-background p-1.5 shadow-xl z-50 text-foreground">
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

      {/* Quick Location Chips */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-background/60 shrink-0 flex items-center gap-1">
          <Sparkles className="size-3 text-primary" /> Popular:
        </span>
        {QUICK_PRESETS.map((preset, idx) => (
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
              <p className="text-xs font-medium text-background/70">Loading Orange High-Def Map...</p>
            </div>
          )}

          {/* Map Status Hint */}
          <div className="absolute bottom-2.5 left-3 z-10">
            <span className="rounded-full bg-night/80 border border-background/20 px-2.5 py-0.5 text-[10px] font-medium text-background/80 backdrop-blur-xs shadow-xs">
              {isResolvingAddress ? "📍 Locating..." : "Drag map to adjust location"}
            </span>
          </div>
        </div>
      )}

      {/* QUICK LIST VIEW (Dropdown Fallback) */}
      {mode === "list" && (
        <div className="rounded-2xl border border-background/20 bg-background/5 p-4 space-y-3 shadow-xs">
          <p className="text-xs font-semibold text-background/60 uppercase tracking-wider">
            Select Service Area or Airport Bay
          </p>
          <div className="grid gap-2 max-h-64 overflow-y-auto pr-1">
            {[...QUICK_PRESETS, ...areas].map((item: any, i) => {
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
                    <span className="text-xs truncate">{item.name}</span>
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
