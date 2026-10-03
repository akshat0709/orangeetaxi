import { MapPin, Car } from "lucide-react";
import { Map, AdvancedMarker } from "@vis.gl/react-google-maps";

// NOTE: This component requires a parent <APIProvider> to be mounted
export function LiveRideMap({ pickup, dropoff, driverLocation, rideStatus, waypoints = [] }: any) {
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

  // Default to Bengaluru if no valid coords provided
  const center = parsedPickup || parsedDropoff || { lat: 12.9716, lng: 77.5946 };

  return (
    <div className="w-full overflow-hidden rounded-xl" style={{ height: "420px" }}>
      <Map
        defaultCenter={center}
        defaultZoom={14}
        disableDefaultUI={true}
        gestureHandling="greedy"
        style={{ width: "100%", height: "420px" }}
      >
        {parsedPickup && (
          <AdvancedMarker position={parsedPickup}>
            <div className="flex size-8 items-center justify-center rounded-full bg-emerald-500 shadow-lg ring-2 ring-white">
              <MapPin className="size-4 text-white" />
            </div>
          </AdvancedMarker>
        )}
        {parsedDropoff && (
          <AdvancedMarker position={parsedDropoff}>
            <div className="flex size-8 items-center justify-center rounded-full bg-red-500 shadow-lg ring-2 ring-white">
              <MapPin className="size-4 text-white" />
            </div>
          </AdvancedMarker>
        )}
        {parsedDriver && (
          <AdvancedMarker position={parsedDriver}>
            <div
              className="flex size-10 items-center justify-center rounded-full bg-primary shadow-lg ring-4 ring-primary/30"
              style={{ transform: `rotate(${driverLocation?.heading || 0}deg)` }}
            >
              <Car className="size-5 text-white" />
            </div>
          </AdvancedMarker>
        )}
      </Map>
    </div>
  );
}
