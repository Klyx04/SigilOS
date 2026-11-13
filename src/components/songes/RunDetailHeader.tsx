"use client";
// Songes — surfaces et actions sur les TOKENS du thème (accent unique : info) ; contrat : src/lib/songes/ui.ts

import { useState, useTransition } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Crown, Users, Clock, CheckCircle2, Loader2, PlayCircle, Trophy, Target, BookOpen, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DIFFICULTIES, OBJECTIVES, EPREUVES_SONGE, getEpreuve, type DifficultyKey, type ObjectiveKey } from "@/lib/songes/types";
import { SongesPicto } from "./SongesPicto";
import { SONGES_BUTTON } from "@/lib/songes/ui";
import { closeDreamRun, updateDreamRun } from "@/server/actions/songes/dream-run-actions";
import type { DreamRun, DreamRunMember } from "@prisma/client";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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

    // ── Chantier Songes : édition de la run ──
    const [editOpen, setEditOpen] = useState(false);
    const [editPending, setEditPending] = useState(false);
    const [editForm, setEditForm] = useState<{
        difficulty: string;
        objectives: string[];
        epreuveCode: string;
        date: string;
        time: string;
        currentFloor: string;
    }>({
        difficulty: run.difficulty,
        objectives: Array.isArray(run.objectives) ? (run.objectives as string[]) : (run.objective ? [run.objective] : []),
        epreuveCode: (run as any).epreuveCode || "",
        date: "",
        time: "21:00",
        currentFloor: String(run.currentFloor),
    });

    const openEdit = () => {
        const scheduled = run.scheduledAt ? new Date(run.scheduledAt) : null;
        setEditForm({
            difficulty: run.difficulty,
            objectives: Array.isArray(run.objectives) ? (run.objectives as string[]) : (run.objective ? [run.objective] : []),
            epreuveCode: (run as any).epreuveCode || "",
            date: scheduled ? `${scheduled.getFullYear()}-${String(scheduled.getMonth() + 1).padStart(2, "0")}-${String(scheduled.getDate()).padStart(2, "0")}` : "",
            time: scheduled ? `${String(scheduled.getHours()).padStart(2, "0")}:${String(scheduled.getMinutes()).padStart(2, "0")}` : "21:00",
            currentFloor: String(run.currentFloor),
        });
        setEditOpen(true);
    };

    const toggleEditObjective = (key: string) => {
        setEditForm(prev => ({
            ...prev,
            objectives: prev.objectives.includes(key)
                ? prev.objectives.filter(o => o !== key)
                : [...prev.objectives, key],
        }));
    };

    const handleEditSubmit = async () => {
        setEditPending(true);
        try {
            let scheduledAt: Date | null = null;
            if (editForm.date) {
                const [y, m, d] = editForm.date.split("-").map(Number);
                const [hh, mm] = (editForm.time || "21:00").split(":").map(Number);
                if (y && m && d) scheduledAt = new Date(y, m - 1, d, hh || 0, mm || 0, 0, 0);
            }
            const result = await updateDreamRun(guildId, run.id, {
                difficulty: editForm.difficulty as any,
                objectives: editForm.objectives as any,
                epreuveCode: editForm.epreuveCode || null,
                scheduledAt,
                mentionRoleIds: [],
                currentFloor: editForm.currentFloor ? Math.max(0, Math.min(26, parseInt(editForm.currentFloor, 10) || 0)) : undefined,
            });
            if (result.success) {
                toast.success("Run mise à jour !");
                setEditOpen(false);
                router.refresh();
            } else {
                toast.error(result.error || "Erreur lors de la mise à jour");
            }
        } catch (e) {
            toast.error("Erreur lors de la mise à jour");
        } finally {
            setEditPending(false);
        }
    };

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
        <div className="relative w-full overflow-hidden rounded-lg border border-border bg-surface/90 transition-all duration-300">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-info/10 pointer-events-none" />
            <div
                style={{
                    backgroundColor: difficulty?.couleur || '#a855f7',
                    opacity: isCompleted ? 0 : 0.3 // Fade out glow when completed
                }}
            />

            {/* Subtle Premium Watermark pattern instead of giant text */}
            {isCompleted && (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                    <div className="absolute top-4 right-4 duration-300">
                        <div className="relative border border-warning/40 bg-warning/15 px-4 py-1 rounded-full flex items-center gap-2">
                            <Trophy className="w-4 h-4 text-warning" />
                            <span className="text-xs font-bold text-warning uppercase tracking-wider">Run Terminée</span>
                        </div>
                    </div>
                    {/* Diagonal scanlines or subtle texture */}
                    <div className="absolute inset-0 bg-[url(/scanlines.png)] opacity-20 mix-blend-overlay" />
                </div>
            )}

            <div className={`relative p-6 md:p-8 flex flex-col gap-8 z-10 transition-opacity duration-300 ${isCompleted ? "opacity-90 grayscale-[0.3]" : ""}`}>
                {/* Top Row: Back link & Title Row */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-border pb-6">
                    <div className="flex flex-col gap-3">
                        <Link href={`/dashboard/${guildId}/songes`} className="text-xs text-muted-foreground font-bold hover:text-foreground transition-colors flex items-center gap-1 group uppercase tracking-wider">
                            <ArrowLeft className="w-3 h-3 transition-transform group-hover:-translate-x-1" />
                            RETOUR AUX SONGES
                        </Link>
                        <div className="flex items-center gap-4">
                            <div className={cn(
                                "w-3 h-3 rounded-full  transition-colors duration-300",
                                optimisticStatus === "IN_PROGRESS" ? "bg-success/15 text-success " :
                                    optimisticStatus === "RECRUITING" ? "bg-info/15 text-info" :
                                        optimisticStatus === "COMPLETED" ? "bg-warning/15 text-warning" : "bg-danger/15 text-danger"
                            )} />
                            <Image
                                src={`/assets/missions/${getDiffImage(run.difficulty)}.png`}
                                alt={difficulty?.label || "Difficulté"}
                                width={56}
                                height={56}
                                className="object-contain"
                            />
                            <h1 className={cn(
                                "text-3xl md:text-5xl font-semibold tracking-tight transition-colors duration-300 uppercase",
                                isCompleted ? "text-warning" : "text-foreground"
                            )}>
                                {difficulty?.label || "Rêve Inconnu"}
                            </h1>
                            {optimisticStatus === "IN_PROGRESS" && (
                                <span className="text-caption font-semibold px-2 py-1 rounded bg-success/15 border border-success/40 text-success uppercase tracking-wider transform -translate-y-1">
                                    En cours
                                </span>
                            )}
                            {/* NEW: Objective Badge for Standard runs */}
                            {!epreuve && objective && (
                                <div className="flex items-center gap-2 bg-surface/40 px-3 py-1 rounded-full border border-border text-muted-foreground text-caption font-semibold uppercase tracking-wider ml-2">
                                    <SongesPicto asset={objective.asset} size={16} title={objective.label} />
                                    <span>{objective.label}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Floor Counter - Integrated into top row but on the right */}
                    <div className="flex items-center gap-4 self-start md:self-end bg-surface px-6 py-3 rounded-lg border border-border">
                        <div className="flex flex-col items-center leading-none">
                            <span className="text-caption uppercase text-foreground/30 font-semibold tracking-wider mb-1">Étage Actuel</span>
                            <span className={cn(
                                "text-4xl font-semibold transition-all duration-300",
                                isCompleted ? "text-warning" : "text-foreground"
                            )}>
                                {run.currentFloor}
                            </span>
                        </div>
                        <div className="h-8 w-px bg-surface" />
                        <div className="flex flex-col items-center leading-none">
                            <span className="text-caption uppercase text-foreground/30 font-semibold tracking-wider mb-1">Objectif</span>
                            <span className="text-lg font-semibold text-foreground/60">26</span>
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
                                className="flex items-center gap-4 px-8 py-5 rounded-lg border border-border bg-surface/40 text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors group font-semibold text-lg uppercase tracking-wider flex-1 min-w-[280px]"
                            >
                                <div className="w-2.5 h-2.5 rounded-full bg-info/15" />
                                <span>Guide Songes</span>
                                <ArrowLeft className="w-5 h-5 rotate-[135deg] ml-auto transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                            </a>

                            {/* Guide Boss Button */}
                            {onOpenBossGuide && (
                                <button
                                    onClick={onOpenBossGuide}
                                    className="flex items-center gap-4 px-8 py-5 rounded-lg border border-border bg-surface/40 text-muted-foreground hover:bg-elevated hover:text-foreground transition-colors group font-semibold text-lg uppercase tracking-wider flex-1 min-w-[280px]"
                                >
                                    <BookOpen className="w-6 h-6 group-hover:rotate-12 transition-transform" />
                                    <span>Guide Boss Songes</span>
                                    <ArrowLeft className="w-5 h-5 rotate-[135deg] ml-auto opacity-40" />
                                </button>
                            )}
                        </div>

                        {/* Rules/Épreuve Block */}
                        {epreuve && (
                            <div
                                className="relative overflow-hidden p-5 rounded-lg border-2 group"
                                style={{
                                    borderColor: `${epreuve.color}30`,
                                    backgroundColor: `${epreuve.color}05`,
                                }}
                            >
                                <div className="absolute -right-4 -bottom-4 opacity-[0.06] transition-transform group- pointer-events-none">
                                    <SongesPicto asset={epreuve.asset} size={120} />
                                </div>
                                <div className="flex flex-col md:flex-row gap-5 items-start">
                                    <div className="w-14 h-14 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ backgroundColor: `${epreuve.color}20`, border: `1px solid ${epreuve.color}40` }}>
                                        <SongesPicto asset={epreuve.asset} size={32} title={epreuve.label} />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <span className="text-caption font-semibold uppercase tracking-wider" style={{ color: epreuve.color }}>
                                                Règle spéciale — Épreuve
                                            </span>
                                            <div className="h-px flex-1" style={{ backgroundColor: `${epreuve.color}20` }} />
                                        </div>
                                        <h3 className="text-xl font-semibold text-foreground/90 mb-2 uppercase tracking-tight">{epreuve.label}</h3>
                                        <p className="text-sm text-foreground/50 leading-relaxed max-w-2xl">
                                            {epreuve.description}
                                        </p>
                                        <div className="mt-4 flex items-center gap-2">
                                            <Trophy className="w-4 h-4" style={{ color: epreuve.color }} />
                                            <span className="text-caption font-bold italic opacity-40">Aucun butin ni expérience durant cette épreuve.</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* RIGHT COLUMN: 4/12 - ACTIONS & METADATA */}
                    <div className="lg:col-span-12 xl:col-span-4 flex flex-col gap-6 lg:border-l lg:border-border lg:pl-8">
                        {/* Leader Actions */}
                        {isLeader && (
                            <div className="flex flex-col gap-3">
                                <span className="text-caption font-semibold text-foreground/20 uppercase tracking-wider pl-1">Actions Chef de Run</span>
                                {!isCompleted && (
                                    <Button
                                        onClick={openEdit}
                                        className="w-full bg-surface hover:bg-surface text-foreground font-semibold uppercase tracking-wider h-14 border border-border"
                                    >
                                        <Pencil className="w-5 h-5 mr-3" />
                                        Modifier la Run
                                    </Button>
                                )}
                                {optimisticStatus === "IN_PROGRESS" && (
                                    <Dialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button
                                                className={cn(SONGES_BUTTON.close, "w-full uppercase tracking-wider h-14  ")}
                                            >
                                                <CheckCircle2 className="w-5 h-5 mr-3" />
                                                Clôturer la Run
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="bg-background border-border text-foreground sm:max-w-md">
                                            <DialogHeader>
                                                <DialogTitle className="text-xl font-semibold flex items-center gap-2 uppercase tracking-tight">
                                                    <Trophy className="w-5 h-5 text-warning" />
                                                    Confirmer la Clôture
                                                </DialogTitle>
                                            </DialogHeader>
                                            <div className="py-4 space-y-3">
                                                <p className="text-foreground/80">Voulez-vous vraiment terminer cette aventure ?</p>
                                                <p className="text-xs text-foreground/40 leading-relaxed bg-surface p-3 rounded-lg">
                                                    Une fois clôturée, la run est archivée dans l'historique et les récompenses finales sont figées.
                                                </p>
                                            </div>
                                            <div className="flex justify-end gap-3 mt-4">
                                                <Button variant="ghost" onClick={() => setCloseDialogOpen(false)}>Annuler</Button>
                                                <Button onClick={handleCloseRun} disabled={loading} className={SONGES_BUTTON.close}>
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
                                        className="w-full bg-surface hover:bg-surface text-foreground font-semibold uppercase tracking-wider h-14 border border-border"
                                    >
                                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-5 h-5 mr-3" />}
                                        Réouvrir la Run
                                    </Button>
                                )}
                            </div>
                        )}

                        {/* Chantier Songes — Modale d'édition de la run */}
                        <Dialog open={editOpen} onOpenChange={setEditOpen}>
                            <DialogContent className="bg-background border-border text-foreground sm:max-w-md max-h-[85vh] overflow-y-auto">
                                <DialogHeader>
                                    <DialogTitle className="text-xl font-semibold flex items-center gap-2 uppercase tracking-tight">
                                        <Pencil className="w-5 h-5 text-info" />
                                        Modifier la Run
                                    </DialogTitle>
                                </DialogHeader>
                                <div className="py-4 space-y-5">
                                    <div className="space-y-2">
                                        <label className="text-caption font-semibold text-foreground/40 uppercase tracking-wider">Difficulté</label>
                                        <Select value={editForm.difficulty} onValueChange={(v) => setEditForm(prev => ({ ...prev, difficulty: v }))}>
                                            <SelectTrigger className="w-full bg-surface border-border text-sm font-medium">
                                                <SelectValue placeholder="Choisir la difficulté" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-background border-border">
                                                {Object.entries(DIFFICULTIES).map(([key, d]) => (
                                                    <SelectItem key={key} value={key}>
                                                        <span className="flex items-center gap-2">
                                                            <SongesPicto asset={d.asset} size={16} title={d.label} />
                                                            {d.label}
                                                        </span>
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-caption font-semibold text-foreground/40 uppercase tracking-wider">Épreuve (optionnel)</label>
                                        <Select value={editForm.epreuveCode} onValueChange={(v) => setEditForm(prev => ({ ...prev, epreuveCode: v }))}>
                                            <SelectTrigger className="w-full bg-surface border-border text-sm font-medium">
                                                <SelectValue placeholder="Run standard" />
                                            </SelectTrigger>
                                            <SelectContent className="bg-background border-border">
                                                <SelectItem value="">Run standard</SelectItem>
                                                {EPREUVES_SONGE.map((e) => (
                                                    <SelectItem key={e.code} value={e.code}>
                                            <span className="flex items-center gap-2">
                                                <SongesPicto asset={e.asset} size={16} title={e.label} />
                                                {e.label}
                                            </span>
                                        </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {!editForm.epreuveCode && (
                                            <div className="space-y-1.5">
                                                <label className="text-caption font-semibold text-foreground/40 uppercase tracking-wider">Objectifs</label>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {Object.entries(OBJECTIVES).map(([key, obj]) => (
                                                        <button
                                                            key={key}
                                                            type="button"
                                                            onClick={() => toggleEditObjective(key)}
                                                            className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all ${
 editForm.objectives.includes(key)
 ? "bg-info/15 border-info/40 text-foreground"
 : "bg-surface border-border text-foreground/60 hover:border-border-strong"
 }`}
                                                        >
                                                            <SongesPicto asset={obj.asset} size={18} title={obj.label} />
                                                            <span className="text-xs font-bold">{obj.label}</span>
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div className="space-y-2">
                                            <label className="text-caption font-semibold text-foreground/40 uppercase tracking-wider">Date de départ</label>
                                            <Input
                                                type="date"
                                                value={editForm.date}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, date: e.target.value }))}
                                                className="bg-surface border-border text-sm"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-caption font-semibold text-foreground/40 uppercase tracking-wider">Heure</label>
                                            <Input
                                                type="time"
                                                value={editForm.time}
                                                onChange={(e) => setEditForm(prev => ({ ...prev, time: e.target.value }))}
                                                className="bg-surface border-border text-sm"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-caption font-semibold text-foreground/40 uppercase tracking-wider">Étage actuel (0-26)</label>
                                        <Input
                                            type="number"
                                            min={0}
                                            max={26}
                                            value={editForm.currentFloor}
                                            onChange={(e) => setEditForm(prev => ({ ...prev, currentFloor: e.target.value }))}
                                            className="bg-surface border-border text-sm"
                                        />
                                    </div>
                                </div>
                                <div className="flex justify-end gap-3 mt-4">
                                    <Button variant="ghost" onClick={() => setEditOpen(false)} className="text-foreground/60 hover:text-foreground">Annuler</Button>
                                    <Button onClick={handleEditSubmit} disabled={editPending} className={SONGES_BUTTON.primary}>
                                        {editPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Pencil className="w-4 h-4 mr-2" />}
                                        Enregistrer
                                    </Button>
                                </div>
                            </DialogContent>
                        </Dialog>

                        {/* Metadata Card */}
                        <div className="bg-white/3 rounded-lg p-5 border border-border flex flex-col gap-4">
                            <span className="text-caption font-semibold text-foreground/20 uppercase tracking-wider">Détails de l'expédition</span>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="flex flex-col gap-1.5 col-span-2">
                                    <div className="flex items-center gap-2 text-warning">
                                        <Crown className="w-3.5 h-3.5" />
                                        <span className="text-caption font-bold uppercase tracking-tight">Chef d'expédition</span>
                                    </div>
                                    <span className="text-sm font-semibold text-foreground/90">{leaderName || "Chargement..."}</span>
                                </div>
                                <div className="h-px bg-surface col-span-2 my-1" />
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2 text-foreground/40">
                                        <Users className="w-3.5 h-3.5" />
                                        <span className="text-caption font-bold uppercase tracking-tight">Équipage</span>
                                    </div>
                                    <span className="text-sm font-semibold text-foreground/80">{run.members.length} / 4</span>
                                </div>
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex items-center gap-2 text-foreground/40">
                                        <Clock className="w-3.5 h-3.5" />
                                        <span className="text-caption font-bold uppercase tracking-tight">Créée</span>
                                    </div>
                                    <span className="text-sm font-semibold text-foreground/80">{formatDate(run.createdAt)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
