"use client";

import { Users, Sparkles, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { PresenceFacepile } from "./presence-facepile";
import { cn } from "@/lib/utils";

interface QuickStatsRowProps {
    onlineCount: number;
    totalMembers: number;
    dofusCompletionRate: number;
    topActivityName: string;
    topActivityValue: string;
    onlineUsers: { id: string; name: string; image: string | null }[];
    // Comparaison temporelle — delta déjà calculé côté serveur, 0 requête en plus.
    membersDelta?: number | null;
    // Vitrine (admin → missions) : masque la carte "Progression Dofus".
    hideDofusProgress?: boolean;
}

function DeltaBadge({ delta }: { delta: number | null | undefined }) {
    if (delta === null || delta === undefined || delta === 0) {
        return (
            <span className="inline-flex items-center gap-1 text-caption font-semibold text-muted-foreground/70">
                <Minus className="w-3 h-3" /> stable
            </span>
        );
    }
    const up = delta > 0;
    return (
        <span
            className={cn(
                "inline-flex items-center gap-1 text-caption font-semibold tabular-nums",
                up ? "text-success" : "text-danger"
            )}
        >
            {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {up ? "+" : ""}{delta} ce mois
        </span>
    );
}

export function QuickStatsRow({
    onlineCount,
    totalMembers,
    dofusCompletionRate,
    topActivityName,
    topActivityValue,
    onlineUsers,
    membersDelta,
    hideDofusProgress = false,
}: QuickStatsRowProps) {
    return (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-xl border border-border/60 bg-background/40 px-4 py-3">
            {/* Membres en ligne */}
            <div className="flex items-center gap-2.5 min-w-0">
                <Users className="w-4 h-4 shrink-0 text-muted-foreground" />
                <p className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                    <span className="font-bold text-foreground">{onlineCount}/{totalMembers}</span> en ligne
                </p>
                {membersDelta !== undefined && <DeltaBadge delta={membersDelta} />}
            </div>

            {onlineUsers.length > 0 && (
                <>
                    <span className="hidden sm:block w-px h-6 bg-border/60" aria-hidden="true" />
                    <PresenceFacepile users={onlineUsers} />
                </>
            )}

            {/* Progression Dofus (masquée en vitrine) */}
            {!hideDofusProgress && (
                <>
                    <span className="hidden sm:block w-px h-6 bg-border/60" aria-hidden="true" />
                    <div className="flex items-center gap-2.5 min-w-0">
                        <Sparkles className="w-4 h-4 shrink-0 text-muted-foreground" />
                        <p className="text-sm text-muted-foreground tabular-nums whitespace-nowrap">
                            <span className="font-bold text-foreground">{dofusCompletionRate}%</span> Dofus
                            <span className="hidden md:inline"> · {topActivityName ? `${topActivityName} · ${topActivityValue}` : "moyenne guilde"}</span>
                        </p>
                    </div>
                </>
            )}
        </div>
    );
}