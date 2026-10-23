"use client";

import { Activity, Clock, Trophy, Flame, CheckCircle2, ShieldCheck, Sparkles } from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface ProfileActivityTabProps {
    lastSeen?: string | Date | null;
    lastActivityAt?: string | Date | null;
    xp?: number;
    contributionPoints?: number;
    validatedMissionsCount?: number;
    weeklyMissions?: number;
    weeklyXp?: number;
    displayName: string;
    canViewMissions?: boolean;
}

export function ProfileActivityTab({
    lastSeen,
    lastActivityAt,
    xp = 0,
    contributionPoints = 0,
    validatedMissionsCount = 0,
    weeklyMissions = 0,
    weeklyXp = 0,
    displayName,
    canViewMissions = true,
}: ProfileActivityTabProps) {
    const rawDate = lastSeen || lastActivityAt;
    const dateObj = rawDate ? new Date(rawDate) : null;
    const formattedLastSeen = dateObj
        ? formatDistanceToNow(dateObj, { addSuffix: true, locale: fr })
        : "Inconnue";

    return (
        <div className="p-6 bg-card border border-border rounded-2xl space-y-6 shadow-sm">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-warning/15 border border-warning/30 flex items-center justify-center">
                        <Activity className="w-4 h-4 text-warning" />
                    </div>
                    <div>
                        <h3 className="text-base font-bold text-foreground">Activité & Présence</h3>
                        <p className="text-xs text-muted-foreground">Participation de {displayName} au sein de la guilde</p>
                    </div>
                </div>

                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface/60 border border-border text-xs text-muted-foreground w-fit">
                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Dernière connexion : <strong className="text-foreground">{formattedLastSeen}</strong></span>
                </div>
            </div>

            {/* Stat Cards */}
            <div className={cn("grid gap-3", canViewMissions ? "grid-cols-2 lg:grid-cols-4" : "grid-cols-1 sm:grid-cols-2")}>
                <div className="p-3.5 rounded-xl bg-surface/50 border border-border space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                        <Flame className="w-3.5 h-3.5 text-warning" />
                        <span>XP Guilde totale</span>
                    </div>
                    <p className="text-xl font-bold text-foreground font-mono">
                        {xp.toLocaleString("fr-FR")} <span className="text-xs text-muted-foreground font-sans font-normal">XP</span>
                    </p>
                </div>

                {canViewMissions ? (
                    <>
                        <div className="p-3.5 rounded-xl bg-surface/50 border border-border space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <Trophy className="w-3.5 h-3.5 text-success" />
                                <span>Missions validées</span>
                            </div>
                            <p className="text-xl font-bold text-foreground font-mono">
                                {validatedMissionsCount}
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-surface/50 border border-border space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <Sparkles className="w-3.5 h-3.5 text-warning" />
                                <span>XP cette semaine</span>
                            </div>
                            <p className="text-xl font-bold text-foreground font-mono">
                                {weeklyXp.toLocaleString("fr-FR")}
                            </p>
                        </div>

                        <div className="p-3.5 rounded-xl bg-surface/50 border border-border space-y-1">
                            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                                <ShieldCheck className="w-3.5 h-3.5 text-accent" />
                                <span>Contribution</span>
                            </div>
                            <p className="text-xl font-bold text-foreground font-mono">
                                {contributionPoints} <span className="text-xs text-muted-foreground font-sans font-normal">pts</span>
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="p-3.5 rounded-xl bg-surface/50 border border-border flex items-center gap-2.5">
                        <Trophy className="w-4 h-4 text-warning shrink-0" />
                        <div>
                            <p className="text-xs font-semibold text-foreground">Mode vitrine actif</p>
                            <p className="text-[11px] text-muted-foreground">Statistiques de missions masquées</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Detailed Timeline / Activity Summary */}
            <div className="p-4 rounded-xl bg-surface/40 border border-border space-y-2.5">
                <h4 className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-success" />
                    <span>Détails de participation</span>
                </h4>
                {canViewMissions && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                        <span>Missions accomplies cette semaine</span>
                        <span className="font-mono font-semibold text-success bg-success/10 px-2 py-0.5 rounded-md border border-success/20">
                            {weeklyMissions}
                        </span>
                    </div>
                )}
                {dateObj && (
                    <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/60">
                        <span>Horodatage de dernière activité</span>
                        <span className="font-mono text-foreground">
                            {format(dateObj, "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
}
