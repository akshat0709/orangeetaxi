import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Snowflake,
  VolumeX,
  MonitorPlay,
  Music2,
  Newspaper,
  Droplets,
  ShieldCheck,
  UserRoundCheck,
  ArrowRight,
  Sparkles,
  Check,
  X,
  BatteryCharging,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import interiorImage from "@/assets/orange-taxi-interior.jpg";
import passengerImage from "@/assets/orange-taxi-passenger.jpg";
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
      "No haggling with drivers over air conditioning. In peak summer or humid monsoons, our chauffeurs activate dual-zone climate control 10 minutes prior to arrival so you step into a cool, refreshing sanctuary.",
  },
  {
    icon: VolumeX,
    title: "Acoustically Silent Cabin",
    subtitle: "Pure EV serenity",
    description:
      "Zero engine vibration, zero tailpipe rumble. Choose our 'Quiet Ride' preference during booking to enjoy uninterrupted conference calls, deep focus, or peaceful rest after a long flight.",
  },
  {
    icon: MonitorPlay,
    title: "In-Seat HD Entertainment",
    subtitle: "Your personal media hub",
    description:
      "Rear passenger high-definition touchscreens featuring live trip navigation, curated documentaries, streaming entertainment, and real-time flight status updates for airport routes.",
  },
  {
    icon: Music2,
    title: "Premium Studio Acoustics",
    subtitle: "Tuned for clarity",
    description:
      "Acoustically calibrated multi-speaker sound stage. Connect your personal playlist seamlessly via Bluetooth or choose from curated ambient and relaxing playlists.",
  },
  {
    icon: Newspaper,
    title: "Fresh Daily Print Media",
    subtitle: "Stay effortlessly informed",
    description:
      "Each morning, fresh editions of leading national business and daily newspapers are placed in the rear seat pockets for your reading pleasure.",
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
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-primary">
              <Sparkles className="size-3.5" /> Hospitality on Wheels
            </div>
            <h1 className="display-serif mt-6 text-4xl sm:text-5xl lg:text-6xl font-normal leading-[1.05] tracking-tight">
              Thoughtful in every detail. <br />
              <span className="text-primary">Effortless in every mile.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-white/80 leading-relaxed max-w-2xl">
              We took everything that is frustrating about regular city cabs and redesigned it from
              scratch. From pre-cooled cabins to trained chauffeurs, discover what riding with
              dignity feels like.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <Button asChild size="lg" className="font-bold shadow-md">
                <Link to="/book">
                  Book This Experience <ArrowRight className="ml-2 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="bg-transparent border-white/20 text-white hover:bg-white/10"
              >
                <Link to="/electric">Discover Our EV Fleet</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Visual Showcase Split */}
      <section className="py-20 border-b border-border">
        <div className="section-shell grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Mahindra BE.6 Interior Sanctuary
            </span>
            <h2 className="display-serif mt-3 text-3xl sm:text-4xl font-bold leading-tight">
              Step into comfort, not heat or stress.
            </h2>
            <p className="mt-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
              When you book an Orange Taxi, your vehicle is not just transport — it is a sanctuary
              between meetings, after a long flight, or en route to your home. We maintain strict
              cabin cleanliness audits after every shift.
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
                  skateboard architecture ensures a velvet-smooth ride without gear shift jerks.
                </div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-border shadow-soft">
            <img
              src={interiorImage}
              alt="Mahindra BE.6 luxury interior cabin with HD display and premium upholstery"
              className="w-full aspect-[4/3] object-cover transition-transform duration-700 hover:scale-105"
            />
          </div>
        </div>
      </section>

      {/* 6 Core Pillars Grid */}
      <section className="py-20 lg:py-24 bg-card/50">
        <div className="section-shell">
          <div className="text-center max-w-2xl mx-auto mb-16">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              The Standard We Guarantee
            </span>
            <h2 className="display-serif mt-3 text-3xl sm:text-4xl font-bold">
              Included with every single reservation.
            </h2>
            <p className="mt-3 text-sm text-muted-foreground">
              No extra charges, no hidden upgrades. Every passenger enjoys our full hospitality
              suite.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {EXPERIENCE_PILLARS.map((pillar, idx) => {
              const Icon = pillar.icon;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-border bg-card p-8 transition-all hover:border-primary/40 hover:shadow-sm"
                >
                  <div className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-6" />
                  </div>
                  <div className="mt-5 text-xs font-bold text-primary uppercase tracking-wider">
                    {pillar.subtitle}
                  </div>
                  <h3 className="mt-1 text-xl font-bold text-foreground">{pillar.title}</h3>
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
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              The Chauffeur Standard
            </span>
            <h2 className="display-serif mt-3 text-3xl sm:text-4xl font-bold leading-tight">
              Trained in hospitality, committed to safety.
            </h2>
            <p className="mt-5 text-sm sm:text-base text-muted-foreground leading-relaxed">
              At Orange Taxi, drivers are salaried professionals with health insurance, fair working
              hours, and performance bonuses. Because they are treated with dignity, they take pride
              in delivering impeccable service to you.
            </p>
            <div className="mt-6 grid sm:grid-cols-2 gap-4 text-xs font-semibold">
              <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card">
                <ShieldCheck className="size-4 text-emerald-600" />
                Verified Background & Police Check
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card">
                <UserRoundCheck className="size-4 text-emerald-600" />
                Defensive Driving Certification
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card">
                <Check className="size-4 text-primary" />
                Immaculate Uniform & Grooming
              </div>
              <div className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card">
                <Check className="size-4 text-primary" />
                Assistance with Heavy Luggage
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Side-by-Side Comparison Table */}
      <section className="py-20 lg:py-24">
        <div className="section-shell max-w-4xl">
          <div className="text-center mb-14">
            <span className="text-xs font-bold uppercase tracking-widest text-primary">
              Clear Differentiation
            </span>
            <h2 className="display-serif mt-3 text-3xl sm:text-4xl font-bold">
              Orange Taxi vs Regular App Taxis
            </h2>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            <div className="grid grid-cols-12 bg-muted/60 p-4 text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-border">
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
                  <div className="col-span-4 sm:col-span-3 text-xs sm:text-sm font-bold text-primary flex items-center gap-1.5">
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
            Ready to experience a better way to move?
          </h2>
          <p className="mt-4 text-sm text-white/70">
            Book your journey in Delhi NCR or schedule an airport transfer in advance.
          </p>
          <div className="mt-8 flex justify-center gap-4">
            <Button asChild size="lg" className="font-bold shadow-md">
              <Link to="/book">
                Book a Ride Now <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
