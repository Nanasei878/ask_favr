// webPushService.ts
import webPush from "web-push";
import { pool } from "./db";
import { storage } from "./storage";
import { UnifiedNotificationPayload } from "./unifiedNotificationService";

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY!;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY!;

webPush.setVapidDetails(
    "mailto:support@favr.com",
    VAPID_PUBLIC_KEY,
    VAPID_PRIVATE_KEY
);

// Helper: normalize various stored shapes to { endpoint, keys: { p256dh, auth } }
function extractSubscriptionFromJSON(
    raw: any
): { endpoint: string; keys: { p256dh: string; auth: string } } | null {
    if (!raw) return null;

    // If it came as a string, parse it
    const data = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
    if (!data) return null;

    // Standard PushSubscription JSON shape
    if (data.endpoint && data.keys?.p256dh && data.keys?.auth) {
        return {
            endpoint: data.endpoint,
            keys: { p256dh: data.keys.p256dh, auth: data.keys.auth },
        };
    }

    // Some libs store under 'subscription' property
    if (data.subscription?.endpoint && data.subscription?.keys?.p256dh && data.subscription?.keys?.auth) {
        return {
            endpoint: data.subscription.endpoint,
            keys: {
                p256dh: data.subscription.keys.p256dh,
                auth: data.subscription.keys.auth,
            },
        };
    }

    // Already normalized
    if (data.endpoint && data.p256dh && data.auth) {
        return {
            endpoint: data.endpoint,
            keys: { p256dh: data.p256dh, auth: data.auth },
        };
    }

    return null;
}

export async function sendWebPush(userId: string, payload: UnifiedNotificationPayload) {
    try {
        // 1) Try unified subscription first
        let unifiedSub: any = null;
        try {
            unifiedSub = await storage.getUnifiedNotificationSubscription?.(userId);
        } catch (_) {
            // ignore if storage doesn’t expose it in this build
        }

        const candidateSubscriptions: Array<{ endpoint: string; keys: { p256dh: string; auth: string } }> = [];

        if (unifiedSub && (unifiedSub.platform === "webpush" || unifiedSub.platform === "WEBPUSH")) {
            const parsed = extractSubscriptionFromJSON(
                unifiedSub.subscriptionData ?? unifiedSub.subscription_data ?? unifiedSub.subscription
            );
            if (parsed) candidateSubscriptions.push(parsed);
        }

        // 2) Fallback to legacy table rows (notification_subscriptions)
        if (candidateSubscriptions.length === 0) {
            const { rows } = await pool.query(
                `SELECT endpoint, p256dh_key AS p256dh, auth_key AS auth
     FROM notification_subscriptions
    WHERE user_id = $1`,
                [userId]
            );

            for (const row of rows) {
                if (row.endpoint && row.p256dh && row.auth) {
                    candidateSubscriptions.push({
                        endpoint: row.endpoint,
                        keys: { p256dh: row.p256dh, auth: row.auth },
                    });
                }
            }
        }

        if (candidateSubscriptions.length === 0) {
            console.warn(`No Web Push subscription for user ${userId}`);
            return;
        }

        // Build payload (with sensible URL fallbacks)
        const urlFromType =
            payload.url ??
            (payload.type === "chat" && payload.favorId
                ? `/chat/${payload.favorId}`
                : payload.type === "favor" && payload.favorId
                    ? `/favor/${payload.favorId}`
                    : "/explore?new=true");

        const notificationPayload = JSON.stringify({
            title: payload.title,
            body: payload.message,
            icon: payload.icon || "/icon-192x192.png",
            badge: payload.badge || "/badge.png",
            data: {
                ...(payload.data || {}),
                url: urlFromType,
                favorId: payload.favorId,
                chatId: payload.chatId,
                type: payload.type,
            },
        });

        for (const sub of candidateSubscriptions) {
            const subscription = { endpoint: sub.endpoint, keys: sub.keys };

            try {
                await webPush.sendNotification(subscription, notificationPayload);
                console.log(`✅ Web Push sent to user ${userId}`);
            } catch (err: any) {
                console.error("❌ Web Push failed:", err?.message || err);

                // Clean up expired legacy entries
                if ((err?.statusCode === 410 || err?.statusCode === 404) && sub.endpoint) {
                    try {
                        await pool.query(`DELETE FROM notification_subscriptions WHERE endpoint = $1`, [sub.endpoint]);
                    } catch (_) {
                        /* ignore */
                    }
                }
            }
        }
    } catch (err) {
        console.error(`❌ Error in sendWebPush for user ${userId}:`, err);
    }
}
