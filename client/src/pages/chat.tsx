// ChatPage.tsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Send, CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { trackEvent } from "@/lib/analytics";
import { CompletionModal } from "@/components/completion-modal";
import type { FavorWithPoster } from "@shared/schema";
import { useChatSync } from "@/hooks/useChatSync"; // unified WS + REST hook

export default function ChatPage() {
  const [, params] = useRoute("/chat/:favorId");
  const [, negotiateParams] = useRoute("/negotiate/:favorId");
  const favorId = params?.favorId || negotiateParams?.favorId;
  const isNegotiation = !!negotiateParams?.favorId;
  const { user } = useAuth();
  const [, setLocation] = useLocation();

  const [chatRoomId, setChatRoomId] = useState<number | null>(null);
  const [showCompletionModal, setShowCompletionModal] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const { data: favor } = useQuery<FavorWithPoster>({
    queryKey: [`/api/favors/${favorId}`],
    enabled: !!favorId,
  });

  // Resolve chatRoomId from favorId (server returns chatRoomId in payload)
  useEffect(() => {
    let cancelled = false;
    const loadMeta = async () => {
      if (!favorId || !user) return;
      try {
        const res = await fetch(`/api/chat/${favorId}/messages`, {
          headers: { "user-id": String(user.id) },
        });
        const data = await res.json();
        if (cancelled) return;

        if (data?.chatRoomId) setChatRoomId(Number(data.chatRoomId));
      } catch {
        // ignore
      }
    };
    loadMeta();
    return () => {
      cancelled = true;
    };
  }, [favorId, user]);

  // Hook: real-time + REST sync (messages include { id, content, senderId, timestamp, status, isMe })
  const {
    messages,
    otherOnline,
    otherUserId,
    isTyping,
    sendMessage,
    markAllSeen,
    startTyping,
    stopTyping,
  } = useChatSync(
    chatRoomId && favorId && user
      ? {
        chatRoomId,
        favorId: Number(favorId),
        currentUserId: String(user.id),
      }
      : // Disabled state before we know chatRoomId
      ({} as any)
  );

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const formatTime = (iso: string) => {
    try {
      const d = new Date(iso);
      const h = d.getHours().toString().padStart(2, "0");
      const m = d.getMinutes().toString().padStart(2, "0");
      return `${h}:${m}`;
    } catch {
      return "Now";
    }
  };

  const partnerName = useMemo(() => {
    if (!favor || !user) return "Partner";
    const isUserPoster = String(user.id) === String(favor.posterId);
    return isUserPoster
      ? favor.helperName || favor.helperFirstName || "Helper"
      : favor.posterFirstName || favor.posterName || "Poster";
  }, [favor, user]);

  if (!favor || !favorId || !user) {
    return (
      <div className="w-full bg-slate-900 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-favr-blue mx-auto mb-4" />
          <p className="text-slate-400">Loading chat...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-slate-900 min-h-screen flex flex-col">
      {/* Header */}
      <header className="bg-slate-800 px-6 py-4 border-b border-slate-700 w-full">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.history.back()}
            className="text-slate-400 hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-semibold text-white text-sm">
              {isNegotiation ? `Negotiate: ${favor.title}` : favor.title}
            </h1>
            <p className="text-xs text-slate-400">
              Chat with{" "}
              <button
                onClick={() => {
                  trackEvent("user_profile_click", "engagement", "chat_header");
                  const isUserPoster =
                    String(user.id) === String(favor.posterId);
                  const partnerId =
                    otherUserId ?? (isUserPoster ? favor.helperId : favor.posterId);
                  setLocation(`/user/${partnerId}`);
                }}
                className="text-favr-blue hover:text-blue-300 transition-colors duration-200"
              >
                {partnerName}
              </button>{" "}
              <span className={otherOnline ? "text-green-400" : "text-orange-400"}>
                ({otherOnline ? "online" : "offline"})
              </span>
              {isTyping && (
                <span className="ml-2 text-blue-300 italic">typing…</span>
              )}
            </p>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4 w-full">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <p className="text-slate-400 text-sm">
              {isNegotiation
                ? "Start negotiating the price for this favor"
                : "Start your conversation about this favor"}
            </p>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex safari-message-fix ${msg.isMe ? "justify-end" : "justify-start"
              }`}
            style={{ minHeight: "40px", marginBottom: "8px" }}
          >
            <div
              className={`flex flex-col ${msg.isMe ? "items-end" : "items-start"
                }`}
            >
              {!msg.isMe && (
                <button
                  onClick={() => {
                    trackEvent(
                      "user_profile_click",
                      "engagement",
                      "chat_message"
                    );
                    const isUserPoster =
                      String(user.id) === String(favor.posterId);
                    const partnerId =
                      otherUserId ?? (isUserPoster ? favor.helperId : favor.posterId);
                    setLocation(`/user/${partnerId}`);
                  }}
                  className="text-xs text-slate-400 hover:text-favr-blue mb-1 transition-colors duration-200"
                >
                  {partnerName}
                </button>
              )}

              <div
                className={`max-w-xs px-3 py-2 rounded-2xl ${msg.isMe
                    ? "bg-favr-blue text-white rounded-br-md"
                    : "bg-slate-700 text-white rounded-bl-md"
                  }`}
                style={{
                  display: "block",
                  minHeight: "32px",
                  wordBreak: "break-word",
                }}
              >
                <p className="text-sm m-0 p-0">{msg.content || "[Empty message]"}</p>

                <div
                  className={`flex items-center gap-2 mt-1 text-xs ${msg.isMe ? "text-blue-100" : "text-slate-400"
                    }`}
                >
                  <span>{formatTime(msg.timestamp)}</span>
                  {msg.isMe && (
                    <span>
                      {msg.status === "seen"
                        ? "• seen"
                        : msg.status === "delivered"
                          ? "• delivered"
                          : "• sent"}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}

        <div ref={messagesEndRef} />
      </div>

      {/* Completion Button (only show for accepted favors) */}
      {favor?.status === "accepted" && (
        <div className="px-6 py-3 bg-slate-800 border-t border-slate-700">
          <Button
            onClick={() => {
              trackEvent(
                "completion_modal_opened",
                "completion",
                "chat_interface",
                parseInt(String(favorId) || "0", 10)
              );
              setShowCompletionModal(true);
            }}
            className="w-full bg-green-600 hover:bg-green-700 text-white"
          >
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Mark as Completed
          </Button>
        </div>
      )}

      {/* Composer */}
      <ChatComposer
        disabled={!chatRoomId}
        placeholder={isNegotiation ? "Make your offer..." : "Type a message..."}
        onSend={async (text) => {
          await sendMessage(text);
        }}
        onFocusSeen={() => markAllSeen()}
        onTypingStart={() => startTyping()}
        onTypingStop={() => stopTyping()}
      />

      {/* Completion Modal */}
      {showCompletionModal && favor && user && (
        <CompletionModal
          isOpen={showCompletionModal}
          onClose={() => setShowCompletionModal(false)}
          favorId={parseInt(String(favorId) || "0", 10)}
          favorTitle={favor.title}
          originalPrice={favor.price}
          isHelper={favor.helperId === user.id}
          userId={user.id}
        />
      )}
    </div>
  );
}

function ChatComposer({
  disabled,
  placeholder,
  onSend,
  onFocusSeen,
  onTypingStart,
  onTypingStop,
}: {
  disabled?: boolean;
  placeholder?: string;
  onSend: (text: string) => Promise<void> | void;
  onFocusSeen: () => void;
  onTypingStart: () => void;
  onTypingStop: () => void;
}) {
  const [message, setMessage] = useState("");

  return (
    <div className="p-6 border-t border-slate-700 bg-slate-800 w-full">
      <div className="flex space-x-4">
        <Input
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          placeholder={placeholder || "Type a message..."}
          value={message}
          disabled={disabled}
          onFocus={onFocusSeen}
          onChange={(e) => {
            setMessage(e.target.value);
            onTypingStart();
          }}
          onBlur={() => onTypingStop()}
          onKeyDown={(e) => {
            if (e.key === "Enter" && message.trim()) {
              const text = message.trim();
              setMessage("");
              onSend(text);
              onTypingStop();
            }
          }}
          className="flex-1 bg-slate-700 border-slate-600 text-white placeholder-slate-400"
          style={{
            fontSize: "16px",
            WebkitAppearance: "none",
            appearance: "none",
            minHeight: "44px",
          }}
        />
        <Button
          onClick={() => {
            if (!message.trim()) return;
            const text = message.trim();
            setMessage("");
            onSend(text);
            onTypingStop();
          }}
          disabled={!message.trim() || disabled}
          className="bg-favr-blue hover:bg-blue-600 text-white min-h-[44px] disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
