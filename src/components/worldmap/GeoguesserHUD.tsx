'use client';

import React from 'react';
import { Clock, Trophy, Target } from 'lucide-react';
import { cn } from '@/lib/utils';

interface GeoguesserHUDProps {
    round: number;
    maxRounds: number;
    timeLeft: number;
    score: number;
    gamePhase: 'playing' | 'result' | 'summary';
    spectators?: any[];
}

export default function GeoguesserHUD({ round, maxRounds, timeLeft, score, gamePhase, spectators = [] }: GeoguesserHUDProps) {
    return (
        <div className="flex items-center justify-center gap-2 sm:gap-4 animate-in slide-in-from-top-10 duration-700 pointer-events-auto">
            {/* Spectators - Floating on the left */}
            {spectators.length > 0 && (
                <div className="hidden lg:flex items-center gap-3 px-4 py-2 bg-slate-900/40 backdrop-blur-md border border-white/5 rounded-2xl mr-2">
                    <div className="flex -space-x-2">
                        {spectators.slice(0, 3).map(s => (
                            <div key={s.userId || s.id} className="w-6 h-6 rounded-lg border border-black p-0.5 bg-zinc-900 overflow-hidden grayscale opacity-60 hover:grayscale-0 hover:opacity-100 transition-all cursor-help" title={s.userName}>
                                <img src={s.userAvatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${s.userName}`} className="w-full h-full object-cover rounded-md" alt="" />
                            </div>
                        ))}
                        {spectators.length > 3 && (
                            <div className="w-6 h-6 rounded-lg bg-zinc-800 border border-white/5 flex items-center justify-center text-[8px] font-black text-white/40">
                                +{spectators.length - 3}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Round Indicator */}
            <div className="flex flex-col items-center justify-center px-4 py-2 sm:px-6 bg-[#1a1c23]/90 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
                <span className="text-[8px] sm:text-[9px] text-white/30 font-black uppercase tracking-[0.2em] mb-0.5 italic">Round</span>
                <span className="text-white font-black text-lg sm:text-xl italic tracking-tighter leading-none">
                    {round}<span className="text-white/20">/{maxRounds}</span>
                </span>
            </div>

            {/* Timer */}
            <div className={cn(
                "group flex flex-col items-center justify-center px-6 py-2 sm:px-10 sm:py-4 bg-[#1a1c23]/95 backdrop-blur-2xl border-2 transition-all duration-500 rounded-2xl sm:rounded-[2.5rem] shadow-[0_20px_50px_rgba(0,0,0,0.8)] ring-1 ring-white/10",
                timeLeft <= 10 ? "border-red-500/60 ring-red-500/20" : "border-[#a78bfa]/30 ring-purple-500/20"
            )}>
                <span className="text-[8px] sm:text-[9px] text-white/30 font-black uppercase tracking-[0.2em] mb-0.5 italic">Temps restant</span>
                <div className="flex items-center gap-2 sm:gap-3">
                    <Clock size={16} className={cn(
                        "sm:w-5 sm:h-5 transition-transform duration-500",
                        timeLeft <= 10 ? "text-red-500 animate-pulse scale-110" : "text-[#a78bfa]"
                    )} />
                    <span className={cn(
                        "text-xl sm:text-3xl font-black italic tracking-tighter leading-none transition-colors",
                        timeLeft <= 10 ? "text-red-500" : "text-white"
                    )}>
                        {timeLeft}s
                    </span>
                </div>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center justify-center px-4 py-2 sm:px-6 bg-[#1a1c23]/90 backdrop-blur-xl border border-white/10 rounded-xl sm:rounded-2xl shadow-[0_10px_30px_rgba(0,0,0,0.5)] ring-1 ring-white/5">
                <span className="text-[8px] sm:text-[9px] text-white/30 font-black uppercase tracking-[0.2em] mb-0.5 italic">Score</span>
                <div className="flex items-center gap-1 sm:gap-2">
                    <Trophy size={14} className="text-amber-400 sm:w-4 sm:h-4 drop-shadow-[0_0_8px_rgba(251,191,36,0.4)]" />
                    <span className="text-white font-black text-lg sm:text-xl italic tracking-tighter leading-none">{score}</span>
                </div>
            </div>
        </div>
    );
}
