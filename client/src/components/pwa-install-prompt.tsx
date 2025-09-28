import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Download, X, Bell, BellOff } from "lucide-react";
import { notificationService } from "@/lib/notifications";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function PWAInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState<'default' | 'granted' | 'denied'>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setShowPrompt(true);
    };

    const checkNotificationStatus = () => {
      if (notificationService.isSupported()) {
        const permission = notificationService.getPermissionStatus();
        setNotificationsEnabled(permission === 'granted');
        setNotificationStatus(permission);
      }
    };

    // Show prompt by default when component loads (unless already installed)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches;
    if (!isStandalone) {
      setShowPrompt(true);
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    checkNotificationStatus();

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      
      if (outcome === 'accepted') {
        setDeferredPrompt(null);
        setShowPrompt(false);
      }
    } else {
      // For desktop or when prompt not available, show instructions
      const isDesktop = window.innerWidth > 768;
      if (isDesktop) {
        alert('To install Favr:\n\n• Chrome: Click the install icon in the address bar\n• Edge: Click the install icon in the address bar\n• Safari: Add to Dock from File menu');
      } else {
        alert('To install Favr:\n\n• iPhone: Tap Share → Add to Home Screen\n• Android: Tap Menu → Add to Home Screen');
      }
    }
  };

  const handleEnableNotifications = async () => {
    const initialized = await notificationService.initialize();
    if (!initialized) {
      alert('Your browser does not support push notifications');
      return;
    }

    const permission = await notificationService.requestPermission();
    if (permission) {
      const subscribed = await notificationService.subscribeToPush();
      if (subscribed) {
        setNotificationsEnabled(true);
        setNotificationStatus('granted');
        
        // Force component re-render to hide notification prompt
        setTimeout(() => {
          setNotificationStatus(Notification.permission);
        }, 100);
        
        // Send a test notification
        await notificationService.sendTestNotification();
      }
    } else {
      // Permission was denied, update the status
      setNotificationStatus('denied');
    }
  };

  const handleDisableNotifications = async () => {
    const unsubscribed = await notificationService.unsubscribeFromPush();
    if (unsubscribed) {
      setNotificationsEnabled(false);
      setNotificationStatus('denied');
    }
  };

  // Show notifications prompt only if notifications are needed and not yet granted
  if (!showPrompt && notificationService.isSupported() && notificationStatus === 'default') {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <div className="bg-slate-800 rounded-lg p-4 border border-slate-700 shadow-lg max-w-sm">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-white font-semibold text-sm">🔔 Get Alerts</h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setNotificationStatus('denied')}
              className="text-slate-400 hover:text-white h-6 w-6"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
          
          <div className="space-y-2">
            <p className="text-slate-300 text-xs">
              Enable notifications to get instant alerts for new favors posted nearby
            </p>
            
            <div className="flex space-x-2">
              <Button
                onClick={handleEnableNotifications}
                className="flex-1 text-xs bg-blue-600 hover:bg-blue-700"
                size="sm"
              >
                <Bell className="w-3 h-3 mr-1" />
                Enable
              </Button>
              <Button
                onClick={() => setNotificationStatus('denied')}
                variant="outline"
                className="px-3 text-xs border-slate-600 text-slate-300 hover:bg-slate-700"
                size="sm"
              >
                Skip
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Don't show anything if notifications are already granted and no install prompt needed
  if (notificationStatus === 'granted' && !showPrompt) {
    return null;
  }

  // Don't show if user dismissed the prompt
  if (!showPrompt) {
    return null;
  }

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-4 border border-blue-500 shadow-2xl max-w-md gentle-bounce">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            <img src="/icons/favr-logo.png" alt="Favr" className="w-6 h-6" />
            <h3 className="text-white font-semibold text-sm">Install Favr App</h3>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowPrompt(false)}
            className="text-slate-400 hover:text-white h-6 w-6"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
        
        <p className="text-white text-sm mb-3 font-medium">
          📱 Add Favr to your home screen! Get instant notifications for new favors nearby.
        </p>
        
        <div className="flex space-x-2">
          <Button
            onClick={handleInstallApp}
            className="flex-1 bg-white text-blue-600 hover:bg-gray-100 font-semibold"
            size="sm"
          >
            <Download className="w-4 h-4 mr-1" />
            Add to Home Screen
          </Button>
          
          <Button
            onClick={() => setShowPrompt(false)}
            className="px-3 bg-white/20 text-white hover:bg-white/30 border-0"
            size="sm"
          >
            Later
          </Button>
        </div>
      </div>
    </div>
  );
}