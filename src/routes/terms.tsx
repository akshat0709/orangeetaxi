import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: Terms,
});

function Terms() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-12 text-foreground">
      <h1 className="text-4xl font-bold mb-8">Terms and Conditions</h1>
        <p className="text-muted-foreground mb-4">Last updated: October 2026</p>

        <div className="space-y-6 text-foreground">
          <section>
            <h2 className="text-2xl font-semibold mb-3">1. User Agreement</h2>
            <p>
              By using the Orange Taxi platform, you agree to abide by all local laws and
              regulations. You must be at least 18 years old to create an account.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-3">2. Driver Responsibilities</h2>
            <p>
              Drivers must maintain valid KYC documents (Aadhaar, DL, RC) and comply with all
              background checks as mandated by the State Transport Authority.
            </p>
          </section>
        </div>
    </div>
  );
}
