import { MapPin, Car } from "lucide-react";
import { Map, AdvancedMarker, useMap } from "@vis.gl/react-google-maps";
import { useEffect } from "react";

function MapBoundsController({ pickup, dropoff, driver }: any) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    
    // Create a bounding box that includes all available coordinates
    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;
    
    if (pickup) { bounds.extend(pickup); hasPoints = true; }
    if (dropoff) { bounds.extend(dropoff); hasPoints = true; }
    if (driver) { bounds.extend(driver); hasPoints = true; }
    
    if (hasPoints) {
      // Fit map to bounds with padding
      map.fitBounds(bounds, { top: 50, bottom: 50, left: 50, right: 50 });
    }
  }, [map, pickup, dropoff, driver]);
  
  return null;
}

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
        mapId="orange-taxi-picker"
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
        <MapBoundsController pickup={parsedPickup} dropoff={parsedDropoff} driver={parsedDriver} />
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
