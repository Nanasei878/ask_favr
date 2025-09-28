// 4. DEBUG PANEL FOR TESTING
// File: components/notification-debug-panel.tsx (NEW)
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/hooks/use-auth';
import { unifiedNotificationService, subscribeToNotifications, testNotifications } from '@/lib/unifiedNotifications';

export function NotificationDebugPanel() {
  const [log, setLog] = useState<string[]>([]);
  const [isSubscribed, setIsSubscribed] = useState<boolean | null>(null);
  const [deviceInfo, setDeviceInfo] = useState<any>(null);
  const { user } = useAuth();

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setLog(prev => [...prev, `${timestamp}: ${message}`]);
    console.log(message);
  };

  const checkStatus = async () => {
    addLog('🔍 Checking notification status...');
    
    const device = unifiedNotificationService.getDeviceInfo();
    setDeviceInfo(device);
    addLog(`📱 Device: ${device.platform} (${device.browser})`);
    addLog(`🔔 Platform: ${device.needsOneSignal ? 'OneSignal' : 'Web Push'}`);
    
    const subscribed = await unifiedNotificationService.isSubscribed();
    setIsSubscribed(subscribed);
    addLog(`✅ Subscribed: ${subscribed}`);
    
    addLog(`🎯 Permission: ${Notification.permission}`);
  };

  const testFullFlow = async () => {
    if (!user) {
      addLog('❌ No user logged in');
      return;
    }

    setLog([]);
    addLog('🚀 Starting full notification test...');
    
    try {
      addLog('📱 Getting device info...');
      const device = unifiedNotificationService.getDeviceInfo();
      addLog(`Device: ${device.platform} | Browser: ${device.browser} | Mobile: ${device.isMobile}`);
      
      addLog('🔔 Requesting permission...');
      const hasPermission = await unifiedNotificationService.requestPermission();
      addLog(`Permission granted: ${hasPermission}`);
      
      if (hasPermission) {
        addLog('📋 Subscribing to notifications...');
        const success = await subscribeToNotifications(user.id.toString());
        addLog(`Subscription success: ${success}`);
        
        if (success) {
          addLog('🧪 Sending test notification...');
          const testResult = await testNotifications(user.id.toString());
          addLog(`Test notification sent: ${testResult}`);
          
          if (testResult) {
            addLog('🎉 Full notification flow completed successfully!');
          }
        }
      }
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
    }
  };

  const testNotificationOnly = async () => {
    if (!user) return;
    
    addLog('🧪 Sending test notification...');
    const success = await testNotifications(user.id.toString());
    addLog(`Test result: ${success}`);
  };

  return (
    <Card className="w-full max-w-2xl bg-slate-800 border-slate-700 text-white">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <span>🔧 Notification Debug Panel</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button onClick={checkStatus} variant="outline" size="sm">
            Check Status
          </Button>
          <Button onClick={testFullFlow} variant="default" size="sm">
            Test Full Flow
          </Button>
          <Button onClick={testNotificationOnly} variant="secondary" size="sm">
            Test Notification
          </Button>
          <Button onClick={() => setLog([])} variant="ghost" size="sm">
            Clear Log
          </Button>
        </div>

        {deviceInfo && (
          <div className="bg-slate-700 rounded p-3 text-sm">
            <div><strong>Platform:</strong> {deviceInfo.platform}</div>
            <div><strong>Browser:</strong> {deviceInfo.browser} {deviceInfo.version}</div>
            <div><strong>Mobile:</strong> {deviceInfo.isMobile ? 'Yes' : 'No'}</div>
            <div><strong>PWA:</strong> {deviceInfo.isPWA ? 'Yes' : 'No'}</div>
            <div><strong>Service:</strong> {deviceInfo.needsOneSignal ? 'OneSignal' : 'Web Push'}</div>
            <div><strong>Web Push Support:</strong> {deviceInfo.supportsWebPush ? 'Yes' : 'No'}</div>
            <div><strong>Subscribed:</strong> {isSubscribed !== null ? (isSubscribed ? 'Yes' : 'No') : 'Unknown'}</div>
          </div>
        )}

        <div className="bg-black rounded p-3 text-green-400 text-xs font-mono max-h-60 overflow-y-auto">
          {log.length === 0 ? (
            <div className="text-gray-500">Click "Test Full Flow" to debug notifications...</div>
          ) : (
            log.map((entry, i) => (
              <div key={i}>{entry}</div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}