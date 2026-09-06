import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight, BadgeIndianRupee, Check, ClipboardCheck, Gauge, GraduationCap, HandHeart, HeartPulse, ShieldCheck, TrendingUp, Trophy } from "lucide-react";
import { Button } from "@/components/ui/button";
import driverAppImage from "@/assets/orange-taxi-driver-app.jpg";
import driverImage from "@/assets/orange-taxi-driver.jpg";

export const Route = createFileRoute("/drive")({
  head: () => ({ meta: [
    { title: "Drive With Orange — Orange Taxi" },
    { name: "description", content: "A fair, professional driving career with Orange Taxi: fixed salary, performance rewards, training and respect. Applications open soon." },
    { property: "og:title", content: "Drive With Orange — Orange Taxi" },
    { property: "og:description", content: "Fixed salary, milestone rewards and a professional driving career — built on respect." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ]}), component: DriverPage,
});

const benefits = [
  { icon: BadgeIndianRupee, title: "Fixed Salary", text: "A dependable income you can plan your life around — not a gamble on every trip." },
  { icon: TrendingUp, title: "Performance Incentives", text: "Great service is rewarded with performance-based incentives on top of your salary." },
  { icon: Trophy, title: "Milestone Rewards", text: "Consistent excellence is celebrated with milestone bonuses as you grow with Orange." },
  { icon: GraduationCap, title: "Professional Training", text: "Structured training in hospitality, safe driving and the Orange service standard." },
  { icon: HeartPulse, title: "Respect & Wellbeing", text: "Humane schedules and a team that treats you as a professional, not a number." },
  { icon: ShieldCheck, title: "A Safer Workplace", text: "Well-maintained electric vehicles and safety standards that protect you too." },
];

const journey = [
  ["01", "Register your interest", "Tell us you'd like to drive with Orange when applications open in your city."],
  ["02", "Meet & verify", "A friendly conversation, document verification and a driving assessment."],
  ["03", "Train with Orange", "Learn the Orange service standard — hospitality, safety and vehicle care."],
  ["04", "Start earning", "Begin with a fixed salary and grow through performance and milestone rewards."],
];

const requirements = [
  "Valid driving licence",
  "Clean driving record",
  "A courteous, customer-first attitude",
  "Commitment to the Orange service standard",
];

function DriverPage() {
  return <>
    <section className="relative overflow-hidden bg-night text-background">
      <img src={driverAppImage} alt="A professional Orange Taxi driver standing beside his orange electric car" width={1408} height={1056} fetchPriority="high" className="absolute inset-0 size-full object-cover object-[68%_center]" />
      <div className="absolute inset-0 bg-[linear-gradient(90deg,var(--night)_0%,color-mix(in_oklab,var(--night)_82%,transparent)_42%,transparent_78%)]" />
      <div className="section-shell relative flex min-h-[calc(100svh-8rem)] items-end py-10 md:items-center md:py-20">
        <div className="max-w-2xl animate-gentle-rise">
          <p className="mb-5 text-xs font-bold uppercase tracking-[0.18em] text-background/70">For drivers</p>
          <h1 className="display-serif text-[clamp(2.85rem,7vw,6.2rem)] leading-[0.92]">Drive with dignity.<br/><span className="text-primary">Earn with stability.</span></h1>
          <p className="mt-7 max-w-xl text-base leading-7 text-background/75 md:text-lg">A professional driving career built on a fixed salary, performance rewards and genuine respect — not per-trip commissions and endless uncertainty.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg"><a href="#join">Join Orange <ArrowRight /></a></Button>
            <Button asChild size="lg" variant="light"><a href="#earnings">How earning works</a></Button>
          </div>
        </div>
      </div>
    </section>

    <section id="earnings" className="py-24 md:py-32"><div className="section-shell">
      <Intro eyebrow="The Orange earning model" title="Stability first. Rewards always." copy="Orange drivers are professionals with a dependable income — and great service is always rewarded on top." />
      <div className="mt-14 grid gap-4 lg:grid-cols-3">
        <article className="flex min-h-72 flex-col rounded-lg border border-primary bg-primary p-7 text-primary-foreground shadow-brand-lg">
          <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-70">The foundation</p>
          <h3 className="display-serif mt-3 text-3xl">Fixed Salary</h3>
          <p className="mt-4 text-sm leading-6 text-primary-foreground/85">A predictable monthly income that doesn't depend on luck, surge pricing or chasing trips across the city.</p>
          <p className="mt-auto pt-8 text-xs text-primary-foreground/60">Salary details will be shared when applications open in your city.</p>
        </article>
        <article className="flex min-h-72 flex-col rounded-lg border border-border bg-card p-7">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">For great service</p>
          <h3 className="display-serif mt-3 text-3xl">Performance Incentives</h3>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">Ratings, punctuality and service quality translate into regular performance incentives — the better you serve, the more you earn.</p>
          <p className="mt-auto pt-8 text-xs text-muted-foreground">Incentive structure to be announced.</p>
        </article>
        <article className="flex min-h-72 flex-col rounded-lg border border-border bg-card p-7">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-muted-foreground">For consistency</p>
          <h3 className="display-serif mt-3 text-3xl">Milestone Rewards</h3>
          <p className="mt-4 text-sm leading-6 text-muted-foreground">Reaching service milestones with Orange unlocks bonuses that recognise your loyalty and craft over time.</p>
          <p className="mt-auto pt-8 text-xs text-muted-foreground">Milestone program to be announced.</p>
        </article>
      </div>
    </div></section>

    <section className="bg-warm py-24 md:py-32"><div className="section-shell grid gap-12 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
      <div>
        <Intro eyebrow="Why drivers choose Orange" title="A career, not a hustle." copy="We believe great rides start with drivers who are rested, respected and fairly paid." />
        <div className="mt-10 grid gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-2">
          {benefits.map(({ icon: Icon, title, text }) => <article key={title} className="bg-warm p-6">
            <span className="grid size-10 place-items-center rounded-full bg-background text-primary"><Icon className="size-4" /></span>
            <h3 className="mt-6 text-base font-bold">{title}</h3>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{text}</p>
          </article>)}
        </div>
      </div>
      <figure className="overflow-hidden rounded-[var(--radius-xl)] shadow-soft"><img src={driverImage} alt="Professional Orange Taxi driver beside an orange electric car" width={1408} height={1600} loading="lazy" className="aspect-[4/5] size-full object-cover" /></figure>
    </div></section>

    <section className="py-24 md:py-32"><div className="section-shell grid gap-12 lg:grid-cols-[0.7fr_1.3fr]">
      <Intro eyebrow="The driver journey" title="From interest to income." copy="A clear, respectful path into the Orange team." />
      <ol className="border-t border-border">
        {journey.map(([n, title, text]) => <li key={n} className="grid gap-2 border-b border-border py-7 sm:grid-cols-[5rem_1fr] sm:gap-6">
          <span className="display-serif text-4xl text-primary">{n}</span>
          <div><h3 className="text-lg font-bold">{title}</h3><p className="mt-1 max-w-xl text-sm leading-6 text-muted-foreground">{text}</p></div>
        </li>)}
      </ol>
    </div></section>

    <section className="bg-night py-24 text-background md:py-32"><div className="section-shell grid gap-12 lg:grid-cols-2 lg:items-center">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Your driver app</p>
        <h2 className="display-serif mt-4 text-5xl leading-none md:text-6xl">Everything you need, in one place.</h2>
        <p className="mt-6 max-w-lg leading-7 text-background/65">The Orange driver app is being designed around clarity: your schedule, your earnings and your progress — always visible, never confusing.</p>
        <ul className="mt-8 space-y-4 text-sm text-background/70">
          {["Daily schedule and ride assignments","Earnings and incentives at a glance","Milestone progress towards rewards","Training and service feedback"].map((x) => <li key={x} className="flex items-center gap-3"><Gauge className="size-4 text-primary" />{x}</li>)}
        </ul>
      </div>
      <div className="rounded-xl border border-background/15 bg-background/5 p-7 md:p-9">
        <div className="flex items-center justify-between"><p className="text-xs font-bold uppercase tracking-[0.14em] text-background/50">Concept preview</p><span className="rounded-full border border-primary/40 px-3 py-1 text-xs font-bold text-primary">Illustrative only</span></div>
        <div className="mt-6 space-y-3">
          {[["This week's earnings","—"],["Performance incentives","—"],["Next milestone","—"],["Service rating","—"]].map(([label]) => <div key={label} className="flex items-center justify-between rounded-lg border border-background/10 bg-night/40 px-5 py-4"><span className="text-sm text-background/70">{label}</span><span className="text-sm font-bold text-background/40">—</span></div>)}
        </div>
        <p className="mt-5 text-xs leading-5 text-background/45">A design concept for the future driver dashboard. Figures will appear once the driver app launches.</p>
      </div>
    </div></section>

    <section id="join" className="py-24 md:py-32"><div className="section-shell grid gap-12 lg:grid-cols-2 lg:items-center">
      <div>
        <Intro eyebrow="Who we're looking for" title="Could you be an Orange driver?" copy="If you take pride in your driving and in how you treat people, we'd love to hear from you." />
        <ul className="mt-8 space-y-4 text-sm font-semibold">
          {requirements.map((x) => <li key={x} className="flex items-center gap-3"><Check className="size-4 text-primary" />{x}</li>)}
        </ul>
      </div>
      <div className="rounded-xl border border-border bg-warm p-7 md:p-9">
        <ClipboardCheck className="size-7 text-primary" />
        <h3 className="display-serif mt-5 text-3xl">Applications open soon.</h3>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">Driver onboarding will begin when Orange launches in your city. Register your interest and we'll reach out as soon as applications open.</p>
        <div className="mt-6 rounded-lg border border-border bg-background p-5">
          <p className="text-sm font-bold">Preview only</p>
          <p className="mt-1.5 text-sm leading-6 text-muted-foreground">No applications or personal details are being collected yet. This page will connect directly to the Orange driver onboarding system at launch.</p>
        </div>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg"><Link to="/contact">Register Your Interest <ArrowRight /></Link></Button>
          <Button asChild size="lg" variant="charcoal"><HandHeart className="size-4" /><Link to="/about">About Orange</Link></Button>
        </div>
      </div>
    </div></section>
  </>;
}

function Intro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy?: string }) {
  return <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p><h2 className="display-serif mt-4 text-5xl leading-none md:text-6xl">{title}</h2>{copy && <p className="mt-5 max-w-xl leading-7 text-muted-foreground">{copy}</p>}</div>;
}
