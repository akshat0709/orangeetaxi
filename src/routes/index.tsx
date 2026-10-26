import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  Check,
  Droplets,
  MonitorPlay,
  Music2,
  Newspaper,
  Snowflake,
  UserRoundCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
    title: "Cool before you get in",
    text: "The AC is switched on about 10 minutes before pickup, so the cabin is already at 22°C.",
  },
  {
    icon: MonitorPlay,
    title: "A screen in the back seat",
    text: "Follow the route and arrival time, catch up on news, or watch something on the way.",
  },
  {
    icon: Music2,
    title: "Your music, or silence",
    text: "Play your own playlist over Bluetooth, or ask for a quiet ride when you need to think.",
  },
  {
    icon: Newspaper,
    title: "Today's newspaper",
    text: "A national and a business paper in the seat pocket, replaced every morning.",
  },
  {
    icon: Droplets,
    title: "Cold water, sealed",
    text: "A sealed bottle of chilled water in the door for every passenger.",
  },
  {
    icon: UserRoundCheck,
    title: "Chauffeurs, not gig drivers",
    text: "Salaried, background-checked and trained in defensive driving and hospitality.",
  },
];

const MOMENTS = [
  "An orange Mahindra BE.6 arrives clean, with the AC already on.",
  "Your chauffeur greets you by name and helps with your bags.",
  "Water and the morning paper are waiting at your seat.",
  "The rear screen shows your route and arrival time.",
  "The electric drive is smooth and almost silent.",
  "You arrive, and the GST invoice is already in your inbox.",
];

const FAQS = [
  [
    "What is Orange Taxi?",
    "Orange Taxi is an electric chauffeur service in Delhi NCR. Every ride is in a Mahindra BE.6 electric SUV, with a salaried chauffeur, the AC on before you get in, and a fare you see before you book.",
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
    "Each fare is a base fare plus a per-kilometre rate (with a minimum fare), plus GST and any platform fee or surge in effect. The exact fare is shown before you book.",
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
  return (
    <>
      {/* Hero */}
      <section className="relative min-h-[calc(100svh-4.5rem)] overflow-hidden bg-night text-white flex items-center">
        <img
          src={heroImage}
          alt="Orange Mahindra BE.6 electric SUV on a city street at dusk"
          width={1920}
          height={1280}
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover object-[62%_center] opacity-80"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--night)_0%,color-mix(in_oklab,var(--night)_85%,transparent)_42%,transparent_78%)]" />

        <div className="section-shell relative z-10 py-16 md:py-24">
          <div className="max-w-2xl">
            <p className="text-sm font-medium text-white/70">
              Electric chauffeur rides · Delhi NCR
            </p>

            <h1 className="display-serif mt-5 text-[clamp(2.75rem,6.2vw,5.5rem)] leading-[0.95] text-white">
              Premium rides.
              <br />
              <span className="text-primary">Without the premium price.</span>
            </h1>

            <p className="mt-6 max-w-lg text-base leading-7 text-white/80 md:text-lg">
              A quiet electric SUV with the AC already on, a screen in the back seat and the morning
              paper, at everyday cab prices.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" className="font-semibold">
                <Link to="/book">
                  Book a ride <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="bg-transparent border-white/30 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/experience">See what&apos;s inside</Link>
              </Button>
            </div>

            <ul className="mt-12 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/70">
              {["Drivers don't cancel on you", "Fare shown before you book", "100% electric"].map(
                (x) => (
                  <li key={x} className="flex items-center gap-2">
                    <Check className="size-4 text-primary" aria-hidden="true" />
                    {x}
                  </li>
                ),
              )}
            </ul>
          </div>
        </div>
      </section>

      {/* In the car */}
      <section className="py-20 md:py-28 border-b border-border">
        <div className="section-shell">
          <SectionIntro
            eyebrow="In the car"
            title="The ride starts the moment you sit down."
            copy="Every car in the fleet is the same Mahindra BE.6, set up the same way."
          />

          <div className="mt-14 grid gap-x-12 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
            {IN_CAB_AMENITIES.map(({ icon: Icon, title, text }) => (
              <div key={title} className="border-t border-border pt-6">
                <Icon className="size-5 text-primary" aria-hidden="true" />
                <h3 className="mt-4 text-base font-semibold text-foreground">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How a ride goes */}
      <section className="bg-warm/60 py-20 md:py-28 border-b border-border">
        <div className="section-shell grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
          <div>
            <SectionIntro eyebrow="How a ride goes" title="Calm from pickup to drop-off." />
            <ol className="mt-10">
              {MOMENTS.map((m, i) => (
                <li
                  key={m}
                  className="grid grid-cols-[2.25rem_1fr] items-baseline border-t border-border py-4 text-[0.95rem]"
                >
                  <span className="text-sm font-semibold tabular-nums text-primary">{i + 1}</span>
                  <span className="text-foreground">{m}</span>
                </li>
              ))}
            </ol>
          </div>
          <figure className="overflow-hidden rounded-2xl">
            <img
              src={interiorImage}
              alt="Rear cabin of the Mahindra BE.6 with the passenger screen and a newspaper"
              width={1408}
              height={1056}
              loading="lazy"
              className="aspect-[4/3] size-full object-cover"
            />
          </figure>
        </div>
      </section>

      {/* Airport */}
      <section className="py-20 md:py-28 border-b border-border">
        <div className="section-shell grid lg:grid-cols-2 gap-12 items-center">
          <figure className="order-2 lg:order-1 overflow-hidden rounded-2xl">
            <img
              src={eveningImage}
              alt="Orange Taxi waiting outside a terminal at night"
              width={1920}
              height={1200}
              loading="lazy"
              className="w-full aspect-[4/3] object-cover"
            />
          </figure>
          <div className="order-1 lg:order-2">
            <SectionIntro
              eyebrow="Airport transfers"
              title="Delhi IGI, all three terminals."
              copy="Give us your flight number. Your chauffeur tracks it, adjusts for delays and waits for you."
            />
            <ul className="mt-8 space-y-3 text-[0.95rem] text-foreground">
              {[
                "Flight tracking, so a late landing isn't your problem",
                "45 minutes of free waiting after touchdown",
                "Met at your terminal pillar, with help for your bags",
              ].map((x) => (
                <li key={x} className="flex gap-3">
                  <Check className="mt-1 size-4 shrink-0 text-primary" aria-hidden="true" />
                  {x}
                </li>
              ))}
            </ul>
            <Button asChild size="lg" className="mt-9 font-semibold">
              <Link to="/book">
                Book an airport ride <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Business */}
      <section className="bg-night py-20 text-white md:py-24">
        <div className="section-shell grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
          <div>
            <SectionIntro
              light
              eyebrow="Orange for Business"
              title="Company travel, on one monthly invoice."
              copy="Per-kilometre rates agreed upfront, GST invoices your finance team can use, and carbon reports for your ESG filings."
            />
            <div className="mt-8 flex flex-wrap gap-3">
              <Button asChild size="lg" className="font-semibold">
                <Link to="/business">
                  Orange for Business <ArrowRight className="ml-1.5 size-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="bg-transparent border-white/25 text-white hover:bg-white/10 hover:text-white"
              >
                <Link to="/talk-to-orange">Talk to us</Link>
              </Button>
            </div>
          </div>

          <ul className="grid gap-x-8 sm:grid-cols-2">
            {[
              "GST invoices (SAC 9964)",
              "Fixed per-km rates",
              "Guest & client transfers",
              "Cost-centre tagging",
              "Quarterly carbon reports",
              "24x7 travel desk",
            ].map((feature) => (
              <li
                key={feature}
                className="flex items-center gap-3 border-t border-white/10 py-4 text-[0.95rem] text-white/85"
              >
                <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Chauffeurs */}
      <section className="py-20 md:py-28 border-b border-border">
        <div className="section-shell grid gap-12 lg:grid-cols-2 lg:items-center">
          <div>
            <SectionIntro
              eyebrow="Our chauffeurs"
              title="Good rides come from people who are treated well."
              copy="Our chauffeurs are salaried, with healthcare and performance pay. They're background-checked and trained before their first ride."
            />
            <ul className="mt-8 grid gap-x-8 gap-y-3 text-[0.95rem] text-foreground sm:grid-cols-2">
              {[
                "Police and ID verified",
                "Hospitality training",
                "Defensive driving certified",
                "Salaried, not per-trip",
              ].map((x) => (
                <li key={x} className="flex items-center gap-3">
                  <Check className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  {x}
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" size="lg" className="mt-9 font-semibold">
              <Link to="/drive">
                Drive with Orange <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
          </div>
          <figure className="overflow-hidden rounded-2xl bg-muted">
            <img
              src={driverImage}
              alt="Orange Taxi chauffeur standing beside an orange Mahindra BE.6"
              width={1408}
              height={1600}
              loading="lazy"
              className="aspect-[4/5] size-full object-cover"
            />
          </figure>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 md:py-28">
        <div className="section-shell grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
          <SectionIntro eyebrow="Questions" title="Good to know." />
          <Accordion type="single" collapsible className="border-t border-border">
            {FAQS.map(([q, a], i) => (
              <AccordionItem key={q} value={`faq-${i}`}>
                <AccordionTrigger className="py-5 text-left text-base font-semibold hover:no-underline">
                  {q}
                </AccordionTrigger>
                <AccordionContent className="max-w-2xl pb-6 leading-7 text-[0.95rem] text-muted-foreground">
                  {a}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </div>
      </section>

      {/* Closing call to action */}
      <section className="bg-warm py-20 md:py-24 border-t border-border">
        <div className="section-shell flex flex-col gap-8 md:flex-row md:items-end md:justify-between">
          <h2 className="display-serif max-w-xl text-4xl leading-tight sm:text-5xl">
            Your next ride deserves a little more.
          </h2>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="font-semibold">
              <Link to="/book">
                Book a ride <ArrowRight className="ml-1.5 size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/drive">Drive with us</Link>
            </Button>
          </div>
        </div>
      </section>

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
      <p className="text-sm font-medium text-primary">{eyebrow}</p>
      <h2
        className={`display-serif mt-3 text-3xl sm:text-4xl lg:text-[2.75rem] leading-[1.1] ${
          light ? "text-white" : "text-foreground"
        }`}
      >
        {title}
      </h2>
      {copy && (
        <p
          className={`mt-4 max-w-xl text-base leading-7 ${
            light ? "text-white/75" : "text-muted-foreground"
          }`}
        >
          {copy}
        </p>
      )}
    </div>
  );
}
