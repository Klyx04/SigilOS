"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Gavel, Users, Clock, ArrowRight, AlertCircle } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { formatDistanceToNow, differenceInHours } from "date-fns";
import { fr } from "date-fns/locale";

interface PollOption {
    id: string;
    label: string;
    emoji: string | null;
    _count?: { votes: number };
}

interface Poll {
    id: string;
    title: string;
    category: string;
    status: string;
    creatorName: string;
    expiresAt: string | null;
    createdAt: string;
    options: PollOption[];
}

export function ActivePollsWidget({
    guildId,
    polls = []
}: {
    guildId: string;
    polls: Poll[];
}) {
    const activePolls = polls.filter(p => p.status === "ACTIVE").slice(0, 3);

    return (
        <Card className="glass-premium border-white/5 flex flex-col h-full overflow-hidden">
            <CardHeader className="pb-4 pt-6 px-6">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-caption font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                        <Gavel className="w-3.5 h-3.5" />
                        Sondages Actifs
                        {activePolls.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-caption font-black tabular-nums">
                                {activePolls.length}
                            </span>
                        )}
                    </CardTitle>
                    <Link
                        href={`/dashboard/${guildId}/sondages`}
                        className="text-caption font-black text-zinc-600 hover:text-emerald-400 uppercase tracking-widest border border-white/5 px-2 py-1 rounded-md transition-all hover:border-emerald-500/20"
                    >
                        Voter →
                    </Link>
                </div>
            </CardHeader>

            <CardContent className="px-4 pb-4 flex-1 flex flex-col gap-2">
                {activePolls.length > 0 ? (
                    <>
                        {activePolls.map((poll) => {
                            const totalVotes = poll.options.reduce((sum, opt) => sum + (opt._count?.votes || 0), 0);
                            const isExpiringSoon = poll.expiresAt && differenceInHours(new Date(poll.expiresAt), new Date()) < 24;
                            const timeLeft = poll.expiresAt
                                ? formatDistanceToNow(new Date(poll.expiresAt), { addSuffix: true, locale: fr })
                                : null;

                            // Top 2 options for preview
                            const topOptions = [...poll.options]
                                .sort((a, b) => (b._count?.votes || 0) - (a._count?.votes || 0))
                                .slice(0, 2);

                            return (
                                <Link
                                    key={poll.id}
                                    href={`/dashboard/${guildId}/sondages`}
                                    className="group block bg-zinc-950/40 hover:bg-zinc-900/60 border border-white/5 hover:border-cyan-500/20 rounded-2xl p-3 transition-all duration-200 hover:scale-[1.01] space-y-3"
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1 min-w-0 space-y-1">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <span className="text-caption font-black uppercase px-1.5 py-0.5 rounded bg-emerald-950/50 text-emerald-400 border border-emerald-500/20 shrink-0">
                                                    {poll.category}
                                                </span>
                                                {isExpiringSoon && (
                                                    <span className="flex items-center gap-1 text-caption font-black uppercase px-1.5 py-0.5 rounded bg-amber-950/40 text-amber-400 border border-amber-500/20 shrink-0">
                                                        <AlertCircle className="w-2.5 h-2.5" />
                                                        Expire bientôt
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-caption font-black text-white/90 group-hover:text-emerald-400 transition-colors uppercase italic leading-tight">
                                                {poll.title}
                                            </p>
                                        </div>
                                        <ArrowRight className="w-4 h-4 text-zinc-700 group-hover:text-emerald-400 transition-colors shrink-0 mt-1" />
                                    </div>

                                    {/* Top options preview with vote bars */}
                                    {topOptions.length > 0 && totalVotes > 0 && (
                                        <div className="space-y-1.5">
                                            {topOptions.map((opt) => {
                                                const pct = totalVotes > 0 ? Math.round(((opt._count?.votes || 0) / totalVotes) * 100) : 0;
                                                return (
                                                    <div key={opt.id} className="space-y-1">
                                                        <div className="flex items-center justify-between text-caption font-bold">
                                                            <span className="text-zinc-400 truncate max-w-[160px]">
                                                                {opt.emoji && <span className="mr-1">{opt.emoji}</span>}
                                                                {opt.label}
                                                            </span>
                                                            <span className="text-emerald-400 tabular-nums ml-2 shrink-0">{pct}%</span>
                                                        </div>
                                                        <div className="h-1 bg-zinc-900 rounded-full overflow-hidden">
                                                            <div
                                                                className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 rounded-full transition-all duration-300"
                                                                style={{ width: `${pct}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* Footer */}
                                    <div className="flex items-center justify-between text-caption text-zinc-600 font-bold uppercase tracking-tighter pt-1 border-t border-white/5">
                                        <div className="flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            {totalVotes} vote{totalVotes !== 1 ? "s" : ""}
                                        </div>
                                        {timeLeft && (
                                            <div className={cn("flex items-center gap-1", isExpiringSoon ? "text-amber-500" : "text-zinc-600")}>
                                                <Clock className="w-3 h-3" />
                                                {timeLeft}
                                            </div>
                                        )}
                                    </div>
                                </Link>
                            );
                        })}

                        <Link
                            href={`/dashboard/${guildId}/sondages`}
                            className="flex items-center justify-center gap-2 text-caption font-black text-zinc-700 hover:text-emerald-400 uppercase tracking-widest pt-2 transition-colors border-t border-white/5 mt-auto"
                        >
                            Voir tous les sondages
                        </Link>
                    </>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 text-center space-y-4 border border-dashed border-white/5 rounded-2xl">
                        <div className="w-12 h-12 rounded-full bg-zinc-900 flex items-center justify-center">
                            <Gavel className="w-6 h-6 text-zinc-700" />
                        </div>
                        <div className="space-y-1">
                            <p className="text-caption text-zinc-500 font-black uppercase tracking-widest">
                                Aucun sondage actif
                            </p>
                            <p className="text-caption text-zinc-700 font-medium">
                                Les sondages de la guilde apparaîtront ici
                            </p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
