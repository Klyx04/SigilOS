"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Sparkles, ArrowRight, Clock } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";
import { cn } from "@/lib/utils";
import NextImage from "next/image";

export function LadderPreview({
    guildId,
    topLadder
}: {
    guildId: string;
    topLadder: any[]
}) {
    return (
        <Card className="glass-premium h-full overflow-hidden group hover:border-yellow-500/30 transition-all border-white/10 relative">
            {/* Background Glow */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/5 blur-[80px] group-hover:bg-yellow-500/10 transition-colors pointer-events-none" />
            
            <CardContent className="p-0 h-full flex flex-row relative" >
                <div className="p-5 flex-1 flex flex-col justify-between min-w-0">
                    <div className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                            <span className="text-caption font-black text-yellow-500/80 uppercase tracking-widest block italic">PANTHÉON DU SIGIL</span>
                            <h3 className="text-lg font-black text-white flex items-center gap-2 tracking-tighter uppercase italic">
                                <Trophy className="w-4 h-4 text-yellow-400 animate-pulse" />
                                Top Activité
                            </h3>
                        </div>
                        <Link href={`/dashboard/${guildId}/ladder`} className="flex items-center gap-1 group/link shrink-0">
                            <div className="text-caption font-black text-zinc-500 group-hover/link:text-white uppercase tracking-widest transition-colors flex items-center gap-1">
                                <span className="hidden sm:inline">Voir tout</span>
                                <ArrowRight className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
                            </div>
                        </Link>
                    </div>

                    <div className="flex items-center gap-3 py-1 overflow-x-auto scrollbar-hide">
                        {topLadder.length > 0 ? (
                            topLadder.slice(0, 3).map((entry, i) => {
                                const displayName = entry.pseudoDofus || entry.discordNickname || "Aventurier";
                                return (
                                    <motion.div
                                        key={entry.profileId}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.1 }}
                                        className={cn(
                                            "flex items-center gap-3 bg-white/[0.04] border border-white/5 p-2 pr-4 rounded-xl hover:bg-white/10 transition-all cursor-default shrink-0 group/entry",
                                            i === 0 && "border-yellow-500/20 bg-yellow-500/5"
                                        )}
                                    >
                                        <div className="relative">
                                            <Avatar className={cn(
                                                "h-10 w-10 border-2 border-white/10 shadow-2xl transition-transform group-hover/entry:rotate-6",
                                                i === 0 && "border-yellow-500/40"
                                            )}>
                                                <AvatarImage src={entry.discordImage || ""} />
                                                <AvatarFallback className="bg-zinc-800 text-caption font-black uppercase">
                                                    {displayName.substring(0, 2)}
                                                </AvatarFallback>
                                            </Avatar>
                                            <div className="absolute -top-1.5 -right-1.5 z-10">
                                                {i === 0 && (
                                                    <div className="bg-yellow-500 rounded-full p-0.5 ">
                                                        <Trophy className="w-3 h-3 text-black" />
                                                    </div>
                                                )}
                                                {i === 1 && (
                                                    <div className="bg-zinc-300 rounded-full p-0.5 shadow-lg">
                                                        <Medal className="w-3 h-3 text-black" />
                                                    </div>
                                                )}
                                                {i === 2 && (
                                                    <div className="bg-amber-700 rounded-full p-0.5 shadow-lg">
                                                        <Medal className="w-3 h-3 text-black" />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col min-w-0">
                                            <span className="text-caption font-black text-white truncate max-w-[80px] leading-tight uppercase tracking-tight">
                                                {displayName}
                                            </span>
                                            <div className="flex items-center gap-1.5 text-zinc-500 group-hover/entry:text-yellow-500/80 transition-colors">
                                                <div className="relative w-3.5 h-3.5 opacity-80">
                                                    <NextImage src="/PA.png" fill alt="XP" className="object-contain" />
                                                </div>
                                                <span className="text-caption font-mono font-black tracking-tighter">{entry.value}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                );
                            })
                        ) : (
                            <div className="flex items-center gap-4 py-2 px-4 rounded-2xl bg-white/[0.02] border border-white/5 opacity-50">
                                <div className="p-2 rounded-xl bg-zinc-800/50">
                                    <Sparkles className="w-6 h-6 text-zinc-600 animate-pulse" />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-caption font-black uppercase tracking-widest text-zinc-400">Arène Vide</p>
                                    <p className="text-caption font-bold text-zinc-600 uppercase">Soyez le premier à briller cette semaine !</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                <div className="hidden lg:flex w-32 bg-yellow-500/[0.03] border-l border-white/5 p-4 flex-col items-center justify-center relative overflow-hidden group-hover:bg-yellow-500/[0.06] transition-all">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(234,179,8,0.1),transparent_70%)] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    <div className="relative">
                        <Trophy className="w-12 h-12 text-yellow-500/20 group-hover:text-yellow-500/40 group-hover:scale-125 group-hover:rotate-12 transition-all duration-300" />
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                            className="absolute -inset-4 border border-dashed border-yellow-500/10 rounded-full"
                        />
                         <motion.div
                            animate={{ rotate: -360 }}
                            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                            className="absolute -inset-2 border border-dotted border-yellow-500/20 rounded-full"
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
