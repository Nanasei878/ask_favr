// 3. ENHANCED NOTIFICATION PROMPT COMPONENT
// File: components/notification-prompt-enhanced.tsx (NEW)
import { useState, useEffect } from 'react';
import { Bell, X, Smartphone, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/use-auth';
import { unifiedNotificationService, subscribeToNotifications, testNotifications } from '@/lib/unifiedNotifications';

export default function NotificationPromptEnhanced() {
  const [showPrompt, setShowPrompt] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState<'prompt' | 'setup' | 'testing' | 'success'>('prompt');
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) return;

    const checkNotificationStatus = async () => {
      const device = unifiedNotificationService.getDeviceInfo();
      setDeviceInfo(device);

      const isSubscribed = await unifiedNotificationService.isSubscribed();
      const permission = Notification.permission;

      // Show prompt if not subscribed and permission not denied
      if (!isSubscribed && permission !== 'denied') {
        setShowPrompt(true);
      }
    };

    checkNotificationStatus();
  }, [user]);

  const handleEnableNotifications = async () => {
    if (!user) return;

    setIsLoading(true);
    setCurrentStep('setup');

    try {
      const success = await subscribeToNotifications(user.id.toString());
      
      if (success) {
        setCurrentStep('testing');
        
        // Send test notification
        const testSuccess = await testNotifications(user.id.toString());
        
        if (testSuccess) {
          setCurrentStep('success');
          setTimeout(() => {
            setShowPrompt(false);
          }, 3000);
        } else {
          // Still successful subscription, just test failed
          setCurrentStep('success');
          setTimeout(() => setShowPrompt(false), 2000);
        }
      } else {
        // Failed - show browser-specific instructions
        setCurrentStep('prompt');
        alert(`Please enable notifications in your ${deviceInfo?.browser} settings and try again.`);
      }
    } catch (error) {
      console.error('Notification setup failed:', error);
      setCurrentStep('prompt');
    } finally {
      setIsLoading(false);
    }
  };

  if (!showPrompt || !user) return null;

  const getPlatformSpecificMessage = () => {
    if (!deviceInfo) return "Enable notifications to stay updated";
    
    const { platform, browser, isStandalone } = deviceInfo;
    
    if (platform === 'ios' && !isStandalone) {
      return "Add to Home Screen first, then enable notifications for the best experience";
    }
    
    if (platform === 'ios') {
      return "Get instant alerts for new favors and messages";
    }
    
    if (browser === 'safari') {
      return "Enable notifications in Safari preferences for favor alerts";
    }
    
    return "Get notified about new favors and messages nearby";
  };

  return (
    <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 max-w-sm mx-auto">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl p-4 shadow-2xl border border-blue-500/30">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            {currentStep === 'success' ? (
              <CheckCircle className="w-6 h-6 text-white" />
            ) : (
              <Bell className="w-6 h-6 text-white" />
            )}
            <h3 className="text-white font-semibold text-sm">
              {currentStep === 'success' ? 'All Set!' : 'Stay Connected'}
            </h3>
          </div>
          {currentStep === 'prompt' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowPrompt(false)}
              className="text-white/70 hover:text-white h-6 w-6 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        <div className="space-y-3">
          {currentStep === 'prompt' && (
            <>
              <p className="text-white/90 text-sm">
                {getPlatformSpecificMessage()}
              </p>
              
              {deviceInfo && (
                <div className="bg-white/10 rounded-lg p-2">
                  <p className="text-white/80 text-xs">
                    Platform: {deviceInfo.platform} • {deviceInfo.browser}
                    {deviceInfo.needsOneSignal ? ' (OneSignal)' : ' (Web Push)'}
                  </p>
                </div>
              )}
              
              <div className="flex space-x-2">
                <Button
                  onClick={handleEnableNotifications}
                  disabled={isLoading}
                  className="flex-1 bg-white text-blue-600 hover:bg-gray-100 font-medium text-sm"
                >
                  {isLoading ? 'Setting up...' : 'Enable Notifications'}
                </Button>
                
                <Button
                  onClick={() => setShowPrompt(false)}
                  className="px-3 bg-white/20 text-white hover:bg-white/30 border-0 text-sm"
                >
                  Later
                </Button>
              </div>
            </>
          )}
          
          {currentStep === 'setup' && (
            <div className="text-center">
              <div className="animate-spin w-6 h-6 border-2 border-white border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-white text-sm">Setting up notifications...</p>
            </div>
          )}
          
          {currentStep === 'testing' && (
            <div className="text-center">
              <Smartphone className="w-8 h-8 text-white mx-auto mb-2 animate-pulse" />
              <p className="text-white text-sm">Sending test notification...</p>
            </div>
          )}
          
          {currentStep === 'success' && (
            <div className="text-center">
              <CheckCircle className="w-8 h-8 text-white mx-auto mb-2" />
              <p className="text-white text-sm font-medium">
                Notifications enabled successfully!
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}