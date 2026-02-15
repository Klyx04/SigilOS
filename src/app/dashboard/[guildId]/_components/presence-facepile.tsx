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
}

export function PresenceFacepile({ users }: { users: PresenceUser[] }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    if (!users || users.length === 0) return (
        <div className="flex items-center gap-3 pl-1 pr-2">
            <div className="h-1.5 w-1.5 rounded-full bg-zinc-700 animate-pulse ml-1" />
            <span className="text-[9px] font-black text-zinc-500 uppercase tracking-[0.2em]">Aucun membre actif</span>
        </div>
    );

    // Hydration Guard: Don't render interactive tooltips on server to avoid ID mismatch
    if (!mounted) {
        return (
            <div className="flex -space-x-3 overflow-hidden py-1 px-1">
                {users.slice(0, 10).map((user) => (
                    <div key={user.id} className="relative ring-2 ring-zinc-950 rounded-full">
                        <Avatar className="h-9 w-9 border border-white/10 grayscale-[0.3]">
                            <AvatarImage src={user.image || ""} alt={user.name} />
                            <AvatarFallback className="bg-zinc-800 text-[10px] font-black text-white">
                                {user.name.substring(0, 2).toUpperCase()}
                            </AvatarFallback>
                        </Avatar>
                    </div>
                ))}
            </div>
        );
    }

    return (
        <div className="flex -space-x-3 overflow-hidden py-1 px-1">
            {users.slice(0, 10).map((user, i) => (
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
                            <Avatar className="h-9 w-9 border border-white/10 grayscale-[0.3] group-hover/avatar:grayscale-0 transition-all group-hover/avatar:scale-110 active:scale-90 cursor-none">
                                <AvatarImage src={user.image || ""} alt={user.name} />
                                <AvatarFallback className="bg-zinc-800 text-[10px] font-black text-white">
                                    {user.name.substring(0, 2).toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="absolute inset-0 rounded-full shadow-[inset_0_0_8px_rgba(16,185,129,0.2)] pointer-events-none" />
                        </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="bg-zinc-900 border-white/10 text-[10px] font-black uppercase tracking-widest py-1 px-2 mb-2">
                        {user.name}
                    </TooltipContent>
                </Tooltip>
            ))}

            {users.length > 10 && (
                <div className="flex items-center justify-center h-9 w-9 rounded-full bg-zinc-900 border border-white/10 text-[10px] font-black text-zinc-500 ml-4 backdrop-blur-md">
                    +{users.length - 10}
                </div>
            )}
        </div>
    );
}
