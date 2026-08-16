'use client'

import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMemberDreamRuns } from "@/server/actions/songes/dream-run-actions";
import { Loader2, History, Trophy, Skull, Ban } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import Image from "next/image";

export function DreamRunHistory({ guildId, userId }: { guildId: string, userId?: string }) {
    const [runs, setRuns] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function fetchHistory() {
            const res = await getMemberDreamRuns(guildId, userId);
            if (res.success && res.runs) {
                setRuns(res.runs);
            }
            setIsLoading(false);
        }
        fetchHistory();
    }, [guildId, userId]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
        );
    }

    if (runs.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 bg-surface/50 rounded-xl border border-dashed border-border">
                <History className="w-8 h-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground font-medium">Aucun historique de Songes pour le moment.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {runs.map((run) => {
                const difficultyColor = run.difficulty.startsWith('CAUCHEMAR') ? "text-danger" :
                    run.difficulty.startsWith('PARADOXE') ? "text-warning" :
                        "text-info";

                return (
                    <Card key={run.id} className="bg-surface/40 border-border hover:border-border transition-all group overflow-hidden">
                        <CardContent className="p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex items-center gap-4 w-full">
                                <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border shadow-inner",
                                    run.status === 'COMPLETED' ? "bg-success/10 border-success/30 text-success" :
                                        run.status === 'FAILED' ? "bg-danger/10 border-danger/30 text-danger" :
                                            "bg-muted/10 border-border/30 text-muted-foreground"
                                )}>
                                    {run.status === 'COMPLETED' ? <Trophy className="w-5 h-5" /> :
                                        run.status === 'FAILED' ? <Skull className="w-5 h-5" /> :
                                            <Ban className="w-5 h-5" />}
                                </div>

                                <div className="min-w-0 flex-grow">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <h4 className={cn("font-bold truncate", difficultyColor)}>
                                            {run.difficulty.replace('_', ' ')}
                                        </h4>
                                        <Badge variant="outline" className="text-caption uppercase font-black tracking-tight bg-surface/50">
                                            {run._count.floors} ÉTAGES
                                        </Badge>
                                        <Badge variant="secondary" className={cn(
                                            "text-caption h-4 px-1.5 font-bold",
                                            run.status === 'COMPLETED' ? "bg-success/20 text-success" :
                                                run.status === 'FAILED' ? "bg-danger/20 text-danger" :
                                                    "bg-elevated text-muted-foreground"
                                        )}>
                                            {run.status === 'COMPLETED' ? 'SUCCÈS' : run.status === 'FAILED' ? 'ÉCHEC' : 'ABANDON'}
                                        </Badge>
                                    </div>
                                    <div className="text-caption font-medium text-muted-foreground mt-0.5">
                                        {run.completedAt ? format(new Date(run.completedAt), "d MMM yyyy 'à' HH:mm", { locale: fr }) : 'Date inconnue'}
                                    </div>
                                </div>
                            </div>

                            <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end">
                                <div className="flex -space-x-2 overflow-hidden">
                                    {run.members.map((member: any) => {
                                        const profile = member.user?.profiles?.[0];
                                        const pseudo = profile?.pseudoDofus || member.user?.name || "?";
                                        const classe = profile?.classe;

                                        return (
                                            <div
                                                key={member.id}
                                                className="relative inline-block h-8 w-8 rounded-full ring-2 ring-zinc-900 bg-elevated flex items-center justify-center overflow-hidden hover:z-10 transition-all border border-border"
                                                title={`${pseudo} (${classe || "Inconnue"})`}
                                            >
                                                {member.user?.image ? (
                                                    <Image src={member.user.image} alt={pseudo} fill className="object-cover opacity-60 group-hover:opacity-100 transition-opacity" />
                                                ) : (
                                                    <div className="text-caption font-bold text-muted-foreground uppercase">{pseudo.slice(0, 2)}</div>
                                                )}
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                                                <div className="absolute bottom-0 inset-x-0 h-0.5 bg-info opacity-0 group-hover:opacity-100" />
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="text-right shrink-0">
                                    <div className="text-sm font-black text-danger leading-none">
                                        {run.pointsReve || 0} PR
                                    </div>
                                    <div className="text-caption font-bold text-muted-foreground uppercase tracking-tighter mt-1">
                                        SCORE FINAL
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                );
            })}
        </div>
    );
}
