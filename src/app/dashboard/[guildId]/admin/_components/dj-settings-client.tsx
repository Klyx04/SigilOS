"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, Hash, Bell } from "lucide-react";
import { toast } from "sonner";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";
import { getDungeonFinderConfig, updateDjSettings } from "@/server/actions/dungeon-finder-actions";
import { getDiscordRolesAction, updateAllowedPingRolesAction } from "@/server/actions/user-actions";
import { PingRolesSelector } from "@/components/admin/ping-roles-selector";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";

interface DjSettingsClientProps {
    guildId: string;
}

export function DjSettingsClient({ guildId }: DjSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isConfigured, setIsConfigured] = useState(false);
    
    const [djPingRoleIds, setDjPingRoleIds] = useState<string[]>([]);
    const [discordRoles, setDiscordRoles] = useState<{ id: string, name: string, color: string }[]>([]);

    // — Détection « modifications non sauvegardées » (snapshot chargé vs état courant)
    const [initialConfig, setInitialConfig] = useState<{ channelId: string; djPingRoleIds: string[] } | null>(null);
    const hasUnsavedChanges = isDirty(
        { channelId, djPingRoleIds: [...djPingRoleIds].sort() },
        initialConfig ? { channelId: initialConfig.channelId, djPingRoleIds: [...initialConfig.djPingRoleIds].sort() } : null
    );

    useEffect(() => {
        async function loadConfig() {
            const [result, rolesRes] = await Promise.all([
                getDungeonFinderConfig(guildId),
                getDiscordRolesAction(guildId, { ignoreWhitelist: true })
            ]);
            if (result.success && result.data) {
                setChannelId(result.data.djNotifyChannelId || "");
                setIsConfigured(!!result.data.djNotifyChannelId);
                setDjPingRoleIds(result.data.djPingRoleIds || []);
                setInitialConfig({
                    channelId: result.data.djNotifyChannelId || "",
                    djPingRoleIds: result.data.djPingRoleIds || [],
                });
            }
            if (rolesRes.success && rolesRes.roles) {
                setDiscordRoles(rolesRes.roles.filter((r: any) => r.name !== "@everyone") as any);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateDjSettings(guildId, {
                djNotifyChannelId: channelId.trim() || null
            });
            const pingRolesResult = await updateAllowedPingRolesAction(guildId, djPingRoleIds, "dj");

            if (result.success && pingRolesResult.success) {
                toast.success("Configuration Donjons & Quêtes sauvegardée !");
                setIsConfigured(!!channelId.trim());
                setInitialConfig({ channelId: channelId.trim(), djPingRoleIds: [...djPingRoleIds] });
            } else {
                toast.error(result.error || pingRolesResult.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    const handleClear = () => {
        startTransition(async () => {
            const result = await updateDjSettings(guildId, { djNotifyChannelId: null });
            if (result.success) {
                setChannelId("");
                setIsConfigured(false);
                setInitialConfig({ channelId: "", djPingRoleIds: [...djPingRoleIds] });
                toast.success("Notifications Donjons désactivées");
            } else {
                toast.error(result.error || "Erreur lors de la désactivation");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-info" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            <UnsavedChangesGuard hasUnsavedChanges={hasUnsavedChanges} />
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <Card className="lg:col-span-2 bg-surface/60 border-border overflow-hidden">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <span className="bg-info/20 text-info p-2 rounded-lg">
                                    <Bell className="w-5 h-5" />
                                </span>
                                Notifications Donjons & Quêtes
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
                            Configurez le salon Discord qui recevra les annonces de recherche de joueurs pour les Donjons et Quêtes.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Step 1 */}
                        <div className="relative pl-6 border-l-2 border-border pb-6 last:pb-0">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-elevated border-2 border-border flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-muted" />
                            </div>
                            <h3 className="text-sm font-medium text-foreground mb-2">1. Choisissez le salon</h3>
                            <p className="text-xs text-muted-foreground mb-3">
                                Sélectionnez le salon dans la liste — plus besoin de copier son identifiant.
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className="relative pl-6 border-l-2 border-info/50">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-info border-2 border-border " />
                            <h3 className="text-sm font-medium text-foreground mb-4">2. Enregistrer</h3>

                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <div className="flex-1 min-w-0">
                                        <DiscordChannelPicker
                                            guildId={guildId}
                                            value={channelId}
                                            onChange={setChannelId}
                                        />
                                    </div>
                                    <Button onClick={handleSave} disabled={isPending} className="min-w-[120px] bg-info hover:bg-info">
                                        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Sauvegarder
                                        {hasUnsavedChanges && !isPending && <span className="ml-2 w-2 h-2 rounded-full bg-white animate-pulse" title="Modifications non sauvegardées" />}
                                    </Button>
                                </div>
                                {isConfigured && (
                                    <div className="flex justify-end">
                                        <Button variant="ghost" size="sm" onClick={handleClear} disabled={isPending} className="text-danger hover:text-danger hover:bg-danger/20 h-auto py-1 px-3 text-xs">
                                            Désactiver l'intégration
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Step 3 - Pings */}
                        <div className="relative pl-6 border-l-2 border-transparent">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-elevated border-2 border-border flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-muted" />
                            </div>
                            <h3 className="text-sm font-medium text-foreground mb-2">3. Rôles de Ping Autorisés (Whitelist)</h3>
                            <p className="text-xs text-muted-foreground mb-4">
                                Définissez quels rôles Discord les membres peuvent mentionner lors de la création d'événements Donjons/Quêtes.
                            </p>
                            <PingRolesSelector 
                                value={djPingRoleIds} 
                                onChange={setDjPingRoleIds} 
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
                            {/* Discord Message Mockup */}
                            <div className="flex items-start gap-4 text-left">
                                <div className="w-10 h-10 rounded-full bg-info flex items-center justify-center shrink-0">
                                    <Bell className="w-5 h-5 text-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-info">SigilOS</span>
                                        <span className="bg-info/20 text-info text-caption px-1 rounded">BOT</span>
                                        <span className="text-xs text-muted-foreground">Maintenant</span>
                                    </div>

                                    {/* Embed */}
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-info p-4 max-w-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">⚔️</span>
                                            <h4 className="font-semibold text-foreground text-sm">Recherche de Groupe</h4>
                                        </div>

                                        <p className="text-foreground text-xs mb-3 leading-relaxed">
                                            <span className="text-info font-medium hover:underline cursor-pointer">Wylan</span> a ouvert un recrutement pour le donjon **Tal Kasha**.
                                        </p>

                                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                            <div>
                                                <div className="text-[#b5bac1] text-caption font-bold uppercase tracking-wider mb-0.5">Activité</div>
                                                <div className="text-foreground text-xs">SUCCÈS / SCORE</div>
                                            </div>
                                            <div>
                                                <div className="text-[#b5bac1] text-caption font-bold uppercase tracking-wider mb-0.5">Places</div>
                                                <div className="text-foreground text-xs">👥 2 / 4</div>
                                            </div>
                                            <div className="col-span-2">
                                                <div className="text-[#b5bac1] text-caption font-bold uppercase tracking-wider mb-0.5">Description</div>
                                                <div className="text-foreground text-xs">Besoin d'un Panda et Enu pour le succès.</div>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-[#3f4147] flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-muted" />
                                            <span className="text-[#949ba4] text-caption">SigilOS • Dungeon Finder</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-info/5 border-info/10">
                        <CardContent className="p-4 flex gap-3 text-left">
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
            </div>
    );
}
