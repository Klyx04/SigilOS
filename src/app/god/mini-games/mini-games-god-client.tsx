"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Gamepad2, Shield, Settings, AlertTriangle, CheckCircle2, 
    Save, RefreshCw, Layers, Flag, Ban, Check, Trash2, Search, Plus, Flame, Power, MessageSquare, Map, Loader2
} from "lucide-react";
import { 
    updateMiniGameStatus, 
    updateGeoguesserConfig, 
    getMapsInfo,
    getPlatformConfig,
    deleteMapFileAndBlacklist 
} from "@/server/actions/god-mini-games-actions";
import { toast } from "sonner";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

const WORLD_NAMES: Record<number, string> = {
    1: "Monde des Douze",
    2: "Incarnam",
    3: "Souterrains",
    4: "Souterrains d'Astrub",
    19: "Mappemondes",
    29: "Ecaflip City",
    150: "Nimbos",
    156: "Dimension Divine",
    157: "Dimension Divine",
    312: "Havre-Sac",
};

interface MiniGame {
    gameId: string;
    name: string;
    color: string;
}

const GAMES: MiniGame[] = [
    { gameId: "guesser", name: "Sigil-Guesser", color: "emerald" },
    { gameId: "bomb", name: "Sigil-Bomb", color: "red" },
];

type Tab = "MAINTENANCE" | "GUESSER";

export default function MiniGamesGodClient({ 
    initialStatuses, 
    initialPlatformConfig 
}: { 
    initialStatuses: any[],
    initialPlatformConfig: any
}) {
    const searchParams = useSearchParams();
    const activeTab = (searchParams.get("sub") as Tab) || "MAINTENANCE";

    const [statuses, setStatuses] = useState(
        GAMES.map(game => {
            const status = initialStatuses.find(s => s.gameId === game.gameId);
            return {
                ...game,
                isEnabled: status?.isEnabled ?? true,
                maintenanceMsg: status?.maintenanceMsg ?? "🔧 Ce jeu est temporairement indisponible pour maintenance.",
                isSaving: false
            };
        })
    );

    // Guesser Blacklist State
    const [blacklist, setBlacklist] = useState<number[]>(initialPlatformConfig?.geoguesserBlacklist || []);
    const [reportedIds, setReportedIds] = useState<number[]>((initialPlatformConfig?.geoguesserReportedMaps as number[]) || []);
    const [mapDetails, setMapDetails] = useState<Record<number, any>>({});
    const [isLoadingDetails, setIsLoadingDetails] = useState(false);
    const [manualId, setManualId] = useState("");
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [worldFilter, setWorldFilter] = useState<string>("ALL");
    const [searchQuery, setSearchQuery] = useState("");

    const refreshDataFromServer = async () => {
        setIsRefreshing(true);
        try {
            const freshConfig = await getPlatformConfig();
            setBlacklist(freshConfig.geoguesserBlacklist || []);
            setReportedIds((freshConfig.geoguesserReportedMaps as number[]) || []);
            toast.success("Données actualisées");
        } catch (err) {
            console.error("Failed to refresh config", err);
            toast.error("Erreur lors de l'actualisation");
        } finally {
            setIsRefreshing(false);
        }
    };

    // Auto-refresh every 15s when on GUESSER tab
    useEffect(() => {
        if (activeTab !== "GUESSER") return;
        refreshDataFromServer();
        const interval = setInterval(refreshDataFromServer, 15000);
        return () => clearInterval(interval);
    }, [activeTab]);

    // Fetch map details for reported and blacklisted maps
    useEffect(() => {
        const fetchDetails = async () => {
            const allIds = Array.from(new Set([...blacklist, ...reportedIds]));
            if (allIds.length === 0) return;
            
            setIsLoadingDetails(true);
            try {
                const details = await getMapsInfo(allIds);
                const detailMap: Record<number, any> = {};
                details.forEach(d => { detailMap[d.id] = d; });
                setMapDetails(detailMap);
            } catch (err) {
                console.error("Failed to fetch map details", err);
            } finally {
                setIsLoadingDetails(false);
            }
        };
        fetchDetails();
    }, [blacklist, reportedIds]);

    // Compute stats by world
    const worldStats = useMemo(() => {
        const counts: Record<string, number> = { ALL: blacklist.length };
        blacklist.forEach(id => {
            const d = mapDetails[id];
            const wKey = d?.worldMap ? String(d.worldMap) : "UNKNOWN";
            counts[wKey] = (counts[wKey] || 0) + 1;
        });
        return counts;
    }, [blacklist, mapDetails]);

    const handleToggle = (gameId: string) => {
        setStatuses(prev => prev.map(s => 
            s.gameId === gameId ? { ...s, isEnabled: !s.isEnabled } : s
        ));
    };

    const handleMsgChange = (gameId: string, msg: string) => {
        setStatuses(prev => prev.map(s => 
            s.gameId === gameId ? { ...s, maintenanceMsg: msg } : s
        ));
    };

    const saveStatus = async (gameId: string) => {
        const game = statuses.find(s => s.gameId === gameId);
        if (!game) return;

        setStatuses(prev => prev.map(s => s.gameId === gameId ? { ...s, isSaving: true } : s));

        try {
            await updateMiniGameStatus(gameId, game.isEnabled, game.maintenanceMsg);
            toast.success(`${game.name} mis à jour avec succès`);
        } catch (error) {
            toast.error("Erreur lors de la mise à jour");
            console.error(error);
        } finally {
            setStatuses(prev => prev.map(s => s.gameId === gameId ? { ...s, isSaving: false } : s));
        }
    };

    const addToBlacklist = async (id: number) => {
        if (!blacklist.includes(id)) {
            const newBlacklist = [...blacklist, id];
            const newReported = reportedIds.filter(rid => rid !== id);
            setBlacklist(newBlacklist);
            setReportedIds(newReported);
            
            try {
                await updateGeoguesserConfig({ blacklist: newBlacklist, reportedMaps: newReported });
                toast.info(`Map #${id} ajoutée à la blacklist.`);
            } catch (err) {
                toast.error("Erreur lors de l'ajout");
            }
        }
    };

    const removeFromBlacklist = async (id: number) => {
        const newBlacklist = blacklist.filter(bid => bid !== id);
        setBlacklist(newBlacklist);
        try {
            await updateGeoguesserConfig({ blacklist: newBlacklist, reportedMaps: reportedIds });
            toast.success(`Map #${id} retirée de la blacklist.`);
        } catch (err) {
            toast.error("Erreur lors du retrait");
        }
    };

    const removeFromReported = async (id: number) => {
        const newReported = reportedIds.filter(rid => rid !== id);
        setReportedIds(newReported);
        try {
            await updateGeoguesserConfig({ blacklist: blacklist, reportedMaps: newReported });
            toast.success(`Signalement #${id} supprimé.`);
        } catch (err) {
            toast.error("Erreur lors de la suppression");
        }
    };

    const handlePermanentDelete = async (id: number) => {
        if (!confirm(`Supprimer définitivement l'image HD de la Map #${id} du VPS et la verrouiller dans la blacklist ?`)) return;
        try {
            const res = await deleteMapFileAndBlacklist(id);
            if (res.success) {
                setBlacklist(res.blacklist);
                setReportedIds(res.reportedMaps.map((r: any) => (typeof r === 'number' ? r : r.id)));
                toast.success(`Map #${id} : fichier HD supprimé et blacklistée à vie !`);
            }
        } catch (err) {
            toast.error("Erreur lors de la suppression définitive.");
        }
    };

    const handleManualAdd = () => {
        const id = parseInt(manualId, 10);
        if (isNaN(id) || id <= 0) {
            toast.error("ID de map invalide");
            return;
        }
        addToBlacklist(id);
        setManualId("");
    };

    // Filtered lists
    const filteredBlacklist = useMemo(() => {
        return blacklist.filter(id => {
            const d = mapDetails[id];
            const matchesWorld = worldFilter === "ALL" || (d?.worldMap?.toString() === worldFilter);
            const matchesSearch = !searchQuery || String(id).includes(searchQuery) || (d && `${d.x},${d.y}`.includes(searchQuery));
            return matchesWorld && matchesSearch;
        });
    }, [blacklist, mapDetails, worldFilter, searchQuery]);

    return (
        <div className="space-y-6 max-w-7xl mx-auto">
            {/* Header Tabs */}
            <div className="flex items-center justify-between border-b border-border pb-4">
                <div className="flex items-center gap-2">
                    <a
                        href="/god/mini-games?sub=MAINTENANCE"
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2",
                            activeTab === "MAINTENANCE"
                                ? "bg-surface text-foreground border border-border"
                                : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                        )}
                    >
                        <Gamepad2 size={16} />
                        Maintenance & Statuts
                    </a>
                    <a
                        href="/god/mini-games?sub=GUESSER"
                        className={cn(
                            "px-4 py-2 rounded-xl text-xs font-bold transition-colors flex items-center gap-2",
                            activeTab === "GUESSER"
                                ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                                : "text-muted-foreground hover:text-foreground hover:bg-surface/50"
                        )}
                    >
                        <Map size={16} />
                        Sigil Guesser (Blacklist & Signalements)
                    </a>
                </div>

                {activeTab === "GUESSER" && (
                    <button
                        onClick={refreshDataFromServer}
                        disabled={isRefreshing}
                        className="px-3 py-1.5 rounded-lg bg-surface border border-border text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw size={13} className={isRefreshing ? "animate-spin" : ""} />
                        Actualiser
                    </button>
                )}
            </div>

            {/* Tab: Maintenance */}
            {activeTab === "MAINTENANCE" && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {statuses.map(game => (
                        <div key={game.gameId} className="bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={cn(
                                        "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm",
                                        game.isEnabled ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                                    )}>
                                        <Gamepad2 size={18} />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-foreground text-base">{game.name}</h3>
                                        <p className="text-caption text-muted-foreground">
                                            État : {game.isEnabled ? "Actif & Accessible" : "En Maintenance"}
                                        </p>
                                    </div>
                                </div>

                                <div className={cn(
                                    "px-2.5 py-1 rounded-full text-caption font-bold border",
                                    game.isEnabled ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-rose-500/10 border-rose-500/30 text-rose-400"
                                )}>
                                    {game.isEnabled ? "ON" : "OFF"}
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-caption font-medium text-muted-foreground">
                                    Message de maintenance affiché aux joueurs
                                </label>
                                <textarea
                                    value={game.maintenanceMsg}
                                    onChange={(e) => handleMsgChange(game.gameId, e.target.value)}
                                    rows={2}
                                    className="w-full bg-background border border-border rounded-xl p-3 text-xs text-foreground focus:outline-none focus:border-ring resize-none font-sans"
                                />
                            </div>

                            <div className="flex items-center justify-between pt-2 border-t border-border">
                                <button
                                    onClick={() => handleToggle(game.gameId)}
                                    className={cn(
                                        "px-4 py-2 rounded-xl text-xs font-bold transition-colors",
                                        game.isEnabled
                                            ? "bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 border border-rose-500/30"
                                            : "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/30"
                                    )}
                                >
                                    {game.isEnabled ? "Passer en maintenance" : "Activer le jeu"}
                                </button>

                                <button
                                    onClick={() => saveStatus(game.gameId)}
                                    disabled={game.isSaving}
                                    className="px-4 py-2 rounded-xl bg-foreground text-background font-bold text-xs hover:opacity-90 transition-opacity flex items-center gap-2 disabled:opacity-50"
                                >
                                    {game.isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                                    Enregistrer
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Tab: Guesser Management */}
            {activeTab === "GUESSER" && (
                <div className="space-y-6">
                    {/* Live Statistics Banner */}
                    <div className="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                                    <Layers size={18} />
                                </div>
                                <div>
                                    <h3 className="font-bold text-foreground text-sm">Synthèse des Maps Exclues du Pool</h3>
                                    <p className="text-caption text-muted-foreground">
                                        Total : <strong className="text-foreground">{blacklist.length}</strong> maps blacklistées • <strong className="text-amber-400">{reportedIds.length}</strong> signalements en attente
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* World Breakdown Filter Chips */}
                        <div className="flex flex-wrap gap-1.5 pt-2 border-t border-border">
                            <button
                                onClick={() => setWorldFilter("ALL")}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-caption font-bold transition-colors border",
                                    worldFilter === "ALL"
                                        ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                                        : "bg-background border-border text-muted-foreground hover:text-foreground"
                                )}
                            >
                                Tous les mondes ({blacklist.length})
                            </button>

                            {Object.entries(WORLD_NAMES).map(([wId, wName]) => {
                                const count = worldStats[wId] || 0;
                                if (count === 0) return null;
                                return (
                                    <button
                                        key={wId}
                                        onClick={() => setWorldFilter(wId)}
                                        className={cn(
                                            "px-3 py-1.5 rounded-lg text-caption font-bold transition-colors border",
                                            worldFilter === wId
                                                ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300"
                                                : "bg-background border-border text-muted-foreground hover:text-foreground"
                                        )}
                                    >
                                        {wName} ({count})
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Main Grid: Reports vs Blacklist */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* 1. Reports from players */}
                        <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-sm flex flex-col">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                                        <Flag size={15} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-foreground text-sm">Signalements Joueurs</h4>
                                        <p className="text-caption text-muted-foreground">Maps tactiques ou souterraines à vérifier</p>
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 font-mono text-caption font-bold">
                                    {reportedIds.length}
                                </span>
                            </div>

                            <div className="flex-1 overflow-y-auto max-h-[480px] space-y-2 pr-1 custom-scrollbar">
                                {reportedIds.length === 0 ? (
                                    <div className="py-12 text-center text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                                        <CheckCircle2 size={24} className="mx-auto mb-1 text-emerald-400/50" />
                                        Aucun signalement en attente
                                    </div>
                                ) : (
                                    reportedIds.map(id => {
                                        const d = mapDetails[id];
                                        return (
                                            <div key={id} className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between hover:border-amber-500/30 transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-14 h-10 rounded-lg overflow-hidden bg-zinc-900 border border-border shrink-0">
                                                        <img
                                                            src={`/game-data/hd_maps/${id}.webp`}
                                                            alt=""
                                                            className="w-full h-full object-cover"
                                                            onError={(e) => { (e.currentTarget as any).style.display = 'none'; }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="font-mono text-xs font-bold text-foreground">Map #{id}</div>
                                                        <div className="text-caption text-muted-foreground font-mono">
                                                            {d ? `[${d.x}, ${d.y}] • ${WORLD_NAMES[d.worldMap] || `Monde ${d.worldMap}`}` : (isLoadingDetails ? "Chargement..." : "Coords inconnues")}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => addToBlacklist(id)}
                                                        className="px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500 hover:text-white text-caption font-bold transition-colors flex items-center gap-1"
                                                        title="Confirmer l'exclusion"
                                                    >
                                                        <Ban size={12} /> Blacklister
                                                    </button>
                                                    <button
                                                        onClick={() => handlePermanentDelete(id)}
                                                        className="px-2.5 py-1 rounded-lg bg-rose-500/15 text-rose-400 hover:bg-rose-600 hover:text-white text-caption font-bold transition-colors flex items-center gap-1"
                                                        title="Supprimer définitivement l'image HD du VPS et blacklister"
                                                    >
                                                        <Flame size={12} /> Supprimer HD
                                                    </button>
                                                    <button
                                                        onClick={() => removeFromReported(id)}
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-zinc-800 hover:text-foreground transition-colors"
                                                        title="Ignorer le signalement"
                                                    >
                                                        <Trash2 size={13} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* 2. Blacklisted Maps */}
                        <div className="bg-surface border border-border rounded-2xl p-5 space-y-4 shadow-sm flex flex-col">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2.5">
                                    <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400">
                                        <Ban size={15} />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-foreground text-sm">Maps Blacklistées</h4>
                                        <p className="text-caption text-muted-foreground">Exclues définitivement de la sélection</p>
                                    </div>
                                </div>
                                <span className="px-2 py-0.5 rounded-full bg-rose-500/10 border border-rose-500/30 text-rose-400 font-mono text-caption font-bold">
                                    {filteredBlacklist.length}
                                </span>
                            </div>

                            {/* Manual Add & Search */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <div className="flex gap-1.5">
                                    <input
                                        type="number"
                                        value={manualId}
                                        onChange={(e) => setManualId(e.target.value)}
                                        placeholder="Map ID..."
                                        className="flex-1 bg-background border border-border rounded-xl px-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:border-ring"
                                        onKeyDown={(e) => e.key === 'Enter' && handleManualAdd()}
                                    />
                                    <button
                                        onClick={handleManualAdd}
                                        className="px-3 py-2 rounded-xl bg-emerald-500 text-white font-bold text-xs hover:bg-emerald-400 transition-colors flex items-center justify-center"
                                        title="Ajouter à la blacklist"
                                    >
                                        <Plus size={14} />
                                    </button>
                                </div>

                                <div className="relative">
                                    <Search size={13} className="absolute left-3 top-2.5 text-muted-foreground" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        placeholder="Filtrer ID ou coords..."
                                        className="w-full bg-background border border-border rounded-xl pl-8 pr-3 py-2 text-xs text-foreground font-mono focus:outline-none focus:border-ring"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 overflow-y-auto max-h-[480px] space-y-2 pr-1 custom-scrollbar">
                                {filteredBlacklist.length === 0 ? (
                                    <div className="py-12 text-center text-muted-foreground text-xs border border-dashed border-border rounded-xl">
                                        <Ban size={24} className="mx-auto mb-1 text-muted-foreground/40" />
                                        Aucune map blacklistée trouvée
                                    </div>
                                ) : (
                                    filteredBlacklist.map(id => {
                                        const d = mapDetails[id];
                                        return (
                                            <div key={id} className="p-2.5 rounded-xl bg-background border border-border flex items-center justify-between hover:border-border transition-colors">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-14 h-10 rounded-lg overflow-hidden bg-zinc-900 border border-border shrink-0">
                                                        <img
                                                            src={`/game-data/hd_maps/${id}.webp`}
                                                            alt=""
                                                            className="w-full h-full object-cover opacity-60"
                                                            onError={(e) => { (e.currentTarget as any).style.display = 'none'; }}
                                                        />
                                                    </div>
                                                    <div>
                                                        <div className="font-mono text-xs font-bold text-foreground">Map #{id}</div>
                                                        <div className="text-caption text-muted-foreground font-mono">
                                                            {d ? `[${d.x}, ${d.y}] • ${WORLD_NAMES[d.worldMap] || `Monde ${d.worldMap}`}` : (isLoadingDetails ? "Chargement..." : "Coords inconnues")}
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5">
                                                    <button
                                                        onClick={() => handlePermanentDelete(id)}
                                                        className="p-1.5 rounded-lg text-rose-400 hover:bg-rose-500/15 transition-colors"
                                                        title="Purger définitivement l'image HD du disque"
                                                    >
                                                        <Flame size={14} />
                                                    </button>
                                                    <button
                                                        onClick={() => removeFromBlacklist(id)}
                                                        className="p-1.5 rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-400 transition-colors"
                                                        title="Retirer de la blacklist"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
