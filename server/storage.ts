import { users, favors, notificationSubscriptions, type User, type InsertUser, type Favor, type InsertFavor } from "@shared/schema";
import { db, pool } from "./db";
import { eq, desc, and, or, gt, sql } from "drizzle-orm";

// Extended favor type with poster information
export type FavorWithPoster = Favor & {
  posterName?: string;
  posterFirstName?: string | null;
  posterLastName?: string | null;
};



export interface IStorage {
  getUser(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(userId: number, updates: Partial<User>): Promise<User | undefined>;
  
  getFavors(): Promise<FavorWithPoster[]>;
  getFavor(id: number): Promise<FavorWithPoster | undefined>;
  getFavorsNearby(lat: number, lng: number, radiusKm: number): Promise<FavorWithPoster[]>;
  getFavorsByCategory(category: string): Promise<FavorWithPoster[]>;
  getFavorsByPoster(posterId: string): Promise<FavorWithPoster[]>;
  getCompletedFavorsByUser(userId: string): Promise<FavorWithPoster[]>;
  createFavor(favor: InsertFavor): Promise<Favor>;
  updateFavor(id: number, updates: Partial<Favor>): Promise<Favor | undefined>;
  deleteFavor(id: number, userId: string): Promise<boolean>;
  updateUserCountry(userId: number, country: string): Promise<void>;
  
  // Completion tracking methods
  acceptFavor(favorId: number, helperId: number): Promise<Favor | undefined>;
  completeFavor(favorId: number, completedByUserId: number, negotiatedPrice?: string): Promise<Favor | undefined>;
  getUserCompletionStats(userId: number): Promise<{ completed: number; posted: number; rating: number }>;
  
  // Analytics methods
  getUserDemographics(): Promise<{
    totalUsers: number;
    countries: { [country: string]: number };
    ageGroups: { [ageGroup: string]: number };
    averageAge: number;
  }>;
  
  // Notification subscription methods
  saveNotificationSubscription(userId: string, subscription: any): Promise<void>;
  removeNotificationSubscription(userId: string): Promise<void>;
  getNotificationSubscriptions(userId: string): Promise<any[]>;
  getNotificationSubscription(userId: string): Promise<any | null>;
  updateNotificationSettings(userId: string, enabled: boolean): Promise<User | undefined>;
  
  // Unified notification methods for iPhone/Android compatibility
  saveUnifiedNotificationSubscription(userId: string, platform: 'webpush' | 'onesignal', subscriptionData: any): Promise<void>;
  getUnifiedNotificationSubscription(userId: string): Promise<{ platform: 'webpush' | 'onesignal', subscriptionData: any } | null>;

}



// module-scope helper so class methods can see it
function normalizeWebPushSub(raw: any):
  | { endpoint: string; keys: { p256dh: string; auth: string } }
  | null {
  if (!raw) return null;
  const data = typeof raw === "string" ? (() => { try { return JSON.parse(raw); } catch { return null; } })() : raw;
  if (!data) return null;

  if (data.endpoint && data.keys?.p256dh && data.keys?.auth) {
    return { endpoint: data.endpoint, keys: { p256dh: data.keys.p256dh, auth: data.keys.auth } };
  }
  if (data.subscription?.endpoint && data.subscription?.keys?.p256dh && data.subscription?.keys?.auth) {
    return {
      endpoint: data.subscription.endpoint,
      keys: { p256dh: data.subscription.keys.p256dh, auth: data.subscription.keys.auth },
    };
  }
  if (data.endpoint && data.p256dh && data.auth) {
    return { endpoint: data.endpoint, keys: { p256dh: data.p256dh, auth: data.auth } };
  }
  return null;
}




export class DatabaseStorage implements IStorage {
  private initialized = false;

  private async init() {
    if (this.initialized) return;
    // Sample data initialization disabled for production
    this.initialized = true;
  }

  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    await this.init();
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const userData = {
      firstName: insertUser.firstName,
      lastName: insertUser.lastName,
      email: insertUser.email,
      password: insertUser.password,
      profilePicture: insertUser.profilePicture || null,
      bio: insertUser.bio || "New Favr member ready to help the community!",
      country: insertUser.country || "Luxembourg",
      dateOfBirth: insertUser.dateOfBirth || null,
    };
    
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUser(userId: number, updates: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, userId))
      .returning();
    return updatedUser || undefined;
  }

  async deleteUser(userId: number): Promise<boolean> {
    try {
      const result = await db.delete(users).where(eq(users.id, userId));
      return true; // Return true if deletion attempt was made
    } catch (error) {
      console.error('Error deleting user:', error);
      return false;
    }
  }

  async getFavors(): Promise<FavorWithPoster[]> {
    await this.init();
    
    try {
      const result = await db
        .select({
          id: favors.id,
          title: favors.title,
          description: favors.description,
          category: favors.category,
          price: favors.price,
          isNegotiable: favors.isNegotiable,
          imageUrl: favors.imageUrl,
          latitude: favors.latitude,
          longitude: favors.longitude,
          address: favors.address,
          timeframe: favors.timeframe,
          status: favors.status,
          posterId: favors.posterId,
          helperId: favors.helperId,
          acceptedAt: favors.acceptedAt,
          completedAt: favors.completedAt,
          rating: favors.rating,
          createdAt: favors.createdAt,
          completedByUserId: favors.completedByUserId,
          negotiatedPrice: favors.negotiatedPrice,
          posterFirstName: users.firstName,
          posterLastName: users.lastName,
        })
        .from(favors)
        .leftJoin(users, sql`${favors.posterId}::integer = ${users.id}`);
      
      // Filter out completed/cancelled favors and expired favors for public view
      const activeFavors = result.filter(favor => {
        if (favor.status !== "available" && favor.status !== "accepted") {
          return false;
        }
        
        // Check if favor has expired based on timeframe
        if (favor.createdAt) {
          const createdTime = new Date(favor.createdAt).getTime();
          const now = Date.now();
          const hoursElapsed = (now - createdTime) / (1000 * 60 * 60);
          
          // Set expiration based on timeframe
          let expirationHours = 72; // Default 3 days
          
          if (favor.timeframe) {
            const timeframe = favor.timeframe.toLowerCase();
            if (timeframe.includes('flexible') || timeframe.includes('anytime')) {
              expirationHours = 14 * 24; // 14 days for flexible
            } else if (timeframe.includes('week') || timeframe.includes('this week')) {
              expirationHours = 7 * 24; // 7 days for weekly
            } else if (timeframe.includes('today') || timeframe.includes('urgent')) {
              expirationHours = 24; // 1 day for urgent
            } else if (timeframe.includes('month') || 
                      timeframe.includes('january') || timeframe.includes('february') || 
                      timeframe.includes('march') || timeframe.includes('april') || 
                      timeframe.includes('may') || timeframe.includes('june') || 
                      timeframe.includes('july') || timeframe.includes('august') || 
                      timeframe.includes('september') || timeframe.includes('october') || 
                      timeframe.includes('november') || timeframe.includes('december')) {
              expirationHours = 30 * 24; // 30 days for monthly/specific dates
            }
          }
          
          if (hoursElapsed >= expirationHours) {
            return false; // Hide expired favors
          }
        }
        
        return true;
      });
      
      // Add display name for each favor
      const favorsWithNames = activeFavors.map(favor => ({
        ...favor,
        posterName: favor.posterFirstName && favor.posterLastName 
          ? `${favor.posterFirstName} ${favor.posterLastName.charAt(0)}.`
          : "User"
      }));
      
      return favorsWithNames.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    } catch (error) {
      console.error("Error fetching favors:", error);
      // Fallback to basic query without user join if there's an issue
      const basicResult = await db.select().from(favors);
      
      const activeFavors = basicResult.filter(favor => {
        if (favor.status !== "available" && favor.status !== "accepted") {
          return false;
        }
        
        if (favor.createdAt) {
          const createdTime = new Date(favor.createdAt).getTime();
          const now = Date.now();
          const hoursElapsed = (now - createdTime) / (1000 * 60 * 60);
          
          if (hoursElapsed >= 72) {
            return false;
          }
        }
        
        return true;
      });
      
      return activeFavors.map(favor => ({
        ...favor,
        posterName: "User",
        posterFirstName: null,
        posterLastName: null
      })).sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
    }
  }

  async getFavor(id: number): Promise<any | undefined> {
    // First get the basic favor data with poster info
    const [result] = await db
      .select({
        id: favors.id,
        title: favors.title,
        description: favors.description,
        category: favors.category,
        price: favors.price,
        isNegotiable: favors.isNegotiable,
        imageUrl: favors.imageUrl,
        latitude: favors.latitude,
        longitude: favors.longitude,
        address: favors.address,
        timeframe: favors.timeframe,
        status: favors.status,
        posterId: favors.posterId,
        helperId: favors.helperId,
        acceptedAt: favors.acceptedAt,
        completedAt: favors.completedAt,
        rating: favors.rating,
        createdAt: favors.createdAt,
        posterFirstName: users.firstName,
        posterLastName: users.lastName,
      })
      .from(favors)
      .leftJoin(users, sql`${favors.posterId}::integer = ${users.id}`)
      .where(eq(favors.id, id));
    
    if (!result) return undefined;
    
    // Get helper info separately if helperId exists
    let helperFirstName = null;
    let helperLastName = null;
    
    if (result.helperId) {
      const [helperResult] = await db
        .select({
          firstName: users.firstName,
          lastName: users.lastName,
        })
        .from(users)
        .where(eq(users.id, result.helperId));
      
      if (helperResult) {
        helperFirstName = helperResult.firstName;
        helperLastName = helperResult.lastName;
      }
    }
    
    return {
      ...result,
      posterName: result.posterFirstName && result.posterLastName 
        ? `${result.posterFirstName} ${result.posterLastName.charAt(0)}.`
        : "User",
      helperFirstName,
      helperLastName,
      helperName: helperFirstName && helperLastName 
        ? `${helperFirstName} ${helperLastName.charAt(0)}.`
        : null
    };
  }

  async getFavorsNearby(lat: number, lng: number, radiusKm: number): Promise<FavorWithPoster[]> {
    const allFavors = await this.getFavors();
    
    return allFavors.filter(favor => {
      const favorLat = parseFloat(favor.latitude);
      const favorLng = parseFloat(favor.longitude);
      const distance = this.calculateDistance(lat, lng, favorLat, favorLng);
      return distance <= radiusKm;
    });
  }

  async getFavorsByCategory(category: string): Promise<FavorWithPoster[]> {
    const result = await db
      .select({
        id: favors.id,
        title: favors.title,
        description: favors.description,
        category: favors.category,
        price: favors.price,
        isNegotiable: favors.isNegotiable,
        imageUrl: favors.imageUrl,
        latitude: favors.latitude,
        longitude: favors.longitude,
        address: favors.address,
        timeframe: favors.timeframe,
        status: favors.status,
        posterId: favors.posterId,
        helperId: favors.helperId,
        acceptedAt: favors.acceptedAt,
        completedAt: favors.completedAt,
        rating: favors.rating,
        createdAt: favors.createdAt,
        completedByUserId: favors.completedByUserId,
        negotiatedPrice: favors.negotiatedPrice,
        posterFirstName: users.firstName,
        posterLastName: users.lastName,
      })
      .from(favors)
      .leftJoin(users, sql`${favors.posterId}::integer = ${users.id}`)
      .where(eq(favors.category, category));
    
    // Filter out completed/cancelled favors and add poster names
    const activeFavors = result.filter(favor => 
      favor.status === "available" || favor.status === "accepted"
    );
    
    return activeFavors.map(favor => ({
      ...favor,
      posterName: favor.posterFirstName && favor.posterLastName 
        ? `${favor.posterFirstName} ${favor.posterLastName.charAt(0)}.`
        : "User"
    }));
  }

  async getFavorsByPoster(posterId: string): Promise<FavorWithPoster[]> {
    // Return all favors by poster, including expired ones
    const result = await db
      .select({
        id: favors.id,
        title: favors.title,
        description: favors.description,
        category: favors.category,
        price: favors.price,
        isNegotiable: favors.isNegotiable,
        imageUrl: favors.imageUrl,
        latitude: favors.latitude,
        longitude: favors.longitude,
        address: favors.address,
        timeframe: favors.timeframe,
        status: favors.status,
        posterId: favors.posterId,
        helperId: favors.helperId,
        acceptedAt: favors.acceptedAt,
        completedAt: favors.completedAt,
        rating: favors.rating,
        createdAt: favors.createdAt,
        completedByUserId: favors.completedByUserId,
        negotiatedPrice: favors.negotiatedPrice,
        posterFirstName: users.firstName,
        posterLastName: users.lastName,
      })
      .from(favors)
      .leftJoin(users, sql`${favors.posterId}::integer = ${users.id}`)
      .where(eq(favors.posterId, posterId));
    
    const favorsWithNames = result.map(favor => ({
      ...favor,
      posterName: favor.posterFirstName && favor.posterLastName 
        ? `${favor.posterFirstName} ${favor.posterLastName.charAt(0)}.`
        : "User"
    }));
    
    return favorsWithNames.sort((a, b) => {
      const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return dateB - dateA;
    });
  }

  async createFavor(favor: InsertFavor): Promise<Favor> {
    const [newFavor] = await db
      .insert(favors)
      .values(favor)
      .returning();
    return newFavor;
  }

  async updateFavor(id: number, updates: Partial<Favor>): Promise<Favor | undefined> {
    const [updatedFavor] = await db
      .update(favors)
      .set(updates)
      .where(eq(favors.id, id))
      .returning();
    return updatedFavor || undefined;
  }

  async getCompletedFavorsByUser(userId: string): Promise<FavorWithPoster[]> {
    await this.init();
    const result = await db
      .select({
        id: favors.id,
        title: favors.title,
        description: favors.description,
        category: favors.category,
        price: favors.price,
        isNegotiable: favors.isNegotiable,
        imageUrl: favors.imageUrl,
        latitude: favors.latitude,
        longitude: favors.longitude,
        address: favors.address,
        timeframe: favors.timeframe,
        status: favors.status,
        posterId: favors.posterId,
        helperId: favors.helperId,
        acceptedAt: favors.acceptedAt,
        completedAt: favors.completedAt,
        rating: favors.rating,
        createdAt: favors.createdAt,
        completedByUserId: favors.completedByUserId,
        negotiatedPrice: favors.negotiatedPrice,
        posterFirstName: users.firstName,
        posterLastName: users.lastName,
      })
      .from(favors)
      .leftJoin(users, sql`${favors.posterId}::integer = ${users.id}`);
    
    const completedFavors = result.filter(favor => 
      (favor.posterId === userId || (favor.helperId && favor.helperId.toString() === userId)) && 
      favor.status === 'completed'
    );
    
    return completedFavors.map(favor => ({
      ...favor,
      posterName: favor.posterFirstName && favor.posterLastName 
        ? `${favor.posterFirstName} ${favor.posterLastName.charAt(0)}.`
        : "User"
    }));
  }

  async deleteFavor(id: number, userId: string): Promise<boolean> {
    await this.init();
    try {
      // Check if the favor belongs to the user
      const [favor] = await db.select().from(favors).where(eq(favors.id, id));
      

      
      if (!favor || favor.posterId !== userId) {
        return false;
      }
      
      await db.delete(favors).where(eq(favors.id, id));
      return true;
    } catch (error) {
      console.error("Error deleting favor:", error);
      return false;
    }
  }

  async updateUserCountry(userId: number, country: string): Promise<void> {
    await this.init();
    try {
      await db
        .update(users)
        .set({ country })
        .where(eq(users.id, userId));
    } catch (error) {
      console.error("Error updating user country:", error);
    }
  }

  async acceptFavor(favorId: number, helperId: number): Promise<Favor | undefined> {
    await this.init();
    const [updatedFavor] = await db
      .update(favors)
      .set({ 
        status: 'accepted',
        helperId: helperId,
        acceptedAt: new Date()
      })
      .where(eq(favors.id, favorId))
      .returning();
    return updatedFavor || undefined;
  }

  async completeFavor(favorId: number, completedByUserId: number, negotiatedPrice?: string): Promise<Favor | undefined> {
    await this.init();
    
    // Update favor status to completed
    const [updatedFavor] = await db
      .update(favors)
      .set({ 
        status: 'completed',
        completedAt: new Date(),
        completedByUserId: completedByUserId,
        ...(negotiatedPrice && { negotiatedPrice })
      })
      .where(eq(favors.id, favorId))
      .returning();

    if (updatedFavor && updatedFavor.helperId) {
      // Update helper's completion count
      await db
        .update(users)
        .set({ 
          completedFavrs: sql`${users.completedFavrs} + 1`
        })
        .where(eq(users.id, updatedFavor.helperId));
    }

    return updatedFavor || undefined;
  }

  async getUserCompletionStats(userId: number): Promise<{ completed: number; posted: number; rating: number }> {
    await this.init();
    
    // Get user's basic stats
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    
    // Count posted favors
    const postedFavors = await db
      .select({ count: sql<number>`count(*)` })
      .from(favors)
      .where(eq(favors.posterId, userId.toString()));
    
    // Count completed favors as helper
    const completedFavors = await db
      .select({ count: sql<number>`count(*)` })
      .from(favors)
      .where(and(
        eq(favors.helperId, userId),
        eq(favors.status, 'completed')
      ));

    return {
      completed: Number(completedFavors[0]?.count || 0),
      posted: Number(postedFavors[0]?.count || 0),
      rating: user ? Number(user.averageRating || 0) : 0
    };
  }

  async getUserDemographics(): Promise<{
    totalUsers: number;
    countries: { [country: string]: number };
    ageGroups: { [ageGroup: string]: number };
    averageAge: number;
  }> {
    await this.init();
    
    try {
      const allUsers = await db.select().from(users);
      
      const totalUsers = allUsers.length;
      const countries: { [country: string]: number } = {};
      const ageGroups: { [ageGroup: string]: number } = {};
      let totalAge = 0;
      let usersWithAge = 0;
      
      allUsers.forEach(user => {
        // Count countries
        if (user.country) {
          countries[user.country] = (countries[user.country] || 0) + 1;
        }
        
        // Calculate age from dateOfBirth and group by age ranges
        if (user.dateOfBirth) {
          const age = new Date().getFullYear() - new Date(user.dateOfBirth).getFullYear();
          totalAge += age;
          usersWithAge++;
          
          // Group by age ranges
          if (age < 18) {
            ageGroups['Under 18'] = (ageGroups['Under 18'] || 0) + 1;
          } else if (age < 25) {
            ageGroups['18-24'] = (ageGroups['18-24'] || 0) + 1;
          } else if (age < 35) {
            ageGroups['25-34'] = (ageGroups['25-34'] || 0) + 1;
          } else if (age < 45) {
            ageGroups['35-44'] = (ageGroups['35-44'] || 0) + 1;
          } else if (age < 55) {
            ageGroups['45-54'] = (ageGroups['45-54'] || 0) + 1;
          } else if (age < 65) {
            ageGroups['55-64'] = (ageGroups['55-64'] || 0) + 1;
          } else {
            ageGroups['65+'] = (ageGroups['65+'] || 0) + 1;
          }
        }
      });
      
      const averageAge = usersWithAge > 0 ? Math.round(totalAge / usersWithAge) : 0;
      
      return {
        totalUsers,
        countries,
        ageGroups,
        averageAge
      };
    } catch (error) {
      console.error("Error fetching user demographics:", error);
      return {
        totalUsers: 0,
        countries: {},
        ageGroups: {},
        averageAge: 0
      };
    }
  }

  private async initializeSampleData() {
    // Check if data already exists
    const existingFavors = await db.select().from(favors).limit(1);
    if (existingFavors.length > 0) return;

    const sampleFavors: InsertFavor[] = [
      {
        title: "Dog walking",
        description: "Please walk my dog.",
        category: "Pet Care",
        price: "25",
        isNegotiable: true,
        latitude: "49.594191098381366",
        longitude: "6.140027641256729",
        address: "Bonnevoie area",
        timeframe: "ASAP",
        posterId: "1"
      },
      {
        title: "Need help building a cabinet for my room",
        description: "I need someone skilled in woodworking to help me build a custom cabinet for my bedroom. Materials will be provided.",
        category: "Handyman",
        price: "55.00",
        isNegotiable: false,
        imageUrl: "https://images.unsplash.com/photo-1586023492125-27b2c045efd7?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        latitude: "49.6116",
        longitude: "6.1319",
        address: "Kirchberg area",
        timeframe: "This Weekend",
        posterId: "1"
      },
      {
        title: "Need a ride to the airport",
        description: "Looking for someone to drive me to Luxembourg Airport early Friday morning.",
        category: "Ride",
        price: "35.00",
        isNegotiable: false,
        imageUrl: "https://images.unsplash.com/photo-1449824913935-59a10b8d2000?ixlib=rb-4.0.3&auto=format&fit=crop&w=400&h=300",
        latitude: "49.6200",
        longitude: "6.1296",
        address: "Gare area",
        timeframe: "Friday",
        posterId: "3"
      }
    ];

    // Insert sample data
    await db.insert(favors).values(sampleFavors);
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Radius of the Earth in km
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const d = R * c; // Distance in km
    return d;
  }

  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  // Notification subscription methods
  async saveNotificationSubscription(userId: string, subscription: any): Promise<void> {
    await this.init();
    try {
      // Remove existing subscription for this user
      await db.delete(notificationSubscriptions).where(eq(notificationSubscriptions.userId, userId));
      
      // Insert new subscription
      await db.insert(notificationSubscriptions).values({
        userId,
        endpoint: subscription.endpoint,
        p256dhKey: subscription.keys.p256dh,
        authKey: subscription.keys.auth
      });
      
      console.log(`Saved notification subscription for user ${userId}`);
    } catch (error) {
      console.error("Error saving notification subscription:", error);
      throw error;
    }
  }

  async getNotificationSubscriptions(userId: string): Promise<any[]> {
    await this.init();
    try {
      const subscriptions = await db
        .select()
        .from(notificationSubscriptions)
        .where(eq(notificationSubscriptions.userId, userId));
      
      return subscriptions.map(subscription => ({
        endpoint: subscription.endpoint,
        keys: {
          p256dh: subscription.p256dhKey,
          auth: subscription.authKey
        }
      }));
    } catch (error) {
      console.error("Error getting notification subscriptions:", error);
      return [];
    }
  }

  async getNotificationSubscription(userId: string): Promise<any | null> {
    const subscriptions = await this.getNotificationSubscriptions(userId);
    return subscriptions.length > 0 ? subscriptions[0] : null;
  }

  

  // Unified notification subscription methods for iPhone/Android compatibility
  // Upsert unified (best-effort), mirror to legacy for webpush
  async saveUnifiedNotificationSubscription(
    userId: string,
    platform: "webpush" | "onesignal",
    subscriptionData: any
  ): Promise<void> {
    // 1) Unified table (ignore if it doesn't exist)
    try {
      const json = typeof subscriptionData === "string" ? subscriptionData : JSON.stringify(subscriptionData);
      await pool.query(
        `INSERT INTO unified_notification_subscriptions (user_id, platform, subscription_data, created_at, updated_at)
       VALUES ($1, $2, $3, NOW(), NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET platform = EXCLUDED.platform,
                     subscription_data = EXCLUDED.subscription_data,
                     updated_at = NOW()`,
        [userId, platform, json]
      );
    } catch (err: any) {
      if (err?.code === "42P01") {
        console.warn("saveUnifiedNotificationSubscription: unified upsert skipped (table missing)");
      } else {
        console.warn("saveUnifiedNotificationSubscription: unified upsert warning:", err?.message || err);
      }
    }

    // 2) Mirror WEB PUSH into legacy table so sendWebPush() can work
    if (platform.toLowerCase() === "webpush") {
  const parsed = normalizeWebPushSub(subscriptionData);
  if (!parsed) {
    throw new Error("Invalid web push subscription payload (cannot extract endpoint/keys)");
  }

  // wipe existing row for this user, then insert fresh using your column names
  await pool.query(
    `DELETE FROM notification_subscriptions WHERE user_id = $1`,
    [userId]
  );

  await pool.query(
    `INSERT INTO notification_subscriptions (user_id, endpoint, p256dh_key, auth_key, created_at)
     VALUES ($1, $2, $3, $4, NOW())`,
    [userId, parsed.endpoint, parsed.keys.p256dh, parsed.keys.auth]
  );
}
}


  async getUnifiedNotificationSubscription(userId: string): Promise<{ platform: 'webpush' | 'onesignal', subscriptionData: any } | null> {
    try {
      const { rows } = await pool.query(
        `SELECT platform, subscription_data FROM unified_notification_subscriptions WHERE user_id = $1 LIMIT 1`,
        [userId]
      );
      if (!rows[0]) return null;
      const sd = rows[0].subscription_data;
      const parsed = typeof sd === "string" ? JSON.parse(sd) : sd;
      return { platform: rows[0].platform, subscriptionData: parsed };
    } catch (err: any) {
      // 42P01 = table not found => treat as "no record yet"
      if (err?.code !== "42P01") {
        console.warn("[getUnifiedNotificationSubscription] query warning:", err?.message || err);
      }
      return null;
    }
  }


  async updateNotificationSettings(userId: string, enabled: boolean): Promise<User | undefined> {
    await this.init();
    const [updatedUser] = await db
      .update(users)
      .set({ notificationsEnabled: enabled })
      .where(eq(users.id, parseInt(userId)))
      .returning();
    return updatedUser || undefined;
  }

  async removeNotificationSubscription(userId: string): Promise<void> {
    await this.init();
    try {
      await db.delete(notificationSubscriptions).where(eq(notificationSubscriptions.userId, userId));
      console.log(`Removed notification subscription for user ${userId}`);
    } catch (error) {
      console.error("Error removing notification subscription:", error);
      throw error;
    }
  }


}

export const storage = new DatabaseStorage();
