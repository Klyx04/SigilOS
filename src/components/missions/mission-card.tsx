'use client'

import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Swords,
    Skull,
    Zap,
    Clock,
    Calendar,
    Infinity as InfinityIcon,
    Coins,
    Star,
    Upload
} from "lucide-react";
import { Mission, MissionCategory, MissionInterest, UserProfile } from "@prisma/client";
import { cn } from "@/lib/utils";
import { useState, useTransition } from "react";
import { toggleMissionInterest } from "@/server/actions/mission-actions";
import { toast } from "sonner";

// --- Props ---

interface MissionCardProps {
    mission: Mission & {
        interests: (MissionInterest & { profile: UserProfile })[];
    };
    currentUserId: string; // To check interest status
}

// --- Helpers ---

// --- Helpers ---

const CATEGORY_CONFIG: Record<MissionCategory, { icon: any; color: string; bgColor: string; borderColor: string; label: string }> = {
    DONJON: { icon: Swords, color: "text-rose-400", bgColor: "bg-rose-950/30", borderColor: "border-rose-500/30", label: "Donjon" },
    REGULATION: { icon: Skull, color: "text-emerald-400", bgColor: "bg-emerald-950/30", borderColor: "border-emerald-500/30", label: "Régulation" },
    ANOMALIE: { icon: Zap, color: "text-fuchsia-400", bgColor: "bg-fuchsia-950/30", borderColor: "border-fuchsia-500/30", label: "Anomalie" },
    SONGES: { icon: InfinityIcon, color: "text-cyan-400", bgColor: "bg-cyan-950/30", borderColor: "border-cyan-500/30", label: "Songes" },
    EXPEDITION: { icon: Clock, color: "text-amber-400", bgColor: "bg-amber-950/30", borderColor: "border-amber-500/30", label: "Expédition" },
    EVENT: { icon: Calendar, color: "text-yellow-300", bgColor: "bg-yellow-950/30", borderColor: "border-yellow-500/30", label: "Événement" },
};

// --- Component ---

export function MissionCard({ mission, currentUserId }: MissionCardProps) {
    const [isPending, startTransition] = useTransition();

    // Check if user is interested
    const isInterested = mission.interests.some(i => i.profile.userId === currentUserId);
    const interestCount = mission.interests.length;

    const config = CATEGORY_CONFIG[mission.category];
    const Icon = config.icon;

    // Derived Data
    const payload = mission.payload as any; // Typed loosely for display
    const description = generateDescription(mission.category, payload);

    const handleToggleInterest = () => {
        startTransition(async () => {
            const result = await toggleMissionInterest(mission.id);
            if (result.success) {
                toast.success(isInterested ? "Intérêt retiré" : "Intérêt ajouté !");
            } else {
                toast.error(result.error || "Erreur");
            }
        });
    };

    return (
        <Card className={cn(
            "flex flex-col h-full transition-all duration-300 group relative overflow-hidden",
            "bg-zinc-950 border-zinc-800 hover:border-zinc-600",
            // Glow effect on hover based on category color
            `hover:shadow-[0_0_20px_-5px_var(--glow-color)]`,
            // Apply category-specific glow color variable
            config.color.replace("text-", "").replace("-400", "-500/20") // Hacky way to derive, but cleaner:
        )}
            style={{ "--glow-color": getGlowColor(mission.category) } as React.CSSProperties}
        >
            {/* Ambient Background Gradient */}
            <div className={cn("absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-gradient-to-br from-transparent via-transparent to-white/5 pointer-events-none")} />

            {/* Header: Type, Rank & Level */}
            <CardHeader className="p-4 pb-2 space-y-0 relative z-10">
                <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline" className={cn(
                        "gap-1.5 transition-colors duration-300",
                        config.color, config.bgColor, config.borderColor
                    )}>
                        <Icon className="w-3.5 h-3.5" />
                        {config.label}
                    </Badge>
                    <div className="text-xs font-medium text-zinc-500 flex items-center gap-2">
                        <span className="text-zinc-400">P{mission.tier}</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        <span className="text-zinc-400">Lvl {getTierLevel(mission.tier)}</span>
                    </div>
                </div>
                <h3 className="font-bold text-lg leading-tight text-white line-clamp-1 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-400 transition-all">
                    {mission.title || getAutoTitle(mission.category, payload)}
                </h3>
            </CardHeader>

            {/* Body: Description */}
            <CardContent className="p-4 pt-2 flex-grow relative z-10">
                <p className="text-sm text-zinc-400 line-clamp-3 leading-relaxed">
                    {description}
                </p>
                {/* Visual Payload Details (e.g. Elixir) */}
                {payload.elixir && (
                    <div className="mt-3 text-[10px] uppercase tracking-wider font-semibold text-fuchsia-300 bg-fuchsia-500/10 border border-fuchsia-500/20 px-2 py-1 rounded inline-block shadow-[0_0_10px_-3px_rgba(217,70,239,0.3)]">
                        Elixir: {payload.elixir}
                    </div>
                )}
            </CardContent>

            {/* Footer: Rewards & Actions */}
            <CardFooter className="p-4 pt-0 flex items-center justify-between gap-2 relative z-10">

                {/* Rewards */}
                <div className="flex flex-col gap-0.5">
                    {mission.xpReward && (
                        <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-medium font-mono">
                            <Star className="w-3 h-3 text-indigo-400 fill-indigo-400/20" />
                            {mission.xpReward} XP
                        </div>
                    )}
                    {mission.guildatonsReward && (
                        <div className="flex items-center gap-1.5 text-xs text-amber-300 font-medium font-mono">
                            <Coins className="w-3 h-3 text-amber-400 fill-amber-400/20" />
                            {mission.guildatonsReward} G
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {/* Interest Button */}
                    <Button
                        size="sm"
                        variant="ghost"
                        className={cn(
                            "h-8 px-2 gap-1.5 transition-all duration-300",
                            isInterested
                                ? "bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 hover:text-indigo-200"
                                : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
                        )}
                        onClick={handleToggleInterest}
                        disabled={isPending}
                    >
                        <Star className={cn("w-4 h-4 transition-transform", isInterested ? "fill-indigo-400 text-indigo-400 scale-110" : "text-zinc-600")} />
                        {interestCount > 0 && <span className="text-xs font-mono">{interestCount}</span>}
                    </Button>

                    {/* Submit Button */}
                    <Button size="sm" className="h-8 gap-1.5 bg-zinc-100 text-black hover:bg-white hover:shadow-[0_0_15px_-3px_rgba(255,255,255,0.5)] border-0 transition-all font-semibold">
                        <Upload className="w-3.5 h-3.5" />
                        Valider
                    </Button>
                </div>

            </CardFooter>
        </Card>
    );
}

// Helper to get glow color based on category for inline style
function getGlowColor(category: MissionCategory): string {
    switch (category) {
        case "DONJON": return "rgba(244, 63, 94, 0.4)"; // Rose
        case "REGULATION": return "rgba(52, 211, 153, 0.4)"; // Emerald
        case "ANOMALIE": return "rgba(217, 70, 239, 0.4)"; // Fuchsia
        case "SONGES": return "rgba(34, 211, 238, 0.4)"; // Cyan
        case "EXPEDITION": return "rgba(251, 191, 36, 0.4)"; // Amber
        case "EVENT": return "rgba(253, 224, 71, 0.4)"; // Yellow
        default: return "rgba(255, 255, 255, 0.2)";
    }
}

// --- Utils ---

function getTierLevel(tier: number) {
    switch (tier) {
        case 1: return "1-10";
        case 2: return "11-30";
        case 3: return "31-50";
        case 4: return "51-100";
        case 5: return "101+"; // Palier 5 update
        default: return "???";
    }
}

function getAutoTitle(category: MissionCategory, payload: any) {
    if (payload.boss) return payload.boss;
    if (payload.zone) return `Zone: ${payload.zone}`;
    return "Mission Spéciale";
}

function generateDescription(category: MissionCategory, payload: any) {
    switch (category) {
        case "DONJON": return `Vaincre le ${payload.boss} dans son donjon.`;
        case "ANOMALIE": return `Vaincre un gardien d'anomalie temporelle.`;
        case "EXPEDITION": return `Vaincre le ${payload.boss} dans son expédition.`;
        case "REGULATION": return `Vaincre 50 monstres de la famille ${payload.monsterFamily || 'Monstres'} dans la zone ${payload.zone}.`;
        default: return "Compléter l'objectif demandé.";
    }
}
