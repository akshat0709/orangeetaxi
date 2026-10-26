import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Snowflake,
  VolumeX,
  MonitorPlay,
  Music2,
  Newspaper,
  Droplets,
  ArrowRight,
  Check,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import interiorImage from "@/assets/orange-taxi-interior.jpg";
import driverImage from "@/assets/orange-taxi-driver.jpg";

export const Route = createFileRoute("/experience")({
  head: () => ({
    meta: [
      { title: "The Orange Experience — Signature In-Cab Hospitality" },
      {
        name: "description",
        content:
          "Discover the thoughtful details behind every Orange Taxi ride: pre-cooled AC, in-seat HD entertainment, daily newspapers, silent electric cabins, and zero driver cancellations.",
      },
      { property: "og:title", content: "The Orange Experience — Signature In-Cab Hospitality" },
      {
        property: "og:description",
        content:
          "Every journey in our Mahindra BE.6 SUV is designed around hospitality, silence, and comfort.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: ExperiencePage,
});

const EXPERIENCE_PILLARS = [
  {
    icon: Snowflake,
    title: "Guaranteed Pre-Cooled AC",
    subtitle: "22°C before you step in",
    description:
      "No arguing over the AC. In summer and monsoon, your chauffeur switches on dual-zone climate control 10 minutes prior to arrival so the cabin is already cool when you get in.",
  },
  {
    icon: VolumeX,
    title: "Acoustically Silent Cabin",
    subtitle: "No engine noise",
    description:
      "Zero engine vibration, zero tailpipe rumble. Choose our 'Quiet Ride' preference during booking to enjoy uninterrupted conference calls, deep focus, or peaceful rest after a long flight.",
  },
  {
    icon: MonitorPlay,
    title: "In-Seat HD Entertainment",
    subtitle: "Screens in the back seat",
    description:
      "Rear passenger high-definition touchscreens featuring live trip navigation, documentaries, streaming, and real-time flight status updates for airport routes.",
  },
  {
    icon: Music2,
    title: "Good sound system",
    subtitle: "Tuned for clarity",
    description:
      "A multi-speaker system you can play your own music on over Bluetooth, or keep quiet.",
  },
  {
    icon: Newspaper,
    title: "Fresh Daily Print Media",
    subtitle: "For the morning commute",
    description:
      "Each morning, fresh editions of leading national business and daily newspapers are placed in the rear seat pockets.",
  },
  {
    icon: Droplets,
    title: "Complimentary Chilled Water",
    subtitle: "Sealed hygienic hydration",
    description:
      "A complimentary sealed bottle of mineral water rests in every door cup holder, ready when you take your seat.",
  },
];

const COMPARISON_ROWS = [
  {
    feature: "Driver Cancellation Rate",
    orange: "0% (Zero Cancellation Guarantee)",
    others: "Frequent (15% – 30% cancellations)",
  },
  {
    feature: "Air Conditioning (AC) Policy",
    orange: "100% Guaranteed & Pre-Cooled at 22°C",
    others: "Often refused or disputed by driver",
  },
  {
    feature: "Fleet Standard",
    orange: "Uniform Mahindra BE.6 Electric SUVs",
    others: "Inconsistent mix of aged compact cars",
  },
  {
    feature: "Surge Multipliers on Advance Booking",
    orange: "0x Surge — Flat predictable pricing",
    others: "Up to 2x – 3x during peak hours & rain",
  },
  {
    feature: "Chauffeur Training & Verification",
    orange: "Defensive driving & verified background",
    others: "Basic automated onboarding",
  },
  {
    feature: "In-Cab Hospitality Amenities",
    orange: "HD screen, newspaper, water, charger",
    others: "None",
  },
];

function ExperiencePage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Header */}
      <section className="relative overflow-hidden bg-night text-white py-20 lg:py-28">
        <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(245,107,0,0.18)_0%,transparent_60%)]" />
        <div className="section-shell relative z-10">
          <div className="max-w-3xl">
            <div className="text-sm font-medium text-primary">The ride</div>
            <h1 className="display-serif mt-6 text-4xl sm:text-5xl lg:text-6xl font-normal leading-[1.05] tracking-tight">
              The small things, <br />
              <span className="text-primary">done properly.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-white/80 leading-relaxed max-w-2xl">
              A cool cabin, a quiet car, a chauffeur who knows the route and a clean seat every
              time. Here is what is in the car and how a ride works.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild size="lg">
                <Link to="/book">
                  Book a ride <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="bg-transparent border-white/20 text-white hover:bg-white/10"
              >
                <Link to="/electric">About the car</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Showcase Split */}
      <section className="py-20 border-b border-border">
        <div className="section-shell grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-sm font-medium text-primary">Inside the Mahindra BE.6</span>
            <h2 className="display-serif mt-3 text-3xl sm:text-4xl leading-tight">
              Step into comfort, not heat or stress.
            </h2>
            <p className="mt-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Between meetings, after a long flight or on the way home, the car should be somewhere
              you can rest. Every cabin is cleaned and checked after each shift.
            </p>

            <div className="mt-8 space-y-4 text-sm">
              <div className="flex items-start gap-3">
                <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="size-4" />
                </div>
                <div>
                  <strong className="text-foreground">Dual Fast Charging Ports:</strong> USB-C (65W
                  Power Delivery) and Lightning cables ready in the rear console.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="size-4" />
                </div>
                <div>
                  <strong className="text-foreground">Ergonomic Leatherette Seating:</strong>{" "}
                  Expansive rear legroom with deep contouring and center armrest cup holders.
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="size-6 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
                  <Check className="size-4" />
                </div>
                <div>
                  <strong className="text-foreground">Zero Engine Vibration:</strong> Electric
                  skateboard architecture means no gear changes and a smooth ride.
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border shadow-soft">
            <img
              src={interiorImage}
              alt="Rear cabin of a Mahindra BE.6 with a seat-back screen"
              className="w-full aspect-[4/3] object-cover"
            />
          </div>
        </div>
      </section>

      {/* 6 Core Pillars Grid */}
      <section className="py-20 lg:py-24 bg-card/50">
        <div className="section-shell">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-sm font-medium text-primary">On every ride</span>
            <h2 className="display-serif mt-3 text-3xl sm:text-4xl">What comes with the car.</h2>
            <p className="mt-3 text-sm text-muted-foreground">
              All of this is standard on every ride. There are no paid upgrades.
            </p>
          </div>

          <div className="grid gap-x-12 gap-y-10 border-t border-border pt-10 md:grid-cols-2 lg:grid-cols-3">
            {EXPERIENCE_PILLARS.map((pillar) => {
              const Icon = pillar.icon;
              return (
                <div key={pillar.title}>
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{pillar.title}</h3>
                  <p className="mt-1 text-sm text-foreground/70">{pillar.subtitle}</p>
                  <p className="mt-3 text-sm text-muted-foreground leading-relaxed">
                    {pillar.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Chauffeur Standard Section */}
      <section className="py-20 border-y border-border">
        <div className="section-shell grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 overflow-hidden rounded-3xl border border-border shadow-soft">
            <img
              src={driverImage}
              alt="Orange Taxi professional chauffeur in smart uniform"
              className="w-full aspect-[4/3] object-cover"
            />
          </div>
          <div className="order-1 lg:order-2">
            <span className="text-sm font-medium text-primary">Chauffeurs</span>
            <h2 className="display-serif mt-3 text-3xl sm:text-4xl leading-tight">
              Trained, checked and on time.
            </h2>
            <p className="mt-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
              At Orange Taxi, drivers are salaried professionals with health insurance, fair working
              hours, and performance bonuses. Drivers who are treated well tend to drive well.
            </p>
            <ul className="mt-6 grid sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                Background and police verification
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                Defensive driving certified
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                In uniform
              </li>
              <li className="flex items-center gap-2">
                <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                Help with heavy luggage
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Side-by-Side Comparison Table */}
      <section className="py-20 lg:py-24">
        <div className="section-shell max-w-4xl">
          <div className="text-center mb-14">
            <span className="text-sm font-medium text-primary">Compared</span>
            <h2 className="display-serif mt-3 text-3xl sm:text-4xl">
              Orange Taxi and a regular app cab
            </h2>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="grid grid-cols-12 bg-muted/60 p-4 text-sm font-medium text-muted-foreground border-b border-border">
              <div className="col-span-5 sm:col-span-6">Service Standard</div>
              <div className="col-span-4 sm:col-span-3 text-primary">Orange Taxi</div>
              <div className="col-span-3 sm:col-span-3 text-muted-foreground">Other Cabs</div>
            </div>

            <div className="divide-y divide-border">
              {COMPARISON_ROWS.map((row, index) => (
                <div key={index} className="grid grid-cols-12 p-4 text-sm items-center">
                  <div className="col-span-5 sm:col-span-6 font-semibold text-foreground">
                    {row.feature}
                  </div>
                  <div className="col-span-4 sm:col-span-3 text-xs sm:text-sm font-medium text-primary flex items-center gap-1.5">
                    <Check className="size-4 text-primary shrink-0" />
                    <span>{row.orange}</span>
                  </div>
                  <div className="col-span-3 sm:col-span-3 text-xs sm:text-sm text-muted-foreground flex items-center gap-1.5">
                    <X className="size-4 text-rose-500 shrink-0" />
                    <span>{row.others}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Bottom CTA Banner */}
      <section className="py-16 bg-night text-white text-center border-t border-border">
        <div className="section-shell max-w-2xl">
          <h2 className="display-serif text-3xl sm:text-4xl font-normal">
            Book your next ride with us.
          </h2>
          <p className="mt-4 text-sm text-white/70">
            Book your journey in Delhi NCR or schedule an airport transfer in advance.
          </p>
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
