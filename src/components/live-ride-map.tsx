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

import { useEffect, useState, useRef } from "react";
import { MapPin, Navigation, Car } from "lucide-react";
import { APIProvider, Map, AdvancedMarker } from "@vis.gl/react-google-maps";

export function LiveRideMap({ pickup, dropoff, driverLocation, rideStatus, waypoints = [] }: any) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";
  const center = pickup || dropoff || { lat: 28.6139, lng: 77.2090 };
  
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
          {pickup && (
            <AdvancedMarker position={pickup}>
              <div className="flex size-7 items-center justify-center rounded-full bg-emerald-500 shadow-md ring-2 ring-white">
                <MapPin className="size-4 text-white" />
              </div>
            </AdvancedMarker>
          )}
          {dropoff && (
            <AdvancedMarker position={dropoff}>
              <div className="flex size-7 items-center justify-center rounded-full bg-red-500 shadow-md ring-2 ring-white">
                <MapPin className="size-4 text-white" />
              </div>
            </AdvancedMarker>
          )}
          {driverLocation && (
            <AdvancedMarker position={driverLocation}>
              <div className="flex size-10 items-center justify-center rounded-full bg-primary shadow-lg ring-4 ring-primary/30" style={{ transform: `rotate(${driverLocation.heading || 0}deg)` }}>
                <Car className="size-5 text-white" />
              </div>
            </AdvancedMarker>
          )}
        </Map>
      </APIProvider>
    </div>
  );
}
