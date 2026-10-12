"use client";

import { useState, useEffect } from "react";
import { MissionCategory } from "@prisma/client";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { Swords, Skull, Zap, Clock, Infinity as InfinityIcon, Sparkles, Check, Loader2 } from "lucide-react";
import { getMissionsForCalendar } from "@/server/actions/mission-actions";

interface MissionPickerProps {
    guildId: string;
    selectedIds: string[];
    onSelect: (ids: string[], titles: string[]) => void;
}

const CATEGORY_CONFIG: Record<string, { icon: any; color: string; bgColor: string; borderColor: string; fallbackImage: string; label: string }> = {
    DONJON: {
        icon: Swords,
        color: "text-danger",
        bgColor: "bg-danger/10",
        borderColor: "border-danger/20",
        fallbackImage: "/banners/donjon.png",
        label: "Donjon"
    },
    REGULATION: {
        icon: Skull,
        color: "text-success",
        bgColor: "bg-success/10",
        borderColor: "border-success/20",
        fallbackImage: "/banners/regulation.png",
        label: "Régulation"
    },
    ANOMALIE: {
        icon: Zap,
        color: "text-fuchsia-400",
        bgColor: "bg-fuchsia-500/10",
        borderColor: "border-fuchsia-500/20",
        fallbackImage: "/assets/missions/ano1.png",
        label: "Anomalie"
    },
    SONGES: {
        icon: InfinityIcon,
        color: "text-info",
        bgColor: "bg-info/10",
        borderColor: "border-info/20",
        fallbackImage: "/assets/missions/songes.png",
        label: "Songes"
    },
    EXPEDITION: {
        icon: Clock,
        color: "text-warning",
        bgColor: "bg-warning/10",
        borderColor: "border-warning/20",
        fallbackImage: "/banners/expedition.png",
        label: "Expédition"
    },
    EVENT: {
        icon: Sparkles,
        color: "text-warning",
        bgColor: "bg-warning/10",
        borderColor: "border-warning/20",
        fallbackImage: "/assets/missions/event.png",
        label: "Événement"
    },
};

export function MissionPicker({ guildId, selectedIds, onSelect }: MissionPickerProps) {
    const [missions, setMissions] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchMissions = async () => {
            setLoading(true);
            const res = await getMissionsForCalendar(guildId);
            if (res.success && res.data) {
                setMissions(res.data);
            }
            setLoading(false);
        };
        fetchMissions();
    }, [guildId]);

    const toggleSelection = (id: string, title: string) => {
        let newIds: string[];
        let newTitles: string[];

        if (selectedIds.includes(id)) {
            newIds = selectedIds.filter(i => i !== id);
            // This is a bit tricky since we don't store titles, 
            // but we can find them in the current mission list
            newTitles = missions
                .filter(m => newIds.includes(m.id))
                .map(m => m.title || (m.payload as any).dungeonName || (m.payload as any).monsterName || "Objectif");
        } else {
            newIds = [...selectedIds, id];
            newTitles = missions
                .filter(m => newIds.includes(m.id))
                .map(m => m.title || (m.payload as any).dungeonName || (m.payload as any).monsterName || "Objectif");
        }
        onSelect(newIds, newTitles);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-8 bg-surface/50 border border-border rounded-xl">
                <Loader2 className="h-6 w-6 text-warning animate-spin mr-3" />
                <span className="text-muted-foreground font-bold uppercase tracking-widest text-xs italic">Chargement des missions...</span>
            </div>
        );
    }

    if (missions.length === 0) {
        return (
            <div className="p-8 text-center bg-surface/50 border border-dashed border-border rounded-xl">
                <p className="text-muted-foreground text-sm font-bold italic">Aucune mission active trouvée pour cette semaine.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <h4 className="text-caption font-black uppercase tracking-[3px] text-muted-foreground flex items-center gap-2 px-1">
                <Check className="h-3 w-3 text-success" />
                Sélectionner les objectifs ({selectedIds.length})
            </h4>
            
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {missions
                    .filter(m => m.category !== "DONJON") // Uniquement les vraies missions (Anomalies, Expeditions, etc.)
                    .map((mission) => {
                    const isSelected = selectedIds.includes(mission.id);
                    const config = CATEGORY_CONFIG[mission.category] || CATEGORY_CONFIG.EVENT;
                    const payload = mission.payload || {};
                    
                    // Logic to get image from payload (simplified version of MissionCard)
                    let imageUrl = payload.imageUrl || payload.image || config.fallbackImage;
                    
                    if (mission.category === 'SONGES') {
                        const diff: string = (payload.difficulty || 'Reve').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                        const levelMap: Record<string, number> = { 'I': 1, 'II': 2, 'III': 3, 'IV': 4 };
                        const lvl = levelMap[payload.level as string] || 1;
                        imageUrl = `/assets/missions/${diff}${lvl}.png`;
                    }

                    const title = mission.title || payload.dungeonName || payload.monsterName || payload.familyName || config.label;

                    return (
                        <button
                            key={mission.id}
                            type="button"
                            onClick={() => toggleSelection(mission.id, title)}
                            className={cn(
                                "group relative aspect-[4/3] rounded-xl border-2 overflow-hidden transition-all duration-300",
                                isSelected 
                                    ? "border-success ring-2 ring-success/20" 
                                    : "border-border hover:border-border bg-surface/50"
                            )}
                        >
                            {/* Background image */}
                            <div className="absolute inset-0">
                                <Image 
                                    src={imageUrl} 
                                    alt={title} 
                                    fill 
                                    className={cn(
                                        "object-contain p-2 transition-transform duration-300",
                                        isSelected ? "scale-110" : "group-"
                                    )} 
                                    unoptimized
                                />
                                <div className={cn(
                                    "absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent",
                                    isSelected && "bg-success/10"
                                )} />
                            </div>

                            {/* Content overlay */}
                            <div className="absolute inset-x-0 bottom-0 p-2 z-10">
                                <p className="text-caption font-black text-foreground uppercase tracking-tighter line-clamp-1 text-shadow">
                                    {title}
                                </p>
                            </div>

                            {/* Selection checkmark */}
                            {isSelected && (
                                <div className="absolute top-2 right-2 h-5 w-5 rounded-full bg-success flex items-center justify-center shadow-lg border border-border-strong z-20">
                                    <Check className="h-3 w-3 text-foreground" />
                                </div>
                            )}

                            {/* Category Indicator */}
                            <div className={cn(
                                "absolute top-2 left-2 p-1 rounded bg-black/60 border border-border backdrop-blur-md z-10",
                                config.color
                            )}>
                                <config.icon className="h-2.5 w-2.5" />
                            </div>
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
