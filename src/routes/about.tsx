import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  ArrowRight,
  BatteryCharging,
  CheckCircle2,
  HeartHandshake,
  Sparkles,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Us — Orange Taxi Limited" },
      {
        name: "description",
        content:
          "Learn about Orange Taxi Limited: corporate profile, mission, leadership, and our zero-emission premium electric fleet in Delhi NCR.",
      },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <div className="min-h-screen py-16 md:py-24">
      <div className="section-shell max-w-5xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="size-4" /> Back to Home
        </Link>

        {/* Hero Section */}
        <div className="border-b border-border pb-12">
          <p className="text-sm font-medium text-primary">About us</p>
          <h1 className="display-serif mt-4 text-5xl md:text-7xl leading-[0.95]">
            A better cab ride, <br />
            <span className="text-primary">fully electric.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-base md:text-lg leading-relaxed text-muted-foreground">
            We started Orange Taxi because good service, clean cars and polite drivers should be
            normal, not a luxury. We run a fully electric fleet in Delhi NCR, and we treat our
            drivers and riders with the same respect.
          </p>
        </div>

        {/* 3 Pillars */}
        <div className="my-12 grid gap-10 sm:grid-cols-3">
          <div>
            <Sparkles className="size-5 text-primary" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-semibold">Hospitality</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Cool cabins, chilled water, clean interiors and chauffeurs trained to look after you.
            </p>
          </div>
          <div>
            <HeartHandshake className="size-5 text-primary" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-semibold">Fair to drivers</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Clear pay, reasonable shifts and support for every driver partner.
            </p>
          </div>
          <div>
            <BatteryCharging className="size-5 text-primary" aria-hidden="true" />
            <h3 className="mt-4 text-lg font-semibold">Fully electric</h3>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              No tailpipe, so no exhaust on Delhi NCR roads from any kilometre you ride with us.
            </p>
          </div>
        </div>

        {/* Corporate Profile Card under Companies Act, 2013 */}
        <div className="my-12 border-t border-border pt-12">
          <div className="text-sm font-medium text-primary">Company information</div>
          <h2 className="display-serif mt-3 text-3xl">About Orange Taxi Limited</h2>
          <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-2xl">
            Orange Taxi Limited is an Indian Public Limited Company incorporated under the Companies
            Act, 2013, registered with the Registrar of Companies (ROC Delhi), and licensed to
            operate motor vehicle aggregator services.
          </p>

          <dl className="mt-8 grid gap-x-8 gap-y-5 border-t border-border pt-6 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-muted-foreground">CIN</dt>
              <dd className="mt-1 font-mono text-foreground">U49224DL2026PLC461350</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Incorporated</dt>
              <dd className="mt-1 text-foreground">8 January 2026</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Registrar</dt>
              <dd className="mt-1 text-foreground">ROC Delhi · Active</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Entity type</dt>
              <dd className="mt-1 text-foreground">Public limited company</dd>
            </div>
            <div className="sm:col-span-2 lg:col-span-4">
              <dt className="text-muted-foreground">Registered office</dt>
              <dd className="mt-1 text-foreground">
                S-210, 2nd Floor, Panchshila Park, South Malviya Nagar, New Delhi 110017
              </dd>
            </div>
          </dl>
        </div>

        {/* CTA */}
        <div className="mt-16 flex flex-col sm:flex-row items-center justify-between gap-6 rounded-2xl border border-border bg-card p-8">
          <div>
            <h3 className="text-xl font-semibold">Ready to ride?</h3>
            <p className="mt-1 text-xs text-muted-foreground">Book a ride anywhere in Delhi NCR.</p>
          </div>
          <div className="flex items-center gap-3">
            <Button asChild size="lg">
              <Link to="/book">
                Book a Ride <ArrowRight className="size-4 ml-1" />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link to="/drive">Drive With Us</Link>
            </Button>
          </div>
        </div>

        {/* Platform Credits */}
        <div className="mt-8 text-center text-xs text-muted-foreground">
          Platform Architecture & Engineering ·{" "}
          <a
            href="https://builtbyakshat.vercel.app/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline font-medium inline-flex items-center gap-1"
          >
            <span>Built by Akshat</span>
            <span className="text-[10px]">↗</span>
          </a>
        </div>
      </div>
    </div>
  );
}
