import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import "../i18n";

function Analytics() {
  useEffect(() => {
    if (
      typeof window !== "undefined" &&
      (window.location.hostname.includes("vercel") || window.location.hostname.includes("orange"))
    ) {
      if (!document.getElementById("vercel-analytics-script")) {
        const script = document.createElement("script");
        script.id = "vercel-analytics-script";
        script.src = "/_vercel/insights/script.js";
        script.defer = true;
        document.head.appendChild(script);
      }
    }
  }, []);
  return null;
}

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { SiteFooter, SiteHeader } from "../components/site-shell";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: any; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        {error?.message && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-xs font-mono text-destructive text-left overflow-auto max-h-32">
            {error.message}
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

import { PWAInstallPrompt } from "../components/pwa-install-prompt";
import { CookieBanner } from "../components/cookie-banner";

const SCHEMA_JSON_LD = JSON.stringify({
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "TaxiService",
      "@id": "https://orange-taxi.com/#service",
      name: "Orange Taxi",
      serviceType: "Electric Taxi & Airport Transfer Service",
      provider: {
        "@type": "Organization",
        "@id": "https://orange-taxi.com/#organization",
        name: "Orange Taxi Limited",
        legalName: "Orange Taxi Limited",
        url: "https://orange-taxi.com",
        logo: "https://orange-taxi.com/pwa-512x512.png",
        email: "support@orange-taxi.com",
        telephone: "+91-11-4000-7000",
        address: {
          "@type": "PostalAddress",
          streetAddress: "S-210, 2nd Floor, Panchshila Park, South Malviya Nagar",
          addressLocality: "South Delhi",
          addressRegion: "Delhi",
          postalCode: "110017",
          addressCountry: "IN",
        },
      },
      areaServed: [
        { "@type": "City", name: "Delhi" },
        { "@type": "City", name: "Gurugram" },
        { "@type": "City", name: "Noida" },
        { "@type": "City", name: "Ghaziabad" },
        { "@type": "City", name: "Faridabad" },
      ],
      description:
        "Orange Taxi is a premier 100% electric cab service featuring an exclusive fleet of Mahindra BE.6 electric SUVs with guaranteed AC, zero surge pricing, and professional chauffeurs.",
    },
  ],
});

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { httpEquiv: "Content-Security-Policy", content: "upgrade-insecure-requests" },
      {
        name: "viewport",
        content:
          "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover",
      },
      { title: "Orange Taxi — Premium Electric Cab Service" },
      {
        name: "description",
        content:
          "Book premium 100% electric cab rides with Orange Taxi in Mahindra BE.6 SUVs. Zero cancellations, guaranteed AC, clean cabins, and professional chauffeurs.",
      },
      {
        name: "keywords",
        content:
          "electric taxi, premium cab service, electric cab, orange taxi, airport taxi, mahindra be6 cab, zero cancellation taxi",
      },
      {
        name: "robots",
        content: "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
      },
      { name: "author", content: "Orange Taxi Limited" },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "Orange Taxi" },
      { property: "og:title", content: "Orange Taxi — Premium Electric Cab Service" },
      {
        property: "og:description",
        content:
          "Experience premium electric rides in signature Mahindra BE.6 SUVs. Zero surge pricing, pre-cooled AC cabins, and disciplined chauffeurs.",
      },
      { property: "og:url", content: "https://orange-taxi.com/" },
      { property: "og:image", content: "https://orange-taxi.com/be6-exterior.jpg" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Orange Taxi — Premium Electric Cab Service" },
      {
        name: "twitter:description",
        content:
          "100% Electric Cab Service. Mahindra BE.6 SUVs, daily newspapers, pre-cooled cabins, zero cancellations.",
      },
      { name: "twitter:image", content: "https://orange-taxi.com/be6-exterior.jpg" },
      { name: "theme-color", content: "#f56b00" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "default" },
      { name: "apple-mobile-web-app-title", content: "Orange Taxi" },
      { name: "application-name", content: "Orange Taxi" },
    ],
    links: [
      { rel: "canonical", href: "https://orange-taxi.com/" },
      {
        rel: "stylesheet",
        href: appCss,
      },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Manrope:wght@400;500;600;700&display=swap",
      },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png", sizes: "180x180" },
      { rel: "icon", href: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
      { rel: "icon", href: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: SCHEMA_JSON_LD }} />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    // Enforce HTTPS
    if (
      window.location.protocol === "http:" &&
      window.location.hostname !== "localhost" &&
      !window.location.hostname.startsWith("127.0.0.1")
    ) {
      window.location.replace(window.location.href.replace(/^http:/, "https:"));
      return undefined;
    }

    const updateStandalone = () => {
      const isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches ||
        window.matchMedia("(display-mode: minimal-ui)").matches ||
        (window.navigator as any).standalone === true;

      if (isStandalone) {
        document.documentElement.classList.add("is-standalone-pwa");
      } else {
        document.documentElement.classList.remove("is-standalone-pwa");
      }
    };

    updateStandalone();
    const mql = window.matchMedia("(display-mode: standalone)");
    if (mql.addEventListener) {
      mql.addEventListener("change", updateStandalone);
      return () => mql.removeEventListener("change", updateStandalone);
    }
    return undefined;
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Analytics />
      <Toaster richColors position="top-right" />
      <PWAInstallPrompt />
      <SiteHeader />
      <main className="min-w-0 max-w-full overflow-x-hidden">
        <Outlet />
      </main>
      <SiteFooter />
      <CookieBanner />
    </QueryClientProvider>
  );
}
