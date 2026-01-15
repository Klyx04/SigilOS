"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Trophy, ArrowRight } from "lucide-react";
import Link from "next/link";
import { LeaderboardCard } from "@/app/dashboard/[guildId]/ladder/_components/leaderboard-card";
import type { LadderEntry } from "@/server/actions/ladder-actions";

type Props = {
    guildId: string;
    topLadder: LadderEntry[];
};

export function LadderPreview({ guildId, topLadder }: Props) {
    return (
        <Card className="bg-card/40 border-border backdrop-blur-md overflow-hidden flex flex-col">
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <Trophy className="h-4 w-4 text-purple-400" />
                        Top 3 Activité (Mois)
                    </div>
                    <Link href={`/dashboard/${guildId}/ladder`}>
                        <ArrowRight className="h-4 w-4 text-muted-foreground hover:text-purple-400 transition-colors cursor-pointer" />
                    </Link>
                </CardTitle>
            </CardHeader>
            <CardContent className="flex-1">
                {topLadder.length > 0 ? (
                    <div className="space-y-3">
                        {topLadder.slice(0, 3).map((entry) => (
                            <div key={entry.profileId} className="transform scale-95 origin-left w-full">
                                <LeaderboardCard
                                    entry={entry}
                                    valueLabel={`${entry.value.toLocaleString()} XP`}
                                    accentColor="purple"
                                />
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="h-full flex items-center justify-center text-center p-4">
                        <p className="text-sm text-muted-foreground">
                            Aucune activité ce mois-ci.<br />
                            Soyez le premier !
                        </p>
                    </div>
                )}

                <div className="mt-4 text-center">
                    <Link
                        href={`/dashboard/${guildId}/ladder`}
                        className="text-xs text-purple-400 hover:text-purple-300 transition-colors font-medium inline-flex items-center gap-1"
                    >
                        Voir le classement complet <ArrowRight className="h-3 w-3" />
                    </Link>
                </div>
            </CardContent>
        </Card>
    );
}
