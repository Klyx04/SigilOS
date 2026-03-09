'use client';

import React from 'react';
import { Clock, Trophy, Target } from 'lucide-react';

interface GeoguesserHUDProps {
    round: number;
    maxRounds: number;
    timeLeft: number;
    score: number;
    gamePhase: 'playing' | 'result' | 'summary';
}

export default function GeoguesserHUD({ round, maxRounds, timeLeft, score, gamePhase }: GeoguesserHUDProps) {
    return (
        <div className="flex items-center gap-4 animate-in slide-in-from-top-10 duration-700 pointer-events-auto">
            {/* Round Indicator */}
            <div className="flex flex-col items-center justify-center px-6 py-2 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                <span className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em] mb-0.5">Round</span>
                <span className="text-white font-black text-xl italic tracking-tighter leading-none">
                    {round}<span className="text-white/20">/{maxRounds}</span>
                </span>
            </div>

            {/* Timer */}
            <div className={`flex flex-col items-center justify-center px-8 py-3 bg-slate-900/90 backdrop-blur-2xl border-2 transition-colors duration-300 rounded-[2rem] shadow-[0_0_40px_rgba(0,0,0,0.5)] ${timeLeft <= 10 ? 'border-red-500/50' : 'border-emerald-500/30'}`}>
                <span className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em] mb-0.5">Temps</span>
                <div className="flex items-center gap-2">
                    <Clock size={16} className={timeLeft <= 10 ? 'text-red-500 animate-pulse' : 'text-emerald-500'} />
                    <span className={`text-2xl font-black italic tracking-tighter leading-none ${timeLeft <= 10 ? 'text-red-500' : 'text-white'}`}>
                        {timeLeft}s
                    </span>
                </div>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center justify-center px-6 py-2 bg-slate-900/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl">
                <span className="text-[9px] text-white/30 font-black uppercase tracking-[0.2em] mb-0.5">Score</span>
                <div className="flex items-center gap-2">
                    <Trophy size={14} className="text-amber-500" />
                    <span className="text-white font-black text-xl italic tracking-tighter leading-none">{score}</span>
                </div>
            </div>
        </div>
    );
}
