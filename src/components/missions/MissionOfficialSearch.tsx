'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Search, Sparkles, X, Check, Swords, Skull, Zap, Clock, Infinity as InfinityIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import {
    searchOfficialGuildMissions,
    OFFICIAL_MISSIONS_TOTAL,
    OFFICIAL_MISSION_COUNTS,
    type OfficialGuildMission,
} from '@/lib/game-data/guild-missions-catalog';
import type { MissionCategoryType } from '@/lib/mission-config';
import { CATEGORY_CONFIG } from '@/lib/mission-config';
import { resolveMissionArtwork } from '@/lib/mission-artwork';
import { MissionArtworkImage } from './mission-artwork-image';

interface MissionOfficialSearchProps {
    currentCategory?: MissionCategoryType;
    selectedMissionId?: number | null;
    onSelectMission: (mission: OfficialGuildMission) => void;
}

/** Nombre de résultats affichés d'un coup (le catalogue en compte plusieurs centaines). */
const RESULT_LIMIT = 30;

/**
 * Onglets du catalogue — les **compteurs viennent du catalogue**, jamais d'un nombre écrit
 * à la main (mesure du 17/11/2026 : « 468 / 113 / 135 / 23 » figés dans le composant, et
 * l'onglet **Anomalies manquait** alors que la catégorie existe et est éditable).
 */
const CATEGORY_TABS: { label: string; value: MissionCategoryType | 'ALL'; count: number; icon: any }[] = [
    { label: 'Toutes', value: 'ALL', count: OFFICIAL_MISSIONS_TOTAL, icon: Sparkles },
    { label: 'Donjons', value: 'DONJON', count: OFFICIAL_MISSION_COUNTS.DONJON ?? 0, icon: Swords },
    { label: 'Régulations', value: 'REGULATION', count: OFFICIAL_MISSION_COUNTS.REGULATION ?? 0, icon: Skull },
    { label: 'Anomalies', value: 'ANOMALIE', count: OFFICIAL_MISSION_COUNTS.ANOMALIE ?? 0, icon: Zap },
    { label: 'Songes', value: 'SONGES', count: OFFICIAL_MISSION_COUNTS.SONGES ?? 0, icon: InfinityIcon },
    { label: 'Expéditions', value: 'EXPEDITION', count: OFFICIAL_MISSION_COUNTS.EXPEDITION ?? 0, icon: Clock },
    { label: 'Événements', value: 'EVENT', count: OFFICIAL_MISSION_COUNTS.EVENT ?? 0, icon: Sparkles },
];

const focusRing = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60';

export function MissionOfficialSearch({
    currentCategory,
    selectedMissionId,
    onSelectMission,
}: MissionOfficialSearchProps) {
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState<MissionCategoryType | 'ALL'>(currentCategory || 'ALL');
    const [selectedRank, setSelectedRank] = useState<number | undefined>(undefined);

    // Le panneau suit la catégorie du slot : changer « Donjon » à gauche ne doit pas laisser
    // l'onglet « Songes » actif à droite (la valeur initiale seule ne suffisait pas).
    useEffect(() => {
        setActiveTab(currentCategory || 'ALL');
    }, [currentCategory]);

    // Filtrage réactif dans le catalogue officiel.
    const results = useMemo(() => {
        return searchOfficialGuildMissions({
            query: query.trim() || undefined,
            category: activeTab === 'ALL' ? undefined : activeTab,
            rank: selectedRank,
            limit: RESULT_LIMIT,
        });
    }, [query, activeTab, selectedRank]);

    const hasFilters = query.trim().length > 0 || selectedRank !== undefined || activeTab !== 'ALL';

    const resetFilters = () => {
        setQuery('');
        setActiveTab('ALL');
        setSelectedRank(undefined);
    };

    return (
        <div className="flex w-full flex-col gap-3 lg:h-full lg:min-h-0">
            {/* ── Filtres (fixes) : seule la liste défile, jamais deux scrolls imbriqués ── */}
            <div className="shrink-0 space-y-2.5">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <div className="relative min-w-0 flex-1">
                        <Search
                            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                            aria-hidden="true"
                        />
                        <Input
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            aria-label="Rechercher une mission officielle"
                            placeholder="Monstre, boss, zone, donjon (ex. Brikoléreux, Baleine, Nowel)…"
                            className="h-11 rounded-lg border-border bg-background/80 pl-9 pr-10 text-xs focus:border-warning/50 sm:h-9"
                        />
                        {query && (
                            <button
                                type="button"
                                onClick={() => setQuery('')}
                                aria-label="Effacer la recherche"
                                className={cn(
                                    'absolute right-1.5 top-1/2 flex h-10 w-10 -translate-y-1/2 sm:h-8 sm:w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-elevated hover:text-foreground',
                                    focusRing,
                                )}
                            >
                                <X className="h-3.5 w-3.5" aria-hidden="true" />
                            </button>
                        )}
                    </div>

                    {/* Filtres rapides par Rang R1..R5 */}
                    <div
                        role="group"
                        aria-label="Filtrer par rang"
                        className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-surface/60 p-1"
                    >
                        <button
                            type="button"
                            onClick={() => setSelectedRank(undefined)}
                            aria-pressed={selectedRank === undefined}
                            className={cn(
                                'h-11 rounded-md px-3 text-[10px] font-semibold sm:h-8 sm:px-2 transition-colors',
                                selectedRank === undefined
                                    ? 'bg-warning/10 text-warning'
                                    : 'text-muted-foreground hover:text-foreground',
                                focusRing,
                            )}
                        >
                            Tous
                        </button>
                        {[1, 2, 3, 4, 5].map((rank) => (
                            <button
                                key={rank}
                                type="button"
                                onClick={() => setSelectedRank(selectedRank === rank ? undefined : rank)}
                                aria-pressed={selectedRank === rank}
                                aria-label={`Rang ${rank}`}
                                className={cn(
                                    'h-11 w-11 rounded-md font-mono sm:h-8 sm:w-8 text-[10px] font-semibold transition-colors',
                                    selectedRank === rank
                                        ? 'bg-warning/10 text-warning'
                                        : 'text-muted-foreground hover:text-foreground',
                                    focusRing,
                                )}
                            >
                                R{rank}
                            </button>
                        ))}
                    </div>
                </div>


                {/* Catégories : retour à la ligne plutôt qu'un onglet coupé hors écran */}
                <div
                    role="group"
                    aria-label="Filtrer par catégorie"
                    className="flex flex-wrap items-center gap-1.5"
                >
                    {CATEGORY_TABS.map((tab) => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.value;
                        return (
                            <button
                                key={tab.value}
                                type="button"
                                onClick={() => setActiveTab(tab.value)}
                                aria-pressed={isActive}
                                className={cn(
                                    'flex h-11 items-center gap-1.5 rounded-lg border px-2.5 sm:h-8 sm:px-2 text-[11px] font-medium transition-colors',
                                    isActive
                                        ? 'border-warning/40 bg-warning/10 text-warning'
                                        : 'border-border bg-surface/50 text-muted-foreground hover:bg-elevated/60 hover:text-foreground',
                                    focusRing,
                                )}
                            >
                                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>{tab.label}</span>
                                <span className="hidden font-mono text-[10px] tabular-nums opacity-70 sm:inline">{tab.count}</span>
                            </button>
                        );
                    })}
                </div>

                <div className="flex items-center justify-between gap-2">
                    <p className="text-[11px] text-muted-foreground" aria-live="polite">
                        {results.length} résultat{results.length > 1 ? 's' : ''}
                        {results.length === RESULT_LIMIT && (
                            <span className="text-muted-foreground/70"> · affinez la recherche</span>
                        )}
                    </p>
                    {hasFilters && (
                        <button
                            type="button"
                            onClick={resetFilters}
                            className={cn(
                                'rounded-md px-1 text-[11px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline',
                                focusRing,
                            )}
                        >
                            Réinitialiser
                        </button>
                    )}
                </div>
            </div>


            {/* ── Liste (seul élément défilant du panneau) ── */}
            <div className="space-y-1.5 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1 premium-scrollbar">
                {results.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
                        <Search className="h-6 w-6 text-muted-foreground/60" aria-hidden="true" />
                        <p className="text-xs font-medium text-foreground">Aucune mission ne correspond à ces filtres</p>
                        <p className="max-w-[42ch] text-[11px] text-muted-foreground">
                            Essayez un mot-clé plus court ou revenez à l&apos;onglet « Toutes ».
                        </p>
                        <button
                            type="button"
                            onClick={resetFilters}
                            className={cn(
                                'mt-1 h-9 rounded-lg border border-border bg-surface px-3 text-xs font-medium text-foreground transition-colors hover:bg-elevated',
                                focusRing,
                            )}
                        >
                            Réinitialiser les filtres
                        </button>
                    </div>
                ) : (
                    results.map((m) => {
                        const cfg = CATEGORY_CONFIG[m.category] || CATEGORY_CONFIG.DONJON;
                        const CategoryIcon = cfg?.icon || Sparkles;
                        const isSelected = selectedMissionId === m.id;
                        // Le catalogue ne porte pas de visuel pour Songes / Anomalies / Régulations :
                        // le résolveur unique corrèle le titre avec nos assets locaux.
                        const artwork = resolveMissionArtwork({
                            category: m.category,
                            title: m.title,
                            monsterId: m.monsterId,
                            monsterImageUrl: m.monsterImageUrl,
                        });

                        return (
                            <button
                                type="button"
                                key={m.id}
                                onClick={() => onSelectMission(m)}
                                aria-pressed={isSelected}
                                className={cn(
                                    'group flex w-full min-w-0 items-center gap-3 rounded-xl border p-2.5 text-left transition-colors',
                                    isSelected
                                        ? 'border-warning/50 bg-warning/5'
                                        : 'border-border/60 bg-surface/40 hover:border-border hover:bg-surface/70',
                                    focusRing,
                                )}
                            >
                                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background">
                                    <MissionArtworkImage
                                        src={artwork.imageUrl}
                                        fallbackSrc={artwork.fallbackUrl}
                                        alt={m.title}
                                        className="h-full w-full object-cover"
                                    >
                                        <CategoryIcon className={cn('h-5 w-5', cfg.color)} aria-hidden="true" />
                                    </MissionArtworkImage>
                                </div>

                                <div className="min-w-0 flex-1">
                                    <div className="flex min-w-0 items-center gap-1.5">
                                        <span
                                            className={cn(
                                                'truncate text-xs font-semibold',
                                                isSelected ? 'text-warning' : 'text-foreground',
                                            )}
                                        >
                                            {m.title}
                                        </span>
                                        {isSelected && (
                                            <Check className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
                                        )}
                                    </div>

                                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                                        <span className={cn('rounded border px-1 font-semibold', cfg.borderColor, cfg.color)}>
                                            {cfg.label}
                                        </span>
                                        <span className="font-mono">R{m.rank}</span>
                                        <span aria-hidden="true">·</span>
                                        <span className="font-mono">Niv. {m.level}</span>
                                    </div>


                                    <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                                        {m.objectiveText}
                                        {m.subareaName && (
                                            <span className="opacity-70 font-mono"> — {m.subareaName}</span>
                                        )}
                                    </p>
                                </div>

                                <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
                                    <span className="font-mono text-[11px] font-semibold text-info">
                                        {m.activityPoints} XP
                                    </span>
                                    <span className="font-mono text-[11px] font-semibold text-warning">
                                        {m.guildTokens} 🪙
                                    </span>
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}

