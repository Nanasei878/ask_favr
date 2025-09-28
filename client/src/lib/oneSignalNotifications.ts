// OneSignal notification service optimized for Apple devices
declare global {
  interface Window {
    OneSignal: any;
  }
}

export class OneSignalNotificationService {
  private isInitialized = false;

  constructor() {
    this.waitForOneSignal();
  }

  private async waitForOneSignal(): Promise<void> {
    return new Promise((resolve) => {
      const checkOneSignal = () => {
        if (window.OneSignal) {
          this.isInitialized = true;
          console.log('✅ OneSignal initialized for Apple devices');
          resolve();
        } else {
          setTimeout(checkOneSignal, 100);
        }
      };
      checkOneSignal();
    });
  }

  // Check if user is subscribed (works on all Apple devices)
  async isSubscribed(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.waitForOneSignal();
    }

    try {
      const isPushSupported = await window.OneSignal.isPushNotificationsSupported();
      if (!isPushSupported) {
        console.log('Push notifications not supported on this device');
        return false;
      }

      const subscription = await window.OneSignal.isPushNotificationsEnabled();
      console.log('OneSignal subscription status:', subscription);
      return subscription || false;
    } catch (error) {
      console.error('Error checking OneSignal subscription:', error);
      return false;
    }
  }

  // Subscribe user (optimized for iOS Safari)
  async subscribe(userId: string): Promise<boolean> {
    if (!this.isInitialized) {
      await this.waitForOneSignal();
    }

    try {
      console.log('🍎 Starting OneSignal subscription for Apple device...');
      
      // Set external user ID for targeting
      await window.OneSignal.setExternalUserId(userId);
      
      // Show the native permission prompt (required for iOS)
      const permission = await window.OneSignal.showNativePrompt();
      
      if (permission) {
        console.log('✅ OneSignal subscription successful for user:', userId);
        
        // Optional: Send test notification to confirm setup
        try {
          await fetch('/api/notifications/onesignal-test', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ userId })
          });
        } catch (testError) {
          console.log('Test notification failed (but subscription succeeded):', testError);
        }
        
        return true;
      } else {
        console.log('❌ User denied OneSignal permission');
        return false;
      }
    } catch (error) {
      console.error('OneSignal subscription error:', error);
      return false;
    }
  }

  // Unsubscribe user
  async unsubscribe(): Promise<boolean> {
    if (!this.isInitialized) {
      await this.waitForOneSignal();
    }

    try {
      await window.OneSignal.setSubscription(false);
      console.log('✅ OneSignal unsubscribed successfully');
      return true;
    } catch (error) {
      console.error('OneSignal unsubscribe error:', error);
      return false;
    }
  }

  // Get user ID (useful for debugging)
  async getUserId(): Promise<string | null> {
    if (!this.isInitialized) {
      await this.waitForOneSignal();
    }

    try {
      const userId = await window.OneSignal.getUserId();
      return userId;
    } catch (error) {
      console.error('Error getting OneSignal user ID:', error);
      return null;
    }
  }

  // Check if running on iOS (for specific handling)
  isIOS(): boolean {
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  // Check if PWA is added to home screen (required for iOS notifications)
  isPWAInstalled(): boolean {
    if (this.isIOS()) {
      return (window.navigator as any).standalone === true;
    }
    return true; // Assume other platforms don't require home screen installation
  }

  // Get helpful instructions for iOS users
  getIOSInstructions(): string[] {
    if (!this.isPWAInstalled() && this.isIOS()) {
      return [
        'Add this app to your home screen first:',
        '1. Tap the Share button in Safari',
        '2. Select "Add to Home Screen"',
        '3. Open the app from your home screen',
        '4. Then enable notifications'
      ];
    }
    return [];
  }
}

// Export singleton instance optimized for Apple devices
export const oneSignalNotifications = new OneSignalNotificationService();