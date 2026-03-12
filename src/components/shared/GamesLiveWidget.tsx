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
    gameType: 'guesser' | 'draw' | 'phone';
}

export function GamesLiveWidget() {
    const { guildId } = useParams();
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [rooms, setRooms] = useState<LiveRoom[]>([]);
    const [socket, setSocket] = useState<Socket | null>(null);
    const [isHovered, setIsHovered] = useState(false);
    const isDraggingRef = useRef(false);
    const constraintsRef = useRef<HTMLDivElement>(null);

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

        s.on("connect", () => {
            s.emit("geoguesser:room:list");
            s.emit("skribbl:room:list");
            s.emit("gartic:room:list");
        });

        s.on("geoguesser:room:list", (data: any[]) => {
            setRooms(prev => {
                const other = prev.filter(r => r.gameType !== 'guesser');
                const next = (data || []).map(r => ({ ...r, gameType: 'guesser' as const }));
                return [...other, ...next];
            });
        });

        s.on("skribbl:room:list", (data: any[]) => {
            setRooms(prev => {
                const other = prev.filter(r => r.gameType !== 'draw');
                const next = (data || []).map(r => ({ ...r, gameType: 'draw' as const }));
                return [...other, ...next];
            });
        });

        s.on("gartic:room:list", (data: any[]) => {
            setRooms(prev => {
                const other = prev.filter(r => r.gameType !== 'phone');
                const next = (data || []).map(r => ({ ...r, gameType: 'phone' as const }));
                return [...other, ...next];
            });
        });

        setSocket(s);

        const timer = setInterval(() => {
            if (s.connected) {
                s.emit("geoguesser:room:list");
                s.emit("skribbl:room:list");
                s.emit("gartic:room:list");
            }
        }, 5000);

        return () => {
            s.disconnect();
            clearInterval(timer);
        };
    }, [guildId, buildWsUrl]);

    const handleSpectate = (room: LiveRoom) => {
        const rid = room.id || room.roomId;
        if (!rid) return;

        setIsOpen(false);

        if (room.gameType === 'guesser') {
             router.push(`/dashboard/${guildId}/mini-jeux?spectateRoom=${rid}`);
        } else if (room.gameType === 'draw') {
             router.push(`/dashboard/${guildId}/mini-jeux/skribbl?room=${rid}&spectate=true`);
        } else if (room.gameType === 'phone') {
             router.push(`/dashboard/${guildId}/mini-jeux/gartic?room=${rid}&spectate=true`);
        }
    };

    const handleButtonClick = () => {
        // Only toggle if we didn't just finish a drag
        if (!isDraggingRef.current) {
            setIsOpen(!isOpen);
        }
        isDraggingRef.current = false;
    };

    return (
        <>
            {/* Invisible full-viewport drag boundary */}
            <div ref={constraintsRef} className="fixed inset-0 z-[99] pointer-events-none" />

            <div className="fixed top-[100px] right-10 z-[100] flex flex-col items-end gap-4 pointer-events-none">
                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: -20, x: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0, x: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: -20, x: 20 }}
                            className="w-80 bg-zinc-900/95 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] shadow-[0_30px_60px_rgba(0,0,0,0.6)] overflow-hidden flex flex-col ring-1 ring-white/10 pointer-events-auto"
                        >
                            {/* Header */}
                            <div className="p-6 border-b border-white/5 bg-white/5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-emerald-500/20 rounded-xl">
                                        <Activity className="w-4 h-4 text-emerald-400 animate-pulse" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-black text-xs uppercase italic tracking-widest">Parties en cours</h3>
                                        <p className="text-white/30 text-[9px] font-bold uppercase tracking-tight">{rooms.length} salon(s) actif(s)</p>
                                    </div>
                                </div>
                                <button 
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-white/10 rounded-xl text-white/20 hover:text-white transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>

                            {/* List */}
                            <div className="p-4 max-h-[400px] overflow-y-auto custom-scrollbar flex flex-col gap-3">
                                {rooms.length === 0 ? (
                                    <div className="py-12 flex flex-col items-center justify-center gap-4 text-white/10 italic">
                                        <Gamepad2 size={40} strokeWidth={1} />
                                        <span className="text-[10px] font-black uppercase tracking-widest">Aucun salon actif...</span>
                                    </div>
                                ) : (
                                    rooms.map((room, idx) => (
                                        <div 
                                            key={`${room.gameType}-${room.id || room.roomId || idx}`}
                                            className="group relative bg-white/5 border border-white/5 rounded-2xl p-4 flex items-center justify-between hover:bg-white/10 hover:border-white/10 transition-all cursor-default"
                                        >
                                            <div className="flex flex-col gap-1 min-w-0 pr-2">
                                                <div className="flex items-center gap-2">
                                                    <span className={cn(
                                                        "px-1.5 py-0.5 rounded text-[7px] font-black uppercase italic",
                                                        room.gameType === 'guesser' ? "bg-emerald-500/20 text-emerald-400" :
                                                        room.gameType === 'draw' ? "bg-blue-500/20 text-blue-400" :
                                                        "bg-amber-500/20 text-amber-400"
                                                    )}>
                                                        {room.gameType === 'guesser' ? 'Guesser' : room.gameType === 'draw' ? 'Draw' : 'Phone'}
                                                    </span>
                                                    <span className="text-white/20 text-[8px] font-bold">●</span>
                                                    <span className="text-white/40 text-[9px] font-black italic">{room.playerCount}/{room.maxPlayers}</span>
                                                </div>
                                                <span className="text-white font-black text-[11px] uppercase italic truncate">
                                                    {room.hostName || (room.id || room.roomId || "").slice(0, 8)}
                                                </span>
                                            </div>

                                            <button 
                                                onClick={() => handleSpectate(room)}
                                                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white text-white hover:text-black rounded-xl transition-all font-black uppercase italic text-[9px] group/btn active:scale-95"
                                            >
                                                <Eye size={12} className="group-hover/btn:scale-110 transition-transform" />
                                                Regarder
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Footer Link */}
                            <button 
                                onClick={() => { router.push(`/dashboard/${guildId}/mini-jeux`); setIsOpen(false); }}
                                className="p-4 bg-white/5 text-center text-white/40 hover:text-white text-[9px] font-black uppercase italic tracking-widest transition-all hover:bg-white/10 flex items-center justify-center gap-2 group"
                            >
                                Voir tous les jeux
                                <Play size={10} className="group-hover:translate-x-1 transition-transform" />
                            </button>
                        </motion.div>
                    )}
                </AnimatePresence>

                <motion.button
                    drag
                    dragConstraints={constraintsRef}
                    dragElastic={0.1}
                    dragMomentum={false}
                    onDragStart={() => { isDraggingRef.current = true; }}
                    onDragEnd={() => { setTimeout(() => { isDraggingRef.current = false; }, 100); }}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={handleButtonClick}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                    className={cn(
                        "relative group flex items-center gap-4 p-2 rounded-full transition-colors duration-500 pointer-events-auto cursor-grab active:cursor-grabbing select-none",
                        rooms.length > 0 ? "bg-emerald-500 shadow-[0_0_30px_rgba(16,185,129,0.4)]" : "bg-zinc-800 border border-white/10 hover:bg-zinc-700"
                    )}
                >
                    {/* Ping animation if active rooms */}
                    {rooms.length > 0 && (
                        <div className="absolute inset-0 bg-emerald-500 blur-xl rounded-full animate-pulse opacity-50 pointer-events-none" />
                    )}

                    <div className={cn(
                        "w-12 h-12 rounded-full flex items-center justify-center relative z-10 transition-all pointer-events-none",
                        rooms.length > 0 ? "bg-emerald-400 text-emerald-950" : "bg-zinc-900 text-zinc-500"
                    )}>
                        {rooms.length > 0 ? <Loader2 size={24} className="animate-spin-slow" /> : <Gamepad2 size={20} />}
                        {rooms.length > 0 && (
                            <div className="absolute -top-1 -right-1 w-5 h-5 bg-white rounded-full flex items-center justify-center text-[10px] font-black text-emerald-600 shadow-xl ring-2 ring-emerald-500">
                                {rooms.length}
                            </div>
                        )}
                    </div>

                    <AnimatePresence>
                        {(rooms.length > 0 || isHovered) && (
                            <motion.div
                                initial={{ opacity: 0, x: 20, width: 0 }}
                                animate={{ opacity: 1, x: 0, width: "auto" }}
                                exit={{ opacity: 0, x: 20, width: 0 }}
                                className="overflow-hidden whitespace-nowrap pr-6 pointer-events-none"
                            >
                                <span className={cn(
                                    "text-[11px] font-black uppercase italic tracking-[0.2em]",
                                    rooms.length > 0 ? "text-emerald-950" : "text-white/60"
                                )}>
                                    {rooms.length > 0 ? "Parties Live" : "Arcade"}
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.button>
            </div>
        </>
    );
}
