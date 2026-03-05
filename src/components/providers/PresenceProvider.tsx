"use client";

import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
import { type ChatMessage } from "@/lib/chat-helpers";

type OnlineUser = { id: string; name: string; image?: string };

interface PresenceContextType {
    onlineUsers: OnlineUser[];
    isConnected: boolean;
    lastMessage: ChatMessage | null;
}

const PresenceContext = createContext<PresenceContextType>({
    onlineUsers: [],
    isConnected: false,
    lastMessage: null,
});

export const usePresence = () => useContext(PresenceContext);

export function PresenceProvider({
    children,
    guildId,
    isActive = false,
}: {
    children: React.ReactNode;
    guildId: string;
    isActive?: boolean;
}) {
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<ChatMessage | null>(null);

    const esRef = useRef<EventSource | null>(null);
    const connectionIdRef = useRef<string>(Math.random().toString(36).slice(2));
    // Track whether we've sent the join message this session
    const hasJoinedRef = useRef(false);

    // Main SSE connection — reconnects only when guildId changes
    const connect = useCallback((isReconnect = false) => {
        if (esRef.current) {
            esRef.current.close();
            esRef.current = null;
        }

        if (!isReconnect) {
            hasJoinedRef.current = false;
            connectionIdRef.current = Math.random().toString(36).slice(2);
        }

        // Pass current isActive at connection time
        const es = new EventSource(
            `/api/chat/guild/${guildId}/stream?connectionId=${connectionIdRef.current}&active=${isActive}`
        );
        esRef.current = es;

        es.onopen = () => {
            setIsConnected(true);
            hasJoinedRef.current = true;
        };

        es.onmessage = (event) => {
            try {
                const msg = JSON.parse(event.data) as ChatMessage;
                setLastMessage({ ...msg, _ts: Date.now() });

                if (msg.type === "presence" && msg.onlineUsers) {
                    setOnlineUsers(msg.onlineUsers);
                }
            } catch (e) {
                console.error("[PresenceProvider] SSE parse error", e);
            }
        };

        es.onerror = () => {
            setIsConnected(false);
            if (esRef.current) {
                esRef.current.close();
                esRef.current = null;
            }
            // Auto-reconnect after error — preserve connectionId to avoid join spam
            setTimeout(() => connect(true), 3000);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [guildId]); // only reconnect when guildId changes

    // Initial connect + cleanup
    useEffect(() => {
        if (!guildId) return;
        connect(false);
        return () => {
            if (esRef.current) {
                esRef.current.close();
                esRef.current = null;
            }
        };
    }, [guildId, connect]);

    // When isActive toggles (minimize/maximize/close), PATCH the presence status
    // This keeps Redis in sync without a full reconnect
    useEffect(() => {
        if (!guildId || !hasJoinedRef.current) return;
        // Fire-and-forget PATCH to update our presence status in Redis
        fetch(`/api/chat/guild/${guildId}/presence`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                connectionId: connectionIdRef.current,
                isActive,
            }),
        }).catch(() => { /* silent — non-critical */ });
    }, [isActive, guildId]);

    return (
        <PresenceContext.Provider value={{ onlineUsers, isConnected, lastMessage }}>
            {children}
        </PresenceContext.Provider>
    );
}
