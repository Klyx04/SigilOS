'use client';

import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Swords, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CATEGORY_CONFIG, type MissionCategoryType } from '@/lib/mission-config';
import { resolveMissionArtwork } from '@/lib/mission-artwork';
import { MissionArtworkImage } from './mission-artwork-image';

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

    // Détermination de l'illustration — résolveur unique (Songes, Anomalies, familles, proxy donjon)
    const artwork = resolveMissionArtwork({ category, title, payload });

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
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <span className="flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5 text-info" aria-hidden="true" /> Aperçu en direct
                </span>
                <span className="font-mono text-[10px] font-normal normal-case tracking-normal">
                    Rendu membre
                </span>
            </div>

            {!title ? (
                // État vide explicite : l'ancien aperçu affichait une fausse carte « Titre de la
                // mission… » alors que le slot n'était pas configuré (mesure du 17/11/2026).
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/30 px-4 py-8 text-center">
                    <CategoryIcon className={cn('h-6 w-6', config.color)} aria-hidden="true" />
                    <p className="text-xs font-medium text-foreground">Aucune mission sélectionnée</p>
                    <p className="max-w-[38ch] text-[11px] text-muted-foreground">
                        Choisissez une mission dans le catalogue ou composez-la en mode personnalisé.
                    </p>
                </div>
            ) : (
                <Card className={cn(
                    'relative overflow-hidden border bg-surface p-4',
                    config.borderColor,
                )}>
                    {/* En-tête de la carte */}
                    <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                            <div className={cn('flex items-center justify-center rounded-lg border p-1.5', config.bgColor, config.borderColor)}>
                                <CategoryIcon className={cn('h-4 w-4', config.color)} aria-hidden="true" />
                            </div>
                            <div>
                                <span className={cn('text-[10px] font-semibold uppercase tracking-wider', config.color)}>
                                    {config.label}
                                </span>
                                <div className="mt-0.5 flex items-center gap-1.5">
                                    <Badge variant="outline" className="border-border bg-background/50 px-1 py-0 font-mono text-[9px] font-semibold">
                                        Rang {rank}
                                    </Badge>
                                    {payload?.level && (
                                        <Badge variant="outline" className="border-border px-1 py-0 font-mono text-[9px] text-muted-foreground">
                                            Niv. {payload.level}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Récompenses en haut à droite */}
                        <div className="flex items-center gap-2">
                            <div className="rounded-md border border-info/20 bg-info/10 px-2 py-0.5 text-xs font-semibold text-info">
                                {xpReward} XP
                            </div>
                            <div className="rounded-md border border-warning/20 bg-warning/10 px-2 py-0.5 text-xs font-semibold text-warning">
                                {guildatonsReward} 🪙
                            </div>
                        </div>
                    </div>

                    {/* Corps avec illustration et objectif */}
                    <div className="mt-3 flex items-center gap-3.5 border-t border-border/60 pt-3">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                            <MissionArtworkImage
                                src={artwork.imageUrl}
                                fallbackSrc={artwork.fallbackUrl}
                                alt={title || "Mission"}
                                className="h-full w-full object-contain p-0.5"
                            >
                                <CategoryIcon className={cn('h-6 w-6', config.color)} aria-hidden="true" />
                            </MissionArtworkImage>
                        </div>

                        <div className="min-w-0 flex-1">
                            <h4 className="truncate text-sm font-semibold text-foreground">{title}</h4>
                            <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{objectiveText}</p>
                        </div>
                    </div>
                </Card>
            )}
        </div>
    );
}

