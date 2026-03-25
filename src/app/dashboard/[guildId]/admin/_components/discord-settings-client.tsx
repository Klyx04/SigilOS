"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Hash, Users, Bell, Sparkles, Send, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { getMissionConfig, updateMissionNotifySettings } from "@/server/actions/admin-actions";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { RoleSelector } from "@/components/admin/role-selector";
import { cn } from "@/lib/utils";

interface DiscordSettingsClientProps {
    guildId: string;
}

export function DiscordSettingsClient({ guildId }: DiscordSettingsClientProps) {
    const [managementChannelId, setManagementChannelId] = useState<string>("");
    const [managementRoleId, setManagementRoleId] = useState<string | null>(null);
    const [newsEnabled, setNewsEnabled] = useState<boolean>(false);
    
    // We fetch existing data to keep other fields intact
    const [fullConfig, setFullConfig] = useState<any>(null);
    const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        async function loadData() {
            const [configRes, rolesRes] = await Promise.all([
                getMissionConfig(guildId),
                getDiscordRolesAction(guildId)
            ]);

            if (configRes.success && configRes.data) {
                setFullConfig(configRes.data);
                setManagementChannelId(configRes.data.missionManagementNotifyChannelId || "");
                setManagementRoleId(configRes.data.missionManagementNotifyRoleId || null);
                setNewsEnabled(configRes.data.newsBroadcastEnabled || false);
            }

            if (rolesRes.success && rolesRes.data) {
                setRoles(rolesRes.data);
            }

            setIsLoading(false);
        }
        loadData();
    }, [guildId]);

    const handleSave = () => {
        if (!fullConfig) return;

        startTransition(async () => {
            const result = await updateMissionNotifySettings(guildId, {
                // Keep existing mission settings
                channelId: fullConfig.missionChannelId,
                roleId: fullConfig.missionNotifyRoleId,
                validationChannelId: fullConfig.missionValidationChannelId,
                validationRoleId: fullConfig.missionValidationNotifyRoleId,
                kamaNotifyChannelId: fullConfig.kamaNotifyChannelId,
                kamaNotifyRoleId: fullConfig.kamaNotifyRoleId,
                achievementNotifyChannelId: fullConfig.achievementNotifyChannelId,
                achievementNotifyRoleId: fullConfig.achievementNotifyRoleId,
                // Update management reset settings
                missionManagementNotifyChannelId: managementChannelId.trim() || null,
                missionManagementNotifyRoleId: managementRoleId,
                // New setting
                newsBroadcastEnabled: newsEnabled,
            });

            if (result.success) {
                toast.success("Paramètres Discord mis à jour !");
                // Update local fullConfig
                setFullConfig({
                    ...fullConfig,
                    missionManagementNotifyChannelId: managementChannelId.trim() || null,
                    missionManagementNotifyRoleId: managementRoleId,
                    newsBroadcastEnabled: newsEnabled,
                });
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500/50" />
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto pb-8">
            {/* ── SECTION: NEWS BROADCAST (New) ── */}
            <div className="animate-in fade-in slide-in-from-top-4 duration-500">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600 mb-4 pl-1 flex items-center gap-2">
                    <Megaphone className="w-3.5 h-3.5" />
                    Flux d'actualités Dofus
                </h3>
                
                <Card className="bg-zinc-900/60 border-white/5 overflow-hidden group relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    
                    <CardContent className="p-6">
                        <div className="flex items-center justify-between gap-6">
                            <div className="space-y-1">
                                <h4 className="text-sm font-black text-white flex items-center gap-2">
                                    <Bell className="w-4 h-4 text-emerald-400" />
                                    Partage manuel vers Discord
                                </h4>
                                <p className="text-[11px] text-zinc-500 leading-relaxed max-w-md">
                                    Affiche un bouton sur chaque actualité (News, Devblog, Patch Notes) permettant aux administrateurs de poster directement l'info dans le salon système de la guilde.
                                </p>
                            </div>
                            <div className="flex flex-col items-end gap-2 shrink-0">
                                <Switch 
                                    checked={newsEnabled}
                                    onCheckedChange={setNewsEnabled}
                                    className="data-[state=checked]:bg-emerald-500"
                                />
                                <span className={cn(
                                    "text-[9px] font-black uppercase tracking-widest",
                                    newsEnabled ? "text-emerald-400" : "text-zinc-600"
                                )}>
                                    {newsEnabled ? "Activé" : "Désactivé"}
                                </span>
                            </div>
                        </div>
                        
                        {newsEnabled && (
                            <div className="mt-4 p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/10 flex items-start gap-3">
                                <div className="p-1.5 rounded-lg bg-emerald-500/20 shrink-0">
                                    <Sparkles className="w-3 h-3 text-emerald-400" />
                                </div>
                                <p className="text-[10px] text-zinc-400 italic">
                                    Une cloche apparaîtra désormais en haut à droite de chaque carte de news sur le dashboard pour les administrateurs.
                                </p>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── SECTION: ALERTE RESET DOFU ── */}
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600 mb-4 pl-1 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    Automatisations Hebdomadaires
                </h3>
                
                <Card className="bg-zinc-900/60 border-white/5 overflow-hidden group relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    
                    <CardHeader className="p-6 pb-2 relative z-10">
                        <div className="flex items-center justify-between">
                            <div className="space-y-1">
                                <CardTitle className="text-lg font-black text-white flex items-center gap-2">
                                    <Bell className="w-5 h-5 text-indigo-400" />
                                    Alerte Reset (Mardi 08h00)
                                </CardTitle>
                                <CardDescription className="text-xs text-zinc-400 max-w-xl">
                                    Envoie automatiquement une notification Discord chaque mardi matin après la maintenance Dofus pour rappeler aux administrateurs de gérer les missions.
                                </CardDescription>
                            </div>
                            <div className="px-3 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-[10px] font-black text-indigo-400 uppercase tracking-widest">
                                Actif le Mardi
                            </div>
                        </div>
                    </CardHeader>

                    <CardContent className="p-6 relative z-10 pt-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                                    <Hash className="w-3 h-3" /> Salon Discord de Notification
                                </label>
                                <Input
                                    value={managementChannelId}
                                    onChange={(e) => setManagementChannelId(e.target.value)}
                                    placeholder="ID du salon (ex: 123456789012345678)..."
                                    className="font-mono bg-black/40 border-white/10 text-white h-12 focus:ring-indigo-500/20 focus:border-indigo-500/50 rounded-xl transition-all"
                                />
                                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                                    Le bot enverra un embed interactif dans ce salon.
                                </p>
                            </div>

                            <div className="space-y-3">
                                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                                    <Users className="w-3 h-3" /> Rôle(s) Admin à Mentionner
                                </label>
                                <RoleSelector
                                    value={managementRoleId}
                                    onChange={setManagementRoleId}
                                    roles={roles}
                                    className="h-12 border-indigo-500/20"
                                />
                                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                                    Ce rôle sera mentionné (@ping) pour notifier les responsables.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ACTION FOOTER */}
            <div className="sticky bottom-0 z-30 flex items-center justify-between p-4 rounded-2xl bg-zinc-900/80 backdrop-blur-md border border-white/10 shadow-2xl">
                <div className="flex items-start gap-4 max-w-md">
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 text-indigo-400">
                        <Sparkles className="w-4 h-4" />
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                        Ces réglages automatisent la communication plateforme/discord. Assurez-vous que le bot a les droits d&apos;écriture dans le salon sélectionné.
                    </p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isPending}
                    className={cn(
                        "bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 h-12 shadow-lg shadow-indigo-900/20 rounded-xl transition-all",
                        "hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50"
                    )}
                >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    SAUVEGARDER LES MODIFICATIONS
                </Button>
            </div>
        </div>
    );
}
