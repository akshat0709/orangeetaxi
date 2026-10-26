import { useEffect, useState } from "react";
import { Download, Share, Smartphone, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showPrompt, setShowPrompt] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSTip, setShowIOSTip] = useState(false);

  useEffect(() => {
    // 1. Check if already installed / standalone
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as any).standalone === true;
    if (isStandalone) {
      setIsInstalled(true);
    }

    // 2. Register Service Worker (always required for push notifications)
    if ("serviceWorker" in navigator) {
      const registerSW = () => {
        navigator.serviceWorker
          .register("/sw.js")
          .then((reg) => {
            console.log("PWA Service Worker registered:", reg.scope);
          })
          .catch((err) => {
            console.warn("PWA SW registration note:", err);
          });
      };

      if (document.readyState === "complete") {
        registerSW();
      } else {
        window.addEventListener("load", registerSW);
      }
    }

    if (isStandalone) {
      return;
    }

    // 3. Detect iOS Safari
    const ua = window.navigator.userAgent.toLowerCase();
    const isAppleDevice = /iphone|ipad|ipod/.test(ua);
    const isSafari = ua.includes("safari") && !ua.includes("crios") && !ua.includes("fxios");
    if (isAppleDevice && isSafari && !isStandalone) {
      setIsIOS(true);
      const dismissed = localStorage.getItem("orange_pwa_ios_dismissed");
      if (!dismissed) {
        // Show after 3 seconds on iOS
        const timer = setTimeout(() => setShowPrompt(true), 3000);
        return () => clearTimeout(timer);
      }
    }

    // 4. Capture native beforeinstallprompt for Android & Desktop Chrome/Edge
    const handleBeforeInstall = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      (window as any).__pwaPrompt = e;
      const dismissed = localStorage.getItem("orange_pwa_dismissed");
      if (!dismissed) {
        setShowPrompt(true);
      }
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", () => {
      setIsInstalled(true);
      setShowPrompt(false);
      setDeferredPrompt(null);
      (window as any).__pwaPrompt = null;
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
    };
  }, []);

  async function handleInstallClick() {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        setShowPrompt(false);
      }
      setDeferredPrompt(null);
      (window as any).__pwaPrompt = null;
    } else if (isIOS) {
      setShowIOSTip(true);
    }
  }

  function handleDismiss() {
    setShowPrompt(false);
    if (isIOS) {
      localStorage.setItem("orange_pwa_ios_dismissed", "true");
    } else {
      localStorage.setItem("orange_pwa_dismissed", "true");
    }
  }

  if (isInstalled || !showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md  slide-in-from-bottom-5 duration-300">
      <div className="flex items-start justify-between gap-3.5 rounded-2xl border border-primary/30 bg-night/95 p-4 text-white shadow-2xl backdrop-blur-xl dark:border-primary/40">
        <div className="flex items-center gap-3">
          <img
            src="/pwa-192x192.png"
            alt="Orange Taxi Icon"
            className="size-11 rounded-xl shadow-md border border-white/10 shrink-0"
          />
          <div>
            <div className="flex items-center gap-1.5">
              <h4 className="text-sm font-bold text-white">Orange Taxi App</h4>
              <span className="rounded bg-primary/20 px-1.5 py-0.2 text-[9px] font-bold uppercase tracking-wider text-primary">
                Fast & 1-Tap
              </span>
            </div>
            <p className="mt-0.5 text-xs text-white/70">
              {isIOS
                ? "Install on your home screen for full-screen live tracking"
                : "Add to home screen for instant booking & real-time dispatch"}
            </p>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="text-white/50 hover:text-white p-1 -mr-1 -mt-1 transition-colors"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>
      </div>

      {showIOSTip ? (
        <div className="mt-2 rounded-xl border border-border bg-background p-3.5 text-xs text-foreground shadow-lg">
          <p className="font-semibold flex items-center gap-1 text-primary">
            <Share className="size-3.5" /> How to install on iPhone:
          </p>
          <ol className="mt-1.5 list-decimal pl-4 space-y-1 text-muted-foreground text-[11px]">
            <li>
              Tap the <strong>Share</strong> button at the bottom of Safari (square with arrow ↑).
            </li>
            <li>
              Scroll down and tap <strong>Add to Home Screen</strong>.
            </li>
            <li>
              Tap <strong>Add</strong> at top right.
            </li>
          </ol>
        </div>
      ) : (
        <div className="mt-2 flex gap-2">
          <Button
            onClick={handleInstallClick}
            size="sm"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md"
          >
            <Download className="mr-1.5 size-3.5" /> Install App
          </Button>
          <Button
            onClick={handleDismiss}
            variant="outline"
            size="sm"
            className="border-white/15 bg-white/5 text-xs text-white hover:bg-white/10"
          >
            Later
          </Button>
        </div>
      )}
    </div>
  );
}

export function triggerPWAInstall() {
  if (typeof window === "undefined") return;
  const prompt = (window as any).__pwaPrompt;
  if (prompt) {
    prompt.prompt();
    prompt.userChoice.then((choice: any) => {
      if (choice?.outcome === "accepted") {
        (window as any).__pwaPrompt = null;
      }
    });
  } else {
    const ua = window.navigator.userAgent.toLowerCase();
    if (/iphone|ipad|ipod/.test(ua)) {
      alert(
        "To install Orange Taxi on your iPhone:\n1. Tap the Share button (square with arrow ↑) at the bottom of Safari\n2. Scroll down and tap 'Add to Home Screen'",
      );
    } else {
      alert(
        "To install Orange Taxi:\nTap the 3 dots (⋮) in your browser menu and select 'Install app' or 'Add to Home screen'.",
      );
    }
  }
}
