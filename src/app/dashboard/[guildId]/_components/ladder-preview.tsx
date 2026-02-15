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
        <Card className="glass-premium h-full overflow-hidden group bg-zinc-950/20 hover:border-indigo-500/30 transition-all border-white/5">
            <CardContent className="p-0 h-full flex flex-col sm:flex-row">
                <div className="p-6 flex-1 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Gloire Locale</span>
                            <h3 className="text-lg font-black text-white flex items-center gap-2 tracking-tighter">
                                <Trophy className="w-4 h-4 text-yellow-400" />
                                Hall of Fame
                            </h3>
                        </div>
                        <Link href={`/dashboard/${guildId}/ladder`} className="flex items-center gap-1 group/link">
                            <div className="text-[9px] font-black text-zinc-500 hover:text-white uppercase tracking-widest transition-colors flex items-center gap-1">
                                Classement complet
                                <ArrowRight className="w-3 h-3 group-hover/link:translate-x-1 transition-transform" />
                            </div>
                        </Link>
                    </div>

                    <div className="flex items-center gap-4 py-2">
                        {topLadder.length > 0 ? (
                            topLadder.slice(0, 3).map((entry, i) => (
                                <motion.div
                                    key={entry.userId}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: i * 0.1 }}
                                    className="flex items-center gap-3 bg-white/[0.03] border border-white/5 p-2 pr-4 rounded-xl hover:bg-white/5 transition-colors cursor-default"
                                >
                                    <div className="relative">
                                        <Avatar className="h-10 w-10 border border-white/10 ring-2 ring-zinc-950">
                                            <AvatarImage src={entry.image || ""} />
                                            <AvatarFallback className="bg-zinc-800 text-[10px] font-black uppercase">
                                                {entry.name.substring(0, 2)}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div className="absolute -top-1 -right-1">
                                            {i === 0 && <Medal className="w-4 h-4 text-yellow-400 drop-shadow-sm" />}
                                            {i === 1 && <Medal className="w-4 h-4 text-zinc-400 drop-shadow-sm" />}
                                            {i === 2 && <Medal className="w-4 h-4 text-amber-700 drop-shadow-sm" />}
                                        </div>
                                    </div>
                                    <div className="flex flex-col">
                                        <span className="text-[10px] font-black text-white truncate max-w-[80px] leading-tight">
                                            {entry.name}
                                        </span>
                                        <div className="flex items-center gap-1 text-zinc-500">
                                            <span className="text-[9px] font-black tracking-tight">{entry.points}</span>
                                            <Sparkles className="w-2 h-2 text-indigo-400" />
                                        </div>
                                    </div>
                                </motion.div>
                            ))
                        ) : (
                            <div className="w-full py-4 flex flex-col items-center justify-center text-center opacity-40">
                                <div className="p-3 rounded-full bg-white/5 mb-3">
                                    <Trophy className="w-6 h-6 text-zinc-600" />
                                </div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
                                    L'arène est encore calme.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Visual Flair Side */}
                <div className="w-full sm:w-32 bg-indigo-500/5 sm:border-l border-white/5 p-6 flex flex-col items-center justify-center relative group-hover:bg-indigo-500/10 transition-colors">
                    <div className="relative">
                        <Trophy className="w-12 h-12 text-indigo-500/20 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500" />
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                            className="absolute -inset-2 border border-dashed border-indigo-500/20 rounded-full"
                        />
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}
