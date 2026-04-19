"use client";

import React from "react";
import { GamePhase } from "../../types/socket-events";
import { LogOut, Mic, MicOff } from "lucide-react";

export const GarticStarDecorations = () => {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
            {/* Simulation of stars or background patterns */}
            <div className="absolute w-2 h-2 bg-white rounded-full top-10 left-10 opacity-20" />
            <div className="absolute w-3 h-3 bg-white rounded-full top-40 right-20 opacity-30" />
            <div className="absolute w-1 h-1 bg-white rounded-full bottom-20 left-1/3 opacity-10" />
        </div>
    );
};

export const GarticLayout = ({ 
    phase, 
    children, 
    onClose, 
    spectators = [], 
    guildId = "", 
    showVoiceOverlay = true, 
    onToggleVoice 
}: { 
    phase: string; 
    children: React.ReactNode; 
    onClose?: () => void; 
    spectators?: any[]; 
    guildId?: string; 
    showVoiceOverlay?: boolean; 
    onToggleVoice?: () => void; 
}) => {
    return (
        <div className="min-h-screen w-full relative bg-[#3d8be0] font-sans selection:bg-purple-500/30 select-none">
            {/* STABLE BACKGROUND LAYER (Overflow hidden to prevent scroll loops) */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
                {/* Base Gradient background */}
                <div className="absolute inset-0 bg-gradient-to-br from-[#3d8be0] via-[#5b96ea] to-[#8d69f1]" />
                
                {/* Sunburst/Radial rays effect */}
                <div 
                    className="absolute inset-x-[-50%] inset-y-[-50%] opacity-20"
                    style={{
                        background: 'conic-gradient(from 0deg, transparent 0deg, transparent 5deg, rgba(255,255,255,0.3) 10deg, transparent 15deg, transparent 20deg)',
                        backgroundSize: '100% 100%',
                        animation: 'spin 120s linear infinite'
                    }}
                />

                {/* Halftone/Dots pattern */}
                <div 
                    className="absolute inset-0 opacity-[0.15]"
                    style={{ 
                        backgroundImage: 'radial-gradient(rgba(0,0,0,0.5) 2px, transparent 2px)', 
                        backgroundSize: '24px 24px' 
                    }} 
                />
                
                <GarticStarDecorations />
            </div>

            <style jsx global>{`
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                body { overflow-x: hidden; }
            `}</style>

            {/* RETOUR SELECTION */}
            <div className="absolute top-2 left-2 md:top-6 md:left-6 z-[200] flex flex-col gap-2">
                <button 
                    onClick={() => window.location.href = `/dashboard/${guildId}/mini-jeux`}
                    className="group flex flex-col items-center justify-center w-10 h-10 md:w-16 md:h-16 bg-white/10 backdrop-blur-md rounded-xl md:rounded-2xl border border-white/10 shadow-lg transition-all hover:scale-110 active:scale-95 group"
                    title="Retour à la sélection"
                >
                    <div className="text-white transition-transform group-hover:rotate-12">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 md:w-8 md:h-8">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                        </svg>
                    </div>
                </button>

                {onToggleVoice && (
                    <button 
                        onClick={onToggleVoice}
                        className={`group flex flex-col items-center justify-center w-10 h-10 md:w-16 md:h-16 backdrop-blur-md rounded-xl md:rounded-2xl border shadow-lg transition-all hover:scale-110 active:scale-95 group ${
                            showVoiceOverlay 
                                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-400" 
                                : "bg-white/10 border-white/10 text-white/40"
                        }`}
                        title={showVoiceOverlay ? "Masquer le vocal" : "Afficher le vocal"}
                    >
                        {showVoiceOverlay ? <Mic size={24} className="w-5 h-5 md:w-8 md:h-8" /> : <MicOff size={24} className="w-5 h-5 md:w-8 md:h-8" />}
                    </button>
                )}

                {/* Spectators bubbles - Below Home button */}
                {spectators.length > 0 && (
                    <div className="flex items-center gap-3 px-4 py-2 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl">
                        <div className="flex -space-x-2">
                            {spectators.slice(0, 5).map((s, idx) => (
                                <div key={s.id || idx} className="w-8 h-8 rounded-full border-2 border-white/20 bg-zinc-900 overflow-hidden grayscale opacity-60 hover:grayscale-0 hover:opacity-100 hover:z-10 transition-all cursor-help ring-2 ring-black/10" title={s.username || s.userName}>
                                    <img src={s.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${s.username || s.userName}`} className="w-full h-full object-cover rounded-full" alt="" />
                                </div>
                            ))}
                            {spectators.length > 5 && (
                                <div className="w-8 h-8 rounded-full bg-white/10 border-2 border-white/20 flex items-center justify-center text-[10px] font-black text-white/50 backdrop-blur-sm">
                                    +{spectators.length - 5}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {onClose && (
                <button 
                    onClick={onClose}
                    className="absolute top-2 right-2 md:top-6 md:right-6 z-[200] px-4 md:px-6 py-2 md:py-3 bg-red-500 hover:bg-red-400 text-white rounded-xl md:rounded-2xl border-b-4 border-black/20 transition-all hover:scale-105 active:scale-95 shadow-2xl flex items-center gap-2 font-black italic uppercase text-[10px] md:text-xs group"
                    title="Quitter la partie"
                >
                    <LogOut size={16} className="group-hover:-translate-x-1 transition-transform" />
                    <span className="hidden sm:inline">Quitter</span>
                    <span className="sm:hidden">Sortir</span>
                </button>
            )}

            <div className="w-full relative z-10 px-4 pt-10 md:pt-16 pb-20 md:pb-24 flex flex-col items-center">
                {children}
            </div>
        </div>
    );
};
