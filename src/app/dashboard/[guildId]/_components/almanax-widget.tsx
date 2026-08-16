"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
    Calendar, 
    Sparkles,
    Flame
} from "lucide-react";
import NextImage from "next/image";
import Link from "next/link";
import { useState } from "react";
import { AlmanaxItem } from "@/server/actions/resources-actions";

export function AlmanaxWidget({ 
    guildId,
    initialAlmanax
}: { 
    guildId: string;
    initialAlmanax?: AlmanaxItem | null;
}) {
    const [almanax] = useState<AlmanaxItem | null>(initialAlmanax ?? null);

    return (
        <Card className="glass-premium relative overflow-hidden group border-white/5 hover:border-amber-500/20 transition-all min-h-[380px] flex flex-col">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500/40 via-teal-500/40 to-emerald-500/40 opacity-50" />
            
            <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                    <CardTitle className="text-caption font-black uppercase tracking-widest text-emerald-400 flex items-center gap-2">
                        <Calendar className="w-3 h-3" />
                        Almanax du Jour
                    </CardTitle>
                    <Badge variant="outline" className="border-border text-caption font-black uppercase text-muted-foreground tracking-tighter">Meryde</Badge>
                </div>
            </CardHeader>
            
            <CardContent className="space-y-6 flex-1 flex flex-col justify-center">
                {almanax ? (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        {/* Tribute / Offrande */}
                        <div className="flex items-start gap-4 p-4 rounded-2xl bg-foreground/[0.02] border border-border group-hover:bg-foreground/[0.04] transition-colors">
                            <div className="relative w-16 h-16 bg-background rounded-xl border border-border flex items-center justify-center overflow-hidden shrink-0 shadow-2xl">
                                <NextImage 
                                    src={almanax.tribute.item.image_urls.icon} 
                                    alt={almanax.tribute.item.name}
                                    fill
                                    className="object-contain p-2"
                                    unoptimized
                                />
                                <div className="absolute -bottom-1 -right-1 bg-amber-500 text-black text-caption font-black px-1.5 rounded-sm shadow-xl">
                                    x{almanax.tribute.quantity}
                                </div>
                            </div>
                            <div className="space-y-1">
                                <p className="text-caption font-black text-muted-foreground uppercase tracking-widest leading-none">Offrande</p>
                                <h4 className="text-sm font-black text-foreground leading-tight uppercase italic truncate max-w-[150px]">{almanax.tribute.item.name}</h4>
                                {almanax.reward_kamas && (
                                    <div className="text-caption font-bold text-amber-600 dark:text-amber-500/80">+{almanax.reward_kamas.toLocaleString()} kamas</div>
                                )}
                            </div>
                        </div>
                        
                        {/* Bonus Card */}
                        <div className="bg-amber-500/5 border border-amber-500/10 p-4 rounded-2xl relative overflow-hidden flex-1 group/bonus">
                            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover/bonus:scale-125 transition-transform duration-300">
                                <Sparkles className="w-10 h-10 text-amber-400" />
                            </div>
                            <div className="relative z-10 space-y-2">
                                <div className="flex items-center gap-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                    <p className="text-caption font-black text-amber-500 uppercase tracking-widest italic">{almanax.bonus.type?.name || "Bonus du jour"}</p>
                                </div>
                                <p className="text-caption font-bold text-muted-foreground leading-relaxed italic tracking-tight line-clamp-3">
                                    « {almanax.bonus.description} »
                                </p>
                            </div>
                        </div>

                        <Link href={`/dashboard/${guildId}/ressources?tab=almanax`} className="block text-center text-caption font-black text-muted-foreground hover:text-amber-600 dark:hover:text-amber-500 uppercase tracking-[0.2em] transition-colors py-2">
                            Voir le calendrier →
                        </Link>
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-12 text-muted-foreground space-y-3 italic">
                        <Calendar className="w-10 h-10 opacity-20" />
                        <div className="text-center">
                            <p className="text-caption font-black uppercase tracking-widest">Oracle indisponible</p>
                        </div>
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
