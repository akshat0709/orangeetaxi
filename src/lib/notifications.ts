// PWA Push & Background Notification Service for Orange Taxi

export type NotificationPermissionState = "granted" | "denied" | "default" | "unsupported";

export interface RideNotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  silent?: boolean;
}

/**
 * Checks whether Notification API and Service Worker are supported in the current browser.
 */
export function isNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window && "serviceWorker" in navigator;
}

/**
 * Returns current browser notification permission state.
 */
export function getNotificationPermission(): NotificationPermissionState {
  if (!isNotificationSupported()) return "unsupported";
  return Notification.permission as NotificationPermissionState;
}

/**
 * Request notification permission from user with custom prompt tracking.
 */
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) {
    console.warn("Notifications not supported in this browser environment");
    return false;
  }

  try {
    const permission = await Notification.requestPermission();
    if (typeof window !== "undefined") {
      localStorage.setItem("orange_notification_permission", permission);
    }
    return permission === "granted";
  } catch (err) {
    console.warn("Error requesting notification permission:", err);
    return false;
  }
}

/**
 * Plays a high-end, subtle executive notification chime using Web Audio API.
 */
export function playNotificationChime() {
  if (typeof window === "undefined") return;
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === "suspended") {
      ctx.resume().catch(() => {});
    }

    const now = ctx.currentTime;

    // Tone 1: E5 (659.25 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = "sine";
    osc1.frequency.setValueAtTime(659.25, now);
    gain1.gain.setValueAtTime(0, now);
    gain1.gain.linearRampToValueAtTime(0.25, now + 0.03);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.35);

    // Tone 2: A5 (880 Hz) - 120ms later
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = "sine";
    osc2.frequency.setValueAtTime(880, now + 0.12);
    gain2.gain.setValueAtTime(0, now + 0.12);
    gain2.gain.linearRampToValueAtTime(0.3, now + 0.15);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.12);
    osc2.stop(now + 0.6);
  } catch {
    // best-effort: failure here is non-fatal and intentionally ignored
  }
}

/**
 * Triggers hardware vibration pattern if supported on device.
 */
export function triggerHapticVibration(pattern: number[] = [250, 100, 250, 100, 350]) {
  if (typeof window !== "undefined" && typeof navigator !== "undefined" && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch {
      // best-effort: failure here is non-fatal and intentionally ignored
    }
  }
}

/**
 * Displays a PWA push/system notification via Service Worker registration
 * so it appears in the OS notification drawer/lock screen even when the browser tab is backgrounded.
 */
export async function sendRideNotification(payload: RideNotificationPayload): Promise<boolean> {
  if (!isNotificationSupported()) return false;
  if (Notification.permission !== "granted") return false;

  // Sound and vibration feedback
  if (!payload.silent) {
    playNotificationChime();
    triggerHapticVibration();
  }

  const {
    title,
    body,
    url = "/book",
    tag = "orange-ride-status",
    icon = "/pwa-192x192.png",
    badge = "/favicon-32x32.png",
    data = {},
  } = payload;

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration && registration.showNotification) {
        await registration.showNotification(title, {
          body,
          icon,
          badge,
          tag,
          renotify: true,
          vibrate: [300, 100, 300, 100, 300],
          data: {
            url,
            timestamp: Date.now(),
            ...data,
          },
        } as any);
        return true;
      }
    }
  } catch (err) {
    console.warn("ServiceWorker showNotification failed, trying fallback:", err);
  }

  // Fallback: standard Window Notification
  try {
    const notif = new Notification(title, {
      body,
      icon,
      badge,
      tag,
      data: { url },
    });
    notif.onclick = () => {
      window.focus();
      if (url && typeof window !== "undefined") {
        window.location.href = url;
      }
    };
    return true;
  } catch (err) {
    console.warn("Direct Notification fallback error:", err);
    return false;
  }
}

/**
 * Formats user-facing status messages for each booking stage.
 */
export function getStatusNotificationContent(
  status: string,
  driverDetails?: { name?: string; plate?: string; vehicle?: string; otp?: string },
  reference?: string,
  dropArea?: string,
): { title: string; body: string; tag: string } | null {
  const driverName = driverDetails?.name || "Your Chauffeur";
  const vehicle = driverDetails?.vehicle || "Mahindra BE.6";
  const plate = driverDetails?.plate ? ` (${driverDetails.plate})` : "";
  const otpStr = driverDetails?.otp ? ` · Ride OTP: ${driverDetails.otp}` : "";

  switch (status) {
    case "accepted":
      return {
        title: "Orange Chauffeur Assigned! 🚗",
        body: `${driverName} is on the way in ${vehicle}${plate}${otpStr}.`,
        tag: `ride-accepted-${reference || "active"}`,
      };
    case "arrived":
      return {
        title: "Your Orange Chauffeur has arrived! 📍",
        body: `${driverName} is waiting at your gate in ${vehicle}${plate}.${otpStr}`,
        tag: `ride-arrived-${reference || "active"}`,
      };
    case "in_progress":
      return {
        title: "Ride in Progress ⚡",
        body: dropArea
          ? `Heading to ${dropArea}. Relax in your 100% electric cabin.`
          : "Your ride is underway. Enjoy the quiet cabin experience.",
        tag: `ride-inprogress-${reference || "active"}`,
      };
    case "completed":
      return {
        title: "Ride Completed — Thank You! ✨",
        body: dropArea
          ? `You've arrived at ${dropArea}. Tap to rate and download your GST invoice.`
          : "You have arrived at your destination.",
        tag: `ride-completed-${reference || "active"}`,
      };
    case "cancelled":
      return {
        title: "Ride Cancelled ⚠️",
        body: "Your booking has been cancelled.",
        tag: `ride-cancelled-${reference || "active"}`,
      };
    default:
      return null;
  }
}
