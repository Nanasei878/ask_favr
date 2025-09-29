// locationNotifications.ts
import { storage } from "./storage";
import { sendNotification } from "./unifiedNotificationService";

interface UserLocation {
  userId: string;
  latitude: number;
  longitude: number;
  lastUpdated: Date;
}

class LocationNotificationService {
  private userLocations: Map<string, UserLocation> = new Map();
  private readonly NOTIFICATION_RADIUS_KM = 25;

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.deg2rad(lat1)) *
      Math.cos(this.deg2rad(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI / 180);
  }

  updateUserLocation(userId: string, latitude: number, longitude: number) {
    this.userLocations.set(userId, {
      userId,
      latitude,
      longitude,
      lastUpdated: new Date(),
    });
    console.log(`📍 Location updated for ${userId}: lat ${latitude}, lng ${longitude}`);
  }

  private getUsersNearFavor(favorLat: number, favorLng: number): string[] {
    const nearby: string[] = [];
    for (const [userId, loc] of this.userLocations.entries()) {
      const dist = this.calculateDistance(favorLat, favorLng, loc.latitude, loc.longitude);
      if (dist <= this.NOTIFICATION_RADIUS_KM) {
        nearby.push(userId);
      }
    }
    return nearby;
  }

  /**
   * Notify nearby users about a new favor
   * @param favorId - Favor ID
   * @param favorTitle - Favor title
   * @param favorLat - Favor latitude
   * @param favorLng - Favor longitude
   * @param posterId - ID of user posting
   * @param useOneSignalGeo - If true, offloads geo-filtering to OneSignal
   */
  async notifyNearbyUsers(
    favorId: number,
    favorTitle: string,
    favorLat: number,
    favorLng: number,
    posterId: string,
    useOneSignalGeo: boolean = false
  ) {
    try {
      const payload = {
        type: "favor" as const,
        title: "New Favor Near You!",
        message: `"${favorTitle}" was posted in your area`,
        icon: "/icons/favr.png",
        favorId,
        url: `/favor/${favorId}`,
        data: { type: "new_favor", favorId },
      };

      if (useOneSignalGeo) {
        // ✅ Let OneSignal handle location targeting
        await sendNotification(
          { type: "location", lat: favorLat, lng: favorLng, radiusKm: this.NOTIFICATION_RADIUS_KM },
          payload
        );
        console.log(`📢 OneSignal geo-notification sent for favor ${favorId}`);
        return;
      }

      // 🔎 Server-side filtering
      console.log(`Looking for users near [${favorLat},${favorLng}]`);

      const nearbyUsers = this.getUsersNearFavor(favorLat, favorLng);
      const usersToNotify = nearbyUsers.filter((id) => id !== posterId.toString());

      if (usersToNotify.length === 0) {
        console.log("⚠️ No nearby users found");
        return;
      }

      const enabledUsers = await this.filterNotificationEnabledUsers(usersToNotify);
      if (enabledUsers.length === 0) {
        console.log("⚠️ No enabled users for location notification");
        return;
      }

      await sendNotification({ type: "users", userIds: enabledUsers }, payload);
      console.log(`✅ Location notification sent to ${enabledUsers.length} users`);
    } catch (error) {
      console.error("❌ Location notification error:", error);
    }
  }

  async filterNotificationEnabledUsers(userIds: string[]): Promise<string[]> {
    const enabled: string[] = [];
    for (const id of userIds) {
      try {
        const user = await storage.getUser(parseInt(id));
        if (user?.notificationsEnabled) enabled.push(id);
      } catch (err) {
        console.error(`⚠️ Error checking user ${id}:`, err);
      }
    }
    return enabled;
  }

  cleanupOldLocations() {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    for (const [userId, loc] of this.userLocations.entries()) {
      if (loc.lastUpdated < cutoff) this.userLocations.delete(userId);
    }
  }

  getActiveUserCount() {
    return this.userLocations.size;
  }
}

export const locationNotificationService = new LocationNotificationService();

// Auto-clean old locations
setInterval(() => {
  locationNotificationService.cleanupOldLocations();
}, 60 * 60 * 1000);
