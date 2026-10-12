"use client";

import { useState, useEffect } from "react";
import { Award, Shield, Sparkles, Check, Users, Lock, Info } from "lucide-react";
import { getProfileBadgesAction } from "@/server/actions/badge-actions";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const RARITY_STYLES = {
    COMMON: { label: "Commun", border: "border-slate-500/30", bg: "bg-slate-500/10 text-slate-400", glow: "shadow-slate-500/5" },
    RARE: { label: "Rare", border: "border-sky-500/30", bg: "bg-sky-500/10 text-sky-400", glow: "shadow-sky-500/15 border-sky-500/40" },
    EPIC: { label: "Épique", border: "border-violet-500/30", bg: "bg-violet-500/10 text-violet-400", glow: "shadow-violet-500/20 border-violet-500/40" },
    LEGENDARY: { label: "Légendaire", border: "border-amber-500/30", bg: "bg-amber-500/10 text-amber-400", glow: "shadow-amber-500/25 border-amber-500/50" },
    MYTHIC: { label: "Mythique", border: "border-rose-500/30", bg: "bg-rose-500/10 text-rose-400", glow: "shadow-rose-500/30 border-rose-500/50" },
};

interface BadgesVitrineProps {
    profileId: string;
    displayName: string;
}

export function BadgesVitrine({ profileId, displayName }: BadgesVitrineProps) {
    const [badges, setBadges] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        getProfileBadgesAction(profileId).then((res) => {
            if (mounted) {
                if (res.success && res.data) {
                    setBadges(res.data);
                }
                setLoading(false);
            }
        });
        return () => {
            mounted = false;
        };
    }, [profileId]);

    if (loading) {
        return (
            <div className="p-6 rounded-3xl bg-surface/40 border border-border animate-pulse space-y-4">
                <div className="h-6 w-48 bg-muted rounded-xl" />
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-24 bg-muted/60 rounded-2xl" />
                    ))}
                </div>
            </div>
        );
    }

    if (badges.length === 0) {
        return (
            <div className="p-8 text-center rounded-3xl bg-surface/30 border border-dashed border-border/80 space-y-2">
                <Award className="w-8 h-8 mx-auto text-muted-foreground/40" />
                <h4 className="text-sm font-bold text-foreground">Vitrine de Badges (#198.2)</h4>
                <p className="text-xs text-muted-foreground">
                    {displayName} n'a pas encore débloqué de badge ou de distinction sur SigilOS.
                </p>
            </div>
        );
    }

    return (
        <div className="p-6 rounded-3xl bg-surface/40 border border-border space-y-5">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
                        <Award className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-foreground uppercase tracking-wider">
                            Badges & Trophées ({badges.length})
                        </h3>
                        <p className="text-[11px] text-muted-foreground">Distinctions et succès obtenus sur la plateforme</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {badges.map((b) => {
                    const rarity = RARITY_STYLES[b.rarity as keyof typeof RARITY_STYLES] || RARITY_STYLES.COMMON;
                    const dateFormatted = new Date(b.unlockedAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        year: "numeric"
                    });

                    return (
                        <div
                            key={b.id}
                            className={cn(
                                "p-3.5 rounded-2xl bg-surface/60 border transition-all flex items-center gap-3 relative group overflow-hidden shadow-sm",
                                rarity.border,
                                rarity.glow
                            )}
                        >
                            <div className="w-12 h-12 rounded-xl bg-background border border-border flex items-center justify-center p-1.5 shrink-0 group-hover:scale-105 transition-transform overflow-hidden shadow-inner">
                                <img
                                    src={b.imageUrl}
                                    alt={b.name}
                                    className="w-full h-full object-contain drop-shadow"
                                    onError={(e) => {
                                        (e.target as any).src = "https://api.iconify.design/lucide:award.svg";
                                    }}
                                />
                            </div>

                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between gap-1 mb-0.5">
                                    <span className="font-bold text-foreground text-xs truncate">{b.name}</span>
                                    <Badge variant="outline" className={cn("text-[9px] font-black uppercase px-1.5 py-0 shrink-0", rarity.bg)}>
                                        {rarity.label}
                                    </Badge>
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate" title={b.description || ""}>
                                    {b.description || b.reason || "Succès débloqué"}
                                </p>
                                <span className="text-[9px] font-medium text-muted-foreground/70 block mt-1">
                                    Obtenu le {dateFormatted}
                                </span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
