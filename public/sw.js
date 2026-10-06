// Orange Taxi Service Worker v1.1.0 with PWA Web Push & Background Notifications
const CACHE_NAME = "orange-taxi-pwa-v2";
const STATIC_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/favicon.svg",
  "/pwa-192x192.png",
  "/pwa-512x512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => {
        return cache.addAll(STATIC_ASSETS).catch((err) => {
          console.warn("PWA initial asset caching note:", err);
        });
      })
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => {
        return Promise.all(
          keys.map((key) => {
            if (key !== CACHE_NAME) {
              return caches.delete(key);
            }
          }),
        );
      })
      .then(() => self.clients.claim()),
  );
});

// Network-first with cache fallback strategy
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);

  // Skip chrome-extension, Supabase API calls, and WebSockets from offline cache
  if (
    url.protocol === "chrome-extension:" ||
    url.hostname.includes("supabase.co") ||
    url.pathname.startsWith("/api/")
  ) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        if (
          networkResponse &&
          networkResponse.status === 200 &&
          (url.pathname.startsWith("/assets/") || STATIC_ASSETS.includes(url.pathname))
        ) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return networkResponse;
      })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (event.request.mode === "navigate") {
          const cachedRoot = await caches.match("/");
          if (cachedRoot) return cachedRoot;
        }

        return new Response("Offline - Orange Taxi", {
          status: 503,
          statusText: "Service Unavailable",
          headers: new Headers({ "Content-Type": "text/plain" }),
        });
      }),
  );
});

// PWA Web Push Notification Handler (Remote / Server Push)
self.addEventListener("push", (event) => {
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: "Orange Taxi Alert ⚡", body: event.data.text() };
    }
  }

  const title = data.title || "Orange Taxi ⚡";
  const options = {
    body: data.body || "Your ride status has been updated.",
    icon: data.icon || "/pwa-192x192.png",
    badge: data.badge || "/favicon-32x32.png",
    data: {
      url: data.url || "/book",
      timestamp: Date.now(),
      ...data,
    },
    tag: data.tag || "orange-ride-alert",
    renotify: true,
    vibrate: [300, 100, 300, 100, 300],
    actions: data.actions || [{ action: "open", title: "Open Ride" }],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// PWA Message Handler for Client-triggered Background Notifications
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SHOW_NOTIFICATION") {
    const { title, options } = event.data;
    const notificationOptions = {
      icon: "/pwa-192x192.png",
      badge: "/favicon-32x32.png",
      vibrate: [300, 150, 300],
      renotify: true,
      tag: options?.tag || "orange-ride-status",
      data: {
        url: options?.url || "/book",
        ...(options?.data || {}),
      },
      ...options,
    };

    event.waitUntil(
      self.registration.showNotification(title || "Orange Taxi", notificationOptions),
    );
  }
});

// Notification Click Handler — Focuses existing tab or opens new window
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const targetUrl =
    event.notification.data && event.notification.data.url ? event.notification.data.url : "/";

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If Orange Taxi window is already open, navigate and focus it
      for (const client of clientList) {
        if ("focus" in client) {
          if (client.url.includes(self.location.origin) || client.url.includes("orange-taxi.com")) {
            client.navigate(targetUrl);
            return client.focus();
          }
        }
      }
      // If no window is currently open, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    }),
  );
});
