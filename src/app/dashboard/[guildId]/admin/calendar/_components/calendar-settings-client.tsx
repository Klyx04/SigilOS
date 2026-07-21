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
import { getCalendarConfig, updateCalendarChannel, updateRaidChannel, updateRaidGigalodonChannel, updateRaidSanctuaireChannel, updateRaidKamaDonationRequired } from "@/server/actions/admin-actions";
import { getDiscordRolesAction, updateAllowedPingRolesAction } from "@/server/actions/user-actions";
import { PingRolesSelector } from "@/components/admin/ping-roles-selector";

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
    const [discordRoles, setDiscordRoles] = useState<{ id: string, name: string, color: string }[]>([]);
    const [raidRequireKamaDonation, setRaidRequireKamaDonation] = useState(true);

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

            if (result.success && pingRolesResult.success) {
                toast.success("Configuration Raids sauvegardée !");
                setIsRaidConfigured(!!raidChannelId.trim());
            } else {
                toast.error(result.error || pingRolesResult.error || "Erreur lors de la sauvegarde");
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
            <TabsList className="bg-zinc-900 border border-white/5 p-1 rounded-xl">
                <TabsTrigger value="calendar" className="text-xs font-black uppercase tracking-widest px-6 py-2.5 rounded-lg data-[state=active]:bg-amber-600 data-[state=active]:text-white">
                    Calendrier Général
                </TabsTrigger>
                <TabsTrigger value="raid" className="text-xs font-black uppercase tracking-widest px-6 py-2.5 rounded-lg data-[state=active]:bg-red-600 data-[state=active]:text-white">
                    Raids Officiels
                </TabsTrigger>
            </TabsList>

            <TabsContent value="calendar" className="space-y-6 outline-none">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Configuration Panel */}
                    <Card className="lg:col-span-2 bg-zinc-900/60 border-white/5">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-white">
                                    <span className="bg-amber-500/20 text-amber-400 p-2 rounded-lg">
                                        <Hash className="w-5 h-5" />
                                    </span>
                                    Salon Discord (Calendrier)
                                </CardTitle>
                                {isConfigured ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
                                        Actif
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-zinc-500">
                                        Inactif
                                    </Badge>
                                )}
                            </div>
                            <CardDescription>
                                Les événements du calendrier général seront partagés dans ce salon.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <div className="relative pl-6 border-l-2 border-white/5 pb-6 last:pb-0">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                </div>
                                <h3 className="text-sm font-medium text-white mb-2">1. Récupérer l'ID du salon</h3>
                                <p className="text-xs text-zinc-500 mb-3">
                                    Activez le mode développeur Discord, puis faites <span className="text-zinc-300">Clic Droit</span> sur le salon voulu {'>'} <span className="text-zinc-300">Copier l'identifiant</span>.
                                </p>
                            </div>

                            <div className="relative pl-6 border-l-2 border-amber-500/50 pb-6">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-amber-500 border-2 border-zinc-950 shadow-[0_0_10px_rgba(245,158,11,0.5)]" />
                                <h3 className="text-sm font-medium text-white mb-4">2. Coller l'identifiant</h3>

                                <div className="space-y-4">
                                    <div className="flex gap-2">
                                        <Input
                                            value={channelId}
                                            onChange={(e) => setChannelId(e.target.value)}
                                            placeholder="Ex: 123456789012345678"
                                            className="font-mono bg-black/20 border-white/10 text-white"
                                        />
                                        <Button onClick={handleSaveCalendar} disabled={isPending} className="min-w-[120px] bg-amber-600 hover:bg-amber-500 text-white">
                                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                            Sauvegarder
                                        </Button>
                                    </div>
                                    {isConfigured && (
                                        <div className="flex justify-end">
                                            <Button variant="ghost" size="sm" onClick={handleClearCalendar} disabled={isPending} className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-auto py-1 px-3 text-xs">
                                                Désactiver l'intégration
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="relative pl-6 border-l-2 border-transparent">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                </div>
                                <h3 className="text-sm font-medium text-white mb-2">3. Rôles de Ping Autorisés (Whitelist)</h3>
                                <p className="text-xs text-zinc-500 mb-4">
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
                        <Card className="bg-zinc-900/60 border-white/5 overflow-hidden">
                            <CardHeader className="bg-white/5 pb-4">
                                <CardTitle className="text-sm text-zinc-300">Aperçu du message</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 relative">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-amber-500 flex items-center justify-center shrink-0">
                                        <Calendar className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="font-medium text-amber-400">SigilOS</span>
                                            <span className="bg-amber-500/20 text-amber-300 text-[10px] px-1 rounded">BOT</span>
                                            <span className="text-xs text-zinc-500">Maintenant</span>
                                        </div>

                                        <div className="bg-[#2b2d31] rounded border-l-4 border-amber-400 p-4 max-w-sm">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-lg">📅</span>
                                                <h4 className="font-semibold text-white text-sm">Nouvel événement</h4>
                                            </div>

                                            <p className="text-zinc-300 text-sm mb-3 font-medium">
                                                Sortie Donjon - Clés Offertes
                                            </p>

                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex items-center gap-2 text-zinc-400">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>Vendredi 31 Janvier</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-zinc-400">
                                                    <Clock className="w-3 h-3" />
                                                    <span>21:00 - 23:00</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-zinc-400">
                                                    <Users className="w-3 h-3" />
                                                    <span>0/8 places</span>
                                                </div>
                                            </div>

                                            <div className="mt-3 pt-3 border-t border-[#3f4147] flex items-center gap-2">
                                                <div className="w-4 h-4 rounded-full bg-zinc-700" />
                                                <span className="text-[#949ba4] text-xs">SigilOS • Calendrier</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-blue-500/5 border-blue-500/10">
                            <CardContent className="p-4 flex gap-3">
                                <div className="p-2 bg-blue-500/20 rounded-lg shrink-0 h-fit">
                                    <AlertTriangle className="w-4 h-4 text-blue-400" />
                                </div>
                                <div className="space-y-1">
                                    <h4 className="text-sm font-medium text-blue-200">Permissions requises</h4>
                                    <p className="text-xs text-blue-300/70 leading-relaxed">
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
                    <Card className="lg:col-span-2 bg-zinc-900/60 border-white/5">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-white">
                                    <span className="bg-red-500/20 text-red-400 p-2 rounded-lg">
                                        <Swords className="w-5 h-5" />
                                    </span>
                                    Salon Discord (Raids)
                                </CardTitle>
                                {isRaidConfigured ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20">
                                        Actif
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="text-zinc-500">
                                        Calendrier (Repli)
                                    </Badge>
                                )}
                            </div>
                            <CardDescription>
                                Les événements de type <strong>Raid Officiel 3.6</strong> seront partagés dans ce salon dédié. Si aucun salon n'est spécifié, le salon général du calendrier ci-dessus sera utilisé en repli.
                            </CardDescription>
                        </CardHeader>

                        <CardContent className="space-y-6">
                            <div className="relative pl-6 border-l-2 border-white/5 pb-6 last:pb-0">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                </div>
                                <h3 className="text-sm font-medium text-white mb-2">1. Récupérer l'ID du salon</h3>
                                <p className="text-xs text-zinc-500 mb-3">
                                    Faites <span className="text-zinc-300">Clic Droit</span> sur le salon de Raid voulu {'>'} <span className="text-zinc-300">Copier l'identifiant</span>.
                                </p>
                            </div>

                            <div className="relative pl-6 border-l-2 border-red-500/50 space-y-8 pb-6">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-red-500 border-2 border-zinc-950 shadow-[0_0_10px_rgba(239,68,68,0.5)]" />
                                
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-white">2.1 Salon Raid Gigalodon</h3>
                                        {isGigalodonConfigured ? (
                                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 h-5 text-[10px]">Configuré</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-zinc-500 h-5 text-[10px]">Repli actif</Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            value={raidGigalodonChannelId}
                                            onChange={(e) => setRaidGigalodonChannelId(e.target.value)}
                                            placeholder="Ex: 123456789012345678 (Spécifique Gigalodon)"
                                            className="font-mono bg-black/20 border-white/10 text-white"
                                        />
                                        <Button onClick={handleSaveRaidGigalodon} disabled={isPending} className="min-w-[120px] bg-red-600 hover:bg-red-500 text-white">
                                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                            Sauvegarder
                                        </Button>
                                    </div>
                                    {isGigalodonConfigured && (
                                        <div className="flex justify-end">
                                            <Button variant="ghost" size="sm" onClick={handleClearRaidGigalodon} disabled={isPending} className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-auto py-1 px-3 text-xs">
                                                Désactiver ce salon
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-white">2.2 Salon Raid Sanctuaire des Jardins Éternels</h3>
                                        {isSanctuaireConfigured ? (
                                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 h-5 text-[10px]">Configuré</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-zinc-500 h-5 text-[10px]">Repli actif</Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            value={raidSanctuaireChannelId}
                                            onChange={(e) => setRaidSanctuaireChannelId(e.target.value)}
                                            placeholder="Ex: 123456789012345678 (Spécifique Sanctuaire)"
                                            className="font-mono bg-black/20 border-white/10 text-white"
                                        />
                                        <Button onClick={handleSaveRaidSanctuaire} disabled={isPending} className="min-w-[120px] bg-red-600 hover:bg-red-500 text-white">
                                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                            Sauvegarder
                                        </Button>
                                    </div>
                                    {isSanctuaireConfigured && (
                                        <div className="flex justify-end">
                                            <Button variant="ghost" size="sm" onClick={handleClearRaidSanctuaire} disabled={isPending} className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-auto py-1 px-3 text-xs">
                                                Désactiver ce salon
                                            </Button>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-sm font-medium text-white">2.3 Salon Raid Général (Repli par défaut)</h3>
                                        {isRaidConfigured ? (
                                            <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20 h-5 text-[10px]">Actif</Badge>
                                        ) : (
                                            <Badge variant="outline" className="text-zinc-500 h-5 text-[10px]">Calendrier général</Badge>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <Input
                                            value={raidChannelId}
                                            onChange={(e) => setRaidChannelId(e.target.value)}
                                            placeholder="Ex: 123456789012345678 (optionnel)"
                                            className="font-mono bg-black/20 border-white/10 text-white"
                                        />
                                        <Button onClick={handleSaveRaid} disabled={isPending} className="min-w-[120px] bg-red-600 hover:bg-red-500 text-white">
                                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                            Sauvegarder
                                        </Button>
                                    </div>
                                    {isRaidConfigured && (
                                        <div className="flex justify-end">
                                            <Button variant="ghost" size="sm" onClick={handleClearRaid} disabled={isPending} className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-auto py-1 px-3 text-xs">
                                                Désactiver le salon de Raid Général
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="relative pl-6 border-l-2 border-transparent">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                </div>
                                <h3 className="text-sm font-medium text-white mb-2">3. Condition de Don de Kamas</h3>
                                <p className="text-xs text-zinc-500 mb-4">
                                    Quand activé, les membres doivent avoir fait un <strong className="text-amber-400">don de 30 000 kamas validé</strong> dans la semaine Dofus de l'événement pour s'inscrire aux Raids.
                                </p>

                                {/* Toggle Card */}
                                <div className={`rounded-xl border p-4 flex items-center justify-between gap-4 transition-all duration-200 ${
                                    raidRequireKamaDonation
                                        ? "bg-amber-500/5 border-amber-500/20"
                                        : "bg-zinc-800/60 border-white/5"
                                }`}>
                                    <div className="flex items-center gap-3">
                                        <div className={`p-2.5 rounded-lg transition-colors ${
                                            raidRequireKamaDonation ? "bg-amber-500/20" : "bg-zinc-700"
                                        }`}>
                                            <Coins className={`w-5 h-5 transition-colors ${
                                                raidRequireKamaDonation ? "text-amber-400" : "text-zinc-400"
                                            }`} />
                                        </div>
                                        <div>
                                            <p className={`text-sm font-semibold transition-colors ${
                                                raidRequireKamaDonation ? "text-amber-300" : "text-zinc-300"
                                            }`}>
                                                {raidRequireKamaDonation ? "Don requis activé" : "Don requis désactivé"}
                                            </p>
                                            <p className="text-xs text-zinc-500 mt-0.5">
                                                {raidRequireKamaDonation
                                                    ? "30 000 kamas validés obligatoires pour s'inscrire"
                                                    : "Tous les membres avec le rôle Raid peuvent s'inscrire librement"
                                                }
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleToggleKamaDonation(!raidRequireKamaDonation)}
                                        disabled={isPending}
                                        aria-label="Activer/désactiver don kamas requis"
                                        className={`relative w-12 h-6 rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-amber-500/50 disabled:opacity-50 ${
                                            raidRequireKamaDonation ? "bg-amber-500" : "bg-zinc-600"
                                        }`}
                                    >
                                        <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
                                            raidRequireKamaDonation ? "translate-x-6" : "translate-x-0"
                                        }`} />
                                    </button>
                                </div>

                                {!raidRequireKamaDonation && (
                                    <div className="mt-3 flex items-start gap-2 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                                        <AlertTriangle className="w-4 h-4 text-orange-400 shrink-0 mt-0.5" />
                                        <p className="text-xs text-orange-300/80 leading-relaxed">
                                            Le don de kamas est <strong>fortement recommandé</strong> pour financer les raids. Pensez à rappeler son importance à vos membres via le module Kamas.
                                        </p>
                                    </div>
                                )}
                            </div>

                            <div className="relative pl-6 border-l-2 border-transparent">
                                <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center">
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                                </div>
                                <h3 className="text-sm font-medium text-white mb-2">3. Rôles de Ping Autorisés (Raids)</h3>
                                <p className="text-xs text-zinc-500 mb-4">
                                    Définissez quels rôles Discord les membres peuvent mentionner spécifiquement pour les événements de Raid Officiel.
                                </p>
                                <PingRolesSelector 
                                    value={raidPingRoleIds} 
                                    onChange={setRaidPingRoleIds} 
                                    roles={discordRoles} 
                                    description="Si vide, la configuration par défaut du calendrier sera utilisée (aucun rôle à moins que configuré)." 
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Preview Panel */}
                    <div className="space-y-6">
                        <Card className="bg-zinc-900/60 border-white/5 overflow-hidden">
                            <CardHeader className="bg-white/5 pb-4">
                                <CardTitle className="text-sm text-zinc-300">Aperçu du message Raid</CardTitle>
                            </CardHeader>
                            <CardContent className="pt-6 relative">
                                <div className="flex items-start gap-4">
                                    <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shrink-0">
                                        <Swords className="w-5 h-5 text-white" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-baseline gap-2 mb-1">
                                            <span className="font-medium text-red-400">SigilOS</span>
                                            <span className="bg-red-500/20 text-red-300 text-[10px] px-1 rounded">BOT</span>
                                            <span className="text-xs text-zinc-500">Maintenant</span>
                                        </div>

                                        <div className="bg-[#2b2d31] rounded border-l-4 border-red-500 p-4 max-w-sm">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className="text-lg">⚔️</span>
                                                <h4 className="font-semibold text-white text-sm">Nouveau Raid</h4>
                                            </div>

                                            <p className="text-zinc-300 text-sm mb-3 font-medium">
                                                Raid 3.6 - Boss du Désert
                                            </p>

                                            <div className="space-y-1.5 text-xs">
                                                <div className="flex items-center gap-2 text-zinc-400">
                                                    <Calendar className="w-3 h-3" />
                                                    <span>Vendredi 31 Janvier</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-zinc-400">
                                                    <Clock className="w-3 h-3" />
                                                    <span>21:00 - 23:00</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-zinc-400">
                                                    <Users className="w-3 h-3" />
                                                    <span>0/12 places</span>
                                                </div>
                                            </div>

                                            <div className="mt-3 pt-3 border-t border-[#3f4147] flex items-center gap-2">
                                                <div className="w-4 h-4 rounded-full bg-zinc-700" />
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
