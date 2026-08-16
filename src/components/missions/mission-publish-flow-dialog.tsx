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
            <DialogContent className="max-w-md bg-background border-border shadow-2xl rounded-3xl p-0 overflow-hidden outline-none">

                {/* STEP INDICATOR */}
                <div className="flex h-1 bg-surface">
                    <div className={cn("h-full bg-info transition-all duration-300", progressWidth)} />
                </div>

                {/* CONTENT AREA */}
                <div className="p-6">

                    {/* ── STEP 1 : CONFIRM ─────────────────────────────── */}
                    {step === "CONFIRM" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black text-foreground flex items-center gap-3">
                                    <div className="p-2 bg-warning/20 rounded-xl text-warning">
                                        {missionPool === 'SPECIALES' ? <Sparkles className="w-5 h-5" /> : <Save className="w-5 h-5" />}
                                    </div>
                                    {isRepublish ? "Modifier les missions" : "Publication Hebdomadaire"}
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground text-sm mt-2">
                                    {isRepublish
                                        ? "Les missions seront mises à jour en base. Vous pourrez ensuite choisir de notifier ou non la guilde."
                                        : missionPool === 'CLASSIQUES'
                                            ? "Annonce automatique des 12 missions de la semaine."
                                            : "Annonce automatique des missions spéciales de la semaine."}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="bg-surface/50 border border-border rounded-2xl p-4 space-y-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="text-muted-foreground font-bold">Pool de missions</span>
                                    <span className={cn(
                                        "font-black uppercase tracking-widest px-2 py-1 rounded text-caption",
                                        missionPool === 'CLASSIQUES' ? "bg-info/20 text-info" : "bg-yellow-500/20 text-yellow-500"
                                    )}>
                                        {missionPool}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs border-t border-border pt-3">
                                    <span className="text-muted-foreground font-bold">État de configuration</span>
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "font-mono font-black text-sm",
                                            isPoolComplete ? "text-success" : "text-danger"
                                        )}>
                                            {missionsCount} / {missionPool === 'CLASSIQUES' ? 12 : 8}
                                        </span>
                                        {isPoolComplete ? <Check className="w-4 h-4 text-success" /> : <AlertTriangle className="w-4 h-4 text-danger" />}
                                    </div>
                                </div>

                                {!isPoolComplete && (
                                    <div className="bg-danger/10 border border-danger/20 rounded-xl p-3 flex items-start gap-2 text-caption text-danger font-bold leading-tight">
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
                                            ? "bg-background text-foreground hover:bg-surface shadow-white/5"
                                            : "bg-surface text-muted-foreground cursor-not-allowed grayscale"
                                    )}
                                >
                                    {isSaving ? <Loader2 className="w-5 h-5 animate-spin" /> : (isRepublish ? "SAUVEGARDER & CONTINUER" : "PUBLIER & CONTINUER")}
                                    {!isSaving && <ChevronRight className="w-5 h-5 ml-2" />}
                                </Button>
                                <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground hover:text-foreground h-10 font-bold">
                                    Annuler
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2 : REPUBLISH CHOICE ────────────────────── */}
                    {step === "REPUBLISH_CHOICE" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
                            <DialogHeader>
                                <DialogTitle className="text-xl font-black text-foreground flex items-center gap-3">
                                    <div className="p-2 bg-warning/20 rounded-xl text-warning">
                                        <RefreshCw className="w-5 h-5" />
                                    </div>
                                    Missions mises à jour
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground text-sm mt-2">
                                    Les missions ont été sauvegardées. Souhaitez-vous notifier à nouveau la guilde sur Discord ?
                                </DialogDescription>
                            </DialogHeader>

                            {/* Warning: re-ping info */}
                            {isDiscordConfigured && (
                                <div className="bg-warning/10 border border-warning/20 rounded-xl p-3 flex items-start gap-2 text-caption text-warning font-bold leading-tight">
                                    <Bell className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    <span>
                                        En choisissant <span className="text-foreground">"Modifier en pingant"</span>, un nouveau message Discord sera envoyé et les rôles sélectionnés seront notifiés à nouveau.
                                    </span>
                                </div>
                            )}

                            <div className="flex flex-col gap-3">
                                {/* Silent save */}
                                <button
                                    onClick={() => handleFinalize(true)}
                                    className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border border-border bg-surface hover:bg-surface transition-all text-left group"
                                >
                                    <div className="p-2 rounded-xl bg-elevated group-hover:bg-muted transition-colors">
                                        <BellOff className="w-5 h-5 text-muted-foreground" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-black text-foreground">Modifier sans reping</p>
                                        <p className="text-caption text-muted-foreground mt-0.5">Sauvegarde silencieuse — aucune notification Discord.</p>
                                    </div>
                                </button>

                                {/* With re-ping */}
                                {isDiscordConfigured ? (
                                    <button
                                        onClick={() => setStep("DISCORD_PING")}
                                        className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border border-info/30 bg-info/10 hover:bg-info/20 transition-all text-left group"
                                    >
                                        <div className="p-2 rounded-xl bg-info/20 group-hover:bg-info/30 transition-colors">
                                            <Send className="w-5 h-5 text-info" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-info">Modifier en pingant</p>
                                            <p className="text-caption text-info/60 mt-0.5">Envoie une nouvelle annonce Discord avec ping de rôle.</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-info ml-auto shrink-0" />
                                    </button>
                                ) : (
                                    <div className="w-full flex items-center gap-4 px-5 py-4 rounded-2xl border border-border bg-surface/50 opacity-40 cursor-not-allowed">
                                        <div className="p-2 rounded-xl bg-elevated">
                                            <Send className="w-5 h-5 text-muted-foreground" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-black text-muted-foreground">Modifier en pingant</p>
                                            <p className="text-caption text-muted-foreground mt-0.5">Discord non configuré — option indisponible.</p>
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
                                <DialogTitle className="text-xl font-black text-foreground flex items-center gap-3">
                                    <div className="p-2 bg-info/20 rounded-xl text-info">
                                        <Send className="w-5 h-5" />
                                    </div>
                                    Annonce Discord
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground text-sm mt-2">
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
                                            ? "bg-info/10 border-info/40 text-info"
                                            : "bg-surface border-border text-muted-foreground hover:border-border"
                                    )}
                                >
                                    <BellOff className={cn("w-5 h-5", pingType === "NONE" ? "text-info" : "text-muted-foreground group-hover:text-muted-foreground")} />
                                    <span className="text-xs font-black uppercase tracking-widest">Sans Ping</span>
                                </button>
                                <button
                                    onClick={() => { setPingType("EVERYONE"); setSelectedRoleIds([]); }}
                                    className={cn(
                                        "flex flex-col items-center gap-2 p-4 rounded-2xl border transition-all text-center group",
                                        pingType === "EVERYONE"
                                            ? "bg-danger/10 border-danger/40 text-danger"
                                            : "bg-surface border-border text-muted-foreground hover:border-border"
                                    )}
                                >
                                    <AtSign className={cn("w-5 h-5", pingType === "EVERYONE" ? "text-danger" : "text-muted-foreground group-hover:text-muted-foreground")} />
                                    <span className="text-xs font-black uppercase tracking-widest">@everyone</span>
                                </button>
                            </div>

                            <div className="space-y-2">
                                <label className="text-caption font-black uppercase tracking-widest text-muted-foreground ml-1">
                                    Ping un ou plusieurs rôles
                                </label>
                                <div className="bg-surface border border-border rounded-2xl overflow-hidden max-h-40 overflow-y-auto custom-scrollbar shadow-inner">
                                    {isLoadingRoles ? (
                                        <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                        </div>
                                    ) : roles.length === 0 ? (
                                        <div className="py-8 text-center text-xs text-muted-foreground italic">Aucun rôle whitelisté trouvé</div>
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
                                                            isSelected ? "bg-info text-info-foreground shadow-lg shadow-indigo-500/20" : "text-muted-foreground hover:bg-surface"
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
                                    className="bg-info hover:bg-info text-info-foreground h-12 font-black rounded-2xl shadow-xl shadow-indigo-500/20"
                                >
                                    {isPublishingDiscord ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Rocket className="w-5 h-5 mr-2" />}
                                    FINALISER &amp; ENVOYER
                                </Button>
                                <button
                                    onClick={() => handleFinalize(true)}
                                    className="h-10 text-xs font-bold text-muted-foreground hover:text-danger transition-colors uppercase tracking-wider"
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