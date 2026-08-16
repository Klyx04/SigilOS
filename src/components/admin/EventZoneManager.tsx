'use client';

import { useState, useCallback, useEffect } from 'react';
import { toast } from 'sonner';
import { Sparkles, Plus, Trash2, Link, Unlink, ChevronDown, ChevronRight, Loader2, Swords, Castle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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

// ─── Constants ────────────────────────────────────────────────

const PRESET_ZONES = [
    { key: 'VULKANIA', label: 'Vulkania', emoji: '🦕', period: 'Été', color: 'text-green-300', border: 'border-green-500/30 bg-green-500/5' },
    { key: 'PWAK', label: 'Île de Pwâk', emoji: '🐣', period: 'Pâques', color: 'text-warning', border: 'border-warning/30 bg-warning/5' },
    { key: 'HALOUINE', label: 'Halouine', emoji: '🎃', period: 'Halloween', color: 'text-warning', border: 'border-warning/30 bg-warning/5' },
    { key: 'NOWEL', label: 'Île de Nowel', emoji: '🎄', period: 'Noël', color: 'text-danger', border: 'border-danger/30 bg-danger/5' },
] as const;

type PresetKey = typeof PRESET_ZONES[number]['key'];

// ─── Component ────────────────────────────────────────────────

export function EventZoneManager() {
    const [eventZones, setEventZones] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [expandedZone, setExpandedZone] = useState<string | null>(null);
    const [saving, setSaving] = useState<string | null>(null);

    // Form for creating a custom zone
    const [showCustomForm, setShowCustomForm] = useState(false);
    const [customName, setCustomName] = useState('');
    const [customKey, setCustomKey] = useState('AUTRE');
    const [customLevel, setCustomLevel] = useState(1);
    const [creatingCustom, setCreatingCustom] = useState(false);

    // Family/dungeon search local caches
    const [familyCache, setFamilyCache] = useState<Record<string, any[]>>({});

    const load = useCallback(async () => {
        setIsLoading(true);
        const res = await getEventZones();
        if (res.success && res.data) setEventZones(res.data);
        setIsLoading(false);
    }, []);

    useEffect(() => { load(); }, [load]);

    // Check which presets are already created
    const existingKeys = eventZones.map(z => z.eventZoneKey);

    const handleCreatePreset = async (preset: typeof PRESET_ZONES[number]) => {
        setSaving(preset.key);
        const res = await upsertEventZone({ name: preset.label, level: 1, eventZoneKey: preset.key });
        if (res.success) {
            toast.success(`Zone "${preset.label}" créée !`);
            await load();
            setExpandedZone(res.data?.id ?? null);
        } else {
            toast.error(res.error);
        }
        setSaving(null);
    };

    const handleCreateCustom = async () => {
        if (!customName.trim()) return;
        setCreatingCustom(true);
        const res = await upsertEventZone({ name: customName.trim(), level: customLevel, eventZoneKey: 'AUTRE' });
        if (res.success) {
            toast.success(`Zone événement "${customName}" créée !`);
            setCustomName('');
            setCustomKey('AUTRE');
            setCustomLevel(1);
            setShowCustomForm(false);
            await load();
            setExpandedZone(res.data?.id ?? null);
        } else {
            toast.error(res.error);
        }
        setCreatingCustom(false);
    };

    const handleDeleteZone = async (zone: any) => {
        if (!confirm(`Supprimer la zone "${zone.name}" ? Cela supprimera aussi les liens avec familles et donjons.`)) return;
        const res = await deleteEventZone(zone.id);
        if (res.success) {
            toast.success('Zone supprimée');
            setExpandedZone(null);
            await load();
        } else {
            toast.error(res.error);
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
        if (res.success) { toast.success('Famille liée !'); await load(); }
        else toast.error(res.error);
    };

    const handleUnlinkFamily = async (zoneId: string, familyId: string) => {
        const res = await unlinkFamilyFromZone(zoneId, familyId);
        if (res.success) { toast.success('Famille retirée'); await load(); }
        else toast.error(res.error);
    };

    const handleLinkDungeon = async (zoneId: string, dungeonId: string) => {
        const res = await linkDungeonToZone(zoneId, dungeonId);
        if (res.success) { toast.success('Donjon lié !'); await load(); }
        else toast.error(res.error);
    };

    const handleUnlinkDungeon = async (zoneId: string, dungeonId: string) => {
        const res = await unlinkDungeonFromZone(zoneId, dungeonId);
        if (res.success) { toast.success('Donjon retiré'); await load(); }
        else toast.error(res.error);
    };

    return (
        <div className="space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-warning/10 border border-warning/20">
                        <Sparkles className="w-5 h-5 text-warning" />
                    </div>
                    <div>
                        <h2 className="text-lg font-black text-foreground">Zones Événements</h2>
                        <p className="text-xs text-muted-foreground">Zones saisonnières Dofus · familles de monstres et donjons associés</p>
                    </div>
                </div>
                <Button
                    size="sm"
                    variant="outline"
                    className="border-border text-muted-foreground hover:text-foreground hover:border-border"
                    onClick={() => setShowCustomForm(v => !v)}
                >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Zone personnalisée
                </Button>
            </div>

            {/* Preset zone buttons (4 saisons) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {PRESET_ZONES.map(preset => {
                    const exists = existingKeys.includes(preset.key);
                    const zone = eventZones.find(z => z.eventZoneKey === preset.key);
                    return (
                        <button
                            key={preset.key}
                            onClick={exists ? () => setExpandedZone(z => z === zone?.id ? null : zone?.id) : () => handleCreatePreset(preset)}
                            disabled={saving === preset.key}
                            className={cn(
                                'flex flex-col items-center gap-2 p-5 rounded-2xl border text-center transition-all duration-300 group',
                                exists
                                    ? cn(preset.border, 'hover:brightness-110')
                                    : 'bg-surface/60 border-border hover:border-border opacity-60 hover:opacity-100'
                            )}
                        >
                            <span className="text-3xl">{preset.emoji}</span>
                            <div>
                                <div className={cn('text-xs font-black', exists ? preset.color : 'text-muted-foreground')}>{preset.label}</div>
                                <div className="text-caption text-muted-foreground uppercase tracking-widest">{preset.period}</div>
                            </div>
                            {exists ? (
                                <div className="flex items-center gap-1.5 text-caption font-bold text-muted-foreground">
                                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                                    {zone?.families?.length ?? 0} familles · {zone?.dungeons?.length ?? 0} donjons
                                </div>
                            ) : (
                                <div className="text-caption text-muted-foreground group-hover:text-muted-foreground transition-colors">
                                    {saving === preset.key ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Cliquer pour créer'}
                                </div>
                            )}
                        </button>
                    );
                })}
            </div>

            {/* Custom zone form */}
            {showCustomForm && (
                <div className="p-4 bg-surface border border-border rounded-xl space-y-3">
                    <p className="text-xs text-muted-foreground font-bold uppercase tracking-widest">Zone événement personnalisée</p>
                    <div className="flex gap-3">
                        <Input
                            className="flex-1 bg-background border-border"
                            placeholder="Nom de la zone (ex: Temporis IX, Krosmoz de Feu...)"
                            value={customName}
                            onChange={e => setCustomName(e.target.value)}
                        />
                        <Input
                            type="number"
                            className="w-24 bg-background border-border"
                            placeholder="Niv."
                            min={1}
                            max={230}
                            value={customLevel}
                            onChange={e => setCustomLevel(parseInt(e.target.value) || 1)}
                        />
                        <Button onClick={handleCreateCustom} disabled={creatingCustom || !customName.trim()} size="sm">
                            {creatingCustom ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                        </Button>
                    </div>
                </div>
            )}

            {/* Zone detail panels */}
            {isLoading ? (
                <div className="flex justify-center py-12">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
                </div>
            ) : (
                <div className="space-y-3">
                    {eventZones.length === 0 && (
                        <div className="text-center py-12 text-muted-foreground text-sm">
                            Aucune zone événement — clique sur un preset ci-dessus pour commencer.
                        </div>
                    )}
                    {eventZones.map(zone => {
                        const preset = PRESET_ZONES.find(p => p.key === zone.eventZoneKey);
                        const isExpanded = expandedZone === zone.id;
                        return (
                            <div key={zone.id} className={cn('rounded-2xl border transition-all', preset?.border ?? 'border-border bg-surface/60')}>
                                {/* Zone header */}
                                <div
                                    className="w-full flex items-center justify-between p-4 cursor-pointer"
                                    onClick={() => setExpandedZone(v => v === zone.id ? null : zone.id)}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedZone(v => v === zone.id ? null : zone.id); }}
                                >
                                    <div className="flex items-center gap-3">
                                        <span className="text-2xl">{preset?.emoji ?? '✨'}</span>
                                        <div>
                                            <div className={cn('font-black text-sm', preset?.color ?? 'text-foreground')}>{zone.name}</div>
                                            <div className="text-caption text-muted-foreground">{zone.families?.length} familles · {zone.dungeons?.length} donjons</div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={e => { e.stopPropagation(); handleDeleteZone(zone); }}
                                            className="p-1.5 rounded-lg hover:bg-danger/10 text-muted-foreground hover:text-danger transition-colors"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                        {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                                    </div>
                                </div>

                                {/* Expanded content */}
                                {isExpanded && (
                                    <div className="px-4 pb-4 space-y-5 border-t border-border pt-4">
                                        {/* Familles de monstres */}
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-widest">
                                                <Swords className="w-3.5 h-3.5" /> Familles de monstres
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {zone.families?.map((f: any) => (
                                                    <div key={f.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-elevated rounded-full text-xs text-foreground border border-border">
                                                        {f.name}
                                                        <button onClick={() => handleUnlinkFamily(zone.id, f.id)} className="hover:text-danger transition-colors ml-0.5">
                                                            <Unlink className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {zone.families?.length === 0 && <span className="text-xs text-muted-foreground">Aucune famille liée</span>}
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
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2 text-xs font-black text-muted-foreground uppercase tracking-widest">
                                                <Castle className="w-3.5 h-3.5" /> Donjons événement
                                            </div>
                                            <div className="flex flex-wrap gap-2">
                                                {zone.dungeons?.map((d: any) => (
                                                    <div key={d.id} className="flex items-center gap-1.5 px-2.5 py-1 bg-elevated rounded-full text-xs text-foreground border border-border">
                                                        {d.name}
                                                        <span className="text-muted-foreground text-caption">· {d.bossName}</span>
                                                        <button onClick={() => handleUnlinkDungeon(zone.id, d.id)} className="hover:text-danger transition-colors ml-0.5">
                                                            <Unlink className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {zone.dungeons?.length === 0 && <span className="text-xs text-muted-foreground">Aucun donjon lié</span>}
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
        </div>
    );
}
