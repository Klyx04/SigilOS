"use client";

import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface GuildActivityFeedProps {
    logs?: any[];
    guildId?: string;
    canViewLogs?: boolean;
}

/** Libellé sobre par type d'événement (texte seul, sans pastille criarde). */
const TYPE_LABELS: Record<string, string> = {
    SERVICE: "Service",
    LOAN: "Prêt",
    VAULT: "Coffre",
    MISSION_VALIDATED: "Mission",
    ACHIEVEMENT_VALIDATED: "Succès",
    OCRE_TRADE: "Metamob",
    DONATION_VALIDATED: "Don",
    DJ_POST: "Donjon",
    STUFF_UPLOAD: "Stuff",
    CONNECTION: "Connexion",
};

export function GuildActivityFeed({
    logs = [],
    guildId,
    canViewLogs = false,
}: GuildActivityFeedProps) {
    // Count unique actors for activity counter
    const uniqueActorsToday = new Set<string>();
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    logs.forEach((log: any) => {
        const logDate = new Date(log.createdAt);
        if (logDate >= todayStart) {
            uniqueActorsToday.add(log.actor?.pseudoDofus || log.actor?.discordNickname || log.actor?.user?.name);
        }
    });

    return (
        <div className="rounded-xl border border-border bg-card px-4 py-3.5">
            <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-semibold text-foreground">Activité de la guilde</h2>
                {logs.length > 0 && (
                    <span className="text-xs text-muted-foreground tabular-nums">
                        {uniqueActorsToday.size} actif{uniqueActorsToday.size > 1 ? "s" : ""} aujourd'hui
                    </span>
                )}
            </div>

            <div className="space-y-3">
                {logs.length > 0 ? (
                    logs.slice(0, 8).map((log: any) => {
                        const actorName = log.actor?.pseudoDofus || log.actor?.discordNickname || log.actor?.user?.name || "Membre";
                        const label = TYPE_LABELS[log.type] || log.type;

                        return (
                            <div key={log.id} className="flex items-start gap-3">
                                <Avatar className="h-9 w-9 shrink-0 border border-border">
                                    <AvatarImage src={log.actor?.image ?? undefined} />
                                    <AvatarFallback className="text-xs font-bold bg-surface">{actorName[0]}</AvatarFallback>
                                </Avatar>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2">
                                        <span className="text-xs font-semibold text-foreground truncate">{actorName}</span>
                                        <span className="text-xs text-muted-foreground shrink-0">{label}</span>
                                        <span className="text-xs text-muted-foreground ml-auto shrink-0 tabular-nums">
                                            {formatDistanceToNow(new Date(log.createdAt), { addSuffix: true, locale: fr })}
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground leading-snug line-clamp-2">
                                        {log.summary}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <p className="text-xs text-muted-foreground py-6 text-center">Aucune activité récente</p>
                )}
            </div>

            {logs.length > 0 && guildId && canViewLogs && (
                <div className="mt-3 pt-3 border-t border-border">
                    <Link
                        href={`/dashboard/${guildId}/admin/logs`}
                        className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors"
                    >
                        Voir tout l'historique →
                    </Link>
                </div>
            )}
        </div>
    );
}