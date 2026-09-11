// @ts-nocheck
import { useEffect, useRef, useState } from "react";
import { Car, Crosshair, Loader2, MapPin, Navigation, ShieldCheck, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface LiveMapProps {
  pickup: { name: string; lat: number; lng: number };
  drop: { name: string; lat: number; lng: number };
  driver?: {
    full_name?: string;
    vehicle_number?: string;
    vehicle_model?: string;
    current_lat?: number;
    current_lng?: number;
  } | null;
  status: string; // searching | accepted | arrived | in_progress | completed
  distKm?: number;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
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

export function LiveRideMap({ pickup, drop, driver, status, distKm }: LiveMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<{
    pickup?: any;
    drop?: any;
    driver?: any;
    routeLine?: any;
    driverRouteLine?: any;
  }>({});

  const [mapLoaded, setMapLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Compute effective driver coordinates
  // If driver has not shared GPS yet, calculate an approaching simulated initial location near pickup
  const effectiveDriverLat = driver?.current_lat ?? (pickup?.lat ? pickup.lat - 0.012 : 28.5562);
  const effectiveDriverLng = driver?.current_lng ?? (pickup?.lng ? pickup.lng - 0.009 : 77.0856);

  // Calculate driver distance to target
  const targetLat = status === "in_progress" ? drop?.lat : pickup?.lat;
  const targetLng = status === "in_progress" ? drop?.lng : pickup?.lng;
  const driverDistKm =
    targetLat && targetLng
      ? Math.max(0.1, haversineKm(effectiveDriverLat, effectiveDriverLng, targetLat, targetLng))
      : 2;

  // Average city EV speed ~25 km/h -> mins = dist / 25 * 60
  const etaMins = Math.max(1, Math.round((driverDistKm / 25) * 60));

  // Initialize Leaflet
  useEffect(() => {
    let isCancelled = false;

    async function loadLeaflet() {
      try {
        if (!document.getElementById("leaflet-cdn-css")) {
          const link = document.createElement("link");
          link.id = "leaflet-cdn-css";
          link.rel = "stylesheet";
          link.href = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.css";
          document.head.appendChild(link);
        }

        if (!(window as any).L) {
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

        if (isCancelled || !containerRef.current) return;
        const L = (window as any).L;

        if (mapInstanceRef.current) {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        }

        const centerLat = pickup?.lat || 28.5562;
        const centerLng = pickup?.lng || 77.0856;

        const map = L.map(containerRef.current, {
          center: [centerLat, centerLng],
          zoom: 13,
          zoomControl: false,
          attributionControl: false,
        });

        // Clean Google Maps roadmap tiles: fast CDN, highly detailed Indian landmarks/roads, zero watermarks
        L.tileLayer("https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}", {
          maxZoom: 20,
          subdomains: "0123",
          attribution: "© Google Maps",
        }).addTo(map);

        L.control.zoom({ position: "bottomright" }).addTo(map);

        mapInstanceRef.current = map;
        setMapLoaded(true);

        setTimeout(() => {
          if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
        }, 300);
      } catch (err: any) {
        if (!isCancelled) setLoadError(err.message || "Failed to initialize map");
      }
    }

    loadLeaflet();

    return () => {
      isCancelled = true;
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update markers, polyline and bounds whenever coords or driver update
  useEffect(() => {
    if (!mapLoaded || !mapInstanceRef.current || !(window as any).L) return;
    const L = (window as any).L;
    const map = mapInstanceRef.current;

    // 1. Pickup Marker
    if (pickup?.lat && pickup?.lng) {
      if (!markersRef.current.pickup) {
        const pickupIcon = L.divIcon({
          className: "custom-pickup-pin",
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;">
              <div style="position: absolute; inset: -4px; border-radius: 9999px; background-color: rgba(16, 185, 129, 0.3); animation: ping 2s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="position: relative; width: 34px; height: 34px; border-radius: 9999px; background: linear-gradient(135deg, #10b981, #047857); color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2.5px solid white; font-size: 14px;">
                📍
              </div>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        markersRef.current.pickup = L.marker([pickup.lat, pickup.lng], { icon: pickupIcon })
          .addTo(map)
          .bindPopup(`<b>Pickup Location</b><br>${pickup.name}`);
      } else {
        markersRef.current.pickup.setLatLng([pickup.lat, pickup.lng]);
      }
    }

    // 2. Drop-off Marker
    if (drop?.lat && drop?.lng) {
      if (!markersRef.current.drop) {
        const dropIcon = L.divIcon({
          className: "custom-drop-pin",
          html: `
            <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px;">
              <div style="position: relative; width: 34px; height: 34px; border-radius: 9999px; background: linear-gradient(135deg, #ef4444, #b91c1c); color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2.5px solid white; font-size: 14px;">
                🏁
              </div>
            </div>
          `,
          iconSize: [34, 34],
          iconAnchor: [17, 17],
        });

        markersRef.current.drop = L.marker([drop.lat, drop.lng], { icon: dropIcon })
          .addTo(map)
          .bindPopup(`<b>Destination</b><br>${drop.name}`);
      } else {
        markersRef.current.drop.setLatLng([drop.lat, drop.lng]);
      }
    }

    // 3. Driver Vehicle Marker
    if (driver && effectiveDriverLat && effectiveDriverLng) {
      const plate = driver.vehicle_number && driver.vehicle_number !== "Unassigned" ? driver.vehicle_number : "Orange EV";
      const model = driver.vehicle_model || "Mahindra BE.6";

      if (!markersRef.current.driver) {
        const driverIcon = L.divIcon({
          className: "custom-driver-pin",
          html: `
            <div style="position: relative; display: flex; flex-direction: column; align-items: center;">
              <div style="position: absolute; top: 0; left: 50%; transform: translateX(-50%); width: 44px; height: 44px; border-radius: 9999px; background-color: rgba(249, 115, 22, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></div>
              <div style="position: relative; width: 42px; height: 42px; border-radius: 9999px; background: linear-gradient(135deg, #ea580c, #c2410c); color: white; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(234, 88, 12, 0.45); border: 3px solid white; font-size: 18px;">
                🚗
              </div>
              <div style="margin-top: 4px; background: #0f172a; color: #f97316; font-family: monospace; font-size: 10px; font-weight: bold; padding: 2px 6px; border-radius: 4px; box-shadow: 0 2px 6px rgba(0,0,0,0.5); border: 1px solid rgba(249,115,22,0.4); white-space: nowrap;">
                ${plate}
              </div>
            </div>
          `,
          iconSize: [60, 68],
          iconAnchor: [30, 21],
        });

        markersRef.current.driver = L.marker([effectiveDriverLat, effectiveDriverLng], {
          icon: driverIcon,
          zIndexOffset: 1000,
        })
          .addTo(map)
          .bindPopup(`<b>${driver.full_name || "Orange Driver"}</b><br>${model} · ${plate}`);
      } else {
        markersRef.current.driver.setLatLng([effectiveDriverLat, effectiveDriverLng]);
      }
    }

    // 4. Polylines
    if (markersRef.current.routeLine) {
      map.removeLayer(markersRef.current.routeLine);
      markersRef.current.routeLine = null;
    }
    if (markersRef.current.driverRouteLine) {
      map.removeLayer(markersRef.current.driverRouteLine);
      markersRef.current.driverRouteLine = null;
    }

    // Route line: Pickup -> Drop
    if (pickup?.lat && drop?.lat) {
      markersRef.current.routeLine = L.polyline(
        [
          [pickup.lat, pickup.lng],
          [drop.lat, drop.lng],
        ],
        {
          color: "#94a3b8",
          weight: 4,
          opacity: 0.6,
          dashArray: "6, 8",
        }
      ).addTo(map);
    }

    // Driver Approach Line: Driver -> Pickup
    if (driver && effectiveDriverLat && pickup?.lat && (status === "accepted" || status === "arrived")) {
      markersRef.current.driverRouteLine = L.polyline(
        [
          [effectiveDriverLat, effectiveDriverLng],
          [pickup.lat, pickup.lng],
        ],
        {
          color: "#f97316",
          weight: 5,
          opacity: 0.85,
        }
      ).addTo(map);
    } else if (driver && effectiveDriverLat && drop?.lat && status === "in_progress") {
      markersRef.current.driverRouteLine = L.polyline(
        [
          [effectiveDriverLat, effectiveDriverLng],
          [drop.lat, drop.lng],
        ],
        {
          color: "#10b981",
          weight: 5,
          opacity: 0.85,
        }
      ).addTo(map);
    }

    fitRoute();
  }, [mapLoaded, pickup?.lat, pickup?.lng, drop?.lat, drop?.lng, effectiveDriverLat, effectiveDriverLng, status]);

  function fitRoute() {
    if (!mapInstanceRef.current || !(window as any).L) return;
    const L = (window as any).L;
    const map = mapInstanceRef.current;

    const points: any[] = [];
    if (pickup?.lat && pickup?.lng) points.push([pickup.lat, pickup.lng]);
    if (drop?.lat && drop?.lng) points.push([drop.lat, drop.lng]);
    if (driver && effectiveDriverLat && effectiveDriverLng) {
      points.push([effectiveDriverLat, effectiveDriverLng]);
    }

    if (points.length > 0) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }

  return (
    <div className="relative flex flex-col h-full min-h-[420px] w-full rounded-2xl overflow-hidden border border-background/20 bg-background/5 shadow-2xl">
      {/* Top Floating Status Pill */}
      <div className="absolute top-4 left-4 right-4 z-[400] flex items-center justify-between gap-3 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-2.5 rounded-xl bg-background/90 px-3.5 py-2 text-xs font-semibold text-foreground shadow-lg backdrop-blur-md border border-border">
          {status === "searching" ? (
            <>
              <Loader2 className="size-3.5 animate-spin text-primary" />
              <span>Scanning Delhi-NCR for nearest Orange EV...</span>
            </>
          ) : status === "accepted" ? (
            <>
              <span className="relative flex size-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full size-2.5 bg-primary"></span>
              </span>
              <span>
                Driver en route · <strong className="text-primary">~{driverDistKm.toFixed(1)} km</strong> away (ETA: ~{etaMins}m)
              </span>
            </>
          ) : status === "arrived" ? (
            <>
              <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-emerald-600 font-bold">Driver has arrived at pickup point</span>
            </>
          ) : status === "in_progress" ? (
            <>
              <span className="size-2.5 rounded-full bg-blue-500 animate-pulse"></span>
              <span>Ride in progress to {drop?.name || "destination"}</span>
            </>
          ) : (
            <>
              <ShieldCheck className="size-3.5 text-emerald-500" />
              <span>Ride completed</span>
            </>
          )}
        </div>

        {/* Fit Route Button */}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={fitRoute}
          className="pointer-events-auto size-9 p-0 rounded-xl bg-background/90 text-foreground shadow-lg backdrop-blur-md border border-border hover:bg-background"
          title="Recenter Map View"
        >
          <Crosshair className="size-4 text-primary" />
        </Button>
      </div>

      {/* Map Container */}
      <div ref={containerRef} className="size-full min-h-[420px] z-0" />

      {/* Bottom Live Telemetry Strip */}
      <div className="absolute bottom-4 left-4 right-4 z-[400] flex items-center justify-between gap-2 pointer-events-none">
        <div className="pointer-events-auto flex items-center gap-3 rounded-xl bg-background/90 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-md backdrop-blur-md border border-border">
          <div className="flex items-center gap-1">
            <span className="size-2 rounded-full bg-emerald-500"></span>
            <span>Live GPS Active</span>
          </div>
          <span className="text-border">|</span>
          <div className="flex items-center gap-1 font-mono text-foreground font-semibold">
            <span>{driver?.vehicle_model || "Mahindra BE.6"}</span>
          </div>
          {distKm && distKm > 0 && (
            <>
              <span className="text-border">|</span>
              <span>Trip: {distKm.toFixed(1)} km</span>
            </>
          )}
        </div>
      </div>

      {loadError && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm z-[500] p-6 text-center">
          <p className="text-xs text-destructive">{loadError}</p>
        </div>
      )}
    </div>
  );
}
