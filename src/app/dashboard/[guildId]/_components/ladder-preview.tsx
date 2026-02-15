"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Sparkles, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import Link from "next/link";

export function LadderPreview({
    guildId,
    topLadder
}: {
    guildId: string;
    topLadder: any[]
}) {
    return (
        <Card className="glass-premium h-full overflow-hidden group hover:border-indigo-500/30 transition-all border-white/10">
            <CardContent className="p-0 h-full flex flex-row relative">
                <div className="p-5 flex-1 flex flex-col justify-between min-w-0">
                    <div className="flex items-center justify-between gap-4">
                        <div className="space-y-0.5">
                            <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.3em] block">Hebdomadaire</span>
                            <h3 className="text-lg font-black text-white flex items-center gap-2 tracking-tighter">
                                <Trophy className="w-4 h-4 text-yellow-400" />
                                Top Activité
                            </h3>
                        </div>
                        <Link href={`/dashboard/${guildId}/ladder`} className="flex items-center gap-1 group/link shrink-0">
                            <div className="text-[9px] font-black text-zinc-500 group-hover/link:text-white uppercase tracking-widest transition-colors flex items-center gap-1">
                                <span className="hidden sm:inline">Classement complet</span>
                                <span className="sm:hidden">Voir tout</span>
                                <ArrowRight className="w-3 h-3 group-hover/link:translate-x-0.5 transition-transform" />
                            </div>
                        </Link>
                    </div>

                    <div className="flex items-center gap-3 py-1 overflow-x-auto scrollbar-hide">
                        {topLadder.length > 0 ? (
                            topLadder.slice(0, 3).map((entry, i) => (
                                <motion.div
                                    key={entry.userId}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex items-center gap-2.5 bg-white/[0.03] border border-white/5 p-1.5 pr-3 rounded-lg hover:bg-white/5 transition-colors cursor-default shrink-0"
                                >
                                    <div className="relative">
                                        <Avatar className="h-9 w-9 border border-white/10 ring-1 ring-zinc-950">
                                            <AvatarImage src={entry.image || ""} />
                                            <AvatarFallback className="bg-zinc-800 text-[9px] font-black uppercase">
                                                {entry.name.substring(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -top-1 -right-1">
                                            {i === 0 && <Medal className="w-3.5 h-3.5 text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.3)]" />}
                                            {i === 1 && <Medal className="w-3.5 h-3.5 text-zinc-400 drop-shadow-sm" />}
                                            {i === 2 && <Medal className="w-3.5 h-3.5 text-amber-700 drop-shadow-sm" />}
                                        </div>
                                    </div>
                                    <div className="flex flex-col min-w-0">
                                        <span className="text-[10px] font-black text-white truncate max-w-[70px] leading-tight">
                                            {entry.name}
                                        </span>
                                        <div className="flex items-center gap-1 text-zinc-500">
                                            <span className="text-[9px] font-black tracking-tight">{entry.points}</span>
                                            <Sparkles className="w-1.5 h-1.5 text-indigo-400" />
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="flex items-center gap-3 opacity-40">
                                <div className="p-2 rounded-lg bg-white/5">
                                    <Trophy className="w-5 h-5 text-zinc-600" />
                                </div>
                                <p className="text-[9px] font-black uppercase tracking-widest text-zinc-600">
                                    L'arène est calme.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Fixed Visual Flair Side - Absolute on very small, fixed width on others */}
                <div className="hidden sm:flex w-28 bg-indigo-500/5 border-l border-white/5 p-4 flex-col items-center justify-center relative group-hover:bg-indigo-500/10 transition-colors h-full">
                    <div className="relative">
                        <Trophy className="w-10 h-10 text-indigo-500/20 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500" />
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                            className="absolute -inset-3 border border-dashed border-indigo-500/20 rounded-full"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-1 h-1 rounded-full bg-indigo-500/40 animate-pulse" />
                        </div>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
