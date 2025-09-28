// Service Worker registration and notification utilities

export class NotificationService {
  private swRegistration: ServiceWorkerRegistration | null = null;
  private userId: string = "1"; // Default user ID for now

  setUserId(userId: string) {
    this.userId = userId;
  }

  async initialize() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push messaging is not supported');
      return false;
    }

    try {
      // Register service worker with immediate update checking
      this.swRegistration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none' // Always check for updates
      });
      
      // Handle service worker updates automatically
      this.swRegistration.addEventListener('updatefound', () => {
        console.log('New service worker found, installing...');
        const newWorker = this.swRegistration!.installing;
        
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                console.log('New service worker installed, taking control...');
                // Tell the new service worker to take control immediately
                newWorker.postMessage({ type: 'SKIP_WAITING' });
                // Reload to get latest features
                setTimeout(() => window.location.reload(), 1000);
              } else {
                console.log('Service worker installed for the first time');
              }
            }
          });
        }
      });

      // Check for updates every 30 seconds
      setInterval(() => {
        this.swRegistration?.update().catch(err => 
          console.log('Service worker update check failed:', err)
        );
      }, 30000);
      
      console.log('Service Worker registered successfully');
      return true;
    } catch (error) {
      console.error('Service Worker registration failed:', error);
      return false;
    }
  }

  async requestPermission(): Promise<boolean> {
    if (!('Notification' in window)) {
      console.warn('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      return true;
    }

    if (Notification.permission === 'denied') {
      console.warn('Notification permission denied');
      return false;
    }

    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }

  async subscribeToPush(): Promise<boolean> {
    if (!this.swRegistration) {
      console.error('Service Worker not registered');
      return false;
    }

    try {
      // Check if already subscribed
      const existingSubscription = await this.swRegistration.pushManager.getSubscription();
      if (existingSubscription) {
        console.log('✅ Using existing push subscription for user:', this.userId);
        const success = await this.sendSubscriptionToServer(existingSubscription);
        console.log('✅ Existing subscription sent to server:', success);
        return success;
      }

      console.log('🔔 Creating NEW push subscription for user:', this.userId);
      
      // Create new subscription
      const vapidKey = await this.getVAPIDPublicKey();
      const subscription = await this.swRegistration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidKey)
      });

      const success = await this.sendSubscriptionToServer(subscription);
      console.log('✅ New subscription created and sent to server:', success);
      return success;
    } catch (error: any) {
      console.error('❌ Failed to subscribe to push notifications:', error);
      console.error('❌ Error details:', error?.message || 'Unknown error');
      if (error?.name) {
        console.error('❌ Error name:', error.name);
      }
      return false;
    }
  }

  async unsubscribeFromPush(): Promise<boolean> {
    if (!this.swRegistration) {
      return false;
    }

    try {
      const subscription = await this.swRegistration.pushManager.getSubscription();
      
      if (subscription) {
        await subscription.unsubscribe();
        await this.removeSubscriptionFromServer();
      }
      
      return true;
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      return false;
    }
  }

  private async sendSubscriptionToServer(subscription: PushSubscription): Promise<boolean> {
    const subscriptionData = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: this.arrayBufferToBase64URL(subscription.getKey('p256dh')!),
        auth: this.arrayBufferToBase64URL(subscription.getKey('auth')!)
      }
    };

    // Get current user ID from session/localStorage
    const currentUserId = localStorage.getItem('currentUserId') || this.userId;
    console.log('Sending subscription to server for user:', currentUserId);
    console.log('Subscription data:', subscriptionData);

    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'user-id': currentUserId || '1'
      },
      body: JSON.stringify({
        userId: currentUserId || '1',
        subscription: subscriptionData
      })
    });

    const result = await response.json();
    console.log('Server response:', result);

    if (!response.ok) {
      throw new Error(`Failed to send subscription to server: ${result.message || response.statusText}`);
    }
    
    console.log('✅ Subscription successfully sent to server');
    return true;
  }

  private async removeSubscriptionFromServer() {
    const response = await fetch('/api/notifications/unsubscribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ userId: this.userId })
    });

    if (!response.ok) {
      throw new Error('Failed to remove subscription from server');
    }
  }

  async sendTestNotification(): Promise<boolean> {
    try {
      const response = await fetch('/api/notifications/test', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId: this.userId })
      });

      const result = await response.json();
      return result.success;
    } catch (error) {
      console.error('Failed to send test notification:', error);
      return false;
    }
  }

  // Utility functions
  private async getVAPIDPublicKey(): Promise<string> {
    try {
      const response = await fetch('/api/vapid-public-key');
      const data = await response.json();
      console.log('Fetched VAPID public key from server:', data.publicKey);
      return data.publicKey;
    } catch (error) {
      console.error('Failed to fetch VAPID key from server, using fallback:', error);
      const fallbackKey = 'BIiODLOlI5kKVFlPPJ6xYZROMSheisJrGskZNdkFYH-MlXAJ2ix5aD_Pt7E0d6VccAcDck9ypxXQoL1c8GkfD2A';
      return fallbackKey;
    }
  }

  private urlBase64ToUint8Array(base64String: string): Uint8Array {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  private arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary);
  }

  private arrayBufferToBase64URL(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return window.btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
  }

  // Check if notifications are supported and enabled
  isSupported(): boolean {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  getPermissionStatus(): NotificationPermission {
    return Notification.permission;
  }

  // Force enable notifications for any user - useful for testing and troubleshooting
  async forceEnableNotifications(userId: string): Promise<boolean> {
    console.log(`🔔 Forcing notification enable for user ${userId}`);
    
    // Set the user ID
    this.setUserId(userId);
    
    // Initialize service worker
    const initialized = await this.initialize();
    if (!initialized) {
      console.error('Service worker initialization failed');
      return false;
    }
    
    // Request permission
    const permission = await this.requestPermission();
    if (!permission) {
      console.error('Notification permission denied');
      return false;
    }
    
    // Subscribe to push notifications
    const subscribed = await this.subscribeToPush();
    if (!subscribed) {
      console.error('Push subscription failed');
      return false;
    }
    
    console.log(`✅ Notifications successfully enabled for user ${userId}`);
    return true;
  }

  // Get current subscription status for debugging
  async getSubscriptionStatus(): Promise<{hasSubscription: boolean, userId: string, permission: string}> {
    const hasSubscription = !!(this.swRegistration && await this.swRegistration.pushManager.getSubscription());
    return {
      hasSubscription,
      userId: this.userId,
      permission: Notification.permission
    };
  }
}

export const notificationService = new NotificationService();