"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
    Trophy, 
    Crown,
    Star,
    Flame
} from "lucide-react";
import { LadderEntry } from "@/server/actions/ladder-actions";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export function TopActivityWidget({ 
    entries = []
}: { 
    entries?: LadderEntry[];
}) {
    // Only take top 3
    const top3 = entries.slice(0, 3);
    const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] : top3;

    if (entries.length === 0) return null;

    return (
        <Card className="glass-premium border-white/5 relative overflow-hidden group">
            <CardHeader className="pb-2 pt-6">
                <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-yellow-500 flex items-center gap-2">
                    <Trophy className="w-3 h-3" />
                    Top Activité Missions
                </CardTitle>
            </CardHeader>
            
            <CardContent className="pt-4 pb-8">
                <div className="flex items-end justify-center gap-2 md:gap-4 h-48">
                    {podiumOrder.map((entry, idx) => {
                        if (!entry) return null;
                        
                        // Original rank (idx in podiumOrder is not rank)
                        const rank = entry.rank;
                        const isFirst = rank === 1;
                        const isSecond = rank === 2;
                        
                        const height = isFirst ? "h-40" : isSecond ? "h-32" : "h-28";
                        const avatarSize = isFirst ? "h-16 w-16" : "h-12 w-12";
                        const name = entry.pseudoDofus || entry.discordNickname || "Membre";

                        return (
                            <div key={entry.profileId} className={cn("flex flex-col items-center gap-3 relative", height)}>
                                <div className="relative group/avatar">
                                    {isFirst && <Crown className="w-6 h-6 text-yellow-400 absolute -top-5 left-1/2 -translate-x-1/2 drop-shadow-[0_0_10px_rgba(250,204,21,0.5)] animate-bounce" />}
                                    
                                    <Avatar className={cn(avatarSize, "ring-2 ring-white/10 group-hover/avatar:ring-yellow-500/50 transition-all duration-500")}>
                                        <AvatarImage src={entry.discordImage ?? undefined} />
                                        <AvatarFallback className="text-sm font-black text-white bg-zinc-800">{name[0]}</AvatarFallback>
                                    </Avatar>
                                    
                                    <div className={cn(
                                        "absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded-full text-[8px] font-black border border-white/10 shadow-xl",
                                        isFirst ? "bg-yellow-500 text-black" : "bg-zinc-800 text-white"
                                    )}>
                                        #{rank}
                                    </div>
                                </div>
                                
                                <div className="text-center w-full max-w-[80px]">
                                    <p className="text-[10px] font-black text-white truncate uppercase italic">{name}</p>
                                    <p className="text-[9px] font-bold text-emerald-400">{entry.value} pts</p>
                                </div>

                                {/* Base structure */}
                                <div className={cn(
                                    "absolute bottom-0 w-full rounded-t-xl bg-gradient-to-t border-t border-x border-white/5 -z-10",
                                    isFirst ? "from-yellow-500/10 to-yellow-500/20 h-16" : "from-white/5 to-white/10 h-10"
                                )} />
                            </div>
                        );
                    })}
                </div>
            </CardContent>
            
            <div className="absolute -bottom-8 -left-8 opacity-[0.03] group-hover:opacity-[0.06] transition-opacity">
                <Flame className="w-32 h-32 text-yellow-500" />
            </div>
            <div className="absolute top-2 right-2 opacity-[0.05]">
                <Star className="w-4 h-4 text-emerald-500 animate-pulse" />
            </div>
        </Card>
    );
}
