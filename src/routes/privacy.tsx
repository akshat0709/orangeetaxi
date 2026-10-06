import { createFileRoute } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site-shell";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPolicy,
});

function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <SiteHeader />
      <main className="flex-1 max-w-4xl mx-auto px-4 py-12">
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        <p className="text-muted-foreground mb-4">Last updated: October 2026</p>

        <div className="space-y-6 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-3">1. Information We Collect</h2>
            <p>
              Orange Taxi collects location data to enable ride tracking, route calculation, and
              driver dispatching even when the app is closed or not in use (for drivers). We also
              collect basic profile information (name, phone number) for account management.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">2. How We Use Your Information</h2>
            <p>
              Your information is used strictly to provide transportation services, ensure safety
              during rides, and comply with the Motor Vehicle Aggregator Guidelines of India.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">3. Data Security & Storage</h2>
            <p>
              All data is encrypted in transit and at rest. We do not sell your personal information
              to third parties.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
