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

export interface UseChatSyncOptions {
    chatRoomId: number;          // server room id
    favorId: number;             // favor id (for WS join)
    currentUserId: string;       // logged in user id
    wsUrl?: string;              // optional custom ws url
}

// NOTE: opts is optional; hook gracefully no-ops until enabled.
export function useChatSync(opts?: Partial<UseChatSyncOptions>) {
    // Pull values safely out of an optional object
    const chatRoomId = opts?.chatRoomId ?? null;
    const favorId = opts?.favorId ?? null;
    const currentUserId = opts?.currentUserId ?? null;
    const wsUrl =
        opts?.wsUrl ??
        (typeof window !== "undefined"
            ? `${location.origin.replace(/^http/, "ws")}/ws`
            : "");

    // Enabled only when we have everything
    const enabled = Boolean(chatRoomId && favorId && currentUserId);

    const [messages, setMessages] = useState<ChatMessageVM[]>([]);
    const [otherOnline, setOtherOnline] = useState<boolean>(false);
    const [otherUserId, setOtherUserId] = useState<string | null>(null);
    const [isConnected, setIsConnected] = useState<boolean>(false);
    const [isTyping, setIsTyping] = useState<boolean>(false);

    const wsRef = useRef<WebSocket | null>(null);
    const connectingRef = useRef(false);

    const authHeaders = useMemo(() => {
        const h: Record<string, string> = { "Content-Type": "application/json" };
        if (currentUserId) h["user-id"] = currentUserId;
        return h;
    }, [currentUserId]);

    /* -------------------------- HTTP helpers -------------------------- */

    const postJSON = useCallback(
        async (url: string, body?: any) => {
            if (!enabled) return {};
            const res = await fetch(url, {
                method: "POST",
                headers: authHeaders,
                body: body ? JSON.stringify(body) : undefined,
            });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            try {
                return await res.json();
            } catch {
                return {};
            }
        },
        [enabled, authHeaders]
    );

    const getJSON = useCallback(
        async (url: string) => {
            if (!enabled) return null;
            const res = await fetch(url, { headers: authHeaders });
            if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
            return res.json();
        },
        [enabled, authHeaders]
    );

    /* ----------------------- REST sync & presence ---------------------- */

    const fetchMessages = useCallback(async () => {
        if (!enabled || !chatRoomId || !currentUserId) return;
        const data = (await getJSON(`/api/chat/messages/${chatRoomId}`)) as ChatMessageVM[] | null;
        if (!data) return;

        setMessages(data);

        // auto-ack "sent" → "delivered"
        const toDeliver = data.filter(
            (m) => m.recipientId === currentUserId && m.status === "sent"
        );
        if (toDeliver.length) {
            await Promise.allSettled(
                toDeliver.map((m) => postJSON(`/api/chat/messages/${m.id}/delivered`))
            );
        }
    }, [enabled, chatRoomId, currentUserId, getJSON, postJSON]);

    const fetchPresenceMeta = useCallback(async () => {
        if (!enabled || !favorId) return;
        const data = await getJSON(`/api/chat/${favorId}/messages`);
        if (!data) return;
        if (data.otherOnline !== undefined) setOtherOnline(!!data.otherOnline);
        if (data.otherUserId) setOtherUserId(String(data.otherUserId));
    }, [enabled, favorId, getJSON]);

    const markAllSeen = useCallback(async () => {
        if (!enabled || !messages.length || !currentUserId) return;
        const unseen = messages.filter(
            (m) => m.recipientId === currentUserId && m.status !== "seen"
        );
        if (!unseen.length) return;

        await Promise.allSettled(
            unseen.map((m) => postJSON(`/api/chat/messages/${m.id}/seen`))
        );

        setMessages((prev) =>
            prev.map((m) =>
                m.recipientId === currentUserId ? { ...m, status: "seen" } : m
            )
        );
    }, [enabled, messages, currentUserId, postJSON]);

    /* --------------------------- WebSocket ---------------------------- */

    const ensureWs = useCallback(() => {
        if (!enabled || !wsUrl) return;
        if (connectingRef.current || wsRef.current?.readyState === WebSocket.OPEN)
            return;

        connectingRef.current = true;
        const ws = new WebSocket(wsUrl);

        ws.onopen = () => {
            setIsConnected(true);
            connectingRef.current = false;
            ws.send(JSON.stringify({ type: "register_user", userId: currentUserId }));
            ws.send(JSON.stringify({ type: "join_chat", favorId, userId: currentUserId }));
        };

        ws.onmessage = (ev) => {
            try {
                const msg = JSON.parse(ev.data);
                switch (msg.type) {
                    case "chat_history": {
                        if (!messages.length && Array.isArray(msg.messages)) {
                            const fromWs: ChatMessageVM[] = msg.messages.map((m: any) => ({
                                id: String(m.id),
                                content: String(m.content ?? ""),
                                senderId: String(m.senderId),
                                recipientId: String(m.recipientId ?? ""),
                                timestamp: m.timestamp ?? new Date().toISOString(),
                                status: (m.status ?? "sent") as MessageStatus,
                                type: (m.type ?? "text") as MessageType,
                                isMe: String(m.senderId) === currentUserId,
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
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: String(m.id),
                                content: String(m.content ?? ""),
                                senderId: String(m.senderId),
                                recipientId: String(m.recipientId ?? ""),
                                timestamp: m.timestamp ?? new Date().toISOString(),
                                status: (m.status ?? "sent") as MessageStatus,
                                type: (m.type ?? "text") as MessageType,
                                isMe: String(m.senderId) === currentUserId,
                            },
                        ]);
                        break;
                    }
                    case "message_sent": {
                        const m = msg.message;
                        if (!m) break;
                        setMessages((prev) => [
                            ...prev,
                            {
                                id: String(m.id),
                                content: String(m.content ?? ""),
                                senderId: String(m.senderId),
                                recipientId: String(m.recipientId ?? ""),
                                timestamp: m.timestamp ?? new Date().toISOString(),
                                status: (m.status ?? "sent") as MessageStatus,
                                type: (m.type ?? "text") as MessageType,
                                isMe: true,
                            },
                        ]);
                        break;
                    }
                    case "message_seen": {
                        const { messageId } = msg;
                        setMessages((prev) =>
                            prev.map((m) => (m.id === messageId ? { ...m, status: "seen" } : m))
                        );
                        break;
                    }
                    case "user_online":
                        if (msg.userId && msg.userId === otherUserId) setOtherOnline(true);
                        break;
                    case "user_offline":
                        if (msg.userId && msg.userId === otherUserId) setOtherOnline(false);
                        break;
                    case "typing":
                        if (msg.userId && msg.userId !== currentUserId) {
                            setIsTyping(!!msg.isTyping);
                        }
                        break;
                }
            } catch {
                /* ignore */
            }
        };

        ws.onclose = () => {
            setIsConnected(false);
            wsRef.current = null;
            // retry only if still enabled
            if (enabled) setTimeout(() => ensureWs(), 1500);
        };

        ws.onerror = () => {
            try {
                ws.close();
            } catch { }
        };

        wsRef.current = ws;
    }, [enabled, wsUrl, currentUserId, favorId, messages.length, otherUserId]);

    /* ----------------------------- API -------------------------------- */

    const sendMessage = useCallback(
        async (content: string) => {
            const trimmed = content.trim();
            if (!enabled || !trimmed) return;

            const ws = wsRef.current;
            if (ws && ws.readyState === WebSocket.OPEN) {
                ws.send(
                    JSON.stringify({
                        type: "send_message",
                        favorId,
                        senderId: currentUserId,
                        content: trimmed,
                    })
                );
                return;
            }

            // REST fallback
            await postJSON(`/api/chat/${chatRoomId}/messages`, { content: trimmed });
            await fetchMessages();
        },
        [enabled, favorId, currentUserId, postJSON, chatRoomId, fetchMessages]
    );

    const startTyping = useCallback(() => {
        if (!enabled) return;
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "typing", favorId, userId: currentUserId, isTyping: true }));
        }
    }, [enabled, favorId, currentUserId]);

    const stopTyping = useCallback(() => {
        if (!enabled) return;
        const ws = wsRef.current;
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: "typing", favorId, userId: currentUserId, isTyping: false }));
        }
    }, [enabled, favorId, currentUserId]);

    /* ---------------------------- Effects ------------------------------ */

    useEffect(() => {
        if (!enabled) return;
        fetchMessages();
        fetchPresenceMeta();
    }, [enabled, fetchMessages, fetchPresenceMeta]);

    useEffect(() => {
        if (!enabled) return;
        ensureWs();
        return () => {
            try {
                wsRef.current?.close();
            } catch { }
        };
    }, [enabled, ensureWs]);

    useEffect(() => {
        if (!enabled) return;
        const onFocus = () => void markAllSeen();
        window.addEventListener("focus", onFocus);
        return () => window.removeEventListener("focus", onFocus);
    }, [enabled, markAllSeen]);

    return {
        // state
        messages,
        otherOnline,
        otherUserId,
        isConnected,
        isTyping,
        // actions
        fetchMessages,
        sendMessage,
        markAllSeen,
        startTyping,
        stopTyping,
    };
}
