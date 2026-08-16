'use client';
// dark-locked — module volontairement sombre (V2 Dual-Theme Phase 2C) : ne PAS utiliser les tokens thème-aware ici (voir memo 21/08 + prompt 22/08).

import React from 'react';
import { Clock, Trophy, Flag } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeoguesserHUDProps {
    round: number;
    maxRounds: number;
    timeLeft: number;
    score: number;
    gamePhase: 'playing' | 'result' | 'summary';
    spectators?: any[];
    onReportMap?: () => void;
}

export default function GeoguesserHUD({ round, maxRounds, timeLeft, score, gamePhase, spectators = [], onReportMap }: GeoguesserHUDProps) {
    return (
        <div className="flex items-center justify-center gap-2 sm:gap-4 animate-in slide-in-from-top-10 duration-300 pointer-events-auto">
            {/* Spectators - Floating on the left */}
            {spectators.length > 0 && (
                <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-surface border border-border rounded-2xl mr-2">
                    <div className="flex -space-x-2">
                        {spectators.slice(0, 3).map(s => (
                             <div key={s.userId || s.id} className="w-6 h-6 rounded-lg border border-black p-0.5 bg-surface overflow-hidden grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all cursor-help relative" title={s.userName}>
                                 <img src={s.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${s.userName}`} className="w-full h-full object-cover rounded-md" alt="" />
                             </div>
                        ))}
                        {spectators.length > 3 && (
                            <div className="w-6 h-6 rounded-lg bg-elevated border border-border flex items-center justify-center text-caption font-black text-foreground/40">
                                +{spectators.length - 3}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Round Indicator */}
            <div className="flex flex-col items-center justify-center px-4 py-2 sm:px-6 bg-[#1a1c23]/90 backdrop-blur-xl border border-border rounded-xl sm:rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
                <span className="text-caption sm:text-caption text-foreground/30 font-black uppercase tracking-[0.2em] mb-0.5 italic">Round</span>
                <span className="text-foreground font-black text-lg sm:text-xl italic tracking-tighter leading-none">
                    {round}<span className="text-foreground/20">/{maxRounds}</span>
                </span>
            </div>

            {/* Timer */}
            <div className={cn(
                "group flex flex-col items-center justify-center px-6 py-2 sm:px-10 sm:py-4 bg-[#1a1c23] border-2 transition-all duration-300 rounded-2xl sm:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] ring-1 ring-white/10",
                timeLeft <= 10 ? "border-danger/60 ring-danger/20" : "border-[#a78bfa]/30 ring-info/20"
            )}>
                <span className="text-caption sm:text-caption text-foreground/30 font-black uppercase tracking-[0.2em] mb-0.5 italic">Temps restant</span>
                <div className="flex items-center gap-2 sm:gap-3">
                    <Clock size={16} className={cn(
                        "sm:w-5 sm:h-5 transition-transform duration-300",
                        timeLeft <= 10 ? "text-danger animate-pulse scale-110" : "text-[#a78bfa]"
                    )} />
                    <span className={cn(
                        "text-xl sm:text-3xl font-black italic tracking-tighter leading-none transition-colors",
                        timeLeft <= 10 ? "text-danger" : "text-foreground"
                    )}>
                        {timeLeft}s
                    </span>
                </div>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center justify-center px-4 py-2 sm:px-6 bg-[#1a1c23]/90 backdrop-blur-xl border border-border rounded-xl sm:rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
                <span className="text-caption sm:text-caption text-foreground/30 font-black uppercase tracking-[0.2em] mb-0.5 italic">Score</span>
                <div className="flex items-center gap-1 sm:gap-2">
                    <Trophy size={14} className="text-warning sm:w-4 sm:h-4 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
                    <span className="text-foreground font-black text-2xl sm:text-3xl italic tracking-tighter leading-none">{score}</span>
                </div>
            </div>

            {/* Report Button removed from playing phase per user request. Available in result phase only. */}
        </div>
    );
}
