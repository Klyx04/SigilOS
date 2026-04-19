"use client";

import React from "react";
import { PublicPlayer, GameMode } from "../../types/socket-events";
import { ShareRoomButton } from "../shared/ShareRoomButton";

interface LobbyScreenProps {
    room: {
        id: string;
        maxPlayers: number;
        players: PublicPlayer[];
        mode: GameMode;
    };
    onStart: () => void;
    onInvite: (url: string) => void;
    onClose: () => void;
    isHost?: boolean;
    voiceUsers?: any[];
}

import { Share2, X, Play, Shield, Users as UsersIcon, Mic } from "lucide-react";
import { cn } from "@/lib/utils";

export const LobbyScreen = ({ room, onStart, onInvite, onClose, isHost, voiceUsers = [] }: LobbyScreenProps) => {
    const voiceUserIds = voiceUsers.map(u => (u as any).userId);
    const [countdown, setCountdown] = React.useState<number | null>(null);
    const canStart = room.players.length >= 1;

    const handleStartClick = () => {
        if (!canStart || !isHost) return;
        onStart();
    };

    const handleInvite = () => {
        // Obsolete: uses window.location.origin
    };

    return (
        <div className="relative w-full max-w-[95vw] mx-auto flex flex-col items-center animate-in zoom-in-95 duration-500">
            {countdown !== null && (
                <div className="fixed inset-0 z-[500] bg-black/60 backdrop-blur-md flex items-center justify-center">
                    <span className="text-[10rem] md:text-[15rem] font-black text-white drop-shadow-[0_15px_0_rgba(0,0,0,0.4)] animate-bounce leading-none">
                        {countdown}
                    </span>
                </div>
            )}

            {/* Main Stage Card */}
            <div className="w-full bg-white/10 backdrop-blur-md border-[8px] border-white/10 rounded-[3.5rem] p-8 md:p-12 shadow-2xl flex flex-col gap-10 relative overflow-visible">
                
                {/* Purple Header - Adaptive height and text */}
                <div className="w-full max-w-3xl mx-auto bg-[#5d3fd3] rounded-[1.5rem] md:rounded-[2rem] p-3 md:p-8 relative overflow-hidden shadow-2xl -mt-10 md:-mt-16 border-b-8 border-black/20 text-center shrink-0">
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-40 h-6 md:h-8 bg-black/20 rounded-b-2xl flex items-center justify-center">
                        <span className="text-white/40 font-black text-[8px] md:text-[10px] tracking-widest uppercase italic">SIGILPHONE LOBBY</span>
                    </div>

                    <h2 className="text-white text-xl md:text-5xl lg:text-6xl font-black uppercase tracking-tighter italic mt-4 md:mt-2 drop-shadow-lg leading-tight">
                        PRÊT À <span className="text-[#a78bfa]">DESSINER ?</span>
                    </h2>

                    {/* Decorations */}
                    <div className="absolute top-[-20px] left-10 w-3 md:w-4 h-10 md:h-12 bg-white rounded-full border-[3px] md:border-4 border-[#3d2080]" />
                    <div className="absolute top-[-20px] right-10 w-3 md:w-4 h-10 md:h-12 bg-white rounded-full border-[3px] md:border-4 border-[#3d2080]" />
                </div>

                {/* Floating Action Buttons */}
                <div className="absolute top-4 md:top-8 right-4 md:right-8 flex gap-2 md:gap-3">
                    <ShareRoomButton roomId={room.id} className="scale-75 md:scale-100 origin-right" />
                    <button 
                        onClick={onClose}
                        className="w-10 h-10 md:w-14 md:h-14 flex items-center justify-center bg-red-500 hover:bg-red-400 text-white rounded-xl md:rounded-2xl border-b-4 border-black/20 transition-all active:translate-y-1 active:border-b-0 shadow-lg"
                        title="Quitter"
                    >
                        <X size={18} className="md:w-6 md:h-6" />
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
                    {/* LEFT: Players List */}
                    <div className="lg:col-span-8 flex flex-col gap-6">
                        {/* Spectators Section */}
                        {room.players.some(p => (p as any).isSpectator) && (
                            <div className="w-full bg-white/5 backdrop-blur-md rounded-[2rem] p-6 border border-white/10 flex flex-col gap-4">
                                <div className="flex items-center gap-3 text-white/40 px-2">
                                    <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                                    <span className="font-black text-[10px] uppercase tracking-[0.2em] italic">Ils nous regardent ({room.players.filter(p => (p as any).isSpectator).length})</span>
                                </div>
                                <div className="flex flex-wrap gap-4">
                                    {room.players.filter(p => (p as any).isSpectator).map((spectator) => (
                                        <div key={spectator.id} className="flex items-center gap-3 bg-white/5 pr-4 pl-1 py-1 rounded-full border border-white/10 group hover:bg-white/10 transition-all">
                                            <div className="w-8 h-8 rounded-full overflow-hidden border-2 border-white/10 relative">
                                                <img src={spectator.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${spectator.username}`} alt="avatar" className="w-full h-full object-cover" />
                                                {voiceUserIds.includes((spectator as any).userId) && (
                                                    <div className="absolute -top-0.5 -right-0.5 z-10 p-0.5 bg-emerald-500 rounded border border-zinc-950 shadow-sm">
                                                        <Mic size={6} className="text-white fill-white/20" />
                                                    </div>
                                                )}
                                            </div>
                                            <span className="text-white/60 font-black text-[10px] uppercase italic truncate max-w-[100px]">{spectator.username}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex items-center gap-4">
                            <UsersIcon className="text-white/60" size={24} />
                            <h3 className="text-white text-2xl font-black uppercase italic tracking-wider">
                                JOUEURS <span className="text-purple-300">({room.players.filter(p => !(p as any).isSpectator).length}/{room.maxPlayers})</span>
                            </h3>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4 p-2 max-h-[450px] overflow-y-auto custom-scrollbar">
                            {room.players.filter(p => !(p as any).isSpectator).map((player, i) => {
                                const isHostPlayer = (player as any).isHost || i === 0;
                                return (
                                    <div 
                                        key={player.id} 
                                        className={cn(
                                            "group bg-white rounded-[2rem] p-6 border-b-[8px] border-black/10 flex flex-col items-center gap-4 transition-all hover:-translate-y-2 hover:shadow-2xl relative",
                                            isHostPlayer && "ring-4 ring-purple-500/50"
                                        )}
                                    >
                                        <div className="w-14 h-14 md:w-20 md:h-20 rounded-full bg-slate-100 p-1 border-4 border-black/5 overflow-hidden shadow-inner group-hover:scale-110 transition-transform relative">
                                            <img src={`https://api.dicebear.com/7.x/bottts/svg?seed=${player.username}`} alt="avatar" className="w-full h-full object-cover" />
                                            {voiceUserIds.includes((player as any).userId) && (
                                                <div className="absolute top-1 right-1 z-10 p-1 bg-emerald-500 rounded-md border border-zinc-950 shadow-lg animate-bounce-subtle">
                                                    <Mic size={10} className="text-white fill-white/20" />
                                                </div>
                                            )}
                                        </div>
                                        
                                        <div className="text-center min-w-0 w-full">
                                            <span className="block font-black text-[#3d2080] uppercase tracking-tighter text-sm md:text-lg leading-none truncate w-full">
                                                {player.username}
                                            </span>
                                            {isHostPlayer && (
                                                <span className="text-[8px] md:text-[10px] font-black text-purple-600 bg-purple-100 px-2 py-0.5 rounded-full uppercase mt-1 inline-block">
                                                    HOST
                                                </span>
                                            )}
                                        </div>

                                        {isHostPlayer && (
                                            <div className="absolute top-2 right-2 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center text-sm shadow-md border-2 border-white rotate-12">
                                                👑
                                            </div>
                                        )}
                                    </div>
                                );
                            })}

                            {/* Waiting slots */}
                            {Array.from({ length: Math.max(0, 4 - room.players.length) }).map((_, i) => (
                                <div key={`empty-${i}`} className="bg-white/5 border-4 border-dashed border-white/10 rounded-[2rem] p-6 flex flex-col items-center justify-center opacity-40">
                                    <div className="w-16 h-16 rounded-full border-4 border-white/20 flex items-center justify-center">
                                        <UsersIcon className="text-white/40" size={32} />
                                    </div>
                                    <span className="mt-4 text-white/20 font-black text-xs uppercase tracking-widest">En attente...</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* RIGHT: Rules & Start Button */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <div className="bg-white/5 border-4 border-white/10 rounded-[2.5rem] p-8 flex flex-col gap-6">
                            <div className="flex items-center gap-3 text-purple-300">
                                <Shield size={20} />
                                <h3 className="font-black uppercase tracking-widest text-sm">RÈGLES DU JEU</h3>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-start gap-4">
                                    <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center font-black text-white shrink-0">1</span>
                                    <p className="text-white/60 text-sm font-medium leading-tight">Écris une phrase farfelue pour commencer ton album.</p>
                                </div>
                                <div className="flex items-start gap-4">
                                    <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center font-black text-white shrink-0">2</span>
                                    <p className="text-white/60 text-sm font-medium leading-tight">Dessine ce que l'autre joueur a écrit !</p>
                                </div>
                                <div className="flex items-start gap-4">
                                    <span className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center font-black text-white shrink-0">3</span>
                                    <p className="text-white/60 text-sm font-medium leading-tight">Enfin, devine ce que représente le dessin reçu.</p>
                                </div>
                            </div>

                            <div className="h-px bg-white/10 w-full" />

                            <div className="flex items-center justify-between">
                                <span className="text-white/40 font-black uppercase text-xs tracking-widest">MODE</span>
                                <span className="text-[#a78bfa] font-black uppercase italic text-lg">{room.mode}</span>
                            </div>
                        </div>

                        {/* BIG START BUTTON */}
                        <div className="mt-auto pt-4 md:pt-0">
                            <button
                                onClick={handleStartClick}
                                disabled={!canStart || !isHost}
                                className={cn(
                                    "w-full py-6 md:py-8 rounded-[1.5rem] md:rounded-[2rem] border-b-[8px] md:border-b-[12px] font-black italic uppercase text-xl md:text-3xl lg:text-4xl transition-all flex justify-center items-center gap-4 shadow-2xl overflow-hidden relative group shrink-0",
                                    canStart && isHost 
                                        ? "bg-[#2ed573] hover:bg-[#26af5f] text-white border-[#1e9b53] active:translate-y-3 active:border-b-0" 
                                        : "bg-gray-600 text-white/30 border-gray-800 cursor-not-allowed grayscale"
                                )}
                            >
                                {isHost ? (
                                    <>
                                        <Play fill="white" size={24} className="group-hover:scale-125 transition-transform" />
                                        <span>DÉMARRER !</span>
                                    </>
                                ) : (
                                    <span>EN ATTENTE...</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
