import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, Bot, BriefcaseBusiness, Check, Loader2, MessageCircle, Phone, Send, Sparkles, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/talk-to-orange")({
  head: () => ({ meta: [
    { title: "Talk to Orange — Orange Taxi" },
    { name: "description", content: "Corporate enquiries, pricing information and our AI booking assistant." },
    { property: "og:title", content: "Talk to Orange — Orange Taxi" },
    { property: "og:type", content: "website" },
  ]}),
  component: TalkToOrangePage,
});

interface VehicleCategory { code: string; name: string; tagline: string; seats: number; base_fare: number; per_km: number; minimum_fare: number; }
interface PricingSettings { tax_percent: number; platform_fee: number; currency: string; demo_note: string; surge_enabled: boolean; surge_multiplier: number; }

const enquirySchema = z.object({
  company_name: z.string().min(2, "Enter your company name"),
  contact_name: z.string().min(2, "Enter your name"),
  email: z.string().email("Enter a valid email"),
  phone: z.string().min(7, "Enter a valid phone number"),
  city: z.string().min(2, "Enter your city"),
  team_size: z.string().min(1, "Select team size"),
  requirement: z.string().min(1, "Select a requirement"),
  message: z.string().optional(),
});
type EnquiryValues = z.infer<typeof enquirySchema>;

const SAMPLE_DISTANCES = [5, 10, 20];
function sampleFare(v: VehicleCategory, km: number) {
  return Math.max(v.minimum_fare, v.base_fare + v.per_km * km);
}

// AI Chat
interface Message { role: "user" | "assistant"; content: string; }
const GEMINI_KEY = import.meta.env["VITE_GEMINI_API_KEY"] as string | undefined;
const SYSTEM_PROMPT = `You are Orangee, a highly helpful AI booking assistant for Orange Taxi, a premium electric ride service in Delhi NCR.

Service areas: Delhi, Gurugram, Noida, Ghaziabad, Faridabad, IGI Airport.
Vehicles:
- orange_go: ₹49 base + ₹12/km, min ₹99, 4 seats, economy EV
- orange_sedan: ₹59 base + ₹15/km, min ₹129, 4 seats, premium EV
- orange_xl: ₹79 base + ₹20/km, min ₹179, 6-7 seats, SUV

If the user wants to book a taxi:
1. Ask for their pickup location, drop-off location, desired vehicle type, and pickup time.
2. Ensure their locations match our service areas. Ensure vehicle matches one of our 3 codes.
3. DO NOT generate the booking command until you have ALL 4 pieces of information clearly confirmed.
4. Once you have all 4, reply EXACTLY with this JSON block on a new line, and nothing else after it:
BOOKING_COMMAND: {"pickup": "...", "drop": "...", "vehicle": "...", "time": "..."}

Be friendly, concise, and proactive. Use ₹ for currency.`;

async function callGemini(messages: Message[]): Promise<string> {
  const contents = messages.map(m => ({
    role: m.role === "assistant" ? "model" : "user",
    parts: [{ text: m.content }],
  }));
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents,
      generationConfig: { temperature: 0.7, maxOutputTokens: 400 },
    }),
  });
  if (!res.ok) throw new Error("AI unavailable");
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "Sorry, I couldn't generate a response.";
}

function getLocalConciergeReply(userQuery: string): string {
  const query = userQuery.toLowerCase().trim();

  if (query.includes("fare") || query.includes("price") || query.includes("cost") || query.includes("rate") || query.includes("charge")) {
    return "🏷️ Transparent Orange Taxi Pricing:\n\n• Orange Go: ₹49 Base + ₹12/km (Min ₹99, 4 seats)\n• Orange Sedan: ₹59 Base + ₹15/km (Min ₹129, 4 seats)\n• Orange XL: ₹79 Base + ₹20/km (Min ₹179, 6–7 seats)\n\n✅ Zero surge pricing on advance scheduled rides.\n✅ 5% GST included with full Input Tax Credit (ITC).\n✅ No cancellation penalties.";
  }

  if (query.includes("airport") || query.includes("igi") || query.includes("flight") || query.includes("terminal")) {
    return "✈️ Orange Airport Concierge:\n\n• Dedicated pickup bays at Delhi IGI (T1, T2, T3) and BLR Kempegowda Airport.\n• Chauffeurs track live flight numbers to adjust for delays.\n• 45 minutes complimentary post-landing waiting time.\n• Chauffeur assists with luggage directly at the arrivals pillar.";
  }

  if (query.includes("ev") || query.includes("fleet") || query.includes("car") || query.includes("be.6") || query.includes("amenities") || query.includes("screen")) {
    return "⚡ 100% Mahindra BE.6 Electric Fleet:\n\nEvery Orange ride features:\n• Rear passenger HD touchscreen for movies, music & live map.\n• Acoustically tuned studio sound system with Bluetooth pairing.\n• Pre-cooled dual-zone AC at 22°C before pickup.\n• Complimentary sealed mineral water & daily newspapers.\n• Fast Type-C & Lightning chargers in rear armrest.\n• Whisper-quiet acoustic cabin with Quiet Ride mode.";
  }

  if (query.includes("cancel") || query.includes("denial") || query.includes("refuse")) {
    return "🛡️ Zero Driver Cancellations:\n\nOrange Taxi enforces a strict 0% driver cancellation policy. Chauffeurs cannot cancel accepted rides. In rare cases of vehicle maintenance, our Central Control Tower instantly reassigns an equal or superior vehicle.";
  }

  if (query.includes("corporate") || query.includes("business") || query.includes("invoice") || query.includes("company")) {
    return "💼 Corporate & Enterprise Travel:\n\n• Centralized monthly billing with consolidated GST tax invoices.\n• Employee ride rosters, geo-fenced travel rules & cost centers.\n• Priority chauffeur allocation for executive airport & client transfers.\n\nUse our corporate enquiry form on this page or email business@orange-taxi.com!";
  }

  if (query.includes("book") || query.includes("ride") || query.includes("cab") || query.includes("taxi")) {
    return 'BOOKING_COMMAND: {"pickup": "Delhi NCR", "drop": "IGI Airport Terminal 3", "vehicle": "orange_sedan", "time": "Now"}\n\nRedirecting you to our Booking Engine to finalize your ride now... 🚕';
  }

  return "Hi! I'm Orangee, your Orange Taxi concierge. 🍊\n\nI can assist you with:\n• 🏷️ Fares across Orange Go, Sedan, and XL\n• ✈️ Airport pickup procedures & terminal pillars\n• ⚡ Mahindra BE.6 in-cab entertainment & luxury amenities\n• 🛡️ Zero driver cancellation guarantee\n• 💼 Corporate monthly invoicing & business travel\n\nFeel free to ask any question or call our 24x7 desk at +91 11 4000 7000!";
}

function TalkToOrangePage() {
  const [vehicles, setVehicles] = useState<VehicleCategory[]>([]);
  const [pricing, setPricing] = useState<PricingSettings | null>(null);
  const [enquiryDone, setEnquiryDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([{ role: "assistant", content: "Hi! I'm your Orange Taxi assistant. Ask me about fares, booking, or anything about our service! 🚕" }]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const form = useForm<EnquiryValues>({ resolver: zodResolver(enquirySchema) });

  useEffect(() => {
    async function fetchData() {
      const [{ data: v }, { data: p }] = await Promise.all([
        supabase.from("vehicle_categories").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("pricing_settings").select("*").eq("id", 1).single(),
      ]);
      setVehicles((v as VehicleCategory[]) ?? []);
      if (p) setPricing(p as unknown as PricingSettings);
    }
    fetchData();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function onSubmit(values: EnquiryValues) {
    setSubmitting(true);
    const { error } = await supabase.from("corporate_enquiries").insert({
      company_name: values.company_name,
      contact_name: values.contact_name,
      email: values.email,
      phone: values.phone,
      city: values.city,
      team_size: values.team_size,
      requirement: values.requirement,
      message: values.message ?? "",
    });
    if (error) { toast.error("Submission failed — please try again."); setSubmitting(false); return; }

    // Fire optional webhook
    const webhookUrl = import.meta.env["VITE_ENQUIRY_WEBHOOK_URL"];
    if (webhookUrl) {
      fetch(webhookUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }).catch(() => {});
    }

    setEnquiryDone(true);
    toast.success("Enquiry sent! We'll be in touch soon.");
    setSubmitting(false);
  }

  const navigate = useNavigate();

  async function sendChat(customText?: string) {
    const text = (customText || chatInput).trim();
    if (!text || chatLoading) return;
    const newMessages: Message[] = [...messages, { role: "user", content: text }];
    setMessages(newMessages);
    if (!customText) setChatInput("");
    setChatLoading(true);
    try {
      let reply: string;
      if (GEMINI_KEY) {
        try {
          reply = await callGemini(newMessages);
        } catch {
          reply = getLocalConciergeReply(text);
        }
      } else {
        await new Promise(r => setTimeout(r, 400));
        reply = getLocalConciergeReply(text);
      }
      
      const bookingMatch = reply.match(/BOOKING_COMMAND:\s*({.*})/);
      if (bookingMatch && bookingMatch[1]) {
        sessionStorage.setItem("ai_booking", bookingMatch[1]);
        reply = reply.replace(/BOOKING_COMMAND:\s*({.*})/, "\n\nAwesome! I have your details. Redirecting you to confirm and book your ride now... 🚕");
        setTimeout(() => navigate({ to: "/book" }), 2200);
      }

      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: getLocalConciergeReply(text) }]);
    }
    setChatLoading(false);
  }

  return <>
    {/* Hero */}
    <section className="relative overflow-hidden bg-night py-24 text-white md:py-32">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,color-mix(in_oklab,var(--primary)_15%,transparent),transparent_60%)]" />
      <div className="section-shell relative">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Talk to Orange</p>
        <h1 className="display-serif mt-5 text-[clamp(2.5rem,6vw,5.5rem)] leading-[0.92] text-white">Better rides<br /><span className="text-primary">for your business.</span></h1>
        <p className="mt-7 max-w-lg text-base leading-7 text-white/70 md:text-lg">Employee transport, client transfers, airport runs — tell us what you need and we'll build a solution around your team.</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {["Corporate bookings", "Employee transportation", "Airport transfers", "Client transportation", "Centralized billing"].map(x => (
            <span key={x} className="flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs font-semibold text-white/80"><Check className="size-3 text-primary" />{x}</span>
          ))}
        </div>
        <div className="mt-9 flex flex-wrap items-center gap-3">
          <Button onClick={() => setChatOpen(true)} size="lg" className="gap-2">
            <Bot className="size-4" /> Open Orange Assistant
          </Button>
          <Button asChild variant="outline" size="lg" className="gap-2 border-white/30 text-white hover:bg-white/10 hover:text-white">
            <a href="tel:+911140007000">
              <Phone className="size-4 text-primary" /> Call 24x7 Concierge
            </a>
          </Button>
          <Button asChild variant="ghost" size="lg" className="gap-2 text-white/80 hover:bg-white/10 hover:text-white">
            <a href="https://wa.me/911140007000?text=Hi%20Orange%20Concierge%2C%20I%20have%20an%20enquiry%20regarding%20Orange%20Taxi" target="_blank" rel="noreferrer">
              <MessageCircle className="size-4 text-emerald-400" /> WhatsApp Desk
            </a>
          </Button>
        </div>
      </div>
    </section>

    {/* Enquiry form */}
    <section className="py-24 md:py-32">
      <div className="section-shell grid gap-16 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Corporate enquiry</p>
          <h2 className="display-serif mt-4 text-5xl leading-none">Get in touch.</h2>
          <p className="mt-5 max-w-md leading-7 text-muted-foreground">Fill in the form and we'll get back to you within one business day. All enquiries are reviewed by our team.</p>
          <div className="mt-10 space-y-5 border-t border-border pt-8">
            {[["📧", "business@orange-taxi.com", "Email"], ["🚕", "Delhi NCR", "Operating area"], ["⚡", "100% electric fleet", "Fleet type"]].map(([icon, val, label]) => (
              <div key={label} className="flex items-center gap-4">
                <span className="text-2xl">{icon}</span>
                <div>
                  {label === "Email" ? (
                    <a href={`mailto:${val}`} className="text-sm font-semibold hover:text-primary transition-colors">{val}</a>
                  ) : (
                    <p className="text-sm font-semibold">{val}</p>
                  )}
                  <p className="text-xs text-muted-foreground">{label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {enquiryDone ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-border bg-warm p-10 text-center">
            <span className="grid size-14 place-items-center rounded-full bg-primary/10 text-primary"><BriefcaseBusiness className="size-7" /></span>
            <h3 className="display-serif mt-6 text-3xl">Enquiry received.</h3>
            <p className="mt-3 max-w-xs text-sm leading-6 text-muted-foreground">Thanks for reaching out! Our team will be in touch within one business day at your email address.</p>
            <Button onClick={() => { setEnquiryDone(false); form.reset(); }} variant="ghost" className="mt-6">Send another enquiry</Button>
          </div>
        ) : (
          <form onSubmit={form.handleSubmit(onSubmit)} className="rounded-2xl border border-border bg-warm p-7 md:p-9">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Label htmlFor="cq-company">Company Name</Label>
                <Input id="cq-company" placeholder="Acme Corp" className="mt-1.5 bg-background" {...form.register("company_name")} />
                {form.formState.errors.company_name && <p className="mt-1 text-xs text-destructive">{form.formState.errors.company_name.message}</p>}
              </div>
              <div>
                <Label htmlFor="cq-contact">Your Name</Label>
                <Input id="cq-contact" placeholder="Priya Sharma" className="mt-1.5 bg-background" {...form.register("contact_name")} />
                {form.formState.errors.contact_name && <p className="mt-1 text-xs text-destructive">{form.formState.errors.contact_name.message}</p>}
              </div>
              <div>
                <Label htmlFor="cq-city">City</Label>
                <Input id="cq-city" placeholder="Delhi" className="mt-1.5 bg-background" {...form.register("city")} />
                {form.formState.errors.city && <p className="mt-1 text-xs text-destructive">{form.formState.errors.city.message}</p>}
              </div>
              <div>
                <Label htmlFor="cq-email">Work Email</Label>
                <Input id="cq-email" type="email" placeholder="priya@acme.com" className="mt-1.5 bg-background" {...form.register("email")} />
                {form.formState.errors.email && <p className="mt-1 text-xs text-destructive">{form.formState.errors.email.message}</p>}
              </div>
              <div>
                <Label htmlFor="cq-phone">Phone</Label>
                <Input id="cq-phone" type="tel" placeholder="+91 98765 43210" className="mt-1.5 bg-background" {...form.register("phone")} />
                {form.formState.errors.phone && <p className="mt-1 text-xs text-destructive">{form.formState.errors.phone.message}</p>}
              </div>
              <div>
                <Label>Team Size</Label>
                <Select onValueChange={v => form.setValue("team_size", v)}>
                  <SelectTrigger className="mt-1.5 bg-background"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["1–10", "11–50", "51–200", "200+"].map(s => <SelectItem key={s} value={s}>{s} employees</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.formState.errors.team_size && <p className="mt-1 text-xs text-destructive">{form.formState.errors.team_size.message}</p>}
              </div>
              <div>
                <Label>Requirement</Label>
                <Select onValueChange={v => form.setValue("requirement", v)}>
                  <SelectTrigger className="mt-1.5 bg-background"><SelectValue placeholder="Select" /></SelectTrigger>
                  <SelectContent>
                    {["Employee transportation", "Airport transfers", "Client transportation", "Corporate bookings", "Centralized billing", "Other"].map(r => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                  </SelectContent>
                </Select>
                {form.formState.errors.requirement && <p className="mt-1 text-xs text-destructive">{form.formState.errors.requirement.message}</p>}
              </div>
              <div className="col-span-2">
                <Label htmlFor="cq-msg">Message <span className="text-muted-foreground">(optional)</span></Label>
                <Textarea id="cq-msg" rows={4} placeholder="Tell us more about your transport needs..." className="mt-1.5 resize-none bg-background" {...form.register("message")} />
              </div>
            </div>
            <Button type="submit" size="lg" className="mt-6 w-full" disabled={submitting}>
              {submitting ? <Loader2 className="size-4 animate-spin" /> : <>Send Enquiry <ArrowRight className="size-4" /></>}
            </Button>
          </form>
        )}
      </div>
    </section>

    {/* Pricing Sheet */}
    <section className="bg-warm py-24 md:py-32">
      <div className="section-shell">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Pricing</p>
        <h2 className="display-serif mt-4 text-5xl leading-none">Clear fares. No surprises.</h2>
        <p className="mt-5 max-w-xl leading-7 text-muted-foreground">Our fares are calculated on base + distance. The table below shows sample totals for common journey lengths.</p>

        <div className="mt-12 overflow-hidden rounded-2xl border border-border bg-background">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="px-6 py-4 text-left font-semibold">Vehicle</th>
                  <th className="px-6 py-4 text-left font-semibold">Seats</th>
                  <th className="px-6 py-4 text-left font-semibold">Base fare</th>
                  <th className="px-6 py-4 text-left font-semibold">Per km</th>
                  <th className="px-6 py-4 text-left font-semibold">Min. fare</th>
                  {SAMPLE_DISTANCES.map(d => <th key={d} className="px-6 py-4 text-left font-semibold text-primary">{d} km</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {vehicles.map((v, i) => (
                  <tr key={v.code} className={i === 1 ? "bg-primary/5" : ""}>
                    <td className="px-6 py-5">
                      <p className="font-bold">{v.name}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{v.tagline}</p>
                    </td>
                    <td className="px-6 py-5 text-muted-foreground">{v.seats}</td>
                    <td className="px-6 py-5 font-semibold">₹{v.base_fare}</td>
                    <td className="px-6 py-5 font-semibold">₹{v.per_km}</td>
                    <td className="px-6 py-5 text-muted-foreground">₹{v.minimum_fare}</td>
                    {SAMPLE_DISTANCES.map(d => (
                      <td key={d} className="px-6 py-5 font-bold text-primary">₹{Math.round(sampleFare(v, d))}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pricing && (
            <div className="border-t border-border px-6 py-4">
              <p className="text-xs text-muted-foreground">
                {pricing.surge_enabled && <span className="mr-4 rounded bg-amber-100 px-2 py-0.5 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 dark:border dark:border-amber-800/40">Surge active: {pricing.surge_multiplier}×</span>}
                {pricing.tax_percent > 0 && <span className="mr-4">+{pricing.tax_percent}% tax applies</span>}
                {pricing.platform_fee > 0 && <span className="mr-4">+₹{pricing.platform_fee} platform fee</span>}
                Fares shown are estimates. Actual fares may vary by traffic and demand. {pricing.demo_note}
              </p>
            </div>
          )}
        </div>
      </div>
    </section>

    {/* AI Chat widget */}
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {chatOpen && (
        <div className="flex h-[480px] w-[360px] flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-brand-lg animate-gentle-rise">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-border bg-primary px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="grid size-8 place-items-center rounded-full bg-primary-foreground/20"><Bot className="size-4 text-primary-foreground" /></div>
              <div>
                <p className="text-xs font-bold text-primary-foreground">Orange Assistant</p>
                <p className="text-[10px] text-primary-foreground/60">AI-powered · always available</p>
              </div>
            </div>
            <button onClick={() => setChatOpen(false)} className="text-primary-foreground/70 hover:text-primary-foreground"><X className="size-4" /></button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[80%] rounded-2xl px-3 py-2 text-sm leading-5 ${m.role === "user" ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted text-foreground rounded-bl-sm"}`}>
                  {m.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                  <Loader2 className="size-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Quick suggestion chips */}
          <div className="flex gap-1.5 overflow-x-auto border-t border-border px-3 py-2 text-xs bg-muted/30">
            {["🏷️ Fares", "✈️ Airport", "⚡ BE.6 Fleet", "🛡️ Zero Cancel", "💼 Corporate", "📍 Book Cab"].map(chip => (
              <button
                key={chip}
                onClick={() => sendChat(chip)}
                className="whitespace-nowrap rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-medium transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
              >
                {chip}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="border-t border-border p-3 flex gap-2">
            <input
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && !e.shiftKey && (e.preventDefault(), sendChat())}
              placeholder="Ask about fares, vehicles, airport..."
              disabled={chatLoading}
              className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary disabled:opacity-50"
            />
            <button onClick={() => sendChat()} disabled={chatLoading || !chatInput.trim()}
              className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-40 hover:bg-primary/90">
              <Send className="size-4" />
            </button>
          </div>
        </div>
      )}

      {/* Toggle bubble */}
      <button onClick={() => setChatOpen(p => !p)}
        className="grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-brand-lg transition-transform hover:scale-105 active:scale-95">
        {chatOpen ? <X className="size-6" /> : <MessageCircle className="size-6" />}
      </button>
    </div>
  </>;
}
