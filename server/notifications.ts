// notifications.ts
import { sendNotification } from "./unifiedNotificationService";

interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: any;
}

export class NotificationService {
  // Send to one user
  async sendNotification(userId: string, payload: NotificationPayload) {
    try {
      await sendNotification(
        { type: "users", userIds: [userId] },
        {
          type: "system", // default, caller can override
          title: payload.title,
          message: payload.body,
          url: payload.data?.url,
          favorId: payload.data?.favorId,
          chatId: payload.data?.chatId,
          icon: payload.icon,
          badge: payload.badge,
          data: payload.data,
        }
      );
      return true;
    } catch (error) {
      console.error(`❌ Failed to notify user ${userId}:`, error);
      return false;
    }
  }

  // Aliases
  async sendToUser(userId: string, payload: NotificationPayload) {
    return this.sendNotification(userId, payload);
  }

  async sendNotificationToUser(userId: string, payload: NotificationPayload) {
    return this.sendNotification(userId, payload);
  }

  // Favor-specific templates
  async notifyFavorUpdate(
    userId: string,
    favorId: number,
    type: "accepted" | "completed" | "cancelled" | "new_message"
  ) {
    const templates = {
      accepted: {
        title: "Favr Accepted! 🎉",
        body: "Someone accepted your favor request. Check the details!",
        icon: "/icon-192x192.png",
      },
      completed: {
        title: "Favr Completed ✅",
        body: "Your favor has been marked as completed. Don’t forget to rate!",
        icon: "/icon-192x192.png",
      },
      cancelled: {
        title: "Favr Cancelled",
        body: "A favor has been cancelled. View details for more info.",
        icon: "/icon-192x192.png",
      },
      new_message: {
        title: "New Message 💬",
        body: "You have a new message about your favor.",
        icon: "/icon-192x192.png",
      },
    };

    const payload = templates[type];
    return this.sendNotification(userId, {
      ...payload,
      data: { favorId, type, url: `/favor/${favorId}` },
    });
  }

  // Broadcast wrapper
  async broadcastNotification(userIds: string[], payload: NotificationPayload) {
    try {
      const results = await sendNotification(
        { type: "users", userIds },
        {
          type: "system",
          title: payload.title,
          message: payload.body,
          url: payload.data?.url,
          favorId: payload.data?.favorId,
          chatId: payload.data?.chatId,
          icon: payload.icon,
          badge: payload.badge,
          data: payload.data,
        }
      );

      console.log(`📢 Broadcast attempted for ${userIds.length} users`);
      return results;
    } catch (error) {
      console.error("❌ Broadcast failed:", error);
      return false;
    }
  }
}

export const notificationService = new NotificationService();
