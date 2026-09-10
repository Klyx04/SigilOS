"use client";

import {
    Users,
    ArrowRight,
    Search,
    ScrollText
} from "lucide-react";
import Link from "next/link";
import { UnifiedGroup } from "@/server/actions/unified-groups-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import NextImage from "next/image";

export function RecentDjPosts({
    guildId,
    groups = []
}: {
    guildId: string;
    groups?: UnifiedGroup[];
}) {
    // Show up to 5 active groups
    const displayGroups = (groups || []).slice(0, 5);

    return (
        <div className="rounded-xl border border-border bg-card px-4 py-3.5">
            <div className="flex items-center justify-between gap-3 mb-3">
                <h2 className="text-sm font-semibold text-foreground">
                    Groupes{displayGroups.length > 0 && (
                        <span className="ml-2 text-xs font-medium text-muted-foreground tabular-nums">{displayGroups.length}</span>
                    )}
                </h2>
                <Link href={`/dashboard/${guildId}/donjons-et-quetes`} className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                    Voir tout
                </Link>
            </div>

            <div className="space-y-2">
                {displayGroups.length > 0 ? (
                    displayGroups.map((group) => {
                        const isDream = group.type === "DREAM";
                        const isQuest = group.type === "QUEST";
                        const href = isDream
                            ? `/dashboard/${guildId}/songes/${group.id}`
                            : `/dashboard/${guildId}/donjons-et-quetes`;
                        const isFull = group.participantsCount >= group.maxMembers;

                        return (
                            <Link key={group.id} href={href}>
                                <div className="p-2.5 rounded-xl border border-border hover:border-border-strong hover:bg-surface transition-colors flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-border relative bg-surface flex items-center justify-center">
                                        {group.imageUrl ? (
                                            <NextImage
                                                src={group.imageUrl}
                                                alt={group.title}
                                                fill
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="text-muted-foreground">
                                                {isQuest ? <ScrollText className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-xs font-semibold text-foreground truncate">
                                                {group.title}
                                            </h4>
                                            <span className="text-xs text-muted-foreground shrink-0">
                                                {isDream ? "Songes" : `Niv. ${group.level}`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <Avatar className="h-3.5 w-3.5">
                                                <AvatarImage src={group.authorImage ?? undefined} />
                                                <AvatarFallback className="text-[9px]">{group.authorName[0]}</AvatarFallback>
                                            </Avatar>
                                            <p className="text-xs text-muted-foreground truncate">par {group.authorName}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1.5 text-xs tabular-nums shrink-0 ml-2">
                                        <Users className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span className={isFull ? "text-warning font-semibold" : "text-muted-foreground"}>
                                            {group.participantsCount}/{group.maxMembers}
                                        </span>
                                        {!isFull && <ArrowRight className="w-3.5 h-3.5 text-muted-foreground" />}
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                ) : (
                    <div className="py-6 text-center">
                        <p className="text-xs text-muted-foreground">Aucun groupe en cours</p>
                        <Link href={`/dashboard/${guildId}/donjons-et-quetes`} className="text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors">
                            Créer un groupe →
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}

