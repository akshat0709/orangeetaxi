// @ts-nocheck
import { useEffect, useState } from "react";
import { Bell, BellRing, Check, Volume2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  getNotificationPermission,
  isNotificationSupported,
  requestNotificationPermission,
  playNotificationChime,
  triggerHapticVibration,
} from "@/lib/notifications";

interface NotificationBannerProps {
  context?: "rider" | "driver";
  className?: string;
}

export function NotificationBanner({ context = "rider", className = "" }: NotificationBannerProps) {
  const [permission, setPermission] = useState<string>("granted");
  const [dismissed, setDismissed] = useState<boolean>(true);

  useEffect(() => {
    if (!isNotificationSupported()) return;

    const perm = getNotificationPermission();
    setPermission(perm);

    const isDismissed = localStorage.getItem("orange_notif_banner_dismissed") === "true";
    setDismissed(isDismissed);
  }, []);

  if (permission === "granted" || permission === "unsupported" || dismissed) {
    return null;
  }

  async function handleEnable() {
    const granted = await requestNotificationPermission();
    setPermission(granted ? "granted" : "denied");
    if (granted) {
      playNotificationChime();
      triggerHapticVibration();
      toast.success(
        context === "rider"
          ? "Ride alerts enabled! We'll notify you when your chauffeur arrives 🔔"
          : "Driver alerts enabled! You'll receive alerts for incoming rides 🔔",
      );
    } else {
      toast.info("Notifications were blocked. You can enable them in browser settings.");
    }
  }

  function handleDismiss() {
    setDismissed(true);
    localStorage.setItem("orange_notif_banner_dismissed", "true");
  }

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/15 via-primary/10 to-amber-500/10 p-3.5 sm:p-4 text-foreground shadow-sm transition-all animate-in fade-in slide-in-from-top-2 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <BellRing className="size-4 animate-bounce" />
          </div>
          <div>
            <p className="text-xs sm:text-sm font-bold tracking-tight">
              {context === "rider"
                ? "Never miss your ride — Enable arrival alerts"
                : "Never miss incoming ride requests"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
              {context === "rider"
                ? "Get notified when your chauffeur is assigned and arrives at your gate, even if this tab is closed or your phone is locked."
                : "Receive instant notifications for new ride dispatches even when the driver console is running in the background."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={handleDismiss}
          className="text-muted-foreground hover:text-foreground p-1 transition-colors"
          aria-label="Dismiss notification banner"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2 pl-12">
        <Button
          type="button"
          size="sm"
          onClick={handleEnable}
          className="h-8 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs gap-1.5 shadow-sm"
        >
          <Bell className="size-3.5" />
          <span>Enable Alerts</span>
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleDismiss}
          className="h-8 rounded-full text-xs text-muted-foreground hover:text-foreground"
        >
          Maybe Later
        </Button>
      </div>
    </div>
  );
}
