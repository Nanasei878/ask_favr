import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { notificationService } from '@/lib/notifications';

export default function DebugNotifications() {
  const [log, setLog] = useState<string[]>([]);
  
  const addLog = (message: string) => {
    setLog(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
    console.log(message);
  };

  const testFullFlow = async () => {
    setLog([]);
    addLog('🔍 Starting notification flow debug...');
    
    try {
      // Step 1: Check support
      const isSupported = notificationService.isSupported();
      addLog(`✅ Browser support: ${isSupported}`);
      
      // Step 2: Check permission
      const currentPermission = notificationService.getPermissionStatus();
      addLog(`📋 Current permission: ${currentPermission}`);
      
      // Step 3: Request permission
      addLog('🔔 Requesting notification permission...');
      const permissionGranted = await notificationService.requestPermission();
      addLog(`✅ Permission granted: ${permissionGranted}`);
      
      if (permissionGranted) {
        // Step 4: Set user ID
        notificationService.setUserId('1');
        addLog('👤 User ID set to: 1');
        
        // Step 5: Subscribe to push
        addLog('🔗 Subscribing to push notifications...');
        const subscribed = await notificationService.subscribeToPush();
        addLog(`✅ Push subscription: ${subscribed}`);
        
        if (subscribed) {
          addLog('🎉 Full notification flow completed successfully!');
        }
      }
    } catch (error: any) {
      addLog(`❌ Error: ${error.message}`);
    }
  };

  const checkSubscription = async () => {
    try {
      const response = await fetch('/api/notifications/subscriptions', {
        headers: { 'user-id': '1' }
      });
      const result = await response.json();
      addLog(`📊 Server subscriptions: ${JSON.stringify(result, null, 2)}`);
    } catch (error: any) {
      addLog(`❌ Check failed: ${error.message}`);
    }
  };

  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <h3 className="font-bold mb-3">🔧 Notification System Debug</h3>
      
      <div className="space-x-2 mb-4">
        <Button onClick={testFullFlow} size="sm">
          Test Full Flow
        </Button>
        <Button onClick={checkSubscription} size="sm" variant="outline">
          Check Server
        </Button>
        <Button onClick={() => setLog([])} size="sm" variant="outline">
          Clear Log
        </Button>
      </div>

      <div className="bg-black text-green-400 p-3 rounded text-xs font-mono max-h-60 overflow-y-auto">
        {log.length === 0 ? (
          <div className="text-gray-500">Click "Test Full Flow" to debug notifications...</div>
        ) : (
          log.map((entry, i) => (
            <div key={i}>{entry}</div>
          ))
        )}
      </div>
    </div>
  );
}