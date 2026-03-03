'use client'

import { useState, useEffect, useCallback } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { getDungeons, getZones, getMonsterFamilies, searchDungeons, searchZones, searchDungeonsAdvanced } from "@/server/actions/game-data-actions";
import { AsyncCombobox } from "@/components/ui/async-combobox";
import {
    SONGES_CONFIG,
    ANOMALIE_LEVEL_RANGES,
    EXPEDITION_MODES,
    type DungeonPayload,
    type RegulationPayload,
    type AnomaliePayload,
    type SongesPayload,
    type ExpeditionPayload,
    type EventPayload
} from "@/lib/mission-payloads";
import { Loader2, ExternalLink, Skull, MapPin, CheckCircle2, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

// --- Types ---

type Dungeon = {
    id: string;
    name: string;
    bossName: string;
    level: number;
    dpnlUrl?: string | null;
    imageUrl?: string | null;
};

type Zone = {
    id: string;
    name: string;
    level: number;
    monsters: { id: string; name: string; imageUrl?: string | null }[];
};

type MonsterFamily = {
    id: string;
    name: string;
    imageUrl?: string | null;
    monsters?: { id: string; name: string; imageUrl?: string | null }[];
};

type FormProps = {
    payload: Record<string, any>;
    onPayloadChange: (payload: Record<string, any>) => void;
    onTitleChange: (title: string) => void;
    onRankChange?: (rank: number) => void;
};

// --- DONJON FORM ---

export function DungeonForm({ payload, onPayloadChange, onTitleChange, onRankChange }: FormProps) {
    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

    const dungeonFetcher = useCallback(async (query: string) => {
        const res = await searchDungeonsAdvanced({
            query,
            minLevel: selectedLevel || undefined,
            maxLevel: selectedLevel || undefined
        });
        if (res.success && res.data) {
            setDungeons(res.data);
            return res.data.map(d => ({
                value: d.id,
                label: d.name,
                subLabel: `Niv. ${d.level} - Boss: ${d.bossName}`
            }));
        }
        return [];
    }, [selectedLevel]);

    const handleLevelSelect = (lvl: number | null) => {
        setSelectedLevel(lvl === selectedLevel ? null : lvl);
        // We don't clear the selected dungeon, just the filter for next search
    };

    const handleSelect = (dungeonId: string) => {
        const dungeon = dungeons.find(d => d.id === dungeonId);
        if (dungeon) {
            const newPayload: DungeonPayload = {
                dungeonId: dungeon.id,
                dungeonName: dungeon.name,
                bossName: dungeon.bossName,
                level: dungeon.level,
                dpnlUrl: dungeon.dpnlUrl || undefined,
                imageUrl: dungeon.imageUrl || undefined,
            };
            onPayloadChange(newPayload);
            onTitleChange(dungeon.name);
            if (onRankChange) {
                if (dungeon.level >= 190) onRankChange(4);
                else if (dungeon.level >= 100) onRankChange(3);
                else if (dungeon.level >= 50) onRankChange(2);
                else onRankChange(1);
            }
        }
    };

    const selectedDungeon = payload.dungeonId ? dungeons.find(d => d.id === payload.dungeonId) : null;


    return (
        <div className="space-y-4">


            <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Rechercher un donjon</Label>
                <AsyncCombobox
                    key={selectedLevel} // Force refresh when palier changes
                    value={payload.dungeonId}
                    onSelect={handleSelect}
                    fetcher={dungeonFetcher}
                    placeholder={selectedLevel ? `Donjons Niv. ${selectedLevel}...` : "Sélectionner un donjon..."}
                    searchPlaceholder="Nom du donjon ou du boss..."
                    emptyText="Aucun donjon trouvé."
                />
            </div>

            {/* Selected Preview */}
            {selectedDungeon && (
                <div className="p-3 bg-zinc-900/50 rounded-lg border border-rose-500/20 space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">{selectedDungeon.name}</span>
                        {selectedDungeon.dpnlUrl && (
                            <a href={selectedDungeon.dpnlUrl} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
                                <ExternalLink className="w-3 h-3" /> DPLN
                            </a>
                        )}
                    </div>
                    <div className="text-xs text-zinc-400">
                        Vaincre <span className="text-rose-400 font-medium">{selectedDungeon.bossName}</span> dans son donjon
                    </div>
                </div>
            )}
        </div>
    );
}

// --- REGULATION FORM ---

export function RegulationForm({ payload, onPayloadChange, onTitleChange, onRankChange }: FormProps) {
    const [zones, setZones] = useState<Zone[]>([]);
    const [families, setFamilies] = useState<MonsterFamily[]>([]);

    // We don't fetch all at once anymore. We fetch via Combobox.
    // However, we need to store the lists to find objects by ID after selection.

    const zoneFetcher = useCallback(async (query: string) => {
        const res = await searchZones(query);
        if (res.success && res.data) {
            setZones(prev => {
                // Merge new zones to keep track of them
                const newZones = res.data || [];
                const map = new Map(prev.map(z => [z.id, z]));
                newZones.forEach(z => map.set(z.id, z));
                return Array.from(map.values());
            });
            return res.data.map(z => ({ value: z.id, label: z.name, subLabel: `Niv. ${z.level}` }));
        }
        return [];
    }, []);

    const familyFetcher = useCallback(async (query: string) => {
        // Note: payload.zoneId dependency needs to be handled.
        // If we include payload.zoneId in deps, it changes often? No, only on select.
        // But we need the LATEST zoneId.
        // Actually, we should pass zoneId as an argument or let the effect handle it?
        // But the fetcher signature is fixed (query) => ...
        // We can use a ref or just dependency.
        // Using dependency [payload.zoneId] means fetcher recreates when zone changes.
        // This is fine, as we WANT to refetch/reset when zone changes.
        // But wait, AsyncCombobox only calls fetcher when 'open' or 'query' changes.
        // Recreating fetcher might trigger the effect in AsyncCombobox if it depends on fetcher.
        // Yes it does: [debouncedValue, open, fetcher]
        // So changing zoneId -> recreates fetcher -> AsyncCombobox effect runs -> fetches new families.
        // This is exactly what we want!
        const res = await getMonsterFamilies({ zoneId: payload.zoneId, search: query });
        if (res.success && res.data) {
            setFamilies(prev => {
                const newFamilies = res.data || [];
                const map = new Map(prev.map(f => [f.id, f]));
                newFamilies.forEach(f => map.set(f.id, f));
                return Array.from(map.values());
            });
            return res.data.map(f => ({ value: f.id, label: f.name }));
        }
        return [];
    }, [payload.zoneId]);

    const handleZoneChange = (zoneId: string) => {
        const zone = zones.find(z => z.id === zoneId);
        if (zone) {
            // Auto-set rank based on zone level
            if (onRankChange) {
                if (zone.level >= 190) onRankChange(4);
                else if (zone.level >= 100) onRankChange(3);
                else if (zone.level >= 50) onRankChange(2);
                else onRankChange(1);
            }

            const newPayload: RegulationPayload = {
                ...payload,
                zoneId: zone.id,
                zoneName: zone.name,
                // Reset family if zone changes, as family filtering depends on zone
                familyId: "",
                familyName: "",
                targetCount: 50,
            };
            onPayloadChange(newPayload);
            onTitleChange(`Régulation en ${zone.name}`);
        }
    };

    const handleFamilyChange = (familyId: string) => {
        const family = families.find(f => f.id === familyId);
        if (family) {
            const currentPayload = payload as RegulationPayload;
            const newPayload: RegulationPayload = {
                ...currentPayload,
                familyId: family.id,
                familyName: family.name,
                imageUrl: family.imageUrl || (family.monsters?.[0]?.imageUrl ?? undefined),
                targetCount: 50,
                // Ensure zone fields are present
                zoneId: currentPayload.zoneId,
                zoneName: currentPayload.zoneName,
            };
            onPayloadChange(newPayload);
            onTitleChange(`Régulation des ${family.name}`);
        }
    };

    const selectedZone = payload.zoneId ? zones.find(z => z.id === payload.zoneId) : null;


    return (
        <div className="space-y-4">


            {/* Zone Selector */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" /> Zone (Territoire)
                </Label>
                <AsyncCombobox
                    value={payload.zoneId}
                    onSelect={handleZoneChange}
                    fetcher={zoneFetcher}
                    placeholder="Choisir une zone"
                    searchPlaceholder="Rechercher une zone..."
                />
            </div>

            {/* Family Selector */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400 flex items-center gap-1.5">
                    <Skull className="w-3 h-3" /> Famille de monstres
                </Label>
                <AsyncCombobox
                    key={payload.zoneId} // Force reset when zone changes
                    value={payload.familyId}
                    onSelect={handleFamilyChange}
                    fetcher={familyFetcher}
                    placeholder={payload.zoneId ? "Choisir une famille de la zone" : "Choisir une famille (Toutes)"}
                    searchPlaceholder="Rechercher une famille..."
                    disabled={!payload.zoneId && false} // Can technically search all if no zone selected
                />
            </div>

            {/* Preview */}
            {(payload.familyName || payload.zoneName) && (
                <div className="p-3 bg-emerald-500/10 rounded-lg border border-emerald-500/20 space-y-1">
                    <div className="text-xs font-bold text-emerald-400 flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Mission configurée
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-relaxed">
                        Vaincre <span className="text-white font-bold">50 monstres</span>
                        {payload.familyName && <> de la famille <span className="text-emerald-400 font-bold">{payload.familyName}</span></>}
                        {payload.zoneName && <> dans la zone <span className="text-emerald-400 font-bold">{payload.zoneName}</span></>}
                    </p>
                </div>
            )}
        </div>
    );
}

// --- ANOMALIE FORM ---

export function AnomalieForm({ payload, onPayloadChange, onTitleChange, onRankChange }: FormProps) {
    const anomalieType = payload.type || 'ZONE';
    const levelRange = payload.levelRange || '200';
    const fragmentLevel: 1 | 2 | 3 = payload.fragmentLevel || 1;

    const handleTypeChange = (type: 'ZONE' | 'BOSS' | 'GARDIENS' | 'COLLECTE') => {
        const newPayload: AnomaliePayload = {
            type,
            levelRange,
            ...(type === 'COLLECTE' ? { fragmentLevel: fragmentLevel } : {})
        };
        onPayloadChange(newPayload);
        updateTitle(type, levelRange, type === 'COLLECTE' ? fragmentLevel : undefined);
    };

    const handleLevelChange = (range: string) => {
        const newPayload: AnomaliePayload = {
            type: anomalieType,
            levelRange: range as AnomaliePayload['levelRange'],
            ...(anomalieType === 'COLLECTE' ? { fragmentLevel } : {})
        };
        onPayloadChange(newPayload);
        updateTitle(anomalieType, range, anomalieType === 'COLLECTE' ? fragmentLevel : undefined);
    };

    const handleFragmentChange = (level: number) => {
        const fl = level as 1 | 2 | 3;
        onPayloadChange({ type: 'COLLECTE', levelRange, fragmentLevel: fl });
        updateTitle('COLLECTE', levelRange, fl);
    };

    const updateTitle = (type: string, range: string, frag?: number) => {
        if (type === 'ZONE') {
            onTitleChange(`Zone Anomalie ${range}`);
        } else if (type === 'BOSS') {
            onTitleChange(`Gardien Anomalie ${range}`);
        } else if (type === 'GARDIENS') {
            onTitleChange(`3 Gardiens Anomalie ${range}`);
        } else {
            onTitleChange(`Collecte Fragments Anomalie ${frag ?? 1} (Niv. ${range})`);
        }
    };

    const TYPES: { value: 'ZONE' | 'BOSS' | 'GARDIENS' | 'COLLECTE'; label: string; desc: string }[] = [
        { value: 'ZONE', label: 'Zone', desc: '50 monstres' },
        { value: 'BOSS', label: 'Gardien', desc: 'Gardien d\'anomalie' },
        { value: 'GARDIENS', label: '3 Gardiens', desc: 'Vaincre 3 gardiens' },
        { value: 'COLLECTE', label: 'Collecte', desc: 'Fragments d\'anomalie' },
    ];

    return (
        <div className="space-y-4">
            {/* Type Selector */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Type d'anomalie</Label>
                <RadioGroup value={anomalieType} onValueChange={handleTypeChange} className="grid grid-cols-2 gap-2">
                    {TYPES.map(t => (
                        <div key={t.value} className={cn(
                            "flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-all",
                            anomalieType === t.value ? "bg-fuchsia-500/20 border-fuchsia-500/50" : "bg-zinc-900 border-zinc-800"
                        )}>
                            <RadioGroupItem value={t.value} id={t.value} />
                            <Label htmlFor={t.value} className="cursor-pointer text-sm">
                                <div className="font-medium">{t.label}</div>
                                <div className="text-xs text-zinc-500">{t.desc}</div>
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>

            {/* Fragment Level Sub-selector (COLLECTE only) */}
            {anomalieType === 'COLLECTE' && (
                <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Niveau de collecte (Fragments Ankama 3.5)</Label>
                    <div className="grid grid-cols-3 gap-2">
                        {([1, 2, 3] as const).map(lvl => (
                            <button
                                key={lvl}
                                type="button"
                                onClick={() => handleFragmentChange(lvl)}
                                className={cn(
                                    "p-3 rounded-lg border text-sm font-bold transition-all",
                                    fragmentLevel === lvl
                                        ? "bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-300"
                                        : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600"
                                )}
                            >
                                Fragment {lvl}
                            </button>
                        ))}
                    </div>
                    <p className="text-[10px] text-zinc-600 italic">Détails à compléter quand Ankama publiera les infos officielles.</p>
                </div>
            )}

            {/* Level Range Selector (hidden for COLLECTE since level isn't relevant yet) */}
            {anomalieType !== 'COLLECTE' && (
                <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Tranche de niveau</Label>
                    <Select value={levelRange} onValueChange={handleLevelChange}>
                        <SelectTrigger className="bg-zinc-950 border-zinc-800">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            {ANOMALIE_LEVEL_RANGES.map(range => (
                                <SelectItem key={range} value={range}>{range}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Preview */}
            <div className="p-3 bg-zinc-900/50 rounded-lg border border-fuchsia-500/20 text-xs text-zinc-400">
                {anomalieType === 'ZONE' && (
                    <>Vaincre 50 monstres dans un territoire de niveau <span className="text-fuchsia-400 font-medium">{levelRange}</span> sous anomalie avec un <span className="text-fuchsia-400">[Elixir uchronique]</span></>
                )}
                {anomalieType === 'BOSS' && (
                    <>Vaincre un <span className="text-fuchsia-400 font-medium">gardien d'anomalie</span> de niveau <span className="text-fuchsia-400 font-medium">{levelRange}</span> avec un <span className="text-fuchsia-400">[Elixir uchronique]</span></>
                )}
                {anomalieType === 'GARDIENS' && (
                    <>Vaincre <span className="text-fuchsia-400 font-medium">3 gardiens d'anomalie</span> de niveau <span className="text-fuchsia-400 font-medium">{levelRange}</span> avec un <span className="text-fuchsia-400">[Elixir uchronique]</span></>
                )}
                {anomalieType === 'COLLECTE' && (
                    <>Collecter des <span className="text-fuchsia-400 font-medium">Fragments d'anomalie</span> — niveau <span className="text-fuchsia-400 font-medium">{fragmentLevel}</span> <span className="text-zinc-600">(Maj 3.5)</span></>
                )}
            </div>
        </div>
    );
}


// --- SONGES FORM ---

export function SongesForm({ payload, onPayloadChange, onTitleChange, onRankChange }: FormProps) {
    const difficulty = payload.difficulty || 'Paradoxe';
    const level = payload.level || 'I';
    // Tier in songes payload specifically refers to the internal Songes floor logic, NOT the mission tier.
    // However, the original code used payload.tier. 
    // Let's keep payload.tier for Songes internal logic if it represents "Palier 1-5" of Songes runs?
    // Wait, Dofus Songes runs have "Floors" (Etages). 
    // The previous code had "Palier à atteindre", mapping to 1-5.
    // Use local state if needed, but remove onTierChange for the mission itself.
    const tier = payload.tier || 2;

    const availableLevels = SONGES_CONFIG.levels[difficulty as keyof typeof SONGES_CONFIG.levels] || ['I', 'II', 'III'];

    const updatePayload = (newDifficulty: string, newLevel: string, newTier: number) => {
        const newPayload: SongesPayload = {
            difficulty: newDifficulty as SongesPayload['difficulty'],
            level: newLevel as SongesPayload['level'],
            tier: newTier as SongesPayload['tier'],
        };
        onPayloadChange(newPayload);
        onTitleChange(`Plongée en ${newDifficulty} ${newLevel}`);

        if (onRankChange) {
            if (newDifficulty === 'Cauchemar') onRankChange(4);
            else if (newDifficulty === 'Paradoxe') onRankChange(3);
            else onRankChange(2);
        }
    };

    const handleDifficultyChange = (newDifficulty: string) => {
        const newLevels = SONGES_CONFIG.levels[newDifficulty as keyof typeof SONGES_CONFIG.levels];
        const newLevel = newLevels.includes(level as any) ? level : newLevels[0];
        updatePayload(newDifficulty, newLevel, tier);
    };

    return (
        <div className="space-y-4">
            {/* Difficulty Selector */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Difficulté</Label>
                <div className="grid grid-cols-3 gap-2">
                    {SONGES_CONFIG.difficulties.map(diff => (
                        <button
                            key={diff}
                            type="button"
                            onClick={() => handleDifficultyChange(diff)}
                            className={cn(
                                "p-2 rounded-lg border text-sm font-medium transition-all",
                                difficulty === diff
                                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 text-zinc-400"
                            )}
                        >
                            {diff}
                        </button>
                    ))}
                </div>
            </div>

            {/* Level Selector */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Niveau de songe</Label>
                <div className="flex gap-2">
                    {availableLevels.map(lvl => (
                        <button
                            key={lvl}
                            type="button"
                            onClick={() => updatePayload(difficulty, lvl, tier)}
                            className={cn(
                                "flex-1 p-2 rounded-lg border text-sm font-medium transition-all",
                                level === lvl
                                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 text-zinc-400"
                            )}
                        >
                            {lvl}
                        </button>
                    ))}
                </div>
            </div>

            {/* Tier (Palier) Selector */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Palier à atteindre</Label>
                <div className="flex gap-2">
                    {SONGES_CONFIG.tiers.map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => updatePayload(difficulty, level, t)}
                            className={cn(
                                "flex-1 p-2 rounded-lg border text-sm font-medium transition-all",
                                tier === t
                                    ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-300"
                                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 text-zinc-400"
                            )}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Preview */}
            {(() => {
                const palierNames: Record<number, string> = {
                    1: "Pensées oniriques",
                    2: "Balades fantastiques",
                    3: "Espaces imaginaires",
                    4: "Concepts brumeux",
                    5: "Abstractions chimériques"
                };
                const palierName = palierNames[tier] || palierNames[2];
                return (
                    <div className="p-3 bg-zinc-900/50 rounded-lg border border-cyan-500/20 text-xs text-zinc-400">
                        Démarrer un songe en <span className="text-cyan-400 font-medium">{difficulty} {level}</span> et terminer le <span className="text-cyan-400 font-medium">Palier {tier}</span> : les {palierName}
                    </div>
                );
            })()}
        </div>
    );
}

// --- EXPEDITION FORM ---

export function ExpeditionForm({ payload, onPayloadChange, onTitleChange, onRankChange }: FormProps) {
    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const mode = payload.mode || 'aucun';

    const dungeonFetcher = useCallback(async (query: string) => {
        const res = await searchDungeons(query);
        if (res.success && res.data) {
            setDungeons(res.data);
            return res.data.map(d => ({ value: d.id, label: d.name, subLabel: `Niv. ${d.level}` }));
        }
        return [];
    }, []);

    const handleSelect = (dungeonId: string) => {
        const dungeon = dungeons.find(d => d.id === dungeonId);
        if (dungeon) {
            const newPayload: ExpeditionPayload = {
                dungeonId: dungeon.id,
                dungeonName: dungeon.name,
                bossName: dungeon.bossName,
                mode,
                level: dungeon.level,
                dpnlUrl: dungeon.dpnlUrl || undefined,
                imageUrl: dungeon.imageUrl || undefined,
            };
            onPayloadChange(newPayload);
            updateTitle(dungeon.name, mode);
            if (onRankChange) {
                if (dungeon.level >= 190) onRankChange(4);
                else if (dungeon.level >= 100) onRankChange(3);
                else onRankChange(2);
            }
        }
    };

    const handleModeChange = (newMode: string) => {
        const newPayload = { ...payload, mode: newMode };
        onPayloadChange(newPayload);
        if (payload.dungeonName) {
            updateTitle(payload.dungeonName, newMode);
        }
    };

    const updateTitle = (dungeonName: string, expeditionMode: string) => {
        onTitleChange(`Expédition de ${dungeonName}`);
    };

    const selectedDungeon = payload.dungeonId ? dungeons.find(d => d.id === payload.dungeonId) : null;

    return (
        <div className="space-y-4">
            {/* Mode Selector */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Mode</Label>
                <div className="grid grid-cols-3 gap-2">
                    {EXPEDITION_MODES.map(m => (
                        <button
                            key={m.value}
                            type="button"
                            onClick={() => handleModeChange(m.value)}
                            className={cn(
                                "p-2 rounded-lg border text-sm transition-all",
                                mode === m.value
                                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 text-zinc-400"
                            )}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Search */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Rechercher un donjon</Label>
                <AsyncCombobox
                    value={payload.dungeonId}
                    onSelect={handleSelect}
                    fetcher={dungeonFetcher}
                    placeholder="Sélectionner un donjon..."
                    searchPlaceholder="Donjon ou Boss..."
                />
            </div>

            {/* Preview */}
            {selectedDungeon && (
                <div className="p-3 bg-zinc-900/50 rounded-lg border border-amber-500/20 text-xs text-zinc-400">
                    Vaincre <span className="text-amber-400 font-medium">{selectedDungeon.bossName}</span> dans son expédition
                    {mode !== 'aucun' && <> <span className="text-amber-400">de {mode}</span></>}
                </div>
            )}
        </div>
    );
}

// --- EVENT FORM ---
// Flow: 1) Event context  2) Sub-type  3) Detail form

type EventSubType = 'REGULATION' | 'DONJON' | 'MONSTRE_SPECIAL';

const EVENT_SUBTYPES: { value: EventSubType; label: string; emoji: string; desc: string; color: string; border: string }[] = [
    { value: 'REGULATION', label: 'Régulation', emoji: '⚔️', desc: '50 monstres de l\'événement', color: 'text-amber-300', border: 'border-amber-500/50 bg-amber-500/10' },
    { value: 'DONJON', label: 'Donjon', emoji: '🏰', desc: 'Vaincre le boss du donjon événement', color: 'text-rose-300', border: 'border-rose-500/50 bg-rose-500/10' },
    { value: 'MONSTRE_SPECIAL', label: 'Monstre Spécial', emoji: '💀', desc: 'Monstre unique / boss temporaire', color: 'text-purple-300', border: 'border-purple-500/50 bg-purple-500/10' },
];

type EventContextPreset = 'VULKANIA' | 'NOWEL' | 'PWAK' | 'HALOUINE' | 'AUTRE';

const EVENT_CONTEXTS: { value: EventContextPreset; label: string; emoji: string; period: string }[] = [
    { value: 'VULKANIA', label: 'Vulkania', emoji: '🦕', period: 'Été' },
    { value: 'PWAK', label: 'Île de Pwâk', emoji: '🐣', period: 'Pâques' },
    { value: 'HALOUINE', label: 'Halouine', emoji: '🎃', period: 'Halloween' },
    { value: 'NOWEL', label: 'Île de Nowel', emoji: '🎄', period: 'Noël' },
    { value: 'AUTRE', label: 'Autre...', emoji: '✏️', period: 'Manuel' },
];

const CONTEXT_LABELS: Record<string, string> = {
    VULKANIA: 'Vulkania',
    NOWEL: 'Île de Nowel',
    PWAK: 'Île de Pwâk',
    HALOUINE: 'Halouine',
};

export function EventForm({ payload, onPayloadChange, onTitleChange }: FormProps) {
    const eventType: EventSubType = payload.eventType || 'REGULATION';
    const contextPreset: EventContextPreset = payload.contextPreset || 'AUTRE';
    const contextLabel: string = contextPreset !== 'AUTRE'
        ? (CONTEXT_LABELS[contextPreset] || '')
        : (payload.contextManual || '');

    // Local state for searches
    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const [zones, setZones] = useState<Zone[]>([]);
    const [families, setFamilies] = useState<MonsterFamily[]>([]);

    const handleContextPreset = (ctx: EventContextPreset) => {
        onPayloadChange({ ...payload, contextPreset: ctx, contextManual: ctx !== 'AUTRE' ? '' : payload.contextManual });
        // Rebuild title if a mission name was already set
        rebuildTitle(payload.eventType || 'REGULATION', ctx, ctx !== 'AUTRE' ? (CONTEXT_LABELS[ctx] || '') : (payload.contextManual || ''), payload);
    };

    const handleContextManual = (name: string) => {
        onPayloadChange({ ...payload, contextPreset: 'AUTRE', contextManual: name });
        rebuildTitle(payload.eventType || 'REGULATION', 'AUTRE', name, payload);
    };

    const handleSubTypeChange = (newType: EventSubType) => {
        onPayloadChange({ eventType: newType, contextPreset, contextManual: payload.contextManual });
        onTitleChange('');
    };

    const rebuildTitle = (type: EventSubType, ctx: EventContextPreset, ctxName: string, p: Record<string, any>) => {
        const suffix = ctxName ? ` — ${ctxName}` : '';
        if (type === 'DONJON' && p.dungeonName) onTitleChange(`${p.dungeonName}${suffix}`);
        else if (type === 'REGULATION' && p.familyName) onTitleChange(`Régulation des ${p.familyName}${suffix}`);
        else if (type === 'MONSTRE_SPECIAL' && p.monsterName) onTitleChange(`Vaincre ${p.monsterName}${suffix}`);
    };

    // --- Dungeon fetcher: filtered by event zone if preset active ---
    const dungeonFetcher = useCallback(async (query: string) => {
        // If a preset is selected, try to filter to event dungeons for that zone
        const filters: any = { query };
        if (contextPreset !== 'AUTRE') {
            filters.isEventDungeon = true;
            // Also filter by zone if we can look it up via the event zone key
            const zoneRes = await searchZones(contextLabel, true);
            const matchingZone = zoneRes.data?.find((z: any) => z.eventZoneKey === contextPreset);
            if (matchingZone) filters.zoneId = matchingZone.id;
        }
        const res = await searchDungeonsAdvanced(filters);
        if (res.success && res.data) {
            setDungeons(res.data);
            const items = res.data.map((d: any) => ({ value: d.id, label: d.name, subLabel: `Niv. ${d.level} · Boss: ${d.bossName}` }));
            // If event-filtered returned nothing, fallback to full search
            if (items.length === 0 && contextPreset !== 'AUTRE') {
                const fallback = await searchDungeonsAdvanced({ query });
                if (fallback.success && fallback.data) {
                    setDungeons(fallback.data);
                    return fallback.data.map((d: any) => ({ value: d.id, label: d.name, subLabel: `Niv. ${d.level} · Boss: ${d.bossName} (toute zone)` }));
                }
            }
            return items;
        }
        return [];
    }, [contextPreset, contextLabel]);

    const handleDungeonSelect = (dungeonId: string) => {
        const dungeon = dungeons.find(d => d.id === dungeonId);
        if (dungeon) {
            const suffix = contextLabel ? ` — ${contextLabel}` : '';
            onPayloadChange({ ...payload, eventType: 'DONJON', dungeonId: dungeon.id, dungeonName: dungeon.name, bossName: dungeon.bossName, level: dungeon.level, imageUrl: dungeon.imageUrl });
            onTitleChange(`${dungeon.name}${suffix}`);
        }
    };

    // --- Zone fetcher: event-only when preset active ---
    const zoneFetcher = useCallback(async (query: string) => {
        const eventOnly = contextPreset !== 'AUTRE';
        const res = await searchZones(query, eventOnly);
        if (res.success && res.data) {
            setZones(prev => { const m = new Map(prev.map(z => [z.id, z])); res.data?.forEach(z => m.set(z.id, z)); return Array.from(m.values()); });
            return res.data.map(z => ({ value: z.id, label: z.name, subLabel: eventOnly ? `🗺 Zone événement · Niv. ${z.level}` : `Niv. ${z.level}` }));
        }
        return [];
    }, [contextPreset]);

    const familyFetcher = useCallback(async (query: string) => {
        const res = await getMonsterFamilies({ zoneId: payload.zoneId, search: query });
        if (res.success && res.data) {
            setFamilies(prev => { const m = new Map(prev.map(f => [f.id, f])); res.data?.forEach(f => m.set(f.id, f)); return Array.from(m.values()); });
            return res.data.map(f => ({ value: f.id, label: f.name }));
        }
        return [];
    }, [payload.zoneId]);

    const handleRegZone = (zoneId: string) => {
        const zone = zones.find(z => z.id === zoneId);
        if (zone) {
            onPayloadChange({ ...payload, eventType: 'REGULATION', zoneId: zone.id, zoneName: zone.name, familyId: '', familyName: '', targetCount: 50 });
            const suffix = contextLabel ? ` — ${contextLabel}` : '';
            onTitleChange(`Régulation en ${zone.name}${suffix}`);
        }
    };

    const handleRegFamily = (familyId: string) => {
        const family = families.find(f => f.id === familyId);
        if (family) {
            onPayloadChange({ ...payload, eventType: 'REGULATION', familyId: family.id, familyName: family.name, imageUrl: family.imageUrl });
            const suffix = contextLabel ? ` — ${contextLabel}` : '';
            onTitleChange(`Régulation des ${family.name}${suffix}`);
        }
    };

    // --- Monstre Spécial ---
    const handleMonsterName = (name: string) => {
        onPayloadChange({ ...payload, eventType: 'MONSTRE_SPECIAL', monsterName: name });
        const suffix = contextLabel ? ` — ${contextLabel}` : '';
        onTitleChange(name ? `Vaincre ${name}${suffix}` : '');
    };

    const handleTargetCount = (count: number) => {
        onPayloadChange({ ...payload, eventType: 'MONSTRE_SPECIAL', targetCount: count });
    };

    return (
        <div className="space-y-5">
            {/* ── STEP 1: Event Context ────────────────── */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-yellow-400/80">Étape 1</span>
                    <span className="text-xs text-zinc-400 font-medium">Contexte de l'événement</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {EVENT_CONTEXTS.map(ctx => (
                        <button
                            key={ctx.value}
                            type="button"
                            onClick={() => handleContextPreset(ctx.value)}
                            title={ctx.period}
                            className={cn(
                                "flex flex-col items-center gap-1 p-2.5 rounded-xl border text-center transition-all duration-200",
                                contextPreset === ctx.value
                                    ? ctx.value === 'AUTRE'
                                        ? "border-zinc-500/50 bg-zinc-700/40 text-zinc-200"
                                        : "border-yellow-500/50 bg-yellow-500/10 text-yellow-200"
                                    : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 text-zinc-500"
                            )}
                        >
                            <span className="text-lg">{ctx.emoji}</span>
                            <span className="text-[10px] font-black leading-tight">{ctx.label}</span>
                            <span className="text-[8px] text-zinc-500">{ctx.period}</span>
                        </button>
                    ))}
                </div>

                {/* Free text for "Autre" */}
                {contextPreset === 'AUTRE' && (
                    <Input
                        className="bg-zinc-950 border-zinc-700 placeholder:text-zinc-600 text-sm mt-2"
                        placeholder="Nom de l'événement... (ex: Nouvel An Lunaire)"
                        value={payload.contextManual || ''}
                        onChange={e => handleContextManual(e.target.value)}
                        autoFocus
                    />
                )}

                {/* Context badge */}
                {contextLabel && (
                    <div className="flex items-center gap-2 py-1.5 px-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 text-yellow-300 text-[11px] font-bold">
                        <Sparkles className="w-3 h-3 shrink-0" />
                        Contexte actif : <span className="font-black">{contextLabel}</span>
                    </div>
                )}
            </div>

            <div className="h-px bg-zinc-800" />

            {/* ── STEP 2: Sub-type ─────────────────────── */}
            <div className="space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-indigo-400/80">Étape 2</span>
                    <span className="text-xs text-zinc-400 font-medium">Type de mission</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                    {EVENT_SUBTYPES.map(st => (
                        <button
                            key={st.value}
                            type="button"
                            onClick={() => handleSubTypeChange(st.value)}
                            className={cn(
                                "flex flex-col items-center gap-1 p-3 rounded-xl border text-center transition-all duration-200",
                                eventType === st.value ? st.border : "bg-zinc-900 border-zinc-800 hover:border-zinc-600"
                            )}
                        >
                            <span className="text-xl">{st.emoji}</span>
                            <span className={cn("text-xs font-black", eventType === st.value ? st.color : "text-zinc-400")}>{st.label}</span>
                            <span className="text-[9px] text-zinc-500 leading-tight">{st.desc}</span>
                        </button>
                    ))}
                </div>
            </div>

            <div className="h-px bg-zinc-800" />

            {/* ── STEP 3: Detail form ──────────────────── */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400/80">Étape 3</span>
                    <span className="text-xs text-zinc-400 font-medium">
                        {eventType === 'DONJON' ? 'Sélectionner le donjon' : eventType === 'REGULATION' ? 'Sélectionner les monstres' : 'Définir le monstre spécial'}
                    </span>
                </div>

                {/* DONJON */}
                {eventType === 'DONJON' && (
                    <div className="space-y-2">
                        <AsyncCombobox
                            value={payload.dungeonId}
                            onSelect={handleDungeonSelect}
                            fetcher={dungeonFetcher}
                            placeholder="Rechercher un donjon..."
                            searchPlaceholder="Nom du donjon ou du boss..."
                            emptyText="Aucun donjon trouvé."
                        />
                        {payload.bossName && (
                            <div className="p-3 bg-rose-500/10 rounded-lg border border-rose-500/20 text-xs text-zinc-400">
                                Vaincre <span className="text-rose-400 font-bold">{payload.bossName}</span>
                                {contextLabel && <> · <span className="text-yellow-400">{contextLabel}</span></>}
                            </div>
                        )}
                    </div>
                )}

                {/* REGULATION */}
                {eventType === 'REGULATION' && (
                    <div className="space-y-2">
                        <AsyncCombobox value={payload.zoneId} onSelect={handleRegZone} fetcher={zoneFetcher} placeholder="Zone (optionnel)..." searchPlaceholder="Rechercher une zone..." />
                        <AsyncCombobox key={payload.zoneId} value={payload.familyId} onSelect={handleRegFamily} fetcher={familyFetcher} placeholder="Famille de monstres..." searchPlaceholder="Rechercher une famille..." />
                        {payload.familyName && (
                            <div className="p-3 bg-amber-500/10 rounded-lg border border-amber-500/20 text-xs text-zinc-400">
                                Vaincre <span className="text-amber-400 font-bold">50</span> <span className="text-amber-400 font-bold">{payload.familyName}</span>
                                {contextLabel && <> · <span className="text-yellow-400">{contextLabel}</span></>}
                            </div>
                        )}
                    </div>
                )}

                {/* MONSTRE SPÉCIAL */}
                {eventType === 'MONSTRE_SPECIAL' && (
                    <div className="space-y-3">
                        <Input
                            className="bg-zinc-950 border-zinc-800"
                            placeholder="Ex: Malice, Damadrya, Tofus d'Halouine..."
                            value={payload.monsterName || ''}
                            onChange={e => handleMonsterName(e.target.value)}
                        />
                        <div className="flex gap-2">
                            {[1, 10, 25, 50, 100].map(count => (
                                <button
                                    key={count}
                                    type="button"
                                    onClick={() => handleTargetCount(count)}
                                    className={cn(
                                        "flex-1 py-2 rounded-lg border text-xs font-bold transition-all",
                                        (payload.targetCount || 50) === count
                                            ? "bg-purple-500/20 border-purple-500/50 text-purple-300"
                                            : "bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-600"
                                    )}
                                >
                                    {count}
                                </button>
                            ))}
                        </div>
                        {payload.monsterName && (
                            <div className="p-3 bg-purple-500/10 rounded-lg border border-purple-500/20 text-xs text-zinc-400">
                                Vaincre <span className="text-purple-400 font-bold">{payload.targetCount || 50}</span>{' '}
                                <span className="text-purple-400 font-bold">{payload.monsterName}</span>
                                {contextLabel && <> · <span className="text-yellow-400">{contextLabel}</span></>}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

