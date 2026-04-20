"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    Users, 
    Sword, 
    ArrowRight,
    Search
} from "lucide-react";
import Link from "next/link";
import { DjPostWithDetails } from "@/server/actions/dungeon-finder-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import NextImage from "next/image";

export function RecentDjPosts({ 
    guildId,
    posts = []
}: { 
    guildId: string;
    posts?: DjPostWithDetails[];
}) {
    // Show up to 5 active posts to fill space
    const displayPosts = (posts || []).slice(0, 5);

    return (
        <Card className="glass-premium border-white/5 h-full flex flex-col overflow-hidden group">
            <CardHeader className="pb-4 pt-6 px-6">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2">
                        <Sword className="w-3 h-3" />
                        Donjons & Quêtes
                    </CardTitle>
                    <Link href={`/dashboard/${guildId}/donjons-et-quetes`} className="text-[8px] font-black text-zinc-600 hover:text-indigo-400 uppercase tracking-widest border border-white/5 px-2 py-1 rounded-md transition-all">
                        Voir tout
                    </Link>
                </div>
            </CardHeader>
            
            <CardContent className="flex-1 space-y-3 px-6 pb-6">
                {displayPosts.length > 0 ? (
                    displayPosts.map((post) => {
                        const isDungeon = post.mode === "DONJON";
                        const name = isDungeon ? post.dungeon?.name : post.questName;
                        const participantsCount = (post as any)._acceptedCount || 0;
                        const authorName = post.profile?.pseudoDofus || post.profile?.discordNickname || "Membre";

                        return (
                            <Link key={post.id} href={`/dashboard/${guildId}/donjons-et-quetes`}>
                                <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] hover:border-indigo-500/20 transition-all flex items-center gap-4 group/item">
                                    <div className="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-white/10 relative bg-zinc-900">
                                        {isDungeon && post.dungeon?.imageUrl ? (
                                            <NextImage 
                                                src={post.dungeon.imageUrl} 
                                                alt={name || ""} 
                                                fill 
                                                className="object-cover"
                                            />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-indigo-400">
                                                <Search className="w-5 h-5" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2">
                                            <h4 className="text-[13px] font-black text-white truncate leading-none mb-1">
                                                {name || "Groupe sans nom"}
                                            </h4>
                                            <Badge variant="outline" className="text-[8px] py-0 px-1 border-white/5 text-zinc-500 font-black h-3.5">
                                                Lvl {post.dungeon?.level || "?"}
                                            </Badge>
                                        </div>
                                        <div className="flex items-center gap-2 mt-0.5">
                                            <Avatar className="h-3 w-3">
                                                <AvatarImage src={post.profile?.user?.image ?? undefined} />
                                                <AvatarFallback className="text-[6px]">{authorName[0]}</AvatarFallback>
                                            </Avatar>
                                            <p className="text-[10px] text-zinc-500 font-bold truncate">par {authorName}</p>
                                        </div>
                                    </div>
                                    <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                                        <div className="flex items-center gap-1 text-emerald-400 text-[11px] font-black">
                                            <Users className="w-3 h-3" />
                                            {participantsCount + 1}/{post.maxMembers}
                                        </div>
                                        <div className="text-[8px] text-zinc-600 font-black uppercase tracking-tighter hover:text-indigo-400 transition-colors">
                                            REJOINDRE
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center py-10 text-zinc-600 italic border border-dashed border-white/5 rounded-2xl">
                        <Search className="w-8 h-8 opacity-20 mb-2" />
                        <p className="text-[10px] uppercase font-black tracking-widest">Aucun groupe en cours</p>
                        <p className="text-[9px] mt-1 opacity-60">Soyez le premier à recruter !</p>
                    </div>
                )}
                
                {displayPosts.length > 0 && (
                    <Link href={`/dashboard/${guildId}/donjons-et-quetes`} className="flex items-center justify-center gap-2 text-[10px] font-black text-zinc-600 hover:text-white uppercase tracking-widest pt-2 group-hover:text-indigo-400 transition-colors">
                        Rejoindre un groupe <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                    </Link>
                )}
            </CardContent>
        </Card>
    );
}
