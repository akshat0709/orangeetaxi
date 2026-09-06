import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, CalendarClock, Check, Droplets, MapPin, Navigation, ShieldCheck, Snowflake, Sparkles, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import passengerImage from "@/assets/orange-taxi-passenger.jpg";
import interiorImage from "@/assets/orange-taxi-interior.jpg";
import eveningImage from "@/assets/orange-taxi-evening.jpg";

export const Route = createFileRoute("/book")({
  head: () => ({ meta: [
    { title: "Book a Ride — Orange Taxi" },
    { name: "description", content: "The Orange Taxi passenger experience: premium electric cars, professional drivers and thoughtful service — without the premium price." },
    { property: "og:title", content: "Book a Ride — Orange Taxi" },
    { property: "og:description", content: "Premium comfort, thoughtful service and electric rides made accessible. Booking opens soon." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ]}), component: PassengerPage,
});

const comforts = [
  { icon: Droplets, title: "Complimentary Water", text: "A chilled bottle is always waiting in your Orange." },
  { icon: Snowflake, title: "Pre-Cooled Cabin", text: "Your car is cooled before you step in — every time." },
  { icon: UserRoundCheck, title: "Professional Drivers", text: "Trained, courteous drivers who take pride in service." },
  { icon: Sparkles, title: "Premium Electric Vehicles", text: "Quiet, smooth, spotless cars designed for comfort." },
  { icon: ShieldCheck, title: "A Safer Journey", text: "Considered safety standards across every Orange ride." },
  { icon: CalendarClock, title: "On Your Schedule", text: "Reliable, punctual service for everyday journeys." },
];

const flow = [
  { icon: MapPin, step: "01", title: "Set your journey", text: "Choose your pickup and destination in the Orange app." },
  { icon: Navigation, step: "02", title: "Meet your Orange", text: "Your driver arrives in a prepared, pre-cooled electric car." },
  { icon: Sparkles, step: "03", title: "Enjoy the ride", text: "Water, quiet comfort and a smooth journey to your door." },
];

function PassengerPage() {
  return <>
    <section className="relative overflow-hidden bg-night text-background">
      <img src={passengerImage} alt="A relaxed passenger enjoying the premium cabin of an Orange electric taxi" width={1408} height={1056} fetchPriority="high" className="absolute inset-0 size-full object-cover object-[70%_center]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--night)_0%,color-mix(in_oklab,var(--night)_82%,transparent)_42%,transparent_78%)]" />
      <div className="section-shell relative flex min-h-[calc(100svh-8rem)] items-end py-10 md:items-center md:py-20">
        <div className="max-w-2xl animate-gentle-rise">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-background/70">For passengers</p>
          <h1 className="display-serif text-[clamp(2.85rem,7vw,6.2rem)] leading-[0.92]">Every ride,<br/><span className="text-primary">taken care of.</span></h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-background/75 md:text-lg">A premium electric car, a professional driver and the little details done right — designed to be your everyday way to travel, not an occasional treat.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg"><a href="#booking">Book a Ride <ArrowRight /></a></Button>
            <Button asChild size="lg" variant="light"><Link to="/experience">Explore the Experience</Link></Button>
          </div>
        </div>
      </div>
    </section>

    <section className="py-24 md:py-32"><div className="section-shell">
      <Intro eyebrow="What you can expect" title="Comfort in every detail." copy="Orange is built around a simple idea: premium shouldn't be rare. These are the standards that come with every ride." />
      <div className="mt-14 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
        {comforts.map(({ icon: Icon, title, text }) => <article key={title} className="bg-background p-7">
          <span className="grid size-11 place-items-center rounded-full bg-warm text-primary"><Icon className="size-5" /></span>
          <h2 className="mt-10 text-lg font-bold">{title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
        </article>)}
      </div>
    </div></section>

    <section className="bg-warm py-24 md:py-32"><div className="section-shell grid gap-12 lg:grid-cols-[1.05fr_0.95fr] lg:items-center">
      <figure className="overflow-hidden rounded-[var(--radius-xl)] shadow-soft"><img src={interiorImage} alt="Calm premium Orange cabin with complimentary chilled water" width={1408} height={1056} loading="lazy" className="aspect-[4/3] size-full object-cover transition-transform duration-700 hover:scale-[1.02]" /></figure>
      <div>
        <Intro eyebrow="How booking works" title="Three steps to a better journey." copy="Booking an Orange is designed to feel as effortless as the ride itself." />
        <ol className="mt-10 space-y-1">
          {flow.map(({ icon: Icon, step, title, text }) => <li key={step} className="grid grid-cols-[3rem_1fr] gap-4 border-t border-border py-6">
            <span className="grid size-10 place-items-center rounded-full bg-background text-primary"><Icon className="size-4" /></span>
            <div><p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">Step {step}</p><h3 className="mt-1.5 text-lg font-bold">{title}</h3><p className="mt-1 text-sm leading-6 text-muted-foreground">{text}</p></div>
          </li>)}
        </ol>
      </div>
    </div></section>

    <section id="booking" className="bg-night py-24 text-background md:py-32"><div className="section-shell grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Book your Orange</p>
        <h2 className="display-serif mt-4 text-5xl leading-none md:text-6xl">Booking opens soon.</h2>
        <p className="mt-6 max-w-lg leading-7 text-background/65">The Orange passenger app is on its way. Live booking, clear fares shown before you confirm, and ride tracking will all arrive here and in the app.</p>
        <div className="mt-8 max-w-md rounded-xl border border-background/15 bg-background/5 p-6">
          <p className="text-sm font-bold">Preview only</p>
          <p className="mt-2 text-sm leading-6 text-background/60">No rides can be booked and no details are collected yet. When Orange launches in your city, this page will connect directly to the passenger app.</p>
        </div>
        <Button asChild size="lg" className="mt-8"><Link to="/contact">Get Launch Updates <ArrowRight /></Link></Button>
      </div>
      <figure className="overflow-hidden rounded-[var(--radius-xl)]"><img src={eveningImage} alt="Orange premium electric sedan waiting at an evening destination" width={1920} height={1200} loading="lazy" className="aspect-[5/4] size-full object-cover" /></figure>
    </div></section>

    <section className="py-24 md:py-32"><div className="section-shell">
      <Intro eyebrow="One class, done right" title="Orange Premium." copy="A single, carefully considered service class — so every Orange ride meets the same standard." />
      <ul className="mt-12 grid gap-y-4 border-t border-border pt-10 text-sm font-semibold sm:grid-cols-2 lg:grid-cols-3">
        {["Spacious premium cabin","Air conditioning, always on","Complimentary water on board","Trained professional driver","Quiet, smooth electric ride","Clear fare before you confirm"].map((x) => <li key={x} className="flex items-center gap-3"><Check className="size-4 text-primary" />{x}</li>)}
      </ul>
    </div></section>
  </>;
}

function Intro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p><h2 className="display-serif mt-4 text-5xl leading-none md:text-6xl">{title}</h2>{copy && <p className="mt-5 max-w-xl leading-7 text-muted-foreground">{copy}</p>}</div>;
}
