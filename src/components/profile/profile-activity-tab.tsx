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
        <Card className="p-6 bg-zinc-950/60 border border-white/10 rounded-3xl space-y-6 backdrop-blur-md shadow-2xl">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center">
                        <Activity className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-base font-black text-white uppercase tracking-wider">Activité & Présence</h3>
                        <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Rétrospective de participation de {displayName}</p>
                    </div>
                </div>

                <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-zinc-900 border border-white/10 text-xs font-bold text-zinc-300">
                    <Clock className="w-3.5 h-3.5 text-indigo-400" />
                    Dernière connexion : <span className="text-indigo-300">{formattedLastSeen}</span>
                </div>
            </div>

            {/* Stat Cards */}
            <div className={cn("grid gap-4", canViewMissions ? "grid-cols-2 md:grid-cols-4" : "grid-cols-1 md:grid-cols-2")}>
                <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500">
                        <Flame className="w-3.5 h-3.5 text-amber-400" /> XP Guilde Totale
                    </div>
                    <p className="text-2xl font-black text-amber-400 font-mono">
                        {xp.toLocaleString("fr-FR")} <span className="text-xs text-zinc-500 font-sans">XP</span>
                    </p>
                </div>

                {canViewMissions ? (
                    <>
                        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500">
                                <Trophy className="w-3.5 h-3.5 text-emerald-400" /> Missions Validées
                            </div>
                            <p className="text-2xl font-black text-emerald-400 font-mono">
                                {validatedMissionsCount}
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500">
                                <Sparkles className="w-3.5 h-3.5 text-sky-400" /> XP Cette Semaine
                            </div>
                            <p className="text-2xl font-black text-sky-400 font-mono">
                                {weeklyXp.toLocaleString("fr-FR")}
                            </p>
                        </div>

                        <div className="p-4 rounded-2xl bg-black/40 border border-white/5 space-y-1">
                            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-zinc-500">
                                <ShieldCheck className="w-3.5 h-3.5 text-purple-400" /> Points Contribution
                            </div>
                            <p className="text-2xl font-black text-purple-400 font-mono">
                                {contributionPoints} <span className="text-xs text-zinc-500 font-sans">pts</span>
                            </p>
                        </div>
                    </>
                ) : (
                    <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20 flex items-center gap-3">
                        <Trophy className="w-5 h-5 text-amber-400 shrink-0" />
                        <div>
                            <p className="text-xs font-bold text-amber-300">Mode Vitrine Activé</p>
                            <p className="text-[10px] text-zinc-400">Les statistiques détaillées de missions sont masquées.</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Detailed Timeline / Activity Summary */}
            <div className="p-5 rounded-2xl bg-black/40 border border-white/5 space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    Rétrospective de Présence
                </h4>
                {canViewMissions && (
                    <div className="flex items-center justify-between text-xs text-zinc-300 pt-1">
                        <span>Missions accomplies cette semaine :</span>
                        <span className="font-mono font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20">
                            {weeklyMissions} mission{weeklyMissions > 1 ? "s" : ""}
                        </span>
                    </div>
                )}
                {dateObj && (
                    <div className="flex items-center justify-between text-xs text-zinc-300 pt-1 border-t border-white/5">
                        <span>Horodatage précis de dernière activité :</span>
                        <span className="font-mono text-zinc-400">
                            {format(dateObj, "dd/MM/yyyy 'à' HH:mm", { locale: fr })}
                        </span>
                    </div>
                )}
            </div>
        </Card>
    );
}
