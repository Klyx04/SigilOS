"use client";

import type { ReactNode } from "react";
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

function StatCard({
    icon: Icon,
    label,
    value,
    sublabel,
    delta,
}: {
    icon: typeof Users;
    label: string;
    value: ReactNode;
    sublabel?: string;
    delta?: number | null;
}) {
    return (
        <div className="rounded-xl border border-border/60 bg-background/40 p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-label font-medium">
                <Icon className="w-4 h-4 shrink-0" />
                <span className="truncate">{label}</span>
            </div>
            <p className="mt-2 text-[22px] font-bold text-foreground tabular-nums leading-none">{value}</p>
            {delta !== undefined && (
                <p className="mt-1.5 flex items-center">
                    <DeltaBadge delta={delta} />
                </p>
            )}
            {sublabel && (
                <p className="text-label text-muted-foreground font-medium mt-1 truncate">{sublabel}</p>
            )}
        </div>
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
    // En mode vitrine, on masque la carte "Progression Dofus" → une seule carte reste.
    const gridCols = hideDofusProgress ? "grid-cols-1" : "sm:grid-cols-2";

    return (
        <div className={cn("grid grid-cols-1 gap-4", gridCols)}>
            {/* Online Members -- with facepile (preuve sociale) */}
            <div className="rounded-xl border border-border/60 bg-background/40 p-4">
                <div className="flex items-center gap-2 text-muted-foreground text-label font-medium">
                    <Users className="w-4 h-4 shrink-0" />
                    <span className="truncate">Membres actifs</span>
                </div>
                <p className="mt-2 text-[22px] font-bold text-foreground tabular-nums leading-none">
                    {onlineCount}
                    <span className="text-body-sm text-muted-foreground font-medium">/{totalMembers}</span>
                </p>
                {membersDelta !== undefined && (
                    <p className="mt-1.5 flex items-center">
                        <DeltaBadge delta={membersDelta} />
                    </p>
                )}
                {onlineUsers.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/40">
                        <PresenceFacepile users={onlineUsers} />
                    </div>
                )}
            </div>

            {!hideDofusProgress && (
                <StatCard
                    icon={Sparkles}
                    label="Progression Dofus"
                    value={<>{dofusCompletionRate}%</>}
                    sublabel={topActivityName ? `${topActivityName} · ${topActivityValue}` : "Moyenne guilde"}
                />
            )}
        </div>
    );
}