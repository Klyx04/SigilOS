"use client";

import { useState, useEffect } from "react";
import { getDofusConfig, updateGuildGameConfig } from "@/server/actions/admin-actions";
import { DOFUS_UNITY_SERVERS } from "@/lib/presentation-constants";
import { GUILD_TIERS, MISSION_RANKS } from "@/lib/game-data/guild-tiers";
import { Button } from "@/components/ui/button";
import { Globe, Save, Loader2, CheckCircle2, Server, Filter, Target } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Toggle } from "@/components/ui/toggle";

interface DofusSettingsClientProps {
    guildId: string;
}

export function DofusSettingsClient({ guildId }: DofusSettingsClientProps) {
    const [serverId, setServerId] = useState<string | null>(null);
    const [missionTier, setMissionTier] = useState<number>(3);
    const [missionRanks, setMissionRanks] = useState<number[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        async function loadConfig() {
            const result = await getDofusConfig(guildId);
            if (result.success && result.data) {
                setServerId(result.data.dofusServerId);
                setMissionTier(result.data.missionTier || 3);
                setMissionRanks(result.data.missionRanks || []);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await updateGuildGameConfig(guildId, {
                serverId,
                missionRanks,
                missionTier
            });
            if (result.success) {
                toast.success("Configuration enregistrée");
            } else {
                toast.error(result.error || "Erreur lors de l'enregistrement");
            }
        } catch (error) {
            toast.error("Erreur inattendue");
        } finally {
            setIsSaving(false);
        }
    };

    const toggleRank = (rankId: number) => {
        setMissionRanks(prev =>
            prev.includes(rankId)
                ? prev.filter(r => r !== rankId)
                : [...prev, rankId].sort()
        );
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500/50" />
            </div>
        );
    }

    const categories = [
        { key: 'pionnierMono', label: 'Mono (Unity)', color: 'text-emerald-400' },
        { key: 'pionnier', label: 'Multi (Unity)', color: 'text-blue-400' },
        { key: 'monocompte', label: 'Monocompte (Classic)', color: 'text-amber-400' },
        { key: 'classique', label: 'Classique', color: 'text-zinc-400' },
        { key: 'epique', label: 'Épique', color: 'text-red-400' },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">

            {/* --- ACTION BAR --- */}
            <div className="sticky top-[140px] z-20 p-4 rounded-xl bg-zinc-900/80 border border-white/5 backdrop-blur-md flex items-center justify-between shadow-xl">
                <div className="flex items-center gap-3">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
                    </span>
                    <span className="text-sm font-medium text-zinc-300">Modifications non enregistrées</span>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    size="sm"
                    className="px-6 bg-indigo-600 hover:bg-indigo-500 text-white font-bold rounded-lg transition-all shadow-lg shadow-indigo-500/20"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    SAUVEGARDER
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* --- MISSION CONFIGURATION --- */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <Target className="w-5 h-5 text-amber-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Objectifs de Guilde</h3>
                            <p className="text-xs text-zinc-500">Définit les missions prioritaires pour vos membres.</p>
                        </div>
                    </div>

                    {/* Palier Selector */}
                    <div className="p-5 rounded-2xl bg-zinc-900/40 border border-white/5 space-y-4">
                        <label className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                            Palier Visé (Tier)
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-white/5">Hebdomadaire</span>
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                            {[1, 2, 3, 4, 5].map((tier) => {
                                const info = GUILD_TIERS[tier as keyof typeof GUILD_TIERS];
                                const isSelected = missionTier === tier;
                                return (
                                    <button
                                        key={tier}
                                        onClick={() => setMissionTier(tier)}
                                        className={cn(
                                            "flex flex-col items-center justify-center p-3 rounded-xl border transition-all h-24",
                                            isSelected
                                                ? "bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.15)]"
                                                : "bg-zinc-900/60 border-white/5 hover:bg-zinc-800 text-zinc-500 hover:text-zinc-300"
                                        )}
                                    >
                                        <span className="text-2xl font-black">{tier}</span>
                                        <span className="text-[10px] font-medium mt-1">
                                            {(info?.xpMax / 1000)}k Pts
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-zinc-500 italic mt-2">
                            Le palier détermine les récompenses (XP, Kamas) et la difficulté globale.
                        </p>
                    </div>

                    {/* Ranks Selector */}
                    <div className="p-5 rounded-2xl bg-zinc-900/40 border border-white/5 space-y-4">
                        <label className="text-sm font-semibold text-zinc-300 flex items-center gap-2">
                            Rangs Autorisés
                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded border border-white/5">Filtrage</span>
                        </label>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {[1, 2, 3, 4].map((rankId) => {
                                const rank = MISSION_RANKS[rankId as keyof typeof MISSION_RANKS];
                                const isSelected = missionRanks.includes(rankId);
                                return (
                                    <button
                                        key={rankId}
                                        onClick={() => toggleRank(rankId)}
                                        className={cn(
                                            "relative flex items-center gap-3 p-3 rounded-xl border transition-all text-left group",
                                            isSelected
                                                ? "bg-emerald-500/10 border-emerald-500/30 text-white"
                                                : "bg-zinc-900/60 border-white/5 hover:bg-zinc-800 text-zinc-500"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                            isSelected ? "bg-emerald-500/20 text-emerald-400" : "bg-white/5 text-zinc-600 group-hover:text-zinc-400"
                                        )}>
                                            <Filter className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-sm tracking-tight">{rank.label}</div>
                                            <div className="text-[10px] opacity-70">Niv. {rank.levels}</div>
                                        </div>
                                        {isSelected && <CheckCircle2 className="absolute top-2 right-2 w-3 h-3 text-emerald-500" />}
                                    </button>
                                );
                            })}
                        </div>
                        <p className="text-xs text-zinc-500 italic mt-2">
                            Sélectionnez les tranches de niveaux que votre guilde souhaite cibler.
                        </p>
                    </div>
                </div>

                {/* --- SERVER CONFIGURATION --- */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                            <Globe className="w-5 h-5 text-indigo-400" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Serveur de Jeu</h3>
                            <p className="text-xs text-zinc-500">Définit le ladder et l'économie.</p>
                        </div>
                    </div>

                    <div className="space-y-6 bg-zinc-900/40 border border-white/5 p-5 rounded-2xl">
                        {categories.map((cat) => {
                            const servers = (DOFUS_UNITY_SERVERS[cat.key as keyof typeof DOFUS_UNITY_SERVERS] as unknown as any[]) || [];
                            if (servers.length === 0) return null;

                            return (
                                <div key={cat.key} className="space-y-3">
                                    <div className="flex items-center gap-2 px-1">
                                        <span className={cn("text-[10px] font-black uppercase tracking-wider", cat.color)}>
                                            {cat.label}
                                        </span>
                                        <div className="h-px flex-1 bg-white/5" />
                                    </div>

                                    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                                        {servers.map((server) => {
                                            const isSelected = serverId === server.id.toString();
                                            return (
                                                <button
                                                    key={server.id}
                                                    onClick={() => setServerId(server.id.toString())}
                                                    className={cn(
                                                        "relative p-2.5 rounded-xl border transition-all duration-200 text-left flex items-center gap-3",
                                                        isSelected
                                                            ? "bg-indigo-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                                                            : "bg-zinc-900/40 border-white/5 hover:border-white/10 hover:bg-zinc-800/40"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-7 h-7 rounded-md flex items-center justify-center shrink-0",
                                                        isSelected ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-zinc-600"
                                                    )}>
                                                        <Server className="w-3.5 h-3.5" />
                                                    </div>
                                                    <div className="min-w-0 pr-2">
                                                        <p className={cn(
                                                            "text-xs font-bold truncate tracking-tight",
                                                            isSelected ? "text-white" : "text-zinc-400"
                                                        )}>
                                                            {server.name}
                                                        </p>
                                                        <p className="text-[9px] text-zinc-600 font-mono scale-90 origin-left">ID:{server.id}</p>
                                                    </div>

                                                    {isSelected && (
                                                        <div className="absolute right-1 top-1">
                                                            <CheckCircle2 className="w-2.5 h-2.5 text-indigo-400" />
                                                        </div>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            {/* Warning if no server */}
            {!serverId && (
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-center gap-3 text-amber-500/80 mx-auto max-w-2xl">
                    <CheckCircle2 className="w-5 h-5 shrink-0 opacity-50" />
                    <p className="text-xs leading-snug">
                        Aucun serveur sélectionné. <strong>Draconiros</strong> sera utilisé par défaut pour les fonctionnalités de ladder.
                    </p>
                </div>
            )}
        </div>
    );
}
