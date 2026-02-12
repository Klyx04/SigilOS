"use client";

import { useState, useEffect } from "react";
import { Clock, Calendar, Command } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface SmartBarProps {
    almanax?: React.ReactNode;
    memberCount?: number;
    onlineCount?: number;
}

export function SmartBar({ almanax, memberCount, onlineCount }: SmartBarProps) {
    const [time, setTime] = useState<string>("");

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

    return (
        <div className="hidden md:flex items-center gap-2 bg-black/40 backdrop-blur-md border border-white/5 rounded-full p-1 shadow-inner">

            {/* 1. Almanax Slot */}
            <div className="flex items-center">
                {almanax}
            </div>

            {/* DIVIDER */}
            {(memberCount !== undefined || onlineCount !== undefined) && (
                <div className="h-6 w-px bg-white/5 mx-1" />
            )}

            {/* 2. Guild Stats */}
            {(memberCount !== undefined || onlineCount !== undefined) && (
                <div className="flex items-center gap-3 px-3">
                    <div className="flex flex-col items-center leading-none">
                        <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">Membres</span>
                        <span className="text-xs font-bold text-zinc-300">
                            <span className="text-emerald-400">{onlineCount ?? 0}</span>
                            <span className="text-zinc-600 mx-1">/</span>
                            {memberCount ?? 0}
                        </span>
                    </div>
                </div>
            )}

            {/* DIVIDER */}
            <div className="h-6 w-px bg-white/5 mx-1" />

            {/* 3. Server Time */}
            <div className="flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/5 text-xs font-mono text-zinc-300 min-w-[90px] justify-center shadow-sm">
                <Clock className="w-3.5 h-3.5 text-indigo-400" />
                <span>{time || "--:--"}</span>
            </div>

            {/* 4. Command Hint */}
            {/* Command Hint removed based on user feedback */}
        </div>
    );
}
