'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Swords, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_CONFIG, type MissionCategoryType } from '@/lib/mission-config';

interface MissionLivePreviewProps {
    category: MissionCategoryType;
    rank: number;
    title: string;
    xpReward: number;
    guildatonsReward: number;
    payload: Record<string, any>;
}

export function MissionLivePreview({
    category,
    rank,
    title,
    xpReward,
    guildatonsReward,
    payload,
}: MissionLivePreviewProps) {
    const config = CATEGORY_CONFIG[category] || CATEGORY_CONFIG.DONJON;
    const CategoryIcon = config.icon || Swords;

    // Détermination de l'illustration
    const imageUrl = payload?.imageUrl || (payload?.monsterId ? `/uploads/assets-dofus/monsters/${payload.monsterId}.webp` : null);

    // Détermination de l'objectif
    let objectiveText = payload?.officialObjectiveText || payload?.description || '';
    if (!objectiveText) {
        if (category === 'DONJON') {
            objectiveText = payload?.bossName ? `Vaincre ${payload.bossName} dans son donjon` : 'Vaincre le boss du donjon';
        } else if (category === 'REGULATION') {
            const fam = payload?.familyName || payload?.monsterName || 'monstres';
            objectiveText = `Vaincre ${payload?.targetCount || 50} ${fam} sur leur territoire`;
        } else if (category === 'SONGES') {
            objectiveText = payload?.epreuve 
                ? `Vaincre l'épreuve de songes ${payload.epreuve}` 
                : `Terminer le songe en ${payload?.difficulty || 'Cauchemar'} ${payload?.level || 'I'}`;
        } else if (category === 'EXPEDITION') {
            objectiveText = `Vaincre ${payload?.bossName || 'le boss'} en expédition (${payload?.mode || 'bravoure'})`;
        } else if (category === 'EVENT') {
            objectiveText = payload?.notes || (payload?.bossName ? `Vaincre ${payload.bossName}` : 'Objectif événementiel');
        }
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-black uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <Eye className="w-3.5 h-3.5 text-info" /> Aperçu en direct
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                    Rendu membre
                </span>
            </div>

            <Card className={cn(
                "relative overflow-hidden border transition-all duration-300 p-4 bg-surface/90",
                config.borderColor,
                "shadow-lg"
            )}>
                {/* En-tête de la carte */}
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <div className={cn("p-1.5 rounded-lg border flex items-center justify-center", config.bgColor, config.borderColor)}>
                            <CategoryIcon className={cn("w-4 h-4", config.color)} />
                        </div>
                        <div>
                            <span className={cn("text-[10px] font-black uppercase tracking-wider", config.color)}>
                                {config.label}
                            </span>
                            <div className="flex items-center gap-1.5 mt-0.5">
                                <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono font-bold border-border bg-background/50">
                                    Rang {rank}
                                </Badge>
                                {payload?.level && (
                                    <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono text-muted-foreground border-border">
                                        Niv. {payload.level}
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Récompenses en haut à droite */}
                    <div className="flex items-center gap-2">
                        <div className="px-2 py-0.5 rounded-md bg-info/10 border border-info/20 text-info text-xs font-black">
                            {xpReward} XP
                        </div>
                        <div className="px-2 py-0.5 rounded-md bg-warning/10 border border-warning/20 text-warning text-xs font-black">
                            {guildatonsReward} 🪙
                        </div>
                    </div>
                </div>

                {/* Corps avec illustration et objectif */}
                <div className="flex items-center gap-3.5 mt-3 pt-3 border-t border-border/60">
                    <div className="w-12 h-12 rounded-xl bg-background border border-border shrink-0 overflow-hidden flex items-center justify-center relative">
                        {imageUrl ? (
                            <img
                                src={imageUrl}
                                alt={title || "Mission"}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    (e.target as HTMLElement).style.display = 'none';
                                }}
                            />
                        ) : (
                            <CategoryIcon className={cn("w-6 h-6", config.color)} />
                        )}
                    </div>

                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-black text-foreground truncate">
                            {title || <span className="text-muted-foreground italic">Titre de la mission...</span>}
                        </h4>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                            {objectiveText}
                        </p>
                    </div>
                </div>
            </Card>
        </div>
    );
}
