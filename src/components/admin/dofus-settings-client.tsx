"use client";

import { useState, useEffect } from "react";
import { getDofusConfig, updateDofusServer } from "@/server/actions/admin-actions";
import { DOFUS_UNITY_SERVERS } from "@/lib/presentation-constants";
import { Button } from "@/components/ui/button";
import { Globe, Save, Loader2, CheckCircle2, Server } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

interface DofusSettingsClientProps {
    guildId: string;
}

export function DofusSettingsClient({ guildId }: DofusSettingsClientProps) {
    const [serverId, setServerId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        async function loadConfig() {
            const result = await getDofusConfig(guildId);
            if (result.success && result.data) {
                setServerId(result.data.dofusServerId);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const result = await updateDofusServer(guildId, serverId);
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
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header - More Compact */}
            <div className="p-5 rounded-2xl bg-zinc-900/40 border border-white/5 backdrop-blur-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
                        <Globe className="w-5 h-5 text-indigo-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">Configuration Serveur</h3>
                        <p className="text-xs text-zinc-500 italic">Définit le ladder par défaut pour la guilde.</p>
                    </div>
                </div>

                <Button
                    onClick={handleSave}
                    disabled={isSaving}
                    size="sm"
                    className="h-10 px-6 bg-indigo-500 hover:bg-indigo-600 text-white font-bold rounded-xl transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 flex items-center gap-2"
                >
                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    ENREGISTRER
                </Button>
            </div>

            {/* Compact Server Rows */}
            <div className="space-y-6">
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

                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
                                {servers.map((server) => {
                                    const isSelected = serverId === server.id.toString();
                                    return (
                                        <button
                                            key={server.id}
                                            onClick={() => setServerId(server.id.toString())}
                                            className={cn(
                                                "relative p-3 rounded-xl border transition-all duration-200 text-left flex items-center gap-3",
                                                isSelected
                                                    ? "bg-indigo-500/20 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.1)]"
                                                    : "bg-zinc-900/40 border-white/5 hover:border-white/10 hover:bg-zinc-800/40"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                                                isSelected ? "bg-indigo-500/20 text-indigo-400" : "bg-white/5 text-zinc-600"
                                            )}>
                                                <Server className="w-4 h-4" />
                                            </div>
                                            <div className="min-w-0 pr-4">
                                                <p className={cn(
                                                    "text-sm font-bold truncate tracking-tight",
                                                    isSelected ? "text-white" : "text-zinc-400"
                                                )}>
                                                    {server.name}
                                                </p>
                                                <p className="text-[9px] text-zinc-600 font-mono">ID:{server.id}</p>
                                            </div>

                                            {isSelected && (
                                                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                                                    <CheckCircle2 className="w-3 h-3 text-indigo-400" />
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

            {/* Compact Warning */}
            {!serverId && (
                <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10 flex items-center gap-3 text-amber-500/80">
                    <CheckCircle2 className="w-4 h-4 shrink-0 opacity-50" />
                    <p className="text-[10px] leading-snug">
                        Aucun serveur sélectionné. <strong>Draconiros</strong> sera utilisé par défaut.
                    </p>
                </div>
            )}
        </div>
    );
}
