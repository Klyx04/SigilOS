
"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import { io, Socket } from "socket.io-client";
import { buildWsUrl } from "@/lib/socket-utils";
import { useSession } from "next-auth/react";
import { motion, AnimatePresence } from "framer-motion";
import { 
    Loader2, 
    Trophy, 
    Heart, 
    Zap, 
    Bomb, 
    Timer, 
    Users, 
    ChevronLeft, 
    LayoutGrid, 
    Send,
    AlertCircle,
    Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { AtmosphericParticles } from "../ui/AtmosphericParticles";

export default function BombGame({ roomId: initialRoomId, guildId }: { roomId?: string, guildId: string }) {
    const { data: session } = useSession();
    const [socket, setSocket] = useState<Socket | null>(null);
    const [gameState, setGameState] = useState<any>(null);
    const [wordInput, setWordInput] = useState("");
    const [isJoining, setIsJoining] = useState(false);
    const [lobbyRooms, setLobbyRooms] = useState<any[]>([]);
    const sessionRef = useRef(session);
    useEffect(() => { sessionRef.current = session; }, [session]);
    
    // UI Local State
    const [explosionFlash, setExplosionFlash] = useState(false);
    const [shake, setShake] = useState(false);

    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (!session?.user?.id) return;

        const s = io(buildWsUrl(), {
            path: "/socket.io/",
            transports: ["websocket", "polling"],
            query: { guildId }
        });
        setSocket(s);

        s.on("connect", () => {
            const user = sessionRef.current?.user;
            if (!user) return;

            if (initialRoomId) {
                s.emit("bomb:room:join", {
                    roomId: initialRoomId,
                    playerObj: {
                        userId: user.id,
                        userName: user.name,
                        userAvatar: user.image,
                        guildId
                    }
                });
            } else {
                s.emit("bomb:room:list");
            }
        });

        s.on("bomb:sync", (state) => {
            setGameState(state);
            setIsJoining(false);
        });

        s.on("bomb:room:list", (list) => {
            setLobbyRooms(list);
        });

        s.on("bomb:explosion", (data) => {
            setExplosionFlash(true);
            setShake(true);
            setTimeout(() => { setExplosionFlash(false); setShake(false); }, 1000);
            toast.error("BOUM ! La bombe a explosé !");
        });

        s.on("bomb:word-success", () => {
            setWordInput("");
            toast.success("Mot validé !");
        });

        s.on("bomb:word-error", (data) => {
            toast.error(data.message);
        });

        return () => { s.disconnect(); };
    }, [session, initialRoomId, guildId]);

    const handleCreateRoom = () => {
        const id = Math.random().toString(36).substring(2, 9).toUpperCase();
        setIsJoining(true);
        const user = sessionRef.current?.user;
        if (!user) return;

        socket?.emit("bomb:room:join", {
            roomId: id,
            playerObj: {
                userId: user.id,
                userName: user.name,
                userAvatar: user.image,
                guildId
            }
        });
        const url = new URL(window.location.href);
        url.searchParams.set("room", id);
        window.history.replaceState(null, "", url.toString());
    };

    const handleJoinRoom = (id: string) => {
        setIsJoining(true);
        const user = sessionRef.current?.user;
        if (!user) return;

        socket?.emit("bomb:room:join", {
            roomId: id,
            playerObj: {
                userId: user.id,
                userName: user.name,
                userAvatar: user.image,
                guildId
            }
        });
        const url = new URL(window.location.href);
        url.searchParams.set("room", id);
        window.history.replaceState(null, "", url.toString());
    };

    const handleStartGame = () => {
        socket?.emit("bomb:game:start");
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!wordInput.trim()) return;
        socket?.emit("bomb:word:submit", { word: wordInput });
    };

    // Auto-focus input when it's your turn
    useEffect(() => {
        if (gameState?.state === 'PLAYING') {
            const activePlayers = gameState.players.filter((p: any) => p.lives > 0 && !p.isSpectator);
            const isMyTurn = activePlayers[gameState.currentTurnIndex]?.id === socket?.id;
            if (isMyTurn && inputRef.current) {
                inputRef.current.focus();
            }
        }
    }, [gameState, socket]);

    if (!gameState) {
        return (
            <div className="h-full w-full bg-[#0a0d14] flex flex-col items-center justify-center relative overflow-hidden">
                <AtmosphericParticles />
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="z-10 text-center space-y-8 p-12 bg-zinc-900/50 backdrop-blur-3xl border border-white/10 rounded-[3rem] shadow-2xl max-w-2xl w-full mx-4">
                    <div className="space-y-2">
                        <h1 className="text-6xl font-black text-white uppercase italic tracking-tighter">Sigil-Bomb</h1>
                        <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px] italic">Le défi de la Reine des Voleurs</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <button onClick={handleCreateRoom} className="p-8 rounded-[2rem] bg-indigo-500 hover:bg-indigo-400 text-white transition-all border-b-[8px] border-black/20 flex flex-col items-center gap-4 group">
                             <Zap className="w-10 h-10 group-hover:scale-110 transition-transform" />
                             <span className="font-black uppercase italic tracking-widest">Créer une salle</span>
                        </button>
                        <button onClick={() => socket?.emit("bomb:room:list")} className="p-8 rounded-[2rem] bg-white/5 hover:bg-white/10 text-white transition-all border border-white/10 flex flex-col items-center gap-4 group">
                             <Users className="w-10 h-10 group-hover:scale-110 transition-transform" />
                             <span className="font-black uppercase italic tracking-widest">Voir les salons</span>
                        </button>
                    </div>

                    {lobbyRooms.length > 0 && (
                        <div className="space-y-4 pt-8 border-t border-white/5">
                            <h3 className="text-[10px] font-black text-white/20 uppercase tracking-widest italic">Salons disponibles</h3>
                            <div className="grid grid-cols-1 gap-3 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                {lobbyRooms.map(room => (
                                    <button 
                                        key={room.roomId} 
                                        onClick={() => handleJoinRoom(room.roomId)}
                                        className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-indigo-500/50 transition-all group"
                                    >
                                        <div className="flex flex-col items-start leading-none">
                                            <span className="font-black text-white italic">{room.roomId}</span>
                                            <span className="text-[8px] text-white/20 uppercase font-black tracking-widest mt-1">
                                                {room.playerCount} JOUEURS • {room.state}
                                            </span>
                                        </div>
                                        <LayoutGrid className="w-5 h-5 text-white/20 group-hover:text-indigo-500 transition-colors" />
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        );
    }

    const activePlayers = gameState.players.filter((p: any) => p.lives > 0 && !p.isSpectator);
    const currentPlayer = activePlayers[gameState.currentTurnIndex];
    const isMyTurn = currentPlayer?.id === socket?.id;

    return (
        <div className={cn(
            "h-full w-full bg-[#0a0614] flex flex-col relative overflow-hidden transition-all duration-300",
            shake && "animate-shake"
        )}>
            <AtmosphericParticles />
            
            {/* BACKGROUND REINE DES VOLEURS */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
                <img src="/images/sigil-king/incarnations/Roublard.png" className="absolute -right-20 -bottom-20 w-[600px] grayscale blur-sm" alt="" />
            </div>

            {/* HEADER */}
            <header className="relative z-50 h-[80px] bg-black/40 backdrop-blur-xl border-b border-white/5 px-8 flex items-center justify-between shadow-2xl">
                <div className="flex items-center gap-6">
                    <button 
                        onClick={() => window.location.href = `/dashboard/${guildId}/mini-jeux`}
                        className="w-12 h-12 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/40 hover:text-white transition-all shadow-lg group"
                        title="Retour"
                    >
                        <LayoutGrid className="w-6 h-6 transition-transform group-hover:rotate-12" />
                    </button>
                    <div className="flex flex-col leading-none">
                        <span className="text-white/20 text-[8px] font-black uppercase tracking-[0.3em] italic mb-1">Dimension Obscure</span>
                        <h2 className="text-2xl font-black text-white uppercase italic tracking-tighter">Bombe de la Reine</h2>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex -space-x-3">
                        {gameState.players.map((p: any) => (
                            <div key={p.id} className={cn(
                                "w-10 h-10 rounded-xl border-2 border-zinc-950 bg-zinc-900 overflow-hidden shadow-2xl relative",
                                p.id === currentPlayer?.id ? "ring-2 ring-indigo-500 z-10 scale-110" : "opacity-40 grayscale"
                            )}>
                                <img src={p.userAvatar || `https://ui-avatars.com/api/?name=${p.userName}`} className="w-full h-full object-cover" alt="" />
                                {p.lives === 0 && <div className="absolute inset-0 bg-red-500/40 flex items-center justify-center"><Heart size={16} className="text-white/20" /></div>}
                            </div>
                        ))}
                    </div>
                </div>
            </header>

            {/* MAIN GAME AREA */}
            <main className="flex-1 relative flex flex-col items-center justify-center p-8">
                {explosionFlash && <div className="absolute inset-0 bg-white/20 z-[100] animate-pulse" />}

                <AnimatePresence mode="wait">
                    {gameState.state === 'LOBBY' ? (
                        <motion.div key="lobby" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }} className="flex flex-col items-center gap-12 text-center max-w-xl">
                            <div className="relative">
                                <div className="absolute -inset-10 bg-indigo-500/20 blur-[100px] animate-pulse rounded-full" />
                                <div className="w-64 h-64 bg-zinc-900 rounded-[4rem] border border-white/5 flex items-center justify-center shadow-2xl relative">
                                    <Bomb size={120} className="text-white/10 animate-bounce" />
                                </div>
                            </div>
                            <div className="space-y-4">
                                <h1 className="text-5xl font-black text-white italic uppercase tracking-tighter italic leading-none">Prêt pour l'épreuve ?</h1>
                                <p className="text-zinc-500 font-medium">Attendez que tous les joueurs soient prêts. La Reine n'attend pas.</p>
                            </div>
                            {socket?.id === gameState.hostId && (
                                <button onClick={handleStartGame} className="px-12 py-6 rounded-[2.5rem] bg-indigo-500 hover:bg-indigo-400 text-white font-black italic uppercase tracking-widest text-xl border-b-[8px] border-black/20 hover:border-b-[4px] hover:translate-y-1 active:translate-y-3 active:border-b-0 transition-all shadow-[0_20px_50px_rgba(79,70,229,0.3)]">
                                    Lancer l'Épreuve
                                </button>
                            )}
                        </motion.div>
                    ) : gameState.state === 'PLAYING' ? (
                        <motion.div key="playing" className="flex flex-col items-center gap-16 w-full">
                            {/* BOMBE VISUELLE */}
                            <div className="relative">
                                <div className={cn(
                                    "absolute -inset-20 blur-[120px] rounded-full transition-all duration-1000",
                                    gameState.timeLeft <= 3 ? "bg-red-500/40 animate-pulse" : "bg-indigo-500/20"
                                )} />
                                
                                <div className={cn(
                                    "w-80 h-80 rounded-[5rem] bg-zinc-900 border-4 border-white/5 flex flex-col items-center justify-center relative shadow-2xl",
                                    gameState.timeLeft <= 3 && "border-red-500/20"
                                )}>
                                    <div className="absolute top-8 text-indigo-400 font-black italic tracking-[0.2em] uppercase text-[10px] animate-pulse">Syllabe Active</div>
                                    <div className="text-8xl md:text-9xl font-black text-white italic tracking-tighter uppercase mb-4 drop-shadow-[0_0_30px_rgba(255,255,255,0.15)]">
                                        {gameState.currentSyllable}
                                    </div>
                                    <div className="flex items-center gap-3 px-6 py-2 bg-white/5 rounded-full border border-white/5 text-zinc-500 font-black italic uppercase text-[10px] tracking-widest">
                                        <Timer size={14} className={cn(gameState.timeLeft <= 3 && "text-red-500")} />
                                        <span className={cn(gameState.timeLeft <= 3 && "text-red-500")}>
                                            00:{gameState.timeLeft.toString().padStart(2, '0')}
                                        </span>
                                    </div>
                                </div>

                                {/* TURN INDICATOR */}
                                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 px-8 py-4 bg-zinc-900 border border-white/10 rounded-3xl shadow-2xl flex items-center gap-4 min-w-[280px]">
                                    <img src={currentPlayer?.userAvatar || `https://ui-avatars.com/api/?name=${currentPlayer?.userName}`} className="w-10 h-10 rounded-xl" alt="" />
                                    <div className="flex flex-col items-start leading-none">
                                        <span className={cn(
                                            "text-xs font-black uppercase italic italic",
                                            isMyTurn ? "text-indigo-400" : "text-white"
                                        )}>
                                            {isMyTurn ? "C'EST TON TOUR !" : `AU TOUR DE ${currentPlayer?.userName}`}
                                        </span>
                                        <div className="flex gap-1 mt-2">
                                            {[...Array(3)].map((_, i) => (
                                                <Heart key={i} size={12} fill={i < (currentPlayer?.lives || 0) ? "#ef4444" : "none"} className={i < (currentPlayer?.lives || 0) ? "text-red-500" : "text-zinc-800"} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* INPUT AREA */}
                            <div className="w-full max-w-lg space-y-6">
                                <form onSubmit={handleSubmit} className="relative group">
                                    <input 
                                        ref={inputRef}
                                        type="text"
                                        value={wordInput}
                                        onChange={(e) => setWordInput(e.target.value)}
                                        disabled={!isMyTurn}
                                        placeholder={isMyTurn ? "Tape un mot..." : "Attends ton tour..."}
                                        className={cn(
                                            "w-full h-24 bg-zinc-900 border-2 rounded-[2rem] px-10 text-3xl font-black italic uppercase transition-all outline-none text-center tracking-widest",
                                            isMyTurn ? "border-indigo-500/40 text-white focus:border-indigo-500 focus:shadow-[0_0_30px_rgba(79,70,229,0.2)]" : "border-white/5 text-zinc-800 cursor-not-allowed opacity-50"
                                        )}
                                    />
                                    <button disabled={!isMyTurn} type="submit" className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16 rounded-2xl bg-indigo-500 text-white flex items-center justify-center hover:bg-indigo-400 active:scale-95 transition-all shadow-xl disabled:opacity-0 disabled:scale-0">
                                        <Send size={24} />
                                    </button>
                                </form>

                                <div className="flex items-center justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-[#5d3fd3]/40 italic">
                                    <span className="flex items-center gap-2"><Info size={12} /> DOIT CONTENIR "{gameState.currentSyllable}"</span>
                                    <span className="flex items-center gap-2"><AlertCircle size={12} /> PAS DE MOTS DÉJÀ UTILISÉS</span>
                                </div>
                            </div>
                        </motion.div>
                    ) : gameState.state === 'GAME_END' ? (
                        <motion.div key="end" initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col items-center gap-10 text-center max-w-xl">
                            <div className="w-40 h-40 bg-zinc-900 rounded-[2.5rem] border border-white/5 flex items-center justify-center shadow-2xl relative mb-4">
                                <Trophy size={80} className="text-yellow-500 drop-shadow-[0_0_20px_rgba(234,179,8,0.5)] animate-bounce" />
                            </div>
                            <div className="space-y-4">
                                <h1 className="text-6xl font-black text-white italic uppercase tracking-tighter">Fin de l'Épreuve</h1>
                                <p className="text-zinc-500 font-medium">Certains ont survécu, d'autres ont été réduits en poussière.</p>
                            </div>
                            
                            <div className="grid grid-cols-1 gap-3 w-full bg-white/5 p-8 rounded-[3rem] border border-white/5 max-h-[300px] overflow-y-auto">
                                {gameState.players.sort((a: any, b: any) => b.wordsFound - a.wordsFound).map((p: any) => (
                                    <div key={p.id} className="flex items-center justify-between p-4 bg-zinc-900/50 rounded-2xl border border-white/5">
                                        <div className="flex items-center gap-4">
                                            <img src={p.userAvatar || `https://ui-avatars.com/api/?name=${p.userName}`} className="w-10 h-10 rounded-xl" alt="" />
                                            <span className="font-black text-white italic uppercase tracking-tight">{p.userName}</span>
                                        </div>
                                        <div className="flex items-center gap-6">
                                            <div className="flex flex-col items-end leading-none">
                                                <span className="text-white text-xl font-black tracking-tighter italic">{p.wordsFound}</span>
                                                <span className="text-[8px] text-white/20 uppercase font-black tracking-widest mt-1">MOTS</span>
                                            </div>
                                            {p.lives > 0 ? (
                                                <div className="px-3 py-1 bg-emerald-500/20 border border-emerald-500/40 text-emerald-500 rounded-lg text-[8px] font-black uppercase tracking-widest italic">SURVIVANT</div>
                                            ) : (
                                                <div className="px-3 py-1 bg-red-500/20 border border-red-500/40 text-red-500 rounded-lg text-[8px] font-black uppercase tracking-widest italic">ÉLIMINÉ</div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {socket?.id === gameState.hostId && (
                                <button onClick={handleStartGame} className="w-full py-6 rounded-[2.5rem] bg-indigo-500 hover:bg-indigo-400 text-white font-black italic uppercase tracking-widest text-xl border-b-[8px] border-black/20 transition-all shadow-xl">
                                    Recommencer l'Invasion
                                </button>
                            )}
                        </motion.div>
                    ) : null}
                </AnimatePresence>
            </main>
            
            <style jsx global>{`
                @keyframes shake {
                    0%, 100% { transform: translateX(0); }
                    10%, 30%, 50%, 70%, 90% { transform: translateX(-10px); }
                    20%, 40%, 60%, 80% { transform: translateX(10px); }
                }
                .animate-shake {
                    animation: shake 0.5s cubic-bezier(.36,.07,.19,.97) both;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.05);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.1);
                }
            `}</style>
        </div>
    );
}
