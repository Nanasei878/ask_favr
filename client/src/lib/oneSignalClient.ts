// OneSignal client integration for iPhone push notifications
declare global {
  interface Window {
    OneSignal: any;
  }
}

export class OneSignalClient {
  private initialized = false;
  private appId: string;

  constructor() {
    this.appId = import.meta.env.VITE_ONESIGNAL_APP_ID;
    if (!this.appId) {
      console.warn('OneSignal App ID not found in environment variables');
    }
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    if (!this.appId) {
      throw new Error('OneSignal App ID is required');
    }

    try {
      // Load OneSignal SDK
      await this.loadOneSignalSDK();
      
      // Initialize OneSignal
      await window.OneSignal.init({
        appId: this.appId,
        safari_web_id: import.meta.env.VITE_ONESIGNAL_SAFARI_WEB_ID,
        notifyButton: {
          enable: false, // We'll handle our own UI
        },
        allowLocalhostAsSecureOrigin: true,
      });

      this.initialized = true;
      console.log('✅ OneSignal initialized successfully for iPhone');
    } catch (error) {
      console.error('❌ Failed to initialize OneSignal:', error);
      throw error;
    }
  }

  private async loadOneSignalSDK(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (window.OneSignal) {
        resolve();
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://cdn.onesignal.com/sdks/OneSignalSDK.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Failed to load OneSignal SDK'));
      document.head.appendChild(script);
    });
  }

  async requestPermission(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const permission = await window.OneSignal.requestPermission();
      console.log('📱 OneSignal permission result:', permission);
      return permission;
    } catch (error) {
      console.error('❌ OneSignal permission error:', error);
      return false;
    }
  }

  async subscribeToPushNotifications(userId: string): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      // Set external user ID
      await window.OneSignal.setExternalUserId(userId);
      
      // Get player ID (subscription ID)
      const playerId = await window.OneSignal.getPlayerId();
      
      if (playerId) {
        console.log('📱 OneSignal subscription successful:', playerId);
        return playerId;
      } else {
        console.warn('⚠️ OneSignal subscription failed: No player ID');
        return null;
      }
    } catch (error) {
      console.error('❌ OneSignal subscription error:', error);
      return null;
    }
  }

  async isSubscribed(): Promise<boolean> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const isSubscribed = await window.OneSignal.isSubscribed();
      return isSubscribed;
    } catch (error) {
      console.error('❌ OneSignal subscription check error:', error);
      return false;
    }
  }

  async getPlayerId(): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      const playerId = await window.OneSignal.getPlayerId();
      return playerId;
    } catch (error) {
      console.error('❌ OneSignal getPlayerId error:', error);
      return null;
    }
  }

  async unsubscribe(): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    try {
      await window.OneSignal.setSubscription(false);
      console.log('📱 OneSignal unsubscribed successfully');
    } catch (error) {
      console.error('❌ OneSignal unsubscribe error:', error);
    }
  }
}

// Global instance
export const oneSignalClient = new OneSignalClient();