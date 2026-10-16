import React, { useState, useMemo } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  MapPin,
  ArrowRight,
  Sparkles,
  ShieldCheck,
  Zap,
  Info,
  Car,
  RotateCcw,
  CheckCircle2,
  Receipt,
  Snowflake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface PopularRoute {
  id: string;
  name: string;
  pickup: string;
  drop: string;
  distanceKm: number;
  hasToll: boolean;
  tollAmount: number;
}

const POPULAR_ROUTES: PopularRoute[] = [
  {
    id: "airport",
    name: "Indiranagar ➔ BLR Airport",
    pickup: "100 Feet Road, Indiranagar, Bengaluru",
    drop: "Terminal 2, Kempegowda International Airport (BLR)",
    distanceKm: 36,
    hasToll: true,
    tollAmount: 115,
  },
  {
    id: "tech-park",
    name: "Koramangala ➔ Whitefield IT Park",
    pickup: "Sony World Signal, Koramangala, Bengaluru",
    drop: "ITPL Main Road, Whitefield, Bengaluru",
    distanceKm: 18,
    hasToll: false,
    tollAmount: 0,
  },
  {
    id: "ecity",
    name: "MG Road ➔ Electronic City",
    pickup: "MG Road Metro Station, Bengaluru",
    drop: "Electronic City Phase 1, Bengaluru",
    distanceKm: 22,
    hasToll: true,
    tollAmount: 95,
  },
  {
    id: "delhi-airport",
    name: "Connaught Place ➔ IGI Airport T3",
    pickup: "Inner Circle, Connaught Place, New Delhi",
    drop: "Terminal 3, Indira Gandhi International Airport, New Delhi",
    distanceKm: 16,
    hasToll: false,
    tollAmount: 0,
  },
];

export function HomepageFareEstimator() {
  const navigate = useNavigate();
  const [pickup, setPickup] = useState(POPULAR_ROUTES[0].pickup);
  const [drop, setDrop] = useState(POPULAR_ROUTES[0].drop);
  const [distanceKm, setDistanceKm] = useState(POPULAR_ROUTES[0].distanceKm);
  const [selectedRouteId, setSelectedRouteId] = useState<string>("airport");

  // Check for tolls
  const hasToll = useMemo(() => {
    const text = (pickup + " " + drop).toLowerCase();
    return (
      text.includes("airport") ||
      text.includes("expressway") ||
      text.includes("nice") ||
      text.includes("toll") ||
      text.includes("igi") ||
      text.includes("kempegowda")
    );
  }, [pickup, drop]);

  const tollFare = hasToll ? 115 : 0;

  // Fare calculation for Mahindra BE.6
  // Base: ₹99 (includes 2 km), then ₹18/km; Minimum ₹149
  const { preTax, gst, totalFare } = useMemo(() => {
    const baseDistanceFare = Math.max(149, 99 + Math.round(18 * distanceKm));
    const subTotal = baseDistanceFare + tollFare;
    const tax = Math.round(subTotal * 0.05);
    const total = subTotal + tax;
    return {
      preTax: subTotal,
      gst: tax,
      totalFare: total,
    };
  }, [distanceKm, tollFare]);

  const handleSelectRoute = (route: PopularRoute) => {
    setSelectedRouteId(route.id);
    setPickup(route.pickup);
    setDrop(route.drop);
    setDistanceKm(route.distanceKm);
  };

  const handleBookNow = () => {
    navigate({
      to: "/book",
      search: {
        pickup: encodeURIComponent(pickup),
        drop: encodeURIComponent(drop),
      },
    });
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-6 md:p-8 shadow-xl relative overflow-hidden backdrop-blur-sm">
      {/* Background Decorative Accent */}
      <div className="absolute top-0 right-0 w-72 h-72 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-xs font-bold text-primary">
              <Sparkles className="size-3.5" />
              Upfront Transparent Pricing
            </span>
            <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-3.5" /> Zero Surge Ever
            </span>
          </div>
          <h3 className="display-serif text-2xl md:text-3xl font-bold text-foreground mt-2">
            Interactive Fare Estimator
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Calculate your exact Mahindra BE.6 fare upfront. No hidden surges, tolls disclosed before booking.
          </p>
        </div>

        {/* Quick Popular Route Chips */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-muted-foreground">Popular:</span>
          {POPULAR_ROUTES.map((route) => (
            <button
              key={route.id}
              onClick={() => handleSelectRoute(route)}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-all border ${
                selectedRouteId === route.id
                  ? "bg-primary text-primary-foreground border-primary shadow-sm"
                  : "bg-muted/40 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              }`}
            >
              {route.name}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mt-6">
        {/* Left Inputs & Distance Slider */}
        <div className="lg:col-span-7 flex flex-col gap-4">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <span className="size-2 rounded-full bg-emerald-500" />
                Pickup Location
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 size-4 text-emerald-600" />
                <Input
                  value={pickup}
                  onChange={(e) => {
                    setPickup(e.target.value);
                    setSelectedRouteId("");
                  }}
                  placeholder="Enter pickup locality, apartment or airport..."
                  className="pl-9 text-sm h-11 bg-background"
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5 mb-1.5">
                <span className="size-2 rounded-full bg-red-500" />
                Drop-off Destination
              </label>
              <div className="relative">
                <MapPin className="absolute left-3 top-3 size-4 text-red-500" />
                <Input
                  value={drop}
                  onChange={(e) => {
                    setDrop(e.target.value);
                    setSelectedRouteId("");
                  }}
                  placeholder="Enter drop destination or landmark..."
                  className="pl-9 text-sm h-11 bg-background"
                />
              </div>
            </div>
          </div>

          {/* Distance Adjuster Slider */}
          <div className="rounded-xl border border-border bg-muted/20 p-4 mt-2">
            <div className="flex items-center justify-between text-xs font-bold mb-2">
              <span className="text-muted-foreground uppercase tracking-wider">Estimated Trip Distance</span>
              <span className="font-mono text-base text-primary font-bold">{distanceKm} km</span>
            </div>
            <input
              type="range"
              min="2"
              max="75"
              step="1"
              value={distanceKm}
              onChange={(e) => {
                setDistanceKm(Number(e.target.value));
                setSelectedRouteId("");
              }}
              className="w-full accent-primary h-2 bg-muted rounded-lg cursor-pointer"
            />
            <div className="flex items-center justify-between text-[11px] text-muted-foreground mt-2">
              <span>Short city hop (2 km)</span>
              <span>Mid-town (25 km)</span>
              <span>Airport transfer (75 km)</span>
            </div>
          </div>

          {/* Upfront Toll Notification Banner */}
          {hasToll && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3.5 flex items-start gap-3 text-xs text-amber-800 dark:text-amber-300 animate-in fade-in">
              <Receipt className="size-4 shrink-0 text-amber-600 mt-0.5" />
              <div>
                <div className="font-bold">Upfront Toll Included: ₹{tollFare}</div>
                <div className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5 leading-relaxed">
                  Route passes through highway/airport toll corridor. Disclosed and included upfront so your chauffeur never asks for cash at the toll gate.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Fare Summary Card */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-xl border border-primary/20 bg-primary/5 p-6 relative">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Car className="size-4 text-primary" />
                Mahindra BE.6 Electric SUV
              </span>
              <span className="rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[11px] font-bold">
                100% EV
              </span>
            </div>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-xs text-muted-foreground font-semibold">Total Fare</span>
              <span className="display-serif text-4xl font-bold text-foreground ml-auto">
                ₹{totalFare}
              </span>
            </div>

            {/* Line items breakdown */}
            <div className="mt-4 space-y-2 border-t border-border/80 pt-3 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Base Fare (First 2 km)</span>
                <span className="font-mono font-medium text-foreground">₹99</span>
              </div>
              <div className="flex justify-between">
                <span>Distance Fare ({Math.max(0, distanceKm - 2)} km @ ₹18/km)</span>
                <span className="font-mono font-medium text-foreground">
                  ₹{Math.max(0, Math.round(18 * (distanceKm - 2)))}
                </span>
              </div>
              {hasToll && (
                <div className="flex justify-between text-amber-600 dark:text-amber-400 font-semibold">
                  <span>Upfront Expressway/Airport Toll</span>
                  <span className="font-mono">₹{tollFare}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>GST (5% SAC 9964)</span>
                <span className="font-mono font-medium text-foreground">₹{gst}</span>
              </div>
            </div>

            {/* Amenities pill tags */}
            <div className="mt-5 grid grid-cols-2 gap-2 text-[11px] font-medium text-foreground/80">
              <span className="flex items-center gap-1.5">
                <Snowflake className="size-3.5 text-primary" />
                Pre-cooled cabin
              </span>
              <span className="flex items-center gap-1.5">
                <Zap className="size-3.5 text-primary" />
                In-seat HD screens
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="size-3.5 text-emerald-600" />
                Zero cancellations
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="size-3.5 text-emerald-600" />
                Official GST receipt
              </span>
            </div>
          </div>

          <div className="mt-6 pt-4 border-t border-primary/20">
            <Button
              onClick={handleBookNow}
              size="lg"
              className="w-full font-bold shadow-md h-12 text-sm flex items-center justify-center gap-2"
            >
              Book This Mahindra BE.6
              <ArrowRight className="size-4" />
            </Button>
            <p className="text-[11px] text-center text-muted-foreground mt-2">
              No surge pricing · Confirmed ride instantly
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
