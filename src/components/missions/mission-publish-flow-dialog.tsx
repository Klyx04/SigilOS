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
import { Badge } from "@/components/ui/badge";
import { 
    Loader2, 
    Send, 
    BellOff, 
    AtSign, 
    Check, 
    AlertTriangle, 
    Sparkles, 
    RefreshCw, 
    Users, 
    Hash, 
    Bell, 
    Info, 
    Target,
    ArrowRight
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
    /** Redéploiement : le pool est déjà publié → on propose directement le choix reping vs silencieux */
    isRepublish?: boolean;
}

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
    const [pingType, setPingType] = useState<PingType>("ROLE");
    const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
    const [roles, setRoles] = useState<{ id: string; name: string; color: number }[]>([]);
    const [channelId, setChannelId] = useState<string | null>(null);
    const [channelName, setChannelName] = useState<string>("annonces-missions");
    const [vitrineMode, setVitrineMode] = useState<boolean>(false);
    const [isLoadingRoles, setIsLoadingRoles] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isPublishingDiscord, setIsPublishingDiscord] = useState(false);

    // Republish mode choice: 'SILENT' | 'REPING'
    const [republishChoice, setRepublishChoice] = useState<'SILENT' | 'REPING'>('SILENT');
    const [repingType, setRepingType] = useState<PingType>("ROLE");

    // Preload roles + mission config on open
    useEffect(() => {
        if (isOpen) {
            setIsLoadingRoles(true);
            setRepublishChoice('SILENT');

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
                        setRepingType("ROLE");
                    } else {
                        setPingType("NONE");
                        setRepingType("EVERYONE");
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
    const dofusRange = useMemo(() => formatDofusRange(), []);

    const toggleRole = (roleId: string) => {
        setSelectedRoleIds(prev => {
            const next = prev.includes(roleId) ? prev.filter(id => id !== roleId) : [...prev, roleId];
            if (next.length > 0) {
                setPingType("ROLE");
                setRepingType("ROLE");
            }
            return next;
        });
    };

    const activePingType = isRepublish ? repingType : pingType;

    const mentionPreview = useMemo(() => {
        if (activePingType === "EVERYONE") return "Bonjour @everyone !";
        if (activePingType === "ROLE" && selectedRoleIds.length > 0) {
            const roleLabels = selectedRoleIds
                .map(id => `@${roles.find(r => r.id === id)?.name || "rôle"}`)
                .join(" ");
            return `Bonjour ${roleLabels} !`;
        }
        return "Bonjour à tous !";
    }, [activePingType, selectedRoleIds, roles]);

    // ─────────────────────────────────────────────────────────────────────────────
    // Handler : Enregistrement silencieux (Mise à jour discrète)
    // ─────────────────────────────────────────────────────────────────────────────
    const handleSilentSave = async () => {
        setIsSaving(true);
        try {
            const res = await onConfirm();
            if (!res.success) {
                toast.error(res.error || "Erreur lors de la sauvegarde.");
                return;
            }
            const { week, year } = getDofusWeek();
            await finalizeSilentPublish(guildId, week, year);
            toast.success("Missions enregistrées en base sans notification Discord !");
            onOpenChange(false);
        } catch (err) {
            toast.error("Erreur serveur lors de la sauvegarde.");
        } finally {
            setIsSaving(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // Handler : Modification avec re-notification Discord
    // ─────────────────────────────────────────────────────────────────────────────
    const handleRepingSave = async () => {
        if (!channelId) {
            toast.error("Salon Discord non configuré. Enregistrement annulé.");
            return;
        }

        setIsPublishingDiscord(true);
        try {
            const res = await onConfirm();
            if (!res.success) {
                toast.error(res.error || "Erreur lors de la sauvegarde.");
                return;
            }

            const discordRes = await publishMissionsToDiscord(
                guildId,
                repingType,
                repingType === "ROLE" ? selectedRoleIds : null
            );

            if (discordRes.success) {
                toast.success("Missions mises à jour et annonce Discord envoyée !");
                onOpenChange(false);
            } else {
                toast.error(discordRes.error || "Missions sauvegardées mais échec de l'annonce Discord.");
            }
        } catch (err) {
            toast.error("Erreur lors de la publication Discord.");
        } finally {
            setIsPublishingDiscord(false);
        }
    };

    // ─────────────────────────────────────────────────────────────────────────────
    // Handler : Première publication de la semaine
    // ─────────────────────────────────────────────────────────────────────────────
    const handleFirstPublish = async () => {
        if (!isPoolComplete) {
            toast.error(missionPool === 'CLASSIQUES' 
                ? "Les 12 missions classiques doivent être configurées." 
                : "Configurez au moins une mission spéciale.");
            return;
        }

        const skipDiscord = pingType === "NONE" || !isDiscordConfigured || !channelId;

        setIsSaving(true);
        try {
            const res = await onConfirm();
            if (!res.success) {
                toast.error(res.error || "Erreur lors de la publication.");
                return;
            }

            const { week, year } = getDofusWeek();

            if (skipDiscord) {
                await finalizeSilentPublish(guildId, week, year);
                toast.success(missionPool === 'CLASSIQUES' ? "Missions classiques publiées avec succès !" : "Missions spéciales publiées avec succès !");
                onOpenChange(false);
            } else {
                setIsPublishingDiscord(true);
                const discordRes = await publishMissionsToDiscord(
                    guildId,
                    pingType,
                    pingType === "ROLE" ? selectedRoleIds : null
                );

                if (discordRes.success) {
                    toast.success("Publication terminée et annonce Discord envoyée !");
                    onOpenChange(false);
                } else {
                    toast.error(discordRes.error || "Missions enregistrées mais échec de l'annonce Discord.");
                }
            }
        } catch (err) {
            toast.error("Erreur serveur lors de la publication.");
        } finally {
            setIsSaving(false);
            setIsPublishingDiscord(false);
        }
    };

    const isBusy = isSaving || isPublishingDiscord;

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !isBusy && onOpenChange(open)}>
            <DialogContent className={cn(
                "bg-surface border border-border text-foreground rounded-2xl p-0 overflow-hidden shadow-lg transition-all",
                isRepublish ? "sm:max-w-xl" : "sm:max-w-3xl"
            )}>
                {/* ══════════════════════════════════════════════════════════════════
                    CAS 1 : MODIFICATION ULTÉRIEURE (isRepublish === true)
                    Affiche directement le choix : silencieux vs repinger
                   ══════════════════════════════════════════════════════════════════ */}
                {isRepublish ? (
                    <div className="p-6 space-y-6">
                        <DialogHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 shadow-sm">
                                    <RefreshCw className="w-5 h-5 animate-spin-reverse" />
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-black text-foreground">
                                        Mettre à jour les missions
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                        Cette semaine est déjà publiée. Choisissez comment appliquer vos modifications.
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        {/* Status chip */}
                        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-elevated/40 border border-border/80 text-xs">
                            <div className="flex items-center gap-2">
                                <Badge variant="outline" className={cn(
                                    "text-[10px] uppercase font-bold py-0 px-2",
                                    missionPool === 'CLASSIQUES' ? "border-info/40 text-info bg-info/10" : "border-warning/40 text-warning bg-warning/10"
                                )}>
                                    {missionPool}
                                </Badge>
                                <span className="font-semibold text-foreground">
                                    {missionsCount} objectifs configurés
                                </span>
                            </div>
                            <span className="text-[11px] font-mono text-muted-foreground">{dofusRange}</span>
                        </div>

                        {/* The Two Choice Cards */}
                        <div className="space-y-3">
                            {/* Option 1 : Silent update */}
                            <div
                                onClick={() => !isBusy && setRepublishChoice('SILENT')}
                                className={cn(
                                    "p-4 rounded-xl border transition-all cursor-pointer relative flex items-start gap-4",
                                    republishChoice === 'SILENT'
                                        ? "bg-surface border-primary shadow-md ring-1 ring-primary/30"
                                        : "bg-surface/50 border-border/70 hover:border-border hover:bg-surface/80"
                                )}
                            >
                                <div className={cn(
                                    "p-2.5 rounded-lg border shrink-0 transition-colors",
                                    republishChoice === 'SILENT'
                                        ? "bg-primary/10 border-primary/30 text-primary"
                                        : "bg-elevated border-border text-muted-foreground"
                                )}>
                                    <BellOff className="w-5 h-5" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-bold text-foreground">
                                            Enregistrer sans ping (Silencieux)
                                        </h4>
                                        <span className="text-[11px] font-medium text-emerald-400 bg-emerald-950/40 border border-emerald-500/20 px-2 py-0.5 rounded-md">
                                            Recommandé
                                        </span>
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                        Met à jour immédiatement les cartes et les objectifs sur le site sans renvoyer de message ni déranger les membres sur Discord.
                                    </p>
                                </div>
                            </div>

                            {/* Option 2 : Reping Discord */}
                            <div
                                onClick={() => !isBusy && setRepublishChoice('REPING')}
                                className={cn(
                                    "p-4 rounded-xl border transition-all cursor-pointer relative flex flex-col gap-3",
                                    republishChoice === 'REPING'
                                        ? "bg-surface border-info shadow-md ring-1 ring-info/30"
                                        : "bg-surface/50 border-border/70 hover:border-border hover:bg-surface/80"
                                )}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={cn(
                                        "p-2.5 rounded-lg border shrink-0 transition-colors",
                                        republishChoice === 'REPING'
                                            ? "bg-info/10 border-info/30 text-info"
                                            : "bg-elevated border-border text-muted-foreground"
                                    )}>
                                        <Send className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between">
                                            <h4 className="text-sm font-bold text-foreground">
                                                Repinger la guilde sur Discord
                                            </h4>
                                            {channelId ? (
                                                <span className="text-[11px] font-medium text-info bg-info/10 border border-info/20 px-2 py-0.5 rounded-md flex items-center gap-1">
                                                    <Check className="w-3 h-3" /> Connecté
                                                </span>
                                            ) : (
                                                <span className="text-[11px] font-medium text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-md">
                                                    Non configuré
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                                            Renvoie une nouvelle annonce officielle dans le salon Discord pour notifier les membres des modifications.
                                        </p>
                                    </div>
                                </div>

                                {/* Expanded Ping Options for Reping */}
                                {republishChoice === 'REPING' && (
                                    <div className="pt-3 border-t border-border/60 space-y-3 mt-1 transition-all duration-200">
                                        <div className="grid grid-cols-2 gap-2">
                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setRepingType("ROLE"); }}
                                                className={cn(
                                                    "py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all",
                                                    repingType === "ROLE"
                                                        ? "bg-info/15 border-info/40 text-info shadow-sm"
                                                        : "bg-elevated/40 border-border text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                <Users className="w-3.5 h-3.5" />
                                                <span>Rôles ciblés</span>
                                            </button>

                                            <button
                                                type="button"
                                                onClick={(e) => { e.stopPropagation(); setRepingType("EVERYONE"); }}
                                                className={cn(
                                                    "py-2 px-3 rounded-lg border text-xs font-semibold flex items-center justify-center gap-2 transition-all",
                                                    repingType === "EVERYONE"
                                                        ? "bg-danger/15 border-danger/40 text-danger shadow-sm"
                                                        : "bg-elevated/40 border-border text-muted-foreground hover:text-foreground"
                                                )}
                                            >
                                                <AtSign className="w-3.5 h-3.5" />
                                                <span>@everyone</span>
                                            </button>
                                        </div>

                                        {repingType === "ROLE" && roles.length > 0 && (
                                            <div className="space-y-1.5" onClick={(e) => e.stopPropagation()}>
                                                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                                    <span>Sélection des rôles :</span>
                                                    <span className="font-mono">{selectedRoleIds.length}/{roles.length}</span>
                                                </div>
                                                <div className="max-h-28 overflow-y-auto p-1.5 rounded-lg border border-border bg-background/50 space-y-1">
                                                    {roles.map(role => {
                                                        const isSelected = selectedRoleIds.includes(role.id);
                                                        const hex = role.color ? `#${role.color.toString(16).padStart(6, "0")}` : "#71717a";
                                                        return (
                                                            <button
                                                                key={role.id}
                                                                type="button"
                                                                onClick={() => toggleRole(role.id)}
                                                                className={cn(
                                                                    "w-full flex items-center gap-2 px-2.5 py-1 rounded text-left text-xs transition-colors",
                                                                    isSelected
                                                                        ? "bg-info/15 text-info font-semibold"
                                                                        : "text-muted-foreground hover:bg-elevated hover:text-foreground"
                                                                )}
                                                            >
                                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                                                                <span className="truncate flex-1">@{role.name}</span>
                                                                {isSelected && <Check className="w-3 h-3 text-info shrink-0" />}
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center justify-between pt-2 border-t border-border/80">
                            <Button
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                disabled={isBusy}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                Annuler
                            </Button>

                            {republishChoice === 'SILENT' ? (
                                <Button
                                    onClick={handleSilentSave}
                                    disabled={isBusy}
                                    variant="sigil"
                                    className="h-10 px-6 font-bold text-xs"
                                >
                                    {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <BellOff className="w-4 h-4 mr-2" />}
                                    Enregistrer discrètement
                                </Button>
                            ) : (
                                <Button
                                    onClick={handleRepingSave}
                                    disabled={isBusy || !channelId}
                                    variant="sigil"
                                    className="h-10 px-6 font-bold text-xs"
                                >
                                    {isPublishingDiscord ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                                    Enregistrer & Repinger sur Discord
                                </Button>
                            )}
                        </div>
                    </div>
                ) : (
                    /* ══════════════════════════════════════════════════════════════════
                        CAS 2 : PREMIÈRE PUBLICATION (isRepublish === false)
                        Affiche directement le récapitulatif, la sélection de ping, et l'aperçu
                       ══════════════════════════════════════════════════════════════════ */
                    <div className="p-6 space-y-5">
                        <DialogHeader>
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 rounded-xl bg-primary/10 border border-primary/20 text-primary shadow-sm">
                                    {missionPool === 'SPECIALES' ? <Sparkles className="w-5 h-5" /> : <Target className="w-5 h-5" />}
                                </div>
                                <div>
                                    <DialogTitle className="text-xl font-black text-foreground">
                                        Publication Hebdomadaire {missionPool === 'SPECIALES' ? 'Spéciale' : ''}
                                    </DialogTitle>
                                    <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                                        Déployez les objectifs pour la guilde et configurez l'annonce Discord.
                                    </DialogDescription>
                                </div>
                            </div>
                        </DialogHeader>

                        {/* Incomplete warning if needed */}
                        {!isPoolComplete && (
                            <div className="bg-danger/10 border border-danger/30 rounded-xl p-3.5 flex items-start gap-2.5 text-xs text-danger font-medium leading-relaxed">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                <div>
                                    <p className="font-bold">Configuration incomplète ({missionsCount} / {missionPool === 'CLASSIQUES' ? 12 : 8})</p>
                                    <p className="text-danger/80 text-[11px] mt-0.5">
                                        {missionPool === 'CLASSIQUES'
                                            ? "Les 12 missions classiques doivent être complétées avant de pouvoir lancer la publication de la semaine."
                                            : "Configurez au moins une mission spéciale avant de lancer la publication."}
                                    </p>
                                </div>
                            </div>
                        )}

                        {/* 2-Column Split: Controls (Left) vs Live Discord Preview (Right) */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {/* Left Column: Context, Channel, Ping Options */}
                            <div className="space-y-3.5">
                                {/* Overview Card */}
                                <div className="p-3 rounded-xl border border-border/80 bg-elevated/30 text-xs space-y-2">
                                    <div className="flex items-center justify-between">
                                        <span className="text-muted-foreground font-medium">Pool sélectionné</span>
                                        <Badge variant="outline" className={cn(
                                            "text-[10px] uppercase font-bold py-0 px-2",
                                            missionPool === 'CLASSIQUES' ? "border-info/40 text-info bg-info/10" : "border-warning/40 text-warning bg-warning/10"
                                        )}>
                                            {missionPool}
                                        </Badge>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-border/60 pt-2">
                                        <span className="text-muted-foreground font-medium">Objectifs configurés</span>
                                        <div className="flex items-center gap-1.5 font-bold">
                                            <span className={cn(isPoolComplete ? "text-success" : "text-danger")}>
                                                {missionsCount} / {missionPool === 'CLASSIQUES' ? 12 : 8}
                                            </span>
                                            {isPoolComplete ? <Check className="w-3.5 h-3.5 text-success" /> : <AlertTriangle className="w-3.5 h-3.5 text-danger" />}
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-between border-t border-border/60 pt-2">
                                        <span className="text-muted-foreground font-medium">Période active</span>
                                        <span className="font-medium text-foreground">{dofusRange}</span>
                                    </div>
                                </div>

                                {/* Destination Channel */}
                                <div className="space-y-1.5">
                                    <label className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                                        <Hash className="w-3.5 h-3.5 text-info" />
                                        <span>Salon de destination</span>
                                    </label>
                                    <div className="flex items-center justify-between p-2.5 rounded-xl border border-border bg-elevated/40">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {channelId ? (
                                                <ChannelPreview guildId={guildId} channelId={channelId} color="cyan" />
                                            ) : (
                                                <span className="text-muted-foreground text-xs">Aucun salon configuré</span>
                                            )}
                                        </div>
                                        {channelId ? (
                                            <span className="text-[10px] font-bold text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
                                                <Check className="w-3 h-3" /> Connecté
                                            </span>
                                        ) : (
                                            <span className="text-[10px] font-bold text-warning bg-warning/10 border border-warning/20 px-2 py-0.5 rounded-md shrink-0 flex items-center gap-1">
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
                                                "flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl border text-xs transition-all",
                                                pingType === "NONE"
                                                    ? "bg-elevated border-primary text-foreground font-bold shadow-sm ring-1 ring-primary/40"
                                                    : "bg-elevated/20 border-border text-muted-foreground hover:bg-elevated/50 hover:text-foreground"
                                            )}
                                        >
                                            <BellOff className={cn("w-4 h-4", pingType === "NONE" ? "text-primary" : "text-muted-foreground")} />
                                            <span className="text-[11px]">Sans ping</span>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => { setPingType("EVERYONE"); setSelectedRoleIds([]); }}
                                            className={cn(
                                                "flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl border text-xs transition-all",
                                                pingType === "EVERYONE"
                                                    ? "bg-danger/15 border-danger/40 text-danger font-bold shadow-sm ring-1 ring-danger/30"
                                                    : "bg-elevated/20 border-border text-muted-foreground hover:bg-elevated/50 hover:text-foreground"
                                            )}
                                        >
                                            <AtSign className={cn("w-4 h-4", pingType === "EVERYONE" ? "text-danger" : "text-muted-foreground")} />
                                            <span className="text-[11px]">@everyone</span>
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
                                                "flex flex-col items-center justify-center gap-1 py-2 px-1.5 rounded-xl border text-xs transition-all",
                                                pingType === "ROLE"
                                                    ? "bg-info/15 border-info/40 text-info font-bold shadow-sm ring-1 ring-info/30"
                                                    : "bg-elevated/20 border-border text-muted-foreground hover:bg-elevated/50 hover:text-foreground"
                                            )}
                                        >
                                            <Users className={cn("w-4 h-4", pingType === "ROLE" ? "text-info" : "text-muted-foreground")} />
                                            <span className="text-[11px]">Rôles</span>
                                        </button>
                                    </div>

                                    {/* Roles Selector list if ROLE */}
                                    {pingType === "ROLE" && (
                                        <div className="space-y-1.5 pt-0.5">
                                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                                <span>Rôles ciblés :</span>
                                                <span className="font-mono">{selectedRoleIds.length}/{roles.length} sélectionnés</span>
                                            </div>

                                            <div className="bg-elevated/30 border border-border rounded-xl max-h-32 overflow-y-auto p-1.5 space-y-1">
                                                {isLoadingRoles ? (
                                                    <div className="flex items-center justify-center py-4 text-muted-foreground gap-2 text-xs">
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                        <span>Chargement des rôles...</span>
                                                    </div>
                                                ) : roles.length === 0 ? (
                                                    <div className="p-2 text-center text-[11px] text-muted-foreground">
                                                        Aucun rôle spécifique configuré. Utilisez <strong>@everyone</strong> ou <strong>Sans ping</strong>.
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
                                                                    "w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-left text-xs transition-colors",
                                                                    isSelected
                                                                        ? "bg-info/15 text-info border border-info/30 font-semibold"
                                                                        : "text-muted-foreground hover:bg-elevated hover:text-foreground"
                                                                )}
                                                            >
                                                                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: hex }} />
                                                                <span className="truncate flex-1">@{role.name}</span>
                                                                {isSelected && <Check className="w-3.5 h-3.5 text-info shrink-0" />}
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
                            </div>

                            {/* Right Column: Discord Live Preview */}
                            <div className="space-y-1.5 flex flex-col">
                                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground block">
                                    Aperçu Discord en direct
                                </span>

                                <div className="flex-1 bg-elevated/20 border border-border rounded-xl p-3 flex items-start justify-center overflow-x-auto min-h-[220px]">
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
                        <div className="flex items-center justify-between pt-3 border-t border-border">
                            <Button
                                variant="ghost"
                                onClick={() => onOpenChange(false)}
                                disabled={isBusy}
                                className="text-xs text-muted-foreground hover:text-foreground"
                            >
                                Annuler
                            </Button>

                            <Button
                                onClick={handleFirstPublish}
                                disabled={isBusy || !isPoolComplete}
                                variant="sigil"
                                className="h-10 px-6 font-bold text-xs"
                            >
                                {isBusy ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : pingType === "NONE" || !channelId ? (
                                    <Check className="w-4 h-4 mr-2" />
                                ) : (
                                    <Send className="w-4 h-4 mr-2" />
                                )}
                                {pingType === "NONE" || !channelId
                                    ? "Publier les missions (sans notification)"
                                    : "Publier & Notifier sur Discord"}
                            </Button>
                        </div>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
