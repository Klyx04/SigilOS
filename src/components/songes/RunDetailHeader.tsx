"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Crown, Users, Clock, CheckCircle2, Loader2, PlayCircle, Trophy, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { DIFFICULTIES, OBJECTIVES, type DifficultyKey, type ObjectiveKey } from "@/lib/songes/types";
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
    optimisticStatus: string;
    onStatusChange: (status: string) => void;
}

export function RunDetailHeader({ run, guildId, isLeader, optimisticStatus, onStatusChange }: RunDetailHeaderProps) {
    const router = useRouter();
    const [closeDialogOpen, setCloseDialogOpen] = useState(false);
    const isCompleted = optimisticStatus === "COMPLETED";
    const [loading, setLoading] = useState(false);

    const difficulty = DIFFICULTIES[run.difficulty as DifficultyKey];
    const objective = OBJECTIVES[run.objective as ObjectiveKey];

    const formatDate = (date: Date | null) => {
        if (!date) return "-";
        return new Date(date).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    const handleCloseRun = async () => {
        // Optimistic Update
        const previousStatus = optimisticStatus;
        onStatusChange("COMPLETED"); // Tell parent we are now completed
        setCloseDialogOpen(false);
        setLoading(true);

        try {
            const result = await closeDreamRun(run.id);
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
    };

    const handleReopenRun = async () => {
        const previousStatus = optimisticStatus;
        onStatusChange("IN_PROGRESS"); // Tell parent we are active again
        setLoading(true);

        try {
            const { reopenDreamRun } = await import("@/server/actions/songes/dream-run-actions");
            const result = await reopenDreamRun(run.id);
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
    }

    return (
        <div className="relative w-full overflow-hidden rounded-2xl border border-white/5 bg-[#0a0415] shadow-2xl transition-all duration-500">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-r from-purple-900/20 via-blue-900/10 to-transparent pointer-events-none" />
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
                    <div className="absolute inset-0 bg-[url('/scanlines.png')] opacity-20 mix-blend-overlay" />
                    <div className="absolute -right-20 -bottom-20 w-80 h-80 bg-amber-500/5 blur-[80px] rounded-full" />
                </div>
            )}

            <div className={`relative p-6 md:p-8 flex flex-col gap-6 z-10 transition-opacity duration-500 ${isCompleted ? "opacity-90 grayscale-[0.3]" : ""}`}>
                {/* Top Row: Back link & Breadcrumbs */}
                <div className="flex items-center gap-2 text-sm text-white/40 font-medium">
                    <Link href={`/dashboard/${guildId}/songes`} className="hover:text-white transition-colors flex items-center gap-1 group">
                        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                        RETOUR
                    </Link>
                </div>

                {/* Main Content Info */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">

                    {/* LEFTSIDE: Title & Meta */}
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-4">
                            {/* Status Dot */}
                            <div className={cn(
                                "w-3 h-3 rounded-full shadow-[0_0_10px_currentColor] transition-colors duration-500",
                                optimisticStatus === "IN_PROGRESS" ? "bg-emerald-400 text-emerald-400 animate-pulse" :
                                    optimisticStatus === "RECRUITING" ? "bg-blue-400 text-blue-400" :
                                        optimisticStatus === "COMPLETED" ? "bg-amber-500 text-amber-500 shadow-none border border-amber-500/50" : "bg-red-500 text-red-500"
                            )} />

                            <h1 className={cn(
                                "text-3xl md:text-4xl font-black tracking-tight flex items-center gap-3 transition-colors duration-500",
                                isCompleted ? "text-amber-500/60" : "text-white"
                            )}>
                                {difficulty?.label || "Rêve Inconnu"}
                                {optimisticStatus === "IN_PROGRESS" && (
                                    <span className="text-xs font-bold px-2 py-0.5 rounded bg-white/5 border border-white/10 text-emerald-400 uppercase tracking-wider ml-2 align-middle transform -translate-y-1">
                                        En cours
                                    </span>
                                )}
                            </h1>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-purple-200/60 mt-1">
                            {/* Objective Badge */}
                            <div className="flex items-center gap-2 bg-white/5 px-3 py-1 rounded-full border border-white/5 hover:bg-white/10 transition-colors">
                                {objective?.icon || <Target className="w-4 h-4" />}
                                <span className="font-medium text-white/80">{objective?.label}</span>
                            </div>

                            {/* Doc Link */}
                            <a
                                href="https://www.dofuspourlesnoobs.com/songes-infinis.html"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 px-3 py-1 rounded-full border border-blue-500/20 bg-blue-500/10 text-blue-300 hover:bg-blue-500/20 hover:text-white transition-all group"
                            >
                                <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                <span className="font-medium">Documentation Songes</span>
                                <ArrowLeft className="w-3 h-3 rotate-[135deg] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                            </a>
                        </div>

                        {/* Metadata Row */}
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/40 mt-4 font-mono uppercase tracking-wide">
                            <div className="flex items-center gap-2">
                                <Users className="w-3.5 h-3.5" />
                                <span>{run.members.length}/4 membres</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <Clock className="w-3.5 h-3.5" />
                                <span>Créé le {formatDate(run.createdAt)}</span>
                            </div>
                            {run.startedAt && (
                                <div className="flex items-center gap-2 text-emerald-400/60">
                                    <PlayCircle className="w-3.5 h-3.5" />
                                    <span>Démarré le {formatDate(run.startedAt)}</span>
                                </div>
                            )}
                            {(run.completedAt || isCompleted) && (
                                <div className="flex items-center gap-2 text-amber-400/60 animate-in fade-in">
                                    <Trophy className="w-3.5 h-3.5" />
                                    <span>Terminé le {formatDate(run.completedAt || new Date())}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* RIGHTSIDE: Progress & Actions */}
                    <div className="flex items-center gap-6 md:border-l md:border-white/10 md:pl-8">
                        {/* Floor Counter */}
                        <div className="flex flex-col items-end">
                            <span className={cn(
                                "text-4xl font-black text-transparent bg-clip-text bg-gradient-to-br transition-all duration-500",
                                isCompleted ? "from-amber-500/50 to-amber-500/20" : "from-white to-white/50"
                            )}>
                                {run.currentFloor}
                            </span>
                            <span className="text-xs uppercase text-white/30 font-bold tracking-widest">
                                / 26 Étages
                            </span>
                        </div>

                        {/* Action Buttons */}
                        {isLeader && (
                            <>
                                {/* CLOSE BUTTON */}
                                {optimisticStatus === "IN_PROGRESS" && (
                                    <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button
                                                id="trigger-close-run"
                                                className="bg-amber-500 hover:bg-amber-400 text-black font-bold uppercase tracking-wider px-6 py-6 shadow-lg shadow-amber-900/20 hover:shadow-amber-500/20 transition-all active:scale-95"
                                            >
                                                <CheckCircle2 className="w-5 h-5 mr-2" />
                                                Clôturer
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="bg-[#0f0518] border-purple-500/20 text-white sm:max-w-md">
                                            <DialogHeader>
                                                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                                                    <Trophy className="w-5 h-5 text-amber-500" />
                                                    Clôturer la run ?
                                                </DialogTitle>
                                            </DialogHeader>
                                            <div className="py-4 text-white/70">
                                                <p>Cette action <strong>terminera définitivement la run</strong>.</p>
                                                <p className="mt-2 text-sm text-white/50">Assurez-vous d'avoir vaincu le dernier boss ou de vouloir abandonner.</p>
                                            </div>
                                            <div className="flex justify-end gap-3 mt-4">
                                                <Button
                                                    variant="ghost"
                                                    onClick={() => setCloseDialogOpen(false)}
                                                    className="hover:bg-white/5 hover:text-white"
                                                >
                                                    Annuler
                                                </Button>
                                                <Button
                                                    onClick={handleCloseRun}
                                                    disabled={loading}
                                                    className="bg-amber-600 hover:bg-amber-500 text-white border-none"
                                                >
                                                    {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                                    Confirmer la fin
                                                </Button>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                )}

                                {/* REOPEN BUTTON using Optimistic UI transition */}
                                {optimisticStatus === "COMPLETED" && (
                                    <Button
                                        onClick={handleReopenRun}
                                        disabled={loading}
                                        className="bg-white/5 hover:bg-white/10 text-white font-bold uppercase tracking-wider px-6 py-6 border border-white/10 hover:border-white/20 transition-all animate-in fade-in zoom-in"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-5 h-5 mr-2" />}
                                        Réouvrir
                                    </Button>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
