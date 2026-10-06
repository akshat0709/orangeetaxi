// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Clock,
  Shield,
  Briefcase,
  Car,
  Receipt,
} from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Corporate Contact & Office — Orange Taxi Limited" },
      {
        name: "description",
        content:
          "Official corporate details, registered office address, CIN, and department contact channels for Orange Taxi Limited.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <div className="min-h-screen py-16 md:py-24">
      <div className="section-shell max-w-5xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="size-4" /> Back to Home
        </Link>

        {/* Header */}
        <div className="border-b border-border pb-8">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <Building2 className="size-4" /> Corporate Information
          </div>
          <h1 className="display-serif mt-3 text-4xl md:text-5xl">Get in Touch with Orange</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <strong>ORANGE TAXI LIMITED</strong> · Public Limited Company registered under Companies
            Act, 2013
          </p>
        </div>

        {/* Corporate Statutory Disclosures Box */}
        <div className="my-8 rounded-2xl border border-primary/30 bg-primary/5 p-6 md:p-8">
          <h2 className="text-lg font-bold text-foreground">Official Corporate Identity</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 md:grid-cols-3 text-xs">
            <div className="rounded-lg bg-background p-4 border border-border">
              <p className="font-semibold text-foreground">Company Name</p>
              <p className="mt-1 text-primary font-bold text-sm">ORANGE TAXI LIMITED</p>
            </div>
            <div className="rounded-lg bg-background p-4 border border-border">
              <p className="font-semibold text-foreground">Corporate Identity No. (CIN)</p>
              <p className="mt-1 font-mono font-bold text-foreground">U49224DL2026PLC461350</p>
            </div>
            <div className="rounded-lg bg-background p-4 border border-border">
              <p className="font-semibold text-foreground">Registrar of Companies</p>
              <p className="mt-1 text-foreground">ROC Delhi · Active</p>
            </div>
            <div className="rounded-lg bg-background p-4 border border-border sm:col-span-2 md:col-span-3">
              <p className="font-semibold text-foreground">Registered Office Address</p>
              <p className="mt-1 text-muted-foreground">
                S-210, 2nd Floor, Panchshila Park, South Malviya Nagar, South Delhi, New Delhi,
                Delhi, India — 110017
              </p>
            </div>
          </div>
        </div>

        {/* Department Directory */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-6">
            <Phone className="size-5 text-primary" />
            <h3 className="mt-3 text-base font-bold">24x7 Customer Care</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              For ride bookings, passenger queries, and live trip assistance.
            </p>
            <div className="mt-4 text-xs space-y-1">
              <p className="font-mono text-primary font-semibold">
                <a href="tel:+917294073222">+91 72940 73222</a>
              </p>
              <p>
                <span className="text-muted-foreground">Bookings:</span>{" "}
                <a
                  href="mailto:bookings@orange-taxi.com"
                  className="text-primary font-medium hover:underline"
                >
                  bookings@orange-taxi.com
                </a>
              </p>
              <p>
                <span className="text-muted-foreground">Support:</span>{" "}
                <a
                  href="mailto:support@orange-taxi.com"
                  className="text-muted-foreground hover:underline"
                >
                  support@orange-taxi.com
                </a>
              </p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <Receipt className="size-5 text-primary" />
            <h3 className="mt-3 text-base font-bold">Billing & Invoicing</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              GST tax invoices, ride receipts, fare disputes, and refunds.
            </p>
            <div className="mt-4 text-xs space-y-1">
              <p>
                <a
                  href="mailto:billing@orange-taxi.com"
                  className="text-primary font-medium hover:underline"
                >
                  billing@orange-taxi.com
                </a>
              </p>
              <p className="text-muted-foreground">Official GST Tax Invoices & Statements</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <Car className="size-5 text-primary" />
            <h3 className="mt-3 text-base font-bold">Driver Partner Desk</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Driver onboarding, document verification, and training center.
            </p>
            <div className="mt-4 text-xs space-y-1">
              <p>
                <a
                  href="mailto:drive@orange-taxi.com"
                  className="text-primary hover:underline font-medium"
                >
                  drive@orange-taxi.com
                </a>
              </p>
              <p className="text-muted-foreground">South Delhi Driver Hub</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <Briefcase className="size-5 text-primary" />
            <h3 className="mt-3 text-base font-bold">Corporate Accounts</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Electric mobility packages for businesses and luxury hotel transit.
            </p>
            <div className="mt-4 text-xs space-y-1">
              <p>
                <a
                  href="mailto:business@orange-taxi.com"
                  className="text-primary hover:underline font-medium"
                >
                  business@orange-taxi.com
                </a>
              </p>
              <p className="text-muted-foreground">GST Invoiced B2B Billing</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <Shield className="size-5 text-primary" />
            <h3 className="mt-3 text-base font-bold">Grievance Redressal</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Nodal officer for regulatory, consumer, and intermediary grievances.
            </p>
            <div className="mt-4 text-xs space-y-1">
              <p>
                <a
                  href="mailto:grievance@orange-taxi.com"
                  className="text-primary hover:underline font-medium"
                >
                  grievance@orange-taxi.com
                </a>
              </p>
              <p className="text-muted-foreground">Statutory 24h Acknowledgement</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <Building2 className="size-5 text-primary" />
            <h3 className="mt-3 text-base font-bold">Legal & Secretariat</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Statutory corporate filings, compliance notices, and official administration.
            </p>
            <div className="mt-4 text-xs space-y-1">
              <p>
                <a
                  href="mailto:admin@orange-taxi.com"
                  className="text-primary hover:underline font-medium"
                >
                  admin@orange-taxi.com
                </a>
              </p>
              <p className="text-muted-foreground">CIN: U49224DL2026PLC461350</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <Clock className="size-5 text-primary" />
            <h3 className="mt-3 text-base font-bold">Operating Hours</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Fleet dispatch runs 24x7. Corporate office operates Mon–Sat.
            </p>
            <div className="mt-4 text-xs text-muted-foreground">
              <p>Fleet: 24 Hours / 365 Days</p>
              <p>Office: 09:30 AM – 06:30 PM IST</p>
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6 sm:col-span-2">
            <MapPin className="size-5 text-primary" />
            <h3 className="mt-3 text-base font-bold">Hub Locations</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Delhi NCR Electric Charging & Hub Network.
            </p>
            <div className="mt-4 text-xs text-muted-foreground grid sm:grid-cols-3 gap-2">
              <p>• IGI Airport T3 Bay</p>
              <p>• Panchshila Park Central Bay</p>
              <p>• Aerocity EV Terminal</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
