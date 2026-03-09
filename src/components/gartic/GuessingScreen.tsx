"use client";

import React, { useState, useEffect, useRef } from "react";
import { Socket } from "socket.io-client";
import { ChatMessage } from "../../types/socket-events";
import { cn } from "@/lib/utils";
import { CircularTimer } from "./CircularTimer";

interface GuessingScreenProps {
    isDrawer: boolean;
    wordHint?: string;
    wordCategory?: string;
    currentWord?: string;
    onSubmit: (text: string) => void;
    socket: Socket;
    timeLeft: number;
    totalTime: number;
}

export const GuessingScreen = ({ isDrawer, wordHint, wordCategory, currentWord, onSubmit, socket, timeLeft, totalTime }: GuessingScreenProps) => {
    const [guess, setGuess] = useState("");
    const [submitted, setSubmitted] = useState(false);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

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
        if (!guess.trim() || submitted) return;
        onSubmit(guess);
        setSubmitted(true);

        setMessages(prev => [...prev, { type: "guess", content: guess, isMe: true }]);
        setGuess("");
    };

    if (isDrawer) {
        return (
            <div className="flex flex-col items-center justify-center h-[500px] gap-6 bg-black/20 rounded-3xl border border-white/20 backdrop-blur-md shadow-2xl p-12 mt-12">
                <div className="text-8xl animate-bounce">🎨</div>
                <p className="text-white text-3xl font-black tracking-widest text-center max-w-lg leading-relaxed">
                    LES AUTRES DEVINENT TON DESSIN !
                </p>
                <div className="text-yellow-400 text-5xl font-black bg-black/40 px-8 py-4 rounded-2xl shadow-inner border border-yellow-400/30">
                    {currentWord}
                </div>
            </div>
        );
    }

    return (
        <div className="relative flex flex-col items-center gap-6 py-12 px-6 bg-black/20 rounded-3xl border border-white/20 backdrop-blur-md shadow-2xl mt-12 text-center">
            <div className="absolute top-4 right-6">
                <CircularTimer remaining={timeLeft} total={totalTime} />
            </div>
            <div className="text-6xl animate-bounce">🤔</div>

            <h2 className="text-yellow-400 text-4xl font-black tracking-widest drop-shadow-[0_0_10px_rgba(250,204,21,0.5)]">
                ÉCRIS UNE RÉPONSE
            </h2>

            {wordHint && (
                <div className="text-white/60 text-2xl font-mono tracking-[0.5em] bg-black/40 px-6 py-3 rounded-xl border border-white/10">
                    {wordHint} <span className="text-white/30 text-lg ml-2">{wordCategory && `· ${wordCategory}`}</span>
                </div>
            )}

            <div className="flex gap-4 w-full max-w-2xl mt-6">
                <input
                    ref={inputRef}
                    value={guess}
                    onChange={(e) => setGuess(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder={submitted ? "Réponse envoyée !" : "Dofus ocre sur un tofu..."}
                    disabled={submitted}
                    className={cn(
                        "flex-1 px-8 py-5 rounded-3xl text-2xl font-black shadow-inner",
                        "bg-white/95 text-gray-800 placeholder:text-gray-400",
                        "border-4 border-transparent focus:border-yellow-400 outline-none",
                        "transition-all duration-200",
                        submitted && "opacity-60 bg-gray-200"
                    )}
                    autoFocus
                />
                <button
                    onClick={handleSubmit}
                    disabled={submitted || !guess.trim()}
                    className={cn(
                        "px-10 py-5 rounded-3xl font-black text-white text-xl tracking-wider",
                        "bg-green-500 hover:bg-green-400 active:translate-y-1",
                        "border-b-4 border-green-700 active:border-b-0",
                        "transition-all duration-150 flex items-center gap-3 shadow-[0_0_15px_rgba(34,197,94,0.3)]",
                        (submitted || !guess.trim()) && "opacity-50 cursor-not-allowed border-b-4 translate-y-0"
                    )}
                >
                    ✓ TERMINÉ !
                </button>
            </div>

            <div className="w-full max-w-2xl space-y-2 max-h-48 overflow-y-auto mt-8 bg-black/30 p-4 rounded-2xl border border-white/10 custom-scrollbar">
                {messages.map((msg, i) => (
                    <div key={i} className={cn(
                        "px-4 py-2 rounded-xl text-lg transition-all",
                        msg.isCorrect ? "bg-green-500/30 text-white font-bold border border-green-500/50" : "bg-white/10 text-white/80 border border-white/5",
                        msg.isMe && "ml-auto max-w-[80%] bg-blue-500/20 border-blue-500/30 text-blue-100",
                        !msg.isMe && !msg.isCorrect && "mr-auto max-w-[80%]"
                    )}>
                        {msg.content}
                    </div>
                ))}
                {messages.length === 0 && (
                    <div className="text-white/30 text-center py-4 font-black tracking-widest">
                        AUCUNE PROPOSITION POUR LE MOMENT
                    </div>
                )}
            </div>
        </div>
    );
};
