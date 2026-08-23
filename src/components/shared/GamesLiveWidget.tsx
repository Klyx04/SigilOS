"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { buildWsUrl } from "@/lib/socket-utils";
import { Eye, Users, Gamepad2, X, Loader2, Sparkles, Trophy, Play, Activity, Terminal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

interface LiveRoom {
    id?: string;
    roomId?: string;
    hostName?: string;
    playerCount: number;
    maxPlayers: number;
    // Only Geoguesser remains after Gartic/Skribbl removal
    gameType: 'guesser';
}

interface GamesLiveWidgetProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    onRoomCountChange?: (count: number) => void;
    guildId?: string;
}

export function GamesLiveWidget({ isOpen, onOpenChange, onRoomCountChange, guildId: propGuildId }: GamesLiveWidgetProps) {
    const params = useParams();
    const guildId = propGuildId || params.guildId as string;
    const router = useRouter();
    const [rooms, setRooms] = useState<LiveRoom[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);

    const getWsUrl = useCallback((): string => {
        return buildWsUrl();
    }, []);

    useEffect(() => {
        if (!guildId) return;

        const s = io(getWsUrl(), {
            path: "/socket.io/",
            transports: ["websocket", "polling"],
            reconnectionAttempts: 5,
            query: { guildId }
        });

        const refreshRooms = () => {
            s.emit("geoguesser:room:list");
        };

        s.on("connect", refreshRooms);

        const handleRoomUpdate = (type: 'guesser') => (data: any[]) => {
            setRooms(prev => {
                const other = prev.filter(r => r.gameType !== type);
                const next = (data || []).map(r => ({ ...r, gameType: type }));
                const updated = [...other, ...next];
                return updated;
            });
        };

        s.on("geoguesser:room:list", handleRoomUpdate('guesser'));

        setSocket(s);
        const timer = setInterval(refreshRooms, 5000);

        return () => {
            s.disconnect();
            clearInterval(timer);
        };
    }, [guildId, getWsUrl]);

    useEffect(() => {
        onRoomCountChange?.(rooms.length);
    }, [rooms.length, onRoomCountChange]);

    const handleSpectate = (room: LiveRoom) => {
        const rid = room.id || room.roomId;
        if (!rid) return;

        onOpenChange(false);

        router.push(`/dashboard/${guildId}/mini-jeux?spectateRoom=${rid}`);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed top-[76px] right-24 z-[100] animate-in fade-in slide-in-from-top-2 duration-300">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: -10 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: -10 }}
                        className="w-80 bg-surface/95 backdrop-blur-3xl border border-border rounded-2xl shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col ring-1 ring-white/10"
                    >
                        {/* Header */}
                        <div className="p-4 border-b border-border bg-surface flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 bg-success/20 rounded-lg">
                                    <Activity className="w-3.5 h-3.5 text-success animate-pulse" />
                                </div>
                                <div>
                                    <h3 className="text-foreground font-black text-caption uppercase italic tracking-widest">Parties en cours</h3>
                                </div>
                            </div>
                            <button 
                                onClick={() => onOpenChange(false)}
                                className="p-1.5 hover:bg-surface rounded-lg text-foreground/20 hover:text-foreground transition-all"
                            >
                                <X size={16} />
                            </button>
                        </div>

                        {/* List */}
                        <div className="p-3 max-h-[350px] overflow-y-auto custom-scrollbar flex flex-col gap-2">
                            {rooms.length === 0 ? (
                                <div className="py-8 flex flex-col items-center justify-center gap-3 text-foreground/10 italic">
                                    <Gamepad2 size={32} strokeWidth={1} />
                                    <span className="text-caption font-black uppercase tracking-widest text-center px-4">Aucune partie trouvée...</span>
                                </div>
                            ) : (
                                rooms.map((room, idx) => (
                                    <div 
                                        key={`${room.gameType}-${room.id || room.roomId || idx}`}
                                        className="bg-surface border border-border rounded-xl p-3 flex items-center justify-between hover:bg-surface hover:border-border transition-all"
                                    >
                                        <div className="flex flex-col gap-0.5 min-w-0 pr-2">
                                            <div className="flex items-center gap-1.5">
                                                <span className={cn(
                                                    "px-1 py-0.5 rounded-[4px] text-caption font-black uppercase italic",
                                                    "bg-success/20 text-success"
                                                )}>
                                                    Guesser
                                                </span>
                                                <span className="text-foreground/40 text-caption font-black italic">{room.playerCount}/{room.maxPlayers}</span>
                                            </div>
                                            <span className="text-foreground font-black text-caption uppercase italic truncate">
                                                {room.hostName || (room.id || room.roomId || "").slice(0, 8)}
                                            </span>
                                        </div>

                                        <button 
                                            onClick={() => handleSpectate(room)}
                                            className="px-3 py-1.5 bg-surface hover:bg-background text-foreground hover:text-foreground rounded-lg transition-all font-black uppercase italic text-caption active:scale-95 flex items-center gap-1.5"
                                        >
                                            <Eye size={10} />
                                            Live
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Footer Link */}
                        <button 
                            onClick={() => { router.push(`/dashboard/${guildId}/mini-jeux`); onOpenChange(false); }}
                            className="p-3 bg-surface text-center text-foreground/40 hover:text-foreground text-caption font-black uppercase italic tracking-widest transition-all hover:bg-surface flex items-center justify-center gap-2"
                        >
                            Arcade
                            <Play size={8} />
                        </button>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
