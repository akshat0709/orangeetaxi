// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Shield, Lock, Eye, CheckCircle2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Orange Taxi Limited" },
      { name: "description", content: "Privacy Policy and Data Protection practices of Orange Taxi Limited under Information Technology Act, 2000 and DPDP Act, 2023." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <div className="min-h-screen py-16 md:py-24">
      <div className="section-shell max-w-4xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="size-4" /> Back to Home
        </Link>

        {/* Header */}
        <div className="border-b border-border pb-8">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <Shield className="size-4" /> Legal & Data Protection
          </div>
          <h1 className="display-serif mt-3 text-4xl md:text-5xl">Privacy Policy</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <strong>ORANGE TAXI LIMITED</strong> (CIN: U49224DL2026PLC461350) · Last Updated: September 2026
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            This Privacy Policy explains how Orange Taxi Limited ("Orange Taxi", "we", "our", or "us"), a Public Limited Company incorporated under the Companies Act, 2013, collects, stores, processes, and protects your personal data when you access or use our website and ride-hailing services.
          </p>
        </div>

        {/* Core Principles */}
        <div className="my-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <Lock className="size-5 text-primary" />
            <h3 className="mt-3 text-sm font-bold">Purpose Limitation</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              We only collect data strictly necessary to dispatch your electric ride, safeguard your trip, and generate tax invoices.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <Eye className="size-5 text-primary" />
            <h3 className="mt-3 text-sm font-bold">Never Sold</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Your personal data, live location, and ride history are never sold to advertisers or third-party brokers.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <CheckCircle2 className="size-5 text-primary" />
            <h3 className="mt-3 text-sm font-bold">DPDP & IT Act Ready</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Constructed in strict accordance with the Information Technology Act, 2000 and the Digital Personal Data Protection Act, 2023.
            </p>
          </div>
        </div>

        {/* Policy Sections */}
        <div className="space-y-10 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-xl font-bold text-foreground">1. Itemised Personal Data We Collect</h2>
            <p className="mt-2 text-muted-foreground">
              Under Rule 3 of the DPDP Rules and the SPDI Rules 2011, we disclose the exact categories of data collected:
            </p>
            <ul className="mt-3 list-disc space-y-2 pl-5 text-muted-foreground">
              <li>
                <strong className="text-foreground">Contact & Identity:</strong> Full name, telephone number (verified via Mobile OTP), and email address.
              </li>
              <li>
                <strong className="text-foreground">Precise Geolocation Data:</strong> Live GPS coordinates, pickup location, drop-off destination, and route trajectory gathered during active journey booking to calculate fares and track your vehicle in real-time.
              </li>
              <li>
                <strong className="text-foreground">Driver Partner Application Data:</strong> For driving candidates, driving licence number, experience history, vehicle ownership details, police verification records, and telephone number.
              </li>
              <li>
                <strong className="text-foreground">Emergency & Guardian Contacts:</strong> Name and phone number of a trusted guardian saved locally or in-app for automated safety sharing and SOS escalation.
              </li>
              <li>
                <strong className="text-foreground">Financial & Invoicing Metadata:</strong> Ride fare breakdowns, platform fees, CGST/SGST/IGST tax computations, and payment settlement mode (Cash / UPI / Card). We do not store full credit/debit card numbers.
              </li>
              <li>
                <strong className="text-foreground">Device & Telemetry Data:</strong> IP address, browser type, operating system, and crash diagnostics to protect platform security and prevent fraudulent bookings.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">2. Purpose of Processing & Legal Basis</h2>
            <p className="mt-2 text-muted-foreground">Your data is processed exclusively for the following lawful purposes:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>To allocate, navigate, and dispatch an assigned driver and electric vehicle to your pickup pin.</li>
              <li>To provide you and your trusted guardian with live ride tracking and ETA monitoring.</li>
              <li>To verify driver identity at trip commencement via our 4-digit Ride OTP mechanism.</li>
              <li>To calculate statutory GST and generate formal Tax Invoices compliant with Section 31 of the CGST Act, 2017.</li>
              <li>To investigate lost and found inquiries and resolve passenger grievances within statutory timelines.</li>
              <li>To comply with orders of law enforcement agencies and statutory aggregator regulations issued by the Ministry of Road Transport and Highways (MoRTH) and State Transport Departments.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">3. Data Sharing & Third-Party Processors</h2>
            <p className="mt-2 text-muted-foreground">
              We do not sell personal data. We only share necessary data with authorized processors bound by confidentiality agreements:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li><strong className="text-foreground">Onboarded Drivers:</strong> During an active ride, the driver receives your pickup location, drop location, and passenger name. Your personal contact number is protected and visible only for legitimate coordination and lost-item recovery for up to 7 days post-trip.</li>
              <li><strong className="text-foreground">Infrastructure & Cloud Hosting:</strong> Secure database and authentication services provided via ISO/IEC 27001 certified cloud environments (Supabase, AWS).</li>
              <li><strong className="text-foreground">Map & Routing Providers:</strong> Google Maps Platform APIs for geocoding, turn-by-turn routing, and live distance calculations.</li>
              <li><strong className="text-foreground">Regulatory Authorities:</strong> Where mandated by a court order or written request under Section 79 of the IT Act, 2000 for lawful investigations.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">4. Data Retention & Erasure</h2>
            <p className="mt-2 text-muted-foreground">
              We retain personal data only for as long as necessary to fulfill the operational purpose or meet legal obligations:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li><strong className="text-foreground">Ride & Invoicing Records:</strong> Preserved for the statutory audit period required under Indian taxation and Motor Vehicle laws.</li>
              <li><strong className="text-foreground">User Registration Records:</strong> Retained for 180 days following account cancellation or data erasure request, in compliance with the Information Technology (Intermediary Guidelines) Rules, 2021.</li>
              <li><strong className="text-foreground">Live GPS Tracking:</strong> Live location streaming terminates automatically upon trip completion.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">5. Your Statutory Rights as a Data Principal</h2>
            <p className="mt-2 text-muted-foreground">Under the DPDP Act, 2023, you enjoy the following enforceable rights:</p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li><strong>Right to Access:</strong> Request a summary of personal data held about you and processing activities undertaken.</li>
              <li><strong>Right to Correction & Erasure:</strong> Request updating of inaccurate information or deletion of unnecessary personal data.</li>
              <li><strong>Right to Withdraw Consent:</strong> You may withdraw consent for marketing or non-essential features at any time.</li>
              <li><strong>Right of Grievance Redressal:</strong> Register complaints directly with our appointed Grievance Officer.</li>
              <li><strong>Right to Nominate:</strong> Designate a nominee to exercise data rights in the event of death or incapacity.</li>
            </ul>
          </section>

          <section className="rounded-xl border border-primary/30 bg-primary/5 p-6">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <AlertCircle className="size-5 text-primary" /> 6. Grievance Officer & Data Protection Officer Contact
            </h2>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              In accordance with Section 5(9) of the Information Technology (Intermediary Guidelines) Rules, 2021, and the Motor Vehicle Aggregator Guidelines, 2025, the contact details of our appointed Grievance Officer are:
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 text-xs">
              <div>
                <p className="font-semibold text-foreground">Grievance Officer:</p>
                <p className="text-muted-foreground">Nodal Grievance & Compliance Officer</p>
                <p className="text-muted-foreground">ORANGE TAXI LIMITED</p>
              </div>
              <div>
                <p className="font-semibold text-foreground">Direct Email:</p>
                <p><a href="mailto:grievance@orange-taxi.com" className="text-primary underline">grievance@orange-taxi.com</a></p>
                <p className="text-muted-foreground">support@orange-taxi.com</p>
              </div>
              <div className="sm:col-span-2 mt-1">
                <p className="font-semibold text-foreground">Postal Address:</p>
                <p className="text-muted-foreground">
                  Orange Taxi Limited, S-210, 2nd Floor, Panchshila Park, South Malviya Nagar, New Delhi 110017, India
                </p>
                <p className="text-muted-foreground mt-1">
                  <strong>Statutory SLA:</strong> Acknowledgement within 24 hours · Final resolution within 15 working days.
                </p>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              If your grievance is not redressed within the statutory timeline, you may appeal to the <strong>Data Protection Board of India (DPBI)</strong> or the designated Appellate Tribunal.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}