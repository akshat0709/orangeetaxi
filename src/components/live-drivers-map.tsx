/// <reference types="google.maps" />
import { StorageImage } from "@/components/storage-image";
import { useState, useEffect, useMemo } from "react";
import { APIProvider, Map as GoogleMap, Marker, useMap } from "@vis.gl/react-google-maps";
import {
  Car,
  MapPin,
  Phone,
  MessageSquare,
  Search,
  Zap,
  BatteryCharging,
  Navigation,
  RefreshCw,
  ShieldCheck,
  Radio,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  detectCityFromCoords,
  getCityDefaultCenter,
  SUPPORTED_CITY_HUBS,
} from "@/lib/city-detector";

function createDriverMarkerIcon(
  status: "available" | "on_trip" | "offline",
  isSelected: boolean,
): google.maps.Icon {
  const color = status === "available" ? "#10B981" : status === "on_trip" ? "#F97316" : "#64748B";
  const size = isSelected ? 42 : 34;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 36 36">
    <circle cx="18" cy="18" r="16" fill="${color}" stroke="#FFFFFF" stroke-width="2.5"/>
    <path d="M10 21v1.5a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5V21h8v1.5a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5V21c.83 0 1.5-.67 1.5-1.5v-5c0-.9-.5-1.7-1.3-2.1l-1.8-3.5A2.2 2.2 0 0 0 20.4 9h-4.8a2.2 2.2 0 0 0-1.9 1.4l-1.8 3.5c-.8.4-1.3 1.2-1.3 2.1v5c0 .83.67 1.5 1.5 1.5h-.1zm2.8-10.5a.7.7 0 0 1 .6-.4h5.2a.7.7 0 0 1 .6.4l1.3 2.5H11.5l1.3-2.5zM12.5 18a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="#FFFFFF"/>
    ${isSelected ? '<circle cx="18" cy="18" r="17" fill="none" stroke="#F97316" stroke-width="2"/>' : ""}
  </svg>`;

  const icon: google.maps.Icon = {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
  };
  if (typeof window !== "undefined" && window.google?.maps?.Size) {
    icon.scaledSize = new window.google.maps.Size(size, size);
  }
  if (typeof window !== "undefined" && window.google?.maps?.Point) {
    icon.anchor = new window.google.maps.Point(size / 2, size / 2);
  }
  return icon;
}

interface Driver {
  id: string;
  full_name: string;
  phone: string;
  city: string;
  is_online: boolean;
  rating: number;
  total_rides: number;
  status: string;
  vehicle_model: string;
  vehicle_number: string;
  vehicle_code?: string;
  driver_type?: string;
  photo_url?: string;
  current_lat?: number | null;
  current_lng?: number | null;
  location_updated_at?: string | null;
}

interface Booking {
  id: string;
  reference: string;
  status: string;
  pickup_area: string;
  drop_area: string;
  estimated_fare: number;
  vehicle_name: string;
  payment_method: string;
  created_at: string;
  driver_id: string | null;
  customer_id: string;
  ride_otp: string;
}

interface LiveDriversMapProps {
  drivers: Driver[];
  bookings: Booking[];
  apiKey: string;
  onRefresh?: () => void;
}

// Controller to smoothly pan to selected driver or target location
function MapPanController({
  targetLocation,
  zoom = 15,
}: {
  targetLocation: { lat: number; lng: number } | null;
  zoom?: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (!map || !targetLocation) return;
    map.panTo(targetLocation);
    map.setZoom(zoom);
  }, [map, targetLocation, zoom]);
  return null;
}

export function LiveDriversMap({ drivers, bookings, apiKey, onRefresh }: LiveDriversMapProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<"all" | "available" | "on_trip" | "offline">(
    "all",
  );
  const [selectedCityHub, setSelectedCityHub] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [mapTarget, setMapTarget] = useState<{ lat: number; lng: number; zoom?: number } | null>(
    null,
  );
  const [geocodedArea, setGeocodedArea] = useState<string | null>(null);

  // Active bookings map for fast O(1) lookup
  const activeBookingsByDriver = useMemo(() => {
    const bookingMap: Record<string, Booking> = {};
    bookings.forEach((b) => {
      if (b.driver_id && ["accepted", "arrived", "in_progress"].includes(b.status)) {
        bookingMap[b.driver_id] = b;
      }
    });
    return bookingMap;
  }, [bookings]);

  // Compute status, auto-detected city, and coordinates for each driver
  const enrichedDrivers = useMemo(() => {
    return drivers.map((d, index) => {
      const activeRide = activeBookingsByDriver[d.id];
      let derivedStatus: "available" | "on_trip" | "offline" = "offline";

      if (d.is_online) {
        derivedStatus = activeRide ? "on_trip" : "available";
      }

      const hasRealGps =
        d.current_lat != null &&
        d.current_lng != null &&
        !isNaN(Number(d.current_lat)) &&
        !isNaN(Number(d.current_lng)) &&
        (Number(d.current_lat) !== 0 || Number(d.current_lng) !== 0);

      // Default city center if driver coordinates are not yet acquired
      const defaultCenter = getCityDefaultCenter(d.city);
      const baseLat = defaultCenter.lat;
      const baseLng = defaultCenter.lng;

      // Deterministic spread around center only if driver has no live GPS
      const offsetLat = ((index % 7) - 3) * 0.021 + ((index * 13) % 11) * 0.003;
      const offsetLng = (((index * 3) % 7) - 3) * 0.025 + ((index * 7) % 13) * 0.004;

      const lat = hasRealGps ? Number(d.current_lat) : baseLat + offsetLat;
      const lng = hasRealGps ? Number(d.current_lng) : baseLng + offsetLng;

      // Auto-detect the city directly from coordinates
      const detectedCity = detectCityFromCoords(lat, lng, d.city);

      // Simulated battery & speed for Mahindra BE.6
      const batteryPercent = 70 + ((index * 17) % 28); // 70% - 98%
      const speedKmH = derivedStatus === "on_trip" ? 32 + ((index * 9) % 26) : 0;

      return {
        ...d,
        activeRide,
        derivedStatus,
        hasRealGps,
        lat,
        lng,
        detectedCity,
        batteryPercent,
        speedKmH,
      };
    });
  }, [drivers, activeBookingsByDriver]);

  // Filtered drivers based on status pill, city hub, and search text
  const filteredDrivers = useMemo(() => {
    return enrichedDrivers.filter((d) => {
      if (filterStatus !== "all" && d.derivedStatus !== filterStatus) {
        return false;
      }
      if (selectedCityHub !== "all" && d.detectedCity !== selectedCityHub) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (d.full_name || "").toLowerCase().includes(q);
        const matchesPhone = (d.phone || "").toLowerCase().includes(q);
        const matchesPlate = (d.vehicle_number || "").toLowerCase().includes(q);
        const matchesModel = (d.vehicle_model || "").toLowerCase().includes(q);
        const matchesCity = (d.detectedCity || "").toLowerCase().includes(q);
        return matchesName || matchesPhone || matchesPlate || matchesModel || matchesCity;
      }
      return true;
    });
  }, [enrichedDrivers, filterStatus, selectedCityHub, searchQuery]);

  const selectedDriver = useMemo(() => {
    return enrichedDrivers.find((d) => d.id === selectedDriverId) || null;
  }, [enrichedDrivers, selectedDriverId]);

  // Auto-detect & reverse geocode the selected driver's location
  useEffect(() => {
    if (!selectedDriver) {
      setGeocodedArea(null);
      return;
    }

    const { lat, lng, detectedCity } = selectedDriver;
    setGeocodedArea(detectedCity);

    // High-resolution reverse geocoding via Google Maps
    if (typeof window !== "undefined" && window.google?.maps?.Geocoder) {
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        if (status === "OK" && results && results[0]) {
          const comps = results[0].address_components;
          const locality = comps.find((c) => c.types.includes("locality"))?.long_name;
          const sublocality = comps.find(
            (c) => c.types.includes("sublocality") || c.types.includes("sublocality_level_1"),
          )?.long_name;
          const adminArea = comps.find((c) =>
            c.types.includes("administrative_area_level_2"),
          )?.long_name;

          const cityName = locality || adminArea || detectedCity.replace(" Hub", "");
          const formatted = sublocality ? `${sublocality}, ${cityName}` : `${cityName} Hub`;
          setGeocodedArea(formatted);

          // Update driver's city in Supabase if it differs from live detected city
          if (selectedDriver.id && cityName && selectedDriver.city !== cityName) {
            supabase
              .from("drivers")
              .update({ city: cityName })
              .eq("id", selectedDriver.id)
              .then(() => {});
          }
        }
      });
    } else if (selectedDriver.id && selectedDriver.hasRealGps) {
      const cleanCity = detectedCity.replace(" Hub", "");
      if (selectedDriver.city !== cleanCity) {
        supabase
          .from("drivers")
          .update({ city: cleanCity })
          .eq("id", selectedDriver.id)
          .then(() => {});
      }
    }
  }, [selectedDriver?.id, selectedDriver?.lat, selectedDriver?.lng]);

  function handleSelectCityFilter(cityId: string) {
    setSelectedCityHub(cityId);
    setSelectedDriverId(null);
    if (cityId !== "all") {
      const hub = SUPPORTED_CITY_HUBS.find((h) => h.name === cityId || h.id === cityId);
      if (hub) {
        setMapTarget({ lat: hub.lat, lng: hub.lng, zoom: 12 });
      } else {
        const center = getCityDefaultCenter(cityId);
        setMapTarget({ lat: center.lat, lng: center.lng, zoom: 12 });
      }
    } else {
      setMapTarget(null);
    }
  }

  // Overall fleet status counts
  const counts = useMemo(() => {
    let available = 0;
    let onTrip = 0;
    let offline = 0;
    enrichedDrivers.forEach((d) => {
      if (d.derivedStatus === "available") available++;
      else if (d.derivedStatus === "on_trip") onTrip++;
      else offline++;
    });
    return {
      total: enrichedDrivers.length,
      available,
      onTrip,
      offline,
    };
  }, [enrichedDrivers]);

  const handleRefresh = async () => {
    if (onRefresh) {
      setIsRefreshing(true);
      await onRefresh();
      setTimeout(() => setIsRefreshing(false), 600);
      toast.success("Driver radar coordinates synced");
    }
  };

  const defaultCenter = useMemo(() => {
    if (selectedDriver) return { lat: selectedDriver.lat, lng: selectedDriver.lng };
    if (enrichedDrivers[0]) return { lat: enrichedDrivers[0].lat, lng: enrichedDrivers[0].lng };
    return { lat: 12.9716, lng: 77.5946 };
  }, [selectedDriver, enrichedDrivers]);

  return (
    <div className="flex flex-col gap-4">
      {/* Top Header Card */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 rounded-xl border border-border bg-card p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10 text-primary border border-primary/20">
            <Radio className="size-5 animate-pulse text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold text-foreground">Live Chauffeur Radar</h2>
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                <span className="size-1.5 rounded-full bg-emerald-500 animate-ping" />
                Live Telematics
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Active GPS tracking of all Mahindra BE.6 vehicles across the metropolitan area
            </p>
          </div>
        </div>

        {/* Status Filter Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant={filterStatus === "all" ? "default" : "outline"}
            onClick={() => setFilterStatus("all")}
            className="text-xs h-8"
          >
            All Drivers ({counts.total})
          </Button>
          <Button
            size="sm"
            variant={filterStatus === "available" ? "default" : "outline"}
            onClick={() => setFilterStatus("available")}
            className="text-xs h-8 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10"
          >
            Available ({counts.available})
          </Button>
          <Button
            size="sm"
            variant={filterStatus === "on_trip" ? "default" : "outline"}
            onClick={() => setFilterStatus("on_trip")}
            className="text-xs h-8 text-orange-600 dark:text-orange-400 border-orange-500/30 hover:bg-orange-500/10"
          >
            On Active Trip ({counts.onTrip})
          </Button>
          <Button
            size="sm"
            variant={filterStatus === "offline" ? "default" : "outline"}
            onClick={() => setFilterStatus("offline")}
            className="text-xs h-8 text-muted-foreground hover:bg-muted/50"
          >
            Offline ({counts.offline})
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
            title="Refresh radar"
          >
            <RefreshCw className={`size-3.5 ${isRefreshing ? "animate-spin text-primary" : ""}`} />
          </Button>
        </div>
      </div>

      {/* City Hub Quick Filter Bar */}
      <div className="flex flex-wrap items-center gap-1.5 px-3 py-2 rounded-lg border border-border bg-card/60 backdrop-blur-sm text-xs">
        <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1 mr-1">
          <MapPin className="size-3 text-primary" />
          City Hub:
        </span>
        <button
          onClick={() => handleSelectCityFilter("all")}
          className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
            selectedCityHub === "all"
              ? "bg-primary text-primary-foreground shadow-xs"
              : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
          }`}
        >
          All Hubs
        </button>
        {SUPPORTED_CITY_HUBS.slice(0, 6).map((hub) => (
          <button
            key={hub.id}
            onClick={() => handleSelectCityFilter(hub.name)}
            className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${
              selectedCityHub === hub.name
                ? "bg-primary text-primary-foreground shadow-xs"
                : "bg-muted/70 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {hub.shortName}
          </button>
        ))}
        {selectedCityHub !== "all" && (
          <span className="ml-auto text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1">
            <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active Hub Filter: {selectedCityHub}
          </span>
        )}
      </div>

      {/* Main Map + Sidebar Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left / Bottom Chauffeur Directory List */}
        <div className="lg:col-span-4 flex flex-col rounded-xl border border-border bg-card overflow-hidden h-[620px]">
          {/* Search bar */}
          <div className="p-3 border-b border-border bg-muted/20">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Search chauffeur, phone, BE.6 plate..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs h-9 bg-background"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              )}
            </div>
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2 px-1">
              <span>Showing {filteredDrivers.length} chauffeurs</span>
              <span className="font-mono">BE.6 Electric Fleet</span>
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-border">
            {filteredDrivers.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground">
                <Car className="size-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No chauffeurs found</p>
                <p className="text-xs mt-1">Try clearing your filters or search term</p>
              </div>
            ) : (
              filteredDrivers.map((d) => {
                const isSelected = d.id === selectedDriverId;
                const statusColor =
                  d.derivedStatus === "available"
                    ? "bg-emerald-500"
                    : d.derivedStatus === "on_trip"
                      ? "bg-orange-500"
                      : "bg-slate-400";

                const badgeText =
                  d.derivedStatus === "available"
                    ? "Available / Idle"
                    : d.derivedStatus === "on_trip"
                      ? "On Active Ride"
                      : "Offline";

                return (
                  <button
                    key={d.id}
                    onClick={() => setSelectedDriverId(d.id)}
                    className={`w-full text-left p-3.5 transition-all flex items-start gap-3 hover:bg-muted/40 ${
                      isSelected ? "bg-primary/5 border-l-4 border-l-primary" : ""
                    }`}
                  >
                    {/* Driver Avatar */}
                    <div className="relative size-10 shrink-0 rounded-full bg-muted flex items-center justify-center font-bold text-xs border border-border overflow-hidden">
                      {d.photo_url ? (
                        <StorageImage
                          src={d.photo_url}
                          alt={d.full_name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <span>{d.full_name ? d.full_name.charAt(0).toUpperCase() : "D"}</span>
                      )}
                      <span
                        className={`absolute bottom-0 right-0 size-3 rounded-full border-2 border-background ${statusColor}`}
                      />
                    </div>

                    {/* Driver Meta */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h4 className="text-xs font-bold text-foreground truncate">
                          {d.full_name}
                        </h4>
                        <span
                          className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${
                            d.derivedStatus === "available"
                              ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                              : d.derivedStatus === "on_trip"
                                ? "bg-orange-500/10 text-orange-600 dark:text-orange-400"
                                : "bg-slate-500/10 text-slate-500"
                          }`}
                        >
                          {badgeText}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground font-mono">
                        <span className="font-semibold text-foreground">
                          {d.vehicle_number || "BE.6 EV"}
                        </span>
                        <span>·</span>
                        <span>{d.vehicle_model || "Mahindra BE.6"}</span>
                      </div>

                      {/* Active ride banner if on trip */}
                      {d.activeRide && (
                        <div className="mt-2 rounded bg-orange-500/10 border border-orange-500/20 p-1.5 text-[10px] text-orange-700 dark:text-orange-300">
                          <div className="font-semibold truncate">
                            Ride #{d.activeRide.reference} · ₹{d.activeRide.estimated_fare}
                          </div>
                          <div className="truncate text-muted-foreground mt-0.5">
                            {d.activeRide.pickup_area} ➔ {d.activeRide.drop_area}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between mt-2 text-[10px] text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <BatteryCharging className="size-3 text-emerald-600" />
                          {d.batteryPercent}%
                        </span>
                        <span
                          className="flex items-center gap-1 text-foreground/80 font-medium truncate max-w-[130px]"
                          title={d.detectedCity}
                        >
                          <MapPin className="size-2.5 text-primary shrink-0" />
                          <span className="truncate">{d.detectedCity}</span>
                        </span>
                        <span>★ {d.rating ? d.rating.toFixed(2) : "5.00"}</span>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Right Map Canvas & Selected Inspector */}
        <div className="lg:col-span-8 flex flex-col gap-3">
          <div className="relative w-full rounded-xl border border-border overflow-hidden bg-card h-[620px] shadow-sm">
            <APIProvider apiKey={apiKey} libraries={["places", "geometry"]}>
              <GoogleMap
                id="orange-taxi-admin-live-radar"
                defaultCenter={defaultCenter}
                defaultZoom={13}
                gestureHandling="greedy"
                disableDefaultUI={false}
                style={{ width: "100%", height: "100%" }}
              >
                <MapPanController
                  targetLocation={
                    mapTarget ||
                    (selectedDriver ? { lat: selectedDriver.lat, lng: selectedDriver.lng } : null)
                  }
                  zoom={mapTarget?.zoom || (selectedDriver ? 15 : 12)}
                />

                {enrichedDrivers.map((d) => {
                  const isSelected = d.id === selectedDriverId;
                  const isOnline = d.is_online;
                  const isOnTrip = d.derivedStatus === "on_trip";

                  return (
                    <Marker
                      key={d.id}
                      position={{ lat: d.lat, lng: d.lng }}
                      onClick={() => setSelectedDriverId(d.id)}
                      title={`${d.full_name} (${d.vehicle_number || "BE.6"}) - ${
                        isOnTrip ? "On Trip" : isOnline ? "Available" : "Offline"
                      }`}
                      zIndex={isSelected ? 999 : isOnTrip ? 80 : isOnline ? 50 : 10}
                      icon={createDriverMarkerIcon(d.derivedStatus, isSelected)}
                    />
                  );
                })}
              </GoogleMap>
            </APIProvider>

            {/* Floating Live Legend Overlay */}
            <div className="absolute top-4 left-4 z-10 flex flex-col gap-1.5 rounded-lg border border-border bg-card/95 p-3 shadow-md backdrop-blur text-xs">
              <span className="font-bold text-[11px] text-foreground tracking-wide uppercase">
                Fleet Radar Status
              </span>
              <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                <span className="size-2.5 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30" />
                <span>Available / Idle</span>
                <span className="ml-auto font-mono text-[10px]">({counts.available})</span>
              </div>
              <div className="flex items-center gap-2 text-orange-600 dark:text-orange-400 font-semibold">
                <span className="size-2.5 rounded-full bg-orange-500 ring-2 ring-orange-500/30" />
                <span>On Active Trip</span>
                <span className="ml-auto font-mono text-[10px]">({counts.onTrip})</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground font-semibold">
                <span className="size-2.5 rounded-full bg-slate-500 ring-2 ring-slate-500/30" />
                <span>Offline</span>
                <span className="ml-auto font-mono text-[10px]">({counts.offline})</span>
              </div>
            </div>

            {/* Selected Driver Inspector Drawer / Card overlay */}
            {selectedDriver && (
              <div className="absolute bottom-4 left-4 right-4 z-20 rounded-xl border border-border bg-card/98 p-4 shadow-xl backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="relative size-12 rounded-full bg-primary/10 border-2 border-primary/20 flex items-center justify-center font-bold text-base text-primary overflow-hidden shrink-0">
                      {selectedDriver.photo_url ? (
                        <StorageImage
                          src={selectedDriver.photo_url}
                          alt={selectedDriver.full_name}
                          className="size-full object-cover"
                        />
                      ) : (
                        <span>{selectedDriver.full_name?.charAt(0) || "D"}</span>
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-bold text-foreground">
                          {selectedDriver.full_name}
                        </h3>
                        <Badge
                          variant="outline"
                          className={
                            selectedDriver.derivedStatus === "available"
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30 font-bold"
                              : selectedDriver.derivedStatus === "on_trip"
                                ? "bg-orange-500/10 text-orange-600 border-orange-500/30 font-bold"
                                : "bg-slate-500/10 text-slate-500 border-slate-500/30 font-bold"
                          }
                        >
                          {selectedDriver.derivedStatus === "available"
                            ? "Available (Idle)"
                            : selectedDriver.derivedStatus === "on_trip"
                              ? "On Active Trip"
                              : "Offline"}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1 flex-wrap">
                        <span className="font-mono font-semibold text-foreground">
                          {selectedDriver.vehicle_number || "KA 01 BE 6001"}
                        </span>
                        <span>·</span>
                        <span>{selectedDriver.vehicle_model || "Mahindra BE 6 EV"}</span>
                        <span>·</span>
                        <span>
                          ★ {selectedDriver.rating ? selectedDriver.rating.toFixed(2) : "5.00"}
                        </span>
                        <span>·</span>
                        <span>{selectedDriver.total_rides || 0} completed rides</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <a
                      href={`tel:${selectedDriver.phone}`}
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-border bg-muted/40 text-foreground hover:bg-muted"
                      title="Call Chauffeur"
                    >
                      <Phone className="size-4" />
                    </a>
                    <a
                      href={`https://wa.me/${selectedDriver.phone?.replace(/[^0-9]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex size-9 items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20"
                      title="WhatsApp Chauffeur"
                    >
                      <MessageSquare className="size-4" />
                    </a>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setSelectedDriverId(null)}
                      className="size-9 text-muted-foreground hover:text-foreground"
                    >
                      <X className="size-4" />
                    </Button>
                  </div>
                </div>

                {/* Chauffeur Telematics Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 pt-3 border-t border-border text-xs">
                  <div className="rounded-lg bg-muted/30 p-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      EV Battery
                    </span>
                    <div className="flex items-center gap-1 font-bold text-foreground mt-0.5">
                      <BatteryCharging className="size-3.5 text-emerald-600" />
                      <span>{selectedDriver.batteryPercent}% · ~310 km</span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/30 p-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      Current Telematics
                    </span>
                    <div className="flex items-center gap-1 font-bold text-foreground mt-0.5">
                      <Zap className="size-3.5 text-amber-500" />
                      <span>
                        {selectedDriver.speedKmH > 0
                          ? `${selectedDriver.speedKmH} km/h`
                          : "Stationary (0 km/h)"}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/30 p-2">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                        City Hub
                      </span>
                      <span className="text-[9px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded-full border border-emerald-500/20 flex items-center gap-1 shrink-0">
                        <span className="size-1 rounded-full bg-emerald-500 animate-pulse" />
                        Auto-detected
                      </span>
                    </div>
                    <div
                      className="flex items-center gap-1 font-bold text-foreground mt-0.5 truncate"
                      title={geocodedArea || selectedDriver.detectedCity}
                    >
                      <MapPin className="size-3.5 text-primary shrink-0" />
                      <span className="truncate">
                        {geocodedArea || selectedDriver.detectedCity}
                      </span>
                    </div>
                  </div>

                  <div className="rounded-lg bg-muted/30 p-2">
                    <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">
                      Chauffeur Mobile
                    </span>
                    <div className="flex items-center gap-1 font-mono font-bold text-foreground mt-0.5">
                      <ShieldCheck className="size-3.5 text-blue-500" />
                      <span>{selectedDriver.phone || "—"}</span>
                    </div>
                  </div>
                </div>

                {/* If On Active Ride - Show Route Details */}
                {selectedDriver.activeRide && (
                  <div className="mt-3 rounded-lg border border-orange-500/30 bg-orange-500/5 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-orange-700 dark:text-orange-400 uppercase tracking-wide flex items-center gap-1.5">
                        <Navigation className="size-3.5 animate-pulse" />
                        In-Transit Ride #{selectedDriver.activeRide.reference}
                      </span>
                      <span className="text-xs font-bold text-foreground font-mono">
                        OTP: {selectedDriver.activeRide.ride_otp || "—"} · ₹
                        {selectedDriver.activeRide.estimated_fare}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2 text-xs">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-muted-foreground truncate">
                          <strong className="text-foreground">Pickup:</strong>{" "}
                          {selectedDriver.activeRide.pickup_area}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-red-500 shrink-0" />
                        <span className="text-muted-foreground truncate">
                          <strong className="text-foreground">Dropoff:</strong>{" "}
                          {selectedDriver.activeRide.drop_area}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
