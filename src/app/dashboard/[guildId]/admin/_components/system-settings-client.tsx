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
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500 text-left">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 space-y-6">
                    {/* MASTER CHANNEL CONFIG */}
                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden">
                        <CardHeader>
                            <div className="flex items-center justify-between">
                                <CardTitle className="flex items-center gap-2 text-white font-black uppercase tracking-tighter">
                                    <span className="bg-indigo-500/20 text-indigo-400 p-2 rounded-lg">
                                        <Megaphone className="w-5 h-5" />
                                    </span>
                                    Salon Principal des Annonces
                                </CardTitle>
                                {channelId ? (
                                    <Badge className="bg-indigo-500/10 text-indigo-400 border-indigo-500/20">Configuré</Badge>
                                ) : (
                                    <Badge variant="outline" className="text-zinc-600 border-white/5 uppercase text-[10px] font-black tracking-widest">Défaut</Badge>
                                )}
                            </div>
                            <CardDescription className="text-xs font-medium text-zinc-500">
                                Ce salon centralisera par défaut tous les rapports plateforme et maintenances.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <Label className="text-[10px] uppercase font-black text-zinc-500 ml-1">ID du Salon Principal</Label>
                                    <div className="relative group/input">
                                        <Input
                                            value={channelId}
                                            onChange={(e) => setChannelId(e.target.value)}
                                            placeholder="Ex: 123456789012345678"
                                            className="font-mono bg-black/20 border-white/10 h-11 pl-10 focus:border-indigo-500/50 transition-colors"
                                        />
                                        <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover/input:text-indigo-400 transition-colors" />
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {[
                                        { title: "Rapports Quotidien", desc: "Résumé à 08h30 (Missions, Kamas)", icon: Bell },
                                        { title: "Mises à Jour SigilOS", desc: "News techniques & maintenances", icon: AlertTriangle }
                                    ].map((item, idx) => (
                                        <div key={idx} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 flex items-start gap-3">
                                            <div className="p-1.5 rounded-lg bg-zinc-800/50 text-zinc-500">
                                                <item.icon className="w-3 h-3" />
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-bold text-zinc-300 uppercase tracking-wider">{item.title}</p>
                                                <p className="text-[9px] text-zinc-500 leading-tight">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* FLUX NEWS DOFUS */}
                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white font-black uppercase tracking-tighter text-sm">
                                <span className="bg-emerald-500/20 text-emerald-400 p-1.5 rounded-lg">
                                    <Megaphone className="w-4 h-4" />
                                </span>
                                Partage News Dofus
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="flex items-center justify-between p-4 rounded-xl bg-white/[0.02] border border-white/5">
                                <div className="space-y-1">
                                    <p className="text-[10px] text-zinc-500 leading-relaxed max-w-sm font-medium">
                                        Active le bouton de partage manuel des news Ankama sur le dashboard pour les administrateurs.
                                    </p>
                                </div>
                                <Switch 
                                    checked={newsEnabled}
                                    onCheckedChange={setNewsEnabled}
                                    className="data-[state=checked]:bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.2)]"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* NOTIFICATIONS LIFECYCLE — Départs, Bans, Archivages, Suppressions */}
                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-white font-black uppercase tracking-tighter text-sm">
                                <span className="bg-rose-500/20 text-rose-400 p-1.5 rounded-lg">
                                    <Users className="w-4 h-4" />
                                </span>
                                🔔 Cycle de Vie des Membres
                            </CardTitle>
                            <CardDescription className="text-[11px] text-zinc-500 font-medium leading-relaxed">
                                Reçois une notification Discord riche (embed) quand un membre :
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {/* Liste des événements */}
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {[
                                    { emoji: "💤", label: "Archive son profil", color: "text-indigo-400" },
                                    { emoji: "📤", label: "Quitte le Discord", color: "text-amber-400" },
                                    { emoji: "🚫", label: "Est banni", color: "text-red-400" },
                                    { emoji: "🗑️", label: "Est supprimé (admin)", color: "text-rose-400" },
                                    { emoji: "🔄", label: "Est réactivé", color: "text-emerald-400" },
                                ].map((evt, idx) => (
                                    <div key={idx} className="flex items-center gap-1.5 text-[10px] text-zinc-400 font-medium">
                                        <span>{evt.emoji}</span>
                                        <span className={evt.color}>{evt.label}</span>
                                    </div>
                                ))}
                            </div>

                            <div className="space-y-2">
                                <Label className="text-[10px] uppercase font-black text-zinc-500 ml-1">
                                    Salon des notifications <span className="text-rose-400">(lifecycle)</span>
                                </Label>
                                <div className="relative group/input">
                                    <Input
                                        value={lifecycleChannelId}
                                        onChange={(e) => setLifecycleChannelId(e.target.value)}
                                        placeholder="Ex: 123456789012345678"
                                        className="font-mono bg-black/20 border-white/10 h-11 pl-10 focus:border-rose-500/50 transition-colors"
                                    />
                                    <Hash className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-600 group-hover/input:text-rose-400 transition-colors" />
                                </div>
                                <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/10 flex items-start gap-3">
                                    <ShieldAlert className="w-3.5 h-3.5 text-rose-400 mt-0.5 shrink-0" />
                                    <p className="text-[10px] text-zinc-400 leading-relaxed">
                                        <strong className="text-rose-300">Laisse vide</strong> pour désactiver. L'embed contiendra : pseudo Discord, pseudo Dofus, qui a fait l'action, le statut, l'heure, la guilde et la durée de rétention.
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
                        <CardHeader className="bg-white/5 pb-3 px-4 py-3">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Aperçu : Rapport Plateforme</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative px-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                                    <Megaphone className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-indigo-400 text-xs">SigilOS</span>
                                        <span className="bg-indigo-500/20 text-indigo-300 text-[9px] px-1 rounded">BOT</span>
                                    </div>
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-indigo-400 p-3 max-w-sm shadow-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm">📋</span>
                                            <h4 className="font-semibold text-white text-[11px]">Rapport d'Activité</h4>
                                        </div>
                                        <div className="space-y-1.5 mt-2">
                                            <div className="flex justify-between text-[9px]">
                                                <span className="text-zinc-500">Missions Validées</span>
                                                <span className="text-zinc-200">12</span>
                                            </div>
                                            <div className="flex justify-between text-[9px]">
                                                <span className="text-zinc-500">Kamas Collectés</span>
                                                <span className="text-emerald-400">450,000</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden">
                        <CardHeader className="bg-white/5 pb-3 px-4 py-3">
                            <CardTitle className="text-[10px] font-black uppercase tracking-widest text-zinc-400">Aperçu : Lifecycle</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative px-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center shrink-0">
                                    <Trash2 className="w-4 h-4 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-rose-400 text-xs">SigilOS</span>
                                        <span className="text-[9px] text-zinc-500 uppercase font-black tracking-wider">LIFECYCLE</span>
                                    </div>
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-rose-500 p-3 max-w-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm">👋</span>
                                            <h4 className="font-semibold text-white text-[11px]">Départ Membre</h4>
                                        </div>
                                        <p className="text-zinc-300 text-[10px] leading-relaxed mb-2">
                                            <span className="text-indigo-400">@Wylan</span> a quitté le serveur.
                                        </p>
                                        <div className="w-full py-1 bg-zinc-700 text-white text-[9px] font-bold rounded flex items-center justify-center gap-1">
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
