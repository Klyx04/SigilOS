"use client";

import React, { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { ChatMessage } from "../../types/socket-events";
import { cn } from "@/lib/utils";
import { CircularTimer } from "./CircularTimer";
import { playSoundEffect } from "@/lib/sounds";

interface GuessingScreenProps {
    isDrawer: boolean;
    isWriting?: boolean;
    wordHint?: string;
    wordCategory?: string;
    currentWord?: string;
    onSubmit: (text: string) => void;
    socket: Socket;
    timeLeft: number;
    totalTime: number;
    playerClass?: string;
    round?: number;
    totalRounds?: number;
    onClose?: () => void;
    isSpectator?: boolean;
}

export const GuessingScreen = ({ 
    isDrawer, 
    isWriting, 
    wordHint, 
    wordCategory, 
    currentWord, 
    onSubmit, 
    socket, 
    timeLeft, 
    totalTime, 
    playerClass,
    round = 1,
    totalRounds = 1,
    onClose,
    isSpectator
}: GuessingScreenProps) => {
    const [guess, setGuess] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (timeLeft === 10) {
            playSoundEffect("gartic-ring");
        }
    }, [timeLeft]);

    useEffect(() => {
        if (!socket) return;
        socket.on("gartic:chat:broadcast", (msg: ChatMessage) => {
            setMessages(prev => [...prev, msg]);
        });
        socket.on("gartic:guess:correct", ({ username, points }: any) => {
            setMessages(prev => [...prev, {
                type: "correct",
                content: `✅ ${username} a trouvé ! (+${points} pts)`,
                isCorrect: true,
            }]);
        });
        return () => {
            socket.off("gartic:chat:broadcast");
            socket.off("gartic:guess:correct");
        };
    }, [socket]);

    const handleSubmit = () => {
        if (!guess.trim() || submitted || isSpectator) return;
        onSubmit(guess);
        setSubmitted(true);
        setGuess("");
    };

    if (isDrawer || isSpectator) {
        const title = isSpectator ? "OBSERVATION EN COURS..." : "LES AUTRES DEVINENT...";
        const subtitle = isSpectator ? "Regarde les albums se former !" : "Tu as dessiné :";
        return (
            <div className="flex flex-col items-center justify-center h-full w-full animate-in zoom-in-95 duration-500 p-4">
                <div className="w-full max-w-4xl bg-white/10 backdrop-blur-md border-[4px] md:border-[6px] border-white/20 rounded-[2rem] md:rounded-[3rem] p-6 md:p-12 text-center flex flex-col items-center gap-4 md:gap-6 shadow-2xl overflow-hidden shrink-0">
                    <div className="text-6xl md:text-9xl animate-bounce drop-shadow-xl mb-2 md:mb-4">🎨</div>
                    <h2 className="text-white text-2xl md:text-5xl font-black uppercase tracking-tighter italic leading-tight">
                        LES AUTRES DEVINENT...
                    </h2>
                    <p className="text-white/60 text-sm md:text-xl font-bold uppercase tracking-widest italic">
                        Tu as dessiné :
                    </p>
                    <div className="text-white text-3xl md:text-6xl font-black bg-white/10 px-6 md:px-12 py-4 md:py-8 rounded-[1.5rem] md:rounded-[2rem] border-2 md:border-4 border-white/20 shadow-2xl">
                        {currentWord}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col items-center justify-center w-full max-w-[98vw] h-full animate-in zoom-in-95 duration-500 relative py-2 md:py-8 lg:py-12 overflow-hidden">
            {/* Round Counter - Compact on small screens */}
            <div className="absolute top-2 md:top-4 left-4 md:left-6 z-50 flex flex-col items-start select-none">
                <span className="text-white/40 font-black text-[8px] md:text-sm tracking-[0.2em] md:tracking-[0.3em] uppercase italic">ROUND</span>
                <span className="text-white font-black text-2xl md:text-6xl italic drop-shadow-[0_5px_0_rgba(0,0,0,0.2)]">
                    {round}<span className="text-white/30 text-lg md:text-4xl">/{totalRounds}</span>
                </span>
            </div>

            {/* Main Stage */}
            <div className="w-full bg-white/10 backdrop-blur-xl border-[4px] md:border-[8px] border-white/10 rounded-[2rem] md:rounded-[4rem] p-2 md:p-10 shadow-2xl flex flex-col items-center gap-2 md:gap-10 relative mt-12 md:mt-8 shrink-0 min-h-0 overflow-hidden grow">
                
                {/* Purple Card Header - Fluid */}
                <div className="w-full max-w-3xl bg-[#5d3fd3] rounded-[1.2rem] md:rounded-[2.5rem] p-3 md:p-8 relative overflow-hidden shadow-2xl -mt-8 md:-mt-24 border-b-[4px] md:border-b-[10px] border-black/20 z-20 shrink-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 md:w-48 h-5 md:h-10 bg-black/20 rounded-b-[1.5rem] md:rounded-b-[2rem] flex items-center justify-center">
                        <span className="text-white/40 font-black text-[6px] md:text-[10px] tracking-[0.2em] md:tracking-[0.4em] uppercase italic">SIGIL PHONE</span>
                    </div>

                    <div className="mt-3 md:mt-6 text-center">
                        <h2 className="text-white text-lg md:text-4xl lg:text-5xl font-black uppercase tracking-tighter italic drop-shadow-lg leading-tight">
                            {isWriting ? "À TOI DE COMMENCER !" : "DÉCRIS CETTE SCÈNE !"}
                        </h2>
                    </div>

                    <div className="absolute top-1 right-2 md:top-6 md:right-8 scale-[0.5] md:scale-110">
                        <CircularTimer remaining={timeLeft} total={totalTime} />
                    </div>
                </div>

                {/* Notebook Content Area - Adaptive */}
                <div className="w-full bg-white rounded-[1.2rem] md:rounded-[3rem] p-2 md:p-10 shadow-2xl border-b-[6px] md:border-b-[12px] border-black/10 flex items-center justify-center overflow-hidden relative grow min-h-[120px] md:min-h-[300px]">
                    {/* Spiral decorations for the notebook */}
                    <div className="absolute top-0 left-0 w-full flex justify-around px-8 md:px-24 opacity-10 pointer-events-none mt-2">
                        {Array.from({length: 12}).map((_, i) => (
                            <div key={i} className="w-2 md:w-3.5 h-8 md:h-12 bg-black rounded-full -mt-4 md:-mt-6 shadow-inner" />
                        ))}
                    </div>

                    {isWriting ? (
                        <div className="flex flex-col items-center gap-3 md:gap-10 py-2">
                            <div className="relative group shrink-0">
                                <div className="absolute inset-0 bg-purple-500/30 blur-[40px] md:blur-[100px] rounded-full group-hover:bg-purple-500/40 transition-all duration-1000" />
                                <img 
                                    src={`https://sigilos.fr/images/classes/${playerClass || '1'}_1.png`} 
                                    alt="Class Avatar" 
                                    className="w-24 h-24 md:w-72 md:h-72 object-contain animate-float drop-shadow-[0_25px_35px_rgba(0,0,0,0.3)] relative z-10 hover:scale-110 transition-transform duration-500"
                                    onError={(e) => {
                                        (e.target as HTMLImageElement).src = 'https://api.dicebear.com/7.x/bottts/svg?seed=sigil';
                                    }}
                                />
                            </div>
                            <div className="text-center flex flex-col gap-1 md:gap-2">
                                <p className="text-[#3d2080] font-black text-sm md:text-3xl uppercase tracking-tighter italic px-4">
                                    ÉCRIS UNE PHRASE !
                                </p>
                                <p className="text-slate-400 font-bold uppercase tracking-widest text-[6px] md:text-xs">SOIS CRÉATIF, SOIS DRÔLE !</p>
                            </div>
                        </div>
                    ) : (
                        <div className="w-full h-full flex items-center justify-center p-2">
                            {currentWord && currentWord.startsWith("data:") ? (
                                <img src={currentWord} alt="Guess this" className="max-w-full max-h-[250px] md:max-h-[500px] object-contain rounded-xl md:rounded-2xl drop-shadow-xl animate-in fade-in zoom-in-95 duration-700" />
                            ) : (
                                <div className="flex flex-col items-center gap-2">
                                    <div className="w-8 h-8 md:w-20 md:h-20 border-3 md:border-8 border-[#5d3fd3]/20 border-t-[#5d3fd3] rounded-full animate-spin" />
                                    <div className="text-[#a46522] font-black italic text-sm md:text-3xl uppercase tracking-widest animate-pulse">Chargement...</div>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Bottom Input Area - Adaptive */}
                <div className="w-full max-w-4xl flex flex-col md:flex-row gap-2 md:gap-6 mt-1 md:mt-4 shrink-0 pb-1 md:pb-0">
                    <div className="flex-1 bg-white/10 backdrop-blur-xl border-[4px] border-white/20 rounded-[1.2rem] md:rounded-[2.5rem] flex items-center px-4 md:px-10 shadow-2xl focus-within:bg-white/15 focus-within:border-white/30 transition-all group overflow-hidden">
                        <input
                            ref={inputRef}
                            value={guess}
                            onChange={(e) => setGuess(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                            placeholder={submitted ? "Patientez..." : "Ta description ici..."}
                            disabled={submitted}
                            className="w-full bg-transparent border-none text-white text-lg md:text-3xl font-black placeholder:text-white/20 outline-none py-3 md:py-8 group-focus-within:translate-x-1 transition-transform"
                            autoFocus
                        />
                    </div>
                    <button
                        onClick={handleSubmit}
                        disabled={submitted || !guess.trim()}
                        className={cn(
                            "px-6 md:px-14 py-3 md:py-8 rounded-[1.2rem] md:rounded-[2.5rem] font-black text-white text-lg md:text-3xl tracking-tighter uppercase transition-all shadow-2xl group relative overflow-hidden shrink-0",
                            "bg-[#2ed573] hover:bg-[#26af5f]",
                            "border-b-[6px] md:border-b-[12px] border-[#1e9b53] active:border-b-0 active:translate-y-2 shadow-black/20",
                            (submitted || !guess.trim()) && "opacity-50 grayscale cursor-not-allowed translate-y-0"
                        )}
                    >
                        <div className="flex items-center gap-2 md:gap-4 relative z-10 justify-center">
                            {submitted ? (
                                <>
                                    <span className="text-xl md:text-4xl">✓</span>
                                    <span>ENVOYÉ</span>
                                </>
                            ) : (
                                <>
                                    <span>ENVOYER !</span>
                                    <div className="w-6 h-6 md:w-10 md:h-10 bg-white/20 rounded-full flex items-center justify-center group-hover:rotate-12 transition-transform hidden sm:flex">
                                        <span className="scale-100 md:scale-125">✅</span>
                                    </div>
                                </>
                            )}
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};
