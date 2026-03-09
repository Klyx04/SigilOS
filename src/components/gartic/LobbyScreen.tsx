"use client";

import React from "react";
import { PublicPlayer, GameMode } from "../../types/socket-events";

interface LobbyScreenProps {
    room: {
        id: string;
        maxPlayers: number;
        players: PublicPlayer[];
        mode: GameMode;
    };
    onStart: () => void;
    onInvite: (url: string) => void;
}

export const LobbyScreen = ({ room, onStart, onInvite }: LobbyScreenProps) => {
    const [countdown, setCountdown] = React.useState<number | null>(null);

    const handleStartClick = () => {
        setCountdown(3);
        const timer = setInterval(() => {
            setCountdown(prev => {
                if (prev === 1) {
                    clearInterval(timer);
                    onStart();
                    return null;
                }
                return prev ? prev - 1 : null;
            });
        }, 1000);
    };

    const handleInvite = () => {
        const roomUrl = `${window.location.origin}${window.location.pathname}?room=${room.id}`;
        navigator.clipboard.writeText(roomUrl);
        onInvite(roomUrl);
    };

    return (
        <div className="relative">
            {countdown !== null && (
                <div className="absolute inset-0 z-[300] bg-black/80 backdrop-blur-sm flex items-center justify-center rounded-[3rem] animate-in fade-in zoom-in duration-300">
                    <span className="text-[12rem] font-black italic text-yellow-400 drop-shadow-[0_0_30px_rgba(250,204,21,0.5)] animate-bounce">
                        {countdown}
                    </span>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 p-4">
                {/* Colonne gauche : Joueurs */}
                <div className="col-span-1 border border-white/20 bg-white/10 rounded-[2rem] p-6 shadow-2xl backdrop-blur-xl">
                    <h2 className="text-yellow-400 text-2xl font-black italic tracking-wider mb-6 text-center uppercase">
                        JOUEURS {room.players.length}/{room.maxPlayers}
                    </h2>
                    <div className="space-y-3">
                        {room.players.map((player, i) => (
                            <div key={player.id} className="flex items-center gap-4 px-5 py-4 rounded-2xl bg-white/10 border border-white/20 text-white font-black italic transition-all hover:scale-105 hover:bg-white/20">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs ${i === 0 ? 'bg-yellow-400 text-black' : 'bg-white/5 text-white/40'}`}>
                                    {i + 1}
                                </div>
                                <span className="flex-1">{player.username}</span>
                                {i === 0 && <span className="text-[8px] uppercase bg-yellow-400/20 text-yellow-400 px-2 py-1 rounded-md">Hôte</span>}
                            </div>
                        ))}
                        {Array.from({ length: room.maxPlayers - room.players.length }).map((_, i) => (
                            <div key={`empty-${i}`} className="h-[64px] rounded-2xl bg-white/5 border border-white/10 border-dashed flex items-center justify-center text-white/5 font-black italic uppercase text-[10px] tracking-widest">
                                Place libre
                            </div>
                        ))}
                    </div>
                </div>

                {/* Colonne droite : Préréglages */}
                <div className="col-span-1 md:col-span-2 flex flex-col gap-6">
                    <div className="p-8 rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-md flex-1">
                        <h2 className="text-white text-3xl font-black italic uppercase mb-8">Options de Jeu</h2>

                        <div className="gap-4 grid grid-cols-2 md:grid-cols-3">
                            {["NORMAL", "CADAVRE_EXQUIS", "ANIMATION", "CHEF_D'OEUVRE", "HISTOIRE"].map((m) => (
                                <button key={m} className={`group relative overflow-hidden p-6 rounded-2xl border-2 transition-all font-black italic text-xs text-left ${room.mode === m ? "border-yellow-400 bg-yellow-400/10 text-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.2)]" : "border-white/10 bg-white/5 text-white/40 hover:border-white/30 hover:text-white"}`}>
                                    <span className="relative z-10">{m}</span>
                                    {room.mode === m && <div className="absolute top-0 right-0 p-2"><div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" /></div>}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 p-8 rounded-[2rem] border border-white/10 bg-black/20">
                        <button onClick={handleInvite} className="flex-1 py-5 px-6 rounded-2xl font-black italic uppercase text-xs bg-white/5 hover:bg-white/10 text-white border border-white/10 transition-all flex items-center justify-center gap-3 active:scale-95">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
                            Copier le lien d'invitation
                        </button>
                        <button onClick={handleStartClick} className="flex-1 py-5 px-6 rounded-2xl font-black italic uppercase text-xs bg-green-500 hover:bg-green-400 text-white shadow-[0_6px_0_#15803d] active:shadow-[0_0px_0_#15803d] active:translate-y-[6px] transition-all flex items-center justify-center gap-3">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /></svg>
                            Démarrer la partie
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
