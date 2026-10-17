/// <reference types="google.maps" />
import { MapPin, Car, Clock, Route } from "lucide-react";
import { APIProvider, Map, Marker, useMap, useMapsLibrary } from "@vis.gl/react-google-maps";
import { useEffect, useState } from "react";

function DirectionsController({ pickup, dropoff, driver, rideStatus, onRouteFound }: any) {
  const map = useMap();
  const routesLibrary = useMapsLibrary("routes");
  const [directionsService, setDirectionsService] = useState<google.maps.DirectionsService>();
  const [directionsRenderer, setDirectionsRenderer] = useState<google.maps.DirectionsRenderer>();

  useEffect(() => {
    if (!routesLibrary || !map) return;
    setDirectionsService(new routesLibrary.DirectionsService());
    const renderer = new routesLibrary.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: { strokeColor: "#f97316", strokeWeight: 4, strokeOpacity: 0.8 },
    });
    setDirectionsRenderer(renderer);
    return () => renderer.setMap(null);
  }, [routesLibrary, map]);

  useEffect(() => {
    if (!directionsService || !directionsRenderer) return;

    let origin = pickup;
    let destination = dropoff;

    // If accepted, driver is driving to pickup
    if ((rideStatus === "accepted" || rideStatus === "arrived") && driver && pickup) {
      origin = driver;
      destination = pickup;
    } else if (rideStatus === "in_progress" && driver && dropoff) {
      origin = driver;
      destination = dropoff;
    }

    if (!origin || !destination) return;

    directionsService.route(
      {
        origin,
        destination,
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (response: any, status: any) => {
        if (status === "OK" && response) {
          directionsRenderer.setDirections(response);
          const route = response.routes[0];
          if (route && route.legs && route.legs[0]) {
            const leg = route.legs[0];
            onRouteFound({
              distance: leg.distance?.text,
              duration: leg.duration?.text,
            });
          }
        }
      },
    );
  }, [directionsService, directionsRenderer, pickup, dropoff, driver, rideStatus]);

  return null;
}

function MapBoundsController({ pickup, dropoff, driver }: any) {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    const bounds = new window.google.maps.LatLngBounds();
    let hasPoints = false;
    if (pickup) {
      bounds.extend(pickup);
      hasPoints = true;
    }
    if (dropoff) {
      bounds.extend(dropoff);
      hasPoints = true;
    }
    if (driver) {
      bounds.extend(driver);
      hasPoints = true;
    }
    if (hasPoints) {
      map.fitBounds(bounds, { top: 70, bottom: 70, left: 50, right: 50 });
    }
  }, [map, pickup, dropoff, driver]);
  return null;
}

export function LiveRideMap({
  id,
  pickup,
  dropoff,
  drop,
  driverLocation,
  driver,
  rideStatus,
  status,
  apiKey: propApiKey,
  waypoints = [],
}: any) {
  const apiKey =
    propApiKey ||
    (import.meta as any).env?.VITE_GOOGLE_MAPS_API_KEY ||
    "AIzaSyD-IOH9cMppWtKjw_zn-m7XOE3ut62HVX8";
  const [routeInfo, setRouteInfo] = useState<{ distance?: string; duration?: string } | null>(null);

  const effectiveDropoff = dropoff || drop;
  const effectiveDriver = driverLocation || driver;
  const effectiveStatus = rideStatus || status;

  const parseCoords = (loc: any) => {
    if (!loc) return null;
    const lat = Number(loc.lat ?? loc.current_lat);
    const lng = Number(loc.lng ?? loc.current_lng);
    if (isNaN(lat) || isNaN(lng)) return null;
    return { lat, lng };
  };

  const parsedPickup = parseCoords(pickup);
  const parsedDropoff = parseCoords(effectiveDropoff);
  const parsedDriver = parseCoords(effectiveDriver);

  // Default to Bengaluru if no valid coords provided
  const center = parsedPickup || parsedDropoff || { lat: 12.9716, lng: 77.5946 };

  return (
    <APIProvider apiKey={apiKey} libraries={["routes", "geometry"]}>
      <div className="relative w-full overflow-hidden rounded-xl" style={{ height: "420px" }}>
        {routeInfo && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex flex-col items-center gap-1">
            {effectiveStatus === "accepted" && (
              <div className="rounded-full bg-amber-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
                Driver Arriving in {routeInfo.duration}
              </div>
            )}
            {effectiveStatus === "in_progress" && (
              <div className="rounded-full bg-blue-500 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white shadow-md">
                Drop-off in {routeInfo.duration}
              </div>
            )}
            <div className="flex items-center gap-4 rounded-full bg-background/95 px-4 py-2 text-sm font-semibold shadow-lg backdrop-blur-md border border-border">
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
          </div>
        )}
        <Map
          id={id || "default-live-map"}
          defaultCenter={center}
          defaultZoom={14}
          disableDefaultUI={true}
          gestureHandling="greedy"
          style={{ width: "100%", height: "420px" }}
        >
          {parsedPickup && (
            <Marker
              position={parsedPickup}
              title="Pickup Location"
              icon={{
                url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#10B981" stroke="#FFFFFF" stroke-width="2.5"/><circle cx="16" cy="16" r="5" fill="#FFFFFF"/></svg>'
                )}`,
              }}
            />
          )}
          {parsedDropoff && (
            <Marker
              position={parsedDropoff}
              title="Drop-off Destination"
              icon={{
                url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="#EF4444" stroke="#FFFFFF" stroke-width="2.5"/><circle cx="16" cy="16" r="5" fill="#FFFFFF"/></svg>'
                )}`,
              }}
            />
          )}
          <MapBoundsController pickup={parsedPickup} dropoff={parsedDropoff} driver={parsedDriver} />
          <DirectionsController
            pickup={parsedPickup}
            dropoff={parsedDropoff}
            driver={parsedDriver}
            rideStatus={effectiveStatus}
            onRouteFound={setRouteInfo}
          />
          {parsedDriver && (
            <Marker
              position={parsedDriver}
              title="Mahindra BE.6 Chauffeur"
              icon={{
                url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(
                  '<svg xmlns="http://www.w3.org/2000/svg" width="38" height="38" viewBox="0 0 38 38"><circle cx="19" cy="19" r="17" fill="#F97316" stroke="#FFFFFF" stroke-width="3"/><path d="M11 23v1.5a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5V23h8v1.5a1.5 1.5 0 0 0 1.5 1.5h1a1.5 1.5 0 0 0 1.5-1.5V23c.83 0 1.5-.67 1.5-1.5v-5c0-.9-.5-1.7-1.3-2.1l-1.8-3.5A2.2 2.2 0 0 0 21.4 11h-4.8a2.2 2.2 0 0 0-1.9 1.4l-1.8 3.5c-.8.4-1.3 1.2-1.3 2.1v5c0 .83.67 1.5 1.5 1.5h-.1zm2.8-9.5a.7.7 0 0 1 .6-.4h5.2a.7.7 0 0 1 .6.4l1.3 2.5H12.5l1.3-2.5zM13.5 20a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3zm11 0a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" fill="#FFFFFF"/></svg>'
                )}`,
              }}
            />
          )}
        </Map>
      </div>
    </APIProvider>
  );
}
