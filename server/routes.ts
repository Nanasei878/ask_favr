import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { databaseChatService } from "./databaseChatService";
import { insertFavorSchema } from "@shared/schema";
// Removed OpenAI import to save costs
import { notificationService } from "./notifications";
import { sendNotification } from "./unifiedNotificationService";
import { locationNotificationService } from "./locationNotifications";
import { getCountryFromCoordinates } from "./geocoding";
import { z } from "zod";
import multer from "multer";
import { aiModerationService } from "./aiModeration";
import { moderationReporter } from "./moderationReports";
import { getDemoModerationResults, testScenarios } from "./demoModerationResults";


const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

export async function registerRoutes(app: Express): Promise<Server> {
  
  // Authentication endpoints
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { firstName, lastName, email, password } = req.body;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "User already exists with this email" });
      }
      
      // Create new user
      const newUser = await storage.createUser({
        firstName,
        lastName,
        email,
        password, // In production, hash this password
      });
      
      // Return user data without password
      const { password: _, ...userWithoutPassword } = newUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  app.post("/api/auth/signin", async (req, res) => {
    try {
      const { email, password } = req.body;
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Check password (in production, use proper password hashing)
      if (user.password !== password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      // Return user data without password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Signin error:", error);
      res.status(500).json({ message: "Failed to sign in" });
    }
  });

  // VAPID public key endpoint
  app.get("/api/vapid-public-key", (req, res) => {
    res.json({ 
      publicKey: process.env.VAPID_PUBLIC_KEY || 'BIiODLOlI5kKVFlPPJ6xYZROMSheisJrGskZNdkFYH-MlXAJ2ix5aD_Pt7E0d6VccAcDck9ypxXQoL1c8GkfD2A'
    });
  });

  // Unified notification subscription endpoint (iPhone + Android)
  app.post("/api/notifications/subscribe", async (req, res) => {
    try {
      const { platform, subscriptionData, userId } = req.body;
      if (!platform || !subscriptionData || !userId) {
        return res.status(400).json({ message: "Missing platform, subscriptionData, or userId" });
      }
      if (!["onesignal", "webpush"].includes(platform)) {
        return res.status(400).json({ message: "Invalid platform" });
      }

      await storage.saveUnifiedNotificationSubscription(userId, platform, subscriptionData);

      // Mirror to legacy ONLY for webpush with a valid shape
      if (platform === "webpush") {
        try {
          const parsed = typeof subscriptionData === "string" ? JSON.parse(subscriptionData) : subscriptionData;
          const sub = parsed?.endpoint && parsed?.keys?.p256dh && parsed?.keys?.auth
            ? { endpoint: parsed.endpoint, keys: parsed.keys }
            : parsed?.subscription?.endpoint && parsed?.subscription?.keys?.p256dh && parsed?.subscription?.keys?.auth
              ? { endpoint: parsed.subscription.endpoint, keys: parsed.subscription.keys }
              : null;

          if (sub) {
            await storage.saveNotificationSubscription(userId, {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth },
            });
          } else {
            console.warn(`webpush subscriptionData invalid for mirroring; skipping legacy insert for user ${userId}`);
          }
        } catch (e) {
          console.warn(`webpush mirror parse failed for user ${userId}; skipping legacy insert`, e);
        }
      }

      res.json({ success: true, message: `${platform} subscription saved`, platform });
    } catch (err) {
      console.error("Unified subscribe error:", err);
      res.status(500).json({ message: "Failed to save subscription" });
    }
  });


  // ✅ Unsubscribe
  app.post("/api/notifications/unsubscribe", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "Missing userId" });
      await storage.removeNotificationSubscription(userId);
      res.json({ success: true, message: "Subscription removed" });
    } catch (err) {
      console.error("Unsubscribe error:", err);
      res.status(500).json({ message: "Failed to remove subscription" });
    }
  });

  app.post("/api/notifications/settings", async (req, res) => {
    try {
      const { userId, enabled } = req.body;
      
      if (!userId || typeof enabled !== 'boolean') {
        return res.status(400).json({ message: "Missing userId or enabled flag" });
      }

      const updatedUser = await storage.updateNotificationSettings(userId, enabled);
      
      if (!updatedUser) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ 
        success: true, 
        message: `Notifications ${enabled ? 'enabled' : 'disabled'}`,
        notificationsEnabled: updatedUser.notificationsEnabled
      });
    } catch (error) {
      console.error("Notification settings error:", error);
      res.status(500).json({ message: "Failed to update notification settings" });
    }
  });

  // ✅ Test notification
  app.post("/api/notifications/test", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "Missing userId" });
      const result = await notificationService.sendToUser(userId, {
        title: "Favr Test Notification",
        body: "Your notifications are working! 🚀",
        data: { url: "/" },
      });
      res.json({ success: result, notificationSent: result });
    } catch (err) {
      console.error("Test notification error:", err);
      res.status(500).json({ message: "Failed to send test notification" });
    }
  });

  // Simulate message notification for testing
  app.post("/api/simulate-message-notification", async (req, res) => {
    try {
      const { senderId, recipientId, message, chatRoomId } = req.body;
      
      if (!senderId || !recipientId || !message) {
        return res.status(400).json({ message: "Missing required fields" });
      }

      // Get sender info
      const sender = await storage.getUser(parseInt(senderId));
      const senderName = sender ? `${sender.firstName} ${sender.lastName?.charAt(0)}.` : 'Someone';
      
      // Truncate long messages
      const displayMessage = message.length > 50 ? message.substring(0, 50) + '...' : message;
      
      // Send push notification to recipient
      const result = await notificationService.sendNotificationToUser(recipientId, {
        title: `New message from ${senderName}`,
        body: displayMessage,
        icon: "/icons/icon-192x192.svg",
        data: {
          type: "new_message",
          chatRoomId,
          url: `/chat/${chatRoomId}`
        }
      });

      console.log(`Message notification simulation: ${senderName} → recipient ${recipientId}`);
      console.log(`Message: "${displayMessage}"`);
      console.log(`Notification sent: ${result ? 'SUCCESS' : 'FAILED'}`);
      
      res.json({ 
        success: true, 
        message: "Message notification simulated",
        senderName,
        displayMessage,
        notificationSent: result
      });
    } catch (error) {
      console.error("Message notification simulation error:", error);
      res.status(500).json({ message: "Failed to simulate message notification" });
    }
  });

  // Add subscription for any user (for manual testing and onboarding)
  app.post("/api/notifications/subscribe-user", async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ message: "Missing userId" });
      }

      // Create a test subscription for this user
      const testSubscription = {
        endpoint: `https://fcm.googleapis.com/fcm/send/test-endpoint-${userId}`,
        keys: {
          p256dh: "BIiODLOlI5kKVFlPPJ6xYZROMSheisJrGskZNdkFYH-MlXAJ2ix5aD_Pt7E0d6VccAcDck9ypxXQoL1c8GkfD2A",
          auth: "mRqDXJtQhd0J7fP3vSxCNw"
        }
      };

      // Save subscription to database
      await storage.saveNotificationSubscription(userId, testSubscription);
      
      console.log(`✅ Test subscription added for user ${userId}`);
      
      res.json({ 
        success: true, 
        message: `Test notification subscription created for user ${userId}`,
        subscription: testSubscription
      });
    } catch (error) {
      console.error("Error adding test subscription:", error);
      res.status(500).json({ message: "Failed to add test subscription" });
    }
  });

  // Check notification status for a user
  app.get("/api/notifications/status/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const subscriptions = await storage.getNotificationSubscriptions(userId);
      
      res.json({
        userId,
        hasNotifications: subscriptions.length > 0,
        subscriptionCount: subscriptions.length
      });
    } catch (error) {
      console.error("Error checking notification status:", error);
      res.status(500).json({ message: "Failed to check notification status" });
    }
  });

  // Complete user onboarding with demographics  
  app.post("/api/auth/complete-onboarding", async (req: any, res) => {
    try {
      const userId = req.headers['user-id']?.toString();
      const { dateOfBirth, country } = req.body;
      
      if (!userId) {
        return res.status(401).json({ message: "User not authenticated" });
      }
      
      if (!dateOfBirth || !country) {
        return res.status(400).json({ message: "Date of birth and country are required" });
      }
      
      // Validate age (must be 18+)
      const today = new Date();
      const birthDate = new Date(dateOfBirth);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 18) {
        return res.status(400).json({ message: "You must be at least 18 years old to use Favr" });
      }
      
      // Update user with demographics
      const user = await storage.updateUser(parseInt(userId), {
        dateOfBirth,
        country
      });
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json({ success: true, message: "Onboarding completed successfully" });
    } catch (error) {
      console.error("Onboarding completion error:", error);
      res.status(500).json({ message: "Failed to complete onboarding" });
    }
  });

  // Get user demographics for investor reporting
  app.get("/api/analytics/demographics", async (req, res) => {
    try {
      const demographics = await storage.getUserDemographics();
      res.json(demographics);
    } catch (error) {
      console.error("Demographics analytics error:", error);
      res.status(500).json({ message: "Failed to fetch demographics" });
    }
  });

  // Force cache refresh endpoint
  app.post("/api/force-cache-refresh", async (req, res) => {
    try {
      // This endpoint forces all clients to refresh their cache
      res.json({ 
        success: true, 
        message: "Cache refresh triggered",
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error("Cache refresh error:", error);
      res.status(500).json({ message: "Failed to refresh cache" });
    }
  });

  // Simple investor dashboard
  app.get("/api/analytics/investor-dashboard", async (req, res) => {
    try {
      const demographics = await storage.getUserDemographics();
      const allFavors = await storage.getFavors();
      
      res.json({
        userMetrics: {
          totalUsers: demographics.totalUsers,
          averageAge: demographics.averageAge,
          topCountries: Object.entries(demographics.countries)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([country, count]) => ({ country, count })),
          ageDistribution: demographics.ageGroups
        },
        platformActivity: {
          totalFavors: allFavors.length,
          activeFavors: allFavors.filter(f => f.status === 'available').length,
          completedFavors: allFavors.filter(f => f.status === 'completed').length,
          categories: allFavors.reduce((acc, favor) => {
            acc[favor.category] = (acc[favor.category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      });
    } catch (error) {
      console.error("Investor dashboard error:", error);
      res.status(500).json({ message: "Failed to fetch investor data" });
    }
  });
  
  // Update user location for notifications
  app.post("/api/user/location", async (req: any, res) => {
    try {
      // Get actual user ID from request header
      const userId = req.headers['user-id']?.toString();
      const { latitude, longitude } = req.body;
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return res.status(400).json({ error: "Latitude and longitude are required" });
      }

      
      locationNotificationService.updateUserLocation(userId, latitude, longitude);
      res.json({ success: true, message: "Location updated for notifications" });
    } catch (error) {
      console.error("Error updating user location:", error);
      res.status(500).json({ error: "Failed to update location" });
    }
  });

  // Complete favor endpoint - ONLY the favor requester can mark as complete
  app.post("/api/favors/:id/complete", async (req, res) => {
    try {
      const favorId = parseInt(req.params.id);
      const completedByUserId = req.headers['user-id']?.toString();
      const { negotiatedPrice, rating } = req.body;
      
      if (!completedByUserId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Get the favor to check who posted it
      const favor = await storage.getFavor(favorId);
      if (!favor) {
        return res.status(404).json({ error: "Favor not found" });
      }
      
      // Only the favor poster (requester) can mark it as complete
      if (favor.posterId !== completedByUserId) {
        return res.status(403).json({ error: "Only the favor requester can mark it as complete" });
      }
      
      const completedFavor = await storage.completeFavor(favorId, parseInt(completedByUserId), negotiatedPrice);
      if (!completedFavor) {
        return res.status(404).json({ error: "Favor not found" });
      }
      
      res.json({ success: true, favor: completedFavor });
    } catch (error) {
      console.error("Error completing favor:", error);
      res.status(500).json({ error: "Failed to complete favor" });
    }
  });

  // Get user completion stats
  app.get("/api/users/:userId/stats", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const stats = await storage.getUserCompletionStats(userId);
      res.json(stats);
    } catch (error) {
      console.error("Error fetching user stats:", error);
      res.status(500).json({ error: "Failed to fetch user stats" });
    }
  });

  // Get nearby favor notifications
  app.get("/api/notifications/nearby", async (req: any, res) => {
    try {
      // For now, return empty array - notifications are sent in real-time via WebSocket
      // when new favors are posted within 10km radius
      res.json([]);
    } catch (error) {
      console.error("Error fetching nearby notifications:", error);
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });


  // ========= CHAT ROUTES (unified with WebSocket + REST) =========

  // Get chat messages by favor (also returns chatRoomId & otherUserId for the UI to resolve)
  app.get("/api/chat/:favorId/messages", async (req, res) => {
    try {
      const favorId = Number(req.params.favorId);
      if (!Number.isFinite(favorId)) {
        return res.status(400).json({ error: "Invalid favorId" });
      }
      const userId = req.headers["user-id"]?.toString();
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const room = await databaseChatService.getChatRoomByFavorId(favorId);
      if (!room) return res.json({ chatRoomId: null, otherUserId: null, messages: [] });

      // authorization
      if (userId !== room.requesterId && userId !== room.helperId) {
        return res.status(403).json({ error: "Unauthorized to access this chat" });
      }

      const otherUserId = userId === room.requesterId ? room.helperId : room.requesterId;
      const otherUserOnline = databaseChatService.isUserOnline(otherUserId);

      const messages = await databaseChatService.getChatMessages(room.id);
      const formatted = messages.map((m) => ({
        id: String(m.id),
        content: String(m.content || ""),
        senderId: String(m.senderId),
        recipientId: String(m.recipientId),
        timestamp: (m.createdAt ?? new Date()).toISOString(),
        status: (m.status as "sent" | "delivered" | "seen") || "sent",
        type: (m.messageType as "text" | "system") || "text",
        isMe: String(m.senderId) === String(userId),
      }));

      res.json({
        chatRoomId: room.id,
        otherUserId,
        otherUserOnline,
        messages: formatted,
      });
    } catch (err) {
      console.error("Error fetching chat messages:", err);
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  // Conversations list for a user
  // routes.ts (your existing endpoint, just enriched)
  app.get("/api/chat/conversations", async (req, res) => {
    try {
      const userId = req.headers["user-id"]?.toString();
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const rooms = await databaseChatService.getUserChatRooms(userId);

      // simple caches to avoid duplicate lookups across rooms
      const nameCache = new Map<string, string>();
      const titleCache = new Map<number, string>();

      const conversations = await Promise.all(
        rooms.map(async (room) => {
          const msgs = await databaseChatService.getChatMessages(room.id);
          const lastMsg = msgs[msgs.length - 1];

          const otherUserId =
            room.requesterId === userId ? room.helperId : room.requesterId;

          const otherUserOnline = databaseChatService.isUserOnline(otherUserId);

          const unreadCount = msgs.filter(
            (m) => String(m.recipientId) === String(userId) && m.status !== "seen"
          ).length;

          // 🧠 favor title
          let favorTitle = titleCache.get(room.favorId);
          if (!favorTitle) {
            favorTitle = await databaseChatService.getFavorTitle(room.favorId);
            titleCache.set(room.favorId, favorTitle);
          }

          // 🧠 other user display name
          let otherUserName = nameCache.get(otherUserId);
          if (!otherUserName) {
            otherUserName = await databaseChatService.getUserDisplayName(otherUserId);
            nameCache.set(otherUserId, otherUserName);
          }

          return {
            chatRoomId: room.id,
            favorId: room.favorId,
            favorTitle,             // ✅ now present
            otherUserId,
            otherUserName,          // ✅ now present
            otherUserOnline,
            lastMessage: lastMsg ? String(lastMsg.content || "") : "Start your conversation",
            lastMessageTime: lastMsg?.createdAt
              ? lastMsg.createdAt.toISOString()
              : null,
            unreadCount,
          };
        })
      );

      res.json(conversations);
    } catch (err) {
      console.error("Error fetching conversations:", err);
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });



  // ✅ NEW: Send message by favorId (REST fallback)
  // Body: { favorId, content }
  // ✅ NEW: Send message by favorId (REST fallback)
  app.post("/api/chat/send", async (req: any, res) => {
    try {
      const userId = req.headers["user-id"]?.toString();
      const { favorId, content } = req.body;

      if (!userId) return res.status(401).json({ error: "Unauthorized" });
      if (!favorId || !content?.trim())
        return res.status(400).json({ error: "favorId and content required" });

      const room = await databaseChatService.getChatRoomByFavorId(Number(favorId));
      if (!room) return res.status(404).json({ error: "Chat room not found" });
      if (userId !== room.requesterId && userId !== room.helperId)
        return res.status(403).json({ error: "Unauthorized to post in this chat" });

      const recipientId = userId === room.requesterId ? room.helperId : room.requesterId;

      const message = await databaseChatService.saveChatMessage({
        chatRoomId: room.id,
        senderId: userId,
        recipientId,
        content: content.trim(),
        type: "text",
      });

      // Push live via WS
      databaseChatService.pushMessageToRoom(room.id, message);

      // 🔔 If recipient is offline, send unified push with deep-link URL
      const recipientOnline = databaseChatService.isUserOnline(recipientId);
      if (!recipientOnline) {
        const displayMessage =
          message.content.length > 80 ? message.content.slice(0, 80) + "…" : message.content;

        await sendNotification(
          { type: "users", userIds: [recipientId] },
          {
            type: "chat",
            title: "New message",
            message: displayMessage,
            chatId: room.id,
            favorId: room.favorId,
            icon: "/icons/chat.png",
            url: `/chat/${room.favorId}`, // 👈 deep link to the favor’s chat
          }
        );
      }

      res.json({ success: true, message });
    } catch (err) {
      console.error("Error sending chat message:", err);
      res.status(500).json({ error: "Failed to send chat message" });
    }
  });


  // ✅ Mark delivered
  app.post("/api/chat/messages/:id/delivered", async (req, res) => {
    try {
      const { id } = req.params;
      await databaseChatService.markMessageDelivered(id);
      res.json({ success: true });
    } catch (err) {
      console.error("Error marking message delivered:", err);
      res.status(500).json({ error: "Failed to update message status" });
    }
  });

  // ✅ Mark seen
  app.post("/api/chat/messages/:id/seen", async (req, res) => {
    try {
      const { id } = req.params;
      const userId = req.headers["user-id"]?.toString();
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      await databaseChatService.markMessageSeen(id, userId);
      res.json({ success: true });
    } catch (err) {
      console.error("Error marking message seen:", err);
      res.status(500).json({ error: "Failed to update message status" });
    }
  });




  // Get all favors
  app.get("/api/favors", async (req, res) => {
    try {
      const favors = await storage.getFavors();
      res.json(favors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch favors" });
    }
  });

  // Get favor by ID
  app.get("/api/favors/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const favor = await storage.getFavor(id);
      
      if (!favor) {
        return res.status(404).json({ error: "Favor not found" });
      }
      
      res.json(favor);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch favor" });
    }
  });

  // Get nearby favors
  app.get("/api/favors/nearby/:lat/:lng", async (req, res) => {
    try {
      const lat = parseFloat(req.params.lat);
      const lng = parseFloat(req.params.lng);
      const radius = parseFloat(req.query.radius as string) || 5; // Default 5km radius
      
      if (isNaN(lat) || isNaN(lng)) {
        return res.status(400).json({ error: "Invalid coordinates" });
      }
      
      const favors = await storage.getFavorsNearby(lat, lng, radius);
      res.json(favors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch nearby favors" });
    }
  });

  // Get user profile by ID
  app.get("/api/users/:userId", async (req, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Return user data without password
      const { password: _, ...userWithoutPassword } = user;
      res.json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user" });
    }
  });

  // Get user's favors
  app.get("/api/users/:userId/favors", async (req, res) => {
    try {
      const userId = req.params.userId;
      const favors = await storage.getFavorsByPoster(userId);
      res.json(favors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch user favors" });
    }
  });

  // Get user's completed favors
  app.get("/api/users/:userId/completed-favors", async (req, res) => {
    try {
      const userId = req.params.userId;
      const favors = await storage.getCompletedFavorsByUser(userId);
      res.json(favors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch completed favors" });
    }
  });

  // Update user profile (edit functionality)
  app.patch("/api/users/:userId", async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const requestorId = req.headers['user-id']?.toString();
      
      if (!requestorId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Only allow users to edit their own profile
      if (parseInt(requestorId) !== userId) {
        return res.status(403).json({ error: "You can only edit your own profile" });
      }
      
      const updateData = req.body;
      
      // Remove sensitive fields that shouldn't be updated directly
      delete updateData.id;
      delete updateData.favrPoints;
      delete updateData.completedFavrs;
      delete updateData.averageRating;
      delete updateData.totalRatings;
      delete updateData.memberSince;
      delete updateData.isVerified;
      
      const updatedUser = await storage.updateUser(userId, updateData);
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = updatedUser;
      res.json(userWithoutPassword);
    } catch (error) {
      console.error("Error updating user:", error);
      res.status(500).json({ error: "Failed to update user" });
    }
  });

  // Delete user profile  
  app.delete("/api/users/:userId", async (req: any, res) => {
    try {
      const userId = parseInt(req.params.userId);
      const requestorId = req.headers['user-id']?.toString();
      
      if (!requestorId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      // Only allow users to delete their own profile
      if (parseInt(requestorId) !== userId) {
        return res.status(403).json({ error: "You can only delete your own profile" });
      }
      
      const success = await storage.deleteUser(userId);
      if (!success) {
        return res.status(404).json({ error: "User not found or already deleted" });
      }
      
      res.json({ message: "Profile deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ error: "Failed to delete user" });
    }
  });

  // Get favors by category
  app.get("/api/favors/category/:category", async (req, res) => {
    try {
      const category = req.params.category;
      const favors = await storage.getFavorsByCategory(category);
      res.json(favors);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch favors by category" });
    }
  });

  // Delete favor endpoint
  app.delete("/api/favors/:id", async (req: any, res) => {
    try {
      const favorId = parseInt(req.params.id);
      const userId = req.headers['user-id']?.toString();
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      if (isNaN(favorId)) {
        return res.status(400).json({ error: "Invalid favor ID" });
      }
      
      const deleted = await storage.deleteFavor(favorId, userId);
      
      if (!deleted) {
        return res.status(403).json({ error: "You can only delete your own favors" });
      }
      
      res.json({ message: "Favor deleted successfully" });
    } catch (error) {
      console.error("Error deleting favor:", error);
      res.status(500).json({ error: "Failed to delete favor" });
    }
  });

  // Get user's posted and completed favors
  app.get("/api/favors/user/:userId", async (req, res) => {
    try {
      const userId = req.params.userId;
      
      const [postedFavors, completedFavors] = await Promise.all([
        storage.getFavorsByPoster(userId),
        storage.getCompletedFavorsByUser(userId)
      ]);
      
      res.json({
        posted: postedFavors,
        completed: completedFavors
      });
    } catch (error) {
      console.error("Error fetching user favors:", error);
      res.status(500).json({ error: "Failed to fetch user favors" });
    }
  });

  // Create new favor
  app.post("/api/favors", upload.single('image'), async (req, res) => {
    try {
      const userId = req.headers['user-id']?.toString();
      
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const favorData = {
        ...req.body,
        posterId: userId
      };
      
      // If image was uploaded, you would handle it here
      // For now, we'll use the imageUrl from the request body
      
      console.log('Creating favor:', favorData.title);
      const result = insertFavorSchema.safeParse(favorData);
      if (!result.success) {
        console.log('Validation errors:', result.error.issues);
        return res.status(400).json({ 
          error: "Invalid favor data", 
          details: result.error.issues 
        });
      }

      // AI content validation
      const moderation = await aiModerationService.validateFavorPost(
        favorData.title,
        favorData.description, 
        favorData.category,
        favorData.price
      );

      if (!moderation.isAppropriate) {
        console.log('Favor blocked by AI moderation:', moderation);
        return res.status(400).json({ 
          error: "Content not appropriate", 
          reason: moderation.issues.join(', '),
          suggestion: moderation.suggestion
        });
      }

      const favor = await storage.createFavor(result.data);
      
      // Update user's country based on favor location (if not already set)
      try {
        const currentUser = await storage.getUser(parseInt(favor.posterId));
        if (currentUser && !currentUser.country) {
          const country = await getCountryFromCoordinates(
            parseFloat(favor.latitude),
            parseFloat(favor.longitude)
          );
          if (country) {
            await storage.updateUserCountry(parseInt(favor.posterId), country);
          }
        }
      } catch (error) {
        console.error('Error updating user country:', error);
      }
      
      // Send location-based notifications to users within 10km
      try {
        const favorLat = parseFloat(favor.latitude);
        const favorLng = parseFloat(favor.longitude);
        
        console.log(`Sending notifications for favor ${favor.id} posted by user ${favor.posterId}`);
        
        await locationNotificationService.notifyNearbyUsers(
          favor.id,
          favor.title,
          favorLat,
          favorLng,
          favor.posterId.toString()
        );
      } catch (error) {
        console.error('Failed to send location-based notifications:', error);
      }
      
      res.status(201).json(favor);
    } catch (error: any) {
      console.error("Error creating favor:", error);
      res.status(500).json({ message: "Failed to create favor" });
    }
  });

  // Accept favor and create chat room
  app.post("/api/favors/:id/accept", async (req, res) => {
    try {
      const favorId = parseInt(req.params.id);
      const helperId = req.headers['user-id']?.toString();
      
      if (!helperId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const favor = await storage.getFavor(favorId);
      if (!favor) {
        return res.status(404).json({ error: "Favor not found" });
      }
      
      if (favor.posterId === parseInt(helperId)) {
        return res.status(400).json({ error: "Cannot accept your own favor" });
      }
      
      // Update favor status to accepted
      const updatedFavor = await storage.updateFavor(favorId, { 
        status: 'accepted',
        helperId: parseInt(helperId)
      });
      
      // Create chat room for requester and helper - ensure string IDs
      await databaseChatService.createChatRoom(favorId, favor.posterId.toString(), helperId.toString());
      
      res.json({ success: true, favor: updatedFavor });
    } catch (error) {
      console.error("Error accepting favor:", error);
      res.status(500).json({ error: "Failed to accept favor" });
    }
  });

  // Negotiate favor and create chat room
  app.post("/api/favors/:id/negotiate", async (req, res) => {
    try {
      const favorId = parseInt(req.params.id);
      const helperId = req.headers['user-id']?.toString();
      
      if (!helperId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const favor = await storage.getFavor(favorId);
      if (!favor) {
        return res.status(404).json({ error: "Favor not found" });
      }
      
      if (favor.posterId === parseInt(helperId)) {
        return res.status(400).json({ error: "Cannot negotiate on your own favor" });
      }
      
      // Create chat room for requester and helper - ensure string IDs
      await databaseChatService.createChatRoom(favorId, favor.posterId.toString(), helperId.toString());
      
      res.json({ success: true, message: "Chat room created for negotiation" });
    } catch (error) {
      console.error("Error negotiating favor:", error);
      res.status(500).json({ error: "Failed to start negotiation" });
    }
  });

  // Update favor status
  app.patch("/api/favors/:id/status", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const { status } = req.body;
      
      if (!status) {
        return res.status(400).json({ error: "Status is required" });
      }
      
      const updatedFavor = await storage.updateFavor(id, { status });
      
      if (!updatedFavor) {
        return res.status(404).json({ error: "Favor not found" });
      }
      
      res.json(updatedFavor);
    } catch (error) {
      res.status(500).json({ error: "Failed to update favor status" });
    }
  });

  // Push notification subscription management  
  /*app.post("/api/notifications/subscribe", async (req, res) => {
    try {
      const { userId, subscription } = req.body;
      
      if (!userId || !subscription) {
        return res.status(400).json({ error: "userId and subscription are required" });
      }

      // Save subscription to database using storage interface
      await storage.saveNotificationSubscription(userId.toString(), subscription);
      console.log(`✅ Notification subscription saved for user ${userId}`);
      
      res.json({ success: true, message: "Push notification subscription added" });
    } catch (error) {
      console.error("Error adding push subscription:", error);
      res.status(500).json({ error: "Failed to add push subscription" });
    }
  });*/

  /*app.post("/api/notifications/unsubscribe", async (req, res) => {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        return res.status(400).json({ error: "userId is required" });
      }

      notificationService.removeSubscription(userId);
      res.json({ success: true, message: "Push notification subscription removed" });
    } catch (error) {
      console.error("Error removing push subscription:", error);
      res.status(500).json({ error: "Failed to remove push subscription" });
    }
  });*/


  // OneSignal test notification (optimized for Apple devices) ✅ OneSignal test → now routed through unified system
  app.post("/api/notifications/onesignal-test", async (req, res) => {
    try {
      const { userId } = req.body;
      if (!userId) return res.status(400).json({ message: "Missing userId" });
      const result = await notificationService.sendNotification(userId, {
        title: "🍎 Favr Notifications Active!",
        body: "OneSignal is working perfectly on your device.",
        data: { type: "test", url: "/" },
      });
      res.json({ success: result, service: "unified" });
    } catch (err) {
      console.error("OneSignal test error:", err);
      res.status(500).json({ message: "Failed to send OneSignal test notification" });
    }
  });

  // Get all notification subscriptions (for debugging)
  app.get("/api/notifications/subscriptions", async (req, res) => {
    try {
      const userId = req.headers['user-id']?.toString();
      if (!userId) {
        return res.status(401).json({ error: "User not authenticated" });
      }
      
      const subscription = await storage.getNotificationSubscription(userId);
      res.json({ 
        hasSubscription: !!subscription,
        subscription: subscription ? { endpoint: subscription.endpoint } : null
      });
    } catch (error) {
      console.error("Error getting subscriptions:", error);
      res.status(500).json({ error: "Failed to get subscriptions" });
    }
  });

  // Notify favor updates (triggered when favor status changes)
  app.post("/api/notifications/favor-update", async (req, res) => {
    try {
      const { userId, favorId, type } = req.body;
      if (!userId || !favorId || !type) {
        return res.status(400).json({ message: "Missing required fields" });
      }
      const success = await notificationService.notifyFavorUpdate(userId, favorId, type);
      res.json({ success });
    } catch (err) {
      console.error("Favor update error:", err);
      res.status(500).json({ message: "Failed to send favor update" });
    }
  });

  // AI Moderation reporting endpoint
  app.get("/api/moderation/report", async (req, res) => {
    try {
      // Generate demo data if no events exist
      const currentReport = moderationReporter.getReport();
      if (currentReport.totalEvents === 0) {
        getDemoModerationResults();
      }
      
      const report = moderationReporter.getReport();
      res.json(report);
    } catch (error) {
      console.error("Error generating moderation report:", error);
      res.status(500).json({ error: "Failed to generate moderation report" });
    }
  });

  // Demo: Show test scenarios
  app.get("/api/moderation/demo-scenarios", async (req, res) => {
    try {
      res.json(testScenarios);
    } catch (error) {
      res.status(500).json({ error: "Failed to load demo scenarios" });
    }
  });

  // Test AI moderation endpoints for demonstration
  app.post("/api/moderation/test-message", async (req, res) => {
    try {
      const { message } = req.body;
      const result = await aiModerationService.moderateMessage(message);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Moderation test failed" });
    }
  });

  app.post("/api/moderation/test-favor", async (req, res) => {
    try {
      const { title, description, category, price } = req.body;
      const result = await aiModerationService.validateFavorPost(title, description, category, price);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: "Favor validation test failed" });
    }
  });

  const httpServer = createServer(app);
  
  // Database chat service is initialized in index.ts
  
  return httpServer;
}
