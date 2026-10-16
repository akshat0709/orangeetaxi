import React, { useState, useEffect } from "react";
import { Leaf, Zap, Trees, Droplet, Sparkles, ShieldCheck } from "lucide-react";

export function EcoImpactCounter() {
  // Live ticking counter simulation for dynamic feel
  const [extraKm, setExtraKm] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setExtraKm((prev) => prev + 1);
    }, 4500);
    return () => clearInterval(interval);
  }, []);

  const totalKm = 1428520 + extraKm;
  const co2Tonnes = (totalKm * 0.2).toFixed(1); // approx 200g CO2 saved per km vs ICE cab
  const treesEquiv = Math.round(totalKm * 0.0094).toLocaleString();
  const fuelLitres = Math.round(totalKm * 0.083).toLocaleString();

  return (
    <div className="rounded-2xl border border-emerald-500/20 bg-gradient-to-b from-emerald-500/5 via-card to-card p-6 md:p-10 shadow-lg">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border pb-6">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
              <Leaf className="size-3.5" />
              100% Zero Tailpipe Emissions
            </span>
            <span className="size-2 rounded-full bg-emerald-500 animate-ping" />
          </div>
          <h3 className="display-serif text-2xl md:text-3xl font-bold text-foreground mt-2">
            Real-Time Clean Energy Impact
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            Every kilometer in an Orange Taxi runs purely on electric battery power — protecting city air and reducing carbon footprint.
          </p>
        </div>

        <div className="flex items-center gap-2 rounded-xl bg-card border border-border px-4 py-2 text-xs font-medium text-muted-foreground">
          <ShieldCheck className="size-4 text-emerald-600" />
          <span>Audited EV Green Impact</span>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
        {/* Metric 1: Clean KM */}
        <div className="rounded-xl border border-border bg-background/60 p-5 backdrop-blur transition-all hover:border-emerald-500/40">
          <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Zap className="size-5" />
          </div>
          <div className="mt-4 display-serif text-2xl md:text-3xl font-bold text-foreground">
            {totalKm.toLocaleString()}+
          </div>
          <p className="text-xs font-semibold text-muted-foreground mt-1">
            Clean EV Kilometers Driven
          </p>
          <div className="mt-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">
            ● Mahindra BE.6 Fleet
          </div>
        </div>

        {/* Metric 2: CO2 Prevented */}
        <div className="rounded-xl border border-border bg-background/60 p-5 backdrop-blur transition-all hover:border-emerald-500/40">
          <div className="flex size-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
            <Leaf className="size-5" />
          </div>
          <div className="mt-4 display-serif text-2xl md:text-3xl font-bold text-foreground">
            {Number(co2Tonnes).toLocaleString()} Tonnes
          </div>
          <p className="text-xs font-semibold text-muted-foreground mt-1">
            CO₂ Emissions Prevented
          </p>
          <div className="mt-2 text-[10px] text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wider">
            ● Zero Smog in Cities
          </div>
        </div>

        {/* Metric 3: Trees Equivalent */}
        <div className="rounded-xl border border-border bg-background/60 p-5 backdrop-blur transition-all hover:border-emerald-500/40">
          <div className="flex size-10 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <Trees className="size-5" />
          </div>
          <div className="mt-4 display-serif text-2xl md:text-3xl font-bold text-foreground">
            {treesEquiv}+
          </div>
          <p className="text-xs font-semibold text-muted-foreground mt-1">
            Equivalent Trees Offset
          </p>
          <div className="mt-2 text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">
            ● Equivalent Urban Canopy
          </div>
        </div>

        {/* Metric 4: Fossil Fuel Saved */}
        <div className="rounded-xl border border-border bg-background/60 p-5 backdrop-blur transition-all hover:border-emerald-500/40">
          <div className="flex size-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
            <Droplet className="size-5" />
          </div>
          <div className="mt-4 display-serif text-2xl md:text-3xl font-bold text-foreground">
            {fuelLitres} L
          </div>
          <p className="text-xs font-semibold text-muted-foreground mt-1">
            Litres of Fossil Fuel Saved
          </p>
          <div className="mt-2 text-[10px] text-purple-600 dark:text-purple-400 font-bold uppercase tracking-wider">
            ● 100% Electric Energy
          </div>
        </div>
      </div>
    </div>
  );
}
