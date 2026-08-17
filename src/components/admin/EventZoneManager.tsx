'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import {
    Sparkles,
    Plus,
    Trash2,
    Unlink,
    ChevronDown,
    ChevronRight,
    Loader2,
    Swords,
    Castle,
    Calendar,
    CheckCircle2,
    AlertCircle,
    X,
    PlusCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { AsyncCombobox } from '@/components/ui/async-combobox';
import {
    getEventZones,
    upsertEventZone,
    deleteEventZone,
    linkFamilyToZone,
    unlinkFamilyFromZone,
    linkDungeonToZone,
    unlinkDungeonFromZone,
    getMonsterFamilies,
    searchDungeonsAdvanced,
} from '@/server/actions/game-data-actions';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

// ─── Preset Seasons ──────────────────────────────────────────

const PRESET_ZONES = [
    {
        key: 'VULKANIA',
        label: 'Vulkania',
        emoji: '🦕',
        period: 'Saison Été (Juillet - Août)',
        color: 'emerald',
        badge: 'Été',
        accentBg: 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500',
        cardBorder: 'border-emerald-500/30'
    },
    {
        key: 'PWAK',
        label: 'Île de Pwâk',
        emoji: '🐣',
        period: 'Saison Printemps (Pâques)',
        color: 'amber',
        badge: 'Pâques',
        accentBg: 'bg-amber-500/10 border-amber-500/20 text-amber-500',
        cardBorder: 'border-amber-500/30'
    },
    {
        key: 'HALOUINE',
        label: 'Halouine',
        emoji: '🎃',
        period: 'Saison Automne (Halloween)',
        color: 'orange',
        badge: 'Halloween',
        accentBg: 'bg-orange-500/10 border-orange-500/20 text-orange-500',
        cardBorder: 'border-orange-500/30'
    },
    {
        key: 'NOWEL',
        label: 'Île de Nowel',
        emoji: '🎄',
        period: 'Saison Hiver (Noël / Décembre)',
        color: 'rose',
        badge: 'Noël',
        accentBg: 'bg-rose-500/10 border-rose-500/20 text-rose-500',
        cardBorder: 'border-rose-500/30'
    },
] as const;

export function EventZoneManager() {
    const [eventZones, setEventZones] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedZoneId, setExpandedZoneId] = useState<string | null>(null);
    const [saving, setSaving] = useState<string | null>(null);

    // Custom Zone Modal State
    const [customModalOpen, setCustomModalOpen] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customLevel, setCustomLevel] = useState(1);
    const [creatingCustom, setCreatingCustom] = useState(false);

    // Family/dungeon search caches
    const [familyCache, setFamilyCache] = useState<Record<string, any[]>>({});

    const load = useCallback(async () => {
        setIsLoading(true);
        const res = await getEventZones();
        if (res.success && res.data) setEventZones(res.data);
        setIsLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    const handleCreatePreset = async (preset: typeof PRESET_ZONES[number]) => {
        setSaving(preset.key);
        const res = await upsertEventZone({ name: preset.label, level: 1, eventZoneKey: preset.key });
        if (res.success) {
            toast.success(`Zone saisonnière "${preset.label}" initialisée !`);
            await load();
            if (res.data?.id) setExpandedZoneId(res.data.id);
        } else {
            toast.error(res.error || "Erreur création zone");
        }
        setSaving(null);
    };

    const handleCreateCustom = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!customName.trim()) return;
        setCreatingCustom(true);
        const res = await upsertEventZone({ name: customName.trim(), level: customLevel, eventZoneKey: 'AUTRE' });
        if (res.success) {
            toast.success(`Zone événement "${customName}" créée !`);
            setCustomName('');
            setCustomLevel(1);
            setCustomModalOpen(false);
            await load();
            if (res.data?.id) setExpandedZoneId(res.data.id);
        } else {
            toast.error(res.error || "Erreur création zone");
        }
        setCreatingCustom(false);
    };

    const handleDeleteZone = async (zone: any) => {
        if (!confirm(`Supprimer définitivement la zone "${zone.name}" et ses associations ?`)) return;
        const res = await deleteEventZone(zone.id);
        if (res.success) {
            toast.success('Zone supprimée avec succès');
            if (expandedZoneId === zone.id) setExpandedZoneId(null);
            await load();
        } else {
            toast.error(res.error || "Erreur suppression zone");
        }
    };

    const familyFetcher = useCallback(async (query: string) => {
        const res = await getMonsterFamilies({ search: query });
        if (res.success && res.data) {
            const items = res.data.map((f: any) => ({ value: f.id, label: f.name }));
            setFamilyCache(prev => {
                const next = { ...prev };
                res.data?.forEach((f: any) => { next[f.id] = f; });
                return next;
            });
            return items;
        }
        return [];
    }, []);

    const dungeonFetcher = useCallback(async (query: string) => {
        const res = await searchDungeonsAdvanced({ query });
        if (res.success && res.data) {
            return res.data.map((d: any) => ({ value: d.id, label: d.name, subLabel: `Niv. ${d.level} · Boss: ${d.bossName}` }));
        }
        return [];
    }, []);

    const handleLinkFamily = async (zoneId: string, familyId: string) => {
        const res = await linkFamilyToZone(zoneId, familyId);
        if (res.success) { toast.success('Famille de monstres liée !'); await load(); }
        else toast.error(res.error || "Erreur de liaison");
    };

    const handleUnlinkFamily = async (zoneId: string, familyId: string) => {
        const res = await unlinkFamilyFromZone(zoneId, familyId);
        if (res.success) { toast.success('Famille retirée'); await load(); }
        else toast.error(res.error || "Erreur de retrait");
    };

    const handleLinkDungeon = async (zoneId: string, dungeonId: string) => {
        const res = await linkDungeonToZone(zoneId, dungeonId);
        if (res.success) { toast.success('Donjon lié !'); await load(); }
        else toast.error(res.error || "Erreur de liaison");
    };

    const handleUnlinkDungeon = async (zoneId: string, dungeonId: string) => {
        const res = await unlinkDungeonFromZone(zoneId, dungeonId);
        if (res.success) { toast.success('Donjon retiré'); await load(); }
        else toast.error(res.error || "Erreur de retrait");
    };

    // Split presets and custom zones
    const customZones = eventZones.filter(z => z.eventZoneKey === 'AUTRE' || !PRESET_ZONES.some(p => p.key === z.eventZoneKey));

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 rounded-3xl bg-surface border border-border shadow-sm">
                <div className="space-y-1">
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500">
                            <Sparkles className="w-5 h-5" />
                        </span>
                        <h2 className="text-xl font-bold text-foreground">Zones Saisonnières & Événements</h2>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        Associez les familles de monstres et donjons événementiels pour les missions spéciales et la cartographie.
                    </p>
                </div>
                <Button
                    onClick={() => setCustomModalOpen(true)}
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-500 text-white font-bold gap-2 self-start sm:self-auto"
                >
                    <Plus className="w-4 h-4" />
                    <span>Nouvelle Zone Personnalisée</span>
                </Button>
            </div>

            {/* 4 Seasonal Preset Cards */}
            {isLoading ? (
                <div className="flex justify-center py-16">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {PRESET_ZONES.map(preset => {
                        const zone = eventZones.find(z => z.eventZoneKey === preset.key);
                        const isInitialized = !!zone;
                        const isExpanded = zone && expandedZoneId === zone.id;
                        const familyCount = zone?.families?.length || 0;
                        const dungeonCount = zone?.dungeons?.length || 0;

                        return (
                            <div
                                key={preset.key}
                                className={cn(
                                    "rounded-3xl border bg-surface transition-all overflow-hidden shadow-sm flex flex-col justify-between",
                                    isInitialized ? preset.cardBorder : "border-border opacity-90 hover:opacity-100"
                                )}
                            >
                                {/* Card Header */}
                                <div className="p-5 flex items-start justify-between gap-4 border-b border-border/50">
                                    <div className="flex items-center gap-3.5">
                                        <div className="w-12 h-12 rounded-2xl bg-elevated border border-border flex items-center justify-center text-2xl shrink-0 shadow-inner">
                                            {preset.emoji}
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-bold text-base text-foreground">{preset.label}</h3>
                                                <span className={cn("px-2 py-0.5 rounded-full text-caption font-black uppercase", preset.accentBg)}>
                                                    {preset.badge}
                                                </span>
                                            </div>
                                            <p className="text-caption text-muted-foreground mt-0.5">{preset.period}</p>
                                        </div>
                                    </div>

                                    {isInitialized ? (
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => setExpandedZoneId(isExpanded ? null : zone.id)}
                                            className="text-xs font-bold gap-1 text-muted-foreground hover:text-foreground shrink-0"
                                        >
                                            <span>{isExpanded ? "Masquer" : "Gérer"}</span>
                                            {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                                        </Button>
                                    ) : (
                                        <Button
                                            size="sm"
                                            onClick={() => handleCreatePreset(preset)}
                                            disabled={saving === preset.key}
                                            className="text-xs font-bold gap-1.5 bg-elevated hover:bg-surface border border-border text-foreground shrink-0"
                                        >
                                            {saving === preset.key ? (
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                            ) : (
                                                <PlusCircle className="w-3.5 h-3.5 text-primary" />
                                            )}
                                            <span>Initialiser</span>
                                        </Button>
                                    )}
                                </div>

                                {/* Card Metrics / Summary */}
                                <div className="p-5 bg-elevated/40 flex items-center justify-between text-xs">
                                    {isInitialized ? (
                                        <div className="flex items-center gap-4">
                                            <span className="flex items-center gap-1.5 font-bold text-foreground">
                                                <Swords className="w-4 h-4 text-emerald-500" />
                                                {familyCount} famille{familyCount > 1 ? "s" : ""}
                                            </span>
                                            <span className="flex items-center gap-1.5 font-bold text-foreground">
                                                <Castle className="w-4 h-4 text-sky-500" />
                                                {dungeonCount} donjon{dungeonCount > 1 ? "s" : ""}
                                            </span>
                                        </div>
                                    ) : (
                                        <span className="text-caption text-muted-foreground italic">
                                            Zone non encore activée pour le Monde des Douze.
                                        </span>
                                    )}

                                    {isInitialized && (
                                        <span className="flex items-center gap-1 text-caption text-emerald-600 dark:text-emerald-400 font-bold">
                                            <CheckCircle2 className="w-3.5 h-3.5" /> Active
                                        </span>
                                    )}
                                </div>

                                {/* Expanded Association Panel */}
                                {isExpanded && (
                                    <div className="p-5 border-t border-border bg-surface space-y-5 animate-in fade-in duration-200">
                                        {/* Familles */}
                                        <div className="space-y-2.5">
                                            <div className="flex items-center justify-between text-xs font-bold text-foreground">
                                                <span className="flex items-center gap-1.5">
                                                    <Swords className="w-3.5 h-3.5 text-emerald-500" /> Familles de monstres
                                                </span>
                                                <span className="text-caption text-muted-foreground">({familyCount})</span>
                                            </div>

                                            <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-xl bg-elevated/70 border border-border/70">
                                                {zone.families?.map((f: any) => (
                                                    <span
                                                        key={f.id}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border text-xs font-bold text-foreground shadow-sm"
                                                    >
                                                        <span>{f.name}</span>
                                                        <button
                                                            onClick={() => handleUnlinkFamily(zone.id, f.id)}
                                                            className="text-muted-foreground hover:text-danger transition-colors"
                                                            title="Retirer cette famille"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                                {familyCount === 0 && (
                                                    <span className="text-caption text-muted-foreground italic self-center">
                                                        Aucune famille associée.
                                                    </span>
                                                )}
                                            </div>

                                            <AsyncCombobox
                                                value=""
                                                onSelect={id => handleLinkFamily(zone.id, id)}
                                                fetcher={familyFetcher}
                                                placeholder="Ajouter une famille de monstres..."
                                                searchPlaceholder="Rechercher une famille..."
                                            />
                                        </div>

                                        {/* Donjons */}
                                        <div className="space-y-2.5">
                                            <div className="flex items-center justify-between text-xs font-bold text-foreground">
                                                <span className="flex items-center gap-1.5">
                                                    <Castle className="w-3.5 h-3.5 text-sky-500" /> Donjons associés
                                                </span>
                                                <span className="text-caption text-muted-foreground">({dungeonCount})</span>
                                            </div>

                                            <div className="flex flex-wrap gap-1.5 min-h-[32px] p-2 rounded-xl bg-elevated/70 border border-border/70">
                                                {zone.dungeons?.map((d: any) => (
                                                    <span
                                                        key={d.id}
                                                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border text-xs font-bold text-foreground shadow-sm"
                                                    >
                                                        <span>{d.name}</span>
                                                        {d.bossName && (
                                                            <span className="text-caption text-muted-foreground">({d.bossName})</span>
                                                        )}
                                                        <button
                                                            onClick={() => handleUnlinkDungeon(zone.id, d.id)}
                                                            className="text-muted-foreground hover:text-danger transition-colors"
                                                            title="Retirer ce donjon"
                                                        >
                                                            <X className="w-3 h-3" />
                                                        </button>
                                                    </span>
                                                ))}
                                                {dungeonCount === 0 && (
                                                    <span className="text-caption text-muted-foreground italic self-center">
                                                        Aucun donjon associé.
                                                    </span>
                                                )}
                                            </div>

                                            <AsyncCombobox
                                                value=""
                                                onSelect={id => handleLinkDungeon(zone.id, id)}
                                                fetcher={dungeonFetcher}
                                                placeholder="Ajouter un donjon..."
                                                searchPlaceholder="Rechercher un donjon..."
                                            />
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Custom Zones Section (if any exist) */}
            {customZones.length > 0 && (
                <div className="space-y-4 pt-4 border-t border-border">
                    <div className="flex items-center justify-between">
                        <h3 className="text-base font-bold text-foreground flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-purple-500" />
                            <span>Zones Personnalisées & Événements Spéciaux ({customZones.length})</span>
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {customZones.map(zone => {
                            const isExpanded = expandedZoneId === zone.id;
                            const familyCount = zone.families?.length || 0;
                            const dungeonCount = zone.dungeons?.length || 0;

                            return (
                                <div
                                    key={zone.id}
                                    className="rounded-3xl border border-border bg-surface overflow-hidden shadow-sm flex flex-col justify-between"
                                >
                                    <div className="p-5 flex items-start justify-between gap-4 border-b border-border/50">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center font-black shrink-0">
                                                ✨
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-sm text-foreground">{zone.name}</h4>
                                                <p className="text-caption text-muted-foreground">Niveau {zone.level || 1}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                className="h-8 w-8 text-muted-foreground hover:text-danger"
                                                onClick={() => handleDeleteZone(zone)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                            <Button
                                                size="sm"
                                                variant="ghost"
                                                onClick={() => setExpandedZoneId(isExpanded ? null : zone.id)}
                                                className="text-xs font-bold gap-1 text-muted-foreground hover:text-foreground"
                                            >
                                                <span>{isExpanded ? "Masquer" : "Gérer"}</span>
                                                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                            </Button>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-elevated/40 flex items-center justify-between text-xs font-bold text-muted-foreground">
                                        <span>{familyCount} famille(s) · {dungeonCount} donjon(s)</span>
                                    </div>

                                    {isExpanded && (
                                        <div className="p-5 border-t border-border bg-surface space-y-4">
                                            {/* Familles */}
                                            <div className="space-y-2">
                                                <span className="text-xs font-bold text-foreground">Familles de monstres</span>
                                                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-elevated border border-border">
                                                    {zone.families?.map((f: any) => (
                                                        <span key={f.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border text-xs font-bold">
                                                            <span>{f.name}</span>
                                                            <button onClick={() => handleUnlinkFamily(zone.id, f.id)} className="text-muted-foreground hover:text-danger">
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                    {familyCount === 0 && <span className="text-caption text-muted-foreground italic">Aucune</span>}
                                                </div>
                                                <AsyncCombobox
                                                    value=""
                                                    onSelect={id => handleLinkFamily(zone.id, id)}
                                                    fetcher={familyFetcher}
                                                    placeholder="Ajouter une famille..."
                                                />
                                            </div>

                                            {/* Donjons */}
                                            <div className="space-y-2">
                                                <span className="text-xs font-bold text-foreground">Donjons</span>
                                                <div className="flex flex-wrap gap-1.5 p-2 rounded-xl bg-elevated border border-border">
                                                    {zone.dungeons?.map((d: any) => (
                                                        <span key={d.id} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface border border-border text-xs font-bold">
                                                            <span>{d.name}</span>
                                                            <button onClick={() => handleUnlinkDungeon(zone.id, d.id)} className="text-muted-foreground hover:text-danger">
                                                                <X className="w-3 h-3" />
                                                            </button>
                                                        </span>
                                                    ))}
                                                    {dungeonCount === 0 && <span className="text-caption text-muted-foreground italic">Aucun</span>}
                                                </div>
                                                <AsyncCombobox
                                                    value=""
                                                    onSelect={id => handleLinkDungeon(zone.id, id)}
                                                    fetcher={dungeonFetcher}
                                                    placeholder="Ajouter un donjon..."
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Modal Création Zone Personnalisée */}
            <Dialog open={customModalOpen} onOpenChange={setCustomModalOpen}>
                <DialogContent className="sm:max-w-md border-border bg-background/95 backdrop-blur-xl">
                    <DialogHeader>
                        <DialogTitle className="text-foreground">Nouvelle Zone Événementielle</DialogTitle>
                        <DialogDescription className="text-muted-foreground">
                            Créez un conteneur personnalisé pour un événement, tournoi ou serveur Temporis.
                        </DialogDescription>
                    </DialogHeader>

                    <form onSubmit={handleCreateCustom} className="space-y-4 pt-2">
                        <div className="space-y-1.5">
                            <label className="text-xs font-bold">Nom de la Zone</label>
                            <Input
                                required
                                value={customName}
                                onChange={e => setCustomName(e.target.value)}
                                placeholder="Ex: Temporis Krosmoz, Tournoi des Dix..."
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-bold">Niveau Recommandé</label>
                            <Input
                                type="number"
                                min={1}
                                max={230}
                                value={customLevel}
                                onChange={e => setCustomLevel(parseInt(e.target.value) || 1)}
                            />
                        </div>

                        <div className="flex justify-end gap-2 pt-2">
                            <Button type="button" variant="ghost" onClick={() => setCustomModalOpen(false)}>
                                Annuler
                            </Button>
                            <Button type="submit" disabled={creatingCustom} className="bg-amber-600 hover:bg-amber-500 text-white font-bold">
                                {creatingCustom ? <Loader2 className="w-4 h-4 animate-spin" /> : "Créer la zone"}
                            </Button>
                        </div>
                    </form>
                </DialogContent>
            </Dialog>
        </div>
    );
}
