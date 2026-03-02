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
import { Loader2, ExternalLink, Skull, MapPin, CheckCircle2 } from "lucide-react";
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

    const handleTypeChange = (type: 'ZONE' | 'BOSS') => {
        const newPayload: AnomaliePayload = { type, levelRange };
        onPayloadChange(newPayload);
        updateTitle(type, levelRange);
    };

    const handleLevelChange = (range: string) => {
        const newPayload: AnomaliePayload = { type: anomalieType, levelRange: range as AnomaliePayload['levelRange'] };
        onPayloadChange(newPayload);
        updateTitle(anomalieType, range);
    };

    const updateTitle = (type: string, range: string) => {
        if (type === 'ZONE') {
            onTitleChange(`Zone Anomalie ${range}`);
        } else {
            onTitleChange(`Gardien Anomalie ${range}`);
        }
    };

    return (
        <div className="space-y-4">
            {/* Type Selector */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Type d'anomalie</Label>
                <RadioGroup value={anomalieType} onValueChange={handleTypeChange} className="grid grid-cols-2 gap-2">
                    <div className={cn(
                        "flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-all",
                        anomalieType === 'ZONE' ? "bg-fuchsia-500/20 border-fuchsia-500/50" : "bg-zinc-900 border-zinc-800"
                    )}>
                        <RadioGroupItem value="ZONE" id="zone" />
                        <Label htmlFor="zone" className="cursor-pointer text-sm">
                            <div className="font-medium">Zone</div>
                            <div className="text-xs text-zinc-500">50 monstres</div>
                        </Label>
                    </div>
                    <div className={cn(
                        "flex items-center space-x-2 p-3 rounded-lg border cursor-pointer transition-all",
                        anomalieType === 'BOSS' ? "bg-fuchsia-500/20 border-fuchsia-500/50" : "bg-zinc-900 border-zinc-800"
                    )}>
                        <RadioGroupItem value="BOSS" id="boss" />
                        <Label htmlFor="boss" className="cursor-pointer text-sm">
                            <div className="font-medium">Gardien</div>
                            <div className="text-xs text-zinc-500">Gardien d'anomalie</div>
                        </Label>
                    </div>
                </RadioGroup>
            </div>

            {/* Level Range Selector */}
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

            {/* Preview */}
            <div className="p-3 bg-zinc-900/50 rounded-lg border border-fuchsia-500/20 text-xs text-zinc-400">
                {anomalieType === 'ZONE' ? (
                    <>Vaincre 50 monstres dans un territoire de niveau <span className="text-fuchsia-400 font-medium">{levelRange}</span> sous anomalie avec un <span className="text-fuchsia-400">[Elixir uchronique]</span></>
                ) : (
                    <>Vaincre un gardien d'anomalie de niveau <span className="text-fuchsia-400 font-medium">{levelRange}</span> avec un <span className="text-fuchsia-400">[Elixir uchronique]</span></>
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

export function EventForm({ payload, onPayloadChange, onTitleChange }: FormProps) {
    const title = payload.title || '';
    const description = payload.description || '';

    const handleTitleChange = (value: string) => {
        onPayloadChange({ ...payload, title: value, description });
        onTitleChange(value);
    };

    const handleDescriptionChange = (value: string) => {
        const newPayload: EventPayload = { description: value };
        onPayloadChange({ ...payload, description: value });
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Titre de l'événement</Label>
                <Input
                    className="bg-zinc-950 border-zinc-800"
                    placeholder="Ex: Tournoi PvP inter-guilde"
                    value={title}
                    onChange={e => handleTitleChange(e.target.value)}
                />
            </div>

            <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Description</Label>
                <Textarea
                    className="bg-zinc-950 border-zinc-800 min-h-[80px]"
                    placeholder="Décrivez l'événement..."
                    value={description}
                    onChange={e => handleDescriptionChange(e.target.value)}
                />
            </div>
        </div>
    );
}
