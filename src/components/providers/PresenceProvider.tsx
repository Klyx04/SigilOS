"use client";

import { createContext, useContext, useEffect, useState, useRef } from "react";
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

    useEffect(() => {
        if (!guildId) return;

        const connect = () => {
            if (esRef.current) {
                esRef.current.close();
                esRef.current = null;
            }

            const connectionId = Math.random().toString(36).substring(2, 15);
            const es = new EventSource(`/api/chat/guild/${guildId}/stream?connectionId=${connectionId}&active=${isActive}`);
            esRef.current = es;

            es.onopen = () => setIsConnected(true);

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
                setTimeout(connect, 3000);
            };
        };

        connect();
        return () => {
            if (esRef.current) {
                esRef.current.close();
                esRef.current = null;
            }
        };
    }, [guildId, isActive]); // Reconnect when active status changes to trigger join/leave message on server

    return (
        <PresenceContext.Provider value={{ onlineUsers, isConnected, lastMessage }}>
            {children}
        </PresenceContext.Provider>
    );
}
