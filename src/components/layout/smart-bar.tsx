"use client";

import { useState, useEffect } from "react";
import { Clock, Calendar, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { PresenceModal } from "./presence-modal";
import { getActivePresence } from "@/server/actions/presence-actions";
import { useParams } from "next/navigation";

interface SmartBarProps {
    memberCount?: number;
    onlineCount?: number;
}

export function SmartBar({ memberCount, onlineCount }: SmartBarProps) {
    const [time, setTime] = useState<string>("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeUsers, setActiveUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const { guildId } = useParams() as { guildId: string };

    // Dofus Time (France/Paris)
    useEffect(() => {
        const updateTime = () => {
            const now = new Date();
            // Force Paris timezone
            const timeString = now.toLocaleTimeString("fr-FR", {
                timeZone: "Europe/Paris",
                hour: "2-digit",
                minute: "2-digit",
            });
            setTime(timeString);
        };

        updateTime();
        const interval = setInterval(updateTime, 1000);
        return () => clearInterval(interval);
    }, []);

    const [liveOnlineCount, setLiveOnlineCount] = useState(onlineCount);

    // Sync if server sends a new onlineCount
    useEffect(() => {
        if (onlineCount !== undefined) {
            setLiveOnlineCount(onlineCount);
        }
    }, [onlineCount]);

    // Periodically fetch real presence to stay fully in sync
    useEffect(() => {
        let mounted = true;
        const fetchLivePresence = async () => {
            if (!guildId) return;
            // Limit 1 to save bandwidth as we only need the count here
            const result = await getActivePresence(guildId, 1);
            if (result.success && mounted && result.totalActive !== undefined) {
                setLiveOnlineCount(result.totalActive);
            }
        };

        const timeoutId = setTimeout(fetchLivePresence, 2000);
        const intervalId = setInterval(fetchLivePresence, 60000); // 1 minute
        return () => {
            mounted = false;
            clearTimeout(timeoutId);
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
                            setIsLoading(true);
                            // Fetch up to 50 active users to fill the modal
                            const result = await getActivePresence(guildId, 50);
                            if (result.success) {
                                setActiveUsers(result.data);
                                if (result.totalActive !== undefined) {
                                    setLiveOnlineCount(result.totalActive);
                                }
                            }
                            setIsLoading(false);
                        }}
                        className="flex flex-col items-center justify-center leading-none px-2 py-1 rounded-lg hover:bg-white/5 transition-colors group/stats active:scale-95"
                    >
                        <span className="text-[10px] text-zinc-500 font-black uppercase tracking-widest scale-90 mb-0.5 group-hover/stats:text-indigo-400 transition-colors">Membres</span>
                        <div className="flex items-center gap-1 text-[11px] font-black text-zinc-300">
                            <span className="text-emerald-400 drop-shadow-[0_0_8px_rgba(16,185,129,0.3)]">{liveOnlineCount ?? 0}</span>
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

            {/* 3. Server Time (Pure Flat) */}
            <div className="flex items-center gap-2 px-3 text-[11px] font-black text-zinc-300 min-w-[70px] justify-center group/time">
                <Clock className="w-3.5 h-3.5 text-indigo-400 group-hover/time:rotate-12 transition-transform" />
                <span className="tracking-tighter font-mono">{time || "--:--"}</span>
            </div>
        </div>
    );
}
