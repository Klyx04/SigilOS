"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Gamepad2, AlertTriangle, CheckCircle2, Save, Power, MessageSquare } from "lucide-react";
import { updateMiniGameStatus } from "@/server/actions/god-mini-games-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

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

export default function MiniGamesGodClient({ initialStatuses }: { initialStatuses: any[] }) {
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

    return (
        <div className="p-8 space-y-8 max-w-5xl mx-auto">
            <div className="flex flex-col gap-2">
                <h1 className="text-4xl font-black text-white uppercase italic tracking-tighter flex items-center gap-4">
                    <Gamepad2 size={36} className="text-amber-500" />
                    Maintenance des Jeux
                </h1>
                <p className="text-zinc-500 font-bold uppercase text-xs tracking-widest">
                    Contrôle global des mini-jeux pour toutes les guildes
                </p>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {statuses.map((game) => (
                    <motion.div
                        key={game.gameId}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={cn(
                            "group relative bg-zinc-900/50 backdrop-blur-xl border rounded-[2rem] p-8 transition-all overflow-hidden",
                            game.isEnabled ? "border-white/5" : "border-red-500/30 bg-red-500/5"
                        )}
                    >
                        <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-8">
                            {/* Icon & Name */}
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

                            {/* Controls */}
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

                            {/* Action Buttons */}
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
                                    {game.isSaving ? <span className="animate-spin text-sm">...</span> : <Save size={14} />}
                                    Sauvegarder
                                </button>
                            </div>
                        </div>

                        {/* Background subtle glow */}
                        <div className={cn(
                            "absolute -right-20 -bottom-20 w-64 h-64 blur-[100px] opacity-10 transition-all duration-1000",
                            game.isEnabled ? `bg-${game.color}-500` : "bg-red-500"
                        )} />
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
