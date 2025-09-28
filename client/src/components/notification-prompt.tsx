import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { notificationService } from '@/lib/notifications';
import { useAuth } from '@/hooks/use-auth';

export default function NotificationPrompt() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { user } = useAuth();

  useEffect(() => {
    // Always check notification status when user is authenticated
    if (user) {
      console.log('NotificationPrompt: User detected:', user.id);
      
      // Initialize notification service
      notificationService.initialize().then(async () => {
        const permission = Notification.permission;
        console.log('Current notification permission:', permission);
        
        // Check if user already has notifications enabled in database
        const response = await fetch(`/api/notifications/status/${user.id}`);
        const status = await response.json();
        
        // Only show prompt if browser permission is not granted
        // AND user hasn't already granted permission before
        if (permission === 'default') {
          console.log('Showing notification prompt for user:', user.id, 'Permission:', permission, 'DB Status:', status.hasNotifications);
          setShowPrompt(true);
        } else if (permission === 'denied' && !status.hasNotifications) {
          // Only show if permission denied AND user never had notifications
          console.log('Showing notification prompt for denied permission:', user.id);
          setShowPrompt(true);
        } else {
          // If permission is granted, ensure user is subscribed
          notificationService.setUserId(user.id.toString());
          import('@/lib/unifiedNotifications').then(({ subscribeToNotifications }) => {
            subscribeToNotifications(user.id.toString()).then(subscribed => {
              console.log('Auto-subscription result:', subscribed);
            });
          });
        }
      });
    }
  }, [user]);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    
    try {
      if (!user?.id) {
        console.error('No user ID available');
        setShowPrompt(false);
        setIsLoading(false);
        return;
      }

      // Set user ID for notifications
      notificationService.setUserId(user.id.toString());
      
      // Use unified notification system for cross-platform compatibility
      const { subscribeToNotifications, getDeviceInfo, getNotificationPlatform } = await import('@/lib/unifiedNotifications');
      
      // Log device info for debugging
      const deviceInfo = getDeviceInfo();
      const platform = getNotificationPlatform();
      console.log('🔍 Device Detection:', deviceInfo);
      console.log('📱 Selected Platform:', platform);
      
      const subscribed = await subscribeToNotifications(user.id.toString());
      
      if (subscribed) {
        console.log('✅ Push notifications enabled successfully');
        
        // Send test notification
        try {
          const response = await fetch('/api/notifications/test', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'user-id': user.id.toString()
            },
            body: JSON.stringify({
              userId: user.id.toString()
            })
          });
          
          if (response.ok) {
            console.log('✅ Test notification sent from landing page');
          }
        } catch (error) {
          console.error('Test notification error:', error);
        }
        
        setShowPrompt(false);
      } else {
        console.error('❌ Failed to subscribe to push notifications');
        setShowPrompt(false);
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDismiss = () => {
    setShowPrompt(false);
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
              <Button
                onClick={handleEnableNotifications}
                disabled={isLoading}
                size="sm"
                className="flex-1"
              >
                {isLoading ? 'Setting up...' : 'Enable Notifications'}
              </Button>
              
              <Button
                onClick={handleDismiss}
                variant="outline"
                size="sm"
                className="px-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}