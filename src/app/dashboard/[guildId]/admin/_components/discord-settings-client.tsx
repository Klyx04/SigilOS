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
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500/50" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 space-y-6">
                    {/* FLUX D'ACTUALITÉS */}
                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white font-black uppercase tracking-tighter">
                                <span className="bg-emerald-500/20 text-emerald-400 p-2 rounded-lg">
                                    <Megaphone className="w-5 h-5" />
                                </span>
                                Flux d'Actualités Dofus
                            </CardTitle>
                            <CardDescription className="text-xs font-medium text-zinc-500">
                                Automatisation du partage des news officielles Ankama.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                                <div className="space-y-1">
                                    <h4 className="text-sm font-bold text-white">Partage manuel vers Discord</h4>
                                    <p className="text-[10px] text-zinc-500 leading-relaxed max-w-sm">
                                        Affiche un bouton sur chaque news du dashboard permettant de la poster instantanément.
                                    </p>
                                </div>
                                <Switch 
                                    checked={newsEnabled}
                                    onCheckedChange={setNewsEnabled}
                                    className="data-[state=checked]:bg-emerald-500"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* NOTIFICATIONS LIFECYCLE */}
                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white font-black uppercase tracking-tighter">
                                <span className="bg-indigo-500/20 text-indigo-400 p-2 rounded-lg">
                                    <Users className="w-5 h-5" />
                                </span>
                                Notifications Lifecycle
                            </CardTitle>
                            <CardDescription className="text-xs font-medium text-zinc-500">
                                Suivi des départs et bannissements pour la gestion des archives.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-zinc-500 ml-1">ID du Salon de Notification</Label>
                                    <div className="relative group/input">
                                        <Input
                                            placeholder="ID du salon (ex: 123...)"
                                            value={lifecycleChannelId}
                                            onChange={(e) => setLifecycleChannelId(e.target.value)}
                                            className="bg-zinc-950/50 border-white/10 h-11 pl-10 focus:border-indigo-500/50 transition-colors font-mono text-xs"
                                        />
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover/input:text-indigo-500 transition-colors" />
                                    </div>
                                    <ChannelPreview guildId={guildId} channelId={lifecycleChannelId} color="indigo" />
                                </div>
                                <div className="p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10 flex items-start gap-3">
                                    <ShieldAlert className="w-3.5 h-3.5 text-indigo-400 mt-0.5 shrink-0" />
                                    <p className="text-[10px] text-zinc-400 leading-relaxed italic">
                                        Indispensable pour savoir quand archiver un profil ou purger les permissions d'un membre banni.
                                    </p>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex justify-end pt-4">
                        <Button onClick={handleSave} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-500 text-white min-w-[200px] font-bold h-12 shadow-xl shadow-indigo-600/20">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            SAUVEGARDER TOUT
                        </Button>
                    </div>
                </div>

                {/* Preview Panel */}
                <div className="space-y-6">
                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden">
                        <CardHeader className="bg-white/5 pb-4 px-4 py-3">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Aperçu : Départ Membre</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative px-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                                    <Users className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-indigo-400 text-xs">SigilOS</span>
                                        <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">LIFECYCLE</span>
                                    </div>
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-indigo-400 p-3 max-w-sm shadow-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm">👋</span>
                                            <h4 className="font-semibold text-white text-[11px]">Membre Parti</h4>
                                        </div>
                                        <div className="space-y-2">
                                            <p className="text-zinc-300 text-[10px] leading-relaxed">
                                                <span className="text-indigo-400 font-medium">@Wylan</span> a quitté le serveur Discord.
                                            </p>
                                            <div className="bg-black/20 p-2 rounded border border-white/5 space-y-1">
                                                <div className="flex justify-between items-center text-[9px]">
                                                    <span className="text-zinc-500 uppercase font-bold">Pseudo Dofus</span>
                                                    <span className="text-zinc-200">Wylan-PvP</span>
                                                </div>
                                                <div className="flex justify-between items-center text-[9px]">
                                                    <span className="text-zinc-500 uppercase font-bold">Statut</span>
                                                    <span className="text-amber-400 font-bold">Archivage Requis</span>
                                                </div>
                                            </div>
                                            <div className="w-full py-1 bg-zinc-700 text-white text-[9px] font-bold rounded flex items-center justify-center gap-1">
                                                VOIR LE PROFIL <ExternalLink className="w-2.5 h-2.5" />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden">
                        <CardHeader className="bg-white/5 pb-4 px-4 py-3">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Aperçu : Bannissement</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative px-4 text-left">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center shrink-0 shadow-[0_0_10px_rgba(244,63,94,0.3)]">
                                    <Trash2 className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-rose-400 text-xs">SigilOS</span>
                                        <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">SECURITY</span>
                                    </div>
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-rose-500 p-3 max-w-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm">🚫</span>
                                            <h4 className="font-semibold text-white text-[11px]">Bannissement Détecté</h4>
                                        </div>
                                        <p className="text-zinc-300 text-[10px] leading-relaxed mb-3">
                                            Un utilisateur a été banni du serveur. Vérifiez s'il s'agit d'un membre de la guilde.
                                        </p>
                                        <div className="flex items-center gap-2 p-2 bg-rose-500/5 border border-rose-500/10 rounded">
                                            <div className="w-6 h-6 rounded-full bg-zinc-700" />
                                            <span className="text-[10px] font-medium text-white">Xélor-Fou#0001</span>
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
