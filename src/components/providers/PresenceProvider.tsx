"use client";

import { createContext, useContext, useEffect, useState, useRef, useCallback } from "react";
type ChatMessage = any;

type OnlineUser = { id: string; name: string; image?: string };

// #186 — Deux contexts séparés pour éviter le re-render cascade :
// - PresenceContext (stable) : onlineUsers + isConnected → mise à jour rare
// - ChatMessageContext (volatile) : lastMessage → mise à jour à chaque message SSE
//   Seuls les composants qui consomment le chat re-rendent à chaque message.

interface PresenceContextType {
    onlineUsers: OnlineUser[];
    isConnected: boolean;
}

interface ChatMessageContextType {
    lastMessage: ChatMessage | null;
}

const PresenceContext = createContext<PresenceContextType>({
    onlineUsers: [],
    isConnected: false,
});

const ChatMessageContext = createContext<ChatMessageContextType>({
    lastMessage: null,
});

export const usePresence = () => useContext(PresenceContext);
export const useChatMessage = () => useContext(ChatMessageContext);

/** @deprecated — utiliser usePresence() + useChatMessage() séparément */
export const usePresenceLegacy = () => ({
    ...useContext(PresenceContext),
    ...useContext(ChatMessageContext),
});

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
                // lastMessage volatile → ChatMessageContext (re-render isolé)
                setLastMessage({ ...msg, _ts: Date.now() });

                if (msg.type === "presence" && msg.onlineUsers) {
                    // onlineUsers stable → PresenceContext (re-render rare)
                    setOnlineUsers(msg.onlineUsers);
                }
            } catch {
                // SSE parse error — non-critique, silencieux en prod
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

    // When isActive toggles, PATCH the presence status (keeps Redis in sync without full reconnect)
    useEffect(() => {
        if (!guildId || !hasJoinedRef.current) return;
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
        // PresenceContext (stable) → wrap externe, re-render seulement si onlineUsers/isConnected change
        <PresenceContext.Provider value={{ onlineUsers, isConnected }}>
            {/* ChatMessageContext (volatile) → wrap interne, re-render à chaque message SSE */}
            <ChatMessageContext.Provider value={{ lastMessage }}>
                {children}
            </ChatMessageContext.Provider>
        </PresenceContext.Provider>
    );
}
