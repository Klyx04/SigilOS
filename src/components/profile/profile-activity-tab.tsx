"use client";

import { Card } from "@/components/ui/card";
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
        <Card className="p-6 bg-background/60 border border-border rounded-3xl space-y-6 backdrop-blur-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-info/10 border border-info/20 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-info" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-foreground uppercase tracking-wider">Activité & Présence</h3>
                        <p className="text-caption text-muted-foreground uppercase tracking-widest font-bold">Rétrospective de participation de {displayName}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-bold text-foreground">
                    <Clock className="w-3.5 h-3.5 text-info" />
                    Dernière connexion : <span className="text-info">{formattedLastSeen}</span>
                </div>
            </div>

            {/* Stat Cards */}
            <div className={cn("grid gap-4", canViewMissions ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 md:grid-cols-2")}>
                <div className="p-4 rounded-2xl bg-black/40 border border-border space-y-1">
                    <div className="flex items-center gap-2 text-caption font-black uppercase text-muted-foreground">
                        <Flame className="w-3.5 h-3.5 text-warning" /> XP Guilde Totale
                    </div>
                    <p className="text-2xl font-black text-warning font-mono">
                        {xp.toLocaleString("fr-FR")} <span className="text-xs text-muted-foreground font-sans">XP</span>
                    </p>
                </div>

                {canViewMissions ? (
                    <>
                        <div className="p-4 rounded-2xl bg-black/40 border border-border space-y-1">
                            <div className="flex items-center gap-2 text-caption font-black uppercase text-muted-foreground">
                                <Trophy className="w-3.5 h-3.5 text-success" /> Missions Validées
                            </div>
                            <p className="text-2xl font-black text-success font-mono">
                                {validatedMissionsCount}
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-black/40 border border-border space-y-1">
                            <div className="flex items-center gap-2 text-caption font-black uppercase text-muted-foreground">
                                <Sparkles className="w-3.5 h-3.5 text-sky-400" /> XP Cette Semaine
                            </div>
                            <p className="text-2xl font-black text-sky-400 font-mono">
                                {weeklyXp.toLocaleString("fr-FR")}
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-black/40 border border-border space-y-1">
                            <div className="flex items-center gap-2 text-caption font-black uppercase text-muted-foreground">
                                <ShieldCheck className="w-3.5 h-3.5 text-info" /> Points Contribution
                            </div>
                            <p className="text-2xl font-black text-info font-mono">
                                {contributionPoints} <span className="text-xs text-muted-foreground font-sans">pts</span>
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="p-4 rounded-2xl bg-warning/5 border border-warning/20 flex items-center gap-3">
                        <Trophy className="w-5 h-5 text-warning shrink-0" />
                        <div>
                            <p className="text-xs font-bold text-warning">Mode Vitrine Activé</p>
                            <p className="text-caption text-muted-foreground">Les statistiques détaillées de missions sont masquées.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Detailed Timeline / Activity Summary */}
            <div className="p-5 rounded-2xl bg-black/40 border border-border space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-success" />
                    Rétrospective de Présence
                </h4>
                {canViewMissions && (
                    <div className="flex items-center justify-between text-xs text-foreground pt-1">
                        <span>Missions accomplies cette semaine :</span>
                        <span className="font-mono font-black text-success bg-success/10 px-2.5 py-1 rounded-lg border border-success/20">
                            {weeklyMissions} mission{weeklyMissions > 1 ? "s" : ""}
                        </span>
                    </div>
                )}
                {dateObj && (
                    <div className="flex items-center justify-between text-xs text-foreground pt-1 border-t border-border">
                        <span>Horodatage précis de dernière activité :</span>
                        <span className="font-mono text-muted-foreground">
                            {format(dateObj, "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
                        </span>
                    </div>
                )}
            </div>
        </Card>
    );
}
