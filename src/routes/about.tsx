// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight, BatteryCharging, Building2, CheckCircle2, HeartHandshake, ShieldCheck, Sparkles, Users } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Orange Taxi Limited" },
      { name: "description", content: "Learn about Orange Taxi Limited: corporate profile, mission, leadership, and our zero-emission premium electric fleet in Delhi NCR." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen py-16 md:py-24">
      <div className="section-shell max-w-5xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="size-4" /> Back to Home
        </Link>

        {/* Hero Section */}
        <div className="border-b border-border pb-12">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Our Point of View</p>
          <h1 className="display-serif mt-4 text-5xl md:text-7xl leading-[0.95]">
            Premium should feel welcoming. <br />
            <span className="text-primary">Electric by nature.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base md:text-lg leading-relaxed text-muted-foreground">
            Orange Taxi was created around a simple conviction: thoughtful service, pristine cars, and courteous drivers should not be rare luxuries. We are building India's finest 100% electric mobility network, anchored in safety, dignity, and environmental responsibility.
          </p>
        </div>

        {/* 3 Pillars */}
        <div className="my-12 grid gap-6 sm:grid-cols-3">
          <div className="rounded-2xl border border-border bg-card p-6">
            <Sparkles className="size-6 text-primary" />
            <h3 className="mt-4 text-lg font-bold">Considered Hospitality</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Pre-cooled cabins, complimentary chilled water, spotless interiors, and trained chauffeurs who take pride in hospitality.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <HeartHandshake className="size-6 text-primary" />
            <h3 className="mt-4 text-lg font-bold">Driver Dignity</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Predictable fixed salaries, performance bonuses, humane shifts, and professional healthcare for every driver partner.
            </p>
          </div>
          <div className="rounded-2xl border border-border bg-card p-6">
            <BatteryCharging className="size-6 text-primary" />
            <h3 className="mt-4 text-lg font-bold">100% Zero-Emission</h3>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Every kilometre in an Orange Taxi is completely zero-tailpipe-emission, actively purifying the air in Delhi NCR.
            </p>
          </div>
        </div>

        {/* Corporate Profile Card under Companies Act, 2013 */}
        <div className="my-12 rounded-3xl border border-primary/30 bg-primary/5 p-8 md:p-10">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <Building2 className="size-4" /> Corporate Information (Companies Act, 2013)
          </div>
          <h2 className="display-serif mt-3 text-3xl font-bold">About Orange Taxi Limited</h2>
          <p className="mt-2 text-xs text-muted-foreground leading-relaxed max-w-2xl">
            Orange Taxi Limited is an Indian Public Limited Company incorporated under the Companies Act, 2013, registered with the Registrar of Companies (ROC Delhi), and licensed to operate motor vehicle aggregator services.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 text-xs">
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-muted-foreground">Corporate Identification No.</p>
              <p className="mt-1 font-mono font-bold text-foreground">U49224DL2026PLC461350</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-muted-foreground">Date of Incorporation</p>
              <p className="mt-1 font-semibold text-foreground">January 08, 2026</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-muted-foreground">Registrar of Companies</p>
              <p className="mt-1 font-semibold text-foreground">ROC Delhi · Active</p>
            </div>
            <div className="rounded-xl border border-border bg-background p-4">
              <p className="text-muted-foreground">Entity Type</p>
              <p className="mt-1 font-semibold text-foreground">Public Limited Company</p>
            </div>
          </div>

          <div className="mt-6 rounded-xl border border-border bg-background p-5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground">Registered Office Address:</p>
            <p className="mt-1">
              S-210, 2nd Floor, Panchshila Park, South Malviya Nagar, South Delhi, New Delhi, Delhi, India — 110017
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl border border-border bg-card p-8">
          <div>
            <h3 className="text-xl font-bold">Experience the difference today</h3>
            <p className="mt-1 text-xs text-muted-foreground">Book your electric journey across Delhi NCR in seconds.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild size="lg">
              <Link to="/book">Book a Ride <ArrowRight className="size-4 ml-1" /></Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/drive">Drive With Us</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}