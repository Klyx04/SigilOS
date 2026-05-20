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
                    key={selectedLevel}
                    value={payload.dungeonId}
                    onSelect={handleSelect}
                    fetcher={dungeonFetcher}
                    placeholder={selectedLevel ? `Donjons Niv. ${selectedLevel}...` : "Sélectionner un donjon..."}
                    searchPlaceholder="Nom du donjon ou du boss..."
                    emptyText="Aucun donjon trouvé."
                />
            </div>

            {/* Visual Preview Card for Dungeon */}
            {selectedDungeon && (
                <div className="relative group overflow-hidden rounded-2xl border border-rose-500/30 bg-zinc-900/40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300 p-4">
                    <div className="flex gap-4 relative z-10">
                        <div className="w-20 h-20 rounded-xl bg-zinc-800 border border-white/5 flex-shrink-0 overflow-hidden relative">
                            {selectedDungeon.imageUrl ? (
                                <img 
                                    src={selectedDungeon.imageUrl} 
                                    alt={selectedDungeon.name}
                                    className="w-full h-full object-contain scale-110 group-hover:scale-100 transition-all duration-500"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                    <Skull className="w-8 h-8 text-zinc-800" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                        </div>

                        <div className="flex-1 min-w-0 py-1">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5" /> Mission Active
                                </span>
                                <span className="px-2 py-0.5 bg-rose-500/10 text-[9px] font-black text-rose-500 border border-rose-500/20 rounded-md">
                                    NIV. {selectedDungeon.level}
                                </span>
                            </div>
                            <h4 className="text-white font-black uppercase text-sm leading-tight truncate mb-1">
                                {selectedDungeon.name}
                            </h4>
                            <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-bold">
                                <Skull className="w-3.5 h-3.5 text-rose-400/70" />
                                <span>{selectedDungeon.bossName}</span>
                            </div>
                        </div>
                    </div>
                    {/* Ambient background glow */}
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-rose-500/5 blur-3xl rounded-full" />
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

    const selectedFamily = payload.familyId ? families.find(f => f.id === payload.familyId) : null;
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
                />
            </div>

            {/* Visual Preview Card for Regulation */}
            {(payload.familyName || payload.zoneName) && (
                <div className="relative overflow-hidden rounded-2xl border border-emerald-500/30 bg-zinc-900/40 backdrop-blur-md p-4 space-y-3 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 rounded-xl bg-zinc-800 border border-white/5 flex-shrink-0 overflow-hidden">
                            {payload.imageUrl ? (
                                <img src={payload.imageUrl} alt={payload.familyName} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center">
                                    <Skull className="w-6 h-6 text-zinc-700" />
                                </div>
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1 flex items-center gap-1.5">
                                <CheckCircle2 className="w-3.5 h-3.5" /> Mission Active
                            </div>
                            <h4 className="text-white font-black uppercase text-sm truncate leading-tight">
                                {payload.familyName || "Famille inconnue"}
                            </h4>
                            <div className="text-zinc-500 text-[10px] mt-1 flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                <span className="truncate">{payload.zoneName || "Toute zone"}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div className="pt-3 border-t border-white/5">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">Objectif de guilde</span>
                            <span className="text-emerald-400 font-black text-xs">Vaincre 50 monstres</span>
                        </div>
                    </div>
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

    // Anomalie Artwork
    const getAnomalieArtwork = () => {
        switch(anomalieType) {
            case 'BOSS': return "https://static.sigilos.fr/game/assets/anomalie_boss.png";
            case 'GARDIENS': return "https://static.sigilos.fr/game/assets/anomalie_trio.png";
            case 'COLLECTE': return "https://static.sigilos.fr/game/assets/temporal_fragment.png";
            default: return "https://static.sigilos.fr/game/assets/anomalie_zone.png";
        }
    };

    return (
        <div className="space-y-4">
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Type d'anomalie</Label>
                <RadioGroup value={anomalieType} onValueChange={handleTypeChange} className="grid grid-cols-2 gap-2">
                    {TYPES.map(t => (
                        <div key={t.value} className={cn(
                            "flex items-center space-x-2 p-3 rounded-xl border cursor-pointer transition-all",
                            anomalieType === t.value ? "bg-fuchsia-500/10 border-fuchsia-500/50 shadow-lg shadow-fuchsia-500/10" : "bg-zinc-950 border-zinc-900"
                        )}>
                            <RadioGroupItem value={t.value} id={t.value} />
                            <Label htmlFor={t.value} className="cursor-pointer text-sm">
                                <div className={cn("font-black uppercase tracking-tighter", anomalieType === t.value ? "text-fuchsia-300" : "text-zinc-400")}>{t.label}</div>
                                <div className="text-[10px] text-zinc-600 font-medium">{t.desc}</div>
                            </Label>
                        </div>
                    ))}
                </RadioGroup>
            </div>

            {anomalieType === 'COLLECTE' && (
                <div className="space-y-2">
                    <Label className="text-xs text-zinc-400 font-bold uppercase tracking-widest text-[9px]">Niveau de collecte (Fragments Ankama 3.5)</Label>
                    <div className="grid grid-cols-3 gap-2">
                        {([1, 2, 3] as const).map(lvl => (
                            <button
                                key={lvl}
                                type="button"
                                onClick={() => handleFragmentChange(lvl)}
                                className={cn(
                                    "py-2.5 rounded-xl border text-[11px] font-black tracking-widest transition-all",
                                    fragmentLevel === lvl
                                        ? "bg-fuchsia-500/20 border-fuchsia-500/50 text-fuchsia-300 shadow-xl shadow-fuchsia-500/10"
                                        : "bg-zinc-950 border-zinc-900 text-zinc-600 hover:border-zinc-700"
                                )}
                            >
                                FRAGMENT {lvl}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {anomalieType !== 'COLLECTE' && (
                <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Tranche de niveau</Label>
                    <Select value={levelRange} onValueChange={handleLevelChange}>
                        <SelectTrigger className="bg-zinc-950 border-zinc-900 rounded-xl">
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-zinc-950 border-white/5">
                            {ANOMALIE_LEVEL_RANGES.map(range => (
                                <SelectItem key={range} value={range}>{range}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Visual Preview Card for Anomalie */}
            <div className="relative overflow-hidden rounded-2xl border border-fuchsia-500/30 bg-fuchsia-500/5 p-4 flex gap-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="w-14 h-14 rounded-xl bg-zinc-900/80 backdrop-blur-md border border-fuchsia-500/20 flex-shrink-0 flex items-center justify-center relative overflow-hidden">
                    <img src={getAnomalieArtwork()} className="w-10 h-10 object-contain z-10" alt="Artwork" />
                    <div className="absolute inset-0 bg-fuchsia-500/10 blur-xl scale-150" />
                </div>
                <div className="flex-1 text-[11px] text-zinc-400 leading-relaxed py-0.5">
                    <div className="font-black text-fuchsia-400 uppercase tracking-widest text-[9px] mb-1">Visualisation Mission</div>
                    {anomalieType === 'ZONE' && (
                        <>Vaincre 50 monstres dans un territoire de niveau <span className="text-white font-black">{levelRange}</span> sous anomalie avec un <span className="text-fuchsia-300 font-bold">[Elixir uchronique]</span></>
                    )}
                    {anomalieType === 'BOSS' && (
                        <>Vaincre un <span className="text-white font-black text-xs">Gardien d'anomalie</span> de niveau <span className="text-white font-black">{levelRange}</span> avec un <span className="text-fuchsia-300 font-bold">[Elixir uchronique]</span></>
                    )}
                    {anomalieType === 'GARDIENS' && (
                        <>Vaincre <span className="text-white font-black text-xs">3 Gardiens</span> de niveau <span className="text-white font-black">{levelRange}</span> avec un <span className="text-fuchsia-300 font-bold">[Elixir uchronique]</span></>
                    )}
                    {anomalieType === 'COLLECTE' && (
                        <>Collecter des <span className="text-white font-black">Fragments d'anomalie</span> — palier <span className="text-fuchsia-300 font-black text-sm">{fragmentLevel}</span> <span className="text-zinc-600">(Maj 3.5)</span></>
                    )}
                </div>
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

    const getDifficultyColor = () => {
        if (difficulty === 'Cauchemar') return "text-rose-500 border-rose-500/50 bg-rose-500/10 shadow-rose-500/10";
        if (difficulty === 'Paradoxe') return "text-cyan-400 border-cyan-500/50 bg-cyan-500/10 shadow-cyan-500/10";
        return "text-emerald-400 border-emerald-500/50 bg-emerald-500/10 shadow-emerald-500/10";
    };

    const getDifficultyArtwork = () => {
        const diffKey = difficulty === 'Cauchemar' ? 'cauchemar' : difficulty === 'Paradoxe' ? 'paradoxe' : 'reve';
        const lvlKey = level === 'I' ? '1' : level === 'II' ? '2' : level === 'III' ? '3' : '4';
        return `/assets/missions/${diffKey}${lvlKey}.png`;
    };

    return (
        <div className="space-y-5">
            <div className="space-y-2">
                <Label className="text-xs text-zinc-500 font-black uppercase tracking-widest text-[9px]">Difficulté Onirique</Label>
                <div className="grid grid-cols-3 gap-2">
                    {SONGES_CONFIG.difficulties.map(diff => {
                        const isActive = difficulty === diff;
                        return (
                            <button
                                key={diff}
                                type="button"
                                onClick={() => updatePayload(diff, level, tier)}
                                className={cn(
                                    "py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all",
                                    isActive ? getDifficultyColor() : "bg-zinc-950 border-zinc-900 text-zinc-600"
                                )}
                            >
                                {diff}
                            </button>
                        );
                    })}
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Niveau de songe (Étage)</Label>
                <div className="flex gap-2">
                    {availableLevels.map(lvl => (
                        <button
                            key={lvl}
                            type="button"
                            onClick={() => updatePayload(difficulty, lvl, tier)}
                            className={cn(
                                "flex-1 py-2 rounded-xl border text-[11px] font-black transition-all",
                                level === lvl ? "bg-zinc-800 border-white/20 text-white shadow-xl" : "bg-zinc-950 border-zinc-900 text-zinc-600"
                            )}
                        >
                            {lvl}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Palier de réussite</Label>
                <div className="flex gap-1.5 p-1 bg-zinc-950 border border-zinc-900 rounded-2xl">
                    {SONGES_CONFIG.tiers.map(t => (
                        <button
                            key={t}
                            type="button"
                            onClick={() => updatePayload(difficulty, level, t)}
                            className={cn(
                                "flex-1 py-2 rounded-xl text-[10px] font-black transition-all",
                                tier === t ? "bg-cyan-500 text-black shadow-lg shadow-cyan-500/20" : "text-zinc-600 hover:text-zinc-400"
                            )}
                        >
                            T{t}
                        </button>
                    ))}
                </div>
            </div>

            {/* Visual Preview Card for Songes */}
            <div className="relative overflow-hidden rounded-2xl border border-cyan-500/30 bg-cyan-900/5 p-4 flex items-center gap-4 animate-in fade-in zoom-in-95 duration-500">
                <div className="w-16 h-16 rounded-2xl bg-zinc-900/50 backdrop-blur-md border border-cyan-500/20 flex items-center justify-center relative overflow-hidden shrink-0">
                    <img src={getDifficultyArtwork()} className="w-14 h-14 object-contain z-10" alt="Songes" />
                    <div className="absolute inset-0 bg-cyan-500/5 animate-pulse" />
                </div>
                <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Aperçu Mission</span>
                        <div className="flex items-center gap-1">
                            {Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className={cn("w-1 h-1 rounded-full", i < tier ? "bg-cyan-400" : "bg-zinc-800")} />
                            ))}
                        </div>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-tight">
                        Compléter le <span className="text-white font-black">Palier {tier}</span> d'un songe en <span className="text-cyan-400 font-bold uppercase">{difficulty} {level}</span>.
                    </p>
                    <div className="text-[9px] text-zinc-600 font-bold italic">
                        {tier === 1 ? "Pensées oniriques" : tier === 5 ? "Abstractions chimériques" : "Exploration onirique"}
                    </div>
                </div>
            </div>
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
        <div className="space-y-5">
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Mode d'expédition</Label>
                <div className="grid grid-cols-3 gap-2">
                    {EXPEDITION_MODES.map(m => (
                        <button
                            key={m.value}
                            type="button"
                            onClick={() => handleModeChange(m.value)}
                            className={cn(
                                "py-2.5 rounded-xl border text-[11px] font-black uppercase tracking-widest transition-all",
                                mode === m.value
                                    ? "bg-amber-500/20 border-amber-500/50 text-amber-300 shadow-xl shadow-amber-500/10"
                                    : "bg-zinc-950 border-zinc-900 text-zinc-600 hover:border-zinc-700"
                            )}
                        >
                            {m.label}
                        </button>
                    ))}
                </div>
            </div>

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

            {/* Selected Preview - Expedition Card */}
            {selectedDungeon && (
                <div className="relative group overflow-hidden rounded-2xl border border-amber-500/30 bg-zinc-900/40 backdrop-blur-md animate-in fade-in slide-in-from-bottom-2 duration-300 p-4">
                    <div className="flex gap-4 relative z-10">
                        <div className="w-20 h-20 rounded-xl bg-zinc-800 border border-white/5 flex-shrink-0 overflow-hidden relative">
                            {selectedDungeon.imageUrl ? (
                                <img 
                                    src={selectedDungeon.imageUrl} 
                                    alt={selectedDungeon.name}
                                    className="w-full h-full object-contain scale-110 group-hover:scale-100 transition-transform duration-700"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center bg-zinc-900">
                                    <Sparkles className="w-8 h-8 text-zinc-800" />
                                </div>
                            )}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
                        </div>

                        <div className="flex-1 min-w-0 py-1">
                            <div className="flex items-center gap-2 mb-1.5">
                                <span className="px-1.5 py-0.5 bg-amber-500/20 text-[8px] font-black text-amber-400 border border-amber-500/30 rounded uppercase tracking-widest">
                                    Expédition
                                </span>
                                {mode !== 'aucun' && (
                                    <span className="text-[8px] font-black text-white/40 uppercase tracking-widest">
                                        Mode {mode}
                                    </span>
                                )}
                            </div>
                            <h4 className="text-white font-black uppercase text-sm leading-tight truncate mb-1">
                                {selectedDungeon.name}
                            </h4>
                            <div className="flex items-center gap-1.5 text-zinc-500 text-[10px] font-bold">
                                <CheckCircle2 className="w-3.5 h-3.5 text-amber-400/70" />
                                <span>Vaincre le Boss en mode expédition</span>
                            </div>
                        </div>
                    </div>
                    {/* Ambient background glow */}
                    <div className="absolute -right-4 -top-4 w-24 h-24 bg-amber-500/5 blur-3xl rounded-full" />
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
        <div className="space-y-6">
            {/* ── STEP 1: Event Context ────────────────── */}
            <div className="space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-5 h-5 rounded-full bg-yellow-500/20 flex items-center justify-center border border-yellow-500/30">
                            <span className="text-[10px] font-black text-yellow-400">1</span>
                        </div>
                        <span className="text-xs text-zinc-400 font-black uppercase tracking-widest">Contexte</span>
                    </div>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                    {EVENT_CONTEXTS.map(ctx => (
                        <button
                            key={ctx.value}
                            type="button"
                            onClick={() => handleContextPreset(ctx.value)}
                            className={cn(
                                "flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center transition-all duration-300 relative overflow-hidden group",
                                contextPreset === ctx.value
                                    ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-200 shadow-lg shadow-yellow-500/5"
                                    : "bg-zinc-950 border-zinc-900 hover:border-zinc-700 text-zinc-500"
                            )}
                        >
                            <span className={cn("text-2xl transition-transform duration-300", contextPreset === ctx.value ? "scale-110" : "group-hover:scale-110")}>{ctx.emoji}</span>
                            <div className="space-y-0.5">
                                <div className="text-[10px] font-black leading-tight uppercase tracking-tighter">{ctx.label}</div>
                                <div className="text-[8px] opacity-60 font-bold">{ctx.period}</div>
                            </div>
                            {contextPreset === ctx.value && <div className="absolute inset-0 bg-yellow-500/5 animate-pulse pointer-events-none" />}
                        </button>
                    ))}
                </div>

                {contextPreset === 'AUTRE' && (
                    <Input
                        className="bg-zinc-950 border-zinc-800 rounded-xl placeholder:text-zinc-700 text-xs mt-2 focus:border-yellow-500/50 transition-all"
                        placeholder="Nom de l'événement personnalisé..."
                        value={payload.contextManual || ''}
                        onChange={e => handleContextManual(e.target.value)}
                    />
                )}
            </div>

            {/* ── STEP 2: Sub-type ─────────────────────── */}
            <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30">
                        <span className="text-[10px] font-black text-indigo-400">2</span>
                    </div>
                    <span className="text-xs text-zinc-400 font-black uppercase tracking-widest">Type de mission</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                    {EVENT_SUBTYPES.map(st => (
                        <button
                            key={st.value}
                            type="button"
                            onClick={() => handleSubTypeChange(st.value)}
                            className={cn(
                                "flex flex-col items-center gap-1.5 p-3 rounded-2xl border text-center transition-all duration-300",
                                eventType === st.value 
                                    ? st.border + " shadow-lg" 
                                    : "bg-zinc-950 border-zinc-900 hover:border-zinc-700 text-zinc-500"
                            )}
                        >
                            <span className="text-xl">{st.emoji}</span>
                            <div className="space-y-0.5">
                                <div className={cn("text-[10px] font-black uppercase tracking-tighter", eventType === st.value ? st.color : "text-zinc-400")}>{st.label}</div>
                                <div className="text-[8px] opacity-60 font-bold leading-tight">{st.desc}</div>
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* ── STEP 3: Detail form ──────────────────── */}
            <div className="space-y-4 pt-2 border-t border-white/5">
                <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center border border-emerald-500/30">
                        <span className="text-[10px] font-black text-emerald-400">3</span>
                    </div>
                    <span className="text-xs text-zinc-400 font-black uppercase tracking-widest">Objectif</span>
                </div>

                {/* DONJON */}
                {eventType === 'DONJON' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
                        <AsyncCombobox
                            value={payload.dungeonId}
                            onSelect={handleDungeonSelect}
                            fetcher={dungeonFetcher}
                            placeholder="Choisir le donjon événement..."
                            searchPlaceholder="Nom du donjon..."
                            emptyText="Aucun donjon trouvé."
                        />
                        {payload.bossName && (
                            <div className="relative overflow-hidden rounded-2xl border border-rose-500/30 bg-rose-500/5 p-4 flex gap-4">
                                <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-white/5 flex-shrink-0 overflow-hidden relative">
                                    {payload.imageUrl ? (
                                        <img src={payload.imageUrl} alt={payload.bossName} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center"><Skull className="w-6 h-6 text-zinc-800" /></div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="text-[10px] font-black text-rose-400 uppercase tracking-widest mb-1">Cible Événement</div>
                                    <h4 className="text-white font-black uppercase text-sm leading-tight">{payload.bossName}</h4>
                                    {contextLabel && <div className="text-[10px] text-yellow-400 font-bold mt-1 flex items-center gap-1"><Sparkles className="w-3 h-3" /> {contextLabel}</div>}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* REGULATION */}
                {eventType === 'REGULATION' && (
                    <div className="space-y-3 animate-in fade-in slide-in-from-top-1 duration-300">
                        <AsyncCombobox value={payload.zoneId} onSelect={handleRegZone} fetcher={zoneFetcher} placeholder="Zone (Territoire)..." searchPlaceholder="Rechercher une zone..." />
                        <AsyncCombobox key={payload.zoneId} value={payload.familyId} onSelect={handleRegFamily} fetcher={familyFetcher} placeholder="Famille de monstres..." searchPlaceholder="Rechercher une famille..." />
                        {payload.familyName && (
                            <div className="relative overflow-hidden rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 flex gap-4">
                                <div className="w-14 h-14 rounded-xl bg-zinc-900 border border-white/5 flex-shrink-0 overflow-hidden relative">
                                    {payload.imageUrl ? (
                                        <img src={payload.imageUrl} alt={payload.familyName} className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center"><Skull className="w-6 h-6 text-zinc-800" /></div>
                                    )}
                                </div>
                                <div className="flex-1">
                                    <div className="text-[10px] font-black text-amber-400 uppercase tracking-widest mb-1">Régulation Active</div>
                                    <h4 className="text-white font-black uppercase text-sm leading-tight">{payload.familyName}</h4>
                                    <div className="text-[10px] text-zinc-500 font-bold mt-1">Vaincre 50 monstres</div>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* MONSTRE SPÉCIAL */}
                {eventType === 'MONSTRE_SPECIAL' && (
                    <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-300">
                        <Input
                            className="bg-zinc-950 border-zinc-800 rounded-xl text-sm h-11 focus:border-purple-500/50"
                            placeholder="Ex: Malice, Damadrya, Tofus d'Halouine..."
                            value={payload.monsterName || ''}
                            onChange={e => handleMonsterName(e.target.value)}
                        />
                        <div className="flex gap-1.5 p-1 bg-zinc-950 border border-zinc-900 rounded-2xl">
                            {[1, 10, 25, 50, 100].map(count => (
                                <button
                                    key={count}
                                    type="button"
                                    onClick={() => handleTargetCount(count)}
                                    className={cn(
                                        "flex-1 py-2 rounded-xl text-[10px] font-black transition-all",
                                        (payload.targetCount || 50) === count
                                            ? "bg-purple-500 text-white shadow-lg shadow-purple-500/20"
                                            : "text-zinc-600 hover:text-zinc-400"
                                    )}
                                >
                                    {count}
                                </button>
                            ))}
                        </div>
                        {payload.monsterName && (
                            <div className="relative overflow-hidden rounded-2xl border border-purple-500/30 bg-purple-500/5 p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Contrat Spécial</span>
                                    <Skull className="w-3.5 h-3.5 text-purple-400" />
                                </div>
                                <h4 className="text-white font-black uppercase text-sm leading-tight mb-1">{payload.monsterName}</h4>
                                <p className="text-[10px] text-zinc-500 font-bold">Objectif : Vaincre {payload.targetCount || 50} spécimens</p>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

