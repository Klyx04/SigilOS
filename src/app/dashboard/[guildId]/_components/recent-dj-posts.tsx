"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    Users, 
    Sword, 
    ArrowRight,
    Search,
    InfinityIcon,
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
        <Card className="border-border h-full flex flex-col overflow-hidden">
            <CardHeader className="pb-4 pt-6 px-6">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-caption font-black uppercase tracking-widest text-guild flex items-center gap-2">
                        <Sword className="w-3 h-3" />
                        Groupes & Activités
                    </CardTitle>
                    <Link href={`/dashboard/${guildId}/donjons-et-quetes`} className="text-caption font-black text-muted-foreground hover:text-guild uppercase tracking-widest border border-border px-2 py-1 rounded-md transition-colors">
                        Voir tout
                    </Link>
                </div>
            </CardHeader>
            
            <CardContent className="flex-1 space-y-3 px-6 pb-6">
                {displayGroups.length > 0 ? (
                    displayGroups.map((group) => {
                        const isDream = group.type === "DREAM";
                        const isQuest = group.type === "QUEST";
                        const href = isDream 
                            ? `/dashboard/${guildId}/songes/${group.id}` 
                            : `/dashboard/${guildId}/donjons-et-quetes`;

                        return (
                            <Link key={group.id} href={href}>
                                <div className="p-3 rounded-xl bg-surface border border-border hover:bg-elevated transition-colors flex items-center gap-4 group/item hover:border-success/20">
                                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-border relative bg-surface flex items-center justify-center">
                                        {group.imageUrl ? (
                                            <NextImage 
                                                src={group.imageUrl} 
                                                alt={group.title} 
                                                fill 
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="text-info">
                                                {isQuest ? <ScrollText className="w-5 h-5" /> : <Search className="w-5 h-5" />}
                                            </div>
                                        )}
                                        {isDream && (
                                            <div className="absolute inset-0 bg-success/20 flex items-center justify-center">
                                                <InfinityIcon className="w-5 h-5 text-success drop-shadow-[0_0_8px_rgba(52,211,153,0.5)]" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-body-sm font-black text-foreground truncate leading-none mb-1">
                                                {group.title}
                                            </h4>
                                            <Badge variant="outline" className={`text-caption py-0 px-1 border-border font-black h-3.5 ${isDream ? 'text-success bg-success/5' : 'text-muted-foreground'}`}>
                                                {isDream ? 'SONGES' : `Lvl ${group.level}`}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Avatar className="h-3 w-3">
                                                <AvatarImage src={group.authorImage ?? undefined} />
                                                <AvatarFallback className="text-caption">{group.authorName[0]}</AvatarFallback>
                                            </Avatar>
                                            <p className="text-caption text-muted-foreground font-bold truncate">par {group.authorName}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                                        <div className={`flex items-center gap-1 text-caption font-black ${group.participantsCount >= group.maxMembers ? 'text-warning' : 'text-success'}`}>
                                            <Users className="w-3 h-3" />
                                            {group.participantsCount}/{group.maxMembers}
                                        </div>
                                        <div className={`text-caption font-black uppercase tracking-tighter transition-colors ${isDream ? 'text-success' : 'text-muted-foreground hover:text-info'}`}>
                                            REJOINDRE
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 text-muted-foreground italic border border-dashed border-border rounded-2xl">
                        <Search className="w-8 h-8 opacity-20 mb-2" />
                        <p className="text-caption uppercase font-black tracking-widest">Aucun groupe en cours</p>
                        <p className="text-caption mt-1 opacity-60">Soyez le premier à recruter !</p>
                    </div>
                )}
                
                {displayGroups.length > 0 && (
                    <Link href={`/dashboard/${guildId}/donjons-et-quetes`} className="flex items-center justify-center gap-2 text-caption font-black text-muted-foreground hover:text-info uppercase tracking-widest pt-2 transition-colors">
                        Rejoindre un groupe <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </Link>
                )}
            </CardContent>
        </Card>
    );
}

