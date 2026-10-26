import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Clock,
  CreditCard,
  Mail,
  Phone,
  RotateCcw,
  Wallet,
  Banknote,
} from "lucide-react";
import { usePricingSettings, cancellationPolicyText } from "@/lib/pricing";

export const Route = createFileRoute("/refunds")({
  head: () => ({
    meta: [
      { title: "Cancellation & Refund Policy — Orange Taxi Limited" },
      {
        name: "description",
        content:
          "How cancellation fees work and how to get a refund for a ride payment or fee from Orange Taxi.",
      },
    ],
  }),
  component: RefundsPage,
});

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/10 text-sm font-bold text-primary">
        {n}
      </span>
      <div>
        <p className="font-semibold text-foreground">{title}</p>
        <div className="text-sm text-muted-foreground">{children}</div>
      </div>
    </li>
  );
}

function RefundsPage() {
  const pricing = usePricingSettings();
  return (
    <div className="min-h-screen bg-background py-16 text-foreground md:py-24">
      <div className="section-shell max-w-4xl space-y-10">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to Home
        </Link>

        <header className="border-b border-border pb-8">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <RotateCcw className="size-4" /> Cancellations & Refunds
          </div>
          <h1 className="display-serif mt-3 text-4xl font-bold sm:text-5xl">
            Cancellation &amp; Refund Policy
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <strong>ORANGE TAXI LIMITED</strong> (CIN: U49224DL2026PLC461350)
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">1. Cancellation fee</h2>
          <p className="text-sm text-muted-foreground">{cancellationPolicyText(pricing)}</p>
          <p className="text-sm text-muted-foreground">
            The app and website show whether a fee applies before you confirm a cancellation. A
            cancellation fee is not charged straight away: it is added to your next ride and paid
            with that ride&apos;s fare.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">2. When you can get a refund</h2>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">
            <li>
              A cancellation fee was charged although the free-cancellation rules above applied.
            </li>
            <li>You were charged twice for the same ride, or charged more than the fare shown.</li>
            <li>You paid online and the ride was then cancelled or not completed.</li>
            <li>
              The chauffeur didn&apos;t arrive, or the ride had a serious service or safety problem.
            </li>
          </ul>
          <p className="text-sm text-muted-foreground">
            A completed ride charged at the fare shown when you booked is not refundable, except in
            the cases above.
          </p>
        </section>

        <section className="space-y-4">
          <h2 className="text-xl font-bold">3. How to ask for a refund</h2>
          <ol className="space-y-4">
            <Step n={1} title="Raise a refund request within 7 days of the ride">
              Use the{" "}
              <Link to="/support" search={{ type: "refund" }} className="text-primary underline">
                Support page
              </Link>{" "}
              (choose &quot;Refund Request&quot; and enter your ride reference, e.g. OT1A2B3C), the
              Help section in the app, or call +91 72940 73222.
            </Step>
            <Step n={2} title="We acknowledge within 48 hours">
              You get a docket number straight away. Our team checks the ride, the payment and the
              chauffeur&apos;s trip record.
            </Step>
            <Step n={3} title="Decision within 7 working days">
              We tell you whether the refund is approved, and how much, by phone or email.
            </Step>
            <Step n={4} title="Refund is paid">
              The money goes back the way you paid (see below). You can escalate to our Grievance
              Officer if you disagree with the decision.
            </Step>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-bold">4. Where the money goes</h2>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <CreditCard className="mb-2 size-5 text-primary" />
              <p className="font-semibold">UPI, card or QR payments</p>
              <p className="text-muted-foreground">
                Back to the same UPI account or card via Razorpay, usually within 5–7 working days
                of approval.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <Wallet className="mb-2 size-5 text-primary" />
              <p className="font-semibold">Orange Wallet</p>
              <p className="text-muted-foreground">
                Credited back to your Orange Wallet immediately after approval.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-4 text-sm">
              <Banknote className="mb-2 size-5 text-primary" />
              <p className="font-semibold">Cash paid to the chauffeur</p>
              <p className="text-muted-foreground">
                Paid to your UPI ID or as Orange Wallet credit, your choice, within 7 working days
                of approval.
              </p>
            </div>
          </div>
          <p className="text-sm text-muted-foreground">
            An unpaid cancellation fee that should not have been charged is simply removed from your
            account, so it is not added to your next ride.
          </p>
        </section>

        <section className="space-y-3 rounded-xl border border-border bg-card p-5 text-sm">
          <h2 className="text-lg font-bold">Contact</h2>
          <p className="flex items-center gap-2">
            <Phone className="size-4 text-primary" />
            <a href="tel:+917294073222" className="text-primary hover:underline">
              +91 72940 73222
            </a>
            <span className="text-muted-foreground">(24x7)</span>
          </p>
          <p className="flex items-center gap-2">
            <Mail className="size-4 text-primary" />
            <a href="mailto:support@orange-taxi.com" className="text-primary hover:underline">
              support@orange-taxi.com
            </a>
            <span className="text-muted-foreground">· billing@orange-taxi.com for invoices</span>
          </p>
          <p className="flex items-center gap-2">
            <Clock className="size-4 text-primary" />
            <span className="text-muted-foreground">
              Grievance Officer:{" "}
              <a href="mailto:grievance@orange-taxi.com" className="text-primary hover:underline">
                grievance@orange-taxi.com
              </a>{" "}
              (acknowledged within 48 hours, resolved within 30 days)
            </span>
          </p>
        </section>
      </div>
    </div>
  );
}
