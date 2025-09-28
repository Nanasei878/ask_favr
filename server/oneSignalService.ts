// oneSignalService.ts
import * as OneSignal from "@onesignal/node-onesignal";
import { UnifiedNotificationPayload } from "./unifiedNotificationService";

const ONESIGNAL_APP_ID = process.env.ONESIGNAL_APP_ID!;
const ONESIGNAL_API_KEY = process.env.ONESIGNAL_REST_API_KEY!;

const configuration = OneSignal.createConfiguration({
  appKey: ONESIGNAL_API_KEY,
});
const client = new OneSignal.DefaultApi(configuration);

/**
 * Send push to a specific user by external_user_id
 */
export async function sendOneSignalPush(
  userId: string,
  payload: UnifiedNotificationPayload
) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    console.warn("⚠️ OneSignal not configured — cannot send iOS push");
    return;
  }

  try {
    const notification = new OneSignal.Notification();
    notification.app_id = ONESIGNAL_APP_ID;
    notification.include_external_user_ids = [userId];
    notification.headings = { en: payload.title };
    notification.contents = { en: payload.message };

    if (payload.url) notification.url = payload.url;
    if (payload.data) notification.data = payload.data;

    if (payload.icon) {
      notification.chrome_web_icon = payload.icon;
      notification.large_icon = payload.icon;
      notification.ios_attachments = { image: payload.icon };
    }

    if (payload.badge) {
      notification.ios_badgeType = "Increase";
      notification.ios_badgeCount = 1;
    }

    await client.createNotification(notification);
    console.log(`✅ OneSignal push sent to user ${userId}`);
  } catch (err) {
    console.error(`❌ OneSignal push failed for user ${userId}:`, err);
  }
}

/**
 * Broadcast push to all subscribed users
 */
export async function sendOneSignalBroadcast(
  payload: UnifiedNotificationPayload
) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    console.warn("⚠️ OneSignal not configured — cannot send broadcast");
    return;
  }

  try {
    const notification = new OneSignal.Notification();
    notification.app_id = ONESIGNAL_APP_ID;
    notification.included_segments = ["All"];
    notification.headings = { en: payload.title };
    notification.contents = { en: payload.message };

    if (payload.url) notification.url = payload.url;
    if (payload.data) notification.data = payload.data;
    if (payload.icon) {
      notification.chrome_web_icon = payload.icon;
      notification.large_icon = payload.icon;
      notification.ios_attachments = { image: payload.icon };
    }

    await client.createNotification(notification);
    console.log("✅ OneSignal broadcast sent");
  } catch (err) {
    console.error("❌ OneSignal broadcast failed:", err);
  }
}

/**
 * Geo-targeted push for users near a location
 */
export async function sendOneSignalLocationPush(
  lat: number,
  lng: number,
  radiusKm: number,
  payload: UnifiedNotificationPayload
) {
  if (!ONESIGNAL_APP_ID || !ONESIGNAL_API_KEY) {
    console.warn("⚠️ OneSignal not configured — cannot send geo push");
    return;
  }

  try {
    const notification = new OneSignal.Notification();
    notification.app_id = ONESIGNAL_APP_ID;

    notification.filters = [
      {
        field: "location",
        radius: radiusKm * 1000, // km → meters
        lat,
        long: lng,
      },
    ];

    notification.headings = { en: payload.title };
    notification.contents = { en: payload.message };

    if (payload.url) notification.url = payload.url;
    if (payload.data) notification.data = payload.data;
    if (payload.icon) {
      notification.chrome_web_icon = payload.icon;
      notification.large_icon = payload.icon;
      notification.ios_attachments = { image: payload.icon };
    }

    await client.createNotification(notification);
    console.log(
      `✅ OneSignal geo push sent at [${lat},${lng}] within ${radiusKm}km`
    );
  } catch (err) {
    console.error("❌ OneSignal geo push failed:", err);
  }
}
