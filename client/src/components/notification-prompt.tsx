import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';

export default function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    (async () => {
      if (!user?.id) return;

      // Initialize unified notifications (registers SW + OneSignal/WebPush path)
      const { unifiedNotificationService, subscribeToNotifications } = await import('@/lib/unifiedNotifications');
      await unifiedNotificationService.initialize();

      const permission = typeof Notification !== 'undefined' ? Notification.permission : 'default';
      console.log('NotificationPrompt: user', user.id, 'permission:', permission);

      // Ask backend if we already stored a sub (optional, as you had)
      let hasDbNotif = false;
      try {
        const r = await fetch(`/api/notifications/status/${user.id}`);
        const j = await r.json().catch(() => ({}));
        hasDbNotif = !!j?.hasNotifications;
      } catch { }

      if (permission === 'granted') {
        // make sure we’re registered server-side
        try {
          const ok = await subscribeToNotifications(String(user.id));
          console.log('Auto-subscription result:', ok);
        } catch (e) {
          console.warn('Auto-subscribe failed:', e);
        }
        setShowPrompt(false);
      } else if (permission === 'default') {
        setShowPrompt(true);
      } else if (permission === 'denied' && !hasDbNotif) {
        setShowPrompt(true);
      } else {
        setShowPrompt(false);
      }
    })();
  }, [user?.id]);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    try {
      if (!user?.id) return;

      const { unifiedNotificationService, subscribeToNotifications } = await import('@/lib/unifiedNotifications');

      // useful diagnostics
      const deviceInfo = unifiedNotificationService.getDeviceInfo();
      const platform = deviceInfo?.needsOneSignal || !('PushManager' in window) ? 'onesignal' : 'webpush';
      console.log('🔍 Device:', deviceInfo);
      console.log('📱 Selected platform:', platform);

      const ok = await subscribeToNotifications(String(user.id));
      if (ok) {
        console.log('✅ Push notifications enabled');
        // send a test ping (non-fatal)
        try {
          await fetch('/api/notifications/test', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'user-id': String(user.id) },
            body: JSON.stringify({ userId: String(user.id) }),
          });
        } catch (e) {
          console.warn('Test notification failed:', e);
        }
        setShowPrompt(false);
      } else {
        console.error('❌ Failed to subscribe');
        setShowPrompt(false);
      }
    } catch (e) {
      console.error('Error enabling notifications:', e);
      setShowPrompt(false);
    } finally {
      setIsLoading(false);
    }
  };

  if (!showPrompt) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 max-w-md mx-auto">
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-4">
        <div className="flex items-start space-x-3">
          <div className="flex-shrink-0">
            <Bell className="w-6 h-6 text-blue-600" />
          </div>

          <div className="flex-1">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
              Stay Updated with Nearby Favors
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              Get instant notifications when new favors are posted within 10km of your location and when you receive messages.
            </p>

            <div className="flex space-x-2 mt-3">
              <Button onClick={handleEnableNotifications} disabled={isLoading} size="sm" className="flex-1">
                {isLoading ? 'Setting up...' : 'Enable Notifications'}
              </Button>

              <Button onClick={() => setShowPrompt(false)} variant="outline" size="sm" className="px-2">
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
