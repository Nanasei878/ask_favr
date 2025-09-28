import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, Clock, CheckCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

/* ------------------------------ Types ----------------------------------- */

type Status = "sent" | "delivered" | "seen";

interface ConversationAPI {
  chatRoomId: number;
  favorId: number;
  favorTitle?: string;        // 👈
  otherUserId: string;
  otherUserName?: string;     // 👈
  otherUserOnline: boolean;
  lastMessage: string;
  lastMessageTime: string | null;
  unreadCount: number;
}

interface ConversationUI {
  chatRoomId: number;
  favorId: number;
  favorTitle: string;         // 👈
  otherUserId: string;
  otherUserName: string;      // 👈
  otherUserOnline: boolean;
  lastMessage: string;
  lastMessageTime: string | null;
  unreadCount: number;
  status: "sent" | "delivered" | "seen";
}

interface UINotification {
  id: string;
  title: string;
  message: string;
  timestamp: string; // ISO or human
  read: boolean;
  url?: string;
  type?: string;
}

/* ------------------------------ Component -------------------------------- */

interface MessagesCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function MessagesCenter({ isOpen, onClose }: MessagesCenterProps) {
  const [activeTab, setActiveTab] =
    useState<"messages" | "notifications">("messages");
  const [conversations, setConversations] = useState<ConversationUI[]>([]);
  const [notifications, setNotifications] = useState<UINotification[]>([]);
  const { user } = useAuth();

  /* ---------------------------- Data fetching ---------------------------- */

  const { data: convData } = useQuery<ConversationAPI[]>({
    queryKey: ["/api/chat/conversations"],
    enabled: isOpen && !!user,
  });

  // keep only this ONE effect
  useEffect(() => {
    if (!user || !Array.isArray(convData)) {
      setConversations([]);
      return;
    }

    const mapped: ConversationUI[] = convData.map((c) => ({
      chatRoomId: c.chatRoomId,
      favorId: c.favorId,
      favorTitle: c.favorTitle ?? `Favor #${c.favorId}`,        // ✅ fallback
      otherUserId: String(c.otherUserId),
      otherUserName: c.otherUserName ?? `User ${c.otherUserId}`, // ✅ fallback
      otherUserOnline: !!c.otherUserOnline,
      lastMessage: c.lastMessage || "Start your conversation",
      lastMessageTime: c.lastMessageTime
        ? new Date(c.lastMessageTime).toLocaleTimeString()
        : null,
      unreadCount: Number(c.unreadCount || 0),
      status: "delivered",
    }));

    setConversations(mapped);
  }, [convData, user]);




  /* --------------------------- SW message wireup ------------------------- */

  useEffect(() => {
    if (!isOpen) return;
    if (!("serviceWorker" in navigator)) return;

    const handler = (evt: MessageEvent) => {
      const msg = evt.data || {};
      if (!msg.type) return;

      switch (msg.type) {
        case "PUSH_NOTIFICATION": {
          const p = msg.payload || {};
          const id: string =
            p.id || `${p.type || "general"}-${p.ts || Date.now()}`;

          setNotifications((prev) => {
            // de-dupe by id
            if (prev.some((n) => n.id === id)) return prev;
            const next: UINotification = {
              id,
              title: p.title || "Notification",
              message: p.body || "",
              url: p.url,
              type: p.type,
              timestamp: new Date(p.ts || Date.now()).toLocaleTimeString(),
              read: false,
            };
            return [next, ...prev].slice(0, 100); // simple cap
          });
          break;
        }

        case "NOTIFICATION_CLICKED": {
          const url = msg.url || "/explore?new=true";
          // Optionally mark matching notification(s) as read
          setNotifications((prev) =>
            prev.map((n) =>
              n.url === url ? { ...n, read: true } : n
            )
          );
          // Navigate
          window.location.href = url;
          break;
        }

        case "REQUEST_RESUBSCRIBE":
          // handled by unifiedNotifications on the page; nothing to do here
          break;

        case "RESUBSCRIBED":
          // handled by unifiedNotifications on the page; nothing to do here
          break;

        default:
          break;
      }
    };

    navigator.serviceWorker.addEventListener("message", handler);
    return () =>
      navigator.serviceWorker.removeEventListener("message", handler);
  }, [isOpen]);

  /* ------------------------------ Helpers -------------------------------- */

  const unreadNotifications = useMemo(
    () => notifications.filter((n) => !n.read).length,
    [notifications]
  );

  const totalUnread = useMemo(
    () => conversations.reduce((sum, c) => sum + (c.unreadCount || 0), 0),
    [conversations]
  );

  const getStatusIcon = (status: Status) => {
    switch (status) {
      case "seen":
        return <CheckCheck className="w-3 h-3 text-blue-500" />;
      case "delivered":
        return <CheckCheck className="w-3 h-3 text-gray-400" />;
      default:
        return <Clock className="w-3 h-3 text-gray-400" />;
    }
  };

  const handleConversationClick = (c: ConversationUI) => {
    window.location.href = `/chat/${c.favorId}`;
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  };

  /* ------------------------------- UI ------------------------------------ */

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md mx-auto max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold">Messages</DialogTitle>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex bg-slate-800 rounded-lg p-1 mb-4">
          <Button
            onClick={() => setActiveTab("messages")}
            variant={activeTab === "messages" ? "default" : "ghost"}
            size="sm"
            className={`flex-1 ${activeTab === "messages"
                ? "bg-favr-blue text-white"
                : "text-slate-400 hover:text-white"
              }`}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Messages
            {totalUnread > 0 && (
              <Badge variant="secondary" className="ml-2 bg-red-500 text-white">
                {totalUnread}
              </Badge>
            )}
          </Button>

          <Button
            onClick={() => setActiveTab("notifications")}
            variant={activeTab === "notifications" ? "default" : "ghost"}
            size="sm"
            className={`flex-1 ${activeTab === "notifications"
                ? "bg-favr-blue text-white"
                : "text-slate-400 hover:text-white"
              }`}
          >
            Notifications
            {unreadNotifications > 0 && (
              <Badge variant="secondary" className="ml-2 bg-red-500 text-white">
                {unreadNotifications}
              </Badge>
            )}
          </Button>
        </div>

        <div className="space-y-3 max-h-96 overflow-y-auto">
          {activeTab === "messages" ? (
            conversations.length > 0 ? (
              conversations.map((c) => (
                <div
                  key={`${c.chatRoomId}-${c.favorId}`} // ✅ stable unique key
                  onClick={() => handleConversationClick(c)}
                  className="p-3 bg-slate-800 rounded-lg cursor-pointer hover:bg-slate-700 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-white truncate">
                        {`${c.favorTitle}`}
                      </h4>
                      <p className="text-sm text-slate-400">
                        {`Chat with user ${c.otherUserName}`}
                      </p>
                    </div>
                    {c.unreadCount > 0 && (
                      <Badge className="bg-favr-blue text-white">
                        {c.unreadCount}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-300 truncate flex-1">
                      {c.lastMessage}
                    </p>
                    <div className="flex items-center space-x-2 ml-2">
                      <span className="text-xs text-slate-500">
                        {c.lastMessageTime ?? ""}
                      </span>
                      {getStatusIcon(c.status)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <MessageCircle className="w-12 h-12 text-slate-600 mx-auto mb-3" />
                <p className="text-slate-400">No conversations yet</p>
                <p className="text-sm text-slate-500 mt-1">
                  Start helping others to begin chatting
                </p>
              </div>
            )
          ) : notifications.length > 0 ? (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`p-3 rounded-lg ${n.read
                    ? "bg-slate-800"
                    : "bg-slate-700 border-l-4 border-favr-blue"
                  }`}
                onClick={() => {
                  markNotificationRead(n.id);
                  if (n.url) window.location.href = n.url;
                }}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <h4 className="font-medium text-white text-sm">
                      {n.title}
                    </h4>
                    <p className="text-sm text-slate-300 mt-1">{n.message}</p>
                  </div>
                  <span className="text-xs text-slate-500 ml-2">
                    {n.timestamp}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
                <span className="text-slate-500">🔔</span>
              </div>
              <p className="text-slate-400">No notifications</p>
              <p className="text-sm text-slate-500 mt-1">
                We’ll notify you when something happens
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
