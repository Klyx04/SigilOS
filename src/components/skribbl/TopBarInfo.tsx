import React, { useEffect, useState } from "react";
import { Socket } from "socket.io-client";
import { cn } from "@/lib/utils";
import { Info, RefreshCw } from "lucide-react";
import { toast } from "sonner";

interface TopBarInfoProps {
    gameState: any;
    socket: Socket;
    isDrawer: boolean;
}

export default function TopBarInfo({ gameState, socket, isDrawer }: TopBarInfoProps) {
    const [timeLeft, setTimeLeft] = useState(gameState.timeLeft || 0);

    useEffect(() => {
        const handleTick = ({ timeLeft }: { timeLeft: number }) => {
            setTimeLeft(timeLeft);
        };
        socket.on("skribbl:time:tick", handleTick);
        return () => {
            socket.off("skribbl:time:tick", handleTick);
        };
    }, [socket]);

    useEffect(() => {
        setTimeLeft(gameState.timeLeft);
    }, [gameState.timeLeft]);

    const drawerPlayer = gameState.players?.find((p: any) => p.isDrawing);
    const drawerName = drawerPlayer ? drawerPlayer.userName : "L'artiste";

    return (
        <div className="flex items-center w-full grow relative h-full gap-2 md:gap-4">
            {/* ROUND & TIMER LEFT */}
            <div className="w-[110px] md:w-[160px] shrink-0 flex items-center gap-2 md:gap-4 bg-white/50 backdrop-blur-md px-3 md:px-5 py-2.5 rounded-2xl md:rounded-[2rem] border-b-4 border-black/5 shadow-inner h-fit">
                <div className="flex flex-col items-start leading-none select-none">
                    <span className="text-[10px] md:text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] italic text-nowrap">MANCHE</span>
                    <span className="font-extrabold text-sm md:text-2xl text-[#5d3fd3] italic">
                        {gameState.currentRound || 1}<span className="text-slate-300 text-xs md:text-lg">/{gameState.maxRounds}</span>
                    </span>
                </div>

                <div className="w-px h-5 md:h-8 bg-slate-200" />

                <div className="relative w-8 h-8 md:w-12 md:h-12 flex items-center justify-center bg-white rounded-full border-2 md:border-4 border-[#5d3fd3]/20 shadow-sm shrink-0">
                    <span className={cn(
                        "font-black text-xs md:text-xl italic",
                        timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-[#5d3fd3]"
                    )}>
                        {timeLeft}
                    </span>
                </div>
            </div>

            {/* WORD DISPLAY CENTER */}
            <div className="flex-1 min-w-0 flex items-center justify-center">
                {gameState.state === "DRAWING" ? (
                    <div className="flex items-center gap-2 md:gap-4 animate-in fade-in zoom-in-95 duration-500 max-w-full">
                        {isDrawer ? (
                            <div className="flex items-center gap-2 md:gap-8 bg-[#5d3fd3] px-4 md:px-10 py-2 md:py-4 rounded-xl md:rounded-[2.5rem] border-b-[4px] md:border-b-[8px] border-black/20 shadow-2xl relative group min-w-0">
                                <div className="flex flex-col items-start leading-none relative z-10 min-w-0">
                                    <span className="text-[10px] md:text-xs font-black text-white/40 uppercase tracking-[0.2em] mb-1 md:mb-2 italic">MODÈLE</span>
                                    <span className="text-sm sm:text-base md:text-2xl lg:text-3xl font-black text-white uppercase tracking-tighter italic drop-shadow-lg break-words leading-tight">
                                        {gameState.currentWord}
                                    </span>
                                </div>
                                <div className="w-14 h-14 md:w-24 md:h-24 lg:w-28 lg:h-28 bg-white rounded-xl md:rounded-[2.5rem] p-1.5 flex items-center justify-center shadow-2xl relative transform group-hover:scale-110 lg:group-hover:scale-150 transition-all duration-300 ring-4 ring-white/10 z-[100] cursor-zoom-in shrink-0 overflow-hidden border-b-4 border-black/10">
                                    <div className="absolute inset-0 bg-gradient-to-tr from-[#5d3fd3]/5 to-transparent pointer-events-none" />
                                    <img 
                                        src={gameState.currentWordIcon || "https://api.dofusdb.fr/img/items/4349.png"} 
                                        alt="" 
                                        className="w-full h-full object-contain relative z-10 p-1 md:p-2"
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 md:gap-6 overflow-hidden max-w-full">
                                <div className="flex flex-col items-center bg-white/80 backdrop-blur-md px-4 md:px-8 py-2 md:py-3.5 rounded-xl md:rounded-[2.5rem] border-b-2 md:border-b-4 border-black/5 shadow-xl min-w-0">
                                    <div className="flex items-center gap-2 md:gap-4 mb-2">
                                        <span className="text-slate-400 text-[10px] md:text-xs font-black uppercase tracking-[0.2em] italic">DESSIN</span>
                                        {gameState.currentWordCategory && (
                                            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-[#5d3fd3] text-[9px] md:text-[10px] font-black uppercase tracking-wider shadow-sm">
                                                {gameState.currentWordCategory}
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 md:gap-6 max-w-full overflow-hidden">
                                        <span className="text-sm sm:text-base md:text-2xl lg:text-3xl font-black text-[#5d3fd3] tracking-[0.15em] font-mono whitespace-pre select-none truncate">
                                            {gameState.currentWordMask}
                                        </span>
                                        <div className="min-w-[20px] h-5 md:w-9 md:h-9 rounded md:rounded-xl bg-[#5d3fd3] text-white flex items-center justify-center text-[10px] md:text-sm font-black shadow rotate-3 shrink-0">
                                            {gameState.currentWordMask?.replace(/\s/g, "").length || 0}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : gameState.state === "SELECTING_WORD" ? (
                    <div className="flex items-center gap-4 bg-white/40 px-6 md:px-10 py-3 md:py-4 rounded-full animate-pulse min-w-0 shadow-lg">
                        <RefreshCw className="w-4 h-4 md:w-6 md:h-6 text-[#5d3fd3] animate-spin shrink-0" />
                        <span className="font-black text-[#5d3fd3] uppercase tracking-widest text-xs md:text-sm italic truncate">
                            {drawerName} choisit un mot...
                        </span>
                    </div>
                ) : null}
            </div>

            {/* INFO RIGHT */}
            <div className="flex-none flex items-center gap-2">
                {/* Spectators bubbles */}
                {gameState.players?.filter((p: any) => p.isSpectator).length > 0 && (
                    <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-white/20 backdrop-blur-md border border-white/20 rounded-xl mr-2">
                        <div className="flex -space-x-1.5">
                            {gameState.players.filter((p: any) => p.isSpectator).slice(0, 3).map((s: any, idx: number) => (
                                <div key={s.id || idx} className="w-5 h-5 rounded-md border border-black/10 bg-zinc-900 overflow-hidden grayscale opacity-50 hover:grayscale-0 hover:opacity-100 transition-all cursor-help" title={s.userName}>
                                    <img src={s.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${s.userName}`} className="w-full h-full object-cover rounded-sm" alt="" />
                                </div>
                            ))}
                            {gameState.players.filter((p: any) => p.isSpectator).length > 3 && (
                                <div className="w-5 h-5 rounded-md bg-zinc-800 border border-white/5 flex items-center justify-center text-[8px] font-black text-white/40">
                                    +{gameState.players.filter((p: any) => p.isSpectator).length - 3}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                <button 
                    onClick={() => {
                        toast.info("RÈGLES DU SIGIL-DRAW", {
                            description: "1. Choisis un mot et dessine-le. 2. Devine dans le chat. 3. Gagne des Kamas !",
                            duration: 5000,
                        });
                    }}
                    className="w-8 h-8 md:w-10 md:h-10 bg-white/50 hover:bg-white rounded-lg md:rounded-xl shadow-lg transition-all text-[#5d3fd3] flex items-center justify-center border-b-2 md:border-b-4 border-black/5 hover:scale-110 active:scale-95"
                >
                    <Info className="w-4 h-4 md:w-5 md:h-5" strokeWidth={3} />
                </button>
            </div>
        </div>
    );
}
