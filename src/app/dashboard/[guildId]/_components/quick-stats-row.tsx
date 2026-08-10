"use client";

import type { ReactNode } from "react";
import { Users, Moon, CalendarDays, Sparkles } from "lucide-react";
import { PresenceFacepile } from "./presence-facepile";

interface QuickStatsRowProps {
    onlineCount: number;
    totalMembers: number;
    songesCompleted: number;
    eventsCount: number;
    dofusCompletionRate: number;
    topActivityName: string;
    topActivityValue: string;
    onlineUsers: { id: string; name: string; image: string | null }[];
}

function StatCard({
    icon: Icon,
    label,
    value,
    sublabel,
}: {
    icon: typeof Users;
    label: string;
    value: ReactNode;
    sublabel?: string;
}) {
    return (
        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-[12px] font-medium">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{label}</span>
            </div>
            <p className="mt-2 text-[22px] font-bold text-foreground tabular-nums leading-none">{value}</p>
            {sublabel && (
                <p className="text-[12px] text-muted-foreground font-medium mt-1.5 truncate">{sublabel}</p>
            )}
        </div>
    );
}

export function QuickStatsRow({
    onlineCount,
    totalMembers,
    songesCompleted,
    eventsCount,
    dofusCompletionRate,
    topActivityName,
    topActivityValue,
    onlineUsers,
}: QuickStatsRowProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Online Members -- with facepile (preuve sociale) */}
            <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-[12px] font-medium">
                    <Users className="w-4 h-4 shrink-0" />
                    <span className="truncate">Membres actifs</span>
                </div>
                <p className="mt-2 text-[22px] font-bold text-foreground tabular-nums leading-none">
                    {onlineCount}
                    <span className="text-[13px] text-muted-foreground font-medium">/{totalMembers}</span>
                </p>
                {onlineUsers.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/40">
                        <PresenceFacepile users={onlineUsers} />
                    </div>
                )}
            </div>

            <StatCard icon={Moon} label="Songes complétés" value={songesCompleted} sublabel="Run terminés" />

            <StatCard icon={CalendarDays} label="Événements" value={eventsCount} sublabel="Organisés" />

            <StatCard
                icon={Sparkles}
                label="Progression Dofus"
                value={<>{dofusCompletionRate}%</>}
                sublabel={topActivityName ? `${topActivityName} · ${topActivityValue}` : "Moyenne guilde"}
            />
        </div>
    );
}