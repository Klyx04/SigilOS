"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, AlertTriangle, Hash, Megaphone, ShieldAlert, Sparkles, Users, Bell, Trash2, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { getSystemAnnouncementSettings } from "@/server/actions/system-settings-actions";
import { saveSystemAnnouncementSettings } from "@/server/actions/announcement-actions";
import { getMissionConfig, updateMissionNotifySettings } from "@/server/actions/admin-actions";
import { ChannelPreview } from "@/components/shared/ChannelPreview";

import { cn } from "@/lib/utils";
import { Label } from "@/components/ui/label";
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { X } from "lucide-react";

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

    useEffect(() => {
        async function loadConfig() {
            const [sysRes, missionRes] = await Promise.all([
                getSystemAnnouncementSettings(guildId),
                getMissionConfig(guildId)

            ]);

            if (sysRes.success && sysRes.data) {
                setChannelId(sysRes.data.systemNotifyChannelId || "");
            }

            if (missionRes.success && missionRes.data) {
                setFullMissionConfig(missionRes.data);
                setNewsEnabled(missionRes.data.newsBroadcastEnabled || false);
                setLifecycleChannelId(missionRes.data.lifecycleNotifyChannelId || "");
            }

            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            // 1. Save System Channel
            const sysResult = await saveSystemAnnouncementSettings(guildId, channelId.trim() || null);
            
            // 2. Save Discord/Lifecycle Settings
            const discordResult = await updateMissionNotifySettings(guildId, {
                // Keep mission settings (passed back from config)
                channelId: fullMissionConfig?.missionChannelId,
                roleId: fullMissionConfig?.missionNotifyRoleId,
                validationChannelId: fullMissionConfig?.missionValidationChannelId,
                validationRoleId: fullMissionConfig?.missionValidationNotifyRoleId,
                kamaNotifyChannelId: fullMissionConfig?.kamaNotifyChannelId,
                kamaNotifyRoleId: fullMissionConfig?.kamaNotifyRoleId,
                missionManagementNotifyChannelId: fullMissionConfig?.missionManagementNotifyChannelId,
                missionManagementNotifyRoleId: fullMissionConfig?.missionManagementNotifyRoleId,
                // New/Merged settings
                newsBroadcastEnabled: newsEnabled,
                lifecycleNotifyChannelId: lifecycleChannelId.trim() || null,
            });

            if (sysResult.success && discordResult.success) {
                toast.success("Tous les paramètres système ont été mis à jour !");
            } else {
                toast.error("Une erreur est survenue lors de la sauvegarde partielle");
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
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300 text-left">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 space-y-6">
                    {/* MASTER CHANNEL CONFIG */}
                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-foreground font-black uppercase tracking-tighter">
                                    <span className="bg-info/20 text-info p-2 rounded-lg">
                                        <Megaphone className="w-5 h-5" />
                                    </span>
                                    Salon Principal des Annonces
                                </CardTitle>
                                {channelId ? (
                                    <Badge className="bg-info/10 text-info border-info/20">Configuré</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-muted-foreground border-border uppercase text-caption font-black tracking-widest">Défaut</Badge>
                                )}
                            </div>
                            <CardDescription className="text-xs font-medium text-muted-foreground">
                                Ce salon centralisera par défaut tous les rapports plateforme et maintenances.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-caption uppercase font-black text-muted-foreground ml-1">ID du Salon Principal</Label>
                                    <div className="relative group/input">
                                        <Input
                                            value={channelId}
                                            onChange={(e) => setChannelId(e.target.value)}
                                            placeholder="Ex: 123456789012345678"
                                            className="font-mono bg-black/20 border-border h-11 pl-10 focus:border-info/50 transition-colors"
                                        />
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover/input:text-info transition-colors" />
                                    </div>
                                    <ChannelPreview guildId={guildId} channelId={channelId} color="indigo" />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[
                                        { title: "Rapports Quotidien", desc: "Résumé à 08h30 (Missions, Kamas)", icon: Bell },
                                        { title: "Mises à Jour SigilOS", desc: "News techniques & maintenances", icon: AlertTriangle }
                                    ].map((item, idx) => (
                                        <div key={idx} className="p-3 rounded-xl bg-surface border border-border flex items-start gap-3">
                                            <div className="p-1.5 rounded-lg bg-elevated/50 text-muted-foreground">
                                                <item.icon className="w-3 h-3" />
                                            </div>
                                            <div>
                                                <p className="text-caption font-bold text-foreground uppercase tracking-wider">{item.title}</p>
                                                <p className="text-caption text-muted-foreground leading-tight">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* FLUX NEWS DOFUS */}
                    <Card className="bg-surface/60 border-border overflow-hidden group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-foreground font-black uppercase tracking-tighter text-sm">
                                <span className="bg-success/20 text-success p-1.5 rounded-lg">
                                    <Megaphone className="w-4 h-4" />
                                </span>
                                Partage News Dofus
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-surface border border-border">
                                <div className="space-y-1">
                                    <p className="text-caption text-muted-foreground leading-relaxed max-w-sm font-medium">
                                        Active le bouton de partage manuel des news Ankama sur le dashboard pour les administrateurs.
                                    </p>
                                </div>
                                <Switch 
                                    checked={newsEnabled}
                                    onCheckedChange={setNewsEnabled}
                                    className="data-[state=checked]:bg-success "
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* NOTIFICATIONS LIFECYCLE — Départs, Bans, Archivages, Suppressions */}
                    <Card className="bg-surface/60 border-border overflow-hidden group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-danger/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-foreground font-black uppercase tracking-tighter text-sm">
                                <span className="bg-danger/20 text-danger p-1.5 rounded-lg">
                                    <Users className="w-4 h-4" />
                                </span>
                                🔔 Cycle de Vie des Membres
                            </CardTitle>
                            <CardDescription className="text-caption text-muted-foreground font-medium leading-relaxed">
                                Reçois une notification Discord riche (embed) quand un membre :
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Liste des événements */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {[
                                    { emoji: "💤", label: "Archive son profil", color: "text-info" },
                                    { emoji: "📤", label: "Quitte le Discord", color: "text-warning" },
                                    { emoji: "🚫", label: "Est banni", color: "text-danger" },
                                    { emoji: "🗑️", label: "Est supprimé (admin)", color: "text-danger" },
                                    { emoji: "🔄", label: "Est réactivé", color: "text-success" },
                                ].map((evt, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 text-caption text-muted-foreground font-medium">
                                        <span>{evt.emoji}</span>
                                        <span className={evt.color}>{evt.label}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-caption uppercase font-black text-muted-foreground ml-1">
                                    Salon des notifications <span className="text-danger">(lifecycle)</span>
                                </Label>
                                <div className="relative group/input">
                                    <Input
                                        value={lifecycleChannelId}
                                        onChange={(e) => setLifecycleChannelId(e.target.value)}
                                        placeholder="Ex: 123456789012345678"
                                        className="font-mono bg-black/20 border-border h-11 pl-10 focus:border-danger/50 transition-colors"
                                    />
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-hover/input:text-danger transition-colors" />
                                    </div>
                                    <ChannelPreview guildId={guildId} channelId={lifecycleChannelId} color="rose" />
                                    <div className="p-3 rounded-xl bg-danger/5 border border-danger/10 flex items-start gap-3">
                                    <ShieldAlert className="w-3.5 h-3.5 text-danger mt-0.5 shrink-0" />
                                    <p className="text-caption text-muted-foreground leading-relaxed">
                                        <strong className="text-danger">Laisse vide</strong> pour désactiver. L'embed contiendra : pseudo Discord, pseudo Dofus, qui a fait l'action, le statut, l'heure, la guilde et la durée de rétention.
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
                        <CardHeader className="bg-surface pb-3 px-4 py-3">
                            <CardTitle className="text-caption font-black uppercase tracking-widest text-muted-foreground">Aperçu : Rapport Plateforme</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative px-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-info flex items-center justify-center shrink-0">
                                    <Megaphone className="w-4 h-4 text-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-info text-xs">SigilOS</span>
                                        <span className="bg-info/20 text-info text-caption px-1 rounded">BOT</span>
                                    </div>
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-info p-3 max-w-sm shadow-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm">📋</span>
                                            <h4 className="font-semibold text-foreground text-caption">Rapport d'Activité</h4>
                                        </div>
                                        <div className="space-y-1.5 mt-2">
                                            <div className="flex justify-between text-caption">
                                                <span className="text-muted-foreground">Missions Validées</span>
                                                <span className="text-foreground">12</span>
                                            </div>
                                            <div className="flex justify-between text-caption">
                                                <span className="text-muted-foreground">Kamas Collectés</span>
                                                <span className="text-success">450,000</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader className="bg-surface pb-3 px-4 py-3">
                            <CardTitle className="text-caption font-black uppercase tracking-widest text-muted-foreground">Aperçu : Lifecycle</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative px-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-danger flex items-center justify-center shrink-0">
                                    <Trash2 className="w-4 h-4 text-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-danger text-xs">SigilOS</span>
                                        <span className="text-caption text-muted-foreground uppercase font-black tracking-wider">LIFECYCLE</span>
                                    </div>
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-danger p-3 max-w-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm">👋</span>
                                            <h4 className="font-semibold text-foreground text-caption">Départ Membre</h4>
                                        </div>
                                        <p className="text-foreground text-caption leading-relaxed mb-2">
                                            <span className="text-info">@Wylan</span> a quitté le serveur.
                                        </p>
                                        <div className="w-full py-1 bg-muted text-foreground text-caption font-bold rounded flex items-center justify-center gap-1">
                                            VOIR PROFIL <ExternalLink className="w-2.5 h-2.5" />
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
