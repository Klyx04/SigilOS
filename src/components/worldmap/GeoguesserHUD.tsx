'use client';
// dark-locked — module volontairement sombre (V2 Dual-Theme Phase 2C)

import React from 'react';
import { Clock, Trophy, CheckCircle2, Loader2, Eye, MapPin, Lock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Participant {
    userId: string;
    userName: string;
    userAvatar?: string;
    score: number;
    hasGuessed?: boolean;
    isSpectator?: boolean;
    isConnected?: boolean;
}

interface GeoguesserHUDProps {
    round: number;
    maxRounds: number;
    timeLeft: number;
    score: number;
    gamePhase: 'playing' | 'result' | 'summary' | 'countdown';
    participants?: Participant[];
    spectators?: Participant[];
    currentUserId?: string;
    hasGuessed?: boolean;
    onReportMap?: () => void;
}

export default function GeoguesserHUD({
    round,
    maxRounds,
    timeLeft,
    score,
    gamePhase,
    participants = [],
    spectators = [],
    currentUserId,
    hasGuessed = false,
}: GeoguesserHUDProps) {
    const activePlayers = participants.filter(p => !p.isSpectator && p.isConnected !== false);
    const guessedCount = activePlayers.filter(p => p.hasGuessed).length;
    const totalActive = activePlayers.length;

    return (
        <div className="flex flex-col items-center gap-2 pointer-events-auto select-none">
            {/* Top Bar: Round + Timer + Score */}
            <div className="flex items-center justify-center gap-2 sm:gap-3 bg-surface/90 backdrop-blur-md border border-border p-1.5 sm:p-2 rounded-2xl shadow-2xl">
                {/* Round */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-background/80 rounded-xl border border-border">
                    <span className="text-caption font-bold text-muted-foreground uppercase">Round</span>
                    <span className="text-sm font-black text-foreground">
                        {round}<span className="text-muted-foreground font-normal text-xs">/{maxRounds}</span>
                    </span>
                </div>

                {/* Timer — plus visible en jeu (#126) */}
                <div className={cn(
                    "flex items-center gap-2.5 px-5 py-2 rounded-xl border transition-all",
                    timeLeft <= 5
                        ? "bg-rose-500/25 border-rose-500/60 text-rose-500 animate-pulse"
                        : timeLeft <= 10
                            ? "bg-amber-500/25 border-amber-500/50 text-amber-500"
                            : "bg-background/80 border-border text-foreground"
                )}>
                    <Clock size={18} className={cn("shrink-0", timeLeft <= 5 && "animate-spin")} />
                    <span className="text-lg font-black font-mono tabular-nums leading-none">
                        {timeLeft}s
                    </span>
                </div>

                {/* Score */}
                <div className="flex items-center gap-2 px-3 py-1.5 bg-background/80 rounded-xl border border-border">
                    <Trophy size={14} className="text-amber-500" />
                    <span className="text-caption font-bold text-muted-foreground uppercase hidden sm:inline">Score</span>
                    <span className="text-sm font-black text-amber-500 font-mono">
                        {score}
                    </span>
                </div>
            </div>

            {/* Sub-bar: Player Progress & Validation Status in Multiplayer */}
            {activePlayers.length > 1 && gamePhase === 'playing' && (
                <div className="flex items-center gap-2 px-3 py-1 bg-surface/80 backdrop-blur-md border border-border rounded-full text-xs shadow-lg animate-in fade-in duration-200">
                    <span className="text-muted-foreground text-caption font-medium">
                        Validations : <strong className="text-foreground font-bold">{guessedCount}/{totalActive}</strong>
                    </span>

                    <div className="h-3 w-px bg-border mx-1" />

                    <div className="flex items-center gap-1.5 overflow-x-auto max-w-[280px] sm:max-w-md custom-scrollbar">
                        {activePlayers.map((p) => {
                            const isMe = p.userId === currentUserId;
                            return (
                                <div
                                    key={p.userId}
                                    className={cn(
                                        "flex items-center gap-1 px-2 py-0.5 rounded-full text-caption border transition-all",
                                        p.hasGuessed
                                            ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-300"
                                            : "bg-background border-border text-muted-foreground"
                                    )}
                                    title={`${p.userName} : ${p.hasGuessed ? 'A validé son choix' : 'En recherche...'}`}
                                >
                                    {p.hasGuessed ? (
                                        <CheckCircle2 size={10} className="text-emerald-500 shrink-0" />
                                    ) : (
                                        <Loader2 size={10} className="animate-spin text-muted-foreground shrink-0" />
                                    )}
                                    <span className="truncate max-w-[70px] font-medium">
                                        {isMe ? 'Toi' : p.userName}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Personal Status Badge if Guessed */}
            {hasGuessed && gamePhase === 'playing' && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-950/80 border border-emerald-500/40 text-emerald-300 text-caption font-bold rounded-full shadow-lg backdrop-blur-sm animate-in fade-in zoom-in-95">
                    <Lock size={12} className="text-emerald-400" />
                    <span>Position validée ! En attente de la fin du tour...</span>
                </div>
            )}

            {/* Spectators indicator */}
            {spectators.length > 0 && (
                <div className="flex items-center gap-1 text-caption text-zinc-500 font-medium">
                    <Eye size={12} />
                    <span>{spectators.length} spectateur{spectators.length > 1 ? 's' : ''}</span>
                </div>
            )}
        </div>
    );
}
