import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';

interface GlobalChatMessage {
  type: string;
  message?: {
    id: string;
    content: string;
    senderId: string;
    recipientId: string;
    timestamp: string;
  };
}

export function useGlobalChat() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  useEffect(() => {
    if (!user) return;

    const connectWebSocket = () => {
      // Clean up existing connection
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return;
      }

      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      
      try {
        const socket = new WebSocket(wsUrl);
        wsRef.current = socket;

        socket.onopen = () => {
          console.log('🔌 Global chat WebSocket connected');
          
          // Register this user for global message notifications
          socket.send(JSON.stringify({
            type: 'register_user',
            userId: String(user.id)
          }));
        };

        socket.onmessage = (event) => {
          try {
            const data: GlobalChatMessage = JSON.parse(event.data);
            
            // If it's a new message and the current user is the recipient
            if (data.type === 'new_message' && data.message) {
              if (data.message.recipientId === String(user.id)) {
                console.log('📨 Received new message globally, updating unread count');
                
                // Invalidate conversation queries to refresh unread counts
                queryClient.invalidateQueries({ queryKey: ["/api/chat/conversations"] });
                
                // Also invalidate any specific chat room queries
                queryClient.invalidateQueries({ queryKey: ["/api/chat"] });
              }
            }
          } catch (error) {
            console.error('❌ Error parsing global chat message:', error);
          }
        };

        socket.onclose = (event) => {
          console.log('🔌 Global chat WebSocket disconnected');
          wsRef.current = null;
          
          // Reconnect after 3 seconds if not a clean close
          if (event.code !== 1000 && user) {
            reconnectTimeoutRef.current = setTimeout(() => {
              console.log('🔄 Attempting to reconnect global chat WebSocket...');
              connectWebSocket();
            }, 3000);
          }
        };

        socket.onerror = (error) => {
          console.error('❌ Global chat WebSocket error:', error);
          wsRef.current = null;
        };

      } catch (error) {
        console.error('❌ Failed to create global chat WebSocket:', error);
      }
    };

    connectWebSocket();

    // Cleanup function
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, 'Component unmounting');
      }
      wsRef.current = null;
    };
  }, [user, queryClient]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN
  };
}