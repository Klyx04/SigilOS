"use client";

import { useState, useEffect, useTransition } from "react";
import { 
    getGuildSynergyForDofus, 
    toggleQuestStatus,
    MemberOnQuest 
} from "@/server/actions/dofus-quest-actions";
import { DofusNeuralTree } from "./DofusNeuralTree";
import { DofusSuccessGrid } from "./DofusSuccessGrid";
import { DofusGlobalLogistics } from "./DofusGlobalLogistics";
import { QuestChecklist } from "./QuestChecklist";
import { Button } from "@/components/ui/button";
import { LayoutList, Network, RefreshCw, Users, LayoutGrid } from "lucide-react";
import { toast } from "sonner";

interface DofusQuestManagerV3Props {
    guildId: string;
    dofus: any;
    chains: any[];
    dofusColor: string;
}

type ViewMode = "successes" | "list" | "tree";

export function DofusQuestManagerV3({ guildId, dofus, chains, dofusColor }: DofusQuestManagerV3Props) {
    const [viewMode, setViewMode] = useState<ViewMode>("successes");
    const [synergy, setSynergy] = useState<Record<string, MemberOnQuest[]>>({});
    const [loadingSynergy, setLoadingSynergy] = useState(false);
    const [, startTransition] = useTransition();

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

    async function handleToggleStatus(questId: string, newStatus: any) {
        startTransition(async () => {
            const res = await toggleQuestStatus(guildId, questId, newStatus);
            if (res.success) {
                toast.success("Progression mise à jour");
            } else {
                toast.error(res.error || "Erreur lors de la mise à jour");
            }
        });
    }

    const totalMembers = Object.values(synergy).reduce((acc, members) => {
        members.forEach(m => acc.add(m.profileId));
        return acc;
    }, new Set()).size;

    const views: { id: ViewMode; label: string; Icon: any }[] = [
        { id: "successes", label: "Succès",       Icon: LayoutGrid },
        { id: "list",      label: "Liste",         Icon: LayoutList },
        { id: "tree",      label: "Arbre Neural",  Icon: Network },
    ];

    return (
        <div className="space-y-4">
            {/* ── Toolbar ───────────────────────────────────────────── */}
            {/* Global Logistics Summary */}
            <DofusGlobalLogistics chains={chains} dofusColor={dofus.color} />

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

            {/* ── Content ───────────────────────────────────────────── */}
            <div className="relative">
                {viewMode === "successes" && (
                    <DofusSuccessGrid
                        guildId={guildId}
                        dofus={dofus}
                        chains={chains}
                        synergy={synergy}
                        dofusColor={dofusColor}
                        onToggleStatus={handleToggleStatus}
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
                    />
                )}
                {viewMode === "list" && (
                    <div className="bg-zinc-950/40 border border-white/5 rounded-3xl p-6">
                        <QuestChecklist chains={chains} guildId={guildId} dofusColor={dofusColor} />
                    </div>
                )}
            </div>
        </div>
    );
}
