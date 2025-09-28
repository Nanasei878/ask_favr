import {
    sendOneSignalPush,
    sendOneSignalBroadcast,
    sendOneSignalLocationPush,
} from "./oneSignalService";
import { sendWebPush } from "./webPushService";
import { storage } from "./storage";

export interface UnifiedNotificationPayload {
    type: "system" | "chat" | "favor";
    title: string;
    message: string;
    url?: string;
    favorId?: number;
    chatId?: number;
    data?: Record<string, any>;
    icon?: string;
    badge?: string;
}

type Target =
    | { type: "users"; userIds: string[] }
    | { type: "all" }
    | { type: "location"; lat: number; lng: number; radiusKm: number };

/**
 * Normalize payload so `url`, `icon`, and `badge` always exist
 */
function normalizePayload(payload: UnifiedNotificationPayload) {
    const url =
        payload.url ||
        (payload.type === "chat"
            ? `/chat/${payload.chatId}`
            : payload.type === "favor"
                ? `/favor/${payload.favorId}`
                : "/explore?new=true");

    return {
        ...payload,
        icon: payload.icon || "/icon-192x192.png",
        badge: payload.badge || "/badge.png",
        data: {
            ...payload.data,
            url,
            favorId: payload.favorId,
            chatId: payload.chatId,
            type: payload.type,
        },
        url, // redundancy for OneSignal convenience
    };
}

/**
 * Core notification sender
 */
export async function sendNotification(
    target: Target,
    payload: UnifiedNotificationPayload
) {
    const normalized = normalizePayload(payload);

    switch (target.type) {
        case "users":
            return await sendToUsers(target.userIds, normalized);

        case "all":
            return await sendOneSignalBroadcast(normalized);

        case "location":
            return await sendOneSignalLocationPush(
                target.lat,
                target.lng,
                target.radiusKm,
                normalized
            );

        default:
            throw new Error("Unsupported notification target");
    }
}

/**
 * Send notification to specific users
 */
async function sendToUsers(userIds: string[], payload: UnifiedNotificationPayload) {
    const results: boolean[] = [];

    for (const userId of userIds) {
        try {
            const subscription = await storage.getUnifiedNotificationSubscription(userId);

            if (!subscription) {
                console.log(`⚠️ No subscription for user ${userId}`);
                continue;
            }

            if (subscription.platform === "onesignal") {
                await sendOneSignalPush(userId, payload);
                results.push(true);
            } else if (subscription.platform === "webpush") {
                await sendWebPush(userId, payload);
                results.push(true);
            }
        } catch (err) {
            console.error(`❌ Failed to notify user ${userId}:`, err);
            results.push(false);
        }
    }

    return results;
}
