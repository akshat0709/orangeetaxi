import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BatteryCharging,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  Droplets,
  Leaf,
  MonitorPlay,
  Music2,
  Newspaper,
  ShieldCheck,
  Snowflake,
  Sparkles,
  UserRoundCheck,
  Zap,
  Plane,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "react-i18next";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import heroImage from "@/assets/orange-taxi-hero.jpg";
import interiorImage from "@/assets/orange-taxi-interior.jpg";
import driverImage from "@/assets/orange-taxi-driver.jpg";
import eveningImage from "@/assets/orange-taxi-evening.jpg";
import { WhatsAppConciergeFab } from "@/components/whatsapp-concierge-fab";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Orange Taxi — Premium Electric Cab Service in Delhi NCR" },
      {
        name: "description",
        content:
          "Book premium 100% electric cab rides with Orange Taxi. Exclusive Mahindra BE.6 electric SUVs, zero cancellations, pre-cooled AC cabins, and professional chauffeurs.",
      },
      { name: "robots", content: "index, follow" },
      { property: "og:title", content: "Orange Taxi — Premium Electric Cab Service" },
      {
        property: "og:description",
        content:
          "100% Electric Fleet · Mahindra BE.6 SUVs · Zero Cancellation Guarantee · Airport Transfers · Pre-Cooled AC Cabins.",
      },
      { property: "og:url", content: "https://orange-taxi.com/" },
      { property: "og:type", content: "website" },
      { property: "og:image", content: "https://orange-taxi.com/be6-exterior.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const IN_CAB_AMENITIES = [
  {
    icon: Snowflake,
    title: "Pre-Cooled AC at 22°C",
    text: "Never step into a hot cab or dispute AC settings. Cabins are cooled 10 minutes prior to arrival.",
    badge: "100% Guaranteed",
  },
  {
    icon: MonitorPlay,
    title: "In-Seat HD Entertainment",
    text: "Passenger touchscreens with movies, news, live radar navigation, and flight delay updates.",
    badge: "Rear Seat Touchscreen",
  },
  {
    icon: Music2,
    title: "Studio Sound System",
    text: "Acoustically tuned multi-speaker sound stage. Pair your playlist or choose Quiet Ride mode.",
    badge: "Quiet Serenity",
  },
  {
    icon: Newspaper,
    title: "Daily Newspapers",
    text: "Fresh national and business print editions provided daily in rear seat pockets.",
    badge: "Fresh Daily",
  },
  {
    icon: Droplets,
    title: "Complimentary Water",
    text: "A chilled, sealed bottle of mineral water waiting for every passenger in door holders.",
    badge: "Hygienic Hydration",
  },
  {
    icon: UserRoundCheck,
    title: "Disciplined Chauffeurs",
    text: "Salaried professionals trained in hospitality, defensive driving, and zero cancellation conduct.",
    badge: "Police Verified",
  },
];

const MOMENTS = [
  "Your signature orange Mahindra BE.6 arrives clean and pre-cooled.",
  "Your chauffeur greets you professionally and assists with luggage.",
  "Chilled water and fresh morning newspapers are waiting at your seat.",
  "In-seat HD touchscreen lights up with trip duration and live route radar.",
  "Silent electric propulsion ensures a smooth, whisper-quiet commute.",
  "You arrive on time, relaxed, with automated GST tax invoice emailed.",
];

const FAQS = [
  [
    "What is Orange Taxi?",
    "Orange Taxi is India's premier zero-emission electric cab service operating an exclusive fleet of Mahindra BE.6 electric SUVs in Delhi NCR, featuring guaranteed pre-cooled AC, zero driver cancellations, and in-seat hospitality.",
  ],
  [
    "What vehicles does Orange Taxi use?",
    "We operate an exclusive fleet of brand-new Mahindra BE.6 electric SUVs in signature orange, equipped with dual-zone climate control, rear passenger HD screens, and 5-Star Bharat NCAP safety architecture.",
  ],
  [
    "Are all Orange Taxi rides 100% electric?",
    "Yes. Every single ride is 100% battery electric (BEV) with zero tailpipe emissions, actively reducing urban carbon and PM2.5 pollution in Delhi NCR.",
  ],
  [
    "How does the Zero Cancellation Guarantee work?",
    "Once an Orange chauffeur accepts your reservation, they are contractually prohibited from cancelling. In rare cases of vehicle maintenance, our central control tower automatically reassigns an equal or superior EV immediately.",
  ],
  [
    "How are Orange Taxi fares calculated?",
    "Fares start at ₹99 base fare (including 2 km), then ₹18 per kilometer thereafter (minimum fare ₹149). Fares are shown transparently upfront before booking, with no hidden surge pricing on advance scheduled rides.",
  ],
  [
    "Where is Orange Taxi available?",
    "We currently serve New Delhi, South Delhi, Gurugram (Cyber City, Golf Course Road), Noida, Ghaziabad, Faridabad, and dedicated priority pickup bays at Delhi IGI Airport (T1, T2, T3).",
  ],
  [
    "Do you offer corporate billing and business accounts?",
    "Yes. Orange for Business provides centralized monthly GST-compliant invoicing (SAC 9964 with 100% Input Tax Credit), employee commute portals, and priority airport transfers.",
  ],
];

function HomePage() {
  const { t } = useTranslation();

  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-[calc(100svh-4.5rem)] overflow-hidden bg-night text-white flex items-center">
        <img
          src={heroImage}
          alt="Mahindra BE.6 orange electric SUV on a premium city boulevard"
          width={1920}
          height={1280}
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover object-[62%_center] opacity-80"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--night)_0%,color-mix(in_oklab,var(--night)_88%,transparent)_45%,transparent_78%)]" />

        <div className="section-shell relative z-10 py-16 md:py-24">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-bold uppercase tracking-widest text-primary backdrop-blur-md">
              <Sparkles className="size-3.5" /> Mahindra BE.6 · Exclusive Electric Fleet
            </div>

            <h1 className="display-serif mt-6 text-[clamp(2.8rem,6.5vw,5.8rem)] leading-[0.94] text-white">
              Premium rides. <br />
              <span className="text-primary">Without the premium price.</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-7 text-white/80 md:text-lg">
              Step into an acoustically silent electric SUV with pre-cooled AC, in-seat HD screens,
              and daily newspapers. Designed to make every journey in Delhi NCR extraordinary.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3.5">
              <Button asChild size="lg" className="shadow-lg font-bold">
                <Link to="/book">
                  Book an Orange Ride <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="light" className="font-semibold">
                <Link to="/login" search={{ mode: "signup" as any }}>
                  Create Account
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="bg-transparent border-white/25 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/experience">In-Cab Hospitality</Link>
              </Button>
            </div>

            {/* Quick Guarantees Bar */}
            <div className="mt-10 flex flex-wrap items-center gap-6 border-t border-white/15 pt-6 text-xs text-white/70">
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span>Zero Driver Cancellations</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span>Guaranteed Pre-Cooled AC</span>
              </div>
              <div className="flex items-center gap-2 font-medium">
                <CheckCircle2 className="size-4 text-emerald-400" />
                <span>100% Electric (Zero Emissions)</span>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute bottom-0 right-0 hidden border-l border-t border-white/20 bg-night/80 px-7 py-5 backdrop-blur-md md:block">
          <p className="text-xs uppercase tracking-[0.14em] text-white/50">
            Exclusive Delhi NCR Fleet
          </p>
          <p className="mt-1 text-sm font-semibold text-white">
            Mahindra BE.6 · Signature Orange EV
          </p>
        </div>
      </section>

      {/* In-Cab Amenities Showcase */}
      <section className="bg-card/50 py-20 text-foreground border-b border-border md:py-28">
        <div className="section-shell">
          <SectionIntro
            eyebrow="Signature In-Cab Hospitality"
            title="The experience starts the moment you sit down."
            copy="Every Mahindra BE.6 in our fleet is fitted with premium amenities to make your travel as restful and productive as your destination."
          />

          <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {IN_CAB_AMENITIES.map(({ icon: Icon, title, text, badge }) => (
              <article
                key={title}
                className="rounded-2xl border border-border bg-card p-7 flex flex-col justify-between shadow-xs transition-all hover:border-primary/40 hover:shadow-sm"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-6" />
                    </span>
                    <span className="text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full">
                      {badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-card-foreground mt-5">{title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* The Orange Experience Flow */}
      <section className="bg-warm/60 py-20 md:py-28 border-b border-border">
        <div className="section-shell grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionIntro
              eyebrow="The Orange Experience"
              title="The premium standard, made everyday."
              copy="From the moment your car arrives to the moment you step out, every detail is engineered for calm."
            />
            <ol className="mt-10 grid gap-1">
              {MOMENTS.map((m, i) => (
                <li
                  key={m}
                  className="grid grid-cols-[2.5rem_1fr] items-center border-t border-border py-4 text-sm"
                >
                  <span className="text-xs font-bold text-primary">0{i + 1}</span>
                  <span className="font-semibold text-foreground">{m}</span>
                </li>
              ))}
            </ol>
          </div>
          <figure className="overflow-hidden rounded-3xl border border-border shadow-soft">
            <img
              src={interiorImage}
              alt="Mahindra BE.6 luxury interior with LED screen and premium audio"
              width={1408}
              height={1056}
              loading="lazy"
              className="aspect-[4/3] size-full object-cover transition-transform duration-700 hover:scale-105"
            />
          </figure>
        </div>
      </section>

      {/* Airport Priority Transfers Spotlight */}
      <section className="py-20 md:py-28 bg-card border-b border-border">
        <div className="section-shell grid lg:grid-cols-2 gap-12 items-center">
          <div className="order-2 lg:order-1 overflow-hidden rounded-3xl border border-border shadow-soft">
            <img
              src={eveningImage}
              alt="Orange Taxi waiting at Delhi IGI Airport Terminal Bay"
              width={1920}
              height={1200}
              loading="lazy"
              className="w-full aspect-[4/3] object-cover"
            />
          </div>
          <div className="order-1 lg:order-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
              <Plane className="size-3.5" /> Airport Transfers
            </div>
            <h2 className="display-serif mt-4 text-3xl sm:text-4xl font-bold leading-tight">
              Dedicated pickup bays at Delhi IGI Airport (T1, T2, T3).
            </h2>
            <p className="mt-4 text-sm sm:text-base text-muted-foreground leading-relaxed">
              Never wait in chaotic taxi queues or deal with surging fares after a flight. Our
              chauffeurs monitor your live flight number, adjust for arrival delays, and provide 45
              minutes of complimentary waiting time post touchdown.
            </p>

            <div className="mt-6 space-y-3 text-xs font-semibold">
              <div className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-background">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                Live flight delay tracking & automated chauffeur adjustment
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-background">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                45 minutes complimentary waiting time post landing
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-xl border border-border bg-background">
                <CheckCircle2 className="size-4 text-primary shrink-0" />
                Chauffeur meets you at arrival terminal pillar with luggage assistance
              </div>
            </div>

            <div className="mt-8">
              <Button asChild size="lg" className="font-bold">
                <Link to="/book">
                  Book Airport Transfer <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Enterprise Mobility Spotlight */}
      <section className="bg-primary py-20 text-primary-foreground md:py-24">
        <div className="section-shell grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-primary-foreground/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-primary-foreground">
              <BriefcaseBusiness className="size-3.5" /> Orange for Business
            </div>
            <h2 className="display-serif mt-5 text-4xl sm:text-5xl font-bold leading-tight">
              Elevate your corporate travel with 100% electric luxury.
            </h2>
            <p className="mt-5 text-base sm:text-lg text-primary-foreground/90 max-w-lg leading-relaxed">
              Consolidated monthly GST tax invoices, contracted zero-surge pricing, and audited
              Scope 3 ESG carbon offset reporting for forward-thinking enterprises.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild variant="charcoal" size="lg" className="font-bold shadow-md">
                <Link to="/business">
                  Explore Corporate Mobility <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="bg-transparent border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10"
              >
                <Link to="/talk-to-orange">Talk to Business Desk</Link>
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-2">
            {[
              "100% GST Tax Invoices (SAC 9964)",
              "Contracted Flat Per-KM Rates",
              "VIP Guest & Investor Transfers",
              "Automated Cost-Center Tagging",
              "Quarterly ESG Carbon Reports",
              "24x7 Priority Travel Desk",
            ].map((feature, i) => (
              <div
                key={i}
                className="rounded-xl bg-primary-foreground/10 p-5 border border-primary-foreground/15"
              >
                <span className="text-xs font-mono opacity-60">0{i + 1}</span>
                <p className="mt-2 text-sm font-bold">{feature}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Chauffeur Standard */}
      <section className="py-20 md:py-28 border-b border-border">
        <div className="section-shell grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionIntro
              eyebrow="The People Behind Every Journey"
              title="Great rides start with disciplined people."
              copy="We hire salaried professional chauffeurs with background checks, healthcare, and performance rewards. Because they are treated with respect, they take pride in serving you."
            />
            <div className="mt-8 flex flex-wrap gap-2.5">
              {[
                "Police & Identity Verified",
                "Hospitality Trained",
                "Defensive Driving Certified",
                "Zero Cancellation Guarantee",
                "Fair Salaried Compensation",
              ].map((x) => (
                <span
                  key={x}
                  className="rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold text-foreground shadow-2xs"
                >
                  {x}
                </span>
              ))}
            </div>
            <Button asChild variant="outline" size="lg" className="mt-8 font-semibold">
              <Link to="/drive">
                Drive With Orange <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </div>
          <figure className="overflow-hidden rounded-3xl border border-border shadow-soft">
            <img
              src={driverImage}
              alt="Professional Orange Taxi driver beside a Mahindra BE.6 orange electric car"
              width={1408}
              height={1600}
              loading="lazy"
              className="aspect-[4/5] size-full object-cover"
            />
          </figure>
        </div>
      </section>

      {/* Questions & FAQs Accordion */}
      <section className="py-20 md:py-28 bg-card/40">
        <div className="section-shell grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
          <SectionIntro eyebrow="Common Inquiries" title="Everything you need to know." />
          <Accordion type="single" collapsible className="border-t border-border">
            {FAQS.map(([q, a], i) => (
              <AccordionItem key={q} value={`faq-${i}`}>
                <AccordionTrigger className="py-5 text-left text-base font-semibold hover:no-underline">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="max-w-2xl pb-6 leading-7 text-sm text-muted-foreground">
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Final Callout Banner */}
      <section className="relative overflow-hidden bg-night py-24 text-white text-center">
        <div className="section-shell max-w-2xl relative z-10">
          <h2 className="display-serif text-4xl sm:text-5xl font-normal leading-tight">
            Your next ride deserves a little more.
          </h2>
          <p className="mt-4 text-base text-white/75">
            Mahindra BE.6 · Guaranteed Pre-Cooled AC · Zero Cancellations · Delhi NCR.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3.5">
            <Button asChild size="lg" className="font-bold shadow-md">
              <Link to="/book">
                Book an Orange Ride <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-transparent border-white/20 text-white hover:bg-white/10"
            >
              <Link to="/drive">Drive With Us</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Floating WhatsApp Concierge Button */}
      <WhatsAppConciergeFab />
    </>
  );
}

function SectionIntro({
  eyebrow,
  title,
  copy,
  light = false,
}: {
  eyebrow: string;
  title: string;
  copy?: string;
  light?: boolean;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p>
      <h2
        className={`display-serif mt-3 text-3xl sm:text-4xl lg:text-5xl font-bold leading-tight ${
          light ? "text-white" : "text-foreground"
        }`}
      >
        {title}
      </h2>
      {copy && (
        <p
          className={`mt-4 max-w-xl text-sm sm:text-base leading-relaxed ${
            light ? "text-white/75" : "text-muted-foreground"
          }`}
        >
          {copy}
        </p>
      )}
    </div>
  );
}
