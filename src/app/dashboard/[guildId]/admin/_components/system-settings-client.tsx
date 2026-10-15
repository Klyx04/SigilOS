"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Megaphone, Bell, AlertTriangle, Users, ShieldAlert, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getSystemAnnouncementSettings } from "@/server/actions/system-settings-actions";
import { saveSystemAnnouncementSettings } from "@/server/actions/announcement-actions";
import { getMissionConfig, updateMissionNotifySettings } from "@/server/actions/admin-actions";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";

interface SystemSettingsClientProps {
    guildId: string;
}

export function SystemSettingsClient({ guildId }: SystemSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [newsEnabled, setNewsEnabled] = useState<boolean>(false);
    const [lifecycleChannelId, setLifecycleChannelId] = useState<string>("");
    
    const [fullMissionConfig, setFullMissionConfig] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    type SystemConfigSnapshot = {
        channelId: string;
        newsEnabled: boolean;
        lifecycleChannelId: string;
    };
    const [initialConfig, setInitialConfig] = useState<SystemConfigSnapshot | null>(null);

    const currentConfig: SystemConfigSnapshot = useMemo(() => ({
        channelId,
        newsEnabled,
        lifecycleChannelId,
    }), [channelId, newsEnabled, lifecycleChannelId]);

    const hasUnsavedChanges = isDirty(currentConfig, initialConfig);

    useEffect(() => {
        async function loadConfig() {
            const [sysRes, missionRes] = await Promise.all([
                getSystemAnnouncementSettings(guildId),
                getMissionConfig(guildId)
            ]);

            if ((sysRes.success && sysRes.data) || (missionRes.success && missionRes.data)) {
                const loaded: SystemConfigSnapshot = {
                    channelId: (sysRes.success && sysRes.data ? sysRes.data.systemNotifyChannelId : "") || "",
                    newsEnabled: missionRes.success && missionRes.data ? (missionRes.data.newsBroadcastEnabled || false) : false,
                    lifecycleChannelId: missionRes.success && missionRes.data ? (missionRes.data.lifecycleNotifyChannelId || "") : "",
                };
                setChannelId(loaded.channelId);
                setNewsEnabled(loaded.newsEnabled);
                setLifecycleChannelId(loaded.lifecycleChannelId);
                setInitialConfig(loaded);
            }

            if (missionRes.success && missionRes.data) {
                setFullMissionConfig(missionRes.data);
            }

            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const sysResult = await saveSystemAnnouncementSettings(guildId, channelId.trim() || null);
            const discordResult = await updateMissionNotifySettings(guildId, {
                channelId: fullMissionConfig?.missionChannelId,
                roleId: fullMissionConfig?.missionNotifyRoleId,
                validationChannelId: fullMissionConfig?.missionValidationChannelId,
                validationRoleId: fullMissionConfig?.missionValidationNotifyRoleId,
                kamaNotifyChannelId: fullMissionConfig?.kamaNotifyChannelId,
                kamaNotifyRoleId: fullMissionConfig?.kamaNotifyRoleId,
                missionManagementNotifyChannelId: fullMissionConfig?.missionManagementNotifyChannelId,
                missionManagementNotifyRoleId: fullMissionConfig?.missionManagementNotifyRoleId,
                newsBroadcastEnabled: newsEnabled,
                lifecycleNotifyChannelId: lifecycleChannelId.trim() || null,
            });

            if (sysResult.success && discordResult.success) {
                setInitialConfig(currentConfig);
                toast.success("Paramètres d'annonces mis à jour avec succès !");
            } else {
                toast.error("Une erreur est survenue lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[360px]">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-500/60" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Bannière visuelle Dofus */}
            <div className="relative rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-500/10 via-emerald-950/20 to-surface/80 p-6 overflow-hidden">
                <div className="flex items-start gap-4 relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center shrink-0 p-2 shadow-inner">
                        <img
                            src="/assets/dofus/modules/bot_command.png"
                            alt="Bot Discord"
                            className="w-10 h-10 object-contain drop-shadow"
                        />
                    </div>
                    <div className="space-y-1 max-w-2xl">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-caption font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            <Megaphone className="w-3 h-3" />
                            Canaux & Diffusion Discord
                        </div>
                        <h3 className="text-lg font-bold text-foreground">
                            Annonces & Mises à Jour de la Plateforme
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Centralisez les rapports de maintenance SigilOS, le relais d'actualités officielles Dofus
                            et le suivi du cycle de vie de vos membres (départs, arrivées, sanctions).
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* 1. SALON PRINCIPAL DES ANNONCES */}
                <Card className="bg-surface/60 border-border overflow-hidden">
                    <CardHeader className="pb-4 border-b border-border/50">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                                    <span className="p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400">
                                        <Megaphone className="w-4 h-4" />
                                    </span>
                                    Salon Principal des Annonces Plateforme
                                </CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Ce salon centralise par défaut les rapports automatiques et les alertes techniques.
                                </CardDescription>
                            </div>
                            {channelId ? (
                                <Badge className="bg-success/10 text-success border-success/20 self-start sm:self-auto">
                                    Configuré
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="text-muted-foreground self-start sm:self-auto">
                                    Non configuré
                                </Badge>
                            )}
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="space-y-2">
                            <label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
                                Salon Discord
                            </label>
                            <DiscordChannelPicker
                                guildId={guildId}
                                value={channelId}
                                onChange={setChannelId}
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                            <div className="p-3.5 rounded-xl bg-surface/80 border border-border flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 mt-0.5">
                                    <Bell className="w-4 h-4" />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-foreground">Rapports Quotidiens</p>
                                    <p className="text-caption text-muted-foreground">
                                        Synthèse matinale à 08h30 (missions validées, kamas collectés).
                                    </p>
                                </div>
                            </div>
                            <div className="p-3.5 rounded-xl bg-surface/80 border border-border flex items-start gap-3">
                                <div className="p-2 rounded-lg bg-info/10 text-info mt-0.5">
                                    <AlertTriangle className="w-4 h-4" />
                                </div>
                                <div className="space-y-0.5">
                                    <p className="text-xs font-bold text-foreground">Mises à Jour SigilOS</p>
                                    <p className="text-caption text-muted-foreground">
                                        Notes de mise à jour, maintenances prévues et correctifs.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. PARTAGE DES NEWS DOFUS & 3. CYCLE DE VIE */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* News Dofus */}
                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-border/50">
                            <div className="space-y-1">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                                    <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
                                        <Sparkles className="w-4 h-4" />
                                    </span>
                                    Partage des News Ankama
                                </CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Bouton de diffusion manuelle des actualités officielles Dofus.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-3 self-end sm:self-auto">
                                <span className="text-xs font-semibold text-muted-foreground">
                                    {newsEnabled ? "Activé" : "Désactivé"}
                                </span>
                                <Switch 
                                    checked={newsEnabled}
                                    onCheckedChange={setNewsEnabled}
                                    className="data-[state=checked]:bg-emerald-500"
                                />
                            </div>
                        </CardHeader>
                        <CardContent className="pt-6">
                            <p className="text-xs text-muted-foreground leading-relaxed">
                                Permet aux administrateurs de relayer en 1 clic les devblogs, maintenances de serveurs
                                et annonces Ankama directement sur votre serveur Discord.
                            </p>
                        </CardContent>
                    </Card>

                    {/* Cycle de Vie */}
                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader className="pb-4 border-b border-border/50">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                                <span className="p-1.5 rounded-lg bg-danger/15 text-danger">
                                    <Users className="w-4 h-4" />
                                </span>
                                Cycle de Vie des Membres
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Journal des départs, bannissements, archivages et réactivations de profil.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
                                    Salon des Notifications
                                </label>
                                <DiscordChannelPicker
                                    guildId={guildId}
                                    value={lifecycleChannelId}
                                    onChange={setLifecycleChannelId}
                                />
                                <p className="text-caption text-muted-foreground">
                                    Laissez vide pour désactiver le suivi automatique.
                                </p>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* Bouton Enregistrer */}
            <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                    onClick={handleSave}
                    disabled={isPending}
                    className="bg-emerald-500 hover:bg-emerald-600 text-emerald-950 font-bold min-w-[180px] h-11 shadow-lg shadow-emerald-500/20"
                >
                    {isPending ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Enregistrement...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            Enregistrer les Paramètres
                        </>
                    )}
                </Button>
            </div>

            <UnsavedChangesGuard
                hasUnsavedChanges={hasUnsavedChanges}
                message="Vous avez des modifications de paramètres système non sauvegardées. Quitter cette page les perdra définitivement."
            />
        </div>
    );
}
