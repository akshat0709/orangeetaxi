import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowLeft,
  Headphones,
  Phone,
  Mail,
  Clock,
  AlertTriangle,
  ShieldCheck,
  HelpCircle,
  MapPin,
  Send,
  Receipt,
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/support")({
  head: () => ({
    meta: [
      { title: "Customer Support & Grievance Redressal — Orange Taxi Limited" },
      {
        name: "description",
        content:
          "24x7 Customer Care, Grievance Officer details, SLA matrix, and lost property assistance for Orange Taxi Limited.",
      },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  const [complaintType, setComplaintType] = useState("general");
  const [reference, setReference] = useState("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [docketNumber, setDocketNumber] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !phone.trim() || !message.trim()) {
      toast.error("Please fill in your name, contact phone, and complaint details.");
      return;
    }

    setSubmitting(true);
    try {
      const userRes = await supabase.auth.getUser();
      const userId = userRes.data?.user?.id || null;
      const genDocket = `OG-TKT-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

      const { error } = await supabase.from("support_tickets").insert({
        docket_number: genDocket,
        user_id: userId,
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim(),
        complaint_type: complaintType,
        booking_reference: reference.trim() || null,
        message: message.trim(),
        status: "open",
      });

      if (error) {
        console.error("Support ticket registration error:", error);
        toast.error("Could not register grievance. Please call our 24x7 helpline or try again.");
        setSubmitting(false);
        return;
      }

      setDocketNumber(genDocket);
      setSubmitted(true);
      toast.success("Grievance docket created. Acknowledged under statutory SLA.");
    } catch (err: any) {
      console.error("Support submission error:", err);
      toast.error("An unexpected error occurred while lodging ticket.");
    } finally {
      setSubmitting(false);
    }
  }

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
            <Headphones className="size-4" /> 24x7 Customer Care & Redressal
          </div>
          <h1 className="display-serif mt-3 text-4xl md:text-5xl">Support & Grievance Desk</h1>
          <p className="mt-3 text-sm text-muted-foreground">
            <strong>ORANGE TAXI LIMITED</strong> (CIN: U49224DL2026PLC461350)
          </p>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
            Dedicated human support for passengers and driver partners. In compliance with the
            Consumer Protection (E-Commerce) Rules, 2020, the Motor Vehicle Aggregator Guidelines,
            2025, and the Information Technology Rules, 2021, all complaints are tracked with
            statutory time-bound resolution SLAs.
          </p>
        </div>

        {/* Contact Channels Grid */}
        <div className="my-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <Phone className="size-5 text-primary" />
            <h3 className="mt-3 text-base font-bold">24x7 Call Centre</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Bilingual phone assistance (English & Hindi) for live trips and urgent assistance.
            </p>
            <p className="mt-4 font-mono text-sm font-bold text-primary">
              <a href="tel:+917294073222" className="hover:underline">
                +91 72940 73222
              </a>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Toll-free / Local STD rates apply
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <Mail className="size-5 text-primary" />
            <h3 className="mt-3 text-base font-bold">Customer Care</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Trip queries, rider support, and bookings assistance.
            </p>
            <div className="mt-4 space-y-1 text-xs">
              <p className="font-mono font-bold text-primary">
                <a href="mailto:support@orange-taxi.com" className="hover:underline">
                  support@orange-taxi.com
                </a>
              </p>
              <p className="font-mono text-muted-foreground">
                <a href="mailto:bookings@orange-taxi.com" className="hover:underline">
                  bookings@orange-taxi.com
                </a>
              </p>
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">Average response under 2 hours</p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <Receipt className="size-5 text-primary" />
            <h3 className="mt-3 text-base font-bold">Billing & Invoices</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              GST tax invoices, ride receipts, fare clarifications, and refunds.
            </p>
            <p className="mt-4 font-mono text-sm font-bold text-primary">
              <a href="mailto:billing@orange-taxi.com" className="hover:underline">
                billing@orange-taxi.com
              </a>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Official GST receipts on demand
            </p>
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/5 p-6">
            <ShieldCheck className="size-5 text-primary" />
            <h3 className="mt-3 text-base font-bold">Grievance Officer</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Appointed nodal officer under IT Rules 2021 & MV Aggregator norms.
            </p>
            <p className="mt-4 font-mono text-sm font-bold text-primary">
              <a href="mailto:grievance@orange-taxi.com" className="hover:underline">
                grievance@orange-taxi.com
              </a>
            </p>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              Formal ticket acknowledgement in 24h
            </p>
          </div>
        </div>

        {/* Statutory SLA Matrix (Section 8 of CA Note) */}
        <section className="my-10 rounded-2xl border border-border bg-card p-6 md:p-8">
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              Statutory Grievance Redressal Timelines (SLA Matrix)
            </h2>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Our grievance mechanism strictly adheres to the fastest applicable statutory benchmarks
            under Indian law:
          </p>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-border bg-muted/50 text-foreground font-semibold">
                  <th className="p-3">Category of Complaint</th>
                  <th className="p-3">Governing Legal Regime</th>
                  <th className="p-3">Mandatory Acknowledgment</th>
                  <th className="p-3">Statutory Resolution Window</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border text-muted-foreground">
                <tr>
                  <td className="p-3 font-medium text-foreground">
                    Content, Privacy & IT Intermediary Disputes
                  </td>
                  <td className="p-3">Information Technology Rules, 2021</td>
                  <td className="p-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                    Within 24 Hours
                  </td>
                  <td className="p-3 font-semibold text-foreground">Within 15 Working Days</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-foreground">
                    Driver Conduct, Safety & Vehicle Violations
                  </td>
                  <td className="p-3">MV Aggregator Guidelines, 2025</td>
                  <td className="p-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                    Immediate (24x7)
                  </td>
                  <td className="p-3 font-semibold text-foreground">
                    3 Days Inquiry before action
                  </td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-foreground">
                    Billing, Fares, GST & Consumer Service
                  </td>
                  <td className="p-3">Consumer Protection (E-Commerce) Rules</td>
                  <td className="p-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                    Within 48 Hours
                  </td>
                  <td className="p-3 font-semibold text-foreground">Within 30 Calendar Days</td>
                </tr>
                <tr>
                  <td className="p-3 font-medium text-foreground">
                    Impersonation or Non-Consensual Imagery
                  </td>
                  <td className="p-3">Rule 3(2)(b) IT Rules, 2021</td>
                  <td className="p-3 text-emerald-600 dark:text-emerald-400 font-semibold">
                    Immediate
                  </td>
                  <td className="p-3 text-rose-600 dark:text-rose-400 font-semibold">
                    Takedown within 24 Hours
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* Lodge a Grievance Form */}
        <div className="grid gap-8 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-2xl border border-border bg-card p-6 md:p-8">
            <h3 className="text-xl font-bold">Lodge a Formal Grievance</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Submit your dispute or issue directly to the Grievance Redressal Desk. You will
              receive an official docket tracking number.
            </p>

            {submitted ? (
              <div className="mt-6 rounded-xl border border-primary/30 bg-primary/10 p-6 text-center">
                <ShieldCheck className="mx-auto size-12 text-primary" />
                <h4 className="mt-3 text-lg font-bold text-foreground">
                  Grievance Ticket Generated
                </h4>
                <p className="mt-1 text-xs text-muted-foreground">
                  Your ticket ref is{" "}
                  <strong className="text-foreground">{docketNumber || "OG-TKT-RECORDED"}</strong>.
                  Our Grievance Officer will review your submission and acknowledge within 24 hours.
                </p>
                <Button
                  className="mt-5"
                  onClick={() => {
                    setSubmitted(false);
                    setMessage("");
                    setReference("");
                  }}
                  variant="outline"
                  size="sm"
                >
                  Submit Another Inquiry
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="c-name" className="text-xs">
                      Your Full Name
                    </Label>
                    <Input
                      id="c-name"
                      placeholder="Akshat Gupta"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="mt-1.5 text-xs"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor="c-phone" className="text-xs">
                      Contact Phone Number
                    </Label>
                    <Input
                      id="c-phone"
                      placeholder="+91 98765 43210"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="mt-1.5 text-xs"
                      required
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label htmlFor="c-email" className="text-xs">
                      Email Address
                    </Label>
                    <Input
                      id="c-email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="mt-1.5 text-xs"
                    />
                  </div>
                  <div>
                    <Label htmlFor="c-ref" className="text-xs">
                      Ride Reference (if applicable)
                    </Label>
                    <Input
                      id="c-ref"
                      placeholder="OG-2026-XXXX"
                      value={reference}
                      onChange={(e) => setReference(e.target.value)}
                      className="mt-1.5 text-xs"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="c-type" className="text-xs">
                    Complaint Category
                  </Label>
                  <Select value={complaintType} onValueChange={setComplaintType}>
                    <SelectTrigger id="c-type" className="mt-1.5 text-xs">
                      <SelectValue placeholder="Select complaint type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="general">General Service Inquiry</SelectItem>
                      <SelectItem value="lost_found">Lost & Found / Property in Cab</SelectItem>
                      <SelectItem value="billing">
                        Fare, Overcharge or GST Invoicing Dispute
                      </SelectItem>
                      <SelectItem value="driver">Driver Conduct or Safety Violation</SelectItem>
                      <SelectItem value="privacy">
                        Personal Data & Privacy Inquiry (DPDP)
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="c-msg" className="text-xs">
                    Detailed Description of Grievance
                  </Label>
                  <Textarea
                    id="c-msg"
                    rows={4}
                    placeholder="Please provide specific journey date, time, driver details, and summary of the issue..."
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    className="mt-1.5 text-xs resize-none"
                    required
                  />
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                  <Send className="mr-2 size-4" />{" "}
                  {submitting ? "Registering Grievance..." : "Submit to Grievance Desk"}
                </Button>
              </form>
            )}
          </div>

          {/* Corporate Office & National Helpline Info */}
          <div className="space-y-4">
            <div className="rounded-2xl border border-border bg-card p-6 text-xs text-muted-foreground space-y-3">
              <div className="flex items-center gap-2 font-bold text-foreground text-sm">
                <MapPin className="size-4 text-primary" /> Registered Corporate Office
              </div>
              <p>
                <strong>ORANGE TAXI LIMITED</strong>
                <br />
                CIN: U49224DL2026PLC461350
                <br />
                S-210, 2nd Floor, Panchshila Park,
                <br />
                South Malviya Nagar, South Delhi,
                <br />
                New Delhi, Delhi 110017, India
              </p>
              <div className="pt-2 border-t border-border">
                <p className="font-semibold text-foreground">Operating Hours:</p>
                <p>24 Hours a Day · 7 Days a Week</p>
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-muted/40 p-6 text-xs text-muted-foreground space-y-2">
              <p className="font-bold text-foreground">National Consumer Helpline (NCH):</p>
              <p>
                In compliance with Consumer Protection norms, consumers can also register complaints
                on the National Consumer Helpline at toll-free number <strong>1915</strong> or via{" "}
                <code className="bg-background px-1 py-0.5 rounded">consumerhelpline.gov.in</code>.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
