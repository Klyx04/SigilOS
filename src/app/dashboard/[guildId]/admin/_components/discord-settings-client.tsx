"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Hash, Users, Bell, Sparkles, Megaphone, ShieldAlert, ExternalLink, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { getMissionConfig, updateMissionNotifySettings } from "@/server/actions/admin-actions";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import { ChannelPreview } from "@/components/shared/ChannelPreview";

interface DiscordSettingsClientProps {
    guildId: string;
}

export function DiscordSettingsClient({ guildId }: DiscordSettingsClientProps) {
    const [newsEnabled, setNewsEnabled] = useState<boolean>(false);
    const [lifecycleChannelId, setLifecycleChannelId] = useState<string>("");
    
    const [fullConfig, setFullConfig] = useState<any>(null);
    const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        async function loadData() {
            const [configRes, rolesRes] = await Promise.all([
                getMissionConfig(guildId),
                getDiscordRolesAction(guildId, { ignoreWhitelist: true })

            ]);

            if (configRes.success && configRes.data) {
                setFullConfig(configRes.data);
                setNewsEnabled(configRes.data.newsBroadcastEnabled || false);
                setLifecycleChannelId(configRes.data.lifecycleNotifyChannelId || "");
            }

            if (rolesRes.success && rolesRes.roles) {
                setRoles(rolesRes.roles);
            }

            setIsLoading(false);
        }
        loadData();
    }, [guildId]);

    const handleSave = () => {
        if (!fullConfig) return;

        startTransition(async () => {
            const result = await updateMissionNotifySettings(guildId, {
                channelId: fullConfig.missionChannelId,
                roleId: fullConfig.missionNotifyRoleId,
                validationChannelId: fullConfig.missionValidationChannelId,
                validationRoleId: fullConfig.missionValidationNotifyRoleId,
                kamaNotifyChannelId: fullConfig.kamaNotifyChannelId,
                kamaNotifyRoleId: fullConfig.kamaNotifyRoleId,
                missionManagementNotifyChannelId: fullConfig.missionManagementNotifyChannelId,
                missionManagementNotifyRoleId: fullConfig.missionManagementNotifyRoleId,
                newsBroadcastEnabled: newsEnabled,
                lifecycleNotifyChannelId: lifecycleChannelId.trim() || null,
            });

            if (result.success) {
                toast.success("Paramètres Discord mis à jour !");
                setFullConfig({
                    ...fullConfig,
                    newsBroadcastEnabled: newsEnabled,
                    lifecycleNotifyChannelId: lifecycleChannelId.trim() || null,
                });
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-info/50" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 text-left">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 space-y-6">
                    {/* FLUX D'ACTUALITÉS */}
                    <Card className="bg-surface/60 border-border overflow-hidden group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-foreground font-black uppercase tracking-tighter">
                                <span className="bg-success/20 text-success p-2 rounded-lg">
                                    <Megaphone className="w-5 h-5" />
                                </span>
                                Flux d'Actualités Dofus
                            </CardTitle>
                            <CardDescription className="text-xs font-medium text-muted-foreground">
                                Automatisation du partage des news officielles Ankama.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-foreground">Partage manuel vers Discord</h4>
                                    <p className="text-caption text-muted-foreground leading-relaxed max-w-sm">
                                        Affiche un bouton sur chaque news du dashboard permettant de la poster instantanément.
                                    </p>
                                </div>
                                <Switch 
                                    checked={newsEnabled}
                                    onCheckedChange={setNewsEnabled}
                                    className="data-[state=checked]:bg-success"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* NOTIFICATIONS LIFECYCLE */}
                    <Card className="bg-surface/60 border-border overflow-hidden group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-info/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-foreground font-black uppercase tracking-tighter">
                                <span className="bg-info/20 text-info p-2 rounded-lg">
                                    <Users className="w-5 h-5" />
                                </span>
                                Notifications Lifecycle
                            </CardTitle>
                            <CardDescription className="text-xs font-medium text-muted-foreground">
                                Suivi des départs et bannissements pour la gestion des archives.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-caption uppercase font-black text-muted-foreground ml-1">ID du Salon de Notification</Label>
                                    <div className="relative group/input">
                                        <Input
                                            placeholder="ID du salon (ex: 123...)"
                                            value={lifecycleChannelId}
                                            onChange={(e) => setLifecycleChannelId(e.target.value)}
                                            className="bg-background/50 border-border h-11 pl-10 focus:border-info/50 transition-colors font-mono text-xs"
                                        />
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover/input:text-info transition-colors" />
                                    </div>
                                    <ChannelPreview guildId={guildId} channelId={lifecycleChannelId} color="indigo" />
                                </div>
                                <div className="p-3 rounded-xl bg-info/5 border border-info/10 flex items-start gap-3">
                                    <ShieldAlert className="w-3.5 h-3.5 text-info mt-0.5 shrink-0" />
                                    <p className="text-caption text-muted-foreground leading-relaxed italic">
                                        Indispensable pour savoir quand archiver un profil ou purger les permissions d'un membre banni.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end pt-4">
                        <Button onClick={handleSave} disabled={isPending} className="bg-info hover:bg-info text-info-foreground min-w-[200px] font-bold h-12 shadow-xl shadow-indigo-600/20">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            SAUVEGARDER TOUT
                        </Button>
                    </div>
                </div>

                {/* Preview Panel */}
                <div className="space-y-6">
                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader className="bg-surface pb-4 px-4 py-3">
                            <CardTitle className="text-caption font-black uppercase tracking-widest text-muted-foreground">Aperçu : Départ Membre</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative px-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-info flex items-center justify-center shrink-0">
                                    <Users className="w-4 h-4 text-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-info text-xs">SigilOS</span>
                                        <span className="text-caption text-muted-foreground uppercase font-black tracking-wider">LIFECYCLE</span>
                                    </div>
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-info p-3 max-w-sm shadow-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm">👋</span>
                                            <h4 className="font-semibold text-foreground text-caption">Membre Parti</h4>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-foreground text-caption leading-relaxed">
                                                <span className="text-info font-medium">@Wylan</span> a quitté le serveur Discord.
                                            </p>
                                            <div className="bg-black/20 p-2 rounded border border-border space-y-1">
                                                <div className="flex justify-between items-center text-caption">
                                                    <span className="text-muted-foreground uppercase font-bold">Pseudo Dofus</span>
                                                    <span className="text-foreground">Wylan-PvP</span>
                                                </div>
                                                <div className="flex justify-between items-center text-caption">
                                                    <span className="text-muted-foreground uppercase font-bold">Statut</span>
                                                    <span className="text-warning font-bold">Archivage Requis</span>
                                                </div>
                                            </div>
                                            <div className="w-full py-1 bg-muted text-foreground text-caption font-bold rounded flex items-center justify-center gap-1">
                                                VOIR LE PROFIL <ExternalLink className="w-2.5 h-2.5" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader className="bg-surface pb-4 px-4 py-3">
                            <CardTitle className="text-caption font-black uppercase tracking-widest text-muted-foreground">Aperçu : Bannissement</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative px-4 text-left">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-danger flex items-center justify-center shrink-0 ">
                                    <Trash2 className="w-4 h-4 text-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-danger text-xs">SigilOS</span>
                                        <span className="text-caption text-muted-foreground uppercase font-black tracking-wider">SECURITY</span>
                                    </div>
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-danger p-3 max-w-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm">🚫</span>
                                            <h4 className="font-semibold text-foreground text-caption">Bannissement Détecté</h4>
                                        </div>
                                        <p className="text-foreground text-caption leading-relaxed mb-3">
                                            Un utilisateur a été banni du serveur. Vérifiez s'il s'agit d'un membre de la guilde.
                                        </p>
                                        <div className="flex items-center gap-2 p-2 bg-danger/5 border border-danger/10 rounded">
                                            <div className="w-6 h-6 rounded-full bg-muted" />
                                            <span className="text-caption font-medium text-foreground">Xélor-Fou#0001</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
