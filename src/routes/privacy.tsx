import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Shield,
  Lock,
  UserCheck,
  FileText,
  MapPin,
  CreditCard,
  Server,
  AlertTriangle,
  Mail,
  Building,
  CheckCircle2,
  Trash2,
  PhoneCall,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy & Data Notice — Orange Taxi" },
      {
        name: "description",
        content:
          "Comprehensive privacy policy and data protection disclosure for Orange Taxi passengers, chauffeurs, and partners in compliance with the Digital Personal Data Protection (DPDP) Act, 2023.",
      },
    ],
  }),
  component: PrivacyPolicy,
});

export function PrivacyPolicy() {
  return (
    <div className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 text-foreground">
      {/* Header Badge & Title */}
      <div className="mb-10 text-center sm:text-left border-b border-border pb-8">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary mb-4">
          <Shield className="size-3.5" />
          DPDP Act, 2023 & MV Aggregator Compliance
        </div>
        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
          Privacy Policy & Data Protection Notice
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Effective Date: October 15, 2026 &bull; Version 2.4 &bull; Orange Taxi Electric Mobility
          Solutions Pvt. Ltd.
        </p>
      </div>

      {/* Quick Nav / Summary Card */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm mb-10">
        <h2 className="text-base font-bold flex items-center gap-2 mb-3">
          <Lock className="size-4 text-primary" /> Key Privacy Commitments
        </h2>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-muted-foreground leading-relaxed">
          <li className="flex items-start gap-2">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              <strong>No selling of personal data:</strong> We never monetize, sell, or rent your
              personal, ride, or location data to third-party ad brokers.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              <strong>Zero card storage:</strong> Payments are processed via PCI-DSS compliant
              aggregators (Razorpay); we never store raw credit/debit card numbers.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              <strong>Self-Service Erasure:</strong> Customers can irreversibly delete their account
              directly via their Profile dashboard.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <CheckCircle2 className="size-4 text-emerald-500 shrink-0 mt-0.5" />
            <span>
              <strong>Continuous Telemetry Scoping:</strong> Passenger GPS is captured only while
              requesting and completing rides; driver telemetry is active only during online shift
              duty.
            </span>
          </li>
        </ul>
      </div>

      {/* Full Policy Content */}
      <div className="space-y-10 text-sm leading-relaxed text-foreground">
        {/* Section 1 */}
        <section id="scope">
          <h2 className="text-xl font-bold text-foreground border-b border-border/60 pb-2 mb-4 flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              1
            </span>
            Scope & Governance
          </h2>
          <p className="text-muted-foreground mb-3">
            This Privacy Notice governs the collection, processing, transfer, storage, and erasure
            of personal data by <strong>Orange Taxi Electric Mobility Solutions Pvt. Ltd.</strong>{" "}
            (&ldquo;Orange Taxi&rdquo;, &ldquo;we&rdquo;, &ldquo;us&rdquo;, or &ldquo;our&rdquo;)
            through our website (
            <a href="https://orange-taxi.com" className="text-primary underline">
              orange-taxi.com
            </a>
            ), progressive web application, and mobile chauffeur / passenger applications.
          </p>
          <p className="text-muted-foreground">
            This policy is formulated in strict accordance with the{" "}
            <strong>Digital Personal Data Protection Act, 2023 (DPDP Act)</strong>, the{" "}
            <strong>
              Information Technology (Reasonable Security Practices and Procedures and Sensitive
              Personal Data or Information) Rules, 2011
            </strong>
            , and the <strong>Motor Vehicle Aggregator Guidelines, 2020</strong> issued by the
            Ministry of Road Transport and Highways (MoRTH), Government of India.
          </p>
        </section>

        {/* Section 2 */}
        <section id="data-collected">
          <h2 className="text-xl font-bold text-foreground border-b border-border/60 pb-2 mb-4 flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              2
            </span>
            Categories of Personal Data Collected
          </h2>
          <p className="text-muted-foreground mb-4">
            We collect only the minimum personal data strictly necessary to fulfill our urban
            electric transportation service:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5 mb-2">
                <UserCheck className="size-4 text-primary" /> Passenger & Rider Data
              </h3>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-muted-foreground">
                <li>
                  <strong>Identity & Account:</strong> Full name, verified mobile phone number,
                  email address, password hash.
                </li>
                <li>
                  <strong>Journey Coordinates:</strong> Pickup address, destination coordinates,
                  pillar/terminal identifiers, and route telemetry during trip progression.
                </li>
                <li>
                  <strong>Preferences & In-Ride Notes:</strong> Cabin climate request, quiet ride
                  preference, and customer feedback/ratings.
                </li>
                <li>
                  <strong>Transaction Records:</strong> Razorpay payment transaction IDs, fare
                  breakdowns, payment mode (Cash/UPI/Card), and GST tax invoices.
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5 mb-2">
                <FileText className="size-4 text-primary" /> Chauffeur & Driver Partner Data
              </h3>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-muted-foreground">
                <li>
                  <strong>KYC Documents:</strong> Commercial driving licence (DL) copy & number,
                  Aadhaar number (redacted), and passport-style portrait photograph.
                </li>
                <li>
                  <strong>Vehicle Telemetry:</strong> Vehicle registration number plate, EV chassis
                  number (VIN), make/model, and continuous live GPS coordinates while in
                  &ldquo;Online&rdquo; status.
                </li>
                <li>
                  <strong>Financial & Earnings:</strong> Daily trip settlement counts, commission
                  ledger history, and bank account / UPI details for payout settlements.
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5 mb-2">
                <Building className="size-4 text-primary" /> Corporate & Enterprise Enquiries
              </h3>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-muted-foreground">
                <li>
                  Corporate company name, primary contact person, corporate email, mobile number,
                  fleet requirements, and billing address.
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-border bg-card p-4">
              <h3 className="font-semibold text-foreground text-sm flex items-center gap-1.5 mb-2">
                <Server className="size-4 text-primary" /> Device & Technical Telemetry
              </h3>
              <ul className="list-disc list-inside space-y-1.5 text-xs text-muted-foreground">
                <li>
                  IP address, browser user-agent, operating system version, push notification tokens
                  (for dispatch alerts), and security audit logs.
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* Section 3 */}
        <section id="purposes">
          <h2 className="text-xl font-bold text-foreground border-b border-border/60 pb-2 mb-4 flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              3
            </span>
            Purposes of Processing & Lawful Grounds
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border border-border rounded-lg">
              <thead className="bg-muted text-foreground font-semibold">
                <tr>
                  <th className="p-3 border-b border-border">Data Category</th>
                  <th className="p-3 border-b border-border">Processing Purpose</th>
                  <th className="p-3 border-b border-border">Lawful Basis (DPDP Act)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                <tr>
                  <td className="p-3 font-medium text-foreground">Phone, Name & Email</td>
                  <td className="p-3">
                    Account authentication, trip status SMS/Push alerts, and GST tax invoice
                    delivery.
                  </td>
                  <td className="p-3">Performance of Service Contract &amp; Consent</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-foreground">GPS Location (Rider & Driver)</td>
                  <td className="p-3">
                    Real-time driver dispatch, route ETA calculation, SOS emergency tracking, and
                    live ride map.
                  </td>
                  <td className="p-3">Performance of Contract &amp; Safety Compliance</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-foreground">DL & Aadhaar Documentation</td>
                  <td className="p-3">
                    Driver vetting, criminal background compliance, and verification under Motor
                    Vehicle Rules.
                  </td>
                  <td className="p-3">Legal Obligation (MV Aggregator Guidelines 2020)</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-foreground">Booking & Fare Records</td>
                  <td className="p-3">
                    Commercial billing, driver fare reconciliation, dispute resolution, and GST
                    accounting.
                  </td>
                  <td className="p-3">Statutory Legal Obligation (GST Act, 2017)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Section 4 */}
        <section id="processors">
          <h2 className="text-xl font-bold text-foreground border-b border-border/60 pb-2 mb-4 flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              4
            </span>
            Data Recipients & Third-Party Processors
          </h2>
          <p className="text-muted-foreground mb-3">
            We contractually bind all sub-processors to process data solely on our documented
            instructions under equivalent confidentiality and data protection standards:
          </p>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[140px]">
                &bull; Supabase Inc.:
              </span>
              <span>
                Encrypted cloud database, user authentication engine, and row-level access control.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[140px]">
                &bull; Razorpay Software Ltd.:
              </span>
              <span>
                RBI-authorized payment aggregator handling UPI, credit/debit card gateway, and
                digital payment tokens.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[140px]">
                &bull; Google Maps Platform:
              </span>
              <span>
                Reverse geocoding, route navigation, and distance computation. User addresses are
                queried without attaching passenger identities.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[140px]">
                &bull; Resend Inc.:
              </span>
              <span>
                Transactional email dispatch for GST invoices and password recovery notifications.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[140px]">
                &bull; Cloudflare Inc.:
              </span>
              <span>
                Content delivery network (CDN), DDoS mitigation, SSL/TLS edge encryption, and WAF
                firewall.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold text-foreground min-w-[140px]">
                &bull; Law Enforcement:
              </span>
              <span>
                Data is shared strictly upon receipt of a lawful order or warrant issued by a
                competent judicial or law enforcement authority under Indian law.
              </span>
            </li>
          </ul>
        </section>

        {/* Section 5 */}
        <section id="retention">
          <h2 className="text-xl font-bold text-foreground border-b border-border/60 pb-2 mb-4 flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              5
            </span>
            Data Retention Periods & Statutory Exceptions
          </h2>
          <p className="text-muted-foreground mb-3">
            We retain personal data only for as long as necessary to fulfill the operational purpose
            or comply with statutory retention mandates:
          </p>
          <ul className="space-y-2 text-xs text-muted-foreground">
            <li>
              <strong>Active Account Profiles:</strong> Retained until the user requests account
              deletion.
            </li>
            <li>
              <strong>GST Tax Invoices &amp; Accounting Ledgers:</strong> Retained for{" "}
              <strong>72 months (6 years)</strong> following the end of the relevant financial year
              as mandated under Section 36 of the Central Goods and Services Tax (CGST) Act, 2017.
            </li>
            <li>
              <strong>Ride History &amp; GPS Telemetry:</strong> Retained for{" "}
              <strong>12 months</strong> as mandated by the Motor Vehicle Aggregator Guidelines 2020
              for safety investigation and passenger complaint resolution.
            </li>
            <li>
              <strong>Rejected Driver KYC Documents:</strong> Erased within <strong>30 days</strong>{" "}
              of application rejection.
            </li>
            <li>
              <strong>Security Audit Logs:</strong> Retained for <strong>180 days</strong> to
              facilitate incident response and cyber security forensics.
            </li>
          </ul>
        </section>

        {/* Section 6 */}
        <section id="rights">
          <h2 className="text-xl font-bold text-foreground border-b border-border/60 pb-2 mb-4 flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              6
            </span>
            Your Rights as a Data Principal
          </h2>
          <p className="text-muted-foreground mb-3">
            Under Chapter III of the DPDP Act, 2023, you enjoy the following enforceable rights:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-3 rounded-lg border border-border bg-card">
              <h4 className="font-semibold text-foreground mb-1">Right to Access Summary</h4>
              <p className="text-muted-foreground">
                Request a summary of your personal data being processed and identities of all data
                processors who have received it.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card">
              <h4 className="font-semibold text-foreground mb-1">
                Right to Correction &amp; Update
              </h4>
              <p className="text-muted-foreground">
                Rectify inaccurate, incomplete, or outdated personal information directly via your
                Profile page or through support.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card">
              <h4 className="font-semibold text-foreground mb-1">
                Right to Erasure (&ldquo;Delete My Account&rdquo;)
              </h4>
              <p className="text-muted-foreground">
                Request irreversible deletion of your profile, phone, email, and non-statutory data.
                Available directly under Profile Settings.
              </p>
            </div>
            <div className="p-3 rounded-lg border border-border bg-card">
              <h4 className="font-semibold text-foreground mb-1">Right of Grievance Redressal</h4>
              <p className="text-muted-foreground">
                Seek prompt redressal from our designated Data Protection Officer, and escalate to
                the Data Protection Board of India if unresolved.
              </p>
            </div>
          </div>

          <div className="mt-4 p-4 rounded-lg bg-primary/5 border border-primary/20 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-xs text-foreground">
                Ready to manage your account or delete your personal data?
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                You can delete your account and download ride receipts directly from your profile.
              </p>
            </div>
            <Button asChild size="sm" variant="outline" className="shrink-0 text-xs gap-1.5">
              <Link to="/profile">
                <UserCheck className="size-3.5" />
                Go to Profile Dashboard
              </Link>
            </Button>
          </div>
        </section>

        {/* Section 7 */}
        <section id="grievance">
          <h2 className="text-xl font-bold text-foreground border-b border-border/60 pb-2 mb-4 flex items-center gap-2">
            <span className="grid size-6 place-items-center rounded-full bg-primary/10 text-primary text-xs font-bold">
              7
            </span>
            Grievance Officer & Contact Information
          </h2>
          <p className="text-muted-foreground mb-4">
            If you have any questions, concerns, grievances, or requests regarding this Privacy
            Policy or your personal data, please contact our designated Grievance &amp; Privacy
            Officer:
          </p>

          <div className="rounded-xl border border-border bg-card p-5 space-y-3 text-xs">
            <div className="flex items-center gap-2">
              <UserCheck className="size-4 text-primary" />
              <span className="font-bold text-foreground">Contact:</span>
              <span className="text-muted-foreground">
                Grievance &amp; Data Protection Officer, Orange Taxi Limited
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-primary" />
              <span className="font-bold text-foreground">Official Email:</span>
              <a href="mailto:privacy@orange-taxi.com" className="text-primary hover:underline">
                privacy@orange-taxi.com
              </a>
              <span className="text-muted-foreground">/</span>
              <a href="mailto:grievance@orange-taxi.com" className="text-primary hover:underline">
                grievance@orange-taxi.com
              </a>
            </div>
            <div className="flex items-center gap-2">
              <PhoneCall className="size-4 text-primary" />
              <span className="font-bold text-foreground">Phone:</span>
              <a href="tel:+917294073222" className="text-primary hover:underline">
                +91 72940 73222
              </a>
            </div>
            <div className="flex items-center gap-2">
              <Building className="size-4 text-primary" />
              <span className="font-bold text-foreground">Registered Office:</span>
              <span className="text-muted-foreground">
                S-210, 2nd Floor, Panchshila Park, South Malviya Nagar, New Delhi 110017, India
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <span className="font-bold text-foreground">Turnaround Time:</span>
              <span className="text-muted-foreground">
                Acknowledgment within <strong>48 hours</strong>; complete inquiry &amp; resolution
                within <strong>30 days</strong>.
              </span>
            </div>
          </div>

          <p className="mt-4 text-xs text-muted-foreground">
            If you are not satisfied with the resolution provided by our Grievance Officer, you have
            the right to register a complaint with the{" "}
            <strong>Data Protection Board of India (DPBI)</strong> in accordance with Section 18 of
            the DPDP Act, 2023.
          </p>
        </section>
      </div>
    </div>
  );
}
