"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
    Loader2, 
    Send, 
    BellOff, 
    AtSign, 
    Check, 
    AlertTriangle, 
    ChevronRight,
    Rocket,
    Save,
    Sparkles,
    RefreshCw,
    Bell
} from "lucide-react";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { publishMissionsToDiscord } from "@/server/actions/mission-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PingEstimate } from "@/components/shared/ping-estimate";

interface MissionPublishFlowDialogProps {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    guildId: string;
    missionPool: 'CLASSIQUES' | 'SPECIALES';
    missionsCount: number;
    onConfirm: () => Promise<{ success: boolean; error?: string }>;
    isDiscordConfigured?: boolean;
    /** Redéploiement : le pool est déjà publié → on propose le choix reping/silencieux */
    isRepublish?: boolean;
}

type Step = "CONFIRM" | "REPUBLISH_CHOICE" | "DISCORD_PING";
type PingType = "EVERYONE" | "ROLE" | "NONE";

export function MissionPublishFlowDialog({
    isOpen,
    onOpenChange,
    guildId,
    missionPool,
    missionsCount,
    onConfirm,
    isDiscordConfigured = true,
    isRepublish = false
}: MissionPublishFlowDialogProps) {
    const [step, setStep] = useState<Step>("CONFIRM");
    const [pingType, setPingType] = useState<PingType>("NONE");
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
    const [roles, setRoles] = useState<{ id: string; name: string; color: number }[]>([]);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isPublishingDiscord, setIsPublishingDiscord] = useState(false);

    // Reset state and pre-load roles on open
    useEffect(() => {
        if (isOpen) {
            setStep("CONFIRM");
            setPingType("NONE");
            setSelectedRoleIds([]);
            setIsLoadingRoles(true);
            getDiscordRolesAction(guildId, { context: "missions" }).then(res => {
                if (res.success && res.roles) {
                    const filtered = res.roles.filter(r => r.name !== "@everyone");
                    setRoles(filtered);
                    // Auto-select all whitelisted ping roles
                    if (filtered.length > 0) {
                        setSelectedRoleIds(filtered.map(r => r.id));
                        setPingType("ROLE");
                    }
                }
                setIsLoadingRoles(false);
            });
        }
    }, [isOpen, guildId]);

    const isPoolComplete = missionPool === 'CLASSIQUES' ? missionsCount === 12 : missionsCount >= 1;

    // Step 1 → save → then branch based on isRepublish
    const handleSaveAndNext = async () => {
        if (!isPoolComplete) return;
        setIsSaving(true);
        const res = await onConfirm();
        setIsSaving(false);

        if (res.success) {
            if (isRepublish) {
                // Redéploiement : propose le choix avant de (re)notifier
                setStep("REPUBLISH_CHOICE");
            } else if (!isDiscordConfigured) {
                toast.success("Publication terminée !");
                onOpenChange(false);
            } else {
                // 1er déploiement avec Discord configuré → étape ping
                setStep("DISCORD_PING");
            }
        } else {
            toast.error(res.error || "Erreur lors de la publication.");
        }
    };

    // Send Discord notification
    const handleFinalize = async (skipDiscord = false) => {
        if (skipDiscord) {
            toast.success(missionPool === 'CLASSIQUES' ? "Missions classiques mises à jour !" : "Missions spéciales mises à jour !");
            onOpenChange(false);
            return;
        }

        setIsPublishingDiscord(true);
        const res = await publishMissionsToDiscord(guildId, pingType, pingType === "ROLE" ? selectedRoleIds : null);
        setIsPublishingDiscord(false);

        if (res.success) {
            toast.success("Publication terminée et annonce Discord envoyée !");
            onOpenChange(false);
        } else {
            toast.error(res.error || "Missions sauvegardées mais erreur d'annonce Discord.");
        }
    };

    const toggleRole = (roleId: string) => {
        setSelectedRoleIds(prev => {
            const next = prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId];
            if (next.length > 0) setPingType("ROLE");
            return next;
        });
    };

    // Step progress: CONFIRM=1/3, REPUBLISH_CHOICE=2/3, DISCORD_PING=3/3
    // For first publish (no REPUBLISH_CHOICE): CONFIRM=1/2, DISCORD_PING=2/2
    const progressWidth = isRepublish
        ? step === "CONFIRM" ? "w-1/3" : step === "REPUBLISH_CHOICE" ? "w-2/3" : "w-full"
        : step === "CONFIRM" ? "w-1/2" : "w-full";

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-md bg-zinc-950 border-white/10 shadow-2xl rounded-3xl p-0 overflow-hidden outline-none">

                {/* STEP INDICATOR */}
                <div className="flex h-1 bg-white/5">
                    <div className={cn("h-full bg-indigo-500 transition-all duration-300", progressWidth)} />
                </div>

                {/* CONTENT AREA */}
                <div className="p-6">

                    {/* ── STEP 1 : CONFIRM ─────────────────────────────── */}
                    {step === "CONFIRM" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black text-white flex items-center gap-3">
                                    <div className="p-2 bg-amber-500/20 rounded-xl text-amber-500">
                                        {missionPool === 'SPECIALES' ? <Sparkles className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                                    </div>
                                    {isRepublish ? "Modifier les missions" : "Publication Hebdomadaire"}
                                </DialogTitle>
                                <DialogDescription className="text-zinc-500 text-sm mt-2">
                                    {isRepublish
                                        ? "Les missions seront mises à jour en base. Vous pourrez ensuite choisir de notifier ou non la guilde."
                                        : missionPool === 'CLASSIQUES'
                                            ? "Annonce automatique des 12 missions de la semaine."
                                            : "Annonce automatique des missions spéciales de la semaine."}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4 space-y-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-zinc-400 font-bold">Pool de missions</span>
                                    <span className={cn(
                                        "font-black uppercase tracking-widest px-2 py-1 rounded text-caption",
                                        missionPool === 'CLASSIQUES' ? "bg-indigo-500/20 text-indigo-400" : "bg-yellow-500/20 text-yellow-500"
                                    )}>
                                        {missionPool}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs border-t border-white/5 pt-3">
                                    <span className="text-zinc-400 font-bold">État de configuration</span>
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "font-mono font-black text-sm",
                                            isPoolComplete ? "text-emerald-400" : "text-rose-500"
                                        )}>
                                            {missionsCount} / {missionPool === 'CLASSIQUES' ? 12 : 8}
                                        </span>
                                        {isPoolComplete ? <Check className="w-4 h-4 text-emerald-500" /> : <AlertTriangle className="w-4 h-4 text-rose-500" />}
                                    </div>
                                </div>

                                {!isPoolComplete && (
                                    <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-start gap-2 text-caption text-rose-400 font-bold leading-tight">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                        {missionPool === 'CLASSIQUES'
                                            ? "ERREUR : Les 12 missions classiques doivent être configurées pour permettre la publication hebdomadaire."
                                            : "ERREUR : Configurez au moins une mission spéciale avant de publier."}
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2">
                                <Button
                                    onClick={handleSaveAndNext}
                                    disabled={isSaving || !isPoolComplete}
                                    className={cn(
                                        "h-12 font-black rounded-2xl shadow-xl transition-all",
                                        isPoolComplete
                                            ? "bg-white text-black hover:bg-zinc-200 shadow-white/5"
                                            : "bg-zinc-900 text-zinc-700 cursor-not-allowed grayscale"
                                    )}
                                >
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRepublish ? "SAUVEGARDER & CONTINUER" : "PUBLIER & CONTINUER")}
                                    {!isSaving && <ChevronRight className="w-5 h-5 ml-2" />}
                                </Button>
                                <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-zinc-500 hover:text-white h-10 font-bold">
                                    Annuler
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2 : REPUBLISH CHOICE ────────────────────── */}
                    {step === "REPUBLISH_CHOICE" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black text-white flex items-center gap-3">
                                    <div className="p-2 bg-amber-500/20 rounded-xl text-amber-500">
                                        <RefreshCw className="w-5 h-5" />
                                    </div>
                                    Missions mises à jour
                                </DialogTitle>
                                <DialogDescription className="text-zinc-500 text-sm mt-2">
                                    Les missions ont été sauvegardées. Souhaitez-vous notifier à nouveau la guilde sur Discord ?
                                </DialogDescription>
                            </DialogHeader>

                            {/* Warning: re-ping info */}
                            {isDiscordConfigured && (
                                <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-start gap-2 text-caption text-amber-400 font-bold leading-tight">
                                    <Bell className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>
                                        En choisissant <span className="text-white">"Modifier en pingant"</span>, un nouveau message Discord sera envoyé et les rôles sélectionnés seront notifiés à nouveau.
                                    </span>
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                                {/* Silent save */}
                                <button
                                    onClick={() => handleFinalize(true)}
                                    className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/10 bg-zinc-900 hover:bg-white/5 transition-all text-left group"
                                >
                                    <div className="p-2 rounded-xl bg-zinc-800 group-hover:bg-zinc-700 transition-colors">
                                        <BellOff className="w-5 h-5 text-zinc-400" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-white">Modifier sans reping</p>
                                        <p className="text-caption text-zinc-500 mt-0.5">Sauvegarde silencieuse — aucune notification Discord.</p>
                                    </div>
                                </button>

                                {/* With re-ping */}
                                {isDiscordConfigured ? (
                                    <button
                                        onClick={() => setStep("DISCORD_PING")}
                                        className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/20 transition-all text-left group"
                                    >
                                        <div className="p-2 rounded-xl bg-indigo-500/20 group-hover:bg-indigo-500/30 transition-colors">
                                            <Send className="w-5 h-5 text-indigo-400" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-indigo-300">Modifier en pingant</p>
                                            <p className="text-caption text-indigo-400/60 mt-0.5">Envoie une nouvelle annonce Discord avec ping de rôle.</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-indigo-500 ml-auto shrink-0" />
                                    </button>
                                ) : (
                                    <div className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border border-white/5 bg-zinc-900/50 opacity-40 cursor-not-allowed">
                                        <div className="p-2 rounded-xl bg-zinc-800">
                                            <Send className="w-5 h-5 text-zinc-600" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-zinc-500">Modifier en pingant</p>
                                            <p className="text-caption text-zinc-600 mt-0.5">Discord non configuré — option indisponible.</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* ── STEP 3 : DISCORD PING ────────────────────────── */}
                    {step === "DISCORD_PING" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black text-white flex items-center gap-3">
                                    <div className="p-2 bg-indigo-500/20 rounded-xl text-indigo-400">
                                        <Send className="w-5 h-5" />
                                    </div>
                                    Annonce Discord
                                </DialogTitle>
                                <DialogDescription className="text-zinc-500 text-sm mt-2">
                                    {isRepublish
                                        ? "Missions mises à jour ! Choisissez comment notifier la guilde."
                                        : "Missions sauvegardées avec succès ! Souhaitez-vous notifier la guilde ?"}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => { setPingType("NONE"); setSelectedRoleIds([]); }}
                                    className={cn(
                                        "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-center group",
                                        pingType === "NONE"
                                            ? "bg-indigo-500/10 border-indigo-500/40 text-indigo-300"
                                            : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/10"
                                    )}
                                >
                                    <BellOff className={cn("w-5 h-5", pingType === "NONE" ? "text-indigo-400" : "text-zinc-600 group-hover:text-zinc-400")} />
                                    <span className="text-xs font-black uppercase tracking-widest">Sans Ping</span>
                                </button>
                                <button
                                    onClick={() => { setPingType("EVERYONE"); setSelectedRoleIds([]); }}
                                    className={cn(
                                        "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-center group",
                                        pingType === "EVERYONE"
                                            ? "bg-rose-500/10 border-rose-500/40 text-rose-300"
                                            : "bg-zinc-900 border-white/5 text-zinc-500 hover:border-white/10"
                                    )}
                                >
                                    <AtSign className={cn("w-5 h-5", pingType === "EVERYONE" ? "text-rose-400" : "text-zinc-600 group-hover:text-zinc-400")} />
                                    <span className="text-xs font-black uppercase tracking-widest">@everyone</span>
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-caption font-black uppercase tracking-widest text-zinc-500 ml-1">
                                    Ping un ou plusieurs rôles
                                </label>
                                <div className="bg-zinc-900 border border-white/5 rounded-2xl overflow-hidden max-h-40 overflow-y-auto custom-scrollbar shadow-inner">
                                    {isLoadingRoles ? (
                                        <div className="flex items-center justify-center py-8 gap-2 text-zinc-600">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        </div>
                                    ) : roles.length === 0 ? (
                                        <div className="py-8 text-center text-xs text-zinc-600 italic">Aucun rôle whitelisté trouvé</div>
                                    ) : (
                                        <div className="p-2 space-y-1">
                                            {roles.map(role => {
                                                const isSelected = selectedRoleIds.includes(role.id);
                                                const hex = role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#71717a";
                                                return (
                                                    <button
                                                        key={role.id}
                                                        onClick={() => toggleRole(role.id)}
                                                        className={cn(
                                                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all",
                                                            isSelected ? "bg-indigo-500 text-white shadow-lg shadow-indigo-500/20" : "text-zinc-400 hover:bg-white/5"
                                                        )}
                                                    >
                                                        <div className="w-2.5 h-2.5 rounded-full shadow-sm" style={{ backgroundColor: hex }} />
                                                        <span className="text-sm font-bold flex-1 truncate">@{role.name}</span>
                                                        {isSelected && <Check className="w-4 h-4 shrink-0" />}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                                {pingType === "ROLE" && selectedRoleIds.length > 0 && (
                                    <PingEstimate guildId={guildId} roleIds={selectedRoleIds} className="pl-1" />
                                )}
                            </div>

                            <div className="flex flex-col gap-2 pt-2">
                                <Button
                                    onClick={() => handleFinalize(false)}
                                    disabled={isPublishingDiscord}
                                    className="bg-indigo-600 hover:bg-indigo-500 text-white h-12 font-black rounded-2xl shadow-xl shadow-indigo-500/20"
                                >
                                    {isPublishingDiscord ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Rocket className="w-5 h-5 mr-2" />}
                                    FINALISER &amp; ENVOYER
                                </Button>
                                <button
                                    onClick={() => handleFinalize(true)}
                                    className="h-10 text-xs font-bold text-zinc-600 hover:text-rose-400 transition-colors uppercase tracking-wider"
                                >
                                    Ignorer l'annonce Discord
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}