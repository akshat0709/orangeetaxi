import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Zap,
  BatteryCharging,
  ShieldCheck,
  Gauge,
  ArrowRight,
  Wind,
  CheckCircle2,
  Trees,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import heroImage from "@/assets/orange-taxi-hero.jpg";
import eveningImage from "@/assets/orange-taxi-evening.jpg";

export const Route = createFileRoute("/electric")({
  head: () => ({
    meta: [
      { title: "100% Electric Fleet & Green Mission — Orange Taxi" },
      {
        name: "description",
        content:
          "Zero tailpipe emissions, 79 kWh battery safety, and clean urban mobility in Delhi NCR with our exclusive Mahindra BE.6 electric SUV fleet.",
      },
      { property: "og:title", content: "100% Electric Fleet & Green Mission — Orange Taxi" },
      {
        property: "og:description",
        content:
          "Explore the cutting-edge electric vehicle engineering behind Orange Taxi's zero-emission fleet.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ElectricPage,
});

const TECH_SPECS = [
  {
    icon: BatteryCharging,
    label: "Battery Pack",
    value: "79 kWh LFP Cell Architecture",
    detail: "High-thermal-stability Blade chemistry engineered for Indian climates.",
  },
  {
    icon: Gauge,
    label: "Certified Range",
    value: "500+ km per Single Charge",
    detail: "Guarantees zero range anxiety even on long intercity airport runs.",
  },
  {
    icon: Zap,
    label: "Fast Charging Speed",
    value: "175 kW DC Ultra-Fast",
    detail: "Recharges 20% to 80% in just 20 minutes at Orange Hub bays.",
  },
  {
    icon: ShieldCheck,
    label: "Safety Rating",
    value: "5-Star Crash Protection Standard",
    detail: "Rigid high-tensile steel frame with 6 airbags standard across the fleet.",
  },
];

const EMISSION_FACTS = [
  {
    title: "Zero Tailpipe Emissions",
    description:
      "A standard diesel or petrol commercial taxi generates ~200g of CO2 per kilometer in bumper-to-bumper traffic. Orange Taxi produces 0 grams of tailpipe emissions.",
  },
  {
    title: "Protecting Delhi NCR Air",
    description:
      "Each Orange EV removes approximately 5.8 metric tons of greenhouse gas emissions annually compared to internal combustion cabs, directly reducing urban PM2.5 levels.",
  },
  {
    title: "100% Clean Fleet Mandate",
    description:
      "We do not operate hybrid or fossil fuel vehicles as budget options. 100% of our fleet is pure battery electric (BEV) and always will be.",
  },
];

function ElectricPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-night text-white py-20 lg:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(16,185,129,0.18),transparent)]" />
        <div className="section-shell relative z-10">
          <div className="max-w-3xl">
            <div className="text-sm font-medium text-emerald-400">Electric fleet</div>
            <h1 className="display-serif mt-6 text-4xl sm:text-5xl lg:text-6xl font-normal leading-[1.05] tracking-tight">
              Quiet, clean, <br />
              <span className="text-emerald-400">fully electric.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-white/80 leading-relaxed max-w-2xl">
              Every Orange Taxi is a battery-electric Mahindra BE.6. Zero tailpipe pollution, zero
              engine vibrations, and a quieter city for everyone.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild size="lg">
                <Link to="/book">
                  Book a Clean Electric Ride <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="bg-transparent border-white/20 text-white hover:bg-white/10"
              >
                <Link to="/business">Corporate ESG Travel</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Vehicle Engineering Specs */}
      <section className="py-20 lg:py-24">
        <div className="section-shell">
          <div className="max-w-2xl mb-14">
            <span className="text-sm font-medium text-primary">The car</span>
            <h2 className="display-serif mt-3 text-3xl sm:text-4xl">
              Mahindra BE.6, built electric from the start
            </h2>
            <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
              An SUV designed around its battery rather than converted from a petrol car, so there
              is more room inside, fast charging and a strong crash-safety rating.
            </p>
          </div>

          <dl className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
            {TECH_SPECS.map((spec) => (
              <div key={spec.label} className="bg-background p-6">
                <dt className="text-sm text-muted-foreground">{spec.label}</dt>
                <dd className="mt-2 text-2xl font-semibold tracking-tight text-foreground tabular-nums">
                  {spec.value}
                </dd>
                <dd className="mt-2 text-sm text-muted-foreground leading-relaxed">
                  {spec.detail}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Environmental Impact Details */}
      <section className="py-20 bg-warm/40 border-y border-border">
        <div className="section-shell grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              Why it matters
            </span>
            <h2 className="display-serif mt-3 text-3xl sm:text-4xl leading-tight">
              A taxi drives far more than a family car.
            </h2>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              A single urban taxi drives over 60,000 kilometers each year — roughly 4 to 5 times the
              distance of a private family car. Switching a taxi to electric removes much more
              pollution than switching a private car.
            </p>

            <div className="mt-8 space-y-6">
              {EMISSION_FACTS.map((fact, idx) => (
                <div key={idx} className="flex items-start gap-4">
                  <span className="w-6 shrink-0 pt-px text-sm font-medium tabular-nums text-muted-foreground">
                    {idx + 1}.
                  </span>
                  <div>
                    <h4 className="text-sm font-semibold text-foreground">{fact.title}</h4>
                    <p className="mt-1 text-sm text-muted-foreground leading-relaxed">
                      {fact.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border shadow-soft">
            <img
              src={eveningImage}
              alt="Orange Taxi Mahindra BE.6 on a clean city street at twilight"
              className="w-full aspect-[4/3] object-cover"
            />
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-16 text-center">
        <div className="section-shell max-w-xl">
          <h2 className="display-serif text-3xl">Choose the cleaner ride.</h2>
          <p className="mt-3 text-sm text-muted-foreground">Your next ride, in a Mahindra BE.6.</p>
          <div className="mt-8 flex justify-center gap-4">
            <Button asChild size="lg">
              <Link to="/book">
                Book a ride <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
