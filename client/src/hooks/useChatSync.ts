// useChatSync.ts
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type MessageStatus = "sent" | "delivered" | "seen";
type MessageType = "text" | "system";

export interface ChatMessageVM {
    id: string;
    content: string;
    senderId: string;
    recipientId: string;
    timestamp: string; // ISO
    status: MessageStatus;
    type: MessageType;
    isMe: boolean;
}

interface UseChatSyncOptions {
    /** Room id returned by /api/chat/conversations or /api/chat/messages/:chatRoomId */
    chatRoomId: number;
    /** Favor id (needed for WebSocket join/send per your WS API) */
    favorId: number;
    /** The logged-in user id (string to match backend) */
    currentUserId: string;
    /** Optional: WS URL (defaults to same origin /ws) */
    wsUrl?: string;
}

export function useChatSync({
    chatRoomId,
    favorId,
    currentUserId,
    wsUrl = (typeof window !== "undefined" ? `${location.origin.replace(/^http/, "ws")}/ws` : ""),
}: UseChatSyncOptions) {
    const [messages, setMessages] = useState<ChatMessageVM[]>([]);
    const [otherOnline, setOtherOnline] = useState<boolean>(false);
    const [otherUserId, setOtherUserId] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isTyping, setIsTyping] = useState<boolean>(false);

    const wsRef = useRef<WebSocket | null>(null);
    const connectingRef = useRef(false);

    const authHeaders = useMemo(
        () => ({ "Content-Type": "application/json", "user-id": currentUserId }),
        [currentUserId]
    );

    // --- Helpers --------------------------------------------------------------

    const postJSON = useCallback(
        async (url: string, body?: any) => {
            const res = await fetch(url, {
                method: "POST",
                headers: authHeaders,
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            return res.json().catch(() => ({}));
        },
        [authHeaders]
    );

    const getJSON = useCallback(
        async (url: string) => {
            const res = await fetch(url, { headers: authHeaders });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            return res.json();
        },
        [authHeaders]
    );

    // --- Fetch messages (by chatRoomId) + auto mark delivered ----------------
    const fetchMessages = useCallback(async () => {
        // Prefer the chatRoomId endpoint (simple array). If you prefer favorId, swap the URL.
        const data: ChatMessageVM[] = await getJSON(`/api/chat/messages/${chatRoomId}`);

        setMessages(data);

        // Auto-ack "sent" → "delivered" for my incoming messages
        const toDeliver = data.filter(
            (m) => m.recipientId === currentUserId && m.status === "sent"
        );
        if (toDeliver.length) {
            await Promise.allSettled(
                toDeliver.map((m) => postJSON(`/api/chat/messages/${m.id}/delivered`))
            );
        }
    }, [chatRoomId, currentUserId, getJSON, postJSON]);

    // --- Fetch meta (otherOnline/otherUserId) using favorId endpoint ----------
    const fetchPresenceMeta = useCallback(async () => {
        // This endpoint returns richer payload incl. otherOnline
        const data = await getJSON(`/api/chat/${favorId}/messages`);
        if (data?.otherOnline !== undefined) setOtherOnline(!!data.otherOnline);
        if (data?.otherUserId) setOtherUserId(String(data.otherUserId));
    }, [favorId, getJSON]);

    // --- Mark all incoming (to me) messages as seen ---------------------------
    const markAllSeen = useCallback(async () => {
        if (!messages.length) return;
        const unseen = messages.filter(
            (m) => m.recipientId === currentUserId && m.status !== "seen"
        );
        if (!unseen.length) return;

        await Promise.allSettled(
            unseen.map((m) => postJSON(`/api/chat/messages/${m.id}/seen`))
        );

        // Optimistic update
        setMessages((prev) =>
            prev.map((m) =>
                m.recipientId === currentUserId ? { ...m, status: "seen" } : m
            )
        );
    }, [messages, currentUserId, postJSON]);

    // --- WebSocket connection / events ---------------------------------------
    const ensureWs = useCallback(() => {
        if (connectingRef.current || wsRef.current?.readyState === WebSocket.OPEN) return;
        if (!wsUrl) return;

        connectingRef.current = true;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            setIsConnected(true);
            connectingRef.current = false;
            // Register and join
            ws.send(JSON.stringify({ type: "register_user", userId: currentUserId }));
            ws.send(JSON.stringify({ type: "join_chat", favorId, userId: currentUserId }));
        };

        ws.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data);

                switch (msg.type) {
                    case "chat_history": {
                        // history arrives when we join via WS; we still prefer REST as source of truth
                        // but if we have nothing, adopt it
                        if (!messages.length && Array.isArray(msg.messages)) {
                            const fromWs: ChatMessageVM[] = msg.messages.map((m: any) => ({
                                id: m.id,
                                content: m.content ?? "",
                                senderId: m.senderId,
                                recipientId: m.recipientId ?? "",
                                timestamp: m.timestamp ?? new Date().toISOString(),
                                status: (m.status ?? "sent") as MessageStatus,
                                type: (m.type ?? "text") as MessageType,
                                isMe: m.senderId === currentUserId,
                            }));
                            setMessages(fromWs);
                        }
                        if (msg.presence?.otherOnline !== undefined) {
                            setOtherOnline(!!msg.presence.otherOnline);
                        }
                        break;
                    }

                    case "new_message": {
                        const m = msg.message;
                        if (!m) break;
                        const vm: ChatMessageVM = {
                            id: String(m.id),
                            content: String(m.content ?? ""),
                            senderId: String(m.senderId),
                            recipientId: String(m.recipientId ?? ""),
                            timestamp: m.timestamp ?? new Date().toISOString(),
                            status: (m.status ?? "sent") as MessageStatus,
                            type: (m.type ?? "text") as MessageType,
                            isMe: String(m.senderId) === currentUserId,
                        };
                        setMessages((prev) => [...prev, vm]);
                        break;
                    }

                    case "message_sent": {
                        const m = msg.message;
                        if (!m) break;
                        const vm: ChatMessageVM = {
                            id: String(m.id),
                            content: String(m.content ?? ""),
                            senderId: String(m.senderId),
                            recipientId: String(m.recipientId ?? ""),
                            timestamp: m.timestamp ?? new Date().toISOString(),
                            status: (m.status ?? "sent") as MessageStatus,
                            type: (m.type ?? "text") as MessageType,
                            isMe: true,
                        };
                        setMessages((prev) => [...prev, vm]);
                        break;
                    }

                    case "message_seen": {
                        const { messageId } = msg;
                        setMessages((prev) =>
                            prev.map((m) => (m.id === messageId ? { ...m, status: "seen" } : m))
                        );
                        break;
                    }

                    case "user_online": {
                        if (msg.userId && msg.userId === otherUserId) setOtherOnline(true);
                        break;
                    }

                    case "user_offline": {
                        if (msg.userId && msg.userId === otherUserId) setOtherOnline(false);
                        break;
                    }

                    case "typing": {
                        // Only reflect typing for the other user
                        if (msg.userId && msg.userId !== currentUserId) {
                            setIsTyping(!!msg.isTyping);
                        }
                        break;
                    }
                }
            } catch { }
        };

        ws.onclose = () => {
            setIsConnected(false);
            wsRef.current = null;
            setTimeout(() => ensureWs(), 1500); // simple retry
        };

        ws.onerror = () => {
            try {
                ws.close();
            } catch { }
        };

        wsRef.current = ws;
    }, [wsUrl, currentUserId, favorId, messages.length, otherUserId]);

    // --- Send message (WS first, REST fallback) --------------------------------
    const sendMessage = useCallback(
        async (content: string) => {
            const trimmed = content.trim();
            if (!trimmed) return;

            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: "send_message", favorId, senderId: currentUserId, content: trimmed }));
                return;
            }

            // REST fallback (requires chatRoomId)
            await postJSON(`/api/chat/${chatRoomId}/messages`, { content: trimmed });
            // Optimistic fetch to reflect new message if WS not connected
            await fetchMessages();
        },
        [favorId, currentUserId, postJSON, chatRoomId, fetchMessages]
    );

    // --- Typing indicators -----------------------------------------------------
    const startTyping = useCallback(() => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "typing", favorId, userId: currentUserId, isTyping: true }));
        }
    }, [favorId, currentUserId]);

    const stopTyping = useCallback(() => {
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "typing", favorId, userId: currentUserId, isTyping: false }));
        }
    }, [favorId, currentUserId]);

    // --- Effects ---------------------------------------------------------------
    useEffect(() => {
        fetchMessages();
        fetchPresenceMeta();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatRoomId, favorId]);

    useEffect(() => {
        ensureWs();
        return () => {
            try {
                wsRef.current?.close();
            } catch { }
        };
    }, [ensureWs]);

    // Mark seen on window focus (you can also call markAllSeen manually when scrolled to bottom)
    useEffect(() => {
        const onFocus = () => void markAllSeen();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [markAllSeen]);

    return {
        messages,
        otherOnline,
        otherUserId,
        isConnected,
        isTyping,

        fetchMessages,
        sendMessage,
        markAllSeen,
        startTyping,
        stopTyping,
    };
}
