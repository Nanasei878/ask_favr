import { useState, useEffect } from 'react';
import { AlertCircle, CheckCircle, Settings, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface NotificationHelperProps {
  onClose?: () => void;
  onSuccess?: () => void;
}

export function NotificationHelper({ onClose, onSuccess }: NotificationHelperProps) {
  const [permissionState, setPermissionState] = useState<NotificationPermission>('default');
  const [showInstructions, setShowInstructions] = useState(false);

  useEffect(() => {
    if ('Notification' in window) {
      setPermissionState(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (!('Notification' in window)) {
      alert('This browser does not support notifications');
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setPermissionState(permission);
      
      if (permission === 'granted') {
        // Test notification
        new Notification('Favr Notifications Enabled!', {
          body: 'You will now receive alerts for favors and messages.',
          icon: '/icons/icon-192x192.png'
        });
        onSuccess?.();
      } else if (permission === 'denied') {
        setShowInstructions(true);
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      setShowInstructions(true);
    }
  };

  const getBrowserInstructions = () => {
    const userAgent = navigator.userAgent;
    
    if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
      return {
        browser: 'Safari',
        steps: [
          'Click Safari in the menu bar',
          'Select "Settings for This Website"',
          'Change "Notifications" to "Allow"',
          'Refresh this page'
        ]
      };
    } else if (userAgent.includes('Chrome')) {
      return {
        browser: 'Chrome',
        steps: [
          'Click the lock icon in the address bar',
          'Change "Notifications" to "Allow"',
          'Refresh this page'
        ]
      };
    } else if (userAgent.includes('Firefox')) {
      return {
        browser: 'Firefox',
        steps: [
          'Click the shield icon in the address bar',
          'Click "Turn off Blocking for This Site"',
          'Refresh this page'
        ]
      };
    }
    
    return {
      browser: 'Your browser',
      steps: [
        'Look for a notification icon in the address bar',
        'Click it and select "Allow notifications"',
        'Refresh this page'
      ]
    };
  };

  const instructions = getBrowserInstructions();

  if (permissionState === 'granted') {
    return (
      <Alert className="bg-green-900/50 border-green-500">
        <CheckCircle className="w-4 h-4 text-green-400" />
        <AlertDescription className="text-green-100">
          Notifications are enabled! You'll receive alerts for favors and messages.
        </AlertDescription>
      </Alert>
    );
  }

  if (permissionState === 'denied' || showInstructions) {
    return (
      <div className="bg-slate-800 border border-slate-600 rounded-lg p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start space-x-2">
            <AlertCircle className="w-5 h-5 text-orange-400 mt-0.5" />
            <div>
              <h3 className="font-medium text-white">Enable Notifications in {instructions.browser}</h3>
              <p className="text-sm text-slate-300 mt-1">Follow these steps to receive alerts:</p>
            </div>
          </div>
          {onClose && (
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
        
        <ol className="text-sm text-slate-300 space-y-2 ml-7">
          {instructions.steps.map((step, index) => (
            <li key={index} className="flex">
              <span className="bg-favr-blue text-white rounded-full w-5 h-5 flex items-center justify-center text-xs font-medium mr-3 mt-0.5">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
        
        <div className="ml-7 pt-2">
          <Button 
            onClick={requestPermission}
            className="bg-favr-blue hover:bg-favr-blue/90 text-white"
            size="sm"
          >
            <Settings className="w-4 h-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Alert className="bg-blue-900/50 border-blue-500">
      <AlertCircle className="w-4 h-4 text-blue-400" />
      <AlertDescription className="text-blue-100 flex items-center justify-between">
        Enable notifications to get alerts for favors and messages nearby.
        <Button 
          onClick={requestPermission}
          variant="outline"
          size="sm"
          className="ml-4 border-blue-400 text-blue-400 hover:bg-blue-400 hover:text-blue-900"
        >
          Enable
        </Button>
      </AlertDescription>
    </Alert>
  );
}