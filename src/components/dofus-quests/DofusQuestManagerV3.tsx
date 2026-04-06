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
}

type ViewMode = "successes" | "list" | "tree" | "heatmap";

export function DofusQuestManagerV3({ 
    guildId, 
    dofus, 
    chains, 
    dofusColor, 
    heatmapData,
    selectedCharacter = "PRINCIPAL"
}: DofusQuestManagerV3Props) {
    const [viewMode, setViewMode] = useState<ViewMode>("successes");
    const [synergy, setSynergy] = useState<Record<string, MemberOnQuest[]>>({});
    const [loadingSynergy, setLoadingSynergy] = useState(false);
    
    // ── Optimistic State ───────────────────────────────────────────────────
    const [localOverrides, setLocalOverrides] = useState<Map<string, DofusQuestStatus>>(new Map());
    const router = useRouter();
    const [, startTransition] = useTransition();

    // Re-sync local overrides if chains prop changes from server (refresh)
    useEffect(() => {
        setLocalOverrides(new Map());
    }, [chains]);

    // Computed shared completed IDs
    const completedIds = useMemo(() => {
        const ids = new Set<string>();
        chains.forEach(c => {
            (c?.entries || []).forEach((e: any) => {
                const override = localOverrides.get(e.id);
                const status = override ?? e.status;
                if (status === "COMPLETED") {
                    ids.add(e.id); // Internal UUID
                    if (e.dofusdbId) ids.add(String(e.dofusdbId)); // Official ID
                }
            });
        });
        return ids;
    }, [chains, localOverrides]);

    async function handleToggleStatus(questId: string, newStatus: DofusQuestStatus) {
        // 1. Optimistic Update
        setLocalOverrides(prev => {
            const next = new Map(prev);
            next.set(questId, newStatus);
            return next;
        });

        // 2. Server Action
        startTransition(async () => {
            const res = await toggleQuestStatus(guildId, questId, newStatus, selectedCharacter);
            if (res.success) {
                toast.success("Progression mise à jour");
                router.refresh(); // This will eventually trigger useEffect above to clear overrides
            } else {
                toast.error(res.error || "Erreur lors de la mise à jour");
                // Rollback
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dofus.id, guildId]);

    const totalMembers = Object.values(synergy).reduce((acc, members) => {
        members.forEach(m => acc.add(m.profileId));
        return acc;
    }, new Set()).size;

    const views: { id: ViewMode; label: string; Icon: any }[] = [
        { id: "successes", label: "Succès",       Icon: LayoutGrid },
        { id: "list",      label: "Liste",         Icon: LayoutList },
        { id: "tree",      label: "Parcours",     Icon: Route },
        { id: "heatmap",   label: "Guilde",        Icon: Flame },
    ];

    return (
        <div className="space-y-4">
            {/* Global Logistics Summary — reactive to completedIds if we want, but for now prop-based */}
            <DofusGlobalLogistics chains={chains} dofusColor={dofus.color} completedIds={completedIds} />

            {/* ── Toolbar ─────────────────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-3 bg-zinc-900/40 border border-white/5 rounded-2xl backdrop-blur-sm mb-8">
                <div className="flex items-center gap-3">
                    <div className="flex p-1 bg-zinc-950/60 rounded-xl border border-white/5">
                        {views.map(({ id, label, Icon }) => (
                            <Button
                                key={id}
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewMode(id)}
                                className={`h-8 px-3 text-[10px] font-black uppercase tracking-widest italic rounded-lg transition-all ${
                                    viewMode === id
                                        ? "bg-white text-black shadow-[0_0_15px_rgba(255,255,255,0.2)]"
                                        : "text-zinc-500 hover:text-white"
                                }`}
                            >
                                <Icon className="w-3.5 h-3.5 mr-1.5" />{label}
                                {id === "heatmap" && heatmapData && heatmapData.members.length > 0 && (
                                    <span className="ml-1.5 px-1.5 py-0.5 rounded-full text-[8px] font-black bg-indigo-500/20 text-indigo-300">
                                        {heatmapData.members.length}
                                    </span>
                                )}
                            </Button>
                        ))}
                    </div>

                    {totalMembers > 0 && (
                        <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-indigo-500/5 border border-indigo-500/10 rounded-xl">
                            <Users className="w-3.5 h-3.5 text-indigo-400" />
                            <span className="text-[10px] font-black text-indigo-400/80 uppercase italic">
                                {totalMembers} membre{totalMembers > 1 ? "s" : ""} actif{totalMembers > 1 ? "s" : ""}
                            </span>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-4">
                    <Button
                        variant="ghost" size="sm"
                        onClick={loadSynergy} disabled={loadingSynergy}
                        className="h-8 px-3 bg-zinc-950/40 border border-white/5 text-zinc-500 hover:text-white rounded-xl"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loadingSynergy ? "animate-spin" : ""}`} />
                    </Button>
                    <div className="h-8 px-3 bg-zinc-950/40 border border-emerald-500/20 rounded-xl flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-[10px] font-black text-emerald-500/80 uppercase italic">Sigil-IA</span>
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
                {viewMode === "list" && (
                    <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-6">
                        <QuestChecklist 
                            chains={chains} 
                            guildId={guildId} 
                            dofusColor={dofusColor} 
                            completedIds={completedIds}
                            onToggle={handleToggleStatus}
                        />
                    </div>
                )}
                {viewMode === "heatmap" && (
                    <div
                        className="rounded-2xl p-5"
                        style={{
                            background: "rgba(0,0,0,0.2)",
                            border: "1px solid rgba(255,255,255,0.06)",
                        }}
                    >
                        {heatmapData ? (
                            <GuildDofusHeatmap
                                data={heatmapData}
                                dofusColor={dofusColor}
                                dofusName={dofus.nameShort || dofus.name}
                            />
                        ) : (
                            <div className="flex flex-col items-center justify-center py-16 gap-3">
                                <Flame className="w-10 h-10 text-white/10" />
                                <p className="text-white/25 text-sm font-bold uppercase tracking-widest">Données indisponibles</p>
                                <p className="text-white/15 text-xs text-center max-w-xs">
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
