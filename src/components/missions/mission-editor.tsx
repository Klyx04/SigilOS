'use client'

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { createWeekMissions, resetMission, resetWeek, getWeekMissions, updateWeekTier, isWeekPublished } from "@/server/actions/mission-actions";
import { getDofusConfig, updateGuildHallConfig } from "@/server/actions/admin-actions";
import { toast } from "sonner";
import { Save, Trash2, Edit2, RotateCcw, Check, Loader2, AlertTriangle, Send, Swords, Sparkles, Home, ChevronDown, MapPin, X, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { CATEGORY_CONFIG, MISSION_CATEGORIES, type MissionCategoryType } from "@/lib/mission-config";
import { getDofusWeek } from "@/lib/date-utils";
import { useRouter } from "next/navigation";
import { BonusMenuButton } from "@/components/admin/BonusMenuButton";
import { MissionPublishFlowDialog } from "./mission-publish-flow-dialog";
import { MissionOfficialSearch } from "./MissionOfficialSearch";
import { MissionLivePreview } from "./MissionLivePreview";
import { mapOfficialToDraftMission } from "@/lib/game-data/guild-missions-catalog";
import { GuidePulse } from "@/components/dashboard/guide-pulse";
import { DOFUS_WORLDS } from "@/lib/dofus-assets";
import {
    DungeonForm,
    RegulationForm,
    AnomalieForm,
    SongesForm,
    SongesEpreuveForm,
    ExpeditionForm,
    EventForm
} from "./category-forms";

// --- Types ---

type DraftMission = {
    slotIndex: number; // 0-11 classiques, 12-19 spéciales
    category: MissionCategoryType;
    rank: number;
    title: string;
    xpReward: number;
    guildatonsReward: number;
    payload: Record<string, any>;
};

const DEFAULT_mission_TEMPLATE = (index: number): DraftMission => ({
    slotIndex: index,
    category: index >= 12 ? "EVENT" : "DONJON", // Slots 12-19 are for SPECIALES (EVENT)
    rank: 1,
    title: "",
    xpReward: 300,
    guildatonsReward: 50,
    payload: index >= 12 ? { eventType: 'REGULATION' } : { boss: "" }
});

type MissionPool = 'CLASSIQUES' | 'SPECIALES';

// --- Component ---

export function MissionEditor({ guildId, isDiscordConfigured }: { guildId: string; isDiscordConfigured?: boolean }) {
    const router = useRouter();
    const { week: weekNumber, year } = getDofusWeek();

    const [missions, setMissions] = useState<DraftMission[]>(
        Array.from({ length: 20 }).map((_, i) => DEFAULT_mission_TEMPLATE(i))
    );

    const [missionPool, setMissionPool] = useState<MissionPool>('CLASSIQUES');
    const [globalTier, setGlobalTier] = useState<number>(3);
    const [guildDefaultTier, setGuildDefaultTier] = useState<number>(3);
    const [editingSlot, setEditingSlot] = useState<number | null>(null);
    const [editorMode, setEditorMode] = useState<'CATALOG' | 'CUSTOM'>('CATALOG');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isResetting, setIsResetting] = useState(false);
    const [confirmPublishOpen, setConfirmPublishOpen] = useState(false);
    // Détecte si le pool courant est déjà publié en base (pour éviter les double-notifications au redéploiement)
    const [publishedState, setPublishedState] = useState<{ classiques: boolean; speciales: boolean }>({ classiques: false, speciales: false });

    // Guild Hall Config state
    const [hallPanelOpen, setHallPanelOpen] = useState(false);
    const [hallPosX, setHallPosX] = useState<number | null>(null);
    const [hallPosY, setHallPosY] = useState<number | null>(null);
    const [hallWorldId, setHallWorldId] = useState<number>(1);
    const [isSavingHall, setIsSavingHall] = useState(false);

    // Slots for current pool
    const poolMissions = missionPool === 'CLASSIQUES'
        ? missions.slice(0, 12)  // slots 0-11
        : missions.slice(12, 20); // slots 12-19

    // Fetch Data on Week Change
    const fetchData = useCallback(async () => {
        setIsLoading(true);
        try {
            // Load guild default tier (for fallback when no missions exist yet)
            const configRes = await getDofusConfig(guildId);
            const guildTier = configRes.success && configRes.data?.missionTier ? configRes.data.missionTier : 3;
            setGuildDefaultTier(guildTier);

            // Load guild hall config
            if (configRes.success && configRes.data) {
                setHallPosX(configRes.data.guildHallPosX ?? null);
                setHallPosY(configRes.data.guildHallPosY ?? null);
                setHallWorldId(configRes.data.guildHallWorldId ?? 1);
            }

            const [res, pubRes] = await Promise.all([
                getWeekMissions(guildId, weekNumber, year),
                isWeekPublished(guildId, weekNumber, year)
            ]);

            if (pubRes.success && pubRes.data) {
                setPublishedState({
                    classiques: pubRes.data.isPublished,
                    speciales: pubRes.data.isPublished
                });
            } else {
                setPublishedState({ classiques: false, speciales: false });
            }

            if (res.success && res.data) {
                const fetched = res.data;

                // Build 20 slots: 0-11 classic, 12-19 special
                const newMissions = Array.from({ length: 20 }).map((_, i) => {
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
        
        // Local uniqueness check
        const currentSig = `${mission.category}-${globalTier}-${mission.rank}-${mission.title}-${JSON.stringify(mission.payload)}`;
        const isDuplicate = missions.some((m, idx) => {
            if (idx === slot || !m.title) return false;
            const sig = `${m.category}-${globalTier}-${m.rank}-${m.title}-${JSON.stringify(m.payload)}`;
            return sig === currentSig;
        });

        if (isDuplicate) {
            toast.error(`Doublon détecté : La mission "${mission.title}" est déjà configurée dans un autre slot.`);
            return;
        }

        const promise = createWeekMissions({
            guildId,
            weekNumber,
            year,
            missions: [{ ...mission, tier: globalTier }],
            updateGuildTier: missionPool === 'CLASSIQUES' ? globalTier : undefined
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
        // Uniqueness check (Frontend safety)
        const seen = new Set<string>();
        const duplicates = [];
        for (const m of poolMissions) {
            if (!m.title) continue;
            const sig = `${m.category}-${globalTier}-${m.rank}-${m.title}-${JSON.stringify(m.payload)}`;
            if (seen.has(sig)) duplicates.push(m.title);
            seen.add(sig);
        }

        if (duplicates.length > 0) {
            toast.error(`Doublon détecté : "${duplicates[0]}". Chaque mission doit être unique.`);
            return { success: false, error: "Duplicate missions" };
        }

        // Le pool est-il déjà publié en base ? Si oui → simple redéploiement sans re-notifier.
        const alreadyPublished = missionPool === 'CLASSIQUES' ? publishedState.classiques : publishedState.speciales;

        setIsSaving(true);
        // Only publish missions from the current pool
        const res = await createWeekMissions({
            guildId,
            weekNumber,
            year,
            missions: poolMissions.filter(m => m.title).map(m => ({ ...m, tier: globalTier })),
            updateGuildTier: missionPool === 'CLASSIQUES' ? globalTier : undefined,
            notifyMembers: !alreadyPublished
        });
        setIsSaving(false);

        if (res.success) {
            toast.success(missionPool === 'CLASSIQUES' ? "Missions classiques sauvegardées !" : "Missions spéciales sauvegardées !");
            fetchData();
            return { success: true };
        } else {
            toast.error(res.error || "Erreur globale");
            return { success: false, error: res.error };
        }
    };

    const handleResetWeek = async () => {
        if (!confirm("⚠️ ATTENTION: Voulez-vous vraiment TOUT EFFACER pour cette semaine ? Cette action est irréversible.")) return;

        setIsResetting(true);
        try {
            const res = await resetWeek(guildId, weekNumber, year);
            if (res.success) {
                setMissions(Array.from({ length: 20 }).map((_, i) => DEFAULT_mission_TEMPLATE(i)));
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
                case 'EVENT': return "Renseignez le titre et le type de mission événement.";
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
        if (m.category === 'EVENT' && m.payload?.eventType === 'OBJECTIF' && !m.payload?.description?.trim())
            return "Rédigez l'objectif de la mission.";
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
            {!isDiscordConfigured && (
                <div className="bg-warning/10 border border-warning/20 rounded-xl p-4 flex items-start gap-4 shadow-lg backdrop-blur-sm">
                    <div className="p-2 bg-warning/20 rounded-lg text-warning">
                        <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-sm font-black text-warning uppercase tracking-widest mb-1">Configuration Discord Absente</h4>
                        <p className="text-xs text-warning/70 leading-relaxed font-medium">
                            Le salon de notification des missions n&apos;est pas configuré dans les paramètres de la guilde.
                            <span className="text-warning font-bold ml-1 italic text-caption sm:text-xs">
                                Le bouton d&apos;Annonce Discord est masqué pour éviter les pings invalides.
                            </span>
                        </p>
                    </div>
                </div>
            )}

            {/* Toolbar */}
            <div className="flex flex-col md:flex-row items-center justify-between bg-surface border border-border p-4 rounded-xl gap-4">
                <div className="flex flex-wrap items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Semaine</span>
                        <span className="h-9 px-3 flex items-center bg-background border border-border rounded text-sm text-foreground font-mono font-bold">
                            {weekNumber}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">Année</span>
                        <span className="h-9 px-3 flex items-center bg-background border border-border rounded text-sm text-foreground font-mono">
                            {year}
                        </span>
                    </div>

                    <div className="w-px h-8 bg-elevated mx-2 hidden sm:block"></div>

                    <div className="flex items-center gap-2">
                        <label className="text-sm text-muted-foreground font-medium">Palier semaine</label>
                        <select
                            className="h-9 w-32 rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:ring-2 focus:ring-ring/50 outline-none disabled:opacity-50"
                            value={globalTier}
                            onChange={handleGlobalTierChange}
                            disabled={isLoading}
                        >
                            {[1, 2, 3, 4, 5].map(t => (
                                <option key={t} value={t}>Palier {t}</option>
                            ))}
                        </select>
                        {globalTier !== guildDefaultTier && (
                            <span className="text-caption text-muted-foreground italic">Défaut guilde : {guildDefaultTier}</span>
                        )}
                        <GuidePulse description="Définit le nombre total de points requis par la guilde cette semaine pour débloquer les récompenses." />
                    </div>

                    {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
                </div>

                <div className="flex items-center gap-2 p-1 bg-black/40 border border-border rounded-xl shadow-inner backdrop-blur-md">
                    <div data-tour="admin-missions-bonus">
                        <BonusMenuButton guildId={guildId} />
                    </div>
                    
                    <div className="w-px h-6 bg-surface mx-1" />

                    {/* Guild Hall Config Button */}
                    <button
                        type="button"
                        onClick={() => setHallPanelOpen(v => !v)}
                        className={cn(
                            "h-9 px-3 flex items-center gap-1.5 rounded-lg text-xs font-bold transition-all",
                            hallPanelOpen
                                ? "bg-info/20 text-info border border-info/30"
                                : "text-muted-foreground hover:text-info hover:bg-info/10"
                        )}
                    >
                        <Home className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Hall</span>
                        {(hallPosX !== null && hallPosY !== null) && (
                            <span className="w-1.5 h-1.5 rounded-full bg-info animate-pulse" />
                        )}
                    </button>

                    <div className="w-px h-6 bg-surface mx-1" />

                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-9 px-3 text-muted-foreground hover:text-danger hover:bg-danger/10"
                        onClick={handleResetWeek}
                        disabled={isResetting || isLoading}
                    >
                        {isResetting ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                            <Trash2 className="w-4 h-4 mr-2" />
                        )}
                        <span className="hidden sm:inline">Reset Semaine</span>
                    </Button>

                    <div className="w-px h-6 bg-surface mx-1" />

                    {(() => {
                        const isPoolPublished = missionPool === 'CLASSIQUES' ? publishedState.classiques : publishedState.speciales;
                        return (
                            <Button 
                                onClick={() => setConfirmPublishOpen(true)} 
                                variant="sigil" 
                                className="h-9 px-6 shadow-lg shadow-indigo-500/20 font-bold" 
                                size="sm"
                                disabled={isLoading}
                            >
                                {isPoolPublished ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-2" />
                                        METTRE À JOUR
                                    </>
                                ) : (
                                    <>
                                        <Send className="w-4 h-4 mr-2" />
                                        TOUT PUBLIER
                                    </>
                                )}
                            </Button>
                        );
                    })()}
                </div>
            </div>

            {/* Guild Hall Config Panel */}
            {hallPanelOpen && (
                <div className="border border-info/20 bg-info/5 backdrop-blur-md rounded-2xl p-5 space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-info/10 border border-info/20">
                                <Home className="w-4 h-4 text-info" />
                            </div>
                            <div>
                                <p className="text-sm font-black text-foreground">Hall de Guilde</p>
                                <p className="text-caption text-muted-foreground">Position du point de ralliement visible par tous les membres.</p>
                            </div>
                        </div>
                        <button onClick={() => setHallPanelOpen(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-surface transition-all">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                        <div>
                            <label className="text-caption font-black text-info uppercase tracking-wider block mb-1">Position X</label>
                            <input
                                type="number"
                                value={hallPosX ?? ""}
                                onChange={(e) => setHallPosX(e.target.value ? Number(e.target.value) : null)}
                                placeholder="Ex: -3"
                                className="w-full bg-background/60 border border-border hover:border-info/30 focus:border-info rounded-xl px-3 py-2 text-sm font-bold text-foreground text-center outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-caption font-black text-info uppercase tracking-wider block mb-1">Position Y</label>
                            <input
                                type="number"
                                value={hallPosY ?? ""}
                                onChange={(e) => setHallPosY(e.target.value ? Number(e.target.value) : null)}
                                placeholder="Ex: -56"
                                className="w-full bg-background/60 border border-border hover:border-info/30 focus:border-info rounded-xl px-3 py-2 text-sm font-bold text-foreground text-center outline-none transition-all"
                            />
                        </div>
                        <div>
                            <label className="text-caption font-black text-info uppercase tracking-wider block mb-1">Monde</label>
                            <div className="relative">
                                <select
                                    value={hallWorldId}
                                    onChange={(e) => setHallWorldId(Number(e.target.value))}
                                    className="w-full bg-background/60 border border-border hover:border-info/30 focus:border-info rounded-xl pl-3 pr-7 py-2 text-caption font-bold text-foreground outline-none appearance-none transition-all cursor-pointer"
                                >
                                    {DOFUS_WORLDS.map(w => (
                                        <option key={w.id} value={w.id} className="bg-background text-foreground text-xs">{w.name}</option>
                                    ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground pointer-events-none" />
                            </div>
                        </div>
                    </div>

                    {hallPosX !== null && hallPosY !== null && (
                        <p className="text-caption text-info/70 font-mono text-center">
                            /travel {hallPosX} {hallPosY}
                        </p>
                    )}

                    <div className="flex justify-end">
                        <Button
                            size="sm"
                            disabled={isSavingHall}
                            onClick={async () => {
                                setIsSavingHall(true);
                                const res = await updateGuildHallConfig(guildId, {
                                    posX: hallPosX,
                                    posY: hallPosY,
                                    worldId: hallWorldId
                                });
                                setIsSavingHall(false);
                                if (res.success) {
                                    toast.success("Hall de Guilde configuré !");
                                    setHallPanelOpen(false);
                                } else {
                                    toast.error(res.error || "Erreur");
                                }
                            }}
                            className="px-6 bg-info hover:bg-info text-info-foreground font-bold rounded-xl transition-all shadow-lg shadow-cyan-500/20"
                        >
                            {isSavingHall ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            Sauvegarder
                        </Button>
                    </div>
                </div>
            )}

            {/* Pool Toggle — Dofus 3.5 Classiques / Spéciales */}
            <div className="flex items-center gap-3 flex-wrap w-full">
                <div className="flex items-center gap-1 p-1 bg-black/60 backdrop-blur-md border border-border rounded-2xl sm:rounded-full shadow-lg flex-wrap sm:flex-nowrap w-full sm:w-auto">
                    {(['CLASSIQUES', 'SPECIALES'] as MissionPool[]).map(pool => {
                        const isActive = missionPool === pool;
                        const count = pool === 'CLASSIQUES' ? missions.slice(0, 12).filter(m => m.title).length : missions.slice(12, 20).filter(m => m.title).length;
                        const total = pool === 'CLASSIQUES' ? 12 : 8;
                        return (
                            <button
                                key={pool}
                                onClick={() => setMissionPool(pool)}
                                className={cn(
                                    "flex-1 sm:flex-none relative flex items-center justify-center gap-1.5 sm:gap-2 px-2 py-2 sm:px-5 text-caption sm:text-xs font-black rounded-full transition-all duration-300 uppercase tracking-widest min-w-0",
                                    isActive
                                        ? pool === 'CLASSIQUES'
                                            ? "bg-info text-info-foreground "
                                            : "bg-warning text-warning-foreground "
                                        : "text-muted-foreground hover:text-foreground hover:bg-surface"
                                )}
                            >
                                {pool === 'CLASSIQUES' ? <Swords className="w-3.5 h-3.5" /> : <Sparkles className="w-3.5 h-3.5" />}
                                {pool}
                                <span className={cn(
                                    "text-caption font-black px-1.5 py-0.5 rounded-full min-w-[18px] text-center",
                                    isActive
                                        ? pool === 'CLASSIQUES' ? "bg-elevated text-foreground" : "bg-muted/20 text-foreground"
                                        : "bg-muted text-foreground"
                                )}>
                                    {count}/{total}
                                </span>
                            </button>
                        );
                    })}
                </div>
                {missionPool === 'SPECIALES' && (
                    <span className="text-caption text-warning/70 font-medium hidden sm:flex items-center gap-1">
                        <Sparkles className="w-3 h-3" /> Missions spéciales — jusqu'à 8 missions (Dofus 3.5)
                    </span>
                )}
                {isLoading && <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />}
            </div>

            {/* Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {poolMissions.map((mission) => {
                    const isEmpty = !mission.title;
                    const config = CATEGORY_CONFIG[mission.category] || CATEGORY_CONFIG.DONJON;
                    const CategoryIcon = config.icon || Swords;
                    const borderColor = isEmpty ? "border-border" : config.borderColor;
                    const glowColor = isEmpty ? "rgba(255,255,255,0.1)" : config.glowColor;
                    const badgeStyle = isEmpty ? "" : `${config.color} ${config.borderColor} ${config.bgColor}`;

                    const getPayloadPreview = (category: MissionCategoryType, payload: Record<string, any>): React.ReactNode => {
                        if (!payload || Object.keys(payload).length === 0) return null;
                        switch (category) {
                            case 'DONJON': {
                                const name = payload.dungeonName;
                                const boss = payload.bossName;
                                return name ? (
                                    <span className="text-violet-300 font-medium truncate">
                                        🏰 {name}{boss && boss !== name ? <span className="text-muted-foreground font-normal"> · {boss}</span> : null}
                                    </span>
                                ) : null;
                            }
                            case 'ANOMALIE': {
                                const typeLabel = payload.type === 'BOSS' ? '🐉 Gardien' : payload.type === 'ZONE' ? '⚔️ Zone' : (payload.type || 'Anomalie');
                                const level = payload.levelRange ? `Niv. ${payload.levelRange}` : null;
                                return <span className="text-fuchsia-300 font-medium truncate">⚡ {[typeLabel, level].filter(Boolean).join(' · ')}</span>;
                            }
                            case 'REGULATION': {
                                const zone = payload.zoneName;
                                const monster = payload.monsterName || payload.familyName;
                                const count = payload.targetCount ? `x${payload.targetCount}` : null;
                                return <span className="text-warning font-medium truncate">⚔️ {[count, monster, zone].filter(Boolean).join(' · ')}</span>;
                            }
                            case 'SONGES': {
                                const diff = payload.difficulty;
                                const lvl = payload.level ? `Niv. ${payload.level}` : null;
                                return <span className="text-info font-medium truncate">🌙 {[diff, lvl].filter(Boolean).join(' ')}</span>;
                            }
                            case 'EXPEDITION': {
                                const name = payload.dungeonName;
                                const modeLabels: Record<string, string> = { bravoure: 'Bravoure', audace: 'Audace', aucun: 'Sans modif.' };
                                const mode = payload.mode ? modeLabels[payload.mode] || payload.mode : null;
                                return <span className="text-success font-medium truncate">⏱️ {[name, mode].filter(Boolean).join(' · ')}</span>;
                            }
                            case 'EVENT': {
                                if (payload.eventType === 'FRAGMENTS_ANOMALIE') {
                                    return <span className="text-fuchsia-300 font-medium">⚡ 20 Fragments d'anomalie</span>;
                                }
                                const desc = payload.description || payload.officialObjectiveText;
                                if (desc) {
                                    return <span className="text-warning truncate font-medium">📜 {desc}</span>;
                                }
                                return null;
                            }
                            default: {
                                const text = payload.officialObjectiveText || payload.description;
                                if (text) return <span className="text-muted-foreground truncate">{text}</span>;
                                const first = Object.values(payload).find(v => v && typeof v === 'string');
                                return first ? <span className="text-muted-foreground truncate">{String(first)}</span> : null;
                            }
                        }
                    };
                    const payloadPreview = mission.title ? getPayloadPreview(mission.category, mission.payload) : null;
                    const imageUrl = mission.payload?.imageUrl 
                        || (mission.payload?.monsterId ? `/uploads/assets-dofus/monsters/${mission.payload.monsterId}.webp` : null)
                        || (mission.category === 'ANOMALIE' ? '/assets/missions/ano1.png' : null)
                        || (mission.category === 'SONGES' ? '/assets/missions/songes.png' : null);

                    return (
                        <Card
                            key={mission.slotIndex}
                            className={cn(
                                "relative group transition-all duration-300 flex flex-col h-full",
                                "bg-surface shadow-xl",
                                isEmpty
                                    ? "bg-background/50 border-border/60 border-dashed hover:bg-surface/80"
                                    : cn("border ", borderColor)
                            )}
                            style={{ "--glow-color": glowColor } as React.CSSProperties}
                        >
                            <CardHeader className="p-3.5 flex flex-row items-center justify-between pb-2 space-y-0 relative z-10">
                                <div className="flex items-center gap-2">
                                    <span className={cn(
                                        "text-caption font-black px-1.5 py-0.5 rounded transition-colors",
                                        isEmpty ? "bg-elevated text-muted-foreground" : "bg-surface text-foreground border border-border"
                                    )}>
                                        #{mission.slotIndex + 1}
                                    </span>
                                    <Badge variant="outline" className={cn("text-caption h-5 px-1.5 transition-colors uppercase tracking-tight", badgeStyle)}>
                                        {mission.category}
                                    </Badge>
                                </div>
                                <div className="flex items-center gap-1 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-6 w-6 hover:bg-surface"
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
                                        <Save className="w-3.5 h-3.5 text-info" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 hover:bg-surface" onClick={() => handleResetSingle(mission.slotIndex)} title="Effacer">
                                        <Trash2 className="w-3.5 h-3.5 text-danger" />
                                    </Button>
                                </div>
                            </CardHeader>

                            <CardContent className="p-3.5 pt-1 cursor-pointer flex-grow relative z-10" onClick={() => setEditingSlot(mission.slotIndex)}>
                                <div className="h-full flex flex-col justify-between gap-2.5">
                                    {isEmpty ? (
                                        <div className="flex flex-col items-center justify-center py-6 gap-2">
                                            <div className="w-10 h-10 rounded-xl bg-surface/50 border border-border flex items-center justify-center group-hover:scale-105 transition-transform duration-200 shadow-inner">
                                                <Edit2 className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                                            </div>
                                            <span className="text-[11px] font-black uppercase tracking-wider text-muted-foreground group-hover:text-foreground transition-colors">Configurer</span>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-start gap-3">
                                                {/* Asset Thumbnail */}
                                                <div className={cn(
                                                    "w-12 h-12 rounded-xl border shrink-0 overflow-hidden flex items-center justify-center relative bg-background/60 shadow-sm transition-transform duration-200 group-hover:scale-105",
                                                    config.borderColor
                                                )}>
                                                    {imageUrl ? (
                                                        <img
                                                            src={imageUrl}
                                                            alt={mission.title}
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => {
                                                                (e.target as HTMLElement).style.display = 'none';
                                                            }}
                                                        />
                                                    ) : (
                                                        <div className={cn("w-full h-full flex items-center justify-center", config.bgColor)}>
                                                            <CategoryIcon className={cn("w-6 h-6", config.color)} />
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Title & Badges */}
                                                <div className="flex-1 min-w-0">
                                                    <h4 className="text-sm font-bold text-foreground truncate leading-snug group-hover:text-primary transition-colors" title={mission.title}>
                                                        {mission.title}
                                                    </h4>
                                                    <div className="flex items-center flex-wrap gap-1.5 mt-1">
                                                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 font-bold font-mono border-border bg-background/50">
                                                            R{mission.rank}
                                                        </Badge>
                                                        <span className="text-[11px] font-bold text-info">
                                                            {mission.xpReward} XP
                                                        </span>
                                                        {mission.guildatonsReward > 0 && (
                                                            <span className="text-[11px] font-bold text-warning">
                                                                · {mission.guildatonsReward} 🪙
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>

                                            {payloadPreview && (
                                                <div className="mt-auto flex items-center gap-1.5 text-[11px] px-2.5 py-1 bg-black/40 rounded-md border border-border/80 group-hover:border-border transition-colors truncate">
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
                <DialogContent className="bg-surface border-border text-foreground sm:max-w-4xl lg:max-w-5xl shadow-2xl max-h-[92vh] flex flex-col p-6 overflow-hidden">
                    <DialogHeader className="shrink-0 pb-3 border-b border-border/60">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <DialogTitle className="text-xl font-black flex items-center gap-2">
                                {editingSlot !== null && editingSlot >= 12
                                    ? <><Sparkles className="w-5 h-5 text-warning" /> Éditer Slot Spécial #{editingSlot - 11}</>
                                    : <>Éditer Slot #{editingSlot !== null ? editingSlot + 1 : ''}</>}
                                {currentMission?.payload?.officialMissionId && (
                                    <Badge variant="outline" className="text-caption py-0.5 px-2 border-warning/40 text-warning bg-warning/10 font-bold ml-2">
                                        ⚡ Officiel Dofus (#{currentMission.payload.officialMissionId})
                                    </Badge>
                                )}
                            </DialogTitle>

                            {/* Bascule Mode Catalogue vs Personnalisé */}
                            <div className="flex items-center gap-1 bg-background/80 p-1 rounded-xl border border-border shrink-0 self-start sm:self-auto">
                                <button
                                    type="button"
                                    onClick={() => setEditorMode('CATALOG')}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
                                        editorMode === 'CATALOG'
                                            ? "bg-warning/20 border border-warning/40 text-warning shadow-sm font-black"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Sparkles className="w-3.5 h-3.5" /> Catalogue Officiel (468)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setEditorMode('CUSTOM')}
                                    className={cn(
                                        "px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5",
                                        editorMode === 'CUSTOM'
                                            ? "bg-muted text-foreground border border-border/80 font-black"
                                            : "text-muted-foreground hover:text-foreground"
                                    )}
                                >
                                    <Edit2 className="w-3.5 h-3.5" /> Personnalisé
                                </button>
                            </div>
                        </div>
                    </DialogHeader>

                    {currentMission && (
                        <div className="flex-1 overflow-hidden py-3">
                            {/* Grille 2 colonnes sans scrollbar parent qui bloque */}
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 h-full items-start">
                                {/* COLONNE GAUCHE (5 cols) : Paramètres clés + Live Preview */}
                                <div className="lg:col-span-5 space-y-4 bg-background/40 p-4 rounded-2xl border border-border h-full flex flex-col justify-between overflow-y-auto max-h-[500px]">
                                    <div className="space-y-3.5">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                                Configuration du Slot
                                            </h3>
                                            <span className="text-[10px] text-muted-foreground font-mono">
                                                Slot #{currentMission.slotIndex + 1}
                                            </span>
                                        </div>

                                        {/* Catégorie */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Catégorie</label>
                                            <select
                                                className="h-9 w-full rounded-xl border border-border bg-background px-3 py-1 text-xs text-foreground outline-none focus:ring-2 focus:ring-ring/50 font-medium"
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

                                        {/* Rang (Difficulté 1 à 5) */}
                                        <div className="space-y-1.5">
                                            <label className="text-[11px] font-black uppercase tracking-widest text-muted-foreground">Rang (Difficulté)</label>
                                            <div className="grid grid-cols-5 gap-1.5">
                                                {[1, 2, 3, 4, 5].map(r => (
                                                    <button
                                                        key={r}
                                                        type="button"
                                                        onClick={() => updateMission(currentMission.slotIndex, { rank: r })}
                                                        className={cn(
                                                            "py-1.5 text-xs font-bold rounded-xl border transition-all text-center",
                                                            currentMission.rank === r
                                                                ? "bg-warning/20 border-warning text-warning shadow-sm"
                                                                : "bg-background border-border text-muted-foreground hover:text-foreground"
                                                        )}
                                                    >
                                                        R{r}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* XP & Guildatons */}
                                        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/50">
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-cyan-400">XP Guilde</label>
                                                <input
                                                    type="number"
                                                    className="h-9 w-full rounded-xl border border-border bg-background px-3 py-1 text-xs text-foreground font-mono font-bold outline-none focus:ring-2 focus:ring-cyan-500/30"
                                                    value={currentMission.xpReward}
                                                    onChange={(e) => updateMission(currentMission.slotIndex, { xpReward: parseInt(e.target.value) || 0 })}
                                                />
                                            </div>
                                            <div className="space-y-1.5">
                                                <label className="text-[11px] font-black uppercase tracking-widest text-amber-400">Guildatons</label>
                                                <input
                                                    type="number"
                                                    className="h-9 w-full rounded-xl border border-border bg-background px-3 py-1 text-xs text-foreground font-mono font-bold outline-none focus:ring-2 focus:ring-amber-500/30"
                                                    value={currentMission.guildatonsReward}
                                                    onChange={(e) => updateMission(currentMission.slotIndex, { guildatonsReward: parseInt(e.target.value) || 0 })}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Aperçu en direct (Live Preview) */}
                                    <div className="pt-3 border-t border-border/50">
                                        <MissionLivePreview
                                            category={currentMission.category}
                                            rank={currentMission.rank}
                                            title={currentMission.title}
                                            xpReward={currentMission.xpReward}
                                            guildatonsReward={currentMission.guildatonsReward}
                                            payload={currentMission.payload}
                                        />
                                    </div>
                                </div>

                                {/* COLONNE DROITE (7 cols) : Soit Catalogue Inline, Soit Formulaire Personnalisé */}
                                <div className="lg:col-span-7 bg-background/30 p-4 rounded-2xl border border-border h-full overflow-hidden flex flex-col justify-between">
                                    {editorMode === 'CATALOG' ? (
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                                    <Sparkles className="w-3.5 h-3.5 text-warning" />
                                                    Sélectionner parmi les 468 missions officielles
                                                </h3>
                                                <span className="text-[10px] text-muted-foreground font-mono">
                                                    Dofus Unity
                                                </span>
                                            </div>

                                            {/* Navigateur de Catalogue INLINE */}
                                            <MissionOfficialSearch
                                                currentCategory={currentMission.category}
                                                selectedMissionId={currentMission.payload?.officialMissionId}
                                                onSelectMission={(official) => {
                                                    const mapped = mapOfficialToDraftMission(official);
                                                    updateMission(currentMission.slotIndex, mapped);
                                                    toast.success(`Mission sélectionnée : ${official.title}`);
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div className="space-y-4 overflow-y-auto max-h-[480px] pr-1">
                                            <h3 className="text-xs font-black uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                                                <span>Configuration Manuelle</span>
                                                <span className="text-[10px] text-muted-foreground font-normal">
                                                    Créez votre objectif sur-mesure
                                                </span>
                                            </h3>

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
                                                <>
                                                    <div className="flex items-center gap-2 mb-4 bg-elevated/30 rounded-xl p-1">
                                                        <button
                                                            type="button"
                                                            onClick={() => updateMission(currentMission.slotIndex, { 
                                                                payload: { difficulty: 'Paradoxe', level: 'I', tier: 2 },
                                                                title: ''
                                                            })}
                                                            className={cn(
                                                                "flex-1 py-2 rounded-lg text-caption font-black uppercase tracking-wider transition-all",
                                                                !currentMission.payload?.epreuve
                                                                    ? "bg-info/20 text-info border border-info/30"
                                                                    : "text-muted-foreground hover:text-foreground"
                                                            )}
                                                        >
                                                            Songes Classiques
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateMission(currentMission.slotIndex, { 
                                                                payload: { epreuve: 'Fonsocac' },
                                                                title: ''
                                                            })}
                                                            className={cn(
                                                                "flex-1 py-2 rounded-lg text-caption font-black uppercase tracking-wider transition-all",
                                                                currentMission.payload?.epreuve
                                                                    ? "bg-info/20 text-info border border-info/30"
                                                                    : "text-muted-foreground hover:text-foreground"
                                                            )}
                                                        >
                                                            Épreuve Songe
                                                        </button>
                                                    </div>
                                                    {currentMission.payload?.epreuve ? (
                                                        <SongesEpreuveForm
                                                            payload={currentMission.payload}
                                                            onPayloadChange={(payload) => updateMission(currentMission.slotIndex, { payload })}
                                                            onTitleChange={(title) => updateMission(currentMission.slotIndex, { title })}
                                                        />
                                                    ) : (
                                                        <SongesForm
                                                            payload={currentMission.payload}
                                                            onPayloadChange={(payload) => updateMission(currentMission.slotIndex, { payload })}
                                                            onTitleChange={(title) => updateMission(currentMission.slotIndex, { title })}
                                                            onRankChange={(rank) => updateMission(currentMission.slotIndex, { rank })}
                                                        />
                                                    )}
                                                </>
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
                                                    onRankChange={(rank) => updateMission(currentMission.slotIndex, { rank })}
                                                />
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter className="shrink-0 gap-2 flex-col sm:flex-row items-center pt-3 border-t border-border">
                        {currentMission && (() => {
                            const err = validateMission(currentMission);
                            return err ? (
                                <p className="flex-1 text-xs text-danger font-medium flex items-center gap-1.5 mr-auto">
                                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-danger shrink-0" />
                                    {err}
                                </p>
                            ) : null;
                        })()}
                        <Button variant="ghost" onClick={() => setEditingSlot(null)} className="text-muted-foreground hover:text-foreground">Annuler</Button>
                        <Button
                            onClick={() => currentMission && handleSaveFromDialog(currentMission.slotIndex)}
                            disabled={!!currentMission && !!validateMission(currentMission)}
                            variant="sigil"
                            className="h-10 px-8"
                        >
                            Enregistrer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <MissionPublishFlowDialog
                isOpen={confirmPublishOpen}
                onOpenChange={setConfirmPublishOpen}
                guildId={guildId}
                missionPool={missionPool}
                missionsCount={poolMissions.filter(m => m.title).length}
                onConfirm={handleGlobalPublish}
                isDiscordConfigured={isDiscordConfigured}
                isRepublish={missionPool === 'CLASSIQUES' ? publishedState.classiques : publishedState.speciales}
            />
        </div >
    );
}
