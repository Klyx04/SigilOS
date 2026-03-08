'use client'

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { createWeekMissions, resetMission, resetWeek, getWeekMissions, updateWeekTier } from "@/server/actions/mission-actions";
import { getDofusConfig } from "@/server/actions/admin-actions";
import { toast } from "sonner";
import { Save, Trash2, Edit2, RotateCcw, Check, Loader2, AlertTriangle, Send, Swords, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_CONFIG, MISSION_CATEGORIES, type MissionCategoryType } from "@/lib/mission-config";
import { getDofusWeek } from "@/lib/date-utils";
import { useRouter } from "next/navigation";
import { BonusMenuButton } from "@/components/admin/BonusMenuButton";
import { MissionDiscordPublishDialog } from "./mission-discord-publish-dialog";
import { GuidePulse } from "@/components/dashboard/guide-pulse";
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
    category: index >= 12 ? "EVENT" : "DONJON", // Slots 12-17 are for SPECIALES (EVENT)
    rank: 1,
    title: "",
    xpReward: 300,
    guildatonsReward: 50,
    payload: index >= 12 ? { eventType: 'REGULATION' } : { boss: "" }
});

type MissionPool = 'CLASSIQUES' | 'SPECIALES';

// --- Component ---

export function MissionEditor({ guildId }: { guildId: string }) {
    const router = useRouter();
    const { week: weekNumber, year } = getDofusWeek();

    const [missions, setMissions] = useState<DraftMission[]>(
        Array.from({ length: 18 }).map((_, i) => DEFAULT_mission_TEMPLATE(i))
    );

    const [missionPool, setMissionPool] = useState<MissionPool>('CLASSIQUES');
    const [globalTier, setGlobalTier] = useState<number>(3);
    const [guildDefaultTier, setGuildDefaultTier] = useState<number>(3);
    const [editingSlot, setEditingSlot] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [isDiscordDialogOpen, setIsDiscordDialogOpen] = useState(false);
    const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);

    // Slots for current pool
    const poolMissions = missionPool === 'CLASSIQUES'
        ? missions.slice(0, 12)  // slots 0-11
        : missions.slice(12, 18); // slots 12-17

    // Fetch Data on Week Change
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Load guild default tier (for fallback when no missions exist yet)
            const configRes = await getDofusConfig(guildId);
            const guildTier = configRes.success && configRes.data?.missionTier ? configRes.data.missionTier : 3;
            setGuildDefaultTier(guildTier);

            const res = await getWeekMissions(guildId, weekNumber, year);
            if (res.success && res.data) {
                const fetched = res.data;
                // Build 18 slots: 0-11 classic, 12-17 special
                const newMissions = Array.from({ length: 18 }).map((_, i) => {
                    const existing = fetched.find((m: any) => m.slotIndex === i);
                    if (existing) {
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

                // Use the tier from existing missions if available, else fall back to guild default
                const foundTier = (fetched as any[]).find((m: any) => m.tier)?.tier;
                setGlobalTier(foundTier || guildTier);
            } else {
                // No missions yet this week — use guild default
                setGlobalTier(guildTier);
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
        // Only publish missions from the current pool
        const poolMissionsToPublish = missionPool === 'CLASSIQUES'
            ? missions.slice(0, 12)
            : missions.slice(12, 18);
        const res = await createWeekMissions({
            guildId,
            weekNumber,
            year,
            missions: poolMissionsToPublish.map(m => ({ ...m, tier: globalTier })),
            updateGuildTier: missionPool === 'CLASSIQUES' ? globalTier : undefined,
            notifyMembers: true
        });
        setIsSaving(false);
        setConfirmPublishOpen(false);

        if (res.success) {
            toast.success(missionPool === 'CLASSIQUES' ? "Missions classiques publiées !" : "Missions spéciales publiées !");
            fetchData();
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
                setMissions(Array.from({ length: 18 }).map((_, i) => DEFAULT_mission_TEMPLATE(i)));
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

    const updateMission = (slot: number, updates: Partial<DraftMission>) => {
        setMissions(prev => prev.map(m => m.slotIndex === slot ? { ...m, ...updates } : m));
    };

    /** Returns an error string if the mission is incomplete, null if valid */
    const validateMission = (m: DraftMission): string | null => {
        if (!m.title?.trim()) {
            switch (m.category) {
                case 'DONJON': return "Sélectionnez un donjon.";
                case 'EXPEDITION': return "Sélectionnez un donjon pour l’expédition.";
                case 'REGULATION': return "Sélectionnez une zone ou une famille de monstres.";
                case 'ANOMALIE': return "Configurez l’anomalie (zone requise).";
                case 'SONGES': return "Configurez les songes.";
                case 'EVENT': return "Configurez le type d’événement (donjon, régulation ou monstre spécial).";
                default: return "Champs requis manquants.";
            }
        }
        // Extra field checks per category
        if (m.category === 'DONJON' && !m.payload?.dungeonId)
            return "Sélectionnez un donjon dans la liste.";
        if (m.category === 'EXPEDITION' && !m.payload?.dungeonId)
            return "Sélectionnez un donjon pour l’expédition.";
        if (m.category === 'REGULATION' && !m.payload?.familyId && !m.payload?.zoneId)
            return "Sélectionnez au moins une zone ou une famille.";
        return null;
    };

    const handleSaveFromDialog = (slot: number) => {
        const mission = missions[slot];
        const error = validateMission(mission);
        if (error) {
            toast.error(error, { description: "Complétez tous les champs avant d’enregistrer." });
            return;
        }
        handleSaveSingle(slot);
        setEditingSlot(null);
    };

    const currentMission = editingSlot !== null ? missions[editingSlot] : null;

    const handleGlobalTierChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
        const newTier = parseInt(e.target.value);
        setGlobalTier(newTier);

        setIsLoading(true);
        const res = await updateWeekTier(guildId, weekNumber, year, newTier);
        setIsLoading(false);

        if (res.success) {
            toast.success(`Palier hebdomadaire mis à jour : Palier ${newTier}`);
            router.refresh();
        } else {
            toast.error(res.error || "Erreur lors de la mise à jour du palier.");
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
                        <label className="text-sm text-zinc-400 font-medium">Palier semaine</label>
                        <select
                            className="h-9 w-32 rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-white focus:ring-2 focus:ring-indigo-500/50 outline-none disabled:opacity-50"
                            value={globalTier}
                            onChange={handleGlobalTierChange}
                            disabled={isLoading}
                        >
                            {[1, 2, 3, 4, 5].map(t => (
                                <option key={t} value={t}>Palier {t}</option>
                            ))}
                        </select>
                        {globalTier !== guildDefaultTier && (
                            <span className="text-[10px] text-zinc-600 italic">Défaut guilde : {guildDefaultTier}</span>
                        )}
                        <GuidePulse description="Définit le nombre total de points requis par la guilde cette semaine pour débloquer les récompenses." />
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
                    <div className="w-px h-8 bg-zinc-800 mx-1 hidden sm:block"></div>

                    <Button
                        variant="outline"
                        className="border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/10 hover:text-indigo-300 transition-all font-black uppercase tracking-widest text-[10px] h-9"
                        disabled={isLoading}
                        onClick={() => setIsDiscordDialogOpen(true)}
                    >
                        <Send className="w-3.5 h-3.5 mr-2" />
                        Annonce Discord
                    </Button>

                    <div className="relative group">
                        <Button onClick={() => setConfirmPublishOpen(true)} className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold h-9 text-[10px] uppercase tracking-widest" size="sm">
                            <Save className="w-3.5 h-3.5 mr-2" />
                            Tout Publier
                        </Button>
                        <GuidePulse
                            description="Enregistre toutes les missions et notifie les membres si l'option est cochée."
                            className="absolute -top-1 -right-1"
                        />
                    </div>
                </div>
            </div>

            {/* Pool Toggle — Dofus 3.5 Classiques / Spéciales */}
            <div className="flex items-center gap-3">
                <div className="flex items-center gap-1 p-1 bg-black/60 backdrop-blur-md border border-white/10 rounded-full shadow-lg">
                    {(['CLASSIQUES', 'SPECIALES'] as MissionPool[]).map(pool => {
                        const isActive = missionPool === pool;
                        const count = pool === 'CLASSIQUES' ? missions.slice(0, 12).filter(m => m.title).length : missions.slice(12, 18).filter(m => m.title).length;
                        const total = pool === 'CLASSIQUES' ? 12 : 6;
                        return (
                            <button
                                key={pool}
                                onClick={() => setMissionPool(pool)}
                                className={cn(
                                    "relative flex items-center gap-2 px-5 py-2 text-xs font-black rounded-full transition-all duration-300 uppercase tracking-widest",
                                    isActive
                                        ? pool === 'CLASSIQUES'
                                            ? "bg-indigo-500 text-white shadow-[0_0_20px_rgba(99,102,241,0.4)]"
                                            : "bg-yellow-500 text-black shadow-[0_0_20px_rgba(234,179,8,0.5)]"
                                        : "text-zinc-400 hover:text-white hover:bg-white/10"
                                )}
                            >
                                {pool === 'CLASSIQUES' ? <Swords className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                                {pool}
                                <span className={cn(
                                    "text-[9px] font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                                    isActive
                                        ? pool === 'CLASSIQUES' ? "bg-white/20 text-white" : "bg-black/20 text-black"
                                        : "bg-zinc-700 text-zinc-300"
                                )}>
                                    {count}/{total}
                                </span>
                            </button>
                        );
                    })}
                </div>
                {missionPool === 'SPECIALES' && (
                    <span className="text-[10px] text-yellow-400/70 font-medium hidden sm:flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Missions spéciales — jusqu'à 6 missions (Dofus 3.5)
                    </span>
                )}
                {isLoading && <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {poolMissions.map((mission) => {
                    const isEmpty = !mission.title;
                    const config = CATEGORY_CONFIG[mission.category] || CATEGORY_CONFIG.DONJON;
                    const borderColor = isEmpty ? "border-zinc-800" : config.borderColor;
                    const glowColor = isEmpty ? "rgba(255,255,255,0.1)" : config.glowColor;
                    const badgeStyle = isEmpty ? "" : `${config.color} ${config.borderColor} ${config.bgColor}`;

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
                                "bg-zinc-900 shadow-xl",
                                isEmpty
                                    ? "bg-zinc-950/50 border-zinc-800/60 border-dashed hover:bg-zinc-900/80"
                                    : cn("border hover:shadow-[0_0_25px_-5px_var(--glow-color)]", borderColor)
                            )}
                            style={{ "--glow-color": glowColor } as React.CSSProperties}
                        >
                            <CardHeader className="p-4 flex flex-row items-center justify-between pb-2 space-y-0 relative z-10">
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "text-[10px] font-black px-1.5 py-0.5 rounded transition-colors",
                                        isEmpty ? "bg-zinc-800 text-zinc-500" : "bg-white/10 text-white border border-white/10"
                                    )}>
                                        #{mission.slotIndex + 1}
                                    </span>
                                    <Badge variant="outline" className={cn("text-[10px] h-5 px-1.5 transition-colors uppercase tracking-tight", badgeStyle)}>
                                        {mission.category}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 hover:bg-white/10"
                                        title={validateMission(mission) ?? "Sauvegarder"}
                                        onClick={() => {
                                            const err = validateMission(mission);
                                            if (err) {
                                                toast.error(err, { description: "Ouvrez le slot pour compléter les champs requis." });
                                                return;
                                            }
                                            handleSaveSingle(mission.slotIndex);
                                        }}
                                    >
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
                                            <div className="w-10 h-10 rounded-xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-center group-hover:scale-110 transition-transform duration-300 shadow-inner">
                                                <Edit2 className="w-4 h-4 text-zinc-500 group-hover:text-zinc-300 transition-colors" />
                                            </div>
                                            <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500 group-hover:text-zinc-200 transition-colors">Configurer</span>
                                        </div>
                                    ) : (
                                        <>
                                            <h4 className="text-base font-bold text-white truncate leading-tight transition-all">
                                                {mission.title}
                                            </h4>
                                            <div className="flex items-center gap-2 text-xs text-zinc-400 mt-1 mb-2">
                                                <Badge variant="secondary" className="text-[10px] h-5 px-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300">
                                                    Rang {mission.rank}
                                                </Badge>
                                                <span className="w-0.5 h-3 bg-zinc-800" />
                                                <span className="text-indigo-400 font-bold">{mission.xpReward} XP</span>
                                            </div>

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
                <DialogContent className="bg-zinc-900 border-zinc-800 text-white sm:max-w-lg shadow-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-xl font-black flex items-center gap-2">
                            {editingSlot !== null && editingSlot >= 12
                                ? <><Sparkles className="w-4 h-4 text-yellow-400" /> Éditer Slot Spécial #{editingSlot - 11}</>
                                : <>Éditer Slot #{editingSlot !== null ? editingSlot + 1 : ''}</>}
                        </DialogTitle>
                    </DialogHeader>

                    {currentMission && (
                        <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Catégorie</label>
                                    {missionPool === 'SPECIALES' ? (
                                        // Special pool: locked to EVENT
                                        <div className="h-9 w-full rounded-md border border-yellow-500/30 bg-yellow-500/10 px-3 flex items-center gap-2 text-sm text-yellow-300 font-bold">
                                            <Sparkles className="w-3.5 h-3.5" /> Événement
                                        </div>
                                    ) : (
                                        // Classic pool: all categories except EVENT
                                        <select
                                            className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                                            value={currentMission.category}
                                            onChange={(e) => updateMission(currentMission.slotIndex, {
                                                category: e.target.value as MissionCategoryType,
                                                title: "",
                                                payload: {}
                                            })}
                                        >
                                            {MISSION_CATEGORIES.filter(c => c !== 'EVENT').map(c => (
                                                <option key={c} value={c}>{CATEGORY_CONFIG[c].label}</option>
                                            ))}
                                        </select>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Rang (Difficulté)</label>
                                    <select
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        value={currentMission.rank}
                                        onChange={(e) => updateMission(currentMission.slotIndex, { rank: parseInt(e.target.value) })}
                                    >
                                        {[1, 2, 3, 4].map(r => (
                                            <option key={r} value={r}>Rang {r}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-zinc-500">XP Guilde</label>
                                    <input
                                        type="number"
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        value={currentMission.xpReward}
                                        onChange={(e) => updateMission(currentMission.slotIndex, { xpReward: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-black uppercase tracking-widest text-zinc-500">Guildatons</label>
                                    <input
                                        type="number"
                                        className="h-9 w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-1 text-sm text-white outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        value={currentMission.guildatonsReward}
                                        onChange={(e) => updateMission(currentMission.slotIndex, { guildatonsReward: parseInt(e.target.value) || 0 })}
                                    />
                                </div>
                            </div>

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
                    <DialogFooter className="gap-2 flex-col sm:flex-row items-center">
                        {currentMission && (() => {
                            const err = validateMission(currentMission);
                            return err ? (
                                <p className="flex-1 text-xs text-rose-400 font-medium flex items-center gap-1.5 mr-auto">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                                    {err}
                                </p>
                            ) : null;
                        })()}
                        <Button variant="ghost" onClick={() => setEditingSlot(null)} className="text-zinc-400 hover:text-white">Annuler</Button>
                        <Button
                            onClick={() => currentMission && handleSaveFromDialog(currentMission.slotIndex)}
                            disabled={!!currentMission && !!validateMission(currentMission)}
                            className="bg-indigo-600 hover:bg-indigo-500 font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Enregistrer
                        </Button>
                    </DialogFooter>

                </DialogContent>
            </Dialog>

            <Dialog open={confirmPublishOpen} onOpenChange={setConfirmPublishOpen}>
                <DialogContent className="max-w-sm bg-zinc-900 border-zinc-800 text-white shadow-2xl rounded-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-500 font-black text-base">
                            <AlertTriangle className="w-4 h-4" />
                            Confirmer la publication
                        </DialogTitle>
                        <DialogDescription className="text-zinc-400 text-sm">
                            Vous allez publier les {missionPool === 'CLASSIQUES' ? 'missions classiques' : 'missions spéciales'} ({poolMissions.filter(m => m.title).length} configurées sur {missionPool === 'CLASSIQUES' ? 12 : 6}) pour la Semaine {weekNumber}.
                            <br /><br />
                            {missionPool === 'CLASSIQUES'
                                ? "Cela mettra à jour les 12 slots classiques (indices 0-11)."
                                : "Cela mettra à jour les 6 slots spéciaux (indices 12-17), dans le pool Événements."}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setConfirmPublishOpen(false)}>Annuler</Button>
                        <Button onClick={handleGlobalPublish} className="bg-amber-600 hover:bg-amber-500 text-white font-bold">
                            Publier maintenant
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <MissionDiscordPublishDialog
                isOpen={isDiscordDialogOpen}
                onOpenChange={setIsDiscordDialogOpen}
                guildId={guildId}
            />
        </div >
    );
}
