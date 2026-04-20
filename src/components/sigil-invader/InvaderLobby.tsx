"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Play, Rocket, Shield, Trophy, X, CheckCircle2, Crown, Loader2, Bot } from "lucide-react";
import { InvaderRoom, setPlayerReady, startInvaderGame, updateInvaderRoomConfig } from "@/server/actions/sigil-invader-actions";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { ShareRoomButton } from "../shared/ShareRoomButton";

interface LobbyProps {
    room: InvaderRoom;
    guildId: string;
    onStart: () => void;
}

export function InvaderLobby({ room: initialRoom, guildId, onStart }: LobbyProps) {
    const { data: session } = useSession();
    const [room, setRoom] = useState<InvaderRoom>(initialRoom);
    const [isLeaving, setIsLeaving] = useState(false);
    const [isStarting, setIsStarting] = useState(false);
    const [isReady, setIsReady] = useState(false);

    const isHost = session?.user?.id === room.hostId;
    const playersCount = room.players.length;
    const allReady = room.players.every(p => p.ready);

    const handleReady = async () => {
        const nextReady = !isReady;
        setIsReady(nextReady);
        try {
            await setPlayerReady(room.roomId, nextReady);
        } catch (err) {
            toast.error("Erreur de préparation");
            setIsReady(!nextReady);
        }
    };

    const handleStart = async () => {
        if (!isHost) return;
        const activePlayers = room.players.filter(p => !p.isSpectator);
        const allActiveReady = activePlayers.every(p => p.ready);
        if (!allActiveReady) {
            toast.error("Veuillez vous préparer (et attendre que tous les joueurs soient prêts)");
            return;
        }
        setIsStarting(true);
        try {
            await startInvaderGame(room.roomId);
            onStart();
        } catch (err) {
            toast.error("Erreur au lancement");
            setIsStarting(false);
        }
    };

    const toggleBot = async () => {
        if (!isHost) return;
        try {
            await updateInvaderRoomConfig(room.roomId, { withBot: !room.withBot });
        } catch (err) {
            toast.error("Erreur config bot");
        }
    };

    // Real-time updates via Socket/Redis (simplified placeholder here)
    // In a real app, you'd use a pusher/socket hook to update room state
    useEffect(() => {
        // Mocking room updates for now
        const interval = setInterval(async () => {
            const { getInvaderRoom } = await import("@/server/actions/sigil-invader-actions");
            const updated = await getInvaderRoom(room.roomId);
            if (updated) {
                setRoom(updated);
                if (updated.state === 'PLAYING') onStart();
            }
        }, 2000);
        return () => clearInterval(interval);
    }, [room.roomId]);

    return (
        <div className="w-full h-full overflow-y-auto custom-scrollbar p-4 md:p-8 animate-in fade-in zoom-in duration-500">
            <div className="flex flex-col items-center justify-start min-h-full">
                <div className="max-w-4xl w-full my-auto pb-12">
                    {/* Header Lobby */}
                <div className="bg-[#0a0f18]/60 backdrop-blur-3xl border border-indigo-500/20 rounded-[2.5rem] p-8 mb-8 relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-[100px]" />
                    <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="w-20 h-20 rounded-2xl bg-indigo-500/10 flex items-center justify-center border border-indigo-500/20 shadow-2xl shadow-indigo-500/20">
                                <Rocket className="w-10 h-10 text-indigo-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl md:text-4xl font-black text-white uppercase italic tracking-tighter flex flex-wrap items-center gap-3">
                                    Salon de Combat <ShareRoomButton roomId={room.roomId} />
                                </h1>
                                <p className="text-indigo-400/60 font-black uppercase text-xs tracking-[0.2em] italic mt-1">
                                    En attente de l'escouade de défense
                                </p>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <div className="flex -space-x-4">
                                {room.players.map((p, i) => (
                                    <div key={p.userId} className="w-12 h-12 rounded-full border-4 border-[#0a0f18] bg-zinc-800 overflow-hidden shadow-lg animate-in slide-in-from-right duration-300" style={{ transitionDelay: `${i * 100}ms` }}>
                                        {p.avatar ? <img src={p.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/20 text-xs font-black">{p.name[0]}</div>}
                                    </div>
                                ))}
                                {Array.from({ length: 4 - playersCount }).map((_, i) => (
                                    <div key={i} className="w-12 h-12 rounded-full border-4 border-[#0a0f18] bg-indigo-500/5 border-dashed border-indigo-500/20 flex items-center justify-center">
                                        <Users className="w-4 h-4 text-indigo-500/20" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Spectators List */}
                {room.players.some(p => p.isSpectator) && (
                    <div className="w-full bg-white/5 backdrop-blur-md rounded-[2rem] p-4 border border-white/5 mb-6 flex flex-col gap-3">
                        <div className="flex items-center gap-2 px-2">
                            <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            <span className="text-[10px] font-black text-white/40 uppercase tracking-widest italic">Spectateurs ({room.players.filter(p => p.isSpectator).length})</span>
                        </div>
                        <div className="flex flex-wrap gap-3 px-2">
                            {room.players.filter(p => p.isSpectator).map(p => (
                                <div key={p.userId} className="flex items-center gap-2 bg-black/40 pr-3 pl-1 py-1 rounded-full border border-white/5 transition-all hover:bg-white/5">
                                    <div className="w-6 h-6 rounded-full overflow-hidden border border-white/10">
                                        <img src={p.avatar || `https://ui-avatars.com/api/?name=${p.name}`} className="w-full h-full object-cover grayscale opacity-60" alt="" />
                                    </div>
                                    <span className="text-white/40 font-black text-[9px] uppercase italic">{p.name}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Grid Players */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    {room.players.filter(p => !p.isSpectator).map((player) => (
                        <motion.div 
                            key={player.userId}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`relative bg-[#0a0f18]/40 border rounded-[2rem] p-6 flex flex-col items-center text-center transition-all ${player.ready ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-white/5'}`}
                        >
                            {player.userId === room.hostId && (
                                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-amber-500 text-black font-black text-[8px] uppercase tracking-widest flex items-center gap-1 shadow-lg">
                                    <Crown size={10} /> Chef d'Escadrille
                                </div>
                            )}

                            <div className="w-20 h-20 rounded-full border-4 border-white/5 overflow-hidden mb-4 shadow-xl">
                                {player.avatar ? <img src={player.avatar} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white/20 text-xl font-black">{player.name[0]}</div>}
                            </div>

                            <h3 className="text-white font-black uppercase italic text-sm truncate w-full mb-1">{player.name}</h3>
                            
                            <div className={`flex items-center gap-2 py-2 px-4 rounded-xl text-[10px] font-black uppercase italic mt-4 transition-all w-full justify-center ${player.ready ? 'bg-emerald-500/20 text-emerald-400' : 'bg-white/5 text-white/20'}`}>
                                {player.ready ? <><CheckCircle2 size={12} /> Prêt au décollage</> : <><Loader2 size={12} className="animate-spin" /> En préparation</>}
                            </div>
                        </motion.div>
                    ))}

                    {/* Robot Slot in Solo Mode or if enabled */}
                    {room.withBot && (
                        <motion.div 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="relative bg-indigo-500/5 border border-indigo-500/20 rounded-[2.5rem] p-6 flex flex-col items-center text-center border-dashed"
                        >
                            <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-indigo-500 text-white font-black text-[8px] uppercase tracking-widest flex items-center gap-1 shadow-lg">
                                <Bot size={10} /> Intelligence Artificielle
                            </div>
                            <div className="w-20 h-20 rounded-full border-4 border-indigo-500/20 overflow-hidden mb-4 p-4 bg-black/40">
                                <Bot className="w-full h-full text-indigo-400" />
                            </div>
                            <h3 className="text-white font-black uppercase italic text-sm mb-1">Robot Crâ-mée</h3>
                            <div className="flex items-center gap-2 py-2 px-4 rounded-xl text-[10px] font-black uppercase italic mt-4 bg-indigo-500/20 text-indigo-400 w-full justify-center">
                                <CheckCircle2 size={12} /> Prêt au décollage
                            </div>
                        </motion.div>
                    )}
                </div>

                {/* Tutorial & Controls */}
                <div className="bg-indigo-500/5 border border-indigo-500/20 rounded-[2rem] p-6 mb-8 flex flex-col md:flex-row gap-8">
                    <div className="flex-1 space-y-4">
                        <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">
                            <Rocket size={16} className="text-indigo-400" />
                            Contrôles de Vol
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                                <span className="text-white/40 text-[9px] font-black uppercase tracking-wider block mb-1">Mouvement</span>
                                <div className="text-white text-xs font-bold flex gap-2 items-center">
                                    <kbd className="bg-white/10 px-2 py-0.5 rounded text-indigo-300">Z Q S D</kbd>
                                    <span className="text-white/20">/</span>
                                    <kbd className="bg-white/10 px-2 py-0.5 rounded text-indigo-300">Flèches</kbd>
                                </div>
                            </div>
                            <div className="bg-black/40 rounded-xl p-3 border border-white/5">
                                <span className="text-white/40 text-[9px] font-black uppercase tracking-wider block mb-1">Attaque</span>
                                <div className="text-white text-xs font-bold flex gap-2 items-center">
                                    <kbd className="bg-white/10 px-2 py-0.5 rounded text-rose-400">Clic Gauche</kbd>
                                    <span className="text-white/20">/</span>
                                    <kbd className="bg-white/10 px-2 py-0.5 rounded text-rose-400">Espace</kbd>
                                </div>
                            </div>
                            <div className="bg-black/40 rounded-xl p-3 border border-white/5 col-span-2">
                                <span className="text-white/40 text-[9px] font-black uppercase tracking-wider block mb-1">Visée Indépendante</span>
                                <div className="text-white/60 text-xs font-medium">
                                    Utilisez la <span className="text-emerald-400 font-bold">Souris</span> pour diriger votre canon indépendamment de votre direction de vol (Twin-stick shooter style).
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="w-px bg-white/5 hidden md:block" />
 
                    <div className="flex-1 space-y-4">
                        <h3 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">
                            <Shield size={16} className="text-indigo-400" />
                            Système d'Armement (Stack)
                        </h3>
                        <p className="text-white/60 text-xs font-medium leading-relaxed">
                            Récupérez les bonus largués pour améliorer votre vaisseau. 
                            Le système vous permet de <span className="text-indigo-400 font-bold">cumuler jusqu'à 8 niveaux d'armes</span> et de combiner différents types de tirs simultanément !
                        </p>
                        <div className="flex flex-wrap gap-2 pt-1">
                            <span className="px-2 py-1 bg-amber-500/10 text-amber-500 border border-amber-500/30 rounded-md text-[9px] font-black uppercase tracking-wider">K K Kamas Multiples</span>
                            <span className="px-2 py-1 bg-purple-500/10 text-purple-400 border border-purple-500/30 rounded-md text-[9px] font-black uppercase tracking-wider">Laser Xélor Céleste</span>
                            <span className="px-2 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 rounded-md text-[9px] font-black uppercase tracking-wider">Bouclier d'Invulnérabilité</span>
                             <span className="px-2 py-1 bg-orange-500/10 text-orange-400 border border-orange-500/30 rounded-md text-[9px] font-black uppercase tracking-wider">Cawotte (+1 Vie)</span>
                        </div>
                    </div>
                </div>
 
                {/* Footer Controls */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-black/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8">
                    <div className="space-y-1">
                        <div className="flex items-center gap-3 text-white font-black uppercase italic text-xl">
                            Difficulté : <span className="text-indigo-400">Vague {room.wave}</span>
                        </div>
                        <p className="text-white/20 text-[10px] font-black uppercase tracking-widest italic flex items-center gap-2">
                             <Shield size={12} /> Bonus de guilde activé : +10% de score
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4">
                        {isHost && (
                            <button 
                                onClick={toggleBot}
                                className={`px-6 py-4 rounded-2xl border font-black uppercase italic text-[10px] tracking-widest transition-all gap-2 flex items-center shadow-xl ${room.withBot ? 'bg-indigo-500 text-white border-transparent' : 'bg-zinc-800 text-white/20 border-white/5 hover:text-white'}`}
                            >
                                <Bot size={16} /> Robot {room.withBot ? "Actif" : "Désactivé"}
                            </button>
                        )}

                        <button 
                            onClick={async () => {
                                const { leaveInvaderRoom } = await import("@/server/actions/sigil-invader-actions");
                                await leaveInvaderRoom(room.roomId);
                                window.location.href = `/dashboard/${guildId}/mini-jeux`;
                            }}
                            className="px-6 py-4 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 font-black uppercase italic text-[10px] tracking-widest hover:bg-red-500 hover:text-white transition-all shadow-xl"
                        >
                            Quitter
                        </button>

                        <button 
                            onClick={handleReady}
                            className={`px-8 py-4 rounded-2xl font-black uppercase italic text-xs tracking-widest transition-all ${isReady ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/30' : 'bg-white text-black hover:bg-indigo-500 hover:text-white shadow-xl shadow-white/10'}`}
                        >
                            {isReady ? "Désister" : "Se Préparer"}
                        </button>

                        {isHost && (
                            <button 
                                onClick={handleStart}
                                disabled={isStarting || !allReady}
                                className="px-12 py-4 rounded-2xl bg-indigo-600 text-white font-black uppercase italic text-xs tracking-widest hover:bg-indigo-500 transition-all shadow-2xl shadow-indigo-600/40 disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                <span className="flex items-center gap-2">
                                    {isStarting ? <Loader2 className="animate-spin" /> : <Play fill="currentColor" size={14} className="group-hover:scale-125 transition-transform" />}
                                    Lancer l'Offensive
                                </span>
                            </button>
                        )}
                    </div>
                </div>

                <div className="mt-8 flex items-center justify-center gap-6">
                    <div className="flex items-center gap-2 text-white/20 text-[10px] font-black uppercase italic">
                        <Trophy size={14} /> Record de la Guilde : 1,240,500
                    </div>
                    <div className="w-1 h-1 rounded-full bg-white/10" />
                    <div className="flex items-center gap-2 text-white/20 text-[10px] font-black uppercase italic">
                        <Users size={14} /> {playersCount}/4 Joueurs
                    </div>
                </div>
                </div>
            </div>
        </div>
    );
}
