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

export function PresenceProvider({ children, guildId, isActive = false }: { children: React.ReactNode; guildId: string; isActive?: boolean }) {
    const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
    const [isConnected, setIsConnected] = useState(false);
    const [lastMessage, setLastMessage] = useState<ChatMessage | null>(null);

    const esRef = useRef<EventSource | null>(null);
    // Track isActive without reconnecting — only used to report status to the stream
    const isActiveRef = useRef(isActive);
    // Track whether we've sent the join message this session
    const hasJoinedRef = useRef(false);

    // Update isActive ref without reconnecting
    useEffect(() => {
        isActiveRef.current = isActive;
    }, [isActive]);

    useEffect(() => {
        if (!guildId) return;

        // Only connect once per guildId
        // isActive is NOT in deps — minimize/maximize does NOT reconnect
        const connect = (isReconnect = false) => {
            if (esRef.current) {
                esRef.current.close();
                esRef.current = null;
            }

            // Only reset join flag on initial connect, NOT on auto-reconnect after error
            // This prevents spam of "X a rejoint" messages on network blips
            if (!isReconnect) {
                hasJoinedRef.current = false;
            }
            const connectionId = Math.random().toString(36).substring(2, 15);
            // Pass isActive at connection time only — minimize shouldn't retrigger
            const es = new EventSource(`/api/chat/guild/${guildId}/stream?connectionId=${connectionId}&active=true`);
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
                    console.error("[PresenceProvider] SSE error", e);
                }
            };

            es.onerror = () => {
                setIsConnected(false);
                if (esRef.current) {
                    esRef.current.close();
                    esRef.current = null;
                }
                // isReconnect=true: preserve hasJoinedRef to avoid spam on network blip
                setTimeout(() => connect(true), 3000);
            };
        };

        connect();
        return () => {
            if (esRef.current) {
                esRef.current.close();
                esRef.current = null;
            }
        };
    }, [guildId]); // Only reconnect when guildId changes — NOT when isActive changes

    return (
        <PresenceContext.Provider value={{ onlineUsers, isConnected, lastMessage }}>
            {children}
        </PresenceContext.Provider>
    );
}
