import { MapPin, Car, Clock, Route } from "lucide-react";
import { Map, AdvancedMarker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";

function DirectionsController({ pickup, dropoff, onRouteFound }: any) {
  const map = useMap();
  const routesLibrary = useMapsLibrary("routes");
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService>();
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer>();

  // Initialize instances
  useEffect(() => {
    if (!routesLibrary || !map) return;
    setDirectionsService(new routesLibrary.DirectionsService());
    const renderer = new routesLibrary.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: {
        strokeColor: "#f97316", // Orange-500
        strokeWeight: 4,
        strokeOpacity: 0.8,
      }
    });
    setDirectionsRenderer(renderer);

    return () => {
      renderer.setMap(null);
    };
  }, [routesLibrary, map]);

  // Fetch route
  useEffect(() => {
    if (!directionsService || !directionsRenderer || !pickup || !dropoff) return;

    directionsService.route(
      {
        origin: pickup,
        destination: dropoff,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status === "OK" && response) {
          directionsRenderer.setDirections(response);
          const route = response.routes[0];
          if (route && route.legs && route.legs[0]) {
            const leg = route.legs[0];
            onRouteFound({
              distance: leg.distance?.text,
              duration: leg.duration?.text
            });
          }
        }
      }
    );
  }, [directionsService, directionsRenderer, pickup, dropoff]);

  return null;
}

function MapBoundsController({ pickup, dropoff, driver }: any) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    // ... we don't strictly need this if DirectionsRenderer auto-fits bounds, but keeping it ensures driver is included.
    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;
    if (pickup) { bounds.extend(pickup); hasPoints = true; }
    if (dropoff) { bounds.extend(dropoff); hasPoints = true; }
    if (driver) { bounds.extend(driver); hasPoints = true; }
    if (hasPoints) {
      map.fitBounds(bounds, { top: 70, bottom: 70, left: 50, right: 50 });
    }
  }, [map, pickup, dropoff, driver]);
  return null;
}

// NOTE: This component requires a parent <APIProvider> to be mounted
export function LiveRideMap({ id, pickup, dropoff, driverLocation, rideStatus, waypoints = [] }: any) {
  const [routeInfo, setRouteInfo] = useState<{distance?: string, duration?: string} | null>(null);



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
    <div className="relative w-full overflow-hidden rounded-xl" style={{ height: "420px" }}>
      {routeInfo && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-4 rounded-full bg-background/95 px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur-md border border-border">
          <div className="flex items-center gap-1.5 text-foreground">
            <Route className="size-4 text-primary" />
            <span>{routeInfo.distance}</span>
          </div>
          <div className="h-4 w-px bg-border"></div>
          <div className="flex items-center gap-1.5 text-foreground">
            <Clock className="size-4 text-primary" />
            <span>{routeInfo.duration}</span>
          </div>
        </div>
      )}
      <Map
        id={id || "default-live-map"}
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
        {parsedPickup && parsedDropoff && (
          <DirectionsController 
            pickup={parsedPickup} 
            dropoff={parsedDropoff} 
            onRouteFound={setRouteInfo} 
          />
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
