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
import { LayoutList, RefreshCw, Users, LayoutGrid, Flame, Route } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { DofusQuestStatus } from "@prisma/client";

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
        </div>
    );
}
