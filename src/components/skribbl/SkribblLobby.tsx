import React from "react";
import { Socket } from "socket.io-client";
import { cn } from "@/lib/utils";
import { Pencil, Mic } from "lucide-react";
import { ShareRoomButton } from "../shared/ShareRoomButton";

interface SkribblLobbyProps {
    gameState: any;
    socket: Socket;
    voiceUsers?: any[];
}

export default function SkribblLobby({ gameState, socket, voiceUsers = [] }: SkribblLobbyProps) {
    const voiceUserIds = voiceUsers.map(u => u.userId);
    return (
        <div className="flex flex-col h-full bg-transparent p-2 md:p-3 gap-4">
            <ShareRoomButton roomId={gameState?.roomId || gameState?.id} className="w-full mb-2" />
            {/* Spectators Section at the top */}
            {(gameState?.players || []).filter((p: any) => p.isSpectator).length > 0 && (
                <div className="flex flex-col gap-2 p-2 bg-white/5 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-2 px-1">
                        <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                        <span className="text-[8px] font-black text-white/40 uppercase tracking-widest italic">Spectateurs ({ (gameState?.players || []).filter((p: any) => p.isSpectator).length })</span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        {(gameState?.players || []).filter((p: any) => p.isSpectator).map((p: any) => (
                            <div key={p.id} className="group relative">
                                <div className="w-8 h-8 rounded-full border-2 border-white/10 p-0.5 bg-slate-900 overflow-hidden hover:scale-110 transition-transform cursor-help shadow-lg relative" title={p.userName}>
                                    <img 
                                        src={p.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.userId || p.id}`} 
                                        alt="avatar" 
                                        className="w-full h-full object-cover rounded-full grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all" 
                                    />
                                    {voiceUserIds.includes(p.userId) && (
                                        <div className="absolute -top-0.5 -right-0.5 z-10 p-0.5 bg-emerald-500 rounded border border-zinc-950 shadow-sm">
                                            <Mic size={6} className="text-white fill-white/20" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Active Players List */}
            <div className="flex flex-row lg:flex-col h-full overflow-x-auto lg:overflow-y-auto custom-scrollbar gap-2 md:gap-3">
                {(gameState?.players || []).filter((p: any) => !p.isSpectator).map((p: any, index: number) => {
                    const isMe = p.id === socket?.id;
                    const isDrawing = p.isDrawing || gameState?.drawerId === p.id;
                    const hasGuessed = p.hasGuessed;
                    
                    return (
                        <div 
                            key={p.id} 
                            className={cn(
                                "relative flex items-center gap-2 md:gap-4 p-2 md:p-4 rounded-xl md:rounded-[1.5rem] transition-all duration-300 border-2 overflow-hidden group shrink-0 w-[140px] md:w-auto",
                                hasGuessed 
                                    ? "bg-emerald-500/20 border-emerald-500/40 translate-x-1 md:translate-x-2" 
                                    : isMe 
                                        ? "bg-white/10 border-white/30 shadow-xl" 
                                        : "bg-white/5 border-transparent hover:bg-white/10 hover:border-white/10"
                            )}
                        >
                            <div className={cn(
                                "w-6 h-6 md:w-8 md:h-8 rounded-lg md:rounded-xl flex items-center justify-center font-black text-[8px] md:text-xs italic shadow-lg shrink-0",
                                index === 0 ? "bg-yellow-400 text-[#3d2080]" : 
                                index === 1 ? "bg-slate-300 text-slate-700" : 
                                index === 2 ? "bg-amber-600 text-white" : "bg-black/20 text-white/40"
                            )}>
                                {index + 1}
                            </div>

                            <div className="relative shrink-0">
                                <div className={cn(
                                    "w-10 h-10 md:w-12 md:h-12 rounded-full border-2 md:border-4 p-0.5 bg-white transition-transform group-hover:scale-110",
                                    isDrawing ? "border-purple-400 animate-pulse" : "border-white/10"
                                )}>
                                    <img 
                                        src={p.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${p.userId || p.id}`} 
                                        alt="avatar" 
                                        className="w-full h-full object-cover rounded-full" 
                                    />
                                </div>
                                
                                {isDrawing && (
                                    <div className="absolute -top-1 -right-1 md:-top-2 md:-right-2 bg-purple-500 text-white p-1 md:p-1.5 rounded-md md:rounded-lg shadow-xl border border-white animate-bounce">
                                        <Pencil className="w-[10px] h-[10px] md:w-[12px] md:h-[12px]" strokeWidth={3} />
                                    </div>
                                )}
                                
                                {(p.userId === gameState?.hostId || p.id === gameState?.hostId) && (
                                    <div className="absolute -bottom-1 -left-1 text-[10px] md:text-base drop-shadow-md animate-pulse">👑</div>
                                )}

                                {voiceUserIds.includes(p.userId) && (
                                    <div className="absolute -top-1 -right-1 z-10 p-1 bg-emerald-500 rounded-md border border-zinc-950 shadow-lg animate-bounce-subtle">
                                        <Mic size={10} className="text-white fill-white/20" />
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col flex-1 min-w-0 leading-tight">
                                <span className={cn(
                                    "font-black text-[10px] md:text-sm uppercase tracking-tighter truncate",
                                    hasGuessed ? "text-emerald-400" : "text-white",
                                    isMe && "text-purple-300"
                                )}>
                                    {p.userName || "Joueur"}
                                </span>
                                <div className="flex items-center gap-1 mt-0.5">
                                    <span className="text-[8px] md:text-xs font-black text-yellow-400 italic">
                                        {p.score || 0}
                                    </span>
                                    <span className="text-[6px] md:text-[8px] font-black text-white/30 uppercase tracking-widest italic pt-0.5">KAMAS</span>
                                </div>
                            </div>

                            {hasGuessed && (
                                <div className="absolute inset-0 bg-emerald-500/10 pointer-events-none" />
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
