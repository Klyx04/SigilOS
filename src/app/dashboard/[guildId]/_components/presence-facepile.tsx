"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";

interface PresenceUser {
    id: string;
    name: string;
    image: string | null;
    lastActive?: Date | null;
    isAfk?: boolean;
}

export function PresenceFacepile({ users }: { users: PresenceUser[] }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!users || users.length === 0) return (
        <div className="flex items-center gap-3 pl-1 pr-2">
            <div className="h-1.5 w-1.5 rounded-full bg-muted animate-pulse ml-1" />
            <span className="text-caption font-black text-muted-foreground uppercase tracking-[0.2em]">Aucun membre actif</span>
        </div>
    );

    // Hydration Guard
    if (!mounted) {
        return (
            <div className="flex -space-x-3 overflow-hidden py-1 px-1">
                {users.slice(0, 10).map((user) => (
                    <div key={user.id} className="relative ring-2 ring-zinc-950 rounded-full">
                        <Avatar className="h-9 w-9 border border-border grayscale-[0.3]">
                            <AvatarImage src={user.image || ""} alt={user.name} />
                            <AvatarFallback className="bg-elevated text-caption font-black text-foreground">
                                {(user.name || "??").substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex -space-x-3 overflow-hidden py-1 px-1">
            {users.slice(0, 10).map((user, i) => {
                const lastActiveDate = user.lastActive ? new Date(user.lastActive) : null;
                const diffMinutes = lastActiveDate ? (Date.now() - lastActiveDate.getTime()) / 60000 : 0;
                const isAfk = user.isAfk || diffMinutes > 15;

                return (
                    <Tooltip key={user.id}>
                        <TooltipTrigger asChild>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.5, x: -20 }}
                                animate={{ opacity: 1, scale: 1, x: 0 }}
                                transition={{
                                    type: "spring",
                                    stiffness: 260,
                                    damping: 20,
                                    delay: i * 0.05
                                }}
                                className="relative ring-2 ring-zinc-950 rounded-full group/avatar"
                            >
                                <Avatar className={`h-9 w-9 border transition-all group-hover/avatar:scale-110 active:scale-90 cursor-none ${
                                    isAfk ? 'border-warning/50 grayscale-[0.2]' : 'border-border grayscale-[0.3] group-hover/avatar:grayscale-0'
                                }`}>
                                    <AvatarImage src={user.image || ""} alt={user.name} />
                                    <AvatarFallback className="bg-elevated text-caption font-black text-foreground">
                                        {(user.name || "??").substring(0, 2).toUpperCase()}
                                    </AvatarFallback>
                                </Avatar>

                                {/* Status Indicator Light */}
                                <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-950 ${
                                    isAfk ? 'bg-warning ' : 'bg-success '
                                }`} />
                            </motion.div>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="bg-surface border-border text-caption font-black uppercase tracking-widest py-1.5 px-2.5 mb-2 flex items-center gap-1.5">
                            <span>{user.name}</span>
                            {isAfk ? (
                                <span className="text-warning font-bold">(AFK)</span>
                            ) : (
                                <span className="text-success font-bold">(En ligne)</span>
                            )}
                        </TooltipContent>
                    </Tooltip>
                );
            })}

            {users.length > 10 && (
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-surface border border-border text-caption font-black text-muted-foreground ml-4 backdrop-blur-md">
                    +{users.length - 10}
                </div>
            )}
        </div>
    );
}
