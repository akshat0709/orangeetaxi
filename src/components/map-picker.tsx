// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { MapPin, Navigation, Search, Loader2, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MapPickerProps {
  label: string;
  placeholder: string;
  onConfirm: (location: { name: string; lat: number; lng: number }) => void;
  onBack?: () => void;
  apiKey?: string;
}

/**
 * GPS Map Picker Component — Ola/Uber style drag-to-pin location selector.
 * Works in two modes:
 * 1. With Google Maps API key: Full interactive map with autocomplete
 * 2. Without API key: Clean UI placeholder ready to activate
 */
export function MapPicker({ label, placeholder, onConfirm, onBack, apiKey }: MapPickerProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const autocompleteRef = useRef<any>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedLocation, setSelectedLocation] = useState<{ name: string; lat: number; lng: number } | null>(null);
  const [loadingGPS, setLoadingGPS] = useState(false);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [searchValue, setSearchValue] = useState("");

  const hasApiKey = !!apiKey && apiKey.length > 10;

  // Load Google Maps script
  useEffect(() => {
    if (!hasApiKey) return;
    if (window.google?.maps) { initMap(); return; }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
    script.async = true;
    script.onload = () => initMap();
    document.head.appendChild(script);
  }, [apiKey]);

  function initMap() {
    if (!mapRef.current || !window.google?.maps) return;

    const defaultCenter = { lat: 28.6139, lng: 77.2090 }; // New Delhi

    mapInstance.current = new window.google.maps.Map(mapRef.current, {
      center: defaultCenter,
      zoom: 14,
      disableDefaultUI: true,
      gestureHandling: "greedy",
      styles: [
        { featureType: "poi", stylers: [{ visibility: "off" }] },
        { featureType: "transit", stylers: [{ visibility: "off" }] },
        { elementType: "geometry", stylers: [{ color: "#f5f0e8" }] },
        { featureType: "road", elementType: "geometry", stylers: [{ color: "#ffffff" }] },
        { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#ffd580" }] },
        { featureType: "water", elementType: "geometry", stylers: [{ color: "#c8e6f5" }] },
      ],
    });

    setMapLoaded(true);

    // Center marker (stays fixed, map moves under it)
    // We use the map's center as the selected location on drag end
    mapInstance.current.addListener("dragend", async () => {
      const center = mapInstance.current.getCenter();
      const lat = center.lat();
      const lng = center.lng();

      // Reverse geocode
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
        if (status === "OK" && results[0]) {
          const name = results[0].formatted_address;
          setSelectedLocation({ name, lat, lng });
          setSearchValue(name);
        }
      });
    });

    // Autocomplete
    if (inputRef.current) {
      autocompleteRef.current = new window.google.maps.places.Autocomplete(inputRef.current, {
        componentRestrictions: { country: "in" },
        fields: ["formatted_address", "geometry", "name"],
      });
      autocompleteRef.current.addListener("place_changed", () => {
        const place = autocompleteRef.current.getPlace();
        if (place.geometry) {
          const lat = place.geometry.location.lat();
          const lng = place.geometry.location.lng();
          const name = place.name || place.formatted_address;
          mapInstance.current.panTo({ lat, lng });
          mapInstance.current.setZoom(16);
          setSelectedLocation({ name, lat, lng });
          setSearchValue(name);
        }
      });
    }

    // Get user's current location
    detectLocation(true);
  }

  function detectLocation(silent = false) {
    if (!silent) setLoadingGPS(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (mapInstance.current) {
          mapInstance.current.panTo({ lat, lng });
          mapInstance.current.setZoom(16);
        }
        if (hasApiKey && window.google?.maps) {
          const geocoder = new window.google.maps.Geocoder();
          geocoder.geocode({ location: { lat, lng } }, (results: any, status: any) => {
            if (status === "OK" && results[0]) {
              const name = results[0].formatted_address;
              setSelectedLocation({ name, lat, lng });
              setSearchValue(name);
            }
            setLoadingGPS(false);
          });
        } else {
          setSelectedLocation({ name: "Your current location", lat, lng });
          setLoadingGPS(false);
        }
      },
      () => setLoadingGPS(false),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }

  // Without API key — clean placeholder UI
  if (!hasApiKey) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{label}</p>

        {/* Map Placeholder */}
        <div className="relative h-64 overflow-hidden rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50 border border-border flex flex-col items-center justify-center gap-3">
          {/* Fake map grid lines */}
          <div className="absolute inset-0 opacity-20" style={{
            backgroundImage: "linear-gradient(#e0d4b8 1px, transparent 1px), linear-gradient(90deg, #e0d4b8 1px, transparent 1px)",
            backgroundSize: "40px 40px"
          }} />
          {/* Fake roads */}
          <div className="absolute left-0 right-0 top-1/2 h-3 bg-white/60 -translate-y-1/2 rounded" />
          <div className="absolute top-0 bottom-0 left-1/2 w-3 bg-white/60 -translate-x-1/2 rounded" />
          {/* Center pin */}
          <div className="relative z-10 flex flex-col items-center gap-2">
            <div className="size-12 rounded-full bg-primary shadow-lg flex items-center justify-center animate-bounce">
              <MapPin className="size-6 text-white" />
            </div>
            <div className="rounded-full bg-black/20 h-2 w-8 blur-sm" />
          </div>
          {/* Label */}
          <div className="absolute bottom-3 left-0 right-0 flex justify-center">
            <span className="rounded-full bg-black/60 px-3 py-1 text-xs text-white backdrop-blur">
              🗺️ Map activates when Google Maps key is added
            </span>
          </div>
        </div>

        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            placeholder={placeholder}
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
          />
        </div>

        <Button
          onClick={() => detectLocation()}
          variant="outline"
          className="flex items-center gap-2 text-sm"
          disabled={loadingGPS}
        >
          {loadingGPS ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4 text-primary" />}
          Use my current location
        </Button>

        <div className="flex gap-3 pt-2">
          {onBack && (
            <Button variant="ghost" className="flex-1" onClick={onBack}>Back</Button>
          )}
          <Button
            className="flex-1"
            disabled={!searchValue.trim()}
            onClick={() => {
              if (searchValue.trim()) {
                onConfirm({ name: searchValue.trim(), lat: 28.6139, lng: 77.2090 });
              }
            }}
          >
            Confirm {label} →
          </Button>
        </div>
      </div>
    );
  }

  // With API key — full map experience
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{label}</p>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          ref={inputRef}
          className="w-full rounded-xl border border-border bg-background py-3 pl-10 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          placeholder={placeholder}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
        />
      </div>

      {/* Map container */}
      <div className="relative h-72 overflow-hidden rounded-2xl border border-border shadow-soft">
        <div ref={mapRef} className="h-full w-full" />

        {/* Fixed center pin overlay */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="size-12 rounded-full bg-primary shadow-lg flex items-center justify-center -translate-y-6">
            <MapPin className="size-6 text-white" />
          </div>
          <div className="rounded-full bg-black/20 h-2 w-8 blur-sm -translate-y-4" />
        </div>

        {/* GPS button */}
        <button
          onClick={() => detectLocation()}
          className="absolute bottom-3 right-3 size-10 rounded-full bg-white shadow-md flex items-center justify-center hover:bg-gray-50 transition-colors"
        >
          {loadingGPS
            ? <Loader2 className="size-4 animate-spin text-primary" />
            : <Crosshair className="size-4 text-primary" />
          }
        </button>

        {/* Loading overlay */}
        {!mapLoaded && (
          <div className="absolute inset-0 flex items-center justify-center bg-warm">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        )}
      </div>

      {selectedLocation && (
        <div className="flex items-center gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
          <MapPin className="size-4 shrink-0 text-primary" />
          <span className="truncate font-medium">{selectedLocation.name}</span>
        </div>
      )}

      <p className="text-center text-xs text-muted-foreground">Drag the map to adjust your pin location</p>

      <div className="flex gap-3">
        {onBack && (
          <Button variant="ghost" className="flex-1" onClick={onBack}>Back</Button>
        )}
        <Button
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
