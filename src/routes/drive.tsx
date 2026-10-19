// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeIndianRupee,
  Camera,
  Car,
  Check,
  CheckCircle,
  ClipboardCheck,
  Gauge,
  GraduationCap,
  HandHeart,
  HeartPulse,
  Info,
  Loader2,
  ShieldCheck,
  Snowflake,
  Sparkles,
  TrendingUp,
  Trophy,
  Upload,
  User,
  X,
} from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import driverAppImage from "@/assets/orange-taxi-driver-app.jpg";
import driverImage from "@/assets/orange-taxi-driver.jpg";

export const Route = createFileRoute("/drive")({
  head: () => ({
    meta: [
      { title: "Drive With Orange — Orange Taxi" },
      {
        name: "description",
        content:
          "A fair, professional driving career with Orange Taxi: fixed salary, performance rewards, training and respect. Applications open soon.",
      },
      { property: "og:title", content: "Drive With Orange — Orange Taxi" },
      {
        property: "og:description",
        content:
          "Fixed salary, milestone rewards and a professional driving career — built on respect.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: DriverPage,
});

const benefits = [
  {
    icon: BadgeIndianRupee,
    title: "Fixed Salary",
    text: "A dependable income you can plan your life around — not a gamble on every trip.",
  },
  {
    icon: TrendingUp,
    title: "Performance Incentives",
    text: "Great service is rewarded with performance-based incentives on top of your salary.",
  },
  {
    icon: Trophy,
    title: "Milestone Rewards",
    text: "Consistent excellence is celebrated with milestone bonuses as you grow with Orange.",
  },
  {
    icon: GraduationCap,
    title: "Professional Training",
    text: "Structured training in hospitality, safe driving and the Orange service standard.",
  },
  {
    icon: HeartPulse,
    title: "Respect & Wellbeing",
    text: "Humane schedules and a team that treats you as a professional, not a number.",
  },
  {
    icon: ShieldCheck,
    title: "A Safer Workplace",
    text: "Well-maintained electric vehicles and safety standards that protect you too.",
  },
];

const journey = [
  [
    "01",
    "Register your interest",
    "Tell us you'd like to drive with Orange when applications open in your city.",
  ],
  [
    "02",
    "Meet & verify",
    "A friendly conversation, document verification and a driving assessment.",
  ],
  [
    "03",
    "Train with Orange",
    "Learn the Orange service standard — hospitality, safety and vehicle care.",
  ],
  [
    "04",
    "Start earning",
    "Begin with a fixed salary and grow through performance and milestone rewards.",
  ],
];

const requirements = [
  "Valid driving licence",
  "Clean driving record",
  "A courteous, customer-first attitude",
  "Commitment to the Orange service standard",
];

function DriverPage() {
  return (
    <>
      <section className="relative overflow-hidden bg-night text-white">
        <img
          src={driverAppImage}
          alt="A professional Orange Taxi driver standing beside his orange electric car"
          width={1408}
          height={1056}
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover object-[68%_center]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--night)_0%,color-mix(in_oklab,var(--night)_82%,transparent)_42%,transparent_78%)]" />
        <div className="section-shell relative flex min-h-[calc(100svh-8rem)] items-end py-10 md:items-center md:py-20">
          <div className="max-w-2xl ">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
              For drivers
            </p>
            <h1 className="display-serif text-[clamp(2.85rem,7vw,6.2rem)] leading-[0.92] text-white">
              Drive with dignity.
              <br />
              <span className="text-primary">Earn with stability.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-white/75 md:text-lg">
              A professional driving career built on a fixed salary, performance rewards and genuine
              respect — not per-trip commissions and endless uncertainty.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <a href="#join">
                  Join Orange <ArrowRight />
                </a>
              </Button>
              <Button asChild size="lg" variant="light">
                <a href="#earnings">How earning works</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section id="earnings" className="py-24 md:py-32">
        <div className="section-shell">
          <Intro
            eyebrow="The Orange earning model"
            title="Stability first. Rewards always."
            copy="Orange drivers are professionals with a dependable income — and great service is always rewarded on top."
          />
          <div className="mt-14 grid gap-4 lg:grid-cols-3">
            <article className="flex min-h-72 flex-col rounded-lg border border-primary bg-primary p-7 text-primary-foreground shadow-brand-lg">
              <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-70">
                The foundation
              </p>
              <h3 className="display-serif mt-3 text-3xl">Fixed Salary</h3>
              <p className="mt-4 text-sm leading-6 text-primary-foreground/85">
                A predictable monthly salary of ₹25,000 to ₹32,000 based on shift schedule,
                deposited directly on the 1st of every month without trip-counting anxiety.
              </p>
              <p className="mt-auto pt-8 text-xs text-primary-foreground/80 font-semibold">
                Guaranteed monthly direct deposit · ESI & PF compliant
              </p>
            </article>
            <article className="flex min-h-72 flex-col rounded-2xl border border-border bg-card p-7 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                For great service
              </p>
              <h3 className="display-serif mt-3 text-3xl">Performance Incentives</h3>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Earn up to ₹8,000 extra per month through punctuality, 4.8+ passenger ratings, zero
                trip refusals, and clean car audits.
              </p>
              <p className="mt-auto pt-8 text-xs text-emerald-600 dark:text-emerald-400 font-bold">
                Weekly automated incentive credit to driver ledger
              </p>
            </article>
            <article className="flex min-h-72 flex-col rounded-2xl border border-border bg-card p-7 shadow-xs">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-primary">
                For consistency
              </p>
              <h3 className="display-serif mt-3 text-3xl">Milestone Rewards</h3>
              <p className="mt-4 text-sm leading-6 text-muted-foreground">
                Reaching 6-month, 1-year, and 3-year service milestones unlocks cash bonuses, family
                medical coverage, and partner vehicle buyout assistance.
              </p>
              <p className="mt-auto pt-8 text-xs text-primary font-bold">
                Long-term wealth creation & EV ownership path
              </p>
            </article>
          </div>
        </div>
      </section>

      <section className="bg-warm py-24 md:py-32">
        <div className="section-shell grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div>
            <Intro
              eyebrow="Why drivers choose Orange"
              title="A career, not a hustle."
              copy="We believe great rides start with drivers who are rested, respected and fairly paid."
            />
            <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
              {benefits.map(({ icon: Icon, title, text }) => (
                <article key={title} className="bg-warm p-6">
                  <span className="grid size-10 place-items-center rounded-full bg-background text-primary">
                    <Icon className="size-4" />
                  </span>
                  <h3 className="mt-6 text-base font-bold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{text}</p>
                </article>
              ))}
            </div>
          </div>
          <figure className="overflow-hidden rounded-[var(--radius-xl)] shadow-soft">
            <img
              src={driverImage}
              alt="Professional Orange Taxi driver beside an orange electric car"
              width={1408}
              height={1600}
              loading="lazy"
              className="aspect-[4/5] size-full object-cover"
            />
          </figure>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="section-shell grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
          <Intro
            eyebrow="The driver journey"
            title="From interest to income."
            copy="A clear, respectful path into the Orange team."
          />
          <ol className="border-t border-border">
            {journey.map(([n, title, text]) => (
              <li
                key={n}
                className="grid gap-2 border-b border-border py-7 sm:grid-cols-[5rem_1fr] sm:gap-6"
              >
                <span className="display-serif text-4xl text-primary">{n}</span>
                <div>
                  <h3 className="text-lg font-bold">{title}</h3>
                  <p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-night py-24 text-white md:py-32">
        <div className="section-shell grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
              Chauffeur Technology
            </p>
            <h2 className="display-serif mt-4 text-5xl leading-none text-white md:text-6xl">
              Everything you need, in one place.
            </h2>
            <p className="mt-6 max-w-lg leading-7 text-white/75">
              The Orange Chauffeur Console is engineered for clarity: 1-tap duty toggles, live radar
              dispatch, passenger OTP verification, and clear commission ledgers without surprise
              deductions.
            </p>
            <ul className="mt-8 space-y-4 text-sm text-white/80">
              {[
                "1-Tap Online / Offline duty status",
                "Live passenger pickup radar with turn-by-turn routes",
                "Instant ride OTP verification for secure trips",
                "Daily cash collected settlement tracker & ledger",
              ].map((x) => (
                <li key={x} className="flex items-center gap-3">
                  <Gauge className="size-4 text-primary" />
                  {x}
                </li>
              ))}
            </ul>
            <div className="mt-8 flex gap-3">
              <Button asChild size="lg" className="font-bold">
                <Link to="/driver-console">Open Web Console</Link>
              </Button>
            </div>
          </div>
          <div className="rounded-2xl border border-white/15 bg-white/5 p-7 md:p-9 shadow-lg">
            <div className="flex items-center justify-between border-b border-white/10 pb-4">
              <div className="flex items-center gap-2">
                <span className="size-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-white/90">
                  Chauffeur Console Live
                </p>
              </div>
              <span className="rounded-full bg-primary/20 border border-primary/40 px-3 py-0.5 text-xs font-bold text-primary">
                Delhi NCR Hub
              </span>
            </div>
            <div className="mt-6 space-y-3">
              {[
                ["Base Salary Guarantee", "₹28,000 / mo"],
                ["Performance Incentive Target", "Up to ₹8,000 / mo"],
                ["Fleet Vehicle", "Mahindra BE.6 EV SUV"],
                ["Driver Health Coverage", "Family Medical Covered"],
              ].map(([label, val]) => (
                <div
                  key={label}
                  className="flex items-center justify-between rounded-xl border border-white/10 bg-neutral-900/70 px-5 py-4"
                >
                  <span className="text-sm text-white/70">{label}</span>
                  <span className="text-sm font-bold text-white">{val}</span>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs leading-5 text-white/55">
              Official chauffeur terms under Orange Taxi Limited employment and aggregator
              guidelines.
            </p>
          </div>
        </div>
      </section>

      <section id="join" className="py-24 md:py-32">
        <div className="section-shell grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <Intro
              eyebrow="Who we're looking for"
              title="Could you be an Orange driver?"
              copy="If you take pride in your driving and in how you treat people, we'd love to hear from you."
            />
            <ul className="mt-8 space-y-4 text-sm font-semibold">
              {requirements.map((x) => (
                <li key={x} className="flex items-center gap-3">
                  <Check className="size-4 text-primary" />
                  {x}
                </li>
              ))}
            </ul>
          </div>
          <DriverApplicationForm />
        </div>
      </section>

      {/* Statutory Driver Onboarding Terms & Conditions (Clause 11.1(ix) & Clause 14.10) */}
      <section className="border-t border-border bg-card py-20 md:py-28">
        <div className="section-shell max-w-5xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
            <ShieldCheck className="size-4" /> Regulatory Disclosures (Clause 11.1 & 14.10)
          </div>
          <h2 className="display-serif mt-3 text-3xl md:text-4xl">
            Standard Driver Terms & Operating Code / चालक ऑनबोर्डिंग नियम
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            In compliance with Clause 11.1(ix) of the Motor Vehicle Aggregator Guidelines, 2025, the
            terms governing driver-partner onboarding, fixed earnings, conduct, and vehicle
            operations are published below in English and Hindi.
          </p>

          <div className="mt-10 grid gap-8 md:grid-cols-2">
            {/* English Column */}
            <div className="rounded-xl border border-border bg-background p-6 text-xs space-y-4 text-muted-foreground">
              <h3 className="text-sm font-bold text-foreground flex items-center justify-between border-b border-border pb-2">
                <span>English — Operating Agreement</span>
                <span className="text-[10px] uppercase font-bold text-primary">Official Terms</span>
              </h3>
              <div>
                <p className="font-semibold text-foreground">
                  1. Eligibility & Police Verification (Clause 15.4)
                </p>
                <p className="mt-1">
                  Every driver must possess a valid Commercial / Transport Driving Licence, minimum
                  2 years driving experience, and clean police verification records before being
                  activated.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  2. Fixed Salary & Fair Incentives (Clause 14.6)
                </p>
                <p className="mt-1">
                  Orange Taxi provides dependable monthly fixed salaries + performance rewards.
                  Drivers are not subject to arbitrary surge commissions or unfair trip deductions.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  3. Zero-Tolerance Alcohol & Drug Policy (Clause 14.10)
                </p>
                <p className="mt-1">
                  Operating any Orange Taxi under the influence of alcohol, narcotics, or
                  intoxicating substances is strictly prohibited. Immediate suspension and permanent
                  blacklisting apply upon violation.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  4. Vehicle Standards & Service Quality
                </p>
                <p className="mt-1">
                  All electric cabs must be kept spotless, air-conditioned throughout the journey,
                  and operated with professional courtesy at all times.
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  5. Fair Inquiry & Grievance (Section 8 SLA)
                </p>
                <p className="mt-1">
                  Any passenger complaint against a driver requires a mandatory 3-working-day fair
                  inquiry before final disciplinary action is determined.
                </p>
              </div>
            </div>

            {/* Hindi Column */}
            <div className="rounded-xl border border-border bg-background p-6 text-xs space-y-4 text-muted-foreground">
              <h3 className="text-sm font-bold text-foreground flex items-center justify-between border-b border-border pb-2">
                <span>हिंदी — चालक नियम एवं शर्तें</span>
                <span className="text-[10px] uppercase font-bold text-primary">आधिकारिक नियम</span>
              </h3>
              <div>
                <p className="font-semibold text-foreground">
                  1. पात्रता एवं पुलिस सत्यापन (खंड 15.4)
                </p>
                <p className="mt-1">
                  सभी चालकों के पास वैध कमर्शियल ड्राइविंग लाइसेंस, न्यूनतम 2 वर्ष का अनुभव और पुलिस
                  सत्यापन प्रमाणपत्र होना अनिवार्य है।
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  2. निश्चित मासिक वेतन एवं प्रोत्साहन (खंड 14.6)
                </p>
                <p className="mt-1">
                  ऑरेंज टैक्सी निश्चित मासिक वेतन और बेहतरीन सेवा के लिए अतिरिक्त बोनस प्रदान करती
                  है। कोई अनुचित कमीशन कटौती नहीं की जाती।
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  3. नशा निषेध नीति - जीरो टॉलरेंस (खंड 14.10)
                </p>
                <p className="mt-1">
                  शराब, ड्रग्स या किसी भी प्रकार के नशे की हालत में वाहन चलाना सख्त वर्जित है।
                  उल्लंघन करने पर चालक को तुरंत बर्खास्त और ब्लैकलिस्ट किया जाएगा।
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">4. वाहन स्वच्छता एवं एसी मानक</p>
                <p className="mt-1">
                  सभी इलेक्ट्रिक वाहन साफ-सुथरे रहने चाहिए, यात्रा के दौरान एसी चालू रहना चाहिए और
                  यात्रियों के साथ आदरपूर्वक व्यवहार आवश्यक है।
                </p>
              </div>
              <div>
                <p className="font-semibold text-foreground">
                  5. निष्पक्ष जांच का अधिकार (3 दिन की जांच)
                </p>
                <p className="mt-1">
                  किसी भी शिकायत की स्थिति में चालक को पक्ष रखने का पूरा अवसर दिया जाएगा और 3
                  कार्यदिवसों में निष्पक्ष जांच पूरी की जाएगी।
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

const appSchema = z.object({
  full_name: z.string().min(2, "Enter your full name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(7, "Enter a valid phone number"),
  aadhaar_number: z.string().min(12, "Enter a valid 12-digit Aadhaar number"),
  city: z.string().min(2, "Enter your city"),
  licence_number: z.string().min(4, "Enter your licence number"),
  experience_years: z.coerce.number().min(0).max(50),
  driver_type: z.enum(["company", "partner"]).default("company"),
  owns_vehicle: z.boolean().default(false),
  vehicle_model: z.string().optional(),
  vehicle_number: z.string().optional(),
  chassis_number: z.string().optional(),
  vehicle_year: z.string().optional(),
  message: z.string().optional(),
  agree_privacy: z.boolean().refine((val) => val === true, {
    message:
      "You must consent to the Privacy Policy and background verification to submit your application",
  }),
});
type AppValues = z.infer<typeof appSchema>;

function DriverApplicationForm() {
  const [submitted, setSubmitted] = useState(false);
  const [honeypot, setHoneypot] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [photoDataUrl, setPhotoDataUrl] = useState<string>("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState(false);
  const [dlDataUrl, setDlDataUrl] = useState<string>("");
  const [dlFile, setDlFile] = useState<File | null>(null);
  const [dlError, setDlError] = useState(false);
  const [termsOpen, setTermsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dlInputRef = useRef<HTMLInputElement>(null);

  const form = useForm<AppValues>({
    resolver: zodResolver(appSchema),
    defaultValues: {
      driver_type: "company",
      owns_vehicle: false,
      experience_years: 0,
      vehicle_model: "Mahindra BE.6",
      vehicle_number: "",
      chassis_number: "",
      vehicle_year: "2025",
    },
  });

  // Prepopulate form if driver already created an account and is logged in
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) {
        if (user.email && !form.getValues("email")) {
          form.setValue("email", user.email);
        }
        const metaName = user.user_metadata?.full_name;
        if (metaName && !form.getValues("full_name")) {
          form.setValue("full_name", metaName);
        }
        const metaPhone = user.user_metadata?.phone;
        if (metaPhone && !form.getValues("phone")) {
          form.setValue("phone", metaPhone);
        }
      }
    });
  }, [form]);

  const ownsVehicle = form.watch("owns_vehicle");
  const driverType = form.watch("driver_type");

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload a valid image file (JPG/PNG/WebP).");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      toast.error("Photo size should be under 8MB.");
      return;
    }

    setPhotoFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        // Compress & scale to standard avatar size (max 400x400) for instant loading
        const canvas = document.createElement("canvas");
        const MAX_DIM = 400;
        let width = img.width;
        let height = img.height;
        if (width > height) {
          if (width > MAX_DIM) {
            height = Math.round((height * MAX_DIM) / width);
            width = MAX_DIM;
          }
        } else {
          if (height > MAX_DIM) {
            width = Math.round((width * MAX_DIM) / height);
            height = MAX_DIM;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.85);
        setPhotoDataUrl(compressed);
        setPhotoError(false);
        toast.success("Driver photo uploaded successfully!");
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleDlSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
      toast.error("File size should be under 8MB.");
      return;
    }

    setDlFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
      setDlDataUrl(event.target?.result as string);
      setDlError(false);
      toast.success("Driving Licence uploaded successfully!");
    };
    reader.readAsDataURL(file);
  };

  async function onSubmit(values: AppValues) {
    if (!photoDataUrl) {
      setPhotoError(true);
      toast.error("Driver photo is mandatory. Please upload your portrait photo.");
      fileInputRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }
    if (!dlDataUrl) {
      setDlError(true);
      toast.error("Driving Licence is mandatory. Please upload your document.");
      dlInputRef.current?.scrollIntoView({ behavior: "smooth" });
      return;
    }

    if (values.owns_vehicle) {
      if (!values.vehicle_number || values.vehicle_number.trim().length < 4) {
        toast.error("Please enter your vehicle's registration number (plate).");
        return;
      }
      if (!values.chassis_number || values.chassis_number.trim().length < 5) {
        toast.error("Please enter your vehicle's Chassis number (VIN).");
        return;
      }
    }

    setSubmitting(true);

    const metaData = {
      photo_url: photoDataUrl,
      driver_type: values.owns_vehicle ? "partner" : "company",
      vehicle_model: values.owns_vehicle
        ? values.vehicle_model || "Mahindra BE.6"
        : "Mahindra BE.6",
      vehicle_number: values.owns_vehicle ? (values.vehicle_number || "").trim().toUpperCase() : "",
      chassis_number: values.owns_vehicle ? (values.chassis_number || "").trim().toUpperCase() : "",
      vehicle_year: values.owns_vehicle ? values.vehicle_year : "2025",
    };
    const metaJson = JSON.stringify(metaData);

    let finalPhotoUrl = photoDataUrl;
    let finalDlUrl = dlDataUrl;

    try {
      if (photoFile) {
        const photoExt = (photoFile.name.split(".").pop() || "jpg").toLowerCase();
        const photoPath = `applications/${Date.now()}_photo_${Math.random().toString(36).substring(2, 7)}.${photoExt}`;
        const { data: upPhoto, error: photoErr } = await supabase.storage
          .from("driver_kyc")
          .upload(photoPath, photoFile);
        if (!photoErr && upPhoto?.path) {
          finalPhotoUrl = `storage://driver_kyc/${upPhoto.path}`;
        }
      }
      if (dlFile) {
        const dlExt = (dlFile.name.split(".").pop() || "jpg").toLowerCase();
        const dlPath = `applications/${Date.now()}_dl_${Math.random().toString(36).substring(2, 7)}.${dlExt}`;
        const { data: upDl, error: dlErr } = await supabase.storage
          .from("driver_kyc")
          .upload(dlPath, dlFile);
        if (!dlErr && upDl?.path) {
          finalDlUrl = `storage://driver_kyc/${upDl.path}`;
        }
      }
    } catch (e) {
      console.warn("Storage upload notice:", e);
    }

    const payload = {
      full_name: values.full_name,
      email: values.email,
      phone: values.phone,
      aadhaar_number: values.aadhaar_number,
      city: values.city,
      licence_number: values.licence_number,
      experience_years: values.experience_years,
      owns_vehicle: values.owns_vehicle,
      message: values.message ?? "",
      admin_notes: metaJson,
      // Extended fields (storage reference preferred, fallback to compressed image)
      photo_url: finalPhotoUrl,
      dl_url: finalDlUrl,
      driver_type: values.owns_vehicle ? "partner" : "company",
      vehicle_model: values.owns_vehicle
        ? values.vehicle_model || "Mahindra BE.6"
        : "Mahindra BE.6",
      vehicle_number: values.owns_vehicle ? values.vehicle_number.trim().toUpperCase() : "",
      chassis_number: values.owns_vehicle ? (values.chassis_number || "").trim().toUpperCase() : "",
      vehicle_year: values.owns_vehicle ? values.vehicle_year : "2025",
    };

    // Store in local backup for resilient admin sync
    try {
      const emailKey = values.email.toLowerCase();
      const phoneKey = values.phone.replace(/[^0-9]/g, "");
      localStorage.setItem(`orange_app_meta_${emailKey}`, JSON.stringify(payload));
      if (photoDataUrl) {
        localStorage.setItem(`orange_driver_photo_by_email_${emailKey}`, photoDataUrl);
        localStorage.setItem(`orange_driver_photo_by_phone_${phoneKey}`, photoDataUrl);
        localStorage.setItem(
          `orange_driver_photo_by_name_${values.full_name.trim().toLowerCase()}`,
          photoDataUrl,
        );
      }

      const existingApps = JSON.parse(localStorage.getItem("orange_extended_apps") || "[]");
      const appArray = Array.isArray(existingApps) ? existingApps : Object.values(existingApps);
      appArray.unshift({ ...payload, email: emailKey });
      localStorage.setItem("orange_extended_apps", JSON.stringify(appArray));

      // If partner vehicle, auto-save in partner fleet storage
      if (values.owns_vehicle && values.vehicle_number) {
        const existingCars = JSON.parse(localStorage.getItem("orange_partner_vehicles") || "[]");
        const cleanPlate = values.vehicle_number.trim().toUpperCase();
        if (!existingCars.some((c: any) => c.plate_number === cleanPlate)) {
          existingCars.unshift({
            id: "car-pv-" + Date.now(),
            plate_number: cleanPlate,
            chassis_number: (values.chassis_number || "").trim().toUpperCase(),
            model: values.vehicle_model || "Mahindra BE.6",
            year: values.vehicle_year || "2024",
            owner_name: values.full_name,
            owner_phone: values.phone,
            owner_email: emailKey,
            status: "pending_inspection",
            is_ev: true,
            created_at: new Date().toISOString(),
          });
          localStorage.setItem("orange_partner_vehicles", JSON.stringify(existingCars));
        }
      }
    } catch {}

    // Primary database insert (fallback to basePayload with admin_notes JSON if custom columns not in table yet)
    const { error } = await supabase.from("driver_applications").insert(payload);
    if (error) {
      console.warn("Retrying with base schema and admin_notes JSON metadata:", error);
      const basePayload = {
        full_name: values.full_name,
        email: values.email,
        phone: values.phone,
        aadhaar_number: values.aadhaar_number,
        city: values.city,
        licence_number: values.licence_number,
        experience_years: values.experience_years,
        owns_vehicle: values.owns_vehicle,
        message: values.message ?? "",
        admin_notes: metaJson,
        dl_url: dlDataUrl,
      };
      const retry = await supabase.from("driver_applications").insert(basePayload);
      if (retry.error) {
        toast.error(`Submission failed: ${retry.error.message}`);
        setSubmitting(false);
        return;
      }
    }

    setSubmitted(true);
    toast.success("Driver application submitted with photo & vehicle details!");
  }

  if (submitted) {
    return (
      <div className="flex flex-col items-center rounded-xl border border-border bg-warm p-9 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary">
          <CheckCircle className="size-7" />
        </span>
        <h3 className="display-serif mt-6 text-3xl">Application received.</h3>
        <p className="mt-3 max-w-sm text-sm leading-6 text-muted-foreground">
          Thank you for applying to drive with Orange. Your photo, driving licence, and vehicle
          details will be reviewed by our fleet operations desk. For queries or onboarding
          assistance, email us at{" "}
          <a
            href="mailto:drive@orange-taxi.com"
            className="text-primary hover:underline font-medium"
          >
            drive@orange-taxi.com
          </a>
          .
        </p>
        <Button asChild size="lg" variant="charcoal" className="mt-8">
          <Link to="/about">
            <HandHeart className="size-4" />
            About Orange
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="rounded-xl border border-border bg-warm p-7 md:p-9 shadow-sm"
      >
        <ClipboardCheck className="size-7 text-primary" />
        <h3 className="display-serif mt-5 text-3xl">Apply to drive.</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Join as a Salaried Fleet Driver or Partner Owner-Operator. Questions? Email{" "}
          <a
            href="mailto:drive@orange-taxi.com"
            className="text-primary hover:underline font-medium"
          >
            drive@orange-taxi.com
          </a>
        </p>

        <div className="mt-7 space-y-5">
          {/* MANDATORY DRIVER PHOTO UPLOAD */}
          <div
            className={`rounded-xl border-2 p-4 transition-all ${photoError ? "border-destructive bg-destructive/5" : "border-dashed border-border bg-background/60"}`}
          >
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative size-20 shrink-0 rounded-full border-2 border-primary/40 bg-primary/10 overflow-hidden flex items-center justify-center shadow-inner">
                {photoDataUrl ? (
                  <img
                    src={photoDataUrl}
                    alt="Driver Portrait Preview"
                    className="size-full object-cover"
                  />
                ) : (
                  <User className="size-9 text-primary/60" />
                )}
                {photoDataUrl && (
                  <button
                    type="button"
                    onClick={() => setPhotoDataUrl("")}
                    className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-[11px] font-bold"
                    title="Remove Photo"
                  >
                    Change
                  </button>
                )}
              </div>

              <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-1.5">
                  <Label
                    htmlFor="driver-photo-input"
                    className="text-sm font-bold text-foreground cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    <Camera className="size-4 text-primary" />
                    <span>
                      Upload Driver Photo <span className="text-destructive font-bold">*</span>
                    </span>
                  </Label>
                  <span className="rounded bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 uppercase tracking-wide">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Clear front-facing portrait. Displayed to passengers on ride confirmation and live
                  tracking.
                </p>
                <div className="pt-1">
                  <input
                    ref={fileInputRef}
                    id="driver-photo-input"
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="hidden"
                    onChange={handlePhotoSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    <Upload className="size-3.5" />
                    <span>{photoDataUrl ? "Replace Photo" : "Choose / Take Photo"}</span>
                  </Button>
                </div>
              </div>
            </div>
            {photoError && (
              <p className="mt-2 text-xs font-semibold text-destructive flex items-center gap-1">
                <Info className="size-3.5" /> Please upload your photo before submitting the
                application.
              </p>
            )}
          </div>

          {/* DRIVING LICENCE UPLOAD */}
          <div
            className={`rounded-xl border-2 p-4 transition-all ${dlError ? "border-destructive bg-destructive/5" : "border-dashed border-border bg-background/60"}`}
          >
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="relative size-20 shrink-0 rounded-lg border-2 border-primary/40 bg-primary/10 overflow-hidden flex items-center justify-center shadow-inner">
                {dlDataUrl ? (
                  <div className="flex flex-col items-center justify-center text-primary text-[10px] font-bold text-center">
                    <CheckCircle className="size-6 mb-1" />
                    Doc
                    <br />
                    Uploaded
                  </div>
                ) : (
                  <ClipboardCheck className="size-9 text-primary/60" />
                )}
                {dlDataUrl && (
                  <button
                    type="button"
                    onClick={() => setDlDataUrl("")}
                    className="absolute inset-0 bg-black/50 text-white flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity text-[11px] font-bold"
                    title="Remove Document"
                  >
                    Change
                  </button>
                )}
              </div>

              <div className="space-y-1 text-center sm:text-left flex-1 min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-1.5">
                  <Label
                    htmlFor="dl-upload-input"
                    className="text-sm font-bold text-foreground cursor-pointer hover:text-primary transition-colors flex items-center gap-1.5"
                  >
                    <Upload className="size-4 text-primary" />
                    <span>
                      Upload Driving Licence <span className="text-destructive font-bold">*</span>
                    </span>
                  </Label>
                  <span className="rounded bg-primary/10 text-primary text-[10px] font-bold px-1.5 py-0.5 uppercase tracking-wide">
                    Mandatory
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Clear copy of your valid Driving Licence (Image or PDF).
                </p>
                <div className="pt-1">
                  <input
                    ref={dlInputRef}
                    id="dl-upload-input"
                    type="file"
                    accept="image/*,application/pdf"
                    className="hidden"
                    onChange={handleDlSelect}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => dlInputRef.current?.click()}
                    className="h-8 text-xs font-semibold gap-1.5"
                  >
                    <Upload className="size-3.5" />
                    <span>{dlDataUrl ? "Replace Document" : "Choose Document"}</span>
                  </Button>
                </div>
              </div>
            </div>
            {dlError && (
              <p className="mt-2 text-xs font-semibold text-destructive flex items-center gap-1">
                <Info className="size-3.5" /> Please upload your Driving Licence before submitting.
              </p>
            )}
          </div>

          {/* BASIC INFORMATION */}
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Label htmlFor="da-name">Full Name</Label>
              <Input
                id="da-name"
                placeholder="Rajesh Kumar"
                className="mt-1.5 bg-background"
                {...form.register("full_name")}
              />
              {form.formState.errors.full_name && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.full_name.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="da-email">Email</Label>
              <Input
                id="da-email"
                type="email"
                placeholder="you@example.com"
                className="mt-1.5 bg-background"
                {...form.register("email")}
              />
              {form.formState.errors.email && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.email.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="da-phone">Phone</Label>
              <Input
                id="da-phone"
                type="tel"
                placeholder="+91 98765 43210"
                className="mt-1.5 bg-background"
                {...form.register("phone")}
              />
              {form.formState.errors.phone && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.phone.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="da-city">City</Label>
              <Input
                id="da-city"
                placeholder="Delhi"
                className="mt-1.5 bg-background"
                {...form.register("city")}
              />
              {form.formState.errors.city && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.city.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="da-aadhaar">Aadhaar Number</Label>
              <Input
                id="da-aadhaar"
                placeholder="1234 5678 9012"
                className="mt-1.5 bg-background"
                {...form.register("aadhaar_number")}
              />
              {form.formState.errors.aadhaar_number && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.aadhaar_number.message}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="da-exp">Years Driving</Label>
              <Input
                id="da-exp"
                type="number"
                min={0}
                max={50}
                placeholder="3"
                className="mt-1.5 bg-background"
                {...form.register("experience_years")}
              />
            </div>
            <div className="col-span-2">
              <Label htmlFor="da-licence">Commercial Licence Number</Label>
              <Input
                id="da-licence"
                placeholder="DL-1420100012345"
                className="mt-1.5 bg-background"
                {...form.register("licence_number")}
              />
              {form.formState.errors.licence_number && (
                <p className="mt-1 text-xs text-destructive">
                  {form.formState.errors.licence_number.message}
                </p>
              )}
            </div>

            {/* DRIVER MODEL SELECTION & "ORANGE STANDARD CAR" CHECKBOX */}
            <div className="col-span-2 rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="da-vehicle"
                  checked={ownsVehicle}
                  onCheckedChange={(checked) => {
                    const isOwn = !!checked;
                    form.setValue("owns_vehicle", isOwn);
                    form.setValue("driver_type", isOwn ? "partner" : "company");
                    if (isOwn) {
                      setTermsOpen(true);
                    }
                  }}
                  className="mt-1"
                />
                <div className="flex-1">
                  <Label
                    htmlFor="da-vehicle"
                    className="cursor-pointer font-bold text-sm text-foreground"
                  >
                    I bring my own "Orange Standard" Electric Car (Partner Driver)
                  </Label>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Unchecked = <strong>Company Fleet Driver</strong> (drive company Mahindra BE.6
                    on fixed monthly salary). Checked = <strong>Partner Driver</strong> (commission
                    model, keep 85% of trip fares).
                  </p>
                  <button
                    type="button"
                    onClick={() => setTermsOpen(true)}
                    className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-primary underline underline-offset-2 hover:text-primary/80"
                  >
                    <Sparkles className="size-3" /> View "Orange Standard Cab" Definition & Terms
                  </button>
                </div>
              </div>

              {/* DYNAMIC VEHICLE DETAILS (REQUIRED FOR PARTNER DRIVERS) */}
              {ownsVehicle && (
                <div className="mt-4 pt-3 border-t border-primary/20 space-y-3  duration-300">
                  <div className="flex items-center gap-2">
                    <Car className="size-4 text-primary" />
                    <p className="text-xs font-bold uppercase tracking-wider text-primary">
                      Partner Vehicle Details (Mandatory)
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor="da-vmodel" className="text-xs">
                        EV Model & Make
                      </Label>
                      <Input
                        id="da-vmodel"
                        placeholder="e.g. Mahindra BE.6 / Tata Curvv EV"
                        className="mt-1 bg-background text-xs h-9"
                        {...form.register("vehicle_model")}
                      />
                    </div>
                    <div>
                      <Label htmlFor="da-vyear" className="text-xs">
                        Manufacturing Year
                      </Label>
                      <Input
                        id="da-vyear"
                        placeholder="2024 / 2025"
                        className="mt-1 bg-background text-xs h-9"
                        {...form.register("vehicle_year")}
                      />
                    </div>
                    <div>
                      <Label htmlFor="da-vnum" className="text-xs">
                        Vehicle Registration No. (Plate) *
                      </Label>
                      <Input
                        id="da-vnum"
                        placeholder="e.g. DL 01 EV 1234"
                        className="mt-1 bg-background font-mono uppercase text-xs h-9"
                        {...form.register("vehicle_number")}
                      />
                    </div>
                    <div>
                      <Label htmlFor="da-vchassis" className="text-xs">
                        Chassis Number (VIN) *
                      </Label>
                      <Input
                        id="da-vchassis"
                        placeholder="e.g. MA3EHB6S7P..."
                        className="mt-1 bg-background font-mono uppercase text-xs h-9"
                        {...form.register("chassis_number")}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="col-span-2">
              <Label htmlFor="da-msg">
                Anything else you'd like us to know?{" "}
                <span className="text-muted-foreground">(optional)</span>
              </Label>
              <Textarea
                id="da-msg"
                rows={2}
                placeholder="Experience details or vehicle details..."
                className="mt-1.5 resize-none bg-background text-sm"
                {...form.register("message")}
              />
            </div>

            {/* DPDP Data Collection Notice & Consent Checkbox */}
            <div className="col-span-2 space-y-1">
              <div className="flex items-start gap-2.5 rounded-lg border border-border bg-background/80 p-3 text-[11px] text-muted-foreground leading-relaxed">
                <input
                  id="da-consent"
                  type="checkbox"
                  className="size-4 mt-0.5 rounded border-border accent-primary shrink-0 cursor-pointer"
                  {...form.register("agree_privacy")}
                />
                <Label
                  htmlFor="da-consent"
                  className="text-[11px] font-normal leading-relaxed cursor-pointer text-muted-foreground"
                >
                  <strong className="text-foreground">
                    Consent & Verification Notice (DPDP Act, 2023):
                  </strong>{" "}
                  I hereby consent to Orange Taxi Electric Mobility Solutions Pvt. Ltd. processing
                  my commercial driving licence, portrait photo, Aadhaar number, and vehicle records
                  for background verification, onboarding, and safety compliance under the{" "}
                  <Link
                    to="/privacy"
                    target="_blank"
                    className="font-semibold text-primary underline hover:text-primary/80"
                  >
                    Orange Taxi Privacy Policy & Data Notice
                  </Link>
                  .
                </Label>
              </div>
              {form.formState.errors.agree_privacy && (
                <p className="text-xs text-destructive">
                  {form.formState.errors.agree_privacy.message}
                </p>
              )}
            </div>
          </div>

          <Button type="submit" size="lg" className="w-full" disabled={submitting}>
            {submitting ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <>
                Submit Driver Application <ArrowRight className="size-4" />
              </>
            )}
          </Button>
        </div>
      </form>

      {/* ORANGE STANDARD CAR DEFINITION & TERMS MODAL */}
      <Dialog open={termsOpen} onOpenChange={setTermsOpen}>
        <DialogContent className="sm:max-w-xl bg-background border-border text-foreground">
          <DialogHeader>
            <div className="flex items-center gap-2 text-primary font-bold text-xs uppercase tracking-wider">
              <Sparkles className="size-4" /> Orange Taxi Fleet Standards
            </div>
            <DialogTitle className="text-xl font-bold">
              What Defines an "Orange Standard Cab"?
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Partner drivers bringing their own vehicle must satisfy all three core standards
              before onboarding.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3 text-xs leading-relaxed">
            {/* Standard 1: 100% EV */}
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 flex items-start gap-3">
              <div className="size-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-500 shrink-0 font-bold">
                01
              </div>
              <div className="space-y-1 flex-1">
                <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <span>100% Electric Vehicle (EV)</span>
                  <span className="rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold px-1.5 py-0.5">
                    Zero Emissions
                  </span>
                </p>
                <p className="text-muted-foreground">
                  The vehicle must strictly be a Battery Electric Vehicle (BEV) such as Mahindra
                  BE.6, Tata Curvv EV, MG ZS EV, or Nexon EV. Hybrid, Petrol, Diesel, or CNG cars
                  are strictly excluded.
                </p>
              </div>
            </div>

            {/* Standard 2: Signature Orange Exterior */}
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 flex items-start gap-3">
              <div className="size-8 rounded-lg bg-orange-500/15 border border-orange-500/30 flex items-center justify-center text-primary shrink-0 font-bold">
                02
              </div>
              <div className="space-y-1 flex-1">
                <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <span>Signature Orange Exterior Color</span>
                  <span className="rounded bg-orange-500/20 text-primary text-[10px] font-bold px-1.5 py-0.5">
                    Brand Identity
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Vehicle exterior body must be factory paint or professionally wrapped in official
                  Deep Sunset Orange, with zero visible scratches or dents, and commercial transport
                  registration plates.
                </p>
              </div>
            </div>

            {/* Standard 3: Well-Maintained Interior & AC */}
            <div className="rounded-xl border border-border bg-muted/40 p-3.5 flex items-start gap-3">
              <div className="size-8 rounded-lg bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-500 shrink-0 font-bold">
                03
              </div>
              <div className="space-y-1 flex-1">
                <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <span>Spotless Interior & Pre-Cooled AC</span>
                  <span className="rounded bg-blue-500/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5">
                    Passenger Comfort
                  </span>
                </p>
                <p className="text-muted-foreground">
                  Cabin must be cleaned daily, completely odor-free, with working air conditioning
                  switched on before passenger pickup, complimentary water bottle holder, and quiet
                  electric ride.
                </p>
              </div>
            </div>

            {/* Commission Operating Model Terms */}
            <div className="rounded-xl border border-primary/30 bg-primary/10 p-3.5 space-y-1.5">
              <p className="font-bold text-sm text-primary flex items-center gap-1.5">
                <BadgeIndianRupee className="size-4" /> Partner Driver Commission Agreement
              </p>
              <ul className="space-y-1 text-muted-foreground text-[11px] list-disc list-inside">
                <li>
                  Partner drivers retain <strong>85%</strong> of all ride fares collected.
                </li>
                <li>
                  A fixed <strong>15% platform commission</strong> is payable to Orange Taxi
                  Limited.
                </li>
                <li>
                  Partner drivers manage their own vehicle maintenance and charging, and are
                  segregated from the company depot cash settlement ledger.
                </li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button type="button" onClick={() => setTermsOpen(false)} className="w-full sm:w-auto">
              I Understand & Agree
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Intro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2 className="display-serif mt-4 text-5xl leading-none md:text-6xl">{title}</h2>
      {copy && <p className="mt-5 max-w-xl leading-7 text-muted-foreground">{copy}</p>}
    </div>
  );
}
