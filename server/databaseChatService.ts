// databaseChatService.ts
import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { db } from "./db";
import { chatRooms, chatMessages, users as usersTbl, favors as favorsTbl } from "@shared/schema";
import { eq, and, or, desc, asc } from "drizzle-orm";
import type {
  ChatRoom as DbChatRoom,
  ChatMessage as DbChatMessage,
  InsertChatRoom,
  InsertChatMessage,
} from "@shared/schema";
import { sendNotification } from "./unifiedNotificationService";

type MessageStatus = "sent" | "delivered" | "seen";
type MessageType = "text" | "system";

interface ChatParticipant {
  userId: string;
  ws?: WebSocket;
  isOnline: boolean;
  lastSeen: Date;
}

interface ActiveChatRoom {
  id: number;
  favorId: number;
  requesterId: string;
  helperId: string;
  isActive: boolean;
  participants: Map<string, ChatParticipant>;
  createdAt: Date;
}

export class DatabaseChatService {
  private wss: WebSocketServer | null = null;

  /** live presence in currently active rooms (chatRoomId -> room state) */
  private activeChatRooms: Map<number, ActiveChatRoom> = new Map();

  /** global connections for users (userId -> ws), used for cross-room events/badges */
  private userConnections: Map<string, WebSocket> = new Map();

  initialize(server: Server) {
    this.wss = new WebSocketServer({ server, path: "/ws" });

    this.wss.on("connection", (ws) => {
      console.log("Chat WebSocket connection established");

      ws.on("message", async (message) => {
        try {
          const data = JSON.parse(message.toString());
          await this.handleMessage(ws, data);
        } catch (error) {
          console.error("Error handling WebSocket message:", error);
          ws.send(JSON.stringify({ type: "error", message: "Invalid message format" }));
        }
      });

      ws.on("close", () => {
        this.handleDisconnection(ws);
      });

      ws.on("error", (error) => {
        console.error("WebSocket error:", error);
      });
    });

    console.log("Database Chat service initialized with WebSocket support");
  }

  // ---------- WebSocket message dispatcher ----------
  private async handleMessage(ws: WebSocket, message: any) {
    switch (message.type) {
      case "register_user":
        await this.handleRegisterUser(ws, message);
        break;
      case "join_chat":
        await this.handleJoinChat(ws, message);
        break;
      case "send_message":
        await this.handleSendMessage(ws, message);
        break;
      case "mark_seen":
        await this.handleMarkSeen(ws, message);
        break;
      case "typing":
        await this.handleTyping(ws, message);
        break;
      default:
        ws.send(JSON.stringify({ type: "error", message: "Unknown message type" }));
    }
  }

  // ---------- Presence / registration ----------
  /** private async handleRegisterUser(ws: WebSocket, data: { userId: string }) {
    const { userId } = data;
    try {
      this.userConnections.set(userId, ws);
      console.log(`🔌 User ${userId} registered for global chat notifications`);
      ws.send(
        JSON.stringify({
          type: "user_registered",
          message: "Successfully registered for notifications",
        })
      );
    } catch (error) {
      console.error("Error registering user:", error);
      ws.send(JSON.stringify({ type: "error", message: "Failed to register for notifications" }));
    }
  } */

  private async handleRegisterUser(ws: WebSocket, data: { userId?: string }) {
    const userId = (data?.userId ?? "").toString().trim();
    if (!userId) {
      console.warn("register_user called without userId; ignoring");
      ws.send(JSON.stringify({ type: "error", message: "userId required" }));
      return;
    }
    this.userConnections.set(userId, ws);
    console.log(`🔌 User ${userId} registered for global chat notifications`);
    ws.send(JSON.stringify({ type: "user_registered", message: "Successfully registered for notifications" }));
  }


  /** public helper for routes */
  isUserOnline(userId: string): boolean {
    const ws = this.userConnections.get(userId);
    return !!ws && ws.readyState === WebSocket.OPEN;
  }

  // ---------- Join room / history ----------
  private async handleJoinChat(ws: WebSocket, data: { favorId: number; userId: string }) {
    const { favorId, userId } = data;

    try {
      const chatRoom = await this.getChatRoomByFavorId(favorId);
      if (!chatRoom) {
        ws.send(
          JSON.stringify({
            type: "error",
            message: "Chat room not found. Accept or negotiate the favor first.",
          })
        );
        return;
      }

      if (userId !== chatRoom.requesterId && userId !== chatRoom.helperId) {
        ws.send(JSON.stringify({ type: "error", message: "Unauthorized to join this chat" }));
        return;
      }

      // ensure active room memory state
      let activeRoom = this.activeChatRooms.get(chatRoom.id);
      if (!activeRoom) {
        activeRoom = {
          id: chatRoom.id,
          favorId: chatRoom.favorId,
          requesterId: chatRoom.requesterId,
          helperId: chatRoom.helperId,
          isActive: Boolean(chatRoom.isActive),
          participants: new Map(),
          createdAt: chatRoom.createdAt!,
        };
        this.activeChatRooms.set(chatRoom.id, activeRoom);
      }

      const participant = activeRoom.participants.get(userId) || {
        userId,
        isOnline: false,
        lastSeen: new Date(),
      };

      participant.ws = ws;
      participant.isOnline = true;
      participant.lastSeen = new Date();
      activeRoom.participants.set(userId, participant);
      this.userConnections.set(userId, ws);

      // Send chat history + presence snapshot
      const messages = await this.getChatMessages(chatRoom.id);
      const historyData = {
        type: "chat_history",
        messages: messages.map((msg) => ({
          id: String(msg.id),
          content: String(msg.content || ""),
          senderId: String(msg.senderId),
          recipientId: String(msg.recipientId),
          timestamp: msg.createdAt?.toISOString() || new Date().toISOString(),
          status: (msg.status || "sent") as MessageStatus,
          type: (msg.messageType || "text") as MessageType,
        })),
        presence: {
          me: userId,
          otherUserId: userId === chatRoom.requesterId ? chatRoom.helperId : chatRoom.requesterId,
          otherOnline: this.isUserOnline(userId === chatRoom.requesterId ? chatRoom.helperId : chatRoom.requesterId),
        },
      };

      ws.send(JSON.stringify(historyData));

      // broadcast presence to others (use 'user_joined' per frontend contract)
      this.broadcastToRoom(chatRoom.id, { type: "user_joined", userId }, userId);

      // Mark any of their incoming 'sent' messages as delivered on join (and broadcast those)
      await this.markUndeliveredAsDelivered(chatRoom.id, userId);

      console.log(`User ${userId} joined chat room ${chatRoom.id} for favor ${favorId}`);
    } catch (error) {
      console.error("Error joining chat:", error);
      ws.send(JSON.stringify({ type: "error", message: "Failed to join chat" }));
    }
  }

  // ---------- Send message (WS path) ----------
  private async handleSendMessage(
    ws: WebSocket,
    data: { favorId: number; senderId: string; content: string }
  ) {
    const { favorId, senderId, content } = data;

    try {
      const chatRoom = await this.getChatRoomByFavorId(favorId);
      if (!chatRoom) {
        ws.send(JSON.stringify({ type: "error", message: "Chat room not found" }));
        return;
      }
      if (!chatRoom.isActive) {
        ws.send(JSON.stringify({ type: "error", message: "Chat is no longer active" }));
        return;
      }

      const recipientId = chatRoom.requesterId === senderId ? chatRoom.helperId : chatRoom.requesterId;

      // Save (push notifications handled inside saveChatMessage if recipient is offline)
      const message = await this.saveChatMessage({
        chatRoomId: chatRoom.id,
        senderId,
        recipientId,
        content,
        type: "text",
      });

      // Broadcast to all in-room participants + recipient's global socket
      this.pushMessageToRoom(chatRoom.id, message);

      // Confirm to sender on this socket
      ws.send(JSON.stringify({ type: "message_sent", message }));

      console.log(`Message sent in chat room ${chatRoom.id}: ${message.content.substring(0, 80)}…`);
    } catch (error) {
      console.error("Error sending message:", error);
      ws.send(JSON.stringify({ type: "error", message: "Failed to send message" }));
    }
  }

  // ---------- Mark seen (WS) ----------
  private async handleMarkSeen(_ws: WebSocket, data: { favorId: number; userId: string; messageId: string }) {
    const { favorId, userId, messageId } = data;
    try {
      const chatRoom = await this.getChatRoomByFavorId(favorId);
      if (!chatRoom) return;

      // Only recipient can mark seen
      await db
        .update(chatMessages)
        .set({ status: "seen" })
        .where(and(eq(chatMessages.id, messageId), eq(chatMessages.recipientId, userId)));

      // Notify the sender
      this.broadcastToRoom(chatRoom.id, { type: "message_seen", messageId, seenBy: userId }, userId);
    } catch (err) {
      console.error("Error marking message seen:", err);
    }
  }

  // ---------- Typing ----------
  private async handleTyping(_ws: WebSocket, data: { favorId: number; userId: string; isTyping: boolean }) {
    const { favorId, userId, isTyping } = data;
    try {
      const chatRoom = await this.getChatRoomByFavorId(favorId);
      if (chatRoom) {
        this.broadcastToRoom(chatRoom.id, { type: "typing", userId, isTyping }, userId);
      }
    } catch (error) {
      console.error("Error handling typing indicator:", error);
    }
  }

  // ---------- Presence / disconnection ----------
  private handleDisconnection(ws: WebSocket) {
    console.log("Chat WebSocket disconnected");

    // Guard: ensure maps weren’t clobbered
    if (!(this.activeChatRooms instanceof Map)) this.activeChatRooms = new Map();
    if (!(this.userConnections instanceof Map)) this.userConnections = new Map();

    // Remove from active chat rooms and broadcast user_offline
    for (const [roomId, room] of this.activeChatRooms) {
      for (const [userId, participant] of room.participants) {
        if (participant.ws === ws) {
          participant.isOnline = false;
          participant.ws = undefined;
          participant.lastSeen = new Date();
          room.participants.set(userId, participant);

          this.broadcastToRoom(
            roomId,
            { type: "user_offline", userId, lastSeen: participant.lastSeen },
            userId
          );
        }
      }
    }

    // Remove from global user connections
    for (const [userId, userWs] of this.userConnections) {
      if (userWs === ws) {
        this.userConnections.delete(userId);
        console.log(`User ${userId} disconnected from global chat notifications`);
        break;
      }
    }
  }

  // ---------- Broadcasting ----------
  private broadcastToRoom(chatRoomId: number, payload: any, excludeUserId?: string) {
    const room = this.activeChatRooms.get(chatRoomId);
    if (!room) return;

    room.participants.forEach((participant, uid) => {
      if (
        participant.ws &&
        participant.isOnline &&
        uid !== excludeUserId &&
        participant.ws.readyState === WebSocket.OPEN
      ) {
        try {
          participant.ws.send(JSON.stringify(payload));
        } catch (e) {
          console.error("WS send failed:", e);
        }
      }
    });
  }

  /** Public: push a just-saved message to a room + recipient global socket */
  pushMessageToRoom(
    chatRoomId: number,
    message: {
      id: string;
      chatRoomId: number;
      senderId: string;
      recipientId: string;
      content: string;
      status: MessageStatus;
      type: MessageType;
      timestamp: string;
    }
  ) {
    // In-room broadcast
    this.broadcastToRoom(chatRoomId, { type: "new_message", message });

    // Also send to recipient's global connection (badge/unread in other tabs)
    const recipientGlobal = this.userConnections.get(message.recipientId);
    if (recipientGlobal && recipientGlobal.readyState === WebSocket.OPEN) {
      try {
        recipientGlobal.send(JSON.stringify({ type: "new_message", message }));
      } catch (e) {
        console.error("Global WS send failed:", e);
      }
    }
  }

  // ---------- Notifications ----------
  private async getUserFirstName(userId: string): Promise<string | null> {
    try {
      const idNum = Number(userId);
      if (Number.isNaN(idNum)) return null;
      const [u] = await db
        .select({ firstName: users.firstName })
        .from(users)
        .where(eq(users.id, idNum));
      return u?.firstName ?? null;
    } catch {
      return null;
    }
  }

  private async sendMessageNotification(
    recipientId: string,
    senderId: string,
    messageContent: string,
    chatRoomId: number,
    favorId: number
  ) {
    try {
      const displayMessage =
        messageContent.length > 80
          ? messageContent.substring(0, 80) + "…"
          : messageContent;

      // 🔽 Fetch the sender's first name
      const senderFirstName = (await this.getUserFirstName(senderId)) || "Someone";

      await sendNotification(
        { type: "users", userIds: [recipientId] },
        {
          type: "chat",
          title: `New message from ${senderFirstName}`, // 🔽 use first name
          message: displayMessage,
          chatId: chatRoomId,
          favorId,
          icon: "/icons/chat.png",
          url: `/chat/${favorId}`, // deep-link for your SW/SPA
        }
      );

      console.log(
        `📩 Push notification queued for recipient ${recipientId} (from ${senderId})`
      );
    } catch (error) {
      console.error("Error sending message notification:", error);
    }
  }


  // ---------- DB helpers (used by REST & WS) ----------

  /** Create chat room if not exists */
  async createChatRoom(
    favorId: number,
    requesterId: string,
    helperId: string
  ): Promise<DbChatRoom> {
    const existing = await this.getChatRoomByFavorId(favorId);
    if (existing) return existing;

    const newChatRoom: InsertChatRoom = {
      favorId,
      requesterId: requesterId.toString(),
      helperId: helperId.toString(),
      isActive: true,
    };

    const [room] = await db.insert(chatRooms).values(newChatRoom).returning();

    // Add a system message
    const sys: InsertChatMessage = {
      id: `sys_${Date.now()}`,
      chatRoomId: room.id,
      senderId: "system",
      recipientId: "",
      content: "Chat started! You can now communicate about this favor.",
      messageType: "system",
      status: "delivered",
    };
    await db.insert(chatMessages).values(sys);

    console.log(
      `Created chat room ${room.id} for favor ${favorId} between ${newChatRoom.requesterId} and ${newChatRoom.helperId}`
    );
    return room;
  }

  async getChatRoomByFavorId(favorId: number): Promise<DbChatRoom | null> {
    const rows = await db.select().from(chatRooms).where(eq(chatRooms.favorId, favorId)).limit(1);
    return rows[0] || null;
  }

  async getChatRoomById(chatRoomId: number): Promise<DbChatRoom | null> {
    const rows = await db.select().from(chatRooms).where(eq(chatRooms.id, chatRoomId)).limit(1);
    return rows[0] || null;
  }

  /** Lookup favor title with a safe fallback */
  async getFavorTitle(favorId: number): Promise<string> {
    try {
      const [row] = await db
        .select({ title: favorsTbl.title })
        .from(favorsTbl)
        .where(eq(favorsTbl.id, favorId))
        .limit(1);
      return row?.title ?? `Favor #${favorId}`;
    } catch {
      return `Favor #${favorId}`;
    }
  }

  /** Build "First L." display name (or "User 123" fallback) */
  async getUserDisplayName(userId: string): Promise<string> {
    const idNum = Number(userId);
    if (!Number.isFinite(idNum)) return `User ${userId}`;

    try {
      const [row] = await db
        .select({ firstName: usersTbl.firstName, lastName: usersTbl.lastName })
        .from(usersTbl)
        .where(eq(usersTbl.id, idNum))
        .limit(1);

      if (!row) return `User ${userId}`;
      const first = row.firstName ?? "User";
      const lastI = row.lastName ? ` ${row.lastName.charAt(0)}.` : "";
      return `${first}${lastI}`;
    } catch {
      return `User ${userId}`;
    }
  }


  async getChatMessages(chatRoomId: number): Promise<DbChatMessage[]> {
    return await db
      .select()
      .from(chatMessages)
      .where(eq(chatMessages.chatRoomId, chatRoomId))
      .orderBy(asc(chatMessages.createdAt));
  }

  async getUserChatRooms(userId: string): Promise<DbChatRoom[]> {
    const rooms = await db
      .select()
      .from(chatRooms)
      .where(or(eq(chatRooms.requesterId, userId), eq(chatRooms.helperId, userId)))
      .orderBy(desc(chatRooms.createdAt));
    return rooms;
  }

  async deactivateChatRoom(favorId: number) {
    const room = await this.getChatRoomByFavorId(favorId);
    if (!room) return;

    await db.update(chatRooms).set({ isActive: false }).where(eq(chatRooms.id, room.id));

    const sys: InsertChatMessage = {
      id: `sys_${Date.now()}`,
      chatRoomId: room.id,
      senderId: "system",
      recipientId: "",
      content: "This favor has been completed. Chat is now read-only.",
      messageType: "system",
      status: "delivered",
    };
    await db.insert(chatMessages).values(sys);

    this.broadcastToRoom(room.id, { type: "chat_deactivated", message: "Chat is now read-only" });
  }

  /**
   * Save a chat message (used by REST and WS).
   * Sets initial status to "delivered" if recipient is online (room or global), otherwise "sent".
   * Fires a unified push with deep link if recipient is offline.
   */
  async saveChatMessage(input: {
    chatRoomId: number;
    senderId: string;
    recipientId: string;
    content: string;
    type?: MessageType;
  }): Promise<{
    id: string;
    chatRoomId: number;
    senderId: string;
    recipientId: string;
    content: string;
    status: MessageStatus;
    type: MessageType;
    timestamp: string;
  }> {
    const activeRoom = this.activeChatRooms.get(input.chatRoomId);
    const recipientOnlineInRoom = activeRoom?.participants.get(input.recipientId)?.isOnline === true;
    const recipientOnlineGlobally = this.isUserOnline(input.recipientId);

    const initialStatus: MessageStatus = recipientOnlineInRoom || recipientOnlineGlobally ? "delivered" : "sent";

    const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const newMessage: InsertChatMessage = {
      id: messageId,
      chatRoomId: input.chatRoomId,
      senderId: input.senderId,
      recipientId: input.recipientId,
      content: input.content.trim(),
      messageType: input.type ?? "text",
      status: initialStatus,
    };

    await db.insert(chatMessages).values(newMessage);

    // If recipient is offline globally and not in room, fire push now
    if (!recipientOnlineGlobally && !recipientOnlineInRoom) {
      try {
        // Favor ID from memory if present; else load the room to get it
        const favorId =
          this.activeChatRooms.get(input.chatRoomId)?.favorId ??
          (await this.getChatRoomById(input.chatRoomId))?.favorId ??
          0;

        await this.sendMessageNotification(
          input.recipientId,
          input.senderId,
          newMessage.content,
          input.chatRoomId,
          favorId
        );
      } catch (e) {
        console.error("sendMessageNotification failed:", e);
      }
    }

    return {
      id: messageId,
      chatRoomId: input.chatRoomId,
      senderId: input.senderId,
      recipientId: input.recipientId,
      content: newMessage.content,
      status: initialStatus,
      type: (newMessage.messageType as MessageType) ?? "text",
      timestamp: new Date().toISOString(),
    };
  }

  /** Mark a single message delivered (REST) and broadcast `message_delivered` */
  async markMessageDelivered(messageId: string): Promise<void> {
    // Read message first so we know which room to notify
    const [msg] = await db
      .select({
        id: chatMessages.id,
        chatRoomId: chatMessages.chatRoomId,
        recipientId: chatMessages.recipientId,
      })
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId))
      .limit(1);

    if (!msg) return;

    await db.update(chatMessages).set({ status: "delivered" }).where(eq(chatMessages.id, messageId));

    this.broadcastToRoom(msg.chatRoomId, {
      type: "message_delivered",
      messageId: String(messageId),
      deliveredTo: String(msg.recipientId),
    });
  }

  /** Mark recipient's message as seen (REST) and broadcast `message_seen` */
  async markMessageSeen(messageId: string, userId: string): Promise<void> {
    // Update only if this user is the recipient
    const [msg] = await db
      .select({
        id: chatMessages.id,
        chatRoomId: chatMessages.chatRoomId,
        recipientId: chatMessages.recipientId,
      })
      .from(chatMessages)
      .where(eq(chatMessages.id, messageId))
      .limit(1);

    if (!msg) return;

    await db
      .update(chatMessages)
      .set({ status: "seen" })
      .where(and(eq(chatMessages.id, messageId), eq(chatMessages.recipientId, userId)));

    this.broadcastToRoom(msg.chatRoomId, { type: "message_seen", messageId, seenBy: userId });
  }

  /**
   * When a user joins or fetches messages, mark all of their incoming 'sent' messages as 'delivered'
   * and broadcast `message_delivered` for each to update the sender in real-time.
   */
  async markUndeliveredAsDelivered(chatRoomId: number, recipientId: string): Promise<void> {
    const updated = await db
      .update(chatMessages)
      .set({ status: "delivered" })
      .where(
        and(
          eq(chatMessages.chatRoomId, chatRoomId),
          eq(chatMessages.recipientId, recipientId),
          eq(chatMessages.status, "sent")
        )
      )
      .returning({ id: chatMessages.id });

    if (updated.length) {
      for (const { id } of updated) {
        this.broadcastToRoom(chatRoomId, {
          type: "message_delivered",
          messageId: String(id),
          deliveredTo: recipientId,
        });
      }
    }
  }
}

export const databaseChatService = new DatabaseChatService();
