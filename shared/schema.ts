import { pgTable, text, serial, integer, boolean, decimal, timestamp, varchar, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  email: text("email").notNull().unique(),
  password: text("password").notNull(),
  profilePicture: text("profile_picture"),
  bio: text("bio"),
  country: text("country"), // User-selected country during onboarding
  dateOfBirth: date("date_of_birth"), // User's date of birth for demographics
  favrPoints: integer("favr_points").default(0).notNull(),
  completedFavrs: integer("completed_favrs").default(0).notNull(),
  averageRating: decimal("average_rating", { precision: 3, scale: 2 }).default("0.00"),
  totalRatings: integer("total_ratings").default(0).notNull(),
  responseTimeAvg: integer("response_time_avg").default(0), // in minutes
  memberSince: timestamp("member_since").defaultNow().notNull(),
  isVerified: boolean("is_verified").default(false).notNull(),
  notificationsEnabled: boolean("notifications_enabled").default(true).notNull(),
});

export const favors = pgTable("favors", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  price: text("price").notNull(),
  isNegotiable: boolean("is_negotiable").default(false),
  imageUrl: text("image_url"),
  latitude: text("latitude").notNull(),
  longitude: text("longitude").notNull(),
  address: text("address").notNull(),
  timeframe: text("timeframe").notNull(),
  status: text("status").notNull().default("available"), // available, accepted, completed, cancelled
  posterId: text("poster_id").notNull(),
  helperId: integer("helper_id"),
  acceptedAt: timestamp("accepted_at"),
  completedAt: timestamp("completed_at"),
  completedByUserId: integer("completed_by_user_id"), // Who marked it complete
  negotiatedPrice: text("negotiated_price"), // Final agreed price if different from original
  rating: decimal("rating", { precision: 2, scale: 1 }).default("4.8"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const ratings = pgTable("ratings", {
  id: serial("id").primaryKey(),
  favorId: integer("favor_id").notNull(),
  raterId: integer("rater_id").notNull(),
  ratedUserId: integer("rated_user_id").notNull(),
  rating: integer("rating").notNull(), // 1-5 stars
  comment: text("comment"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const favrPointsHistory = pgTable("favr_points_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  points: integer("points").notNull(), // can be negative for deductions
  reason: text("reason").notNull(),
  favorId: integer("favor_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bookmarks = pgTable("bookmarks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  favorId: integer("favor_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const likes = pgTable("likes", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  favorId: integer("favor_id").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});



export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  memberSince: true,
  favrPoints: true,
  completedFavrs: true,
  averageRating: true,
  totalRatings: true,
  responseTimeAvg: true,
  isVerified: true,
});

export const insertFavorSchema = createInsertSchema(favors).omit({
  id: true,
  createdAt: true,
  status: true,
  rating: true,
  helperId: true,
  acceptedAt: true,
  completedAt: true,
  completedByUserId: true,
  negotiatedPrice: true,
});

export const insertRatingSchema = createInsertSchema(ratings).omit({
  id: true,
  createdAt: true,
});

export const insertFavrPointsSchema = createInsertSchema(favrPointsHistory).omit({
  id: true,
  createdAt: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type InsertFavor = z.infer<typeof insertFavorSchema>;
export type Favor = typeof favors.$inferSelect;
export type InsertRating = z.infer<typeof insertRatingSchema>;
export type Rating = typeof ratings.$inferSelect;
export type InsertFavrPoints = z.infer<typeof insertFavrPointsSchema>;
export type FavrPointsHistory = typeof favrPointsHistory.$inferSelect;

// Extended favor type with poster information
// Chat rooms table for persistent chat storage
export const chatRooms = pgTable("chat_rooms", {
  id: serial("id").primaryKey(),
  favorId: integer("favor_id").notNull().references(() => favors.id, { onDelete: "cascade" }),
  requesterId: varchar("requester_id").notNull(),
  helperId: varchar("helper_id").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Chat messages table for persistent message storage
export const chatMessages = pgTable("chat_messages", {
  id: varchar("id").primaryKey(),
  chatRoomId: integer("chat_room_id").notNull().references(() => chatRooms.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull(),
  recipientId: varchar("recipient_id").notNull(),
  content: text("content").notNull(),
  messageType: varchar("message_type").default("text"), // 'text' or 'system'
  status: varchar("status").default("sent"), // 'sent', 'delivered', 'seen'
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations for chat tables
export const chatRoomsRelations = relations(chatRooms, ({ one, many }) => ({
  favor: one(favors, {
    fields: [chatRooms.favorId],
    references: [favors.id],
  }),
  messages: many(chatMessages),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  chatRoom: one(chatRooms, {
    fields: [chatMessages.chatRoomId],
    references: [chatRooms.id],
  }),
}));

// Notification subscriptions table for push notifications
export const notificationSubscriptions = pgTable("notification_subscriptions", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  endpoint: text("endpoint").notNull(),
  p256dhKey: text("p256dh_key").notNull(),
  authKey: text("auth_key").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type FavorWithPoster = Favor & {
  posterName?: string;
  posterFirstName?: string | null;
  posterLastName?: string | null;
  helperName?: string | null;
  helperFirstName?: string | null;
  helperLastName?: string | null;
};

// Chat types
export type ChatRoom = typeof chatRooms.$inferSelect;
export type InsertChatRoom = typeof chatRooms.$inferInsert;
export type ChatMessage = typeof chatMessages.$inferSelect;
export type InsertChatMessage = typeof chatMessages.$inferInsert;

// Notification types
export type NotificationSubscription = typeof notificationSubscriptions.$inferSelect;
export type InsertNotificationSubscription = typeof notificationSubscriptions.$inferInsert;
