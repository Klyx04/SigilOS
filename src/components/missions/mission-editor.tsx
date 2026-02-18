'use client'

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { createWeekMissions, resetMission, resetWeek, getWeekMissions } from "@/server/actions/mission-actions";
import { toast } from "sonner";
import { Save, Trash2, Edit2, RotateCcw, Check, Loader2, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_CONFIG, MISSION_CATEGORIES, type MissionCategoryType } from "@/lib/mission-config";
import { getWeekNumber } from "@/lib/date-utils";
import { BonusMenuButton } from "@/components/admin/BonusMenuButton";
import {
    DungeonForm,
    RegulationForm,
    AnomalieForm,
    SongesForm,
    ExpeditionForm,
    EventForm
} from "./category-forms";

// --- Types ---

type DraftMission = {
    slotIndex: number; // 0-11
    category: MissionCategoryType;
    rank: number;
    title: string;
    xpReward: number;
    guildatonsReward: number;
    payload: Record<string, any>;
};

const DEFAULT_mission_TEMPLATE = (index: number): DraftMission => ({
    slotIndex: index,
    category: "DONJON",
    rank: 1,
    title: "",
    xpReward: 300,
    guildatonsReward: 50,
    payload: { boss: "" }
});

// --- Component ---

export function MissionEditor({ guildId }: { guildId: string }) {
    const { week: weekNumber, year } = getWeekNumber();

    const [missions, setMissions] = useState<DraftMission[]>(
        Array.from({ length: 12 }).map((_, i) => DEFAULT_mission_TEMPLATE(i))
    );

    const [globalTier, setGlobalTier] = useState<number>(3); // Default to 3 or fetch from guild config
    const [editingSlot, setEditingSlot] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);

    // Fetch Data on Week Change
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            const res = await getWeekMissions(guildId, weekNumber, year);
            if (res.success && res.data) {
                const fetched = res.data;
                const newMissions = Array.from({ length: 12 }).map((_, i) => {
                    const existing = fetched.find((m: any) => m.slotIndex === i);
                    if (existing) {
                        // Infer global tier from existing missions if possible, otherwise keep default
                        // In reality, we should fetch the guild config for default tier if no missions exist
                        return {
                            slotIndex: i,
                            category: existing.category,
                            rank: existing.rank || 1,
                            title: existing.title || "",
                            xpReward: existing.xpReward || 0,
                            guildatonsReward: existing.guildatonsReward || 0,
                            payload: existing.payload || {}
                        };
                    }
                    return DEFAULT_mission_TEMPLATE(i);
                });
                setMissions(newMissions);

                // Set global tier from first found mission or default
                const foundTier = (fetched as any[]).find((m: any) => m.tier)?.tier;
                if (foundTier) setGlobalTier(foundTier);
            } else {
                // If no missions found, maybe fetch guild config for default tier?
            }
        } catch (e: unknown) {
            toast.error("Erreur de chargement");
        } finally {
            setIsLoading(false);
        }
    }, [guildId, weekNumber, year]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Helpers
    const currentMission = editingSlot !== null ? missions[editingSlot] : null;

    const updateMission = (slot: number, updates: Partial<DraftMission>) => {
        setMissions(prev => prev.map(m => m.slotIndex === slot ? { ...m, ...updates } : m));
    };

    // Actions
    const handleSaveSingle = async (slot: number) => {
        const mission = missions[slot];
        const promise = createWeekMissions({
            guildId,
            weekNumber,
            year,
            missions: [{ ...mission, tier: globalTier }],
            updateGuildTier: globalTier
        });

        toast.promise(promise, {
            loading: 'Sauvegarde...',
            success: 'Mission sauvegardée !',
            error: 'Erreur sauvegarde'
        });

        const res = await promise;
        if (res.success) {
            fetchData();
        }
    };

    const handleResetSingle = async (slot: number) => {
        if (!confirm("Effacer cette mission ?")) return;

        const res = await resetMission(guildId, weekNumber, year, slot);
        if (res.success) {
            updateMission(slot, DEFAULT_mission_TEMPLATE(slot));
            toast.success("Mission effacée");
        } else {
            toast.error("Erreur effacement");
        }
    };

    const handleGlobalPublish = async () => {
        setIsSaving(true);
        // We only send missions that have some content or are explicit defaults?
        // Ideally we assume the editor state IS the desired state.
        const res = await createWeekMissions({
            guildId,
            weekNumber,
            year,
            missions: missions.map(m => ({ ...m, tier: globalTier })),
            updateGuildTier: globalTier
        });
        setIsSaving(false);
        setConfirmPublishOpen(false);

        if (res.success) {
            toast.success("Tout est publié !");
            fetchData(); // Refresh to be sure
        } else {
            toast.error(res.error || "Erreur globale");
        }
    };

    const handleResetWeek = async () => {
        if (!confirm("⚠️ ATTENTION: Voulez-vous vraiment TOUT EFFACER pour cette semaine ? Cette action est irréversible.")) return;

        setIsResetting(true);
        try {
            const res = await resetWeek(guildId, weekNumber, year);
            if (res.success) {
                setMissions(Array.from({ length: 12 }).map((_, i) => DEFAULT_mission_TEMPLATE(i)));
                toast.success("Semaine réinitialisée avec succès");
            } else {
                toast.error(res.error || "Erreur lors de la réinitialisation");
            }
        } catch (error) {
            toast.error("Erreur réseau ou serveur");
        } finally {
            setIsResetting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center justify-between bg-zinc-900 border border-zinc-800 p-4 rounded-xl gap-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-400">Semaine</span>
                        <span className="h-9 px-3 flex items-center bg-zinc-950 border border-zinc-800 rounded text-sm text-white font-mono font-bold">
                            {weekNumber}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-zinc-400">Année</span>
                        <span className="h-9 px-3 flex items-center bg-zinc-950 border border-zinc-800 rounded text-sm text-white font-mono">
                            {year}
                        </span>
                    </div>

                    <div className="w-px h-8 bg-zinc-800 mx-2 hidden sm:block"></div>

                    <div className="flex items-center gap-2">
                        <label className="text-sm text-zinc-400 font-medium">Objectif Palier</label>
                        <select
                            className="h-9 w-32 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none"
                            value={globalTier}
                            onChange={(e) => setGlobalTier(parseInt(e.target.value))}
                        >
                            {[1, 2, 3, 4, 5].map(t => (
                                <option key={t} value={t}>Palier {t}</option>
                            ))}
                        </select>
                    </div>

                    {isLoading && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
                </div>

                <div className="flex items-center gap-2">
                    <BonusMenuButton guildId={guildId} />
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={handleResetWeek}
                        disabled={isResetting || isLoading}
                    >
                        {isResetting ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        Reset Semaine
                    </Button>
                    <Button onClick={() => setConfirmPublishOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white">
                        <Save className="w-4 h-4 mr-2" />
                        Tout Publier
                    </Button>
                </div>
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {missions.map((mission) => {
                    const isEmpty = !mission.title;

                    // Use shared config for consistent styling
                    const config = CATEGORY_CONFIG[mission.category] || CATEGORY_CONFIG.DONJON;
                    const borderColor = isEmpty ? "border-slate-800" : config.borderColor;
                    const glowColor = isEmpty ? "rgba(255,255,255,0.1)" : config.glowColor;
                    const badgeStyle = isEmpty ? "" : `${config.color} ${config.borderColor} ${config.bgColor}`;

                    // Smart payload preview — traduit les clés anglaises en labels FR lisibles
                    const getPayloadPreview = (category: MissionCategoryType, payload: Record<string, any>): React.ReactNode => {
                        if (!payload || Object.keys(payload).length === 0) return null;
                        switch (category) {
                            case 'DONJON': {
                                const name = payload.dungeonName;
                                const boss = payload.bossName;
                                return name ? (
                                    <span className="text-violet-300 font-medium">
                                        {name}{boss ? <span className="text-zinc-500 font-normal"> · {boss}</span> : null}
                                    </span>
                                ) : null;
                            }
                            case 'ANOMALIE': {
                                const typeLabel = payload.type === 'BOSS' ? '🐉 Gardien' : payload.type === 'ZONE' ? '⚔️ Zone' : payload.type;
                                const level = payload.levelRange ? `Niv. ${payload.levelRange}` : null;
                                return <span className="text-fuchsia-300">{[typeLabel, level].filter(Boolean).join(' · ')}</span>;
                            }
                            case 'REGULATION': {
                                const zone = payload.zoneName;
                                const monster = payload.monsterName || payload.familyName;
                                return <span className="text-amber-300">{[zone, monster].filter(Boolean).join(' · ')}</span>;
                            }
                            case 'SONGES': {
                                const diff = payload.difficulty;
                                const lvl = payload.level ? `Niv. ${payload.level}` : null;
                                return <span className="text-cyan-300">{[diff, lvl].filter(Boolean).join(' ')}</span>;
                            }
                            case 'EXPEDITION': {
                                const name = payload.dungeonName;
                                const modeLabels: Record<string, string> = { bravoure: 'Bravoure', audace: 'Audace', aucun: 'Sans modif.' };
                                const mode = payload.mode ? modeLabels[payload.mode] || payload.mode : null;
                                return <span className="text-emerald-300">{[name, mode].filter(Boolean).join(' · ')}</span>;
                            }
                            case 'EVENT': {
                                return payload.description ? <span className="text-rose-300 truncate">{payload.description}</span> : null;
                            }
                            default: {
                                const first = Object.values(payload).find(v => v && typeof v === 'string');
                                return first ? <span className="text-zinc-400">{String(first)}</span> : null;
                            }
                        }
                    };
                    const payloadPreview = mission.title ? getPayloadPreview(mission.category, mission.payload) : null;

                    return (
                        <Card
                            key={mission.slotIndex}
                            className={cn(
                                "relative group transition-all duration-300 flex flex-col h-full",
                                "bg-slate-900", // Lighter base
                                isEmpty
                                    ? "bg-gradient-to-br from-slate-900/80 to-slate-950/80 border-slate-800/60 border-dashed hover:bg-slate-900/80" // Matched MissionCard style
                                    : cn("border hover:shadow-[0_0_25px_-5px_var(--glow-color)]", borderColor)
                            )}
                            style={{ "--glow-color": glowColor } as React.CSSProperties}
                        >
                            <CardHeader className="p-4 flex flex-row items-center justify-between pb-2 space-y-0 relative z-10">
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "text-xs font-mono px-1.5 py-0.5 rounded transition-colors",
                                        isEmpty ? "bg-slate-800 text-slate-500" : "bg-white/10 text-slate-300 border border-white/10"
                                    )}>
                                        #{mission.slotIndex + 1}
                                    </span>
                                    <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 transition-colors", badgeStyle)}>
                                        {mission.category}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-white/10" onClick={() => handleSaveSingle(mission.slotIndex)} title="Sauvegarder">
                                        <Save className="w-3.5 h-3.5 text-indigo-400" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-white/10" onClick={() => handleResetSingle(mission.slotIndex)} title="Effacer">
                                        <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                    </Button>
                                </div>
                            </CardHeader>

                            <CardContent className="p-4 pt-1 cursor-pointer flex-grow relative z-10" onClick={() => setEditingSlot(mission.slotIndex)}>
                                <div className="h-full flex flex-col">
                                    {isEmpty ? (
                                        <div className="flex flex-col items-center justify-center h-20 gap-2.5">
                                            <div className="w-10 h-10 rounded-xl bg-slate-900/50 border border-slate-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                                                <Edit2 className="w-4 h-4 text-slate-500 group-hover:text-slate-300 transition-colors" />
                                            </div>
                                            <span className="text-xs font-semibold text-slate-400 group-hover:text-slate-200 transition-colors">Configurer</span>
                                        </div>
                                    ) : (
                                        <>
                                            <h4 className="text-base font-bold text-white truncate leading-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-400 transition-all">
                                                {mission.title}
                                            </h4>
                                            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1 mb-2">
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300">
                                                    Rang {mission.rank}
                                                </Badge>
                                                <span className="w-0.5 h-3 bg-zinc-800" />
                                                <span className="text-indigo-400">{mission.xpReward} XP</span>
                                            </div>

                                            {/* Preview Payload */}
                                            {payloadPreview && (
                                                <div className="mt-auto flex items-center gap-1.5 text-[11px] px-2 py-1 bg-black/30 rounded border border-white/5 group-hover:border-white/10 transition-colors">
                                                    {payloadPreview}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    );
                })}
            </div>

            {/* Editing Dialog */}
            <Dialog open={editingSlot !== null} onOpenChange={(open) => !open && setEditingSlot(null)}>
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle>Éditer Slot #{editingSlot !== null ? editingSlot + 1 : ''}</DialogTitle>
                    </DialogHeader>

                    {currentMission && (
                        <div className="grid gap-4 py-4">
                            {/* Category & Tier/Rank Row */}
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-zinc-400">Catégorie</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-white"
                                        value={currentMission.category}
                                        onChange={(e) => updateMission(currentMission.slotIndex, {
                                            category: e.target.value as MissionCategoryType,
                                            title: "",
                                            payload: {}
                                        })}
                                    >
                                        {MISSION_CATEGORIES.map(c => (
                                            <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-zinc-400">Rang (Contenu)</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-white"
                                        value={currentMission.rank}
                                        onChange={(e) => updateMission(currentMission.slotIndex, { rank: parseInt(e.target.value) })}
                                    >
                                        {[1, 2, 3, 4].map(r => (
                                            <option key={r} value={r}>Rang {r}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            {/* Rewards Row */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-zinc-400">XP Guilde</label>
                                    <input
                                        type="number"
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-white"
                                        value={currentMission.xpReward}
                                        onChange={(e) => updateMission(currentMission.slotIndex, { xpReward: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-zinc-400">Guildatons</label>
                                    <input
                                        type="number"
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-white"
                                        value={currentMission.guildatonsReward}
                                        onChange={(e) => updateMission(currentMission.slotIndex, { guildatonsReward: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

                            {/* Category-Specific Form */}
                            <div className="pt-3 border-t border-zinc-800">
                                {currentMission.category === 'DONJON' && (
                                    <DungeonForm
                                        payload={currentMission.payload}
                                        onPayloadChange={(payload) => updateMission(currentMission.slotIndex, { payload })}
                                        onTitleChange={(title) => updateMission(currentMission.slotIndex, { title })}
                                        onRankChange={(rank) => updateMission(currentMission.slotIndex, { rank })}
                                    />
                                )}
                                {currentMission.category === 'REGULATION' && (
                                    <RegulationForm
                                        payload={currentMission.payload}
                                        onPayloadChange={(payload) => updateMission(currentMission.slotIndex, { payload })}
                                        onTitleChange={(title) => updateMission(currentMission.slotIndex, { title })}
                                        onRankChange={(rank) => updateMission(currentMission.slotIndex, { rank })}
                                    />
                                )}
                                {currentMission.category === 'ANOMALIE' && (
                                    <AnomalieForm
                                        payload={currentMission.payload}
                                        onPayloadChange={(payload) => updateMission(currentMission.slotIndex, { payload })}
                                        onTitleChange={(title) => updateMission(currentMission.slotIndex, { title })}
                                        onRankChange={(rank) => updateMission(currentMission.slotIndex, { rank })}
                                    />
                                )}
                                {currentMission.category === 'SONGES' && (
                                    <SongesForm
                                        payload={currentMission.payload}
                                        onPayloadChange={(payload) => updateMission(currentMission.slotIndex, { payload })}
                                        onTitleChange={(title) => updateMission(currentMission.slotIndex, { title })}
                                        onRankChange={(rank) => updateMission(currentMission.slotIndex, { rank })}
                                    />
                                )}
                                {currentMission.category === 'EXPEDITION' && (
                                    <ExpeditionForm
                                        payload={currentMission.payload}
                                        onPayloadChange={(payload) => updateMission(currentMission.slotIndex, { payload })}
                                        onTitleChange={(title) => updateMission(currentMission.slotIndex, { title })}
                                        onRankChange={(rank) => updateMission(currentMission.slotIndex, { rank })}
                                    />
                                )}
                                {currentMission.category === 'EVENT' && (
                                    <EventForm
                                        payload={currentMission.payload}
                                        onPayloadChange={(payload) => updateMission(currentMission.slotIndex, { payload })}
                                        onTitleChange={(title) => updateMission(currentMission.slotIndex, { title })}
                                    />
                                )}
                            </div>
                        </div>
                    )}
                    <DialogFooter className="gap-2">
                        <Button variant="ghost" onClick={() => setEditingSlot(null)}>Fermer</Button>
                        <Button onClick={() => { handleSaveSingle(currentMission!.slotIndex); setEditingSlot(null); }} className="bg-indigo-600">Enregistrer</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Publish Confirmation */}
            <Dialog open={confirmPublishOpen} onOpenChange={setConfirmPublishOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-500">
                            <AlertTriangle className="w-5 h-5" />
                            Confirmer la publication
                        </DialogTitle>
                        <DialogDescription>
                            Vous allez mettre à jour les {missions.filter(m => m.title).length} missions configurées pour la Semaine {weekNumber}.
                            <br /><br />
                            Cela ne supprimera pas les missions existantes des autres slots, mais écrasera celles-ci.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setConfirmPublishOpen(false)}>Annuler</Button>
                        <Button onClick={handleGlobalPublish} className="bg-amber-600 hover:bg-amber-500 text-white">
                            Confirmer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div >
    );
}
