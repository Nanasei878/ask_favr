// Favr PWA Service Worker (Web Push)
// ----------------------------------
const SW_VERSION = "v2.1.0";
const DEFAULT_ICON = "/icon-192x192.png";
const DEFAULT_BADGE = "/badge.png";

console.log(`🚀 Favr Service Worker loaded :: ${SW_VERSION}`);

/* ----------------------------- Utilities -------------------------------- */

function safeParsePushData(event) {
  if (!event.data) return {};
  try {
    return event.data.json();
  } catch {
    try {
      return JSON.parse(event.data.text());
    } catch {
      return {};
    }
  }
}

function broadcastToClients(message) {
  return self.clients
    .matchAll({ type: "window", includeUncontrolled: true })
    .then((clients) => {
      clients.forEach((c) => {
        try {
          c.postMessage(message);
        } catch {
          // ignore
        }
      });
    });
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) arr[i] = raw.charCodeAt(i);
  return arr;
}

/* ---------------------------- Push handling ------------------------------ */

self.addEventListener("push", (event) => {
  console.log("[SW] Push event received");

  const data = safeParsePushData(event);
  // Recommended payload shape from server:
  // {
  //   title, body, icon?, badge?,
  //   data?: { url?, favorId?, chatId?, type?, id? }
  // }

  const title = data.title || "Notification";
  const options = {
    body: data.body || "You have a new notification",
    icon: data.icon || DEFAULT_ICON,
    badge: data.badge || DEFAULT_BADGE,
    data: data.data || {},
    requireInteraction: false,
    renotify: true,
    tag: "favr-notification",
    silent: false,
    timestamp: Date.now(),
  };

  // Also notify any open tabs so the in-app list updates immediately
  const uiPayload = {
    id:
      (options.data && (options.data.id || options.data.messageId)) ||
      `${options.data?.type || "general"}-${options.timestamp}`,
    title,
    body: options.body,
    icon: options.icon,
    url: options.data?.url,
    type: options.data?.type || "general",
    ts: options.timestamp,
  };

  event.waitUntil(
    Promise.all([
      self.registration
        .showNotification(title, options)
        .then(() => console.log("[SW] Notification displayed"))
        .catch((err) => console.error("[SW] showNotification error:", err)),
      broadcastToClients({ type: "PUSH_NOTIFICATION", payload: uiPayload }),
    ])
  );
});

/* ------------------------ Notification click open ------------------------ */

self.addEventListener("notificationclick", (event) => {
  console.log("[SW] Notification click");
  event.notification.close();

  const urlToOpen =
    (event.notification.data && event.notification.data.url) ||
    "/explore?new=true";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Reuse an existing tab if possible
        for (const client of clientList) {
          if (
            client.url.startsWith(self.location.origin) &&
            "focus" in client
          ) {
            client.postMessage({
              type: "NOTIFICATION_CLICKED",
              url: urlToOpen,
            });
            return client.focus();
          }
        }
        // Otherwise, open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(urlToOpen);
        }
      })
      .catch((err) => console.error("[SW] notificationclick error:", err))
  );
});

/* ----------------------- Subscription change recovery -------------------- */

self.addEventListener("pushsubscriptionchange", (event) => {
  console.log("[SW] pushsubscriptionchange");

  event.waitUntil(
    broadcastToClients({ type: "REQUEST_RESUBSCRIBE" }).then(async () => {
      // Optional silent resubscribe fallback
      try {
        const resp = await fetch("/api/vapid-public-key", {
          credentials: "omit",
        });
        const { publicKey } = await resp.json();
        if (publicKey && self.registration?.pushManager) {
          const newSub = await self.registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(publicKey),
          });
          await broadcastToClients({
            type: "RESUBSCRIBED",
            subscription: newSub,
          });
        }
      } catch (e) {
        console.warn("[SW] Silent resubscribe failed:", e);
      }
    })
  );
});

/* -------------------------- Lifecycle & updates -------------------------- */

self.addEventListener("install", (event) => {
  console.log(`[SW] Installing… ${SW_VERSION}`);
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  console.log(`[SW] Activated :: ${SW_VERSION}`);
  event.waitUntil(self.clients.claim());
});

/* ----------------------------- Page messaging ---------------------------- */

self.addEventListener("message", (event) => {
  const { data } = event;
  if (!data || !data.type) return;
  if (data.type === "SKIP_WAITING") {
    console.log("[SW] SKIP_WAITING requested");
    self.skipWaiting();
  }
});
