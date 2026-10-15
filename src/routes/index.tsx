// @ts-nocheck
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BatteryCharging,
  BriefcaseBusiness,
  Check,
  Droplets,
  Leaf,
  MonitorPlay,
  Music2,
  Newspaper,
  Snowflake,
  Sparkles,
  UserRoundCheck,
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

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Orange Taxi — Premium Electric Cab Service" },
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
      { name: "twitter:title", content: "Orange Taxi — Premium Electric Cab Service" },
      {
        name: "twitter:description",
        content: "India's premier zero-emission electric taxi service with Mahindra BE.6 SUVs.",
      },
      { name: "twitter:image", content: "https://orange-taxi.com/be6-exterior.jpg" },
    ],
  }),
  component: HomePage,
});

const features = [
  {
    icon: MonitorPlay,
    title: "LED Entertainment Screens",
    text: "In-seat HD screens to keep you entertained throughout your journey.",
  },
  {
    icon: Music2,
    title: "Premium Music System",
    text: "Best-in-class audio system for a seamless, immersive ride experience.",
  },
  {
    icon: Newspaper,
    title: "Daily Newspapers",
    text: "Stay informed with the latest newspapers provided fresh every day.",
  },
  {
    icon: Droplets,
    title: "Complimentary Water",
    text: "A little refreshment, waiting when you arrive.",
  },
  {
    icon: Snowflake,
    title: "Pre-Cooled Cabin",
    text: "Step into a comfortable car, not a hot one.",
  },
  {
    icon: UserRoundCheck,
    title: "Professional Drivers",
    text: "Trained, courteous and committed to better service.",
  },
  {
    icon: Sparkles,
    title: "Mahindra BE.6 Fleet",
    text: "India's finest electric SUV — in signature Orange, exclusively for you.",
  },
];
const amenities = [
  {
    icon: MonitorPlay,
    title: "LED Entertainment",
    text: "Immersive in-seat HD screens for movies, music videos and more.",
    bg: "bg-[#0d0d1a]",
    accent: "text-blue-400",
  },
  {
    icon: Music2,
    title: "Premium Acoustics",
    text: "Best-in-class music system. Your playlist sounds better in an Orange.",
    bg: "bg-[#1a0a00]",
    accent: "text-orange-400",
  },
  {
    icon: Newspaper,
    title: "Daily Newspapers",
    text: "Fresh newspapers every morning. Stay informed, seamlessly.",
    bg: "bg-[#071207]",
    accent: "text-green-400",
  },
];
const moments = [
  "Your car arrives clean and ready.",
  "Your driver greets you professionally.",
  "A bottle of water is waiting.",
  "The cabin is cool and comfortable.",
  "Your journey is quiet and smooth.",
  "You arrive feeling taken care of.",
];
const faqs = [
  [
    "What is Orange Taxi?",
    "Orange Taxi is a premium electric ride service featuring an exclusive fleet of Mahindra BE.6 SUVs in signature orange, designed around comfort, thoughtful hospitality and everyday value.",
  ],
  [
    "What vehicles does Orange Taxi use?",
    "We operate an exclusive fleet of Mahindra BE.6 electric SUVs in signature orange — equipped with LED entertainment screens, premium audio systems and daily newspapers.",
  ],
  [
    "Are all Orange Taxi vehicles electric?",
    "Yes. Every Orange ride is 100% electric — quieter, smoother and greener.",
  ],
  [
    "What in-cab features can I expect?",
    "Every ride includes LED entertainment screens, a premium music system and fresh daily newspapers — making your journey as enjoyable as the destination.",
  ],
  [
    "How is Orange Taxi different from regular cabs?",
    "We bring together a premium Mahindra BE.6 SUV, professional driver and luxury in-cab amenities in every journey.",
  ],
  [
    "How much does an Orange ride cost?",
    "Fares will be shown clearly before you confirm a ride. We aim to make premium service accessible for regular journeys.",
  ],
  [
    "Where is Orange Taxi available?",
    "Currently serving Delhi, Gurugram, Noida, Ghaziabad and Faridabad — including IGI Airport.",
  ],
  [
    "How can I become an Orange driver?",
    "Visit our Drive With Us page to learn about the role and register your interest.",
  ],
  [
    "Do you offer corporate transportation?",
    "Yes. Orange for Business is designed for employee travel, airport transfers, guest transport and centralized ride management.",
  ],
];

function HomePage() {
  const { t } = useTranslation();
  return (
    <>
      <section className="relative min-h-[calc(100svh-8rem)] overflow-hidden bg-night text-white">
        <img
          src={heroImage}
          alt="Mahindra BE.6 orange electric SUV on a premium city boulevard"
          width={1920}
          height={1280}
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover object-[62%_center]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--night)_0%,color-mix(in_oklab,var(--night)_84%,transparent)_35%,transparent_72%)]" />
        <div className="section-shell relative flex min-h-[calc(100svh-8rem)] items-end py-10 md:items-center md:py-20">
          <div className="max-w-2xl ">
            <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-white/70">
              Mahindra BE.6 · Exclusive Fleet
            </p>
            <h1 className="display-serif text-[clamp(2.85rem,7vw,6.8rem)] leading-[0.92] text-white">
              Premium rides.
              <br />
              <span className="text-primary">Without the premium price.</span>
            </h1>
            <p className="mt-7 max-w-xl text-base leading-7 text-white/80 md:text-lg">
              India's finest electric SUV — with LED screens, premium audio and daily newspapers —
              designed to make every journey extraordinary.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 sm:flex-row sm:items-center">
              <Button asChild size="lg" className="shadow-md font-bold">
                <Link to="/book">
                  Book a Ride <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                className="bg-white text-neutral-900 hover:bg-white/90 shadow-sm font-semibold"
              >
                <Link to="/login" search={{ mode: "signup" }}>
                  Sign Up
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/experience">Explore Experience</Link>
              </Button>
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 right-0 hidden border-l border-t border-white/20 bg-night/70 px-7 py-5 backdrop-blur-md md:block">
          <p className="text-xs uppercase tracking-[0.14em] text-white/50">Exclusive fleet</p>
          <p className="mt-1 text-sm font-semibold text-white">Mahindra BE.6 · Signature Orange</p>
        </div>
      </section>

      {/* In-Cab Amenities Showcase */}
      <section className="bg-background py-24 text-foreground border-y border-border dark:bg-night dark:text-white dark:border-white/10 md:py-32">
        <div className="section-shell">
          <SectionIntro
            eyebrow="What's inside every Orange"
            title="The experience starts the moment you sit down."
            copy="Every Mahindra BE.6 in our fleet is fitted with the finest amenities to make your journey as enjoyable as your destination."
          />
          <div className="mt-14 grid gap-4 md:grid-cols-3">
            {amenities.map(({ icon: Icon, title, text, bg, accent }) => (
              <article
                key={title}
                className={`rounded-2xl border border-border bg-card p-8 flex flex-col gap-6 min-h-64 shadow-sm dark:${bg} dark:border-white/10`}
              >
                <span
                  className={`grid size-12 place-items-center rounded-full bg-primary/10 text-primary dark:bg-white/10 ${accent}`}
                >
                  <Icon className="size-6" />
                </span>
                <div>
                  <h3 className={`text-xl font-bold text-card-foreground dark:${accent}`}>
                    {title}
                  </h3>
                  <p className="mt-3 text-sm leading-6 text-muted-foreground dark:text-white/70">
                    {text}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="section-shell">
          <SectionIntro
            eyebrow="The Orange difference"
            title="More than a ride."
            copy="It's the little things that make a journey feel different."
          />
          <div className="mt-14 grid border-y border-border md:grid-cols-2 lg:grid-cols-4">
            {features.slice(0, 4).map(({ icon: Icon, title, text }, i) => (
              <article
                key={title}
                className="border-b border-border p-6 last:border-b-0 md:[&:nth-child(odd)]:border-r lg:border-b-0 lg:border-r lg:last:border-r-0"
              >
                <span className="grid size-11 place-items-center rounded-full bg-warm text-primary">
                  <Icon className="size-5" />
                </span>
                <p className="mt-12 text-xs text-muted-foreground">0{i + 1}</p>
                <h3 className="mt-3 text-lg font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="bg-warm py-24 md:py-32">
        <div className="section-shell grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionIntro
              eyebrow="The Orange experience"
              title="The premium experience, made everyday."
              copy="From the moment your car arrives to the moment you step out, every detail is considered."
            />
            <ol className="mt-10 grid gap-1">
              {moments.map((m, i) => (
                <li
                  key={m}
                  className="grid grid-cols-[2.5rem_1fr] items-center border-t border-border py-4 text-sm"
                >
                  <span className="text-xs text-primary">0{i + 1}</span>
                  <span className="font-semibold">{m}</span>
                </li>
              ))}
            </ol>
          </div>
          <figure className="overflow-hidden rounded-[var(--radius-xl)] shadow-soft">
            <img
              src={interiorImage}
              alt="Mahindra BE.6 luxury interior with LED screen and premium audio"
              width={1408}
              height={1056}
              loading="lazy"
              className="aspect-[4/3] size-full object-cover transition-transform duration-700 hover:scale-[1.02]"
            />
          </figure>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="section-shell">
          <SectionIntro
            eyebrow="Everyday value"
            title="Premium shouldn't mean overpriced."
            copy="Orange is designed to bring the care and comfort of a premium service into the rhythm of everyday travel."
          />
          <div className="mt-14 grid items-stretch gap-4 lg:grid-cols-3">
            <Comparison
              title="Everyday Cab"
              label="Gets you there"
              items={["Basic transportation", "Standard service"]}
            />
            <Comparison
              featured
              title="Orange Taxi"
              label="Premium experience · Accessible price"
              items={[
                "Mahindra BE.6 Electric SUV",
                "LED Entertainment Screen",
                "Premium Music System",
                "Daily Newspapers",
                "Professional Driver",
              ]}
            />
            <Comparison
              title="Luxury Chauffeur"
              label="An occasional indulgence"
              items={["Premium experience", "Significantly higher price"]}
            />
          </div>
          <p className="mt-7 text-center text-xs text-muted-foreground">
            Illustrative service comparison only. Fares vary by journey and location.
          </p>
        </div>
      </section>

      <section className="bg-sage py-24 md:py-32">
        <div className="section-shell grid gap-12 lg:grid-cols-2 lg:items-center">
          <figure className="relative overflow-hidden rounded-[var(--radius-xl)]">
            <img
              src={heroImage}
              alt="Mahindra BE.6 orange electric SUV on a premium city road"
              width={1920}
              height={1280}
              loading="lazy"
              className="aspect-[5/4] size-full object-cover object-[65%_center]"
            />
            <figcaption className="absolute bottom-5 left-5 rounded-full bg-background/90 px-4 py-2 text-xs font-bold text-sage-foreground backdrop-blur">
              100% electric · Mahindra BE.6
            </figcaption>
          </figure>
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sage-foreground">
              Electric by nature
            </p>
            <h2 className="display-serif mt-4 text-5xl leading-none md:text-6xl">
              Quiet rides.
              <br />
              Cleaner cities.
            </h2>
            <p className="mt-6 max-w-lg leading-7 text-sage-foreground">
              Every Orange ride is powered by the Mahindra BE.6 — giving you a quieter, smoother,
              emission-free journey.
            </p>
            <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-sage-foreground/15">
              {[
                [BatteryCharging, "100% Electric Fleet"],
                [Sparkles, "Quiet & Smooth"],
                [Leaf, "Lower Emissions"],
                [ArrowRight, "Mahindra BE.6 Exclusive"],
              ].map(([I, t]) => {
                const Icon = I as typeof Leaf;
                return (
                  <div key={t as string} className="bg-sage p-5">
                    <Icon className="size-5" />
                    <p className="mt-5 text-sm font-bold">{t as string}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="bg-card py-24 text-card-foreground border-b border-border dark:bg-night dark:text-white dark:border-white/10 md:py-32">
        <div className="section-shell">
          <SectionIntro
            eyebrow="Our fleet"
            title="Meet your Orange."
            copy="The Mahindra BE.6 — India's finest electric SUV, in signature orange, exclusively for you."
          />
          <div className="mt-14 grid overflow-hidden rounded-xl border border-border bg-background dark:border-white/15 dark:bg-card lg:grid-cols-[1.35fr_0.65fr]">
            <img
              src={heroImage}
              alt="Mahindra BE.6 orange electric SUV at night"
              width={1920}
              height={1200}
              loading="lazy"
              className="h-full min-h-[26rem] w-full object-cover"
            />
            <div className="flex flex-col p-7 md:p-10">
              <p className="text-xs uppercase tracking-[0.16em] text-primary">Mahindra BE.6</p>
              <h3 className="display-serif mt-3 text-4xl text-foreground dark:text-white">
                Signature Orange EV SUV
              </h3>
              <ul className="mt-8 space-y-4 text-sm text-muted-foreground dark:text-white/75">
                {[
                  "LED Entertainment Screen",
                  "Premium Music System",
                  "Daily Newspapers",
                  "Complimentary Water",
                  "Pre-cooled Cabin",
                  "Professional Driver",
                  "Zero Emissions · 100% Electric",
                ].map((x) => (
                  <li key={x} className="flex items-center gap-3">
                    <Check className="size-4 text-primary" />
                    {x}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-10 lg:mt-auto">
                <Link to="/book">
                  Book Your Orange <ArrowRight />
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="py-24 md:py-32">
        <div className="section-shell grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionIntro
              eyebrow="The people behind every ride"
              title="Great rides start with great people."
              copy="We work with professionally trained drivers and focus on the kind of consistent service that earns your trust, journey after journey."
            />
            <div className="mt-8 flex flex-wrap gap-2">
              {[
                "Professional training",
                "Customer-first service",
                "Safety-focused driving",
                "Service standards",
                "Fair performance model",
              ].map((x) => (
                <span
                  key={x}
                  className="rounded-full border border-border px-4 py-2 text-xs font-semibold"
                >
                  {x}
                </span>
              ))}
            </div>
            <Button asChild variant="charcoal" size="lg" className="mt-9">
              <Link to="/drive">
                Drive With Orange <ArrowRight />
              </Link>
            </Button>
          </div>
          <figure className="overflow-hidden rounded-[var(--radius-xl)]">
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

      <section className="bg-primary py-20 text-primary-foreground md:py-24">
        <div className="section-shell grid gap-10 lg:grid-cols-[1fr_1.1fr] lg:items-end">
          <div>
            <BriefcaseBusiness className="size-8" />
            <h2 className="display-serif mt-7 text-5xl leading-none md:text-6xl">
              Better rides for your business.
            </h2>
            <p className="mt-5 max-w-lg leading-7 text-primary-foreground/80">
              Give your employees, clients and guests the luxury of a Mahindra BE.6 Orange ride —
              with LED entertainment and premium audio.
            </p>
            <Button asChild variant="charcoal" size="lg" className="mt-8">
              <Link to="/talk-to-orange">
                Talk to Orange <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="grid grid-cols-2 gap-px border border-primary-foreground/25 sm:grid-cols-3">
            {[
              "Corporate bookings",
              "Employee transportation",
              "Airport transfers",
              "Client transportation",
              "Centralized billing",
              "Ride management",
            ].map((x, i) => (
              <div key={x} className="min-h-28 p-5">
                <span className="text-xs text-primary-foreground/50">0{i + 1}</span>
                <p className="mt-4 text-sm font-bold">{x}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-24 md:py-28">
        <div className="section-shell">
          <SectionIntro eyebrow="Simple from the start" title="How it works." />
          <div className="mt-12 grid border-y border-border md:grid-cols-3">
            {[
              ["01", "Book", "Choose where you're going."],
              ["02", "Ride", "Your Mahindra BE.6 arrives."],
              ["03", "Enjoy", "Sink back. Screen on. Music playing."],
            ].map(([n, t, d]) => (
              <div
                key={n}
                className="border-b border-border py-8 md:border-b-0 md:border-r md:px-8 md:first:pl-0 md:last:border-r-0"
              >
                <span className="display-serif text-5xl text-primary">{n}</span>
                <h3 className="mt-8 text-xl font-bold">{t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>



      <section className="py-24 md:py-32">
        <div className="section-shell grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
          <SectionIntro eyebrow="Good to know" title="Questions, answered." />
          <Accordion type="single" collapsible className="border-t border-border">
            {faqs.map(([q, a], i) => (
              <AccordionItem key={q} value={`faq-${i}`}>
                <AccordionTrigger className="py-6 text-left text-base hover:no-underline">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="max-w-2xl pb-6 leading-7 text-muted-foreground">
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      <section className="relative overflow-hidden bg-background py-28 text-foreground border-t border-border dark:bg-night dark:text-white md:py-40">
        <img
          src={heroImage}
          alt="Mahindra BE.6 orange electric SUV ready for an evening journey"
          width={1920}
          height={1200}
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
        <div className="absolute inset-0 bg-background/85 dark:bg-night/70" />
        <div className="section-shell relative">
          <div className="max-w-2xl">
            <h2 className="display-serif text-5xl leading-none text-foreground dark:text-white md:text-7xl">
              Your next ride deserves a little more.
            </h2>
            <p className="mt-6 text-muted-foreground dark:text-white/80">
              Mahindra BE.6 · LED Entertainment · Premium Audio · Daily Newspapers.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link to="/book">
                  Book Your Orange <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link to="/drive">Drive With Orange</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
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
      <p className={`text-xs font-bold uppercase tracking-[0.18em] text-primary`}>{eyebrow}</p>
      <h2
        className={`display-serif mt-4 text-5xl leading-none md:text-6xl ${light ? "text-white" : "text-foreground"}`}
      >
        {title}
      </h2>
      {copy && (
        <p
          className={`mt-5 max-w-xl leading-7 ${light ? "text-white/75" : "text-muted-foreground"}`}
        >
          {copy}
        </p>
      )}
    </div>
  );
}
function Comparison({
  title,
  label,
  items,
  featured = false,
}: {
  title: string;
  label: string;
  items: string[];
  featured?: boolean;
}) {
  return (
    <article
      className={`flex min-h-72 flex-col rounded-lg border p-7 ${featured ? "border-primary bg-primary text-primary-foreground shadow-brand-lg lg:-translate-y-4" : "border-border bg-card"}`}
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-60">{label}</p>
      <h3 className="display-serif mt-3 text-3xl">{title}</h3>
      <ul className="mt-auto space-y-3 pt-10 text-sm">
        {items.map((x) => (
          <li key={x} className="flex gap-3">
            <Check className="size-4 shrink-0" />
            {x}
          </li>
        ))}
      </ul>
    </article>
  );
}
