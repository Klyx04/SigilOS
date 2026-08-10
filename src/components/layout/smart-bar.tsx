"use client";

import { useState, useEffect } from "react";
import { PresenceModal } from "./presence-modal";
import { getActivePresence } from "@/server/actions/presence-actions";
import { useParams } from "next/navigation";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface SmartBarProps {
    memberCount?: number;
    onlineCount?: number;
}

export function SmartBar({ memberCount, onlineCount }: SmartBarProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeUsers, setActiveUsers] = useState<any[]>([]);
    const [onlineUsers, setOnlineUsers] = useState<any[]>([]);
    const { guildId } = useParams() as { guildId: string };

    const [liveOnlineCount, setLiveOnlineCount] = useState(onlineCount);

    // Sync if server sends a new onlineCount
    useEffect(() => {
        if (onlineCount !== undefined) {
            setLiveOnlineCount(onlineCount);
        }
    }, [onlineCount]);

    // Periodically fetch real presence: count + small avatar stack (direction 2026 §9.2)
    useEffect(() => {
        let mounted = true;
        const fetchLivePresence = async () => {
            if (!guildId) return;
            const result = await getActivePresence(guildId, 6);
            if (result.success && mounted) {
                if (result.totalActive !== undefined) setLiveOnlineCount(result.totalActive);
                setOnlineUsers(result.data || []);
            }
        };

        fetchLivePresence();
        const intervalId = setInterval(fetchLivePresence, 60000);
        return () => {
            mounted = false;
            clearInterval(intervalId);
        };
    }, [guildId]);

    return (
        <div className="hidden md:flex items-center gap-1.5 p-1">


            {/* DIVIDER */}
            {(memberCount !== undefined || onlineCount !== undefined) && (
                <div className="h-4 w-px bg-white/10 mx-0.5" />
            )}

            {/* 2. Guild Stats (Clickable) */}
            {(memberCount !== undefined || onlineCount !== undefined) && (
                <div className="flex items-center px-1">
                    <button
                        onClick={async () => {
                            setIsModalOpen(true);
                            // Fetch up to 50 active users to fill the modal
                            const result = await getActivePresence(guildId, 50);
                            if (result.success) {
                                setActiveUsers(result.data);
                                if (result.totalActive !== undefined) {
                                    setLiveOnlineCount(result.totalActive);
                                }
                            }
                        }}
                        className="flex items-center gap-2 rounded-lg px-2 py-1 hover:bg-white/5 transition-colors group/stats"
                    >
                        {/* Avatars en ligne (stack compacte) */}
                        <div className="flex -space-x-2 items-center">
                            {onlineUsers.slice(0, 3).map((u) => (
                                <Avatar key={u.id} className="h-7 w-7 ring-2 ring-background">
                                    <AvatarImage src={u.image || ""} alt={u.name || ""} />
                                    <AvatarFallback className="bg-zinc-800 text-[9px] text-zinc-300">
                                        {(u.name || "??").slice(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>
                            ))}
                            {onlineUsers.length === 0 && (
                                <div className="h-7 w-7 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-[10px] text-zinc-500">—</div>
                            )}
                        </div>

                        {/* Compteur */}
                        <div className="flex items-center gap-1 text-[12px] font-semibold text-zinc-300">
                            <span className="text-emerald-400" suppressHydrationWarning>{liveOnlineCount ?? 0}</span>
                            <span className="text-zinc-700">/</span>
                            <span>{memberCount ?? 0}</span>
                        </div>
                    </button>
                </div>
            )}

            <PresenceModal
                isOpen={isModalOpen}
                onOpenChange={setIsModalOpen}
                users={activeUsers}
            />
        </div>
    );
}
