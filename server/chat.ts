// chatService.ts
import { WebSocketServer } from "ws";
import type { Server } from "http";
import { aiModerationService } from "./aiModeration";
import { sendNotification } from "./unifiedNotificationService";
import { storage } from "./storage"; 

interface ChatMessage {
  id: string;
  favorId: number;
  senderId: string;
  recipientId: string;
  content: string;
  timestamp: Date;
  status: "sent" | "delivered" | "seen";
  type: "text" | "system";
}

interface ChatParticipant {
  userId: string;
  ws?: any;
  isOnline: boolean;
  lastSeen: Date;
}

interface ChatRoom {
  favorId: number;
  requesterId: string;
  helperId: string;
  isActive: boolean;
  participants: Map<string, ChatParticipant>;
  messages: ChatMessage[];
  createdAt: Date;
}

export class ChatService {
  private wss: WebSocketServer | null = null;
  private chatRooms: Map<number, ChatRoom> = new Map();
  private userConnections: Map<string, any> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws) => {
      console.log("Chat WebSocket connection established");

      ws.on("message", (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error("Invalid WebSocket message:", error);
        }
      });

      ws.on("close", () => {
        this.handleDisconnection(ws);
      });
    });
  }

  private handleMessage(ws: any, message: any) {
    switch (message.type) {
      case "join_chat":
        this.handleJoinChat(ws, message);
        break;
      case "send_message":
        this.handleSendMessage(ws, message);
        break;
      case "mark_seen":
        this.handleMarkSeen(ws, message);
        break;
      case "typing":
        this.handleTyping(ws, message);
        break;
    }
  }

  private handleJoinChat(ws: any, data: { favorId: number; userId: string }) {
    const { favorId, userId } = data;
    let room = this.chatRooms.get(favorId);

    if (!room) {
      room = this.createChatRoom(favorId, userId, "helper_placeholder");
      room.isActive = true;
    }

    if (!room.participants.has(userId)) {
      if (room.requesterId === "helper_placeholder") {
        room.requesterId = userId;
      } else if (room.helperId === "helper_placeholder") {
        room.helperId = userId;
      }
    }

    const participant = room.participants.get(userId) || {
      userId,
      isOnline: false,
      lastSeen: new Date(),
    };

    participant.ws = ws;
    participant.isOnline = true;
    room.participants.set(userId, participant);
    this.userConnections.set(userId, ws);

    this.chatRooms.set(favorId, room);

    // Send chat history
    ws.send(
      JSON.stringify({
        type: "chat_history",
        messages: room.messages,
        participants: Array.from(room.participants.values()).map((p) => ({
          userId: p.userId,
          isOnline: p.isOnline,
          lastSeen: p.lastSeen,
        })),
      })
    );

    this.broadcastToRoom(
      favorId,
      { type: "user_online", userId },
      userId
    );
  }

  private async handleSendMessage(
    ws: any,
    data: { favorId: number; senderId: string; content: string }
  ) {
    const { favorId, senderId, content } = data;
    let room = this.chatRooms.get(favorId);

    if (!room) {
      room = this.createChatRoom(favorId, senderId, "other_user");
      room.isActive = true;
    }

    if (!room.isActive) {
      room.isActive = true;
    }

    // AI moderation
    try {
      const moderation = await aiModerationService.moderateMessage(content, {
        senderName: senderId,
        favorTitle: `Favor #${favorId}`,
      });

      if (!moderation.isAppropriate) {
        ws.send(
          JSON.stringify({
            type: "message_blocked",
            reason: moderation.issues.join(", "),
            suggestion: moderation.suggestion,
            severity: moderation.severity,
          })
        );
        console.log("AI blocked chat message:", {
          favorId,
          senderId,
          content,
          moderation,
        });
        return;
      }
    } catch (err) {
      console.error("AI moderation error in chat:", err);
    }

    const recipientId =
      senderId === room.requesterId ? room.helperId : room.requesterId;
    const recipient = room.participants.get(recipientId);

    const message: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      favorId,
      senderId,
      recipientId,
      content: content.trim(),
      timestamp: new Date(),
      status: recipient?.isOnline ? "delivered" : "sent",
      type: "text",
    };

    room.messages.push(message);
    this.chatRooms.set(favorId, room);

    this.broadcastToRoom(favorId, { type: "new_message", message });
    ws.send(JSON.stringify({ type: "message_sent", message }));

    if (!recipient?.isOnline) {
      this.sendMessageNotification(recipientId, senderId, favorId, content);
    }
  }

  private handleMarkSeen(
    ws: any,
    data: { favorId: number; userId: string; messageId: string }
  ) {
    const { favorId, userId, messageId } = data;
    const room = this.chatRooms.get(favorId);

    if (!room) return;

    const message = room.messages.find((m) => m.id === messageId);
    if (message && message.recipientId === userId) {
      message.status = "seen";
      const sender = room.participants.get(message.senderId);
      if (sender?.ws) {
        sender.ws.send(
          JSON.stringify({ type: "message_seen", messageId, seenBy: userId })
        );
      }
    }
  }

  private handleTyping(
    ws: any,
    data: { favorId: number; userId: string; isTyping: boolean }
  ) {
    const { favorId, userId, isTyping } = data;
    this.broadcastToRoom(
      favorId,
      { type: "typing", userId, isTyping },
      userId
    );
  }

  private handleDisconnection(ws: any) {
    for (const [userId, connection] of Array.from(this.userConnections)) {
      if (connection === ws) {
        this.userConnections.delete(userId);

        for (const room of this.chatRooms.values()) {
          const participant = room.participants.get(userId);
          if (participant) {
            participant.isOnline = false;
            participant.lastSeen = new Date();
            participant.ws = undefined;

            this.broadcastToRoom(
              room.favorId,
              { type: "user_offline", userId, lastSeen: participant.lastSeen },
              userId
            );
          }
        }
        break;
      }
    }
  }

  private broadcastToRoom(favorId: number, message: any, excludeUserId?: string) {
    const room = this.chatRooms.get(favorId);
    if (!room) return;

    room.participants.forEach((p) => {
      if (p.ws && p.userId !== excludeUserId) {
        p.ws.send(JSON.stringify(message));
      }
    });
  }

  createChatRoom(favorId: number, requesterId: string, helperId: string): ChatRoom {
    const room: ChatRoom = {
      favorId,
      requesterId: requesterId.toString(),
      helperId: helperId.toString(),
      isActive: true,
      participants: new Map(),
      messages: [],
      createdAt: new Date(),
    };

    room.messages.push({
      id: `sys_${Date.now()}`,
      favorId,
      senderId: "system",
      recipientId: "",
      content: "Chat started! You can now communicate about this favor.",
      timestamp: new Date(),
      status: "delivered",
      type: "system",
    });

    this.chatRooms.set(favorId, room);
    return room;
  }

  deactivateChatRoom(favorId: number) {
    const room = this.chatRooms.get(favorId);
    if (room) {
      room.isActive = false;
      room.messages.push({
        id: `sys_${Date.now()}`,
        favorId,
        senderId: "system",
        recipientId: "",
        content: "This favor has been completed. Chat is now read-only.",
        timestamp: new Date(),
        status: "delivered",
        type: "system",
      });
      this.broadcastToRoom(favorId, {
        type: "chat_deactivated",
        message: "Chat is now read-only",
      });
    }
  }

  getChatMessages(favorId: number, userId: string): ChatMessage[] {
    const room = this.chatRooms.get(favorId);
    if (!room || (userId !== room.requesterId && userId !== room.helperId)) {
      return [];
    }
    return room.messages;
  }

  private async sendMessageNotification(
    recipientId: string,
    senderId: string,
    favorId: number,
    content: string
  ) {
    try {
      const displayMessage =
        content.length > 80 ? content.substring(0, 80) + "…" : content;

      // 🔽 Get sender first name (fallback to "Someone")
      let senderFirstName = "Someone";
      try {
        const senderNum = Number(senderId);
        if (!Number.isNaN(senderNum)) {
          const sender = await storage.getUser(senderNum);
          if (sender?.firstName) senderFirstName = sender.firstName;
        }
      } catch { /* ignore */ }

      await sendNotification(
        { type: "users", userIds: [recipientId] },
        {
          type: "chat",
          title: `New message from ${senderFirstName}`, // 🔽 use first name
          message: displayMessage,
          favorId,
          chatId: favorId, // if 1:1 with favors
          icon: "/icons/chat.png",
          url: `/chat/${favorId}`, // nice to include so the SW can deep-link
        }
      );

      console.log(
        `📩 Push notification queued for recipient ${recipientId} (from ${senderId})`
      );
    } catch (err) {
      console.error("❌ Failed to send chat push:", err);
    }
  }

  getUserChatRooms(userId: string): ChatRoom[] {
    console.log(
      `Getting chat rooms for user ${userId}, total rooms: ${this.chatRooms.size}`
    );
    const userRooms = Array.from(this.chatRooms.values()).filter(
      (room) => room.requesterId === userId || room.helperId === userId
    );
    console.log(`Found ${userRooms.length} rooms for user ${userId}`);
    return userRooms;
  }

  debugChatRooms(): void {
    console.log("All chat rooms:", Array.from(this.chatRooms.entries()));
  }
}

export const chatService = new ChatService();
