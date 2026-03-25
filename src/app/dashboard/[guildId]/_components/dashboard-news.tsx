"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    Calendar, 
    Sparkles,
    Flame
} from "lucide-react";
import { cn } from "@/lib/utils";
import NextImage from "next/image";
import Link from "next/link";
import { NewsGrid } from "@/components/ressources/NewsGrid";
import { useState } from "react";
import { AlmanaxItem } from "@/server/actions/resources-actions";

export function DashboardNews({ 
    guildId,
    initialAlmanax
}: { 
    guildId: string;
    initialAlmanax?: AlmanaxItem | null;
}) {
    const [almanax] = useState<AlmanaxItem | null>(initialAlmanax ?? null);
    const loadingAlmanax = false;

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-4">
            {/* --- ALMANAX CARD (4 columns) --- */}
            <Card className="lg:col-span-4 glass-premium relative overflow-hidden group border-white/5 hover:border-amber-500/20 transition-all min-h-[400px] flex flex-col">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500/40 via-orange-500/40 to-amber-500/40 opacity-50" />
                
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500 flex items-center gap-2">
                            <Calendar className="w-3 h-3" />
                            Almanax du Jour
                        </CardTitle>
                        <Badge variant="outline" className="border-white/5 text-[8px] font-black uppercase text-zinc-500 tracking-tighter">Meryde</Badge>
                    </div>
                </CardHeader>
                
                <CardContent className="space-y-6 flex-1 flex flex-col justify-center">
                    {almanax ? (
                        <div className="space-y-6 animate-in fade-in duration-700">
                            {/* Tribute / Offrande */}
                            <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/[0.03] border border-white/5 group-hover:bg-white/[0.05] transition-colors">
                                <div className="relative w-16 h-16 bg-zinc-900 rounded-xl border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-2xl">
                                    <NextImage 
                                        src={almanax.tribute.item.image_urls.icon} 
                                        alt={almanax.tribute.item.name}
                                        fill
                                        className="object-contain p-2"
                                        unoptimized
                                    />
                                    <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-[10px] font-black px-1.5 rounded-sm shadow-xl">
                                        x{almanax.tribute.quantity}
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[9px] font-black text-zinc-500 uppercase tracking-widest leading-none">Offrande</p>
                                    <h4 className="text-base font-black text-white leading-tight uppercase italic">{almanax.tribute.item.name}</h4>
                                    {almanax.reward_kamas && (
                                        <div className="text-[10px] font-bold text-amber-500/80">+{almanax.reward_kamas.toLocaleString()} kamas</div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Bonus Card */}
                            <div className="bg-amber-500/5 border border-amber-500/10 p-5 rounded-2xl relative overflow-hidden flex-1 group/bonus">
                                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/bonus:scale-125 transition-transform duration-700">
                                    <Sparkles className="w-12 h-12 text-amber-400" />
                                </div>
                                <div className="relative z-10 space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest italic">{almanax.bonus.type?.name || "Bonus du jour"}</p>
                                    </div>
                                    <p className="text-sm font-bold text-zinc-300 leading-relaxed italic tracking-tight">
                                        « {almanax.bonus.description} »
                                    </p>
                                </div>
                                <div className="absolute -bottom-4 -right-4 opacity-5 pointer-events-none">
                                    <Flame className="w-24 h-24 text-amber-500" />
                                </div>
                            </div>

                            <Link href={`/dashboard/${guildId}/ressources?tab=almanax`} className="block text-center text-[10px] font-black text-zinc-600 hover:text-amber-500 uppercase tracking-[0.2em] transition-colors py-2">
                                Voir les prochains jours →
                            </Link>
                        </div>
                    ) : loadingAlmanax ? (
                        <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-pulse">
                            <div className="w-12 h-12 rounded-full bg-white/5 border border-white/10" />
                            <div className="h-2 w-32 bg-white/5 rounded-full" />
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-zinc-600 space-y-3 italic">
                            <Calendar className="w-10 h-10 opacity-20" />
                            <div className="text-center">
                                <p className="text-[10px] font-black uppercase tracking-widest">Oracle indisponible</p>
                                <p className="text-[8px] uppercase tracking-tighter opacity-60">Vérifiez l'onglet Ressources</p>
                            </div>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* --- NEWS FEED (8 columns) --- */}
            <Card className="lg:col-span-8 glass-premium border-white/5 hover:border-indigo-500/20 transition-all overflow-hidden flex flex-col">
                <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-400 flex items-center gap-2">
                            <Sparkles className="w-3 h-3" />
                            Échos du Monde des Douze
                        </CardTitle>
                        <Link href={`/dashboard/${guildId}/ressources?tab=news`} className="text-[8px] font-black text-zinc-600 hover:text-indigo-400 uppercase border border-white/5 px-2 py-1 rounded-md transition-all">
                            Voir tout
                        </Link>
                    </div>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                    <div className="px-6 pb-6">
                        <NewsGrid 
                            defaultFeed="news" 
                            hideSelector={false} 
                            maxItems={4} 
                        />
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
