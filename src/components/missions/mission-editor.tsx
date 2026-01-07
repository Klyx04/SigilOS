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

// --- Types ---

type DraftMission = {
    slotIndex: number; // 0-11
    category: MissionCategoryType;
    tier: number;
    title: string;
    xpReward: number;
    guildatonsReward: number;
    payload: Record<string, any>;
};

const DEFAULT_mission_TEMPLATE = (index: number): DraftMission => ({
    slotIndex: index,
    category: "DONJON",
    tier: 1,
    title: "",
    xpReward: 300,
    guildatonsReward: 50,
    payload: { boss: "" }
});

// --- Component ---

export function MissionEditor({ guildId }: { guildId: string }) {
    const [weekNumber, setWeekNumber] = useState<number>(getWeekNumber().week);
    const [year, setYear] = useState<number>(getWeekNumber().year);

    const [missions, setMissions] = useState<DraftMission[]>(
        Array.from({ length: 12 }).map((_, i) => DEFAULT_mission_TEMPLATE(i))
    );

    const [editingSlot, setEditingSlot] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
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
                        return {
                            slotIndex: i,
                            category: existing.category,
                            tier: existing.tier,
                            title: existing.title || "",
                            xpReward: existing.xpReward || 0,
                            guildatonsReward: existing.guildatonsReward || 0,
                            payload: existing.payload || {}
                        };
                    }
                    return DEFAULT_mission_TEMPLATE(i);
                });
                setMissions(newMissions);
            }
        } catch (e) {
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
        toast.promise(
            createWeekMissions({
                guildId,
                weekNumber,
                year,
                missions: [mission]
            }),
            {
                loading: 'Sauvegarde...',
                success: 'Mission sauvegardée !',
                error: 'Erreur sauvegarde'
            }
        );
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
            missions: missions
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
        if (!confirm(" ATTENTION: Tout effacer pour cette semaine ?")) return;

        const res = await resetWeek(guildId, weekNumber, year);
        if (res.success) {
            setMissions(Array.from({ length: 12 }).map((_, i) => DEFAULT_mission_TEMPLATE(i)));
            toast.success("Semaine réinitialisée");
        } else {
            toast.error("Erreur reset semaine");
        }
    };

    return (
        <div className="space-y-6">
            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center justify-between bg-zinc-900 border border-zinc-800 p-4 rounded-xl gap-4">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-zinc-400">Semaine</label>
                        <input
                            type="number"
                            className="w-16 h-9 bg-zinc-950 border border-zinc-800 rounded px-2 text-sm text-center text-white"
                            value={weekNumber}
                            onChange={(e) => setWeekNumber(parseInt(e.target.value))}
                        />
                    </div>
                    <div className="flex items-center gap-2">
                        <label className="text-sm text-zinc-400">Année</label>
                        <input
                            type="number"
                            className="w-20 h-9 bg-zinc-950 border border-zinc-800 rounded px-2 text-sm text-center text-white"
                            value={year}
                            onChange={(e) => setYear(parseInt(e.target.value))}
                        />
                    </div>
                    {isLoading && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
                </div>

                <div className="flex items-center gap-2">
                    <Button variant="destructive" size="sm" onClick={handleResetWeek}>
                        <Trash2 className="w-4 h-4 mr-2" />
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

                    const previewText = mission.title ? (
                        Object.entries(mission.payload)
                            .filter(([_, v]) => v)
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' • ')
                    ) : '';

                    return (
                        <Card
                            key={mission.slotIndex}
                            className={cn(
                                "relative group transition-all duration-300 flex flex-col h-full",
                                "bg-slate-900", // Lighter base
                                isEmpty
                                    ? "border-slate-800 border-dashed hover:border-slate-600 hover:bg-slate-800/50" // No opacity reduction, clear dashed border
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
                                        <div className="flex flex-col items-center justify-center h-20 text-zinc-600 gap-2">
                                            <div className="w-8 h-8 rounded-full bg-zinc-900 border border-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </div>
                                            <span className="text-xs font-medium">Configurer</span>
                                        </div>
                                    ) : (
                                        <>
                                            <h4 className="text-base font-bold text-white truncate leading-tight group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-zinc-400 transition-all">
                                                {mission.title}
                                            </h4>
                                            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1 mb-2">
                                                <span className="text-zinc-500 font-medium">P{mission.tier}</span>
                                                <span className="w-0.5 h-3 bg-zinc-800" />
                                                <span className="text-indigo-400">{mission.xpReward} XP</span>
                                            </div>

                                            {/* Preview Payload */}
                                            {previewText && (
                                                <div className="mt-auto text-[10px] text-zinc-500 font-mono truncate px-2 py-1 bg-black/40 rounded border border-white/5 group-hover:border-white/10 transition-colors">
                                                    {previewText}
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
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-zinc-400">Catégorie</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-white"
                                        value={currentMission.category}
                                        onChange={(e) => updateMission(currentMission.slotIndex, { category: e.target.value as MissionCategoryType })}
                                    >
                                        {MISSION_CATEGORIES.map(c => (
                                            <option key={c} value={c}>{c}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-zinc-400">Palier (1-5)</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-white"
                                        value={currentMission.tier}
                                        onChange={(e) => updateMission(currentMission.slotIndex, { tier: parseInt(e.target.value) })}
                                    >
                                        {[1, 2, 3, 4, 5].map(t => (
                                            <option key={t} value={t}>Palier {t}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <label className="text-xs font-medium text-zinc-400">Titre / Boss</label>
                                <input
                                    className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-white focus:outline-none focus:border-indigo-500"
                                    value={currentMission.title}
                                    onChange={(e) => updateMission(currentMission.slotIndex, { title: e.target.value, payload: { ...currentMission.payload, boss: e.target.value } })}
                                    placeholder="Ex: Tofu Royal"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-zinc-400">XP Guilde</label>
                                    <input
                                        type="number"
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-white"
                                        value={currentMission.xpReward}
                                        onChange={(e) => updateMission(currentMission.slotIndex, { xpReward: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium text-zinc-400">Guildatons</label>
                                    <input
                                        type="number"
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-white"
                                        value={currentMission.guildatonsReward}
                                        onChange={(e) => updateMission(currentMission.slotIndex, { guildatonsReward: parseInt(e.target.value) })}
                                    />
                                </div>
                            </div>

                            {/* Dynamic Fields */}
                            <div className="space-y-2 pt-2 border-t border-zinc-800">
                                <span className="text-xs font-bold text-zinc-500">SPÉCIFIQUE</span>
                                {(currentMission.category === 'REGULATION') && (
                                    <input
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-white"
                                        value={currentMission.payload.zone || ''}
                                        onChange={(e) => updateMission(currentMission.slotIndex, { payload: { ...currentMission.payload, zone: e.target.value } })}
                                        placeholder="Zone (ex: Cania)"
                                    />
                                )}
                                {(currentMission.category === 'ANOMALIE') && (
                                    <input
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-white"
                                        value={currentMission.payload.elixir || ''}
                                        onChange={(e) => updateMission(currentMission.slotIndex, { payload: { ...currentMission.payload, elixir: e.target.value } })}
                                        placeholder="Elixir"
                                    />
                                )}
                                {(currentMission.category === 'SONGES') && (
                                    <input
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-white"
                                        value={currentMission.payload.etage || ''}
                                        onChange={(e) => updateMission(currentMission.slotIndex, { payload: { ...currentMission.payload, etage: e.target.value } })}
                                        placeholder="Étage (ex: 200+)"
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
