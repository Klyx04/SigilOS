"use client";

import { useState, useEffect, useMemo } from "react";
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
    Save,
    Sparkles,
    RefreshCw,
    Users,
    ArrowLeft,
    Hash,
    Bell,
    Info,
    Target
} from "lucide-react";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { getMissionConfig } from "@/server/actions/admin-actions";
import { publishMissionsToDiscord, finalizeSilentPublish } from "@/server/actions/mission-actions";
import { getGuildChannelsAction } from "@/server/actions/discord-actions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PingEstimate } from "@/components/shared/ping-estimate";
import { ChannelPreview } from "@/components/shared/ChannelPreview";
import { DiscordEmbedPreview } from "@/components/discord/DiscordEmbedPreview";
import { formatDofusRange, getDofusWeek } from "@/lib/date-utils";

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
    const [channelId, setChannelId] = useState<string | null>(null);
    const [channelName, setChannelName] = useState<string>("annonces-missions");
    const [vitrineMode, setVitrineMode] = useState<boolean>(false);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isPublishingDiscord, setIsPublishingDiscord] = useState(false);

    // Reset state and pre-load roles + mission config on open
    useEffect(() => {
        if (isOpen) {
            setStep("CONFIRM");
            setPingType("NONE");
            setSelectedRoleIds([]);
            setIsLoadingRoles(true);

            Promise.all([
                getDiscordRolesAction(guildId, { context: "missions" }),
                getMissionConfig(guildId),
                getGuildChannelsAction(guildId)
            ]).then(([rolesRes, configRes, channelsRes]) => {
                if (rolesRes.success && rolesRes.roles) {
                    const filtered = rolesRes.roles.filter(r => r.name !== "@everyone");
                    setRoles(filtered);
                    if (filtered.length > 0) {
                        setSelectedRoleIds(filtered.map(r => r.id));
                        setPingType("ROLE");
                    }
                }

                if (configRes.success && configRes.data) {
                    const targetChannelId = configRes.data.missionChannelId || null;
                    setChannelId(targetChannelId);
                    setVitrineMode(!!configRes.data.missionVitrineMode);

                    if (targetChannelId && channelsRes.success && channelsRes.data) {
                        const targetChannel = channelsRes.data.find(c => c.id === targetChannelId);
                        if (targetChannel?.name) {
                            setChannelName(targetChannel.name);
                        }
                    }
                }

                setIsLoadingRoles(false);
            }).catch(() => {
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
            } else if (!isDiscordConfigured || !channelId) {
                const { week, year } = getDofusWeek();
                await finalizeSilentPublish(guildId, week, year);
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
        const { week, year } = getDofusWeek();
        if (skipDiscord) {
            await finalizeSilentPublish(guildId, week, year);
            toast.success(missionPool === 'CLASSIQUES' ? "Missions classiques publiées avec succès !" : "Missions spéciales publiées avec succès !");
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

    const dofusRange = useMemo(() => formatDofusRange(), []);

    const mentionPreview = useMemo(() => {
        if (pingType === "EVERYONE") return "Bonjour @everyone !";
        if (pingType === "ROLE" && selectedRoleIds.length > 0) {
            const roleLabels = selectedRoleIds
                .map(id => `@${roles.find(r => r.id === id)?.name || "rôle"}`)
                .join(" ");
            return `Bonjour ${roleLabels} !`;
        }
        return "Bonjour à tous !";
    }, [pingType, selectedRoleIds, roles]);

    const isWideStep = step === "DISCORD_PING";

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className={cn(
                "bg-surface border border-border rounded-xl p-0 overflow-hidden shadow-lg outline-none transition-all",
                isWideStep ? "max-w-3xl" : "max-w-md"
            )}>
                <div className="p-5 sm:p-6">
                    {/* ── STEP 1 : CONFIRM ─────────────────────────────── */}
                    {step === "CONFIRM" && (
                        <div className="space-y-5">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2.5">
                                    <div className="p-2 bg-primary/10 text-primary border border-primary/20 rounded-lg">
                                        {missionPool === 'SPECIALES' ? <Sparkles className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                                    </div>
                                    <span>{isRepublish ? "Modifier les missions publiées" : "Publication Hebdomadaire"}</span>
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
                                    {isRepublish
                                        ? "Les missions de cette semaine ont déjà été publiées. Enregistrez vos modifications avant de choisir l'impact sur Discord."
                                        : missionPool === 'CLASSIQUES'
                                            ? "Vérifiez la configuration des 12 missions de la semaine avant de lancer la publication."
                                            : "Vérifiez la configuration des missions spéciales avant de lancer la publication."}
                                </DialogDescription>
                            </DialogHeader>

                            <div className="bg-elevated/40 border border-border rounded-lg p-3.5 space-y-3 text-xs">
                                <div className="flex items-center justify-between">
                                    <span className="text-muted-foreground font-medium">Pool sélectionné</span>
                                    <span className={cn(
                                        "font-bold uppercase tracking-wider px-2 py-0.5 rounded text-[11px]",
                                        missionPool === 'CLASSIQUES' ? "bg-info/15 text-info border border-info/20" : "bg-warning/15 text-warning border border-warning/20"
                                    )}>
                                        {missionPool}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between border-t border-border pt-2.5">
                                    <span className="text-muted-foreground font-medium">Objectifs configurés</span>
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "font-mono font-bold text-sm",
                                            isPoolComplete ? "text-success" : "text-danger"
                                        )}>
                                            {missionsCount} / {missionPool === 'CLASSIQUES' ? 12 : 8}
                                        </span>
                                        {isPoolComplete ? <Check className="w-4 h-4 text-success" /> : <AlertTriangle className="w-4 h-4 text-danger" />}
                                    </div>
                                </div>

                                {!isPoolComplete && (
                                    <div className="bg-danger/10 border border-danger/20 rounded-md p-2.5 flex items-start gap-2 text-xs text-danger font-medium leading-tight">
                                        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                        <span>
                                            {missionPool === 'CLASSIQUES'
                                                ? "Les 12 missions classiques doivent être configurées pour permettre la publication hebdomadaire."
                                                : "Configurez au moins une mission spéciale avant de publier."}
                                        </span>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2 pt-1">
                                <Button
                                    onClick={handleSaveAndNext}
                                    disabled={isSaving || !isPoolComplete}
                                    variant="sigil"
                                    className="h-10 font-bold"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                                    {isRepublish ? "Sauvegarder & Continuer" : "Publier & Continuer"}
                                    {!isSaving && <ChevronRight className="w-4 h-4 ml-1.5" />}
                                </Button>
                                <Button
                                    variant="ghost"
                                    onClick={() => onOpenChange(false)}
                                    className="text-muted-foreground hover:text-foreground h-9 text-xs font-semibold"
                                >
                                    Annuler
                                </Button>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2 : REPUBLISH CHOICE ────────────────────── */}
                    {step === "REPUBLISH_CHOICE" && (
                        <div className="space-y-5">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2.5">
                                    <div className="p-2 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-lg">
                                        <RefreshCw className="w-5 h-5" />
                                    </div>
                                    <span>Missions mises à jour</span>
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground text-xs sm:text-sm mt-1.5 leading-relaxed">
                                    Vos modifications ont été enregistrées en base. Souhaitez-vous avertir à nouveau la guilde sur Discord ?
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex flex-col gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => handleFinalize(true)}
                                    className="w-full flex items-center gap-3.5 p-3.5 rounded-lg border border-border bg-elevated/40 hover:bg-elevated hover:border-border-strong transition-colors text-left"
                                >
                                    <div className="p-2 rounded-md bg-surface border border-border text-muted-foreground">
                                        <BellOff className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-foreground">Mise à jour silencieuse</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Sauvegarde en base sans envoyer de nouvelle notification Discord.</p>
                                    </div>
                                </button>

                                {isDiscordConfigured && channelId ? (
                                    <button
                                        type="button"
                                        onClick={() => setStep("DISCORD_PING")}
                                        className="w-full flex items-center gap-3.5 p-3.5 rounded-lg border border-info/30 bg-info/10 hover:bg-info/15 transition-colors text-left"
                                    >
                                        <div className="p-2 rounded-md bg-info/20 text-info border border-info/30">
                                            <Send className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1">
                                            <p className="text-sm font-semibold text-info">Modifier et notifier sur Discord</p>
                                            <p className="text-xs text-info/70 mt-0.5">Envoie une nouvelle annonce dans le salon de notification avec mention.</p>
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-info shrink-0" />
                                    </button>
                                ) : (
                                    <div className="p-3 rounded-lg border border-border bg-elevated/20 text-xs text-muted-foreground flex items-center gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                                        <span>Salon Discord non configuré — notification indisponible.</span>
                                    </div>
                                )}
                            </div>

                            <Button
                                variant="ghost"
                                onClick={() => setStep("CONFIRM")}
                                className="w-full text-muted-foreground hover:text-foreground h-9 text-xs font-semibold"
                            >
                                <ArrowLeft className="w-3.5 h-3.5 mr-1" /> Retour
                            </Button>
                        </div>
                    )}

                    {/* ── STEP 3 : DISCORD PING & PREVIEW ────────────────── */}
                    {step === "DISCORD_PING" && (
                        <div className="space-y-4">
                            <DialogHeader>
                                <DialogTitle className="text-lg font-bold text-foreground flex items-center gap-2.5">
                                    <div className="p-2 bg-info/10 text-info border border-info/20 rounded-lg">
                                        <Send className="w-5 h-5" />
                                    </div>
                                    <span>Annonce Discord</span>
                                </DialogTitle>
                                <DialogDescription className="text-muted-foreground text-xs sm:text-sm mt-1 leading-relaxed">
                                    {isRepublish
                                        ? "Missions mises à jour ! Choisissez comment notifier la guilde sur Discord."
                                        : "Vos missions sont prêtes ! Choisissez comment notifier la guilde sur Discord."}
                                </DialogDescription>
                            </DialogHeader>

                            {/* 2-Column Split: Controls & Context (Left) vs Real-time Discord Preview (Right) */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                                {/* Left Column: Destination, Mentions / Roles & Content Summary */}
                                <div className="space-y-3.5">
                                    {/* Destination Channel */}
                                    <div className="space-y-1.5">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <Hash className="w-3.5 h-3.5 text-info" />
                                            <span>Salon de destination</span>
                                        </label>
                                        <div className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-elevated/40">
                                            <div className="flex items-center gap-2 min-w-0">
                                                {channelId ? (
                                                    <ChannelPreview guildId={guildId} channelId={channelId} color="cyan" />
                                                ) : (
                                                    <span className="text-muted-foreground text-xs">Aucun salon configuré</span>
                                                )}
                                            </div>
                                            {channelId ? (
                                                <span className="text-[11px] font-medium text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Connecté
                                                </span>
                                            ) : (
                                                <span className="text-[11px] font-medium text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                                                    <AlertTriangle className="w-3 h-3" /> Non configuré
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Mentions Selector */}
                                    <div className="space-y-2">
                                        <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <Bell className="w-3.5 h-3.5 text-primary" />
                                            <span>Notification des membres</span>
                                        </label>

                                        <div className="grid grid-cols-3 gap-2">
                                            <button
                                                type="button"
                                                onClick={() => { setPingType("NONE"); setSelectedRoleIds([]); }}
                                                className={cn(
                                                    "flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg border text-xs transition-colors text-center",
                                                    pingType === "NONE"
                                                        ? "bg-elevated border-primary text-foreground font-semibold shadow-sm ring-1 ring-primary/40"
                                                        : "bg-elevated/20 border-border text-muted-foreground hover:bg-elevated/50 hover:text-foreground"
                                                )}
                                            >
                                                <BellOff className={cn("w-4 h-4", pingType === "NONE" ? "text-primary" : "text-muted-foreground")} />
                                                <span>Sans ping</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => { setPingType("EVERYONE"); setSelectedRoleIds([]); }}
                                                className={cn(
                                                    "flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg border text-xs transition-colors text-center",
                                                    pingType === "EVERYONE"
                                                        ? "bg-danger/15 border-danger/40 text-danger font-semibold shadow-sm ring-1 ring-danger/30"
                                                        : "bg-elevated/20 border-border text-muted-foreground hover:bg-elevated/50 hover:text-foreground"
                                                )}
                                            >
                                                <AtSign className={cn("w-4 h-4", pingType === "EVERYONE" ? "text-danger" : "text-muted-foreground")} />
                                                <span>@everyone</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPingType("ROLE");
                                                    if (selectedRoleIds.length === 0 && roles.length > 0) {
                                                        setSelectedRoleIds(roles.map(r => r.id));
                                                    }
                                                }}
                                                className={cn(
                                                    "flex flex-col items-center justify-center gap-1.5 py-2.5 px-2 rounded-lg border text-xs transition-colors text-center",
                                                    pingType === "ROLE"
                                                        ? "bg-info/15 border-info/40 text-info font-semibold shadow-sm ring-1 ring-info/30"
                                                        : "bg-elevated/20 border-border text-muted-foreground hover:bg-elevated/50 hover:text-foreground"
                                                )}
                                            >
                                                <Users className={cn("w-4 h-4", pingType === "ROLE" ? "text-info" : "text-muted-foreground")} />
                                                <span>Rôles</span>
                                            </button>
                                        </div>

                                        {/* Explication du mode sélectionné quand pas de rôle */}
                                        {pingType === "NONE" && (
                                            <div className="p-3 rounded-lg border border-border bg-elevated/30 text-xs text-muted-foreground flex items-start gap-2.5">
                                                <Info className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                                                <div className="space-y-0.5">
                                                    <p className="font-semibold text-foreground text-xs">Publication silencieuse</p>
                                                    <p className="text-[11px] leading-relaxed">
                                                        L'annonce apparaîtra sur Discord dans le salon sans envoyer de notification push ni de sonnerie aux membres.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {pingType === "EVERYONE" && (
                                            <div className="p-3 rounded-lg border border-danger/30 bg-danger/10 text-xs text-danger flex items-start gap-2.5">
                                                <AlertTriangle className="w-4 h-4 text-danger shrink-0 mt-0.5" />
                                                <div className="space-y-0.5">
                                                    <p className="font-semibold text-danger text-xs">Alerte générale (@everyone)</p>
                                                    <p className="text-[11px] text-danger/80 leading-relaxed">
                                                        Tous les membres ayant accès au salon recevront une alerte Discord. À privilégier pour le début officiel de semaine.
                                                    </p>
                                                </div>
                                            </div>
                                        )}

                                        {/* Roles Selector */}
                                        {pingType === "ROLE" && (
                                            <div className="space-y-1.5 pt-0.5">
                                                <div className="flex items-center justify-between text-xs text-muted-foreground">
                                                    <span className="font-medium">Rôles ciblés</span>
                                                    {roles.length > 0 && (
                                                        <span className="text-[11px] tabular-nums font-mono">
                                                            {selectedRoleIds.length}/{roles.length} sélectionnés
                                                        </span>
                                                    )}
                                                </div>

                                                <div className="bg-elevated/30 border border-border rounded-lg max-h-36 overflow-y-auto p-1.5 space-y-1">
                                                    {isLoadingRoles ? (
                                                        <div className="flex items-center justify-center py-6 text-muted-foreground gap-2 text-xs">
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                            <span>Chargement des rôles...</span>
                                                        </div>
                                                    ) : roles.length === 0 ? (
                                                        <div className="p-3 text-center text-xs text-muted-foreground leading-relaxed">
                                                            Aucun rôle spécifique configuré pour les missions. Utilisez <strong>@everyone</strong> ou <strong>Sans ping</strong>.
                                                        </div>
                                                    ) : (
                                                        roles.map(role => {
                                                            const isSelected = selectedRoleIds.includes(role.id);
                                                            const hex = role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#71717a";
                                                            return (
                                                                <button
                                                                    key={role.id}
                                                                    type="button"
                                                                    onClick={() => toggleRole(role.id)}
                                                                    className={cn(
                                                                        "w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors",
                                                                        isSelected
                                                                            ? "bg-info/15 text-info border border-info/30 font-semibold"
                                                                            : "text-muted-foreground hover:bg-elevated hover:text-foreground"
                                                                    )}
                                                                >
                                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                                                                    <span className="truncate flex-1">@{role.name}</span>
                                                                    {isSelected ? <Check className="w-3.5 h-3.5 text-info shrink-0" /> : null}
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                </div>

                                                {selectedRoleIds.length > 0 && (
                                                    <PingEstimate guildId={guildId} roleIds={selectedRoleIds} className="text-xs" />
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Deployment Overview Card */}
                                    <div className="p-3 rounded-lg border border-border bg-elevated/20 text-xs space-y-2">
                                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                            <Target className="w-3.5 h-3.5 text-primary" />
                                            <span>Contenu déployé</span>
                                        </div>
                                        <div className="space-y-1.5 pt-0.5">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Période active</span>
                                                <span className="font-medium text-foreground">{dofusRange}</span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Objectifs</span>
                                                <span className="font-semibold text-foreground">
                                                    {missionsCount} / {missionPool === 'CLASSIQUES' ? 12 : 8} ({missionPool === 'CLASSIQUES' ? "Classiques" : "Spéciales"})
                                                </span>
                                            </div>
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="text-muted-foreground">Mode de participation</span>
                                                <span className="font-medium text-foreground">
                                                    {vitrineMode ? "Mode vitrine (lecture)" : "Dépôt de preuves ouvert"}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Right Column: Discord Live Preview */}
                                <div className="space-y-1.5 flex flex-col">
                                    <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                                        Aperçu Discord en direct
                                    </span>

                                    <div className="flex-1 bg-elevated/20 border border-border rounded-lg p-2.5 flex items-start justify-center overflow-x-auto">
                                        <DiscordEmbedPreview
                                            channelName={channelName}
                                            mentionContent={mentionPreview}
                                            thumbnail="/assets/ui/dofus-missions-thumb.png"
                                            title={`📅 Objectifs Hebdomadaires — ${dofusRange}`}
                                            description={vitrineMode
                                                ? "Les missions de la semaine sont disponibles sur le dashboard !"
                                                : "Les missions de la semaine sont disponibles sur le dashboard — envoyez vos preuves de missions !"}
                                            color={0x00f2ff}
                                            footer="SigilOS • Système de Gestion de Guilde"
                                            components={[
                                                {
                                                    type: 1,
                                                    components: [
                                                        {
                                                            label: "Accéder au Dashboard",
                                                            style: 5,
                                                            url: `/dashboard/${guildId}/missions`
                                                        }
                                                    ]
                                                }
                                            ]}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Actions bar */}
                            <div className="flex flex-col gap-2 pt-2 border-t border-border">
                                <Button
                                    onClick={() => handleFinalize(false)}
                                    disabled={isPublishingDiscord || !channelId}
                                    variant="sigil"
                                    className="h-10 font-bold"
                                >
                                    {isPublishingDiscord ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                    Finaliser & Envoyer sur Discord
                                </Button>

                                <div className="flex items-center justify-between">
                                    {isRepublish ? (
                                        <button
                                            type="button"
                                            onClick={() => setStep("REPUBLISH_CHOICE")}
                                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium"
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5" /> Retour
                                        </button>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={() => setStep("CONFIRM")}
                                            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 font-medium"
                                        >
                                            <ArrowLeft className="w-3.5 h-3.5" /> Retour
                                        </button>
                                    )}

                                    <button
                                        type="button"
                                        onClick={() => handleFinalize(true)}
                                        className="text-xs text-muted-foreground hover:text-amber-500 font-medium transition-colors"
                                    >
                                        Ignorer l'annonce Discord (publication silencieuse)
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
}