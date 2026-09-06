import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ContentPage({ eyebrow, title, copy, children, action }: { eyebrow: string; title: string; copy: string; children?: React.ReactNode; action?: "book" | "drive" }) {
  return <section className="min-h-[70svh] py-20 md:py-28"><div className="section-shell"><Link to="/" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4"/>Back home</Link><div className="mt-16 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">{eyebrow}</p><h1 className="display-serif mt-5 text-6xl leading-[0.95] md:text-8xl">{title}</h1></div><div className="lg:pt-14"><p className="text-lg leading-8 text-muted-foreground">{copy}</p>{children}{action&&<Button asChild size="lg" className="mt-8"><Link to={action === "book" ? "/book" : "/drive"}>{action === "book" ? "Book a Ride" : "Drive With Orange"}<ArrowRight/></Link></Button>}</div></div></div></section>;
}

export function PreviewForm({ kind }: { kind: "book" | "drive" }) {
  const isBook = kind === "book";
  return <ContentPage eyebrow={isBook ? "Ride booking" : "Driver opportunities"} title={isBook ? "Your Orange is coming soon." : "Bring better rides to your city."} copy={isBook ? "We’re preparing the Orange booking experience. Live ride requests, fares and payments will appear here when service opens." : "We’re creating a fair, professional driver experience. Applications and location availability will open here soon."}><div className="mt-8 rounded-lg border border-border bg-warm p-6"><p className="text-sm font-bold">Preview only</p><p className="mt-2 text-sm leading-6 text-muted-foreground">No details are being collected yet. This page is ready to connect to the live service later.</p></div></ContentPage>;
}