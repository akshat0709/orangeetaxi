import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  ShieldCheck,
  Zap,
  Receipt,
  Plane,
  Users,
  Check,
  CheckCircle2,
  Clock,
  ArrowRight,
  Loader2,
  Mail,
  Phone,
  BarChart3,
  FileSpreadsheet,
  Headphones,
} from "lucide-react";
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

export const Route = createFileRoute("/business")({
  head: () => ({
    meta: [
      { title: "Orange for Business — Premium Corporate EV Mobility" },
      {
        name: "description",
        content:
          "Zero-emission executive travel for enterprises: GST-compliant corporate billing, airport transfers, employee commute, and audited Scope 3 ESG reporting.",
      },
      { property: "og:title", content: "Orange for Business — Corporate Electric Mobility" },
      {
        property: "og:description",
        content:
          "Transform corporate transit with our 100% Mahindra BE.6 electric SUV fleet. Dedicated account management and monthly GST billing.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: BusinessPage,
});

const corporateEnquirySchema = z.object({
  company_name: z.string().min(2, "Company name is required"),
  contact_name: z.string().min(2, "Contact person name is required"),
  email: z.string().email("Enter a valid official work email"),
  phone: z.string().min(10, "Enter a valid 10-digit contact number"),
  city: z.string().min(2, "City is required"),
  team_size: z.string().min(1, "Select team size"),
  requirement: z.string().min(1, "Select your primary requirement"),
  message: z.string().optional(),
});

type CorporateEnquiryValues = z.infer<typeof corporateEnquirySchema>;

const ENTERPRISE_BENEFITS = [
  {
    icon: Receipt,
    title: "Monthly Consolidated GST Invoicing",
    description:
      "Eliminate messy employee reimbursement receipts. Receive a unified monthly tax invoice with complete GSTIN and SAC 9964 validation for 100% Input Tax Credit (ITC).",
  },
  {
    icon: Zap,
    title: "Transparent Per-Kilometre Pricing",
    description:
      "Clear base and per-kilometre fares for scheduled journeys and airport transfers, with every trip itemised on your monthly statement.",
  },
  {
    icon: Plane,
    title: "Executive Airport Priority Bays",
    description:
      "Flight-tracked chauffeurs waiting at IGI Airport terminals (T1, T2, T3). Complimentary 45-minute waiting allowance post flight touchdown.",
  },
  {
    icon: BarChart3,
    title: "Scope 3 ESG Carbon Audit",
    description:
      "Every kilometer driven in our Mahindra BE.6 EV fleet is tracked. Receive certified quarterly reports measuring CO2 emissions avoided for corporate sustainability compliance.",
  },
  {
    icon: ShieldCheck,
    title: "Strict Duty of Care & Security",
    description:
      "Rigorous chauffeur background checks, verified Aadhaar & commercial DL credentials, in-cab SOS buttons, and central control tower live tracking for executive safety.",
  },
  {
    icon: Headphones,
    title: "Dedicated Corporate Desk",
    description:
      "Priority enterprise hotline with an assigned travel operations manager to coordinate VIP visits, investor transfers, and multi-vehicle conference delegations.",
  },
];

const CORPORATE_FAQS = [
  {
    q: "How does Orange for Business billing work?",
    a: "We offer both centralized corporate post-paid accounts with 15 or 30-day billing cycles, and pre-funded enterprise wallets. All rides automatically append project or employee billing codes for easy cost-center reconciliation.",
  },
  {
    q: "Can our travel desk book on behalf of executives and visiting clients?",
    a: "Yes. Our enterprise portal allows designated travel administrators to schedule single or recurring rides, assign passengers, enter guest flight numbers, and monitor live chauffeur arrivals.",
  },
  {
    q: "What vehicles are provided for corporate rides?",
    a: "Our entire corporate fleet exclusively consists of pristine Mahindra BE.6 electric SUVs equipped with pre-cooled dual-zone AC, in-seat HD entertainment screens, and quiet acoustic insulation suitable for calls on the move.",
  },
  {
    q: "How do we receive GST tax invoices?",
    a: "Automated digital tax invoices are emailed immediately upon ride completion, and consolidated monthly summaries with full SAC 9964 categorization are sent to your finance and accounts payable team.",
  },
];

function BusinessPage() {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
    reset,
  } = useForm<CorporateEnquiryValues>({
    resolver: zodResolver(corporateEnquirySchema),
    defaultValues: {
      city: "Delhi NCR",
      team_size: "21-100",
      requirement: "Executive Airport & Client Travel",
    },
  });

  async function onSubmit(values: CorporateEnquiryValues) {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("corporate_enquiries").insert({
        company_name: values.company_name.trim(),
        contact_name: values.contact_name.trim(),
        email: values.email.trim().toLowerCase(),
        phone: values.phone.trim(),
        city: values.city.trim(),
        team_size: values.team_size,
        requirement: values.requirement,
        message: values.message?.trim() || "",
        status: "new",
      });

      if (error) {
        console.error("Corporate enquiry insert error:", error);
        toast.error(
          "Could not register corporate enquiry. Please try again or email business@orange-taxi.com.",
        );
        setSubmitting(false);
        return;
      }

      setSubmitted(true);
      reset();
      toast.success(
        "Enquiry received! Our enterprise mobility specialist will contact you within 4 business hours.",
      );
    } catch (err) {
      console.error("Corporate submission exception:", err);
      toast.error("An unexpected error occurred. Please contact business@orange-taxi.com.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-night text-white py-20 lg:py-28">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(245,107,0,0.22),transparent)]" />
        <div className="section-shell relative z-10">
          <div className="max-w-3xl">
            <div className="text-sm font-medium text-primary">Orange for Business</div>
            <h1 className="display-serif mt-6 text-4xl sm:text-5xl lg:text-6xl font-normal leading-[1.05] tracking-tight">
              Rides for your team, <span className="text-primary">billed monthly.</span>
            </h1>
            <p className="mt-6 text-base sm:text-lg text-white/80 leading-relaxed max-w-2xl">
              Equip your executives, traveling teams, and visiting clients with Mahindra BE.6
              electric SUVs. Streamlined monthly GST billing and certified ESG carbon offset
              reporting.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <a
                href="#enquiry-form"
                className="inline-flex h-11 items-center justify-center rounded-md bg-primary px-6 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Open a business account <ArrowRight className="ml-2 size-4" />
              </a>
              <Link
                to="/book"
                className="inline-flex h-11 items-center justify-center rounded-md border border-white/20 px-6 text-sm font-medium text-white transition-colors hover:bg-white/10"
              >
                Book a single ride
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-border">
        <ul className="section-shell grid gap-x-8 gap-y-3 py-6 text-sm text-foreground/80 sm:grid-cols-2 lg:grid-cols-4">
          {[
            "All-electric Mahindra BE.6 fleet",
            "No surge on corporate bookings",
            "GST invoices with input tax credit (SAC 9964)",
            "One monthly invoice for the company",
          ].map((fact) => (
            <li key={fact} className="flex items-center gap-2">
              <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
              {fact}
            </li>
          ))}
        </ul>
      </section>

      {/* Enterprise Pillars */}
      <section className="py-20 lg:py-24">
        <div className="section-shell">
          <div className="max-w-2xl mb-14">
            <span className="text-sm font-medium text-primary">For travel desks</span>
            <h2 className="display-serif mt-3 text-3xl sm:text-4xl tracking-tight">
              Simple for finance, comfortable for your people.
            </h2>
          </div>

          <div className="grid gap-x-12 gap-y-10 border-t border-border pt-10 md:grid-cols-2 lg:grid-cols-3">
            {ENTERPRISE_BENEFITS.map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.title}>
                  <Icon className="size-5 text-primary" aria-hidden="true" />
                  <h3 className="mt-4 text-lg font-semibold text-foreground">{item.title}</h3>
                  <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                    {item.description}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Corporate Enquiry Form Section */}
      <section id="enquiry-form" className="py-20 bg-warm/50 border-y border-border">
        <div className="section-shell grid lg:grid-cols-12 gap-12 items-start">
          <div className="lg:col-span-5">
            <div className="text-sm font-medium text-primary">Business account</div>
            <h2 className="display-serif mt-4 text-3xl sm:text-4xl leading-tight">
              Open a corporate account for your organization.
            </h2>
            <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
              Fill out this enquiry form and our enterprise mobility team will tailor a customized
              rate card, billing structure, and priority bay allocation for your company.
            </p>

            <div className="mt-8 space-y-4">
              <div className="flex items-start gap-3.5">
                <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-foreground">
                  Zero setup fees or maintenance commitments.
                </span>
              </div>
              <div className="flex items-start gap-3.5">
                <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-foreground">
                  Individual cost-center tagging for department expense audits.
                </span>
              </div>
              <div className="flex items-start gap-3.5">
                <CheckCircle2 className="size-5 text-primary shrink-0 mt-0.5" />
                <span className="text-sm font-medium text-foreground">
                  Automated monthly GST e-invoices directly to Accounts Payable.
                </span>
              </div>
            </div>

            <div className="mt-10 rounded-2xl border border-border bg-card p-6">
              <h4 className="text-sm font-semibold text-foreground">Direct Business Desk</h4>
              <p className="text-xs text-muted-foreground mt-1">
                Prefer to speak directly with an account executive?
              </p>
              <div className="mt-4 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Mail className="size-3.5 text-primary" /> business@orange-taxi.com
                </div>
                <div className="flex items-center gap-2 text-foreground font-semibold">
                  <Phone className="size-3.5 text-primary" /> +91 72940 73222 (Ext. 2)
                </div>
                <div className="text-[11px] text-muted-foreground pt-1">
                  Monday to Saturday · 9:00 AM to 7:00 PM IST
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="rounded-2xl border border-border bg-card p-8 md:p-10 shadow-sm">
              {submitted ? (
                <div className="text-center py-12">
                  <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                    <CheckCircle2 className="size-8" />
                  </div>
                  <h3 className="display-serif mt-5 text-2xl">Thanks, we have your enquiry.</h3>
                  <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">
                    Thank you for your interest in Orange for Business. Our enterprise desk has
                    received your requirement and will get in touch shortly with custom rate tiers
                    and portal access.
                  </p>
                  <Button onClick={() => setSubmitted(false)} variant="outline" className="mt-6">
                    Submit Another Enquiry
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="company_name" className="text-xs font-semibold">
                        Company / Organization Name *
                      </Label>
                      <Input
                        id="company_name"
                        placeholder="e.g. Acme Technologies India Pvt Ltd"
                        {...register("company_name")}
                        className="mt-1.5"
                      />
                      {errors.company_name && (
                        <p className="mt-1 text-xs text-destructive">
                          {errors.company_name.message}
                        </p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="contact_name" className="text-xs font-semibold">
                        Contact Person Name *
                      </Label>
                      <Input
                        id="contact_name"
                        placeholder="Full name"
                        {...register("contact_name")}
                        className="mt-1.5"
                      />
                      {errors.contact_name && (
                        <p className="mt-1 text-xs text-destructive">
                          {errors.contact_name.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="email" className="text-xs font-semibold">
                        Work Email Address *
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="name@company.com"
                        {...register("email")}
                        className="mt-1.5"
                      />
                      {errors.email && (
                        <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
                      )}
                    </div>
                    <div>
                      <Label htmlFor="phone" className="text-xs font-semibold">
                        Mobile / Direct Phone *
                      </Label>
                      <Input
                        id="phone"
                        placeholder="10-digit mobile number"
                        {...register("phone")}
                        className="mt-1.5"
                      />
                      {errors.phone && (
                        <p className="mt-1 text-xs text-destructive">{errors.phone.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-3">
                    <div>
                      <Label htmlFor="city" className="text-xs font-semibold">
                        Operating City *
                      </Label>
                      <Input
                        id="city"
                        placeholder="e.g. Delhi NCR, Gurugram"
                        {...register("city")}
                        className="mt-1.5"
                      />
                      {errors.city && (
                        <p className="mt-1 text-xs text-destructive">{errors.city.message}</p>
                      )}
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Estimated Team Size</Label>
                      <Select
                        defaultValue="21-100"
                        onValueChange={(val) => setValue("team_size", val)}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Select team size" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1-20">1 – 20 employees</SelectItem>
                          <SelectItem value="21-100">21 – 100 employees</SelectItem>
                          <SelectItem value="101-500">101 – 500 employees</SelectItem>
                          <SelectItem value="500+">500+ enterprise</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label className="text-xs font-semibold">Primary Requirement</Label>
                      <Select
                        defaultValue="Executive Airport & Client Travel"
                        onValueChange={(val) => setValue("requirement", val)}
                      >
                        <SelectTrigger className="mt-1.5">
                          <SelectValue placeholder="Select requirement" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Executive Airport & Client Travel">
                            Airport & Client Travel
                          </SelectItem>
                          <SelectItem value="Daily Employee Commute">Daily Commute</SelectItem>
                          <SelectItem value="Dedicated Chauffeur Retainership">
                            Chauffeur Retainership
                          </SelectItem>
                          <SelectItem value="Events & Conferences">Event Delegation</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="message" className="text-xs font-semibold">
                      Additional Details or Specific Requirements (Optional)
                    </Label>
                    <Textarea
                      id="message"
                      placeholder="Mention expected weekly trips, preferred routes, or specific billing cycle needs..."
                      rows={3}
                      {...register("message")}
                      className="mt-1.5"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-11 text-sm font-bold shadow-md"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="mr-2 size-4 animate-spin" /> Submitting Enterprise
                        Request...
                      </>
                    ) : (
                      <>
                        Submit Corporate Enquiry <ArrowRight className="ml-2 size-4" />
                      </>
                    )}
                  </Button>
                  <p className="text-[11px] text-muted-foreground text-center">
                    By submitting, you agree to our commercial communication under DPDP Act 2023. No
                    spam guarantee.
                  </p>
                </form>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise FAQs */}
      <section className="py-20">
        <div className="section-shell max-w-4xl">
          <div className="text-center mb-12">
            <span className="text-sm font-medium text-primary">Frequently Asked Questions</span>
            <h2 className="display-serif mt-3 text-3xl">
              Everything your travel desk needs to know.
            </h2>
          </div>

          <div className="space-y-4">
            {CORPORATE_FAQS.map((faq, idx) => (
              <div key={idx} className="rounded-xl border border-border bg-card p-6">
                <h4 className="text-base font-semibold text-foreground">{faq.q}</h4>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{faq.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
