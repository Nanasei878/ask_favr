// lib/unifiedNotifications.ts
// Enhanced Unified Notification Service (frontend)
// - Chooses OneSignal (iOS/Safari) or Web Push (Android/Desktop)
// - Registers with backend unified subscribe endpoint
// - Handles SW-triggered resubscribe
// - Compatible with OneSignal v16+ (with v15 fallback)

import { detectDevice } from "./deviceDetection";

declare global {
  interface Window {
    OneSignal?: any; // v15 or v16 SDK
  }
}

type Platform = "onesignal" | "webpush";

interface NotificationSubscription {
  platform: Platform;
  subscriptionId: string; // OneSignal player/external push ID OR JSON.stringify(PushSubscription)
  userId: string;
  endpoint?: string;
}

class UnifiedNotificationService {
  private device = detectDevice();
  private initialized = false;
  private lastUserId: string | null = null;

  async initialize(): Promise<boolean> {
    if (this.initialized) return true;

    console.log(
      `🔔 Initializing notifications for ${this.device.platform} (${this.device.browser})`
    );

    try {
      if (this.shouldUseOneSignal()) {
        await this.initializeOneSignal();
      } else {
        await this.initializeWebPush();
      }

      // Listen for SW resubscribe requests (web push path)
      if (!this.shouldUseOneSignal() && "serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", async (evt: MessageEvent) => {
          const msg = evt.data || {};
          if (msg.type === "REQUEST_RESUBSCRIBE" && this.lastUserId) {
            console.log("🔁 SW requested resubscribe; attempting…");
            await this.subscribeWebPush(this.lastUserId).catch(() => { });
          }
          if (msg.type === "RESUBSCRIBED" && this.lastUserId && msg.subscription) {
            // Some browsers give us the new subscription directly
            console.log("✅ SW silently re-subscribed; registering with backend…");
            await this.registerWithBackend({
              platform: "webpush",
              subscriptionId: JSON.stringify(msg.subscription),
              userId: this.lastUserId,
              endpoint: msg.subscription?.endpoint,
            }).catch(() => { });
          }
        });
      }

      this.initialized = true;
      return true;
    } catch (error) {
      console.error("❌ Notification initialization failed:", error);
      return false;
    }
  }

  private shouldUseOneSignal(): boolean {
    // Use OneSignal for iOS / iPadOS / (often) macOS Safari, or if Push API is missing.
    return Boolean(this.device?.needsOneSignal || !("PushManager" in window));
  }

  /* -------------------------- OneSignal path --------------------------- */

  private async initializeOneSignal(): Promise<void> {
    await this.waitForOneSignal();

    if (!window.OneSignal) {
      throw new Error("OneSignal failed to load");
    }

    // v16 init shape; with v15 this also no-ops safely when options overlap.
    await window.OneSignal.init?.({
      appId: import.meta.env.VITE_ONESIGNAL_APP_ID,
      safari_web_id: import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID,
      notifyButton: { enable: false },
      allowLocalhostAsSecureOrigin: true,
    });

    console.log("✅ OneSignal initialized");
  }

  private waitForOneSignal(): Promise<void> {
    return new Promise((resolve, reject) => {
      const deadline = Date.now() + 10000;
      const tick = () => {
        if (window.OneSignal) return resolve();
        if (Date.now() > deadline) return reject(new Error("OneSignal timeout"));
        setTimeout(tick, 100);
      };
      tick();
    });
  }

  private async requestOneSignalPermission(): Promise<boolean> {
    try {
      await this.initializeOneSignal();

      // v16
      if (window.OneSignal?.Notifications?.requestPermission) {
        const res = await window.OneSignal.Notifications.requestPermission();
        return res === "granted" || res === true;
      }

      // v15 fallback
      const res = await window.OneSignal.requestPermission?.();
      return res === "granted" || res === true;
    } catch (error) {
      console.error("OneSignal permission error:", error);
      return false;
    }
  }

  private async subscribeOneSignal(userId: string): Promise<NotificationSubscription | null> {
    try {
      // v16 preferred: login associates the external user id
      if (window.OneSignal?.login) {
        await window.OneSignal.login(userId);
      } else {
        // v15 fallback
        await window.OneSignal.setExternalUserId?.(userId);
      }

      // Get push ID
      let pushId: string | null = null;

      // v16: OneSignal.User.PushSubscription.getId()
      if (window.OneSignal?.User?.PushSubscription?.getId) {
        pushId = await window.OneSignal.User.PushSubscription.getId();
      }

      // v15 fallback: getPlayerId()
      if (!pushId && window.OneSignal?.getPlayerId) {
        pushId = await window.OneSignal.getPlayerId();
      }

      if (!pushId) {
        console.error("❌ OneSignal subscription failed: no push id");
        return null;
      }

      await this.registerWithBackend({
        platform: "onesignal",
        subscriptionId: pushId,
        userId,
      });

      console.log("✅ OneSignal subscription registered:", pushId);
      return { platform: "onesignal", subscriptionId: pushId, userId };
    } catch (error) {
      console.error("❌ OneSignal subscribe error:", error);
      return null;
    }
  }

  /* --------------------------- Web Push path --------------------------- */

  private async initializeWebPush(): Promise<void> {
    if (!("serviceWorker" in navigator)) {
      throw new Error("Service Worker not supported");
    }

    // Register your canonical SW
    const reg = await navigator.serviceWorker.register("/sw.js", { updateViaCache: "none" });
    await navigator.serviceWorker.ready;
    console.log("✅ Service Worker registered", reg.scope);
  }

  private async requestWebPushPermission(): Promise<boolean> {
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const perm = await Notification.requestPermission();
    return perm === "granted";
  }

  private async subscribeWebPush(userId: string): Promise<NotificationSubscription | null> {
    try {
      const registration = await navigator.serviceWorker.ready;

      const vapidResp = await fetch("/api/vapid-public-key", { credentials: "same-origin" });
      const ct = String(vapidResp.headers.get("content-type") || "");
      if (!vapidResp.ok || !ct.includes("application/json")) {
        const sample = await vapidResp.text().catch(() => "");
        throw new Error(
          `VAPID endpoint returned ${vapidResp.status} ${vapidResp.statusText} (ct=${ct}). ` +
          `Body preview: ${sample.slice(0, 200)}`
        );
      }
      const { publicKey } = await vapidResp.json();

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(publicKey),
      });

      const subData: NotificationSubscription = {
        platform: "webpush",
        subscriptionId: JSON.stringify(subscription),
        userId,
        endpoint: subscription.endpoint,
      };

      await this.registerWithBackend(subData);

      console.log("✅ Web Push subscription registered");
      return subData;
    } catch (error) {
      console.error("❌ Web Push subscribe error:", error);
      return null;
    }
  }

  /* --------------------------- Public API ------------------------------ */

  async requestPermission(): Promise<boolean> {
    await this.initialize();
    return this.shouldUseOneSignal()
      ? this.requestOneSignalPermission()
      : this.requestWebPushPermission();
  }

  async subscribe(userId: string): Promise<NotificationSubscription | null> {
    await this.initialize();
    this.lastUserId = userId;

    console.log(
      `📱 Subscribing user ${userId} to ${this.shouldUseOneSignal() ? "OneSignal" : "Web Push"}`
    );

    return this.shouldUseOneSignal()
      ? this.subscribeOneSignal(userId)
      : this.subscribeWebPush(userId);
  }

  async isSubscribed(): Promise<boolean> {
    if (this.shouldUseOneSignal()) {
      try {
        await this.initializeOneSignal();
        // v16
        if (window.OneSignal?.Notifications?.isPushEnabled) {
          return await window.OneSignal.Notifications.isPushEnabled();
        }
        // v15
        return Boolean(await window.OneSignal?.isPushNotificationsEnabled?.());
      } catch {
        return false;
      }
    } else {
      try {
        const reg = await navigator.serviceWorker.ready;
        const s = await reg.pushManager.getSubscription();
        return !!s;
      } catch {
        return false;
      }
    }
  }

  async testNotification(userId: string): Promise<boolean> {
    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "user-id": userId, // harmless; server ignores header for this endpoint
        },
        body: JSON.stringify({ userId }), // server expects just userId
      });
      const json = await res.json();
      return Boolean(json?.success);
    } catch (e) {
      console.error("Test notification failed:", e);
      return false;
    }
  }

  getDeviceInfo() {
    return this.device;
  }

  /* --------------------------- Helpers --------------------------------- */

  private async registerWithBackend(subscription: NotificationSubscription): Promise<void> {
    const resp = await fetch("/api/notifications/subscribe", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "user-id": subscription.userId, // optional
      },
      body: JSON.stringify({
        platform: subscription.platform,            // "onesignal" | "webpush"
        subscriptionData: subscription.subscriptionId, // stringified sub or onesignal id
        userId: subscription.userId,
        // endpoint/deviceInfo are extra; backend currently ignores them.
        endpoint: subscription.endpoint,
        deviceInfo: this.device,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Backend registration failed: ${text}`);
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
    const rawData = atob(base64);
    const output = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i);
    return output;
  }
}

// Singleton
export const unifiedNotificationService = new UnifiedNotificationService();

// Convenience helpers
export async function subscribeToNotifications(userId: string): Promise<boolean> {
  const ok = await unifiedNotificationService.requestPermission();
  if (!ok) return false;
  const sub = await unifiedNotificationService.subscribe(userId);
  return !!sub;
}

export async function testNotifications(userId: string): Promise<boolean> {
  return unifiedNotificationService.testNotification(userId);
}
