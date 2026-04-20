
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, VolumeX, GripVertical, ExternalLink, X } from 'lucide-react';
import { cn } from "@/lib/utils";
import { VoiceUser } from "@/hooks/use-discord-voice";

interface DiscordVoiceOverlayProps {
    users: VoiceUser[];
    guildId: string;
    className?: string;
    gamePlayerIds?: string[];
    currentUserId?: string | null;
}

export const DiscordVoiceOverlay: React.FC<DiscordVoiceOverlayProps> = ({ 
    users, 
    guildId,
    className,
    gamePlayerIds = [],
    currentUserId
}) => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isLoaded, setIsLoaded] = useState(false);
    const [confirmUserId, setConfirmUserId] = useState<string | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const dragStart = useRef<{ x: number; y: number } | null>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // Filtered users: game participants + always show self
    const filteredUsers = users.filter(u => 
        gamePlayerIds.includes(u.userId) || u.userId === currentUserId
    );

    // Load saved position
    useEffect(() => {
        const saved = localStorage.getItem(`sigil_voice_pos_${guildId}`);
        if (saved) {
            try { setPosition(JSON.parse(saved)); } catch {}
        }
        setIsLoaded(true);
    }, [guildId]);

    // Close confirmation on outside click
    useEffect(() => {
        if (!confirmUserId) return;
        const handler = (e: MouseEvent) => {
            if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
                setConfirmUserId(null);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [confirmUserId]);

    // Manual drag via mousedown/mousemove/mouseup on the handle
    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        dragStart.current = { x: e.clientX - position.x, y: e.clientY - position.y };
        setIsDragging(true);
    };

    useEffect(() => {
        if (!isDragging) return;
        const onMove = (e: MouseEvent) => {
            if (!dragStart.current) return;
            setPosition({ x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y });
        };
        const onUp = (e: MouseEvent) => {
            if (!dragStart.current) return;
            const newPos = { x: e.clientX - dragStart.current.x, y: e.clientY - dragStart.current.y };
            setPosition(newPos);
            localStorage.setItem(`sigil_voice_pos_${guildId}`, JSON.stringify(newPos));
            dragStart.current = null;
            setIsDragging(false);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
        return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
    }, [isDragging, guildId]);

    if (filteredUsers.length === 0 || !isLoaded) return null;

    const handleUserClick = (user: VoiceUser) => {
        if (confirmUserId === user.userId) {
            // Second click = confirm open Discord
            window.open(`https://discord.com/channels/${guildId}/${user.channelId}`, '_blank');
            setConfirmUserId(null);
        } else {
            setConfirmUserId(user.userId);
        }
    };

    return (
        <div
            ref={overlayRef}
            className={cn("fixed top-24 right-6 z-[200] flex flex-col items-end gap-2", className)}
            style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        >
            {/* Drag Handle */}
            <div
                onMouseDown={handleMouseDown}
                className={cn(
                    "flex items-center gap-2 px-3 py-1 bg-black/70 backdrop-blur-md rounded-full border border-white/10 mb-1 cursor-move select-none group transition-all hover:border-indigo-500/50",
                    isDragging && "border-indigo-500/70 scale-[1.02]"
                )}
            >
                <GripVertical size={10} className="text-white/30 group-hover:text-indigo-400 transition-colors" />
                <span className="text-[10px] font-black uppercase tracking-widest text-white/40 italic">Voice Overlay</span>
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            </div>

            <AnimatePresence mode="popLayout">
                {filteredUsers.map((user) => {
                    const isInGame = gamePlayerIds.includes(user.userId);
                    const isMe = user.userId === currentUserId;
                    const isTalkingActive = user.isSpeaking && !user.isMute && !user.isDeaf;
                    const isConfirming = confirmUserId === user.userId;

                    return (
                        <motion.div
                            key={user.userId}
                            layout
                            initial={{ opacity: 0, x: 20, scale: 0.85 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, x: 10, scale: 0.9 }}
                            className="relative"
                        >
                            {/* Confirmation mini-panel */}
                            <AnimatePresence>
                                {isConfirming && (
                                    <motion.div
                                        initial={{ opacity: 0, y: -8, scale: 0.9 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -8, scale: 0.9 }}
                                        className="absolute right-full mr-3 top-1/2 -translate-y-1/2 flex items-center gap-2 px-3 py-2 bg-black/90 backdrop-blur-xl border border-white/20 rounded-2xl shadow-2xl z-50 whitespace-nowrap"
                                    >
                                        <span className="text-[10px] font-black text-white/70 uppercase tracking-widest italic">Ouvrir Discord ?</span>
                                        <button
                                            onClick={() => { window.open(`https://discord.com/channels/${guildId}/${user.channelId}`, '_blank'); setConfirmUserId(null); }}
                                            className="px-2 py-1 rounded-lg bg-indigo-500 hover:bg-indigo-400 text-white text-[9px] font-black uppercase tracking-widest transition-all"
                                        >
                                            Oui
                                        </button>
                                        <button
                                            onClick={() => setConfirmUserId(null)}
                                            className="p-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/60 transition-all"
                                        >
                                            <X size={10} />
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* User Card */}
                            <div
                                onClick={() => handleUserClick(user)}
                                className={cn(
                                    "flex items-center gap-3 p-1.5 pr-4 rounded-2xl border transition-all duration-200 cursor-pointer relative overflow-hidden select-none",
                                    // Speaking = bright green card
                                    isTalkingActive
                                        ? "bg-emerald-500/20 border-emerald-400/60 shadow-[0_0_20px_rgba(16,185,129,0.4)]"
                                        : isInGame || isMe
                                            ? "bg-indigo-500/10 border-indigo-500/30 hover:border-indigo-400/50"
                                            : "bg-black/60 border-white/10 backdrop-blur-xl hover:border-white/20"
                                )}
                            >
                                {/* Speaking background pulse */}
                                <AnimatePresence>
                                    {isTalkingActive && (
                                        <motion.div
                                            key="speak-bg"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: [0.15, 0.35, 0.15] }}
                                            exit={{ opacity: 0 }}
                                            transition={{ repeat: Infinity, duration: 0.8 }}
                                            className="absolute inset-0 bg-emerald-500 pointer-events-none"
                                        />
                                    )}
                                </AnimatePresence>

                                {/* Avatar */}
                                <div className="relative z-10 flex-shrink-0">
                                    <div className={cn(
                                        "w-8 h-8 rounded-xl overflow-hidden border-2 transition-all duration-200",
                                        isTalkingActive
                                            ? "border-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.8)] scale-110"
                                            : isInGame || isMe ? "border-indigo-500/50" : "border-white/10"
                                    )}>
                                        <img src={user.avatar || ""} alt={user.userName} className="w-full h-full object-cover" />
                                    </div>

                                    {/* Mic/Deaf icons */}
                                    <div className="absolute -bottom-1 -right-1 z-20">
                                        {user.isDeaf ? (
                                            <div className="p-0.5 bg-red-500 rounded-md border border-black shadow-lg">
                                                <VolumeX size={8} className="text-white" />
                                            </div>
                                        ) : user.isMute ? (
                                            <div className="p-0.5 bg-zinc-700 rounded-md border border-black shadow-lg">
                                                <MicOff size={8} className="text-white" />
                                            </div>
                                        ) : isTalkingActive ? (
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: [1, 1.2, 1] }}
                                                transition={{ repeat: Infinity, duration: 0.5 }}
                                                className="p-0.5 bg-emerald-500 rounded-md border border-black shadow-[0_0_8px_rgba(16,185,129,0.9)]"
                                            >
                                                <Mic size={8} className="text-white" />
                                            </motion.div>
                                        ) : null}
                                    </div>
                                </div>

                                {/* Name + Channel */}
                                <div className="flex flex-col relative z-10 min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className={cn(
                                            "text-xs font-black italic uppercase tracking-tight transition-colors truncate max-w-[100px]",
                                            isTalkingActive ? "text-emerald-300" : isInGame || isMe ? "text-indigo-300" : "text-white/80"
                                        )}>
                                            {user.userName}{isMe && " (Moi)"}
                                        </span>
                                        {(isInGame || isMe) && !isTalkingActive && (
                                            <div className="w-1 h-1 rounded-full bg-indigo-500 flex-shrink-0" />
                                        )}
                                    </div>
                                    <span className="text-[8px] font-bold text-white/30 truncate max-w-[80px]">
                                        # {user.channelName}
                                    </span>
                                </div>

                                {/* Discord link hint */}
                                <ExternalLink size={10} className={cn(
                                    "ml-auto flex-shrink-0 transition-colors relative z-10",
                                    isConfirming ? "text-indigo-400" : "text-white/10 group-hover:text-white/30"
                                )} />
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
};
