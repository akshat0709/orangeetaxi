import { createFileRoute, Link } from "@tanstack/react-router";
import { LiveTariffList } from "@/components/live-tariff";
import { Shield, ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms and Conditions — Orange Taxi Limited" },
      {
        name: "description",
        content:
          "Official Terms of Service, passenger rights, fare policies, waiting charges, and cancellation rules for Orange Taxi Limited.",
      },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen py-16 md:py-24 bg-background text-foreground">
      <div className="section-shell max-w-4xl">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground mb-8"
        >
          <ArrowLeft className="size-4" /> Back to Home
        </Link>

        {/* Header */}
        <div className="border-b border-border pb-8">
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Shield className="size-4" /> Statutory Compliance & Passenger Rights
          </div>
          <h1 className="display-serif mt-3 text-4xl sm:text-5xl">Terms & Conditions of Service</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <strong>ORANGE TAXI LIMITED</strong> · Public Limited Company (CIN:
            U49224DL2026PLC461350)
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Last Updated & Enforced: October 2026 · Operating in compliance with Motor Vehicle
            Aggregator Guidelines
          </p>
        </div>

        {/* Terms Content */}
        <div className="mt-10 space-y-10 text-sm leading-relaxed text-foreground">
          {/* Section 1 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              1. Corporate Identity and Scope of Services
            </h2>
            <p className="text-muted-foreground">
              These Terms and Conditions (“Terms”) govern the access and use of the mobile
              applications, websites, digital platforms, and passenger transportation services
              provided by <strong>ORANGE TAXI LIMITED</strong> (“Orange Taxi”, “Company”, “we”,
              “us”, or “our”), having its registered office at S-210, 2nd Floor, Panchshila Park,
              South Malviya Nagar, South Delhi, New Delhi 110017, India.
            </p>
            <p className="text-muted-foreground">
              Orange Taxi operates a licensed zero-emission motor vehicle aggregator network under
              the provisions of the Motor Vehicles Act, 1988, the Motor Vehicle Aggregator
              Guidelines 2020, and the Delhi Motor Vehicle Aggregator and Delivery Service Provider
              Scheme 2023. All trips are executed exclusively using 100% battery electric vehicles
              (BEV), primarily the Mahindra BE.6 SUV platform.
            </p>
          </section>

          {/* Section 2 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              2. User Eligibility & Account Registration
            </h2>
            <p className="text-muted-foreground">
              To book a ride through our platform, you must be at least 18 years of age and legally
              competent to enter into binding contracts under the Indian Contract Act, 1872. You
              agree to provide accurate, current, and verified mobile phone numbers and email
              details during account creation or one-time booking checkout.
            </p>
            <p className="text-muted-foreground">
              In accordance with the Digital Personal Data Protection (DPDP) Act, 2023, personal
              data provided during account registration is utilized strictly for identity
              authentication, booking dispatch, safety tracking, and tax invoice issuance.
            </p>
          </section>

          {/* Section 3 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              3. Zero Driver Cancellation Policy & Chauffeur Commitment
            </h2>
            <p className="text-muted-foreground">
              Orange Taxi enforces a strict <strong>Zero Driver Cancellation Guarantee</strong>.
              Once a chauffeur accepts an immediate or scheduled booking, they are contractually
              prohibited from unilaterally cancelling the reservation.
            </p>
            <p className="text-muted-foreground">
              In the unlikely event of sudden vehicle technical breakdown or force majeure road
              blockages, our Central Control Tower automatically reassigns an equivalent or superior
              vehicle from our nearest hub with top priority, notifying the passenger via SMS and
              in-app alerts.
            </p>
          </section>

          {/* Section 4 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              4. Transparent Fare Schedule, Tolls & Taxes
            </h2>
            <p className="text-muted-foreground">
              Current fares (the exact fare for your trip is shown before you book):
            </p>
            <LiveTariffList />
            <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
              <li>
                <strong>Toll Charges & Parking:</strong> State border taxes, airport entry fees, and
                expressway tolls (e.g. DND Flyway, NICE Road, Airport Expressway) are passed through
                at actuals without markup.
              </li>
              <li>
                <strong>Goods and Services Tax (GST):</strong> All passenger transport fares are
                subject to statutory 5% GST under SAC 9964. Valid GSTIN numbers submitted in the
                customer profile receive compliant e-invoices eligible for Input Tax Credit (ITC).
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              5. Chauffeur Arrival & Waiting Fee Policy
            </h2>
            <p className="text-muted-foreground">
              Upon arriving at your specified pickup location, your assigned chauffeur will mark
              their arrival in the system. To ensure fair compensation for our chauffeurs and fleet
              availability:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
              <li>
                <strong>Grace Period and Waiting Fee:</strong> free waiting time and the per-minute
                charge after it are listed in section 4 and shown in the app while the chauffeur
                waits.
              </li>
              <li>
                <strong>Airport Terminal Grace Period:</strong> For flight-linked bookings at Delhi
                IGI Airport, a complimentary waiting allowance of{" "}
                <strong>45 minutes post flight touchdown</strong> is provided.
              </li>
              <li>
                <strong>No-show:</strong> after 30 minutes of waiting the ride may be deemed a
                passenger no-show.
              </li>
            </ul>
          </section>

          {/* Section 6 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              6. Guaranteed In-Cab Amenities & Passenger Rights
            </h2>
            <p className="text-muted-foreground">
              Every passenger travelling in an Orange Taxi is entitled to:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-muted-foreground">
              <li>
                <strong>100% Pre-Cooled AC:</strong> The cabin air conditioning will be maintained
                at a comfortable temperature (typically 22°C) prior to pickup. Chauffeurs are
                strictly prohibited from switching off AC.
              </li>
              <li>
                <strong>Quiet Ride Mode:</strong> Passengers may request a silent journey without
                driver conversation or radio audio.
              </li>
              <li>
                <strong>Complimentary Refreshment:</strong> One sealed bottle of drinking water per
                passenger.
              </li>
              <li>
                <strong>In-Seat HD Entertainment & Device Charging:</strong> Functional USB-C and
                Lightning cables.
              </li>
            </ul>
          </section>

          {/* Section 7 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              7. Passenger Conduct & Vehicle Care
            </h2>
            <p className="text-muted-foreground">
              Passengers are requested to maintain reasonable vehicle care during the trip. Smoking,
              vaping, consumption of alcohol, or transport of hazardous contraband substances is
              strictly prohibited under the Motor Vehicles Act. Any intentional damage or soilage
              requiring professional interior detailing may incur actual cleaning fees up to ₹1,500.
            </p>
          </section>

          {/* Section 8 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">8. Lost and Found Property</h2>
            <p className="text-muted-foreground">
              Orange Taxi maintains a centralized Lost Property protocol. If an item is
              inadvertently left in a vehicle, report it immediately via the in-app support portal
              or call our 24x7 helpline. All chauffeurs are mandated to surrender misplaced articles
              to the nearest Orange Hub Depot within 24 hours of discovery. Return delivery to your
              doorstep may incur standard kilometer travel charges.
            </p>
          </section>

          {/* Section 9 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              9. Safety, SOS Protocol & Grievance Redressal
            </h2>
            <p className="text-muted-foreground">
              In accordance with statutory aggregator regulations, every ride includes an in-app
              emergency SOS button that automatically dials 112 (National Emergency Support) and
              alerts our 24x7 Central Incident Response Team with live telemetry coordinates.
            </p>
            <div className="rounded-xl border border-border bg-card p-5 mt-4">
              <h4 className="font-semibold text-foreground">
                Statutory Grievance Redressal Officer
              </h4>
              <p className="text-xs text-muted-foreground mt-1">
                Designated in accordance with Section 5(1) of Information Technology (Intermediary
                Guidelines) Rules, 2021:
              </p>
              <div className="mt-3 space-y-1 text-xs">
                <p>
                  <strong>Name:</strong> Grievance Redressal Cell, Orange Taxi Limited
                </p>
                <p>
                  <strong>Email:</strong> grievance@orange-taxi.com
                </p>
                <p>
                  <strong>Helpline:</strong> +91 72940 73222
                </p>
                <p>
                  <strong>SLA:</strong> Grievances acknowledged within 24 hours; resolution within
                  15 business days.
                </p>
              </div>
            </div>
          </section>

          {/* Section 10 */}
          <section className="space-y-3">
            <h2 className="text-xl font-bold text-foreground">
              10. Governing Law and Jurisdiction
            </h2>
            <p className="text-muted-foreground">
              These Terms shall be interpreted, governed, and construed in accordance with the
              substantive laws of the Republic of India. Any disputes arising out of or in
              connection with these Terms or service usage shall be subject to the exclusive
              jurisdiction of the competent courts of New Delhi, India.
            </p>
          </section>
        </div>

        {/* Footer info box */}
        <div className="mt-16 rounded-2xl border border-primary/20 bg-primary/5 p-6 text-center">
          <p className="text-xs text-muted-foreground">
            Have questions regarding our terms or corporate service agreement? Contact our legal &
            compliance desk at{" "}
            <a href="mailto:support@orange-taxi.com" className="font-bold text-primary underline">
              support@orange-taxi.com
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
