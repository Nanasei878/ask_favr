import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { notificationService } from "@/lib/notifications";
import { Bell, BellOff, TestTube, Check, X, MessageCircle } from "lucide-react";

interface NotificationSettingsProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MessagesCenter({ isOpen, onClose }: NotificationSettingsProps) {
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const checkSupport = async () => {
      const supported = notificationService.isSupported();
      setIsSupported(supported);
      
      if (supported) {
        setPermission(notificationService.getPermissionStatus());
        await notificationService.initialize();
      }
    };
    
    checkSupport();
  }, []);

  const handleEnableNotifications = async () => {
    setIsLoading(true);
    
    try {
      const hasPermission = await notificationService.requestPermission();
      
      if (!hasPermission) {
        toast({
          title: "Permission Required",
          description: "Please enable notifications in your browser settings to receive updates.",
          duration: 5000,
        });
        setIsLoading(false);
        return;
      }

      // Use unified notification system for cross-platform compatibility  
      const { subscribeToNotifications, getDeviceInfo, getNotificationPlatform } = await import('@/lib/unifiedNotifications');
      
      // Log device info for debugging
      const deviceInfo = getDeviceInfo();
      const platform = getNotificationPlatform();
      console.log('🔍 Device Detection:', deviceInfo);
      console.log('📱 Selected Platform:', platform);
      
      const subscribed = await subscribeToNotifications("1"); // Default user ID
      
      if (subscribed) {
        setIsSubscribed(true);
        setPermission('granted');
        toast({
          title: "Notifications Enabled",
          description: "You'll now receive updates about your favors!",
          duration: 3000,
        });
      } else {
        toast({
          title: "Subscription Failed",
          description: "Unable to enable notifications. Please try again.",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error enabling notifications:', error);
      toast({
        title: "Error",
        description: "Failed to enable notifications. Please try again.",
        duration: 3000,
      });
    }
    
    setIsLoading(false);
  };

  const handleDisableNotifications = async () => {
    setIsLoading(true);
    
    try {
      const unsubscribed = await notificationService.unsubscribeFromPush();
      
      if (unsubscribed) {
        setIsSubscribed(false);
        toast({
          title: "Notifications Disabled",
          description: "You won't receive push notifications anymore.",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error disabling notifications:', error);
      toast({
        title: "Error",
        description: "Failed to disable notifications.",
        duration: 3000,
      });
    }
    
    setIsLoading(false);
  };

  const handleTestNotification = async () => {
    try {
      const success = await notificationService.sendTestNotification();
      
      if (success) {
        toast({
          title: "Test Sent",
          description: "Check for the test notification!",
          duration: 3000,
        });
      } else {
        toast({
          title: "Test Failed",
          description: "Unable to send test notification.",
          duration: 3000,
        });
      }
    } catch (error) {
      console.error('Error sending test notification:', error);
      toast({
        title: "Error",
        description: "Failed to send test notification.",
        duration: 3000,
      });
    }
  };

  if (!isSupported) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md p-6">
          <DialogTitle className="text-lg font-bold text-favr-gray-800 mb-4">
            Push Notifications
          </DialogTitle>
          
          <div className="text-center py-8">
            <BellOff className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-700 mb-2">
              Not Supported
            </h3>
            <p className="text-gray-500 text-sm">
              Your browser doesn't support push notifications.
            </p>
          </div>
          
          <Button onClick={onClose} className="w-full">
            Close
          </Button>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogTitle className="text-lg font-bold text-favr-gray-800 mb-4">
          Push Notifications
        </DialogTitle>
        
        <div className="space-y-6">
          {/* Current Status */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center space-x-3">
              {permission === 'granted' && isSubscribed ? (
                <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              ) : (
                <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              )}
              <div>
                <div className="font-medium text-sm">
                  {permission === 'granted' && isSubscribed ? 'Enabled' : 'Disabled'}
                </div>
                <div className="text-xs text-gray-500">
                  {permission === 'granted' && isSubscribed 
                    ? 'Receiving favor updates' 
                    : 'Not receiving notifications'
                  }
                </div>
              </div>
            </div>
            <Bell className={`w-5 h-5 ${permission === 'granted' && isSubscribed ? 'text-green-500' : 'text-gray-400'}`} />
          </div>

          {/* Enable/Disable Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium text-sm">Push Notifications</div>
              <div className="text-xs text-gray-500">Get notified about favor updates</div>
            </div>
            <Switch
              checked={permission === 'granted' && isSubscribed}
              onCheckedChange={(checked) => {
                if (checked) {
                  handleEnableNotifications();
                } else {
                  handleDisableNotifications();
                }
              }}
              disabled={isLoading}
            />
          </div>

          {/* Notification Types */}
          {permission === 'granted' && isSubscribed && (
            <div className="space-y-3">
              <h4 className="font-medium text-sm text-gray-700">You'll be notified about:</h4>
              <div className="space-y-2">
                {[
                  { icon: Check, label: "Favor accepted", color: "text-green-500" },
                  { icon: Check, label: "Favor completed", color: "text-blue-500" },
                  { icon: Check, label: "New messages", color: "text-purple-500" },
                  { icon: X, label: "Favor cancelled", color: "text-red-500" },
                ].map((item, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                    <span className="text-sm text-gray-600">{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Test Button */}
          {permission === 'granted' && isSubscribed && (
            <Button
              variant="outline"
              onClick={handleTestNotification}
              className="w-full flex items-center space-x-2"
            >
              <TestTube className="w-4 h-4" />
              <span>Send Test Notification</span>
            </Button>
          )}

          {/* Permission Denied Message */}
          {permission === 'denied' && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-700">
                Notifications are blocked. Please enable them in your browser settings and refresh the page.
              </p>
            </div>
          )}
        </div>

        <Button onClick={onClose} className="w-full mt-6">
          Done
        </Button>
      </DialogContent>
    </Dialog>
  );
}