'use client';

import React, { useState, useMemo } from 'react';
import { Search, Sparkles, X, Check, Swords, Skull, Zap, Clock, Infinity as InfinityIcon } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
    searchOfficialGuildMissions,
    type OfficialGuildMission
} from '@/lib/game-data/guild-missions-catalog';
import type { MissionCategoryType } from '@/lib/mission-config';
import { CATEGORY_CONFIG } from '@/lib/mission-config';

interface MissionOfficialSearchProps {
    currentCategory?: MissionCategoryType;
    selectedMissionId?: number | null;
    onSelectMission: (mission: OfficialGuildMission) => void;
}

const CATEGORY_TABS: { label: string; value: MissionCategoryType | 'ALL'; count: number; icon: any }[] = [
    { label: 'Toutes', value: 'ALL', count: 468, icon: Sparkles },
    { label: 'Donjons', value: 'DONJON', count: 113, icon: Swords },
    { label: 'Régulations', value: 'REGULATION', count: 135, icon: Skull },
    { label: 'Songes', value: 'SONGES', count: 23, icon: InfinityIcon },
    { label: 'Expéditions', value: 'EXPEDITION', count: 60, icon: Clock },
    { label: 'Événements', value: 'EVENT', count: 120, icon: Sparkles },
];

export function MissionOfficialSearch({
    currentCategory,
    selectedMissionId,
    onSelectMission,
}: MissionOfficialSearchProps) {
    const [query, setQuery] = useState('');
    const [activeTab, setActiveTab] = useState<MissionCategoryType | 'ALL'>(currentCategory || 'ALL');
    const [selectedRank, setSelectedRank] = useState<number | undefined>(undefined);

    // Filtrage réactif dans les 468 missions
    const results = useMemo(() => {
        return searchOfficialGuildMissions({
            query: query.trim() || undefined,
            category: activeTab === 'ALL' ? undefined : activeTab,
            rank: selectedRank,
            limit: 30, // Affiche jusqu'à 30 résultats
        });
    }, [query, activeTab, selectedRank]);

    return (
        <div className="w-full space-y-3">
            {/* ── 1. Barre de recherche principale ── */}
            <div className="flex flex-col sm:flex-row gap-2 items-center">
                <div className="relative flex-1 w-full">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Rechercher par nom de monstre, boss, zone, donjon (ex: Brikoléreux, Baleine, Solar, Nowel)..."
                        className="pl-9 pr-8 h-9 text-xs bg-background/80 border-border focus:border-warning/50 rounded-xl"
                    />
                    {query && (
                        <button
                            type="button"
                            onClick={() => setQuery('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-0.5"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Filtres rapides par Rang R1..R5 */}
                <div className="flex items-center gap-1 shrink-0 bg-background/60 p-1 rounded-xl border border-border">
                    <button
                        type="button"
                        onClick={() => setSelectedRank(undefined)}
                        className={cn(
                            "px-2 py-1 text-[10px] font-bold rounded-lg transition-all",
                            selectedRank === undefined
                                ? "bg-muted text-foreground"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                    >
                        Tous
                    </button>
                    {[1, 2, 3, 4, 5].map((r) => (
                        <button
                            key={r}
                            type="button"
                            onClick={() => setSelectedRank(selectedRank === r ? undefined : r)}
                            className={cn(
                                "px-2 py-1 text-[10px] font-bold rounded-lg transition-all",
                                selectedRank === r
                                    ? "bg-warning/20 text-warning border border-warning/30"
                                    : "text-muted-foreground hover:text-foreground"
                            )}
                        >
                            R{r}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── 2. Onglets de catégories (Pills) ── */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
                {CATEGORY_TABS.map((tab) => {
                    const isActive = activeTab === tab.value;
                    const Icon = tab.icon;
                    return (
                        <button
                            key={tab.value}
                            type="button"
                            onClick={() => setActiveTab(tab.value)}
                            className={cn(
                                "px-2.5 py-1 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 border",
                                isActive
                                    ? "bg-warning/15 border-warning/50 text-warning shadow-sm"
                                    : "bg-background/40 border-border text-muted-foreground hover:text-foreground hover:bg-background/80"
                            )}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            <span>{tab.label}</span>
                            <span className={cn(
                                "text-[10px] font-mono px-1 py-0.2 rounded-md",
                                isActive ? "bg-warning/20 text-warning" : "bg-muted/50 text-muted-foreground"
                            )}>
                                {tab.count}
                            </span>
                        </button>
                    );
                })}
            </div>

            {/* ── 3. Liste de résultats INLINE (Pas de dropdown flottant bloquant) ── */}
            <div className="h-[360px] overflow-y-auto pr-1 space-y-1.5 rounded-xl border border-border/80 bg-background/30 p-2">
                {results.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-center p-6 text-muted-foreground space-y-2">
                        <Search className="w-8 h-8 opacity-40 text-muted-foreground" />
                        <p className="text-xs font-medium">
                            Aucune mission officielle ne correspond à « <span className="text-foreground font-bold">{query}</span> »
                        </p>
                        <p className="text-[11px] opacity-70">
                            Essayez un mot-clé plus court ou sélectionnez l'onglet « Toutes ».
                        </p>
                    </div>
                ) : (
                    results.map((m) => {
                        const cfg = CATEGORY_CONFIG[m.category] || CATEGORY_CONFIG.DONJON;
                        const CategoryIcon = cfg?.icon || Sparkles;
                        const isSelected = selectedMissionId === m.id;

                        return (
                            <button
                                key={m.id}
                                type="button"
                                onClick={() => onSelectMission(m)}
                                className={cn(
                                    "w-full text-left p-2.5 rounded-xl border transition-all flex items-center gap-3 group relative overflow-hidden",
                                    isSelected
                                        ? "bg-warning/10 border-warning/50 shadow-md ring-1 ring-warning/30"
                                        : "bg-surface/60 border-border/60 hover:bg-surface/90 hover:border-border"
                                )}
                            >
                                {/* Miniature Monstre / Catégorie */}
                                <div className="w-10 h-10 rounded-xl bg-background border border-border shrink-0 overflow-hidden flex items-center justify-center relative">
                                    {m.monsterImageUrl ? (
                                        <img
                                            src={m.monsterImageUrl}
                                            alt={m.title}
                                            className="w-full h-full object-cover"
                                            onError={(e) => {
                                                (e.target as HTMLElement).style.display = 'none';
                                            }}
                                        />
                                    ) : (
                                        <CategoryIcon className={cn("w-5 h-5", cfg.color)} />
                                    )}
                                </div>

                                {/* Texte de la mission */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className={cn(
                                            "text-xs font-black truncate group-hover:text-warning transition-colors",
                                            isSelected ? "text-warning" : "text-foreground"
                                        )}>
                                            {m.title}
                                        </span>
                                        <Badge variant="outline" className={cn("text-[9px] py-0 px-1 font-bold", cfg.borderColor, cfg.color)}>
                                            {cfg.label}
                                        </Badge>
                                        <Badge variant="outline" className="text-[9px] py-0 px-1 font-mono font-bold text-muted-foreground border-border">
                                            R{m.rank} • Niv. {m.level}
                                        </Badge>
                                    </div>

                                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                                        {m.objectiveText}
                                        {m.subareaName && (
                                            <span className="opacity-70 font-mono"> — {m.subareaName}</span>
                                        )}
                                    </p>
                                </div>

                                {/* Récompenses + État sélectionné */}
                                <div className="text-right shrink-0 space-y-0.5 pl-2">
                                    <div className="text-[11px] font-black text-cyan-400">
                                        {m.activityPoints} XP
                                    </div>
                                    <div className="text-[11px] font-black text-amber-400">
                                        {m.guildTokens} 🪙
                                    </div>
                                    {isSelected && (
                                        <span className="inline-flex items-center gap-0.5 text-[9px] font-black text-success mt-0.5">
                                            <Check className="w-3 h-3" /> Sélectionnée
                                        </span>
                                    )}
                                </div>
                            </button>
                        );
                    })
                )}
            </div>
        </div>
    );
}
