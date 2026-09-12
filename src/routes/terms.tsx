// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Scale, ShieldAlert, Ban, CheckCircle2, Clock, FileCheck } from "lucide-react";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — Orange Taxi Limited" },
      { name: "description", content: "Terms of Service, Passenger Agreement, Cancellation Policy and Zero-Tolerance Rules of Orange Taxi Limited." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-screen py-16 md:py-24">
      <div className="section-shell max-w-4xl">
        <Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground mb-8">
          <ArrowLeft className="size-4" /> Back to Home
        </Link>

        {/* Header */}
        <div className="border-b border-border pb-8">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <Scale className="size-4" /> User Agreement & Operating Terms
          </div>
          <h1 className="display-serif mt-3 text-4xl md:text-5xl">Terms & Conditions</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <strong>ORANGE TAXI LIMITED</strong> (CIN: U49224DL2026PLC461350) · Last Updated: September 2026
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            These Terms & Conditions ("Terms", "Agreement") constitute a legally binding electronic agreement between you ("User", "Passenger", or "you") and <strong>Orange Taxi Limited</strong> ("Orange Taxi", "Company", "we", or "us"), governing your access to and use of our digital aggregator platform, web application, booking interfaces, and passenger electric transport services across Delhi NCR and India.
          </p>
        </div>

        {/* Highlight Badges */}
        <div className="my-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-xl border border-border bg-card p-5">
            <Clock className="size-5 text-primary" />
            <h3 className="mt-3 text-sm font-bold">Transparent Pricing</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Base fare, distance rate, platform fees, and statutory 5% GST explicitly itemised before you confirm.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <ShieldAlert className="size-5 text-primary" />
            <h3 className="mt-3 text-sm font-bold">Zero-Tolerance Safety</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Strict zero-tolerance policy on drugs, alcohol, and reckless driving under MV Aggregator Guidelines Clause 14.10.
            </p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <CheckCircle2 className="size-5 text-primary" />
            <h3 className="mt-3 text-sm font-bold">Reciprocal Fairness</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Fair cancellation terms complying with Consumer Protection (E-Commerce) Rules and statutory fee exemptions.
            </p>
          </div>
        </div>

        {/* Content Body */}
        <div className="space-y-10 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="text-xl font-bold text-foreground">1. Eligibility & Platform Registration</h2>
            <p className="mt-2 text-muted-foreground">
              By accessing our platform or creating an account, you represent and warrant that you are at least 18 years of age and legally competent to enter into a binding contract under the Indian Contract Act, 1872.
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>Account authentication is secured via direct Mobile Phone Number and One-Time Password (OTP) verification.</li>
              <li>You are solely responsible for maintaining the confidentiality of your credentials and all activities conducted under your verified phone number.</li>
              <li>You agree to notify us immediately at <a href="mailto:support@orange-taxi.com" className="text-primary underline">support@orange-taxi.com</a> of any unauthorised access or security breach.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">2. Booking, Fares & GST Invoicing</h2>
            <p className="mt-2 text-muted-foreground">
              Orange Taxi Limited operates as a licensed Motor Vehicle Aggregator. Fares for journeys are calculated transparently prior to ride commencement:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li><strong className="text-foreground">Fare Structure:</strong> Fares are computed based on Vehicle Category Base Fare + per-kilometre travelled distance + statutory Platform Service Fee.</li>
              <li><strong className="text-foreground">GST Compliance:</strong> In compliance with Notification No. 11/2017-Central Tax (Rate) and Section 9(5) of the CGST Act, 2017, all passenger transportation services carry 5% GST, explicitly itemised on your digital Tax Invoice.</li>
              <li><strong className="text-foreground">Payment Modes:</strong> Passengers may settle ride balances via UPI, digital payment links, credit/debit cards, or designated cash settlement at trip completion.</li>
              <li><strong className="text-foreground">Tax Invoice Delivery:</strong> A valid tax invoice containing our CIN, GSTIN, vehicle registration number, and route details is generated instantly and available in your customer profile.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">3. Ride Cancellation & Fee-Exempt Reasons</h2>
            <p className="mt-2 text-muted-foreground">
              Under Clause 18 of the Motor Vehicle Aggregator Guidelines, 2025, and the Consumer Protection (E-Commerce) Rules, 2020:
            </p>
            <div className="mt-3 rounded-lg border border-border bg-muted/40 p-4">
              <h4 className="font-semibold text-foreground text-xs uppercase tracking-wider">Fee-Exempt Cancellation Instances (₹0 Cancellation Fee)</h4>
              <p className="mt-1 text-xs text-muted-foreground">A cancellation fee will <strong>never</strong> be charged to a passenger in the following circumstances:</p>
              <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                <li>If you cancel within <strong>3 minutes</strong> of the ride request being accepted by a driver.</li>
                <li>If the assigned driver fails to arrive at the specified pickup pin within <strong>5 minutes past the estimated arrival time (ETA)</strong>.</li>
                <li>If the vehicle licence plate or driver identity at pickup does not match the details shown in your Orange Taxi interface.</li>
                <li>If the driver demands extra offline cash, refuses to switch on air conditioning, or requests an off-app booking.</li>
                <li>If the driver cancels the trip unilaterally without mutual passenger agreement.</li>
              </ul>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              <strong className="text-foreground">Reciprocal Protection:</strong> In compliance with Rule 6 of the Consumer Protection (E-Commerce) Rules, no cancellation charge will be levied on the passenger unless Orange Taxi Limited provides equivalent compensation/credit to the passenger when a cancellation is initiated unilaterally by the platform or driver without reasonable justification.
            </p>
          </section>

          <section className="rounded-xl border border-destructive/30 bg-destructive/5 p-6">
            <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Ban className="size-5 text-destructive" /> 4. Zero-Tolerance Drug & Alcohol Policy (Clause 14.10)
            </h2>
            <p className="mt-2 text-xs text-muted-foreground leading-relaxed">
              Orange Taxi Limited strictly enforces a <strong>Zero-Tolerance Intoxication Policy</strong> for all onboarded driver partners operating on our network.
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              <li>No driver may operate an Orange Taxi vehicle under the influence of alcohol, narcotics, prescription drugs that impair motor reflexes, or intoxicating substances.</li>
              <li>Drivers undergo mandatory background verification, medical screening, and zero-tolerance compliance training before taking active trips.</li>
              <li>
                <strong>Immediate Reporting Procedure:</strong> If you suspect your driver is driving recklessly or is under the influence, <strong>terminate the ride immediately in a safe location</strong>, trigger the in-app SOS / Guardian emergency call, and notify our emergency desk at <a href="tel:+911140007000" className="text-primary font-bold">+91 11 4000 7000</a> or <a href="mailto:grievance@orange-taxi.com" className="text-primary underline">grievance@orange-taxi.com</a>.
              </li>
              <li>The driver will be suspended from dispatch immediately pending an inquiry completed within 3 working days.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">5. Prohibited Content & Platform Conduct</h2>
            <p className="mt-2 text-muted-foreground">
              In accordance with Rule 3(1)(b) of the Information Technology (Intermediary Guidelines and Digital Media Ethics Code) Rules, 2021, users are strictly prohibited from hosting, displaying, uploading, modifying, publishing, transmitting, or sharing any content or information that:
            </p>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-muted-foreground">
              <li>Belongs to another person and to which the user does not have any legal right;</li>
              <li>Is defamatory, obscene, pornographic, paedophilic, invasive of another's privacy, insulting or harassing on the basis of gender, or racially or ethnically objectionable;</li>
              <li>Infringes any patent, trademark, copyright, or other proprietary rights;</li>
              <li>Deceives or misleads the addressee about the origin of the message or impersonates another person;</li>
              <li>Contains software viruses or any other computer code designed to interrupt, destroy, or limit the functionality of the platform;</li>
              <li>Threatens the unity, integrity, defence, security, or sovereignty of India, friendly relations with foreign States, or public order.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">6. Passenger Cabin Etiquette & Safety</h2>
            <p className="mt-2 text-muted-foreground">
              Orange Taxi vehicles are 100% electric, spotless, and dedicated to delivering a refined journey. Passengers agree to:
            </p>
            <ul className="mt-3 list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Refrain from smoking, vaping, or consuming alcoholic beverages inside the vehicle.</li>
              <li>Wear seatbelts at all times during the transit in compliance with the Motor Vehicles Act, 1988.</li>
              <li>Treat driver partners with dignity and professional courtesy. Verbal abuse, physical aggression, or harassment will result in permanent account termination and criminal prosecution.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-bold text-foreground">7. Limitation of Liability & Governing Law</h2>
            <p className="mt-2 text-muted-foreground">
              These Terms shall be governed by and construed in accordance with the laws of the Republic of India. Any legal action, dispute, or proceeding arising out of or relating to these Terms or your use of the Orange Taxi platform shall be subject to the exclusive jurisdiction of the competent courts situated in <strong>New Delhi, India</strong>.
            </p>
          </section>

          <section className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-bold text-foreground">Need Assistance or Legal Clarifications?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              For corporate or legal queries, write to our Legal Secretariat at <a href="mailto:support@orange-taxi.com" className="text-primary underline">support@orange-taxi.com</a> or visit our corporate office at S-210, 2nd Floor, Panchshila Park, South Malviya Nagar, New Delhi 110017.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}