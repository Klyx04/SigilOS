"use client";

/**
 * CalendarSettingsClient - Discord Notification Configuration
 * Pattern identical to songes-settings-client.tsx
 */

import { useState, useEffect, useTransition, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, AlertTriangle, Hash, Calendar, Users, Clock, Swords } from "lucide-react";
import { toast } from "sonner";
import { getCalendarConfig, updateCalendarChannel, updateRaidGigalodonChannel, updateRaidSanctuaireChannel, updateRaidAllowedSignUpRolesAction } from "@/server/actions/admin-actions";
import { getDiscordRolesAction, updateAllowedPingRolesAction } from "@/server/actions/user-actions";
import { PingRolesSelector } from "@/components/admin/ping-roles-selector";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";

interface CalendarSettingsClientProps {
    guildId: string;
}

export function CalendarSettingsClient({ guildId }: CalendarSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [raidGigalodonChannelId, setRaidGigalodonChannelId] = useState<string>("");
    const [raidSanctuaireChannelId, setRaidSanctuaireChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);
    const [isGigalodonConfigured, setIsGigalodonConfigured] = useState(false);
    const [isSanctuaireConfigured, setIsSanctuaireConfigured] = useState(false);
    
    const [calendarPingRoleIds, setCalendarPingRoleIds] = useState<string[]>([]);
    const [raidPingRoleIds, setRaidPingRoleIds] = useState<string[]>([]);
    const [raidAllowedSignUpRoleIds, setRaidAllowedSignUpRoleIds] = useState<string[]>([]);
    const [discordRoles, setDiscordRoles] = useState<{ id: string, name: string, color: string }[]>([]);

    // — Détection « modifications non sauvegardées »
    type CalendarConfigSnapshot = {
        channelId: string;
        raidGigalodonChannelId: string;
        raidSanctuaireChannelId: string;
        calendarPingRoleIds: string[];
        raidPingRoleIds: string[];
        raidAllowedSignUpRoleIds: string[];
    };
    const [initialConfig, setInitialConfig] = useState<CalendarConfigSnapshot | null>(null);

    const currentConfig: CalendarConfigSnapshot = useMemo(() => ({
        channelId,
        raidGigalodonChannelId,
        raidSanctuaireChannelId,
        calendarPingRoleIds: [...calendarPingRoleIds],
        raidPingRoleIds: [...raidPingRoleIds],
        raidAllowedSignUpRoleIds: [...raidAllowedSignUpRoleIds],
    }), [
        channelId, raidGigalodonChannelId, raidSanctuaireChannelId,
        calendarPingRoleIds, raidPingRoleIds, raidAllowedSignUpRoleIds,
    ]);

    const hasUnsavedChanges = isDirty(currentConfig, initialConfig);

    useEffect(() => {
        async function loadConfig() {
            const [result, rolesRes] = await Promise.all([
                getCalendarConfig(guildId),
                getDiscordRolesAction(guildId, { ignoreWhitelist: true })
            ]);
            if (result.success && result.data) {
                const loaded: CalendarConfigSnapshot = {
                    channelId: result.data.calendarChannelId || "",
                    raidGigalodonChannelId: result.data.raidGigalodonChannelId || "",
                    raidSanctuaireChannelId: result.data.raidSanctuaireChannelId || "",
                    calendarPingRoleIds: result.data.calendarPingRoleIds || [],
                    raidPingRoleIds: result.data.raidPingRoleIds || [],
                    raidAllowedSignUpRoleIds: result.data.raidAllowedSignUpRoleIds || [],
                };
                setChannelId(loaded.channelId);
                setIsConfigured(!!loaded.channelId);
                setCalendarPingRoleIds(loaded.calendarPingRoleIds);
                setRaidPingRoleIds(loaded.raidPingRoleIds);
                setRaidGigalodonChannelId(loaded.raidGigalodonChannelId);
                setIsGigalodonConfigured(!!loaded.raidGigalodonChannelId);
                setRaidSanctuaireChannelId(loaded.raidSanctuaireChannelId);
                setIsSanctuaireConfigured(!!loaded.raidSanctuaireChannelId);
                setRaidAllowedSignUpRoleIds(loaded.raidAllowedSignUpRoleIds);
                setInitialConfig(loaded);
            }
            if (rolesRes.success && rolesRes.roles) {
                setDiscordRoles(rolesRes.roles.filter((r: any) => r.name !== "@everyone") as any);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSaveCalendar = () => {
        startTransition(async () => {
            const result = await updateCalendarChannel(guildId, channelId.trim() || null);
            const pingRolesResult = await updateAllowedPingRolesAction(guildId, calendarPingRoleIds, "calendar");

            if (result.success && pingRolesResult.success) {
                setInitialConfig(currentConfig);
                toast.success("Configuration Calendrier sauvegardée !");
                setIsConfigured(!!channelId.trim());
            } else {
                toast.error(result.error || pingRolesResult.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const handleClearCalendar = () => {
        startTransition(async () => {
            const result = await updateCalendarChannel(guildId, null);
            if (result.success) {
                setChannelId("");
                setIsConfigured(false);
                setInitialConfig((prev) => prev ? { ...prev, channelId: "" } : prev);
                toast.success("Notifications Calendrier désactivées");
            } else {
                toast.error(result.error || "Erreur lors de la désactivation");
            }
        });
    };

    const handleSaveRaidGigalodon = () => {
        startTransition(async () => {
            const result = await updateRaidGigalodonChannel(guildId, raidGigalodonChannelId.trim() || null);
            if (result.success) {
                setInitialConfig(currentConfig);
                toast.success("Configuration Raid Gigalodon sauvegardée !");
                setIsGigalodonConfigured(!!raidGigalodonChannelId.trim());
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const handleClearRaidGigalodon = () => {
        startTransition(async () => {
            const result = await updateRaidGigalodonChannel(guildId, null);
            if (result.success) {
                setRaidGigalodonChannelId("");
                setIsGigalodonConfigured(false);
                setInitialConfig((prev) => prev ? { ...prev, raidGigalodonChannelId: "" } : prev);
                toast.success("Notifications Raid Gigalodon désactivées");
            } else {
                toast.error(result.error || "Erreur lors de la désactivation");
            }
        });
    };

    const handleSaveRaidSanctuaire = () => {
        startTransition(async () => {
            const result = await updateRaidSanctuaireChannel(guildId, raidSanctuaireChannelId.trim() || null);
            if (result.success) {
                setInitialConfig(currentConfig);
                toast.success("Configuration Raid Sanctuaire sauvegardée !");
                setIsSanctuaireConfigured(!!raidSanctuaireChannelId.trim());
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const handleClearRaidSanctuaire = () => {
        startTransition(async () => {
            const result = await updateRaidSanctuaireChannel(guildId, null);
            if (result.success) {
                setRaidSanctuaireChannelId("");
                setIsSanctuaireConfigured(false);
                setInitialConfig((prev) => prev ? { ...prev, raidSanctuaireChannelId: "" } : prev);
                toast.success("Notifications Raid Sanctuaire désactivées");
            } else {
                toast.error(result.error || "Erreur lors de la désactivation");
            }
        });
    };

    const handleSaveRaidRoles = () => {
        startTransition(async () => {
            const [pingRolesResult, signUpRolesResult] = await Promise.all([
                updateAllowedPingRolesAction(guildId, raidPingRoleIds, "raid"),
                updateRaidAllowedSignUpRolesAction(guildId, raidAllowedSignUpRoleIds),
            ]);

            if (pingRolesResult.success && signUpRolesResult.success) {
                setInitialConfig(currentConfig);
                toast.success("Rôles et autorisations Raids sauvegardés !");
            } else {
                toast.error(pingRolesResult.error || signUpRolesResult.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <>
        <Tabs defaultValue="calendar" className="w-full space-y-6">
            <TabsList className="bg-surface border border-border p-1 rounded-xl">
                <TabsTrigger value="calendar" className="text-xs font-black uppercase tracking-widest px-6 py-2.5 rounded-lg data-[state=active]:bg-warning data-[state=active]:text-warning-foreground">
                    Calendrier Général
                </TabsTrigger>
                <TabsTrigger value="raid" className="text-xs font-black uppercase tracking-widest px-6 py-2.5 rounded-lg data-[state=active]:bg-danger data-[state=active]:text-danger-foreground">
                    Raids Officiels
                </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="space-y-6 outline-none">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Configuration Panel */}
                    <Card className="lg:col-span-2 bg-surface/60 border-border">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-foreground">
                                    <span className="bg-warning/20 text-warning p-2 rounded-lg">
                                        <Hash className="w-5 h-5" />
                                    </span>
                                    Salon Discord (Calendrier)
                                </CardTitle>
                                {isConfigured ? (
                                    <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20">
                                        Actif
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-muted-foreground">
                                        Inactif
                                    </Badge>
                                )}
                            </div>
                            <CardDescription>
                                Les événements du calendrier général seront partagés dans ce salon.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div>
                                    <h4 className="text-sm font-semibold text-foreground mb-1">
                                        Salon des événements généraux
                                    </h4>
                                    <p className="text-xs text-muted-foreground mb-3">
                                        Sélectionnez le salon Discord où les sorties, donjons et événements du calendrier seront partagés.
                                    </p>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="flex-1">
                                            <DiscordChannelPicker
                                                guildId={guildId}
                                                value={channelId}
                                                onChange={setChannelId}
                                                placeholder="Sélectionner un salon..."
                                                allowEmptyLabel="Aucun salon (désactivé)"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleSaveCalendar}
                                            disabled={isPending}
                                            className="min-w-[120px] bg-warning hover:bg-warning text-warning-foreground font-bold"
                                        >
                                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                            Sauvegarder
                                        </Button>
                                    </div>
                                </div>
                                {isConfigured && (
                                    <div className="flex justify-end">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleClearCalendar}
                                            disabled={isPending}
                                            className="text-danger hover:text-danger hover:bg-danger/20 h-auto py-1 px-3 text-xs"
                                        >
                                            Désactiver l&apos;intégration
                                        </Button>
                                    </div>
                                )}
                            </div>

                            <div className="relative pl-6 border-l-2 border-transparent">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-elevated border-2 border-border flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-muted" />
                                </div>
                                <h3 className="text-sm font-medium text-foreground mb-2">3. Rôles de Ping Autorisés (Whitelist)</h3>
                                <p className="text-xs text-muted-foreground mb-4">
                                    Définissez quels rôles Discord les membres peuvent mentionner lors de la création d'événements Calendrier standards.
                                </p>
                                <PingRolesSelector 
                                    value={calendarPingRoleIds} 
                                    onChange={setCalendarPingRoleIds} 
                                    roles={discordRoles} 
                                    description="Si la liste est vide, aucun rôle Discord ne sera disponible pour le ping/sélection dans les modales de création (seuls les administrateurs verront toujours tous les rôles)." 
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Preview Panel */}
                    <div className="space-y-6">
                        <Card className="bg-surface/60 border-border overflow-hidden">
                            <CardHeader className="bg-surface pb-4">
                                <CardTitle className="text-sm text-foreground">Aperçu du message</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 relative">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-warning flex items-center justify-center shrink-0">
                                        <Calendar className="w-5 h-5 text-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="font-medium text-warning">SigilOS</span>
                                            <span className="bg-warning/20 text-warning text-caption px-1 rounded">BOT</span>
                                            <span className="text-xs text-muted-foreground">Maintenant</span>
                                        </div>

                                        <div className="bg-[#2b2d31] rounded border-l-4 border-warning p-4 max-w-sm">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-lg">📅</span>
                                                <h4 className="font-semibold text-foreground text-sm">Nouvel événement</h4>
                                            </div>

                                            <p className="text-foreground text-sm mb-3 font-medium">
                                                Sortie Donjon - Clés Offertes
                                            </p>

                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>Vendredi 31 Janvier</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Clock className="w-3 h-3" />
                                                    <span>21:00 - 23:00</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Users className="w-3 h-3" />
                                                    <span>0/8 places</span>
                                                </div>
                                            </div>

                                            <div className="mt-3 pt-3 border-t border-[#3f4147] flex items-center gap-2">
                                                <div className="w-4 h-4 rounded-full bg-muted" />
                                                <span className="text-[#949ba4] text-xs">SigilOS • Calendrier</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-info/5 border-info/10">
                            <CardContent className="p-4 flex gap-3">
                                <div className="p-2 bg-info/20 rounded-lg shrink-0 h-fit">
                                    <AlertTriangle className="w-4 h-4 text-info" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-medium text-info">Permissions requises</h4>
                                    <p className="text-xs text-info/70 leading-relaxed">
                                        Le bot <strong>SigilOS</strong> doit avoir les droits "Voir le salon" et "Envoyer des messages".
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </TabsContent>

            <TabsContent value="raid" className="space-y-6 outline-none">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Configuration Panel */}
                    <Card className="lg:col-span-2 bg-surface/60 border-border">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-foreground">
                                    <span className="bg-danger/20 text-danger p-2 rounded-lg">
                                        <Swords className="w-5 h-5" />
                                    </span>
                                    Salon Discord (Raids)
                                </CardTitle>
                                {(isGigalodonConfigured || isSanctuaireConfigured) ? (
                                    <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20">
                                        Actif
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-muted-foreground">
                                        Calendrier (Repli)
                                    </Badge>
                                )}
                            </div>
                            <CardDescription>
                                Les événements de type <strong>Raid Officiel 3.6</strong> seront partagés dans ce salon dédié. Si aucun salon n'est spécifié, le salon général du calendrier ci-dessus sera utilisé en repli.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <div className="space-y-6">
                                <div className="space-y-3 p-4 rounded-xl border border-border bg-surface/40">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-semibold text-foreground">
                                                Salon Raid Gigalodon
                                            </h4>
                                            <p className="text-xs text-muted-foreground">
                                                Salon spécifique pour les annonces du raid Gigalodon (si vide, le salon calendrier général est utilisé).
                                            </p>
                                        </div>
                                        {isGigalodonConfigured ? (
                                            <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20 h-5 text-caption">Configuré</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground h-5 text-caption">Repli calendrier</Badge>
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="flex-1">
                                            <DiscordChannelPicker
                                                guildId={guildId}
                                                value={raidGigalodonChannelId}
                                                onChange={setRaidGigalodonChannelId}
                                                placeholder="Sélectionner le salon Gigalodon..."
                                                allowEmptyLabel="Repli sur le Calendrier général"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleSaveRaidGigalodon}
                                            disabled={isPending}
                                            className="min-w-[120px] bg-danger hover:bg-danger text-danger-foreground font-bold"
                                        >
                                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                            Sauvegarder
                                        </Button>
                                    </div>
                                    {isGigalodonConfigured && (
                                        <div className="flex justify-end pt-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleClearRaidGigalodon}
                                                disabled={isPending}
                                                className="text-danger hover:text-danger hover:bg-danger/20 h-auto py-1 px-3 text-xs"
                                            >
                                                Désactiver ce salon
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-3 p-4 rounded-xl border border-border bg-surface/40">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="text-sm font-semibold text-foreground">
                                                Salon Raid Sanctuaire des Jardins Éternels
                                            </h4>
                                            <p className="text-xs text-muted-foreground">
                                                Salon spécifique pour les annonces du raid Sanctuaire (si vide, le salon calendrier général est utilisé).
                                            </p>
                                        </div>
                                        {isSanctuaireConfigured ? (
                                            <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20 h-5 text-caption">Configuré</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground h-5 text-caption">Repli calendrier</Badge>
                                        )}
                                    </div>
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <div className="flex-1">
                                            <DiscordChannelPicker
                                                guildId={guildId}
                                                value={raidSanctuaireChannelId}
                                                onChange={setRaidSanctuaireChannelId}
                                                placeholder="Sélectionner le salon Sanctuaire..."
                                                allowEmptyLabel="Repli sur le Calendrier général"
                                            />
                                        </div>
                                        <Button
                                            onClick={handleSaveRaidSanctuaire}
                                            disabled={isPending}
                                            className="min-w-[120px] bg-danger hover:bg-danger text-danger-foreground font-bold"
                                        >
                                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                            Sauvegarder
                                        </Button>
                                    </div>
                                    {isSanctuaireConfigured && (
                                        <div className="flex justify-end pt-1">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={handleClearRaidSanctuaire}
                                                disabled={isPending}
                                                className="text-danger hover:text-danger hover:bg-danger/20 h-auto py-1 px-3 text-xs"
                                            >
                                                Désactiver ce salon
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="relative pl-6 border-l-2 border-transparent">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-elevated border-2 border-border flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-muted" />
                                </div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-medium text-foreground">3. Rôles de Ping Autorisés (Raids)</h3>
                                    <Button 
                                        onClick={handleSaveRaidRoles} 
                                        disabled={isPending} 
                                        size="sm"
                                        className="bg-danger hover:bg-danger text-danger-foreground font-bold"
                                    >
                                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                                        Sauvegarder les Pings
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mb-4">
                                    Définissez quels rôles Discord les membres peuvent mentionner spécifiquement pour les événements de Raid Officiel.
                                </p>
                                <PingRolesSelector 
                                    value={raidPingRoleIds} 
                                    onChange={setRaidPingRoleIds} 
                                    roles={discordRoles} 
                                    description="Si vide, la configuration par défaut du calendrier sera utilisée (aucun rôle à moins que configuré)." 
                                />
                            </div>

                            <div className="relative pl-6 border-l-2 border-transparent">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-danger border-2 border-border " />
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-medium text-foreground">4. Whitelist des Rôles d'Inscription (Raid Guilde)</h3>
                                    <Button 
                                        onClick={handleSaveRaidRoles} 
                                        disabled={isPending} 
                                        size="sm"
                                        className="bg-danger hover:bg-danger text-danger-foreground font-bold"
                                    >
                                        {isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                                        Sauvegarder la Whitelist
                                    </Button>
                                </div>
                                <p className="text-xs text-muted-foreground mb-4">
                                    Définissez la liste des rôles Discord parmi lesquels l'initiateur d'un raid (lorsque "Guilde uniquement" est coché) pourra choisir quels rôles sont autorisés à s'inscrire.
                                </p>
                                <PingRolesSelector 
                                    value={raidAllowedSignUpRoleIds} 
                                    onChange={setRaidAllowedSignUpRoleIds} 
                                    roles={discordRoles} 
                                    description="Si vide, tous les rôles de membres de la guilde ayant accès aux raids pourront s'inscrire par défaut." 
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Preview Panel */}
                    <div className="space-y-6">
                        <Card className="bg-surface/60 border-border overflow-hidden">
                            <CardHeader className="bg-surface pb-4">
                                <CardTitle className="text-sm text-foreground">Aperçu du message Raid</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 relative">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-danger flex items-center justify-center shrink-0">
                                        <Swords className="w-5 h-5 text-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="font-medium text-danger">SigilOS</span>
                                            <span className="bg-danger/20 text-danger text-caption px-1 rounded">BOT</span>
                                            <span className="text-xs text-muted-foreground">Maintenant</span>
                                        </div>

                                        <div className="bg-[#2b2d31] rounded border-l-4 border-danger p-4 max-w-sm">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-lg">⚔️</span>
                                                <h4 className="font-semibold text-foreground text-sm">Nouveau Raid</h4>
                                            </div>

                                            <p className="text-foreground text-sm mb-3 font-medium">
                                                Raid 3.6 - Boss du Désert
                                            </p>

                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>Vendredi 31 Janvier</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Clock className="w-3 h-3" />
                                                    <span>21:00 - 23:00</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-muted-foreground">
                                                    <Users className="w-3 h-3" />
                                                    <span>0/12 places</span>
                                                </div>
                                            </div>

                                            <div className="mt-3 pt-3 border-t border-[#3f4147] flex items-center gap-2">
                                                <div className="w-4 h-4 rounded-full bg-muted" />
                                                <span className="text-[#949ba4] text-xs">SigilOS • Raid</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            </TabsContent>
        </Tabs>

        {/* Garde anti-navigation : avertit si des paramètres calendrier ne sont pas sauvegardés */}
        <UnsavedChangesGuard
            hasUnsavedChanges={hasUnsavedChanges}
            message="Vous avez des modifications des paramètres calendrier non sauvegardées. Quitter cette page les perdra définitivement."
        />
        </>
    );
}
