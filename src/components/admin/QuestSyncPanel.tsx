"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { 
    RefreshCw, 
    CheckSquare, 
    Square, 
    ArrowRight, 
    Loader2, 
    CheckCircle2, 
    AlertTriangle,
    Database,
    Sparkles
} from "lucide-react";
import { checkDofusDbDeltas, syncDeltas, type QuestDelta } from "@/server/actions/game-quest-sync-actions";
import { Badge } from "@/components/ui/badge";

export default function QuestSyncPanel() {
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [checked, setChecked] = useState(false);
    const [stats, setStats] = useState<{
        totalLocal: number;
        totalRemote: number;
        deltas: QuestDelta[];
    } | null>(null);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);

    async function handleCheckDeltas() {
        setLoading(true);
        try {
            const res = await checkDofusDbDeltas();
            if (res.success && res.data) {
                setStats(res.data);
                setChecked(true);
                // Pre-select all deltas
                setSelectedIds(res.data.deltas.map(d => d.dofusDbId));
                toast.success("Analyse des modifications DofusDB terminée !");
            } else {
                toast.error(res.error || "Erreur lors de la vérification");
            }
        } catch (e: any) {
            toast.error(e.message || "Erreur de connexion");
        } finally {
            setLoading(false);
        }
    }

    async function handleSync() {
        if (selectedIds.length === 0) {
            toast.error("Veuillez sélectionner au moins une quête à synchroniser.");
            return;
        }

        setSyncing(true);
        try {
            const res = await syncDeltas(selectedIds);
            if (res.success) {
                toast.success(`${res.count} quêtes synchronisées avec succès !`);
                // Re-run checking to clear synced deltas
                await handleCheckDeltas();
            } else {
                toast.error(res.error || "Erreur lors de la synchronisation");
            }
        } catch (e: any) {
            toast.error(e.message || "Erreur de connexion");
        } finally {
            setSyncing(false);
        }
    }

    function toggleSelectAll() {
        if (!stats) return;
        if (selectedIds.length === stats.deltas.length) {
            setSelectedIds([]);
        } else {
            setSelectedIds(stats.deltas.map(d => d.dofusDbId));
        }
    }

    function toggleSelect(id: number) {
        setSelectedIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    }

    return (
        <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-md space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Database className="w-5 h-5 text-indigo-400" />
                        Synchronisation DofusDB Quêtes
                    </h3>
                    <p className="text-xs text-slate-400">
                        Détectez et synchronisez en temps réel les nouveautés et les modifications de DofusDB.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleCheckDeltas}
                        disabled={loading || syncing}
                        variant="outline"
                        className="border-indigo-500/20 text-indigo-300 hover:bg-indigo-500/10 font-semibold"
                    >
                        {loading ? (
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        ) : (
                            <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Vérifier les modifications
                    </Button>
                </div>
            </div>

            {stats && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl space-y-1">
                        <div className="text-caption uppercase font-black tracking-widest text-slate-500">Quêtes Locales</div>
                        <div className="text-2xl font-black text-white">{stats.totalLocal}</div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl space-y-1">
                        <div className="text-caption uppercase font-black tracking-widest text-slate-500">DofusDB Remote</div>
                        <div className="text-2xl font-black text-indigo-400">{stats.totalRemote}</div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl space-y-1">
                        <div className="text-caption uppercase font-black tracking-widest text-slate-500">Nouveautés détectées</div>
                        <div className="text-2xl font-black text-emerald-400">
                            {stats.deltas.filter(d => d.type === "NEW").length}
                        </div>
                    </div>
                    <div className="bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl space-y-1">
                        <div className="text-caption uppercase font-black tracking-widest text-slate-500">Modifications</div>
                        <div className="text-2xl font-black text-amber-400">
                            {stats.deltas.filter(d => d.type === "MODIFIED").length}
                        </div>
                    </div>
                </div>
            )}

            {checked && stats && stats.deltas.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 px-4 border border-dashed border-emerald-500/20 rounded-xl bg-emerald-500/5 text-center space-y-3">
                    <CheckCircle2 className="w-12 h-12 text-emerald-400" />
                    <div className="space-y-1">
                        <h4 className="font-bold text-white text-base">Base de données à jour !</h4>
                        <p className="text-xs text-slate-400 max-w-sm">
                            Toutes les quêtes locales correspondent à 100% avec les données de DofusDB.
                        </p>
                    </div>
                </div>
            )}

            {checked && stats && stats.deltas.length > 0 && (
                <div className="space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Button
                                size="sm"
                                variant="ghost"
                                onClick={toggleSelectAll}
                                className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 p-0 hover:bg-transparent"
                            >
                                {selectedIds.length === stats.deltas.length ? (
                                    <CheckSquare className="w-4 h-4 text-indigo-400" />
                                ) : (
                                    <Square className="w-4 h-4" />
                                )}
                                {selectedIds.length === stats.deltas.length ? "Tout désélectionner" : "Tout sélectionner"}
                            </Button>
                            <span className="text-xs text-slate-500">
                                ({selectedIds.length} sélectionnée{selectedIds.length > 1 ? "s" : ""})
                            </span>
                        </div>
                        <Button
                            onClick={handleSync}
                            disabled={syncing || selectedIds.length === 0}
                            size="sm"
                            className="bg-indigo-600 hover:bg-indigo-500 text-white font-bold"
                        >
                            {syncing ? (
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                                <Sparkles className="w-4 h-4 mr-2" />
                            )}
                            Synchroniser la sélection
                        </Button>
                    </div>

                    <div className="max-h-[350px] overflow-y-auto border border-slate-800 rounded-xl divide-y divide-slate-800 bg-slate-950/20 pr-1">
                        {stats.deltas.map(delta => {
                            const isSelected = selectedIds.includes(delta.dofusDbId);
                            const isNew = delta.type === "NEW";

                            return (
                                <div
                                    key={delta.dofusDbId}
                                    onClick={() => toggleSelect(delta.dofusDbId)}
                                    className={`flex items-center gap-4 p-3 hover:bg-slate-900/30 transition-colors cursor-pointer ${
                                        isSelected ? "bg-indigo-500/5" : ""
                                    }`}
                                >
                                    <div className="shrink-0 text-slate-500 hover:text-indigo-400 transition-colors">
                                        {isSelected ? (
                                            <CheckSquare className="w-4 h-4 text-indigo-400" />
                                        ) : (
                                            <Square className="w-4 h-4" />
                                        )}
                                    </div>
                                    
                                    <div className="flex-1 min-w-0 space-y-0.5">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="font-bold text-slate-200 text-sm truncate">
                                                {delta.name}
                                            </span>
                                            <Badge className="bg-slate-800 text-caption text-slate-400 border border-slate-700">
                                                ID: {delta.dofusDbId}
                                            </Badge>
                                            {delta.levelMin && (
                                                <Badge variant="outline" className="text-caption border-slate-800 text-slate-400">
                                                    Niv. {delta.levelMin}
                                                </Badge>
                                            )}
                                        </div>
                                        {!isNew && delta.localName && (
                                            <div className="flex items-center gap-2 text-xs text-amber-500/80">
                                                <AlertTriangle className="w-3 h-3 shrink-0" />
                                                <span className="truncate">Local: "{delta.localName}"</span>
                                                <ArrowRight className="w-3 h-3 shrink-0" />
                                                <span className="font-semibold text-slate-400">Restaurer</span>
                                            </div>
                                        )}
                                    </div>

                                    <div className="shrink-0">
                                        <Badge className={
                                            isNew 
                                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" 
                                                : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                        }>
                                            {isNew ? "Nouveau" : "Modifié"}
                                        </Badge>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
