import { useEffect, useState, useRef } from "react";
import { MapPin, Navigation, Car } from "lucide-react";
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";

export function LiveRideMap({ pickup, dropoff, driverLocation, rideStatus, waypoints = [] }: any) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  
  const parseCoords = (loc: any) => {
    if (!loc) return null;
    const lat = Number(loc.lat);
    const lng = Number(loc.lng);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  };

  const parsedPickup = parseCoords(pickup);
  const parsedDropoff = parseCoords(dropoff);
  const parsedDriver = parseCoords(driverLocation);
  
  const center = parsedPickup || parsedDropoff || { lat: 28.6139, lng: 77.2090 };
  return (
    <div className="relative h-full min-h-[300px] w-full overflow-hidden bg-muted">
      <APIProvider apiKey={apiKey}>
        <Map
          defaultCenter={center}
          defaultZoom={14}
          disableDefaultUI={true}
          mapId="LIVE_RIDE_MAP"
          style={{ width: '100%', height: '100%' }}
        >
          {parsedPickup && (
            <AdvancedMarker position={parsedPickup}>
              <div className="flex size-7 items-center justify-center rounded-full bg-emerald-500 shadow-md ring-2 ring-white">
                <MapPin className="size-4 text-white" />
              </div>
            </AdvancedMarker>
          )}
          {parsedDropoff && (
            <AdvancedMarker position={parsedDropoff}>
              <div className="flex size-7 items-center justify-center rounded-full bg-red-500 shadow-md ring-2 ring-white">
                <MapPin className="size-4 text-white" />
              </div>
            </AdvancedMarker>
          )}
          {parsedDriver && (
            <AdvancedMarker position={parsedDriver}>
              <div className="flex size-10 items-center justify-center rounded-full bg-primary shadow-lg ring-4 ring-primary/30" style={{ transform: `rotate(${driverLocation?.heading || 0}deg)` }}>
                <Car className="size-5 text-white" />
              </div>
            </AdvancedMarker>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
