import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-shell";

export const Route = createFileRoute("/terms")({
  component: Terms,
});

function Terms() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Terms and Conditions</h1>
        <p className="text-muted-foreground mb-4">Last updated: October 2026</p>
        
        <div className="space-y-6 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-3">1. User Agreement</h2>
            <p>By using the Orange Taxi platform, you agree to abide by all local laws and regulations. You must be at least 18 years old to create an account.</p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Driver Responsibilities</h2>
            <p>Drivers must maintain valid KYC documents (Aadhaar, DL, RC) and comply with all background checks as mandated by the State Transport Authority.</p>
          </section>
        </div>
      </main>
    </div>
  );
}
