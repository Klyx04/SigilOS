"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Crown, Users, Clock, CheckCircle2, Loader2, PlayCircle, Trophy, Target, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { DIFFICULTIES, OBJECTIVES, getEpreuve, type DifficultyKey, type ObjectiveKey } from "@/lib/songes/types";
import { closeDreamRun } from "@/server/actions/songes/dream-run-actions";
import type { DreamRun, DreamRunMember } from "@prisma/client";
import { cn } from "@/lib/utils";

type RunWithMembers = DreamRun & {
    members: DreamRunMember[];
};

interface RunDetailHeaderProps {
    run: RunWithMembers;
    guildId: string;
    isLeader?: boolean;
    leaderName?: string;
    optimisticStatus: string;
    onStatusChange: (status: string) => void;
    onOpenBossGuide?: () => void;
}

export function RunDetailHeader({ run, guildId, isLeader, leaderName, optimisticStatus, onStatusChange, onOpenBossGuide }: RunDetailHeaderProps) {
    const router = useRouter();
    const [isPending, startTransition] = useTransition();
    const [closeDialogOpen, setCloseDialogOpen] = useState(false);
    const isCompleted = optimisticStatus === "COMPLETED";
    const [loading, setLoading] = useState(false);

    const difficulty = DIFFICULTIES[run.difficulty as DifficultyKey];
    const objective = OBJECTIVES[run.objective as ObjectiveKey];
    const epreuve = getEpreuve((run as any).epreuveCode);

    const formatDate = (date: Date | null) => {
        if (!date) return "-";
        return new Date(date).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const handleCloseRun = () => {
        // Optimistic Update
        const previousStatus = optimisticStatus;
        onStatusChange("COMPLETED"); // Tell parent we are now completed
        setCloseDialogOpen(false);
        setLoading(true);

        startTransition(async () => {
            try {
                const result = await closeDreamRun(guildId, run.id);
                if (result.success) {
                    router.refresh();
                    // Keep completed state
                } else {
                    // Rollback on error
                    onStatusChange(previousStatus);
                    console.error(result.error);
                }
            } catch (e) {
                onStatusChange(previousStatus);
            }
            setLoading(false);
        });
    };

    const handleReopenRun = () => {
        const previousStatus = optimisticStatus;
        onStatusChange("IN_PROGRESS"); // Tell parent we are active again
        setLoading(true);

        startTransition(async () => {
            try {
                const { reopenDreamRun } = await import("@/server/actions/songes/dream-run-actions");
                const result = await reopenDreamRun(guildId, run.id);
                if (result.success) {
                    router.refresh();
                } else {
                    onStatusChange(previousStatus);
                    console.error(result.error);
                }
            } catch (e) {
                onStatusChange(previousStatus);
            }
            setLoading(false);
        });
    };

    const getDiffImage = (key: string | undefined) => {
        if (!key) return "reve1";
        const map: Record<string, string> = {
            REVE_I: "reve1", REVE_II: "reve2", REVE_III: "reve3",
            PARADOXE_I: "paradoxe1", PARADOXE_II: "paradoxe2", PARADOXE_III: "paradoxe3", PARADOXE_IV: "paradoxe4",
            CAUCHEMAR_I: "cauchemar1", CAUCHEMAR_II: "cauchemar2", CAUCHEMAR_III: "cauchemar3"
        };
        return map[key] || "reve1";
    };

    return (
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/5 bg-[#09090b] shadow-2xl transition-all duration-500">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-900/10 via-blue-900/5 to-transparent pointer-events-none" />
            <div
                className="absolute -top-24 -right-24 w-64 h-64 rounded-full blur-[100px] opacity-30 pointer-events-none transition-all duration-700"
                style={{
                    backgroundColor: difficulty?.couleur || '#a855f7',
                    opacity: isCompleted ? 0 : 0.3 // Fade out glow when completed
                }}
            />

            {/* Subtle Premium Watermark pattern instead of giant text */}
            {isCompleted && (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-4 right-4 animate-in fade-in zoom-in duration-700">
                        <div className="relative border border-amber-500/30 bg-amber-500/5 px-4 py-1 rounded-full backdrop-blur-sm flex items-center gap-2 shadow-[0_0_30px_rgba(245,158,11,0.1)]">
                            <Trophy className="w-4 h-4 text-amber-500" />
                            <span className="text-xs font-bold text-amber-500 uppercase tracking-widest">Run Terminée</span>
                        </div>
                    </div>
                    {/* Diagonal scanlines or subtle texture */}
                    <div className="absolute inset-0 bg-[url(/scanlines.png)] opacity-20 mix-blend-overlay" />
                    <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-amber-500/5 blur-[80px] rounded-full" />
                </div>
            )}

            <div className={`relative p-6 md:p-8 flex flex-col gap-8 z-10 transition-opacity duration-500 ${isCompleted ? "opacity-90 grayscale-[0.3]" : ""}`}>
                {/* Top Row: Back link & Title Row */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-white/5 pb-6">
                    <div className="flex flex-col gap-3">
                        <Link href={`/dashboard/${guildId}/songes`} className="text-xs text-white/40 font-bold hover:text-white transition-colors flex items-center gap-1 group uppercase tracking-widest">
                            <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-1" />
                            RETOUR AUX SONGES
                        </Link>
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-3 h-3 rounded-full shadow-[0_0_15px_currentColor] transition-colors duration-500",
                                optimisticStatus === "IN_PROGRESS" ? "bg-emerald-400 text-emerald-400 animate-pulse" :
                                    optimisticStatus === "RECRUITING" ? "bg-blue-400 text-blue-400" :
                                        optimisticStatus === "COMPLETED" ? "bg-amber-500 text-amber-500" : "bg-red-500 text-red-500"
                            )} />
                            <Image
                                src={`/assets/missions/${getDiffImage(run.difficulty)}.png`}
                                alt={difficulty?.label || "Difficulté"}
                                width={56}
                                height={56}
                                className="object-contain drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]"
                            />
                            <h1 className={cn(
                                "text-3xl md:text-5xl font-black tracking-tighter transition-colors duration-500 uppercase",
                                isCompleted ? "text-amber-500/80" : "text-white"
                            )}>
                                {difficulty?.label || "Rêve Inconnu"}
                            </h1>
                            {optimisticStatus === "IN_PROGRESS" && (
                                <span className="text-[10px] font-black px-2 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 uppercase tracking-[0.2em] transform -translate-y-1">
                                    En cours
                                </span>
                            )}
                            {/* NEW: Objective Badge for Standard runs */}
                            {!epreuve && objective && (
                                <div className="flex items-center gap-2 bg-purple-500/10 px-3 py-1 rounded-full border border-purple-500/20 text-purple-300 text-[10px] font-black uppercase tracking-widest ml-2">
                                    {objective.icon}
                                    <span>{objective.label}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Floor Counter - Integrated into top row but on the right */}
                    <div className="flex items-center gap-4 self-start md:self-end bg-white/5 px-6 py-3 rounded-2xl border border-white/10 backdrop-blur-md shadow-xl">
                        <div className="flex flex-col items-center leading-none">
                            <span className="text-[10px] uppercase text-white/30 font-black tracking-widest mb-1">Étage Actuel</span>
                            <span className={cn(
                                "text-4xl font-black transition-all duration-500",
                                isCompleted ? "text-amber-500" : "text-white"
                            )}>
                                {run.currentFloor}
                            </span>
                        </div>
                        <div className="h-8 w-px bg-white/10" />
                        <div className="flex flex-col items-center leading-none">
                            <span className="text-[10px] uppercase text-white/30 font-black tracking-widest mb-1">Objectif</span>
                            <span className="text-lg font-black text-white/60">26</span>
                        </div>
                    </div>
                </div>

                {/* Main Grid: Left (Guides/Rules) | Right (Meta/Actions) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">

                    {/* LEFT COLUMN: 8/12 - GUIDES & RULES */}
                    <div className="lg:col-span-12 xl:col-span-8 flex flex-col gap-6">
                        <div className="flex flex-wrap gap-4">
                            {/* Guide Songes */}
                            <a
                                href="https://www.dofuspourlesnoobs.com/songes-infinis.html"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-4 px-8 py-5 rounded-2xl border-2 border-blue-500/30 bg-blue-600/10 text-blue-200 hover:bg-blue-500/20 hover:text-white hover:border-blue-400 hover:-translate-y-1 shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all group font-black text-lg uppercase tracking-wider flex-1 min-w-[280px]"
                            >
                                <div className="w-2.5 h-2.5 rounded-full bg-blue-400 shadow-[0_0_10px_rgba(96,165,250,1)] animate-pulse" />
                                <span>Guide Songes</span>
                                <ArrowLeft className="w-5 h-5 rotate-[135deg] ml-auto transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                            </a>

                            {/* Guide Boss Button */}
                            {onOpenBossGuide && (
                                <button
                                    onClick={onOpenBossGuide}
                                    className="flex items-center gap-4 px-8 py-5 rounded-2xl border-2 border-emerald-500/30 bg-emerald-600/10 text-emerald-200 hover:bg-emerald-500/20 hover:text-white hover:border-emerald-400 hover:-translate-y-1 shadow-[0_0_20px_rgba(16,185,129,0.2)] transition-all group font-black text-lg uppercase tracking-wider flex-1 min-w-[280px]"
                                >
                                    <BookOpen className="w-6 h-6 group-hover:rotate-12 transition-transform drop-shadow-[0_0_10px_rgba(217,70,239,1)]" />
                                    <span>Guide Boss Songes</span>
                                    <ArrowLeft className="w-5 h-5 rotate-[135deg] ml-auto opacity-40" />
                                </button>
                            )}
                        </div>

                        {/* Rules/Épreuve Block */}
                        {epreuve && (
                            <div
                                className="relative overflow-hidden p-5 rounded-3xl border-2 backdrop-blur-sm group"
                                style={{
                                    borderColor: `${epreuve.color}30`,
                                    backgroundColor: `${epreuve.color}05`,
                                }}
                            >
                                <div className="absolute -right-4 -bottom-4 text-8xl opacity-[0.03] transition-transform group-hover:scale-110 pointer-events-none">
                                    {epreuve.icon}
                                </div>
                                <div className="flex flex-col md:flex-row gap-5 items-start">
                                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
                                        style={{ backgroundColor: `${epreuve.color}20`, border: `1px solid ${epreuve.color}40` }}>
                                        {epreuve.icon}
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-[10px] font-black uppercase tracking-[0.3em]" style={{ color: epreuve.color }}>
                                                Règle spéciale — Épreuve
                                            </span>
                                            <div className="h-px flex-1" style={{ backgroundColor: `${epreuve.color}20` }} />
                                        </div>
                                        <h3 className="text-xl font-black text-white/90 mb-2 uppercase tracking-tight">{epreuve.label}</h3>
                                        <p className="text-sm text-white/50 leading-relaxed max-w-2xl">
                                            {epreuve.description}
                                        </p>
                                        <div className="mt-4 flex items-center gap-2">
                                            <Trophy className="w-4 h-4" style={{ color: epreuve.color }} />
                                            <span className="text-[11px] font-bold italic opacity-40">Aucun butin ni expérience durant cette épreuve.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: 4/12 - ACTIONS & METADATA */}
                    <div className="lg:col-span-12 xl:col-span-4 flex flex-col gap-6 lg:border-l lg:border-white/5 lg:pl-8">
                        {/* Leader Actions */}
                        {isLeader && (
                            <div className="flex flex-col gap-3">
                                <span className="text-[10px] font-black text-white/20 uppercase tracking-widest pl-1">Actions Chef de Run</span>
                                {optimisticStatus === "IN_PROGRESS" && (
                                    <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button
                                                className="w-full bg-amber-500 hover:bg-amber-400 text-black font-black uppercase tracking-widest h-14 shadow-lg shadow-amber-900/20 active:scale-95"
                                            >
                                                <CheckCircle2 className="w-5 h-5 mr-3" />
                                                Clôturer la Run
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="bg-[#09090b] border-white/10 text-white sm:max-w-md">
                                            <DialogHeader>
                                                <DialogTitle className="text-xl font-black flex items-center gap-2 uppercase tracking-tight">
                                                    <Trophy className="w-5 h-5 text-amber-500" />
                                                    Confirmer la Clôture
                                                </DialogTitle>
                                            </DialogHeader>
                                            <div className="py-4 space-y-3">
                                                <p className="text-white/80">Voulez-vous vraiment terminer cette aventure ?</p>
                                                <p className="text-xs text-white/40 leading-relaxed bg-white/5 p-3 rounded-lg">
                                                    Une fois clôturée, la run est archivée dans l'historique et les récompenses finales sont figées.
                                                </p>
                                            </div>
                                            <div className="flex justify-end gap-3 mt-4">
                                                <Button variant="ghost" onClick={() => setCloseDialogOpen(false)}>Annuler</Button>
                                                <Button onClick={handleCloseRun} disabled={loading} className="bg-amber-600 hover:bg-amber-500 text-white">
                                                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Terminer la Run"}
                                                </Button>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                )}
                                {optimisticStatus === "COMPLETED" && (
                                    <Button
                                        onClick={handleReopenRun}
                                        disabled={loading}
                                        className="w-full bg-white/5 hover:bg-white/10 text-white font-black uppercase tracking-widest h-14 border border-white/10"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-5 h-5 mr-3" />}
                                        Réouvrir la Run
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Metadata Card */}
                        <div className="bg-white/3 rounded-2xl p-5 border border-white/5 flex flex-col gap-4">
                            <span className="text-[10px] font-black text-white/20 uppercase tracking-widest">Détails de l'expédition</span>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5 col-span-2">
                                    <div className="flex items-center gap-2 text-amber-500/60">
                                        <Crown className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-bold uppercase tracking-tighter">Chef d'expédition</span>
                                    </div>
                                    <span className="text-sm font-black text-white/90">{leaderName || "Chargement..."}</span>
                                </div>
                                <div className="h-px bg-white/5 col-span-2 my-1" />
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2 text-white/40">
                                        <Users className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-bold uppercase tracking-tighter">Équipage</span>
                                    </div>
                                    <span className="text-sm font-black text-white/80">{run.members.length} / 4</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2 text-white/40">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="text-[10px] font-bold uppercase tracking-tighter">Créée</span>
                                    </div>
                                    <span className="text-sm font-black text-white/80">{formatDate(run.createdAt)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
