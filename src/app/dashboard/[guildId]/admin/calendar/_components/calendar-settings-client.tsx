"use client";

/**
 * CalendarSettingsClient - Discord Notification Configuration
 * Pattern identical to songes-settings-client.tsx
 */

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Save, AlertTriangle, Hash, Calendar, Users, Clock, Swords, Coins } from "lucide-react";
import { toast } from "sonner";
import { getCalendarConfig, updateCalendarChannel, updateRaidChannel, updateRaidGigalodonChannel, updateRaidSanctuaireChannel, updateRaidKamaDonationRequired, updateRaidKamaDonationThreshold, updateRaidAllowedSignUpRolesAction } from "@/server/actions/admin-actions";
import { getDiscordRolesAction, updateAllowedPingRolesAction } from "@/server/actions/user-actions";
import { PingRolesSelector } from "@/components/admin/ping-roles-selector";
import { ChannelPreview } from "@/components/shared/ChannelPreview";

interface CalendarSettingsClientProps {
    guildId: string;
}

export function CalendarSettingsClient({ guildId }: CalendarSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [raidChannelId, setRaidChannelId] = useState<string>("");
    const [raidGigalodonChannelId, setRaidGigalodonChannelId] = useState<string>("");
    const [raidSanctuaireChannelId, setRaidSanctuaireChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);
    const [isRaidConfigured, setIsRaidConfigured] = useState(false);
    const [isGigalodonConfigured, setIsGigalodonConfigured] = useState(false);
    const [isSanctuaireConfigured, setIsSanctuaireConfigured] = useState(false);
    
    const [calendarPingRoleIds, setCalendarPingRoleIds] = useState<string[]>([]);
    const [raidPingRoleIds, setRaidPingRoleIds] = useState<string[]>([]);
    const [raidAllowedSignUpRoleIds, setRaidAllowedSignUpRoleIds] = useState<string[]>([]);
    const [discordRoles, setDiscordRoles] = useState<{ id: string, name: string, color: string }[]>([]);
    const [raidRequireKamaDonation, setRaidRequireKamaDonation] = useState(true);
    const [raidKamaDonationThreshold, setRaidKamaDonationThreshold] = useState(3);

    useEffect(() => {
        async function loadConfig() {
            const [result, rolesRes] = await Promise.all([
                getCalendarConfig(guildId),
                getDiscordRolesAction(guildId, { ignoreWhitelist: true })
            ]);
            if (result.success && result.data) {
                setChannelId(result.data.calendarChannelId || "");
                setIsConfigured(!!result.data.calendarChannelId);
                setCalendarPingRoleIds(result.data.calendarPingRoleIds || []);
                setRaidChannelId(result.data.raidChannelId || "");
                setIsRaidConfigured(!!result.data.raidChannelId);
                setRaidPingRoleIds(result.data.raidPingRoleIds || []);
                setRaidGigalodonChannelId(result.data.raidGigalodonChannelId || "");
                setIsGigalodonConfigured(!!result.data.raidGigalodonChannelId);
                setRaidSanctuaireChannelId(result.data.raidSanctuaireChannelId || "");
                setIsSanctuaireConfigured(!!result.data.raidSanctuaireChannelId);
                setRaidRequireKamaDonation(result.data.raidRequireKamaDonation ?? true);
                setRaidKamaDonationThreshold(result.data.raidKamaDonationThreshold ?? 3);
                setRaidAllowedSignUpRoleIds(result.data.raidAllowedSignUpRoleIds || []);
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
                toast.success("Configuration Calendrier sauvegardée !");
                setIsConfigured(!!channelId.trim());
            } else {
                toast.error(result.error || pingRolesResult.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const handleSaveRaid = () => {
        startTransition(async () => {
            const result = await updateRaidChannel(guildId, raidChannelId.trim() || null);
            const pingRolesResult = await updateAllowedPingRolesAction(guildId, raidPingRoleIds, "raid");
            const signUpRolesResult = await updateRaidAllowedSignUpRolesAction(guildId, raidAllowedSignUpRoleIds);

            if (result.success && pingRolesResult.success && signUpRolesResult.success) {
                toast.success("Configuration Raids sauvegardée !");
                setIsRaidConfigured(!!raidChannelId.trim());
            } else {
                toast.error(result.error || pingRolesResult.error || signUpRolesResult.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const handleSaveRaidGigalodon = () => {
        startTransition(async () => {
            const result = await updateRaidGigalodonChannel(guildId, raidGigalodonChannelId.trim() || null);
            if (result.success) {
                toast.success("Configuration Raid Gigalodon sauvegardée !");
                setIsGigalodonConfigured(!!raidGigalodonChannelId.trim());
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const handleSaveRaidSanctuaire = () => {
        startTransition(async () => {
            const result = await updateRaidSanctuaireChannel(guildId, raidSanctuaireChannelId.trim() || null);
            if (result.success) {
                toast.success("Configuration Raid Sanctuaire sauvegardée !");
                setIsSanctuaireConfigured(!!raidSanctuaireChannelId.trim());
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const handleClearCalendar = () => {
        startTransition(async () => {
            const result = await updateCalendarChannel(guildId, null);
            if (result.success) {
                setChannelId("");
                setIsConfigured(false);
                toast.success("Notifications Calendrier désactivées");
            } else {
                toast.error(result.error || "Erreur lors de la désactivation");
            }
        });
    };

    const handleClearRaid = () => {
        startTransition(async () => {
            const result = await updateRaidChannel(guildId, null);
            if (result.success) {
                setRaidChannelId("");
                setIsRaidConfigured(false);
                toast.success("Notifications Raids désactivées");
            } else {
                toast.error(result.error || "Erreur lors de la désactivation");
            }
        });
    };

    const handleClearRaidGigalodon = () => {
        startTransition(async () => {
            const result = await updateRaidGigalodonChannel(guildId, null);
            if (result.success) {
                setRaidGigalodonChannelId("");
                setIsGigalodonConfigured(false);
                toast.success("Notifications Raid Gigalodon désactivées");
            } else {
                toast.error(result.error || "Erreur lors de la désactivation");
            }
        });
    };

    const handleClearRaidSanctuaire = () => {
        startTransition(async () => {
            const result = await updateRaidSanctuaireChannel(guildId, null);
            if (result.success) {
                setRaidSanctuaireChannelId("");
                setIsSanctuaireConfigured(false);
                toast.success("Notifications Raid Sanctuaire désactivées");
            } else {
                toast.error(result.error || "Erreur lors de la désactivation");
            }
        });
    };

    const handleToggleKamaDonation = (enabled: boolean) => {
        startTransition(async () => {
            const result = await updateRaidKamaDonationRequired(guildId, enabled);
            if (result.success) {
                setRaidRequireKamaDonation(enabled);
                toast.success(enabled
                    ? "Don de kamas requis activé pour les Raids ✅"
                    : "Don de kamas désactivé — Accès Raids libre ⚠️"
                );
            } else {
                toast.error(result.error || "Erreur lors de la mise à jour");
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
        <Tabs defaultValue="calendar" className="w-full space-y-6">
            <TabsList className="bg-surface border border-border p-1 rounded-xl">
                <TabsTrigger value="calendar" className="text-xs font-black uppercase tracking-widest px-6 py-2.5 rounded-lg data-[state=active]:bg-warning data-[state=active]:text-foreground">
                    Calendrier Général
                </TabsTrigger>
                <TabsTrigger value="raid" className="text-xs font-black uppercase tracking-widest px-6 py-2.5 rounded-lg data-[state=active]:bg-danger data-[state=active]:text-foreground">
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
                            <div className="relative pl-6 border-l-2 border-border pb-6 last:pb-0">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-elevated border-2 border-zinc-950 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                </div>
                                <h3 className="text-sm font-medium text-foreground mb-2">1. Récupérer l'ID du salon</h3>
                                <p className="text-xs text-muted-foreground mb-3">
                                    Activez le mode développeur Discord, puis faites <span className="text-foreground">Clic Droit</span> sur le salon voulu {'>'} <span className="text-foreground">Copier l'identifiant</span>.
                                </p>
                            </div>

                            <div className="relative pl-6 border-l-2 border-warning/50 pb-6">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-warning border-2 border-zinc-950 " />
                                <h3 className="text-sm font-medium text-foreground mb-4">2. Coller l'identifiant</h3>

                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <Input
                                            value={channelId}
                                            onChange={(e) => setChannelId(e.target.value)}
                                            placeholder="Ex: 123456789012345678"
                                            className="font-mono bg-black/20 border-border text-foreground"
                                        />
                                        <Button onClick={handleSaveCalendar} disabled={isPending} className="min-w-[120px] bg-warning hover:bg-warning text-warning-foreground">
                                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                            Sauvegarder
                                        </Button>
                                    </div>
                                    <ChannelPreview guildId={guildId} channelId={channelId} color="amber" />
                                    {isConfigured && (
                                        <div className="flex justify-end">
                                            <Button variant="ghost" size="sm" onClick={handleClearCalendar} disabled={isPending} className="text-danger hover:text-danger hover:bg-danger/20 h-auto py-1 px-3 text-xs">
                                                Désactiver l'intégration
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="relative pl-6 border-l-2 border-transparent">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-elevated border-2 border-zinc-950 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
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
                                {isRaidConfigured ? (
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
                            <div className="relative pl-6 border-l-2 border-border pb-6 last:pb-0">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-elevated border-2 border-zinc-950 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                </div>
                                <h3 className="text-sm font-medium text-foreground mb-2">1. Récupérer l'ID du salon</h3>
                                <p className="text-xs text-muted-foreground mb-3">
                                    Faites <span className="text-foreground">Clic Droit</span> sur le salon de Raid voulu {'>'} <span className="text-foreground">Copier l'identifiant</span>.
                                </p>
                            </div>

                            <div className="relative pl-6 border-l-2 border-danger/50 space-y-8 pb-6">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-danger border-2 border-zinc-950 " />
                                
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-foreground">2.1 Salon Raid Gigalodon</h3>
                                        {isGigalodonConfigured ? (
                                            <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20 h-5 text-caption">Configuré</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground h-5 text-caption">Repli actif</Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            value={raidGigalodonChannelId}
                                            onChange={(e) => setRaidGigalodonChannelId(e.target.value)}
                                            placeholder="Ex: 123456789012345678 (Spécifique Gigalodon)"
                                            className="font-mono bg-black/20 border-border text-foreground"
                                        />
                                        <Button onClick={handleSaveRaidGigalodon} disabled={isPending} className="min-w-[120px] bg-danger hover:bg-danger text-danger-foreground">
                                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                            Sauvegarder
                                        </Button>
                                    </div>
                                    <ChannelPreview guildId={guildId} channelId={raidGigalodonChannelId} color="rose" />
                                    {isGigalodonConfigured && (
                                        <div className="flex justify-end">
                                            <Button variant="ghost" size="sm" onClick={handleClearRaidGigalodon} disabled={isPending} className="text-danger hover:text-danger hover:bg-danger/20 h-auto py-1 px-3 text-xs">
                                                Désactiver ce salon
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-foreground">2.2 Salon Raid Sanctuaire des Jardins Éternels</h3>
                                        {isSanctuaireConfigured ? (
                                            <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20 h-5 text-caption">Configuré</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground h-5 text-caption">Repli actif</Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            value={raidSanctuaireChannelId}
                                            onChange={(e) => setRaidSanctuaireChannelId(e.target.value)}
                                            placeholder="Ex: 123456789012345678 (Spécifique Sanctuaire)"
                                            className="font-mono bg-black/20 border-border text-foreground"
                                        />
                                        <Button onClick={handleSaveRaidSanctuaire} disabled={isPending} className="min-w-[120px] bg-danger hover:bg-danger text-danger-foreground">
                                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                            Sauvegarder
                                        </Button>
                                    </div>
                                    <ChannelPreview guildId={guildId} channelId={raidSanctuaireChannelId} color="rose" />
                                    {isSanctuaireConfigured && (
                                        <div className="flex justify-end">
                                            <Button variant="ghost" size="sm" onClick={handleClearRaidSanctuaire} disabled={isPending} className="text-danger hover:text-danger hover:bg-danger/20 h-auto py-1 px-3 text-xs">
                                                Désactiver ce salon
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-foreground">2.3 Salon Raid Général (Repli par défaut)</h3>
                                        {isRaidConfigured ? (
                                            <Badge className="bg-success/10 text-success border-success/20 hover:bg-success/20 h-5 text-caption">Actif</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-muted-foreground h-5 text-caption">Calendrier général</Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            value={raidChannelId}
                                            onChange={(e) => setRaidChannelId(e.target.value)}
                                            placeholder="Ex: 123456789012345678 (optionnel)"
                                            className="font-mono bg-black/20 border-border text-foreground"
                                        />
                                        <Button onClick={handleSaveRaid} disabled={isPending} className="min-w-[120px] bg-danger hover:bg-danger text-danger-foreground">
                                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                            Sauvegarder
                                        </Button>
                                    </div>
                                    <ChannelPreview guildId={guildId} channelId={raidChannelId} color="rose" />
                                    {isRaidConfigured && (
                                        <div className="flex justify-end">
                                            <Button variant="ghost" size="sm" onClick={handleClearRaid} disabled={isPending} className="text-danger hover:text-danger hover:bg-danger/20 h-auto py-1 px-3 text-xs">
                                                Désactiver le salon de Raid Général
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="relative pl-6 border-l-2 border-transparent">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-elevated border-2 border-zinc-950 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                </div>
                                <h3 className="text-sm font-medium text-foreground mb-2">3. Don de Kamas</h3>
                                <p className="text-xs text-muted-foreground mb-4">
                                    Quand activé, les membres doivent avoir fait un <strong className="text-warning">don de 30 000 kamas validé</strong> dans la semaine Dofus de l'événement pour s'inscrire aux Raids, et le <strong className="text-warning">widget d'upload de don</strong> apparaît sur la page Missions.
                                </p>

                                {/* Toggle Card */}
                                <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 transition-all duration-200 ${
                                    raidRequireKamaDonation
                                        ? "bg-warning/5 border-warning/20"
                                        : "bg-elevated/60 border-border"
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-lg transition-colors ${
                                            raidRequireKamaDonation ? "bg-warning/20" : "bg-muted"
                                        }`}>
                                            <Coins className={`w-5 h-5 transition-colors ${
                                                raidRequireKamaDonation ? "text-warning" : "text-muted-foreground"
                                            }`} />
                                        </div>
                                        <div>
                                            <p className={`text-sm font-semibold transition-colors ${
                                                raidRequireKamaDonation ? "text-warning" : "text-foreground"
                                            }`}>
                                                {raidRequireKamaDonation ? "Don requis activé" : "Don requis désactivé"}
                                            </p>
                                            <p className="text-xs text-muted-foreground mt-0.5">
                                                {raidRequireKamaDonation
                                                    ? "Don obligatoire pour les raids • Widget d'upload visible sur Missions"
                                                    : "Tous les membres avec le rôle Raid peuvent s'inscrire librement • Widget d'upload masqué sur Missions"
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleToggleKamaDonation(!raidRequireKamaDonation)}
                                        disabled={isPending}
                                        aria-label="Activer/désactiver don kamas requis"
                                        className={`relative w-12 h-6 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-warning/50 disabled:opacity-50 ${
                                            raidRequireKamaDonation ? "bg-warning" : "bg-muted"
                                        }`}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-background rounded-full shadow-sm transition-transform duration-200 ${
                                            raidRequireKamaDonation ? "translate-x-6" : "translate-x-0"
                                        }`} />
                                    </button>
                                </div>

                                {/* Threshold selector — visible when donation is enabled */}
                                {raidRequireKamaDonation && (
                                    <div className="mt-3 p-3 rounded-xl bg-elevated/40 border border-border">
                                        <div className="flex items-center justify-between gap-4">
                                            <div className="flex items-center gap-2.5">
                                                <div className="p-1.5 rounded-lg bg-violet-500/15">
                                                    <img src="/kamas-violet.png" alt="🟣" className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <p className="text-xs font-semibold text-foreground">
                                                        Seuil de don requis
                                                    </p>
                                                    <p className="text-caption text-muted-foreground mt-0.5">
                                                        1 🟣 = 1 000 k • Actuellement {raidKamaDonationThreshold * 10} 🟣 ({raidKamaDonationThreshold * 10_000} k)
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-1">
                                                {[1, 2, 3, 4, 5].map(t => (
                                                    <button
                                                        key={t}
                                                        onClick={() => {
                                                            startTransition(async () => {
                                                                const res = await updateRaidKamaDonationThreshold(guildId, t);
                                                                if (res.success) {
                                                                    setRaidKamaDonationThreshold(t);
                                                                    toast.success(`Seuil défini à ${t * 10} 🟣 (${t * 10_000} k)`);
                                                                } else {
                                                                    toast.error(res.error || "Erreur");
                                                                }
                                                            });
                                                        }}
                                                        disabled={isPending}
                                                        className={`w-9 h-9 rounded-lg text-xs font-bold transition-all ${
                                                            raidKamaDonationThreshold === t
                                                                ? "bg-violet-500/30 text-violet-300 border border-violet-500/40 shadow-sm"
                                                                : "bg-elevated text-muted-foreground border border-border/50 hover:bg-muted"
                                                        }`}
                                                    >
                                                        {t * 10}🟣
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {!raidRequireKamaDonation && (
                                    <div className="mt-3 flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                                        <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-orange-300/80 leading-relaxed">
                                            Le don de kamas est <strong>fortement recommandé</strong> pour financer les raids et faire progresser la guilde. Pensez à réactiver ce toggle pour que le widget d'upload de don réapparaisse sur la page Missions.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="relative pl-6 border-l-2 border-transparent">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-elevated border-2 border-zinc-950 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                </div>
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-medium text-foreground">3. Rôles de Ping Autorisés (Raids)</h3>
                                    <Button 
                                        onClick={handleSaveRaid} 
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
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-danger border-2 border-zinc-950 " />
                                <div className="flex items-center justify-between mb-2">
                                    <h3 className="text-sm font-medium text-foreground">4. Whitelist des Rôles d'Inscription (Raid Guilde)</h3>
                                    <Button 
                                        onClick={handleSaveRaid} 
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
    );
}
