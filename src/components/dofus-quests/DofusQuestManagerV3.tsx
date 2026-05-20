"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { 
    getGuildSynergyForDofus, 
    toggleQuestStatus,
    MemberOnQuest,
    GuildHeatmapData,
} from "@/server/actions/dofus-quest-actions";
import { DofusNeuralTree } from "./DofusNeuralTree";
import { DofusSuccessGrid } from "./DofusSuccessGrid";
import { DofusGlobalLogistics } from "./DofusGlobalLogistics";
import { QuestChecklist } from "./QuestChecklist";
import { GuildDofusHeatmap } from "./GuildDofusHeatmap";
import { Button } from "@/components/ui/button";
import { LayoutList, RefreshCw, Users, LayoutGrid, Flame, Route, X, Skull, Flag, ExternalLink, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { DofusQuestStatus } from "@prisma/client";
import { DjPostCreateModal } from "@/components/dungeon-finder/DjPostCreateModal";
import { DungeonCreateModal } from "@/components/game-data/DungeonCreateModal";
import { motion, AnimatePresence } from "framer-motion";
const getNoobsDungeonSlug = (name: string) => {
    let clean = name.toLowerCase().trim();
    
    // Remove "donjon " prefix if it already has it to build it cleanly
    if (clean.startsWith("donjon du ")) {
      clean = clean.substring(10);
    } else if (clean.startsWith("donjon de l'")) {
      clean = clean.substring(12);
    } else if (clean.startsWith("donjon de la ")) {
      clean = clean.substring(13);
    } else if (clean.startsWith("donjon de ")) {
      clean = clean.substring(10);
    } else if (clean.startsWith("donjon d'")) {
      clean = clean.substring(9);
    } else if (clean.startsWith("donjon ")) {
      clean = clean.substring(7);
    }
    
    // Determine the best prefix
    let prefix = "donjon-de-";
    const vowels = ["a", "e", "i", "o", "u", "y", "h"];
    if (vowels.includes(clean.charAt(0))) {
      prefix = "donjon-d-";
    }
    
    const duBosses = ["kimbo", "chene mou", "skeunk", "kralamoure geant", "kralamoure", "peki peki", "bworker", "torig", "grozilla", "rasboul", "maitre corbac", "sfincter cell", "weabbit", "wa wabbit", "kardala", "koulosse", "blop", "royal", "gargoutte", "dramak", "qu Tan", "ilyzaelle", "dazak", "tal kasha", "koutoulou", "dramak", "shogun", "tanukouï san", "tengu", "korriandre", "kolosso", "glourseleste"];
    if (duBosses.some(b => clean.includes(b))) {
      prefix = "donjon-du-";
    }
    
    const rawSlug = `${prefix}${clean}`
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/['’]/g, "")
      .replace(/[^a-z0-9\s-]/g, "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
      
    return rawSlug;
};

interface DofusQuestManagerV3Props {
    guildId: string;
    dofus: any;
    chains: any[];
    dofusColor: string;
    heatmapData?: GuildHeatmapData | null;
    selectedCharacter?: string;
    initialGlobalCompletedIds?: string[];
}

type ViewMode = "tree" | "successes" | "heatmap";

export function DofusQuestManagerV3({ 
    guildId, 
    dofus, 
    chains, 
    dofusColor, 
    heatmapData,
    selectedCharacter = "PRINCIPAL",
    initialGlobalCompletedIds = []
}: DofusQuestManagerV3Props) {
    const [viewMode, setViewMode] = useState<ViewMode>("tree");
    const [synergy, setSynergy] = useState<Record<string, MemberOnQuest[]>>({});
    const [loadingSynergy, setLoadingSynergy] = useState(false);
    
    // ... existing local overrides logic
    const [localOverrides, setLocalOverrides] = useState<Map<string, DofusQuestStatus>>(new Map());
    const [createDjModal, setCreateDjModal] = useState<{ isOpen: boolean; initialDungeonId?: string; initialQuestName?: string }>({ isOpen: false });
    const [createUnpopulatedDjModal, setCreateUnpopulatedDjModal] = useState<{ isOpen: boolean; name: string; dofusdbId: number | null }>({ isOpen: false, name: "", dofusdbId: null });
    const [dungeonChoiceModal, setDungeonChoiceModal] = useState<{ isOpen: boolean; name: string; dofusdbId: number | null; dbtype: string; customUrl?: string | null; isLoadingUrl?: boolean } | null>(null);
    const [editingNoobsUrl, setEditingNoobsUrl] = useState(false);
    const [noobsUrlInput, setNoobsUrlInput] = useState("");
    const [verifyingDungeonName, setVerifyingDungeonName] = useState<string | null>(null);
    const [isAdmin, setIsAdmin] = useState(false);

    useEffect(() => {
        import("@/server/actions/user-actions").then(m => m.getUserContext(guildId)).then(ctx => {
            if (ctx?.isAdmin) {
                setIsAdmin(true);
            }
        });
    }, [guildId]);

    const handleLaunchDungeonSearch = (name: string, dofusdbIdVal: number | null) => {
        setDungeonChoiceModal(null);
        setVerifyingDungeonName(name);
        import("@/server/actions/game-data-actions").then((mod) => {
            mod.checkDungeonExists(name, dofusdbIdVal).then((res) => {
                setVerifyingDungeonName(null);
                if (res.success && res.data) {
                    if (res.data.exists && res.data.dungeon) {
                        setCreateDjModal({
                            isOpen: true,
                            initialDungeonId: res.data.dungeon.id
                        });
                    } else {
                        setCreateUnpopulatedDjModal({
                            isOpen: true,
                            name: name,
                            dofusdbId: dofusdbIdVal
                        });
                    }
                } else {
                    toast.error(res.error || "Erreur de vérification");
                }
            });
        });
    };

    const handleLaunchDofusDB = (dbid: number | null, dbtype: string) => {
        if (dbid) {
            let singularType = dbtype.endsWith("s") ? dbtype.slice(0, -1) : dbtype;
            if (singularType === "bosse" || singularType === "monster") {
                singularType = "monster";
            } else if (singularType === "resource") {
                singularType = "item";
            }
            window.open(`https://dofusdb.fr/fr/database/${singularType}/${dbid}`, "_blank");
            toast.info(`Ouverture DofusDB`);
        }
    };

    const handleDungeonClick = (name: string, dofusdbIdVal: number | null) => {
        setDungeonChoiceModal({
            isOpen: true,
            name,
            dofusdbId: dofusdbIdVal,
            dbtype: "bosses",
            isLoadingUrl: true,
            customUrl: null
        });
        setEditingNoobsUrl(false);
        setNoobsUrlInput("");

        import("@/server/actions/game-data-actions").then((mod) => {
            mod.checkDungeonExists(name, dofusdbIdVal).then((res) => {
                setDungeonChoiceModal(prev => {
                    if (!prev || prev.name !== name) return prev;
                    return {
                        ...prev,
                        isLoadingUrl: false,
                        customUrl: res.data?.dungeon?.dofuspourlesnoobsUrl || null
                    };
                });
                if (res.data?.dungeon?.dofuspourlesnoobsUrl) {
                    setNoobsUrlInput(res.data.dungeon.dofuspourlesnoobsUrl);
                } else {
                    const slug = getNoobsDungeonSlug(name);
                    setNoobsUrlInput(`https://www.dofuspourlesnoobs.com/${slug}.html`);
                }
            });
        });
    };

    const router = useRouter();
    const [, startTransition] = useTransition();

    useEffect(() => {
        setLocalOverrides(new Map());
    }, [chains]);

    const completedIds = useMemo(() => {
        // Start with ALL completed IDs from the platform
        const ids = new Set<string>(initialGlobalCompletedIds);
        
        // Apply current Dofus chains and local overrides
        chains.forEach(c => {
            (c?.entries || []).forEach((e: any) => {
                const override = localOverrides.get(e.id);
                // If override is NOT_STARTED, we must remove it if it was in the global list
                if (override === "NOT_STARTED") {
                    ids.delete(e.id);
                    if (e.dofusdbId) ids.delete(String(e.dofusdbId));
                } else if (override === "COMPLETED" || e.status === "COMPLETED") {
                    ids.add(e.id);
                    if (e.dofusdbId) ids.add(String(e.dofusdbId));
                }
            });
        });
        return ids;
    }, [chains, localOverrides, initialGlobalCompletedIds]);

    async function handleToggleStatus(questId: string, newStatus: DofusQuestStatus) {
        setLocalOverrides(prev => {
            const next = new Map(prev);
            next.set(questId, newStatus);
            return next;
        });

        startTransition(async () => {
            const res = await toggleQuestStatus(guildId, questId, newStatus, selectedCharacter);
            if (res.success) {
                router.refresh();
            } else {
                toast.error(res.error || "Erreur de mise à jour");
                setLocalOverrides(prev => {
                    const next = new Map(prev);
                    next.delete(questId);
                    return next;
                });
            }
        });
    }

    async function loadSynergy() {
        setLoadingSynergy(true);
        const res = await getGuildSynergyForDofus(guildId, dofus.id);
        if (res.success && res.data) setSynergy(res.data);
        setLoadingSynergy(false);
    }

    useEffect(() => {
        loadSynergy();
        const interval = setInterval(loadSynergy, 120000);
        return () => clearInterval(interval);
    }, [dofus.id, guildId]);

    const totalMembers = Object.values(synergy).reduce((acc, members) => {
        members.forEach(m => acc.add(m.profileId));
        return acc;
    }, new Set()).size;

    const views: { id: ViewMode; label: string; Icon: any }[] = [
        { id: "tree",      label: "Parcours",     Icon: Route },
        { id: "successes", label: "Succès",       Icon: LayoutGrid },
        { id: "heatmap",   label: "Guilde",        Icon: Flame },
    ];

    return (
        <div className="space-y-4">
            <DofusGlobalLogistics chains={chains} dofusColor={dofus.color} completedIds={completedIds} />

            <div className="flex flex-col md:flex-row items-center justify-between gap-4 p-4 bg-zinc-950/40 border border-white/5 rounded-[2rem] backdrop-blur-xl mb-8">
                <div className="flex flex-col sm:flex-row items-center gap-4 w-full md:w-auto">
                    <div className="flex p-1.5 bg-black/40 rounded-2xl border border-white/5 w-full sm:w-auto overflow-x-auto no-scrollbar">
                        {views.map(({ id, label, Icon }) => (
                            <button
                                key={id}
                                onClick={() => setViewMode(id)}
                                className={`
                                    flex-1 sm:flex-none flex items-center justify-center gap-2 h-10 px-5 text-[11px] font-black uppercase tracking-widset rounded-xl transition-all duration-300 whitespace-nowrap
                                    ${viewMode === id
                                        ? "bg-white text-black shadow-2xl scale-[1.02]"
                                        : "text-zinc-500 hover:text-white hover:bg-white/5"
                                    }
                                `}
                            >
                                <Icon className="w-4 h-4" />
                                <span>{label}</span>
                                {id === "heatmap" && heatmapData && heatmapData.members.length > 0 && (
                                    <span className={`ml-1 px-1.5 py-0.5 rounded-md text-[8px] font-black ${viewMode === id ? "bg-black/10 text-black" : "bg-indigo-500/20 text-indigo-400"}`}>
                                        {heatmapData.members.length}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 border-white/5 pt-4 md:pt-0">
                    <div className="flex items-center gap-3">
                        {totalMembers > 0 && (
                            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                <Users className="w-3.5 h-3.5 text-indigo-400" />
                                <span className="text-[9px] font-black text-indigo-400 uppercase italic">
                                    {totalMembers} ACTIF{totalMembers > 1 ? "S" : ""}
                                </span>
                            </div>
                        )}
                        <button
                            onClick={loadSynergy}
                            disabled={loadingSynergy}
                            className="p-2.5 bg-white/5 border border-white/10 text-zinc-500 hover:text-white rounded-xl transition-all hover:bg-white/10"
                        >
                            <RefreshCw className={`w-4 h-4 ${loadingSynergy ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                    
                    <div className="h-10 px-4 bg-zinc-900/60 border border-emerald-500/20 rounded-2xl flex items-center gap-2.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
                        <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest italic">Analyseur IA</span>
                    </div>
                </div>
            </div>


            {/* ── Content ──────────────────────────────────────────────── */}
            <div className="relative">
                {viewMode === "successes" && (
                    <DofusSuccessGrid
                        guildId={guildId}
                        dofus={dofus}
                        chains={chains}
                        synergy={synergy}
                        dofusColor={dofusColor}
                        onToggleStatus={handleToggleStatus}
                        completedIds={completedIds}
                        onDungeonClick={handleDungeonClick}
                    />
                )}
                {viewMode === "tree" && (
                    <DofusNeuralTree
                        guildId={guildId}
                        dofus={dofus}
                        chains={chains}
                        synergy={synergy}
                        dofusColor={dofusColor}
                        onToggleStatus={handleToggleStatus}
                        completedIds={completedIds}
                        onDungeonClick={handleDungeonClick}
                    />
                )}
                {viewMode === "heatmap" && (
                    <div className="glass-premium border border-border rounded-2xl p-5">
                        {heatmapData ? (
                            <GuildDofusHeatmap
                                data={heatmapData}
                                dofusColor={dofusColor}
                                dofusName={dofus.nameShort || dofus.name}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <Flame className="w-10 h-10 text-foreground/10" />
                                <p className="text-muted-foreground/40 text-sm font-bold uppercase tracking-widest">Données indisponibles</p>
                                <p className="text-muted-foreground/20 text-xs text-center max-w-xs">
                                    Lance le seed depuis l&apos;admin panel pour charger les étapes, puis reviens ici.
                                </p>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <DjPostCreateModal
                guildId={guildId}
                isOpen={createDjModal.isOpen}
                initialDungeonId={createDjModal.initialDungeonId}
                initialQuestName={createDjModal.initialQuestName}
                isDiscordConfigured={true}
                onClose={() => setCreateDjModal({ isOpen: false })}
                onCreated={() => {}}
            />

            <DungeonCreateModal
                guildId={guildId}
                isOpen={createUnpopulatedDjModal.isOpen}
                name={createUnpopulatedDjModal.name}
                dofusdbId={createUnpopulatedDjModal.dofusdbId}
                isAdmin={isAdmin}
                onClose={() => setCreateUnpopulatedDjModal({ isOpen: false, name: "", dofusdbId: null })}
                onCreated={(dungeonId) => {
                    setCreateDjModal({
                        isOpen: true,
                        initialDungeonId: dungeonId
                    });
                }}
            />

            {/* ── VERIFYING OVERLAY ─────────────────────────────── */}
            <AnimatePresence>
                {verifyingDungeonName && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm"
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-[#0a0d14] border border-zinc-800 rounded-3xl p-8 max-w-sm w-full flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden"
                        >
                            {/* Spinning Loader */}
                            <div className="w-16 h-16 rounded-full border-4 border-t-amber-500 border-zinc-800 animate-spin mb-6 shadow-[0_0_20px_rgba(245,158,11,0.2)]" />
                            
                            <h3 className="text-white font-black text-base uppercase tracking-wider mb-2">Vérification en cours</h3>
                            <p className="text-zinc-400 text-xs font-medium max-w-[240px]">
                                Analyse de la base de données pour le donjon :
                            </p>
                            <p className="text-amber-400 font-bold text-xs mt-1 truncate max-w-full">
                                {verifyingDungeonName}
                            </p>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ── DUNGEON CHOICE MODAL ─────────────────────────────── */}
            <AnimatePresence>
                {dungeonChoiceModal && dungeonChoiceModal.isOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                        style={{ background: "rgba(0,0,0,0.85)", backdropFilter: "blur(8px)" }}
                        onClick={() => setDungeonChoiceModal(null)}
                    >
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: 20 }}
                            transition={{ type: "spring", stiffness: 400, damping: 30 }}
                            className="w-full max-w-md bg-[#0a0d14] border border-zinc-800 rounded-3xl overflow-hidden shadow-2xl flex flex-col p-6 text-zinc-300"
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div className="flex items-center justify-between pb-4 border-b border-zinc-800/80">
                                <div className="flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center shrink-0">
                                        <Skull className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <div>
                                        <h3 className="text-white font-black text-sm">Options de Donjon</h3>
                                        <p className="text-purple-400 font-bold text-xs mt-0.5 truncate max-w-[280px]">
                                            {dungeonChoiceModal.name}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setDungeonChoiceModal(null)}
                                    className="w-8 h-8 flex items-center justify-center rounded-lg bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            {/* Description */}
                            <div className="py-6 text-zinc-400 text-xs leading-relaxed">
                                Que souhaitez-vous faire avec ce donjon ? Vous pouvez planifier une sortie de guilde ou aller voir sa fiche sur DofusDB.
                            </div>

                            {/* Choices */}
                            <div className="flex flex-col gap-3">
                                <button
                                    onClick={() => handleLaunchDungeonSearch(dungeonChoiceModal.name, dungeonChoiceModal.dofusdbId)}
                                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/20 hover:border-emerald-500/40 text-emerald-400 font-black text-sm text-left transition-all group"
                                >
                                    <div className="p-2 rounded-xl bg-emerald-500/15 border border-emerald-500/20 shrink-0 group-hover:scale-105 transition-transform">
                                        <Flag className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-white text-xs font-black">Planifier une sortie</p>
                                        <p className="text-emerald-400/70 text-[10px] font-bold mt-0.5">Ouvrir ou rejoindre un groupe d'entraide</p>
                                    </div>
                                </button>

                                {/* NOOBS TUTORIAL BUTTON */}
                                <div className="relative group">
                                    <button
                                        disabled={dungeonChoiceModal.isLoadingUrl}
                                        onClick={() => {
                                            if (dungeonChoiceModal.customUrl) {
                                                window.open(dungeonChoiceModal.customUrl, "_blank");
                                            } else {
                                                const slug = getNoobsDungeonSlug(dungeonChoiceModal.name);
                                                window.open(`https://www.dofuspourlesnoobs.com/${slug}.html`, "_blank");
                                            }
                                        }}
                                        className={`w-full flex items-center gap-3 p-4 rounded-2xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 hover:border-amber-500/40 text-amber-400 font-black text-sm text-left transition-all ${dungeonChoiceModal.isLoadingUrl ? 'opacity-50 cursor-wait' : ''}`}
                                    >
                                        <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/20 shrink-0 group-hover:scale-105 transition-transform">
                                            <BookOpen className="w-5 h-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-white text-xs font-black truncate">
                                                {dungeonChoiceModal.isLoadingUrl ? "Chargement..." : "Consulter le tutoriel Noobs"}
                                            </p>
                                            <p className="text-amber-400/70 text-[10px] font-bold mt-0.5 truncate pr-2">
                                                {dungeonChoiceModal.customUrl ? dungeonChoiceModal.customUrl.replace("https://www.dofuspourlesnoobs.com/", "") : "Guide complet illustré pas-à-pas du donjon"}
                                            </p>
                                        </div>
                                        {isAdmin && !dungeonChoiceModal.isLoadingUrl && (
                                            <div 
                                                onClick={(e) => { e.stopPropagation(); setEditingNoobsUrl(!editingNoobsUrl); }}
                                                className="p-2 rounded-lg hover:bg-amber-500/20 text-amber-500 transition-colors shrink-0"
                                            >
                                                Editer
                                            </div>
                                        )}
                                    </button>

                                    <AnimatePresence>
                                        {editingNoobsUrl && (
                                            <motion.div
                                                initial={{ height: 0, opacity: 0 }}
                                                animate={{ height: "auto", opacity: 1 }}
                                                exit={{ height: 0, opacity: 0 }}
                                                className="overflow-hidden mt-2"
                                            >
                                                <div className="p-3 bg-black/40 border border-amber-500/20 rounded-xl flex flex-col gap-2">
                                                    <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">URL / Slug Personnalisé</p>
                                                    <input 
                                                        value={noobsUrlInput}
                                                        onChange={(e) => setNoobsUrlInput(e.target.value)}
                                                        placeholder="ex: donjon-du-kimbo"
                                                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500"
                                                    />
                                                    <div className="flex justify-end gap-2 mt-1">
                                                        <button 
                                                            onClick={() => {
                                                                let url = noobsUrlInput;
                                                                if (!url.startsWith("http")) {
                                                                    url = `https://www.dofuspourlesnoobs.com/${url.replace(".html", "")}.html`;
                                                                }
                                                                window.open(url, "_blank");
                                                            }}
                                                            className="px-3 py-1.5 text-[10px] font-bold text-zinc-300 hover:text-white bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors"
                                                        >
                                                            Tester
                                                        </button>
                                                        <button 
                                                            onClick={async () => {
                                                                toast.loading("Enregistrement...", { id: "save-url" });
                                                                const mod = await import("@/server/actions/game-data-actions");
                                                                const res = await mod.updateDungeonNoobsUrl(guildId, dungeonChoiceModal.name, dungeonChoiceModal.dofusdbId, noobsUrlInput);
                                                                if (res.success) {
                                                                    toast.success("URL enregistrée !", { id: "save-url" });
                                                                    setDungeonChoiceModal(prev => prev ? { ...prev, customUrl: res.data.dofuspourlesnoobsUrl } : null);
                                                                    setEditingNoobsUrl(false);
                                                                } else {
                                                                    toast.error(res.error || "Erreur", { id: "save-url" });
                                                                }
                                                            }}
                                                            className="px-3 py-1.5 text-[10px] font-bold text-amber-900 bg-amber-500 hover:bg-amber-400 rounded-lg transition-colors"
                                                        >
                                                            Sauvegarder
                                                        </button>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

                                <button
                                    onClick={() => handleLaunchDofusDB(dungeonChoiceModal.dofusdbId, dungeonChoiceModal.dbtype)}
                                    className="w-full flex items-center gap-3 p-4 rounded-2xl bg-cyan-500/10 hover:bg-cyan-500/15 border border-cyan-500/20 hover:border-cyan-500/40 text-cyan-400 font-black text-sm text-left transition-all group"
                                >
                                    <div className="p-2 rounded-xl bg-cyan-500/15 border border-cyan-500/20 shrink-0 group-hover:scale-105 transition-transform">
                                        <ExternalLink className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <p className="text-white text-xs font-black">Consulter sur DofusDB</p>
                                        <p className="text-cyan-400/70 text-[10px] font-bold mt-0.5">Fiche et base de données officielle du boss</p>
                                    </div>
                                </button>
                            </div>

                            {/* Footer */}
                            <div className="mt-6 pt-4 border-t border-zinc-800/80 flex justify-end">
                                <button
                                    onClick={() => setDungeonChoiceModal(null)}
                                    className="px-4 py-2 rounded-xl bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 text-zinc-400 hover:text-white font-bold text-xs transition-all"
                                >
                                    Annuler
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
