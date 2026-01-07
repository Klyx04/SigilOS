'use client'

import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
import { getDungeons, getZones } from "@/server/actions/game-data-actions";
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
import { Loader2, Search, ExternalLink } from "lucide-react";
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

type FormProps = {
    payload: Record<string, any>;
    onPayloadChange: (payload: Record<string, any>) => void;
    onTitleChange: (title: string) => void;
    onTierChange: (tier: number) => void;
};

// --- DONJON FORM ---

export function DungeonForm({ payload, onPayloadChange, onTitleChange, onTierChange }: FormProps) {
    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        getDungeons().then(res => {
            if (res.success && res.data) {
                setDungeons(res.data);
            }
            setIsLoading(false);
        });
    }, []);

    const filteredDungeons = dungeons.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.bossName.toLowerCase().includes(search.toLowerCase())
    );

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
            // Auto-set tier based on level
            if (dungeon.level >= 190) onTierChange(4);
            else if (dungeon.level >= 100) onTierChange(3);
            else if (dungeon.level >= 50) onTierChange(2);
            else onTierChange(1);
        }
    };

    const selectedDungeon = payload.dungeonId ? dungeons.find(d => d.id === payload.dungeonId) : null;

    if (isLoading) {
        return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>;
    }

    if (dungeons.length === 0) {
        return (
            <div className="text-center py-6 text-zinc-500">
                <p className="text-sm">Aucun donjon en base de données.</p>
                <p className="text-xs mt-1">Ajoute des donjons via Prisma Studio.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Search */}
            <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                <Input
                    className="pl-9 bg-zinc-950 border-zinc-800"
                    placeholder="Rechercher un donjon..."
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>

            {/* Dungeon Grid */}
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto pr-1">
                {filteredDungeons.slice(0, 20).map(dungeon => (
                    <button
                        key={dungeon.id}
                        type="button"
                        onClick={() => handleSelect(dungeon.id)}
                        className={cn(
                            "p-2 rounded-lg border text-left transition-all text-sm",
                            payload.dungeonId === dungeon.id
                                ? "bg-rose-500/20 border-rose-500/50 text-rose-300"
                                : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 text-zinc-300"
                        )}
                    >
                        <div className="font-medium truncate">{dungeon.name}</div>
                        <div className="text-xs text-zinc-500">Niv. {dungeon.level}</div>
                    </button>
                ))}
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

export function RegulationForm({ payload, onPayloadChange, onTitleChange, onTierChange }: FormProps) {
    const [zones, setZones] = useState<Zone[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [selectedZoneId, setSelectedZoneId] = useState<string>(payload.zoneId || "");

    useEffect(() => {
        getZones().then(res => {
            if (res.success && res.data) {
                setZones(res.data);
            }
            setIsLoading(false);
        });
    }, []);

    const selectedZone = zones.find(z => z.id === selectedZoneId);

    const handleZoneChange = (zoneId: string) => {
        setSelectedZoneId(zoneId);
        const zone = zones.find(z => z.id === zoneId);
        if (zone) {
            // Auto-set tier based on zone level
            if (zone.level >= 190) onTierChange(4);
            else if (zone.level >= 100) onTierChange(3);
            else if (zone.level >= 50) onTierChange(2);
            else onTierChange(1);
        }
        // Clear monster selection when zone changes
        onPayloadChange({ zoneId, zoneName: zone?.name || '' });
    };

    const handleMonsterChange = (monsterId: string) => {
        const monster = selectedZone?.monsters.find(m => m.id === monsterId);
        if (monster && selectedZone) {
            const newPayload: RegulationPayload = {
                zoneId: selectedZone.id,
                zoneName: selectedZone.name,
                monsterId: monster.id,
                monsterName: monster.name,
                targetCount: 50,
                imageUrl: monster.imageUrl || undefined,
            };
            onPayloadChange(newPayload);
            onTitleChange(`Régulation des ${monster.name}`);
        }
    };

    if (isLoading) {
        return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>;
    }

    if (zones.length === 0) {
        return (
            <div className="text-center py-6 text-zinc-500">
                <p className="text-sm">Aucune zone en base de données.</p>
                <p className="text-xs mt-1">Ajoute des zones via Prisma Studio.</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Zone Selector */}
            <div className="space-y-2">
                <Label className="text-xs text-zinc-400">Zone</Label>
                <Select value={selectedZoneId} onValueChange={handleZoneChange}>
                    <SelectTrigger className="bg-zinc-950 border-zinc-800">
                        <SelectValue placeholder="Sélectionner une zone" />
                    </SelectTrigger>
                    <SelectContent>
                        {zones.map(zone => (
                            <SelectItem key={zone.id} value={zone.id}>
                                {zone.name} (Niv. {zone.level})
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Monster Selector */}
            {selectedZone && (
                <div className="space-y-2">
                    <Label className="text-xs text-zinc-400">Type de monstre</Label>
                    {selectedZone.monsters.length === 0 ? (
                        <p className="text-xs text-zinc-500">Aucun monstre dans cette zone</p>
                    ) : (
                        <div className="grid grid-cols-2 gap-2">
                            {selectedZone.monsters.map(monster => (
                                <button
                                    key={monster.id}
                                    type="button"
                                    onClick={() => handleMonsterChange(monster.id)}
                                    className={cn(
                                        "p-2 rounded-lg border text-left transition-all text-sm",
                                        payload.monsterId === monster.id
                                            ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-300"
                                            : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 text-zinc-300"
                                    )}
                                >
                                    {monster.name}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Preview */}
            {payload.monsterName && (
                <div className="p-3 bg-zinc-900/50 rounded-lg border border-emerald-500/20 text-xs text-zinc-400">
                    Vaincre <span className="text-emerald-400 font-medium">50 {payload.monsterName}</span> sur leur territoire
                </div>
            )}
        </div>
    );
}

// --- ANOMALIE FORM ---

export function AnomalieForm({ payload, onPayloadChange, onTitleChange }: FormProps) {
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
            onTitleChange(`Au cœur de l'anomalie`);
        } else {
            onTitleChange(`Gardien d'anomalie ${range}`);
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
                            <div className="font-medium">Boss</div>
                            <div className="text-xs text-zinc-500">Gardien de donjon</div>
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
                    <>Vaincre 50 monstres dans un territoire de niveau <span className="text-fuchsia-400 font-medium">{levelRange}</span> sous anomalie avec un <span className="text-fuchsia-400">[Elixir uchronique majeur]</span></>
                ) : (
                    <>Vaincre un gardien d'anomalie de niveau <span className="text-fuchsia-400 font-medium">{levelRange}</span> avec un <span className="text-fuchsia-400">[Elixir uchronique majeur]</span></>
                )}
            </div>
        </div>
    );
}

// --- SONGES FORM ---

export function SongesForm({ payload, onPayloadChange, onTitleChange, onTierChange }: FormProps) {
    const difficulty = payload.difficulty || 'Paradoxe';
    const level = payload.level || 'I';
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

        // Set tier based on difficulty
        if (newDifficulty === 'Cauchemar') onTierChange(4);
        else if (newDifficulty === 'Paradoxe') onTierChange(3);
        else onTierChange(2);
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
            <div className="p-3 bg-zinc-900/50 rounded-lg border border-cyan-500/20 text-xs text-zinc-400">
                Démarrer un songe en <span className="text-cyan-400 font-medium">{difficulty} {level}</span> et terminer le <span className="text-cyan-400 font-medium">Palier {tier}</span> : les Balades fantastiques
            </div>
        </div>
    );
}

// --- EXPEDITION FORM ---

export function ExpeditionForm({ payload, onPayloadChange, onTitleChange, onTierChange }: FormProps) {
    const [dungeons, setDungeons] = useState<Dungeon[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");

    const mode = payload.mode || 'aucun';

    useEffect(() => {
        getDungeons().then(res => {
            if (res.success && res.data) {
                setDungeons(res.data);
            }
            setIsLoading(false);
        });
    }, []);

    const filteredDungeons = dungeons.filter(d =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.bossName.toLowerCase().includes(search.toLowerCase())
    );

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
            // Auto-set tier
            if (dungeon.level >= 190) onTierChange(4);
            else if (dungeon.level >= 100) onTierChange(3);
            else onTierChange(2);
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

    if (isLoading) {
        return <div className="flex items-center justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-zinc-500" /></div>;
    }

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
            {dungeons.length > 0 && (
                <>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
                        <Input
                            className="pl-9 bg-zinc-950 border-zinc-800"
                            placeholder="Rechercher un donjon..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                        />
                    </div>

                    {/* Dungeon Grid */}
                    <div className="grid grid-cols-2 gap-2 max-h-32 overflow-y-auto pr-1">
                        {filteredDungeons.slice(0, 12).map(dungeon => (
                            <button
                                key={dungeon.id}
                                type="button"
                                onClick={() => handleSelect(dungeon.id)}
                                className={cn(
                                    "p-2 rounded-lg border text-left transition-all text-sm",
                                    payload.dungeonId === dungeon.id
                                        ? "bg-amber-500/20 border-amber-500/50 text-amber-300"
                                        : "bg-zinc-900 border-zinc-800 hover:border-zinc-600 text-zinc-300"
                                )}
                            >
                                <div className="font-medium truncate">{dungeon.name}</div>
                            </button>
                        ))}
                    </div>
                </>
            )}

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
