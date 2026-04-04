"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gamepad2, AlertTriangle, CheckCircle2, Save, Power, MessageSquare, RotateCcw, Ban, Flag, Trash2, Map, Plus, Loader2 } from "lucide-react";
import { updateMiniGameStatus, updateGeoguesserConfig, getMapsInfo } from "@/server/actions/god-mini-games-actions";
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
    156: "Dimension Divine",
    157: "Dimension Divine", // Often same
    312: "Havre-Sac",
    150: "Nimbos",
};

interface MiniGame {
    gameId: string;
    name: string;
    color: string;
}

const GAMES: MiniGame[] = [
    { gameId: "guesser", name: "Sigil-Guesser", color: "emerald" },
    { gameId: "draw", name: "Sigil-Draw", color: "blue" },
    { gameId: "phone", name: "Sigil-Phone", color: "amber" },
    { gameId: "king", name: "Sigil-King", color: "purple" },
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

    const refreshDataFromServer = async () => {
        setIsRefreshing(true);
        try {
            const { getPlatformConfig } = await import("@/server/actions/god-mini-games-actions");
            const freshConfig = await getPlatformConfig();
            setBlacklist(freshConfig.geoguesserBlacklist || []);
            setReportedIds((freshConfig.geoguesserReportedMaps as number[]) || []);
        } catch (err) {
            console.error("Failed to refresh config", err);
        } finally {
            setIsRefreshing(false);
        }
    };

    // Auto-refresh every 10s when on GUESSER tab
    useEffect(() => {
        if (activeTab !== "GUESSER") return;
        refreshDataFromServer(); // immediate refresh on tab switch
        const interval = setInterval(refreshDataFromServer, 10000);
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
                toast.info(`Map ${id} ajoutée à la blacklist`);
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
            toast.success("Carte retirée de la blacklist");
        } catch (err) {
            toast.error("Erreur lors du retrait");
        }
    };

    const removeFromReported = async (id: number) => {
        const newReported = reportedIds.filter(rid => rid !== id);
        setReportedIds(newReported);
        try {
            await updateGeoguesserConfig({ blacklist: blacklist, reportedMaps: newReported });
            toast.success("Signalement supprimé");
        } catch (err) {
            toast.error("Erreur lors de la suppression");
        }
    };

    const handleManualAdd = () => {
        const id = parseInt(manualId);
        if (!isNaN(id)) {
            addToBlacklist(id);
            setManualId("");
        }
    };

    return (
        <div className="flex flex-col flex-1 h-full overflow-hidden">
            <main className="flex-1 overflow-y-auto no-scrollbar bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-zinc-900/10 via-transparent to-transparent">
                <div className="max-w-6xl mx-auto px-6 lg:px-12 py-10 space-y-8">
                    <AnimatePresence mode="wait">
                        {activeTab === "MAINTENANCE" ? (
                            <motion.div
                                key="maintenance"
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: 20 }}
                                className="grid grid-cols-1 gap-6"
                    >
                        {statuses.map((game) => (
                            <motion.div
                                key={game.gameId}
                                className={cn(
                                    "group relative bg-zinc-900/50 backdrop-blur-xl border rounded-[2rem] p-8 transition-all overflow-hidden",
                                    game.isEnabled ? "border-white/5" : "border-red-500/30 bg-red-500/5"
                                )}
                            >
                                <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
                                    <div className="flex items-center gap-6 min-w-[240px]">
                                        <div className={cn(
                                            "w-16 h-16 rounded-2xl flex items-center justify-center border transition-all shadow-lg",
                                            game.isEnabled 
                                                ? `bg-${game.color}-500/10 border-${game.color}-500/20 text-${game.color}-400`
                                                : "bg-red-500/20 border-red-500/30 text-red-500"
                                        )}>
                                            <Power size={28} />
                                        </div>
                                        <div>
                                            <h3 className="text-2xl font-black text-white uppercase italic tracking-tight">{game.name}</h3>
                                            <div className="flex items-center gap-2 mt-1">
                                                {game.isEnabled ? (
                                                    <span className="flex items-center gap-1.5 text-emerald-400 text-[10px] font-black uppercase tracking-widest">
                                                        <CheckCircle2 size={12} /> OPÉRATIONNEL
                                                    </span>
                                                ) : (
                                                    <span className="flex items-center gap-1.5 text-red-500 text-[10px] font-black uppercase tracking-widest">
                                                        <AlertTriangle size={12} /> MAINTENANCE
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 space-y-4">
                                        <div className="space-y-2">
                                            <label className="text-[10px] font-black text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                                                <MessageSquare size={12} /> Message de Maintenance
                                            </label>
                                            <input
                                                type="text"
                                                value={game.maintenanceMsg}
                                                onChange={(e) => handleMsgChange(game.gameId, e.target.value)}
                                                className="w-full bg-zinc-950/50 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:outline-none focus:border-amber-500/50 transition-all font-medium"
                                                placeholder="Ex: Le jeu est en cours de mise à jour..."
                                            />
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <button
                                            onClick={() => handleToggle(game.gameId)}
                                            className={cn(
                                                "px-6 py-4 rounded-xl font-black uppercase text-[10px] italic transition-all flex items-center gap-2",
                                                game.isEnabled 
                                                    ? "bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500 hover:text-white"
                                                    : "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500 hover:text-white"
                                            )}
                                        >
                                            {game.isEnabled ? "Désactiver" : "Réactiver"}
                                        </button>
                                        <button
                                            onClick={() => saveStatus(game.gameId)}
                                            disabled={game.isSaving}
                                            className="px-6 py-4 rounded-xl bg-white text-black font-black uppercase text-[10px] italic hover:bg-amber-500 hover:text-white transition-all flex items-center gap-2 disabled:opacity-50"
                                        >
                                            {game.isSaving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                                            Sauvegarder
                                        </button>
                                    </div>
                                </div>
                                <div className={cn(
                                    "absolute -right-20 -bottom-20 w-64 h-64 blur-[100px] opacity-10 transition-all duration-1000",
                                    game.isEnabled ? `bg-${game.color}-500` : "bg-red-500"
                                )} />
                            </motion.div>
                        ))}
                    </motion.div>
                ) : (
                    <motion.div
                        key="guesser"
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -20 }}
                        className="space-y-8"
                    >
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                            {/* Reported Maps */}
                            <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 flex flex-col gap-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
                                            <Flag size={20} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-white uppercase italic">Signalements</h2>
                                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Maps signalées par les joueurs</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={refreshDataFromServer}
                                            disabled={isRefreshing}
                                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-white/40 hover:text-white transition-all disabled:opacity-30"
                                            title="Rafraîchir les données"
                                        >
                                            <Loader2 size={14} className={isRefreshing ? "animate-spin" : ""} />
                                        </button>
                                        <span className="bg-amber-500/20 text-amber-500 px-3 py-1 rounded-full text-[10px] font-black uppercase">
                                            {reportedIds.length} Total
                                        </span>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto max-h-[500px] space-y-3 pr-2 custom-scrollbar">
                                    {reportedIds.length === 0 ? (
                                        <div className="h-40 flex flex-col items-center justify-center text-zinc-600 border border-dashed border-white/5 rounded-3xl">
                                            <CheckCircle2 size={32} className="mb-2 opacity-20" />
                                            <p className="text-xs font-bold uppercase tracking-widest">Aucun signalement</p>
                                        </div>
                                    ) : (
                                        reportedIds.map(id => {
                                            const details = mapDetails[id];
                                            return (
                                                <div key={id} className="bg-zinc-950/50 border border-white/5 rounded-2xl p-3 flex items-center justify-between group hover:border-amber-500/30 transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="relative group/map">
                                                            <div className="w-16 h-12 rounded-xl bg-white/5 overflow-hidden border border-white/5 flex items-center justify-center text-white/20 transition-all group-hover/map:border-amber-500/50">
                                                                <img 
                                                                    src={`/game-data/hd_maps/${id}.webp`}
                                                                    alt=""
                                                                    className="w-full h-full object-cover opacity-60 group-hover/map:opacity-100 group-hover/map:scale-110 transition-all duration-500"
                                                                    onError={(e) => {
                                                                        (e.currentTarget as any).style.display = 'none';
                                                                    }}
                                                                />
                                                                <Map size={16} className="absolute inset-0 m-auto pointer-events-none opacity-20 group-hover/map:opacity-0" />
                                                            </div>
                                                            {/* HD Preview on Hover */}
                                                            <div className="fixed pointer-events-none z-[9999] opacity-0 group-hover/map:opacity-100 transition-all duration-300 scale-90 group-hover/map:scale-100 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] aspect-video rounded-[2.5rem] overflow-hidden border-4 border-amber-500/50 shadow-[0_50px_100px_rgba(0,0,0,0.9)] bg-zinc-950">
                                                                <img 
                                                                    src={`/game-data/hd_maps/${id}.webp`}
                                                                    alt=""
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                                                                <div className="absolute bottom-8 left-10 flex flex-col gap-1">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                                                                        <span className="text-white font-black text-2xl uppercase italic tracking-tighter">Vérification HD #{id}</span>
                                                                    </div>
                                                                    <span className="text-amber-500/60 text-xs font-black uppercase tracking-[0.3em] italic">
                                                                        Signalement par un joueur • {details ? `[${details.x}, ${details.y}]` : "Coords inconnues"} 
                                                                        {details && ` • ${WORLD_NAMES[details.worldMap] || `Monde ${details.worldMap}`}`}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-black text-white group-hover:text-amber-500 transition-colors tracking-tight">ID: {id}</div>
                                                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                                                {details ? (
                                                                    <>
                                                                        Pos: [{details.x}, {details.y}] • 
                                                                        <span className="text-amber-500/60 ml-1">
                                                                            {WORLD_NAMES[details.worldMap] || `Monde ${details.worldMap}`}
                                                                        </span>
                                                                    </>
                                                                ) : (isLoadingDetails ? "Chargement..." : "Détails inconnus")}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button 
                                                            onClick={() => addToBlacklist(id)}
                                                            className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 hover:text-white transition-all"
                                                            title="Blacklister"
                                                        >
                                                            <Ban size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => removeFromReported(id)}
                                                            className="p-2.5 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
                                                            title="Supprimer"
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

                            {/* Blacklisted Maps */}
                            <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/5 rounded-[2rem] p-8 flex flex-col gap-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
                                            <Ban size={20} />
                                        </div>
                                        <div>
                                            <h2 className="text-xl font-black text-white uppercase italic">Blacklist</h2>
                                            <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Maps totalement exclues du pool</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Manual Add */}
                                <div className="flex gap-2">
                                    <input 
                                        type="number" 
                                        value={manualId}
                                        onChange={(e) => setManualId(e.target.value)}
                                        placeholder="Ajouter un Map ID..."
                                        className="flex-1 bg-zinc-950/50 border border-white/10 rounded-xl px-4 py-3 text-xs text-white focus:outline-none focus:border-emerald-500/50 transition-all font-mono"
                                    />
                                    <button 
                                        onClick={handleManualAdd}
                                        className="px-4 py-3 rounded-xl bg-emerald-500 text-white hover:bg-emerald-400 transition-all flex items-center justify-center"
                                    >
                                        <Plus size={18} />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto max-h-[440px] space-y-3 pr-2 custom-scrollbar">
                                    {blacklist.length === 0 ? (
                                        <div className="h-40 flex flex-col items-center justify-center text-zinc-600 border border-dashed border-white/5 rounded-3xl">
                                            <Ban size={32} className="mb-2 opacity-20" />
                                            <p className="text-xs font-bold uppercase tracking-widest">Blacklist vide</p>
                                        </div>
                                    ) : (
                                        blacklist.map(id => {
                                            const details = mapDetails[id];
                                            return (
                                                <div key={id} className="bg-zinc-950/50 border border-white/5 rounded-2xl p-3 flex items-center justify-between group hover:border-red-500/30 transition-all">
                                                    <div className="flex items-center gap-4">
                                                        <div className="relative group/map">
                                                            <div className="w-16 h-12 rounded-xl bg-red-500/5 overflow-hidden border border-white/5 flex items-center justify-center text-red-500/20 transition-all group-hover/map:border-red-500/50">
                                                                <img 
                                                                    src={`/game-data/hd_maps/${id}.webp`}
                                                                    alt=""
                                                                    className="w-full h-full object-cover opacity-40 group-hover/map:opacity-80 group-hover/map:scale-110 transition-all duration-500"
                                                                    onError={(e) => {
                                                                        (e.currentTarget as any).style.display = 'none';
                                                                    }}
                                                                />
                                                                <Ban size={16} className="absolute inset-0 m-auto pointer-events-none opacity-20 group-hover/map:opacity-0" />
                                                            </div>
                                                            {/* HD Preview on Hover */}
                                                            <div className="fixed pointer-events-none z-[9999] opacity-0 group-hover/map:opacity-100 transition-all duration-300 scale-90 group-hover/map:scale-100 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] aspect-video rounded-[2.5rem] overflow-hidden border-4 border-red-500/50 shadow-[0_50px_100px_rgba(0,0,0,0.9)] bg-zinc-950">
                                                                <img 
                                                                    src={`/game-data/hd_maps/${id}.webp`}
                                                                    alt=""
                                                                    className="w-full h-full object-cover"
                                                                />
                                                                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                                                                <div className="absolute bottom-8 left-10 flex flex-col gap-1">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                                                        <span className="text-white font-black text-2xl uppercase italic tracking-tighter">Blacklist HD #{id}</span>
                                                                    </div>
                                                                    <span className="text-red-500/60 text-xs font-black uppercase tracking-[0.3em] italic">
                                                                        Exclusion active • {details ? `[${details.x}, ${details.y}]` : "Coords inconnues"}
                                                                        {details && ` • ${WORLD_NAMES[details.worldMap] || `Monde ${details.worldMap}`}`}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div>
                                                            <div className="text-xs font-black text-white group-hover:text-red-500 transition-colors tracking-tight">ID: {id}</div>
                                                            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
                                                                {details ? (
                                                                    <>
                                                                        Pos: [{details.x}, {details.y}] • 
                                                                        <span className="text-red-500/60 ml-1">
                                                                            {WORLD_NAMES[details.worldMap] || `Monde ${details.worldMap}`}
                                                                        </span>
                                                                    </>
                                                                ) : (isLoadingDetails ? "Chargement..." : "Détails inconnus")}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <button 
                                                        onClick={() => removeFromBlacklist(id)}
                                                        className="p-2.5 rounded-lg text-zinc-500 hover:bg-red-500/20 hover:text-red-500 transition-all"
                                                        title="Retirer"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
                    </AnimatePresence>
                </div>
            </main>
        </div>
    );
}
