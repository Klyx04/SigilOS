"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, Hash, Bell } from "lucide-react";
import { toast } from "sonner";
import { getDungeonFinderConfig, updateDjSettings } from "@/server/actions/dungeon-finder-actions";
import { getDiscordRolesAction, updateAllowedPingRolesAction } from "@/server/actions/user-actions";
import { PingRolesSelector } from "@/components/admin/ping-roles-selector";
import { ChannelPreview } from "@/components/shared/ChannelPreview";

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
                toast.success("Notifications Donjons désactivées");
            } else {
                toast.error(result.error || "Erreur lors de la désactivation");
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
        <div className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <Card className="lg:col-span-2 bg-zinc-900/60 border-white/5 overflow-hidden">
                    <CardHeader>
                        <div className="flex items-center justify-between">
                            <CardTitle className="flex items-center gap-2">
                                <span className="bg-indigo-500/20 text-indigo-400 p-2 rounded-lg">
                                    <Bell className="w-5 h-5" />
                                </span>
                                Notifications Donjons & Quêtes
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
                            Configurez le salon Discord qui recevra les annonces de recherche de joueurs pour les Donjons et Quêtes.
                        </CardDescription>
                    </CardHeader>

                    <CardContent className="space-y-6">
                        {/* Step 1 */}
                        <div className="relative pl-6 border-l-2 border-white/5 pb-6 last:pb-0">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            </div>
                            <h3 className="text-sm font-medium text-white mb-2">1. Récupérer l'ID du salon</h3>
                            <p className="text-xs text-zinc-500 mb-3">
                                Activez le mode développeur Discord, puis faites <span className="text-zinc-300">Clic Droit</span> sur le salon voulu {'>'} <span className="text-zinc-300">Copier l'identifiant</span>.
                            </p>
                        </div>

                        {/* Step 2 */}
                        <div className="relative pl-6 border-l-2 border-indigo-500/50">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-indigo-500 border-2 border-zinc-950 " />
                            <h3 className="text-sm font-medium text-white mb-4">2. Coller l'identifiant</h3>

                            <div className="space-y-4">
                                <div className="flex gap-2">
                                    <Input
                                        value={channelId}
                                        onChange={(e) => setChannelId(e.target.value)}
                                        placeholder="Ex: 123456789012345678"
                                        className="font-mono bg-black/20 border-white/10"
                                    />
                                    <Button onClick={handleSave} disabled={isPending} className="min-w-[120px] bg-indigo-600 hover:bg-indigo-500">
                                        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                        Sauvegarder
                                    </Button>
                                </div>
                                <ChannelPreview guildId={guildId} channelId={channelId} color="indigo" />
                                {isConfigured && (
                                    <div className="flex justify-end">
                                        <Button variant="ghost" size="sm" onClick={handleClear} disabled={isPending} className="text-red-400 hover:text-red-300 hover:bg-red-900/20 h-auto py-1 px-3 text-xs">
                                            Désactiver l'intégration
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* Step 3 - Pings */}
                        <div className="relative pl-6 border-l-2 border-transparent">
                            <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-zinc-800 border-2 border-zinc-950 flex items-center justify-center">
                                <div className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
                            </div>
                            <h3 className="text-sm font-medium text-white mb-2">3. Rôles de Ping Autorisés (Whitelist)</h3>
                            <p className="text-xs text-zinc-500 mb-4">
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
                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden">
                        <CardHeader className="bg-white/5 pb-4">
                            <CardTitle className="text-sm text-zinc-300">Aperçu du message</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative">
                            {/* Discord Message Mockup */}
                            <div className="flex items-start gap-4 text-left">
                                <div className="w-10 h-10 rounded-full bg-indigo-500 flex items-center justify-center shrink-0">
                                    <Bell className="w-5 h-5 text-white" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-indigo-400">SigilOS</span>
                                        <span className="bg-indigo-500/20 text-indigo-300 text-caption px-1 rounded">BOT</span>
                                        <span className="text-xs text-zinc-500">Maintenant</span>
                                    </div>

                                    {/* Embed */}
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-indigo-400 p-4 max-w-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-lg">⚔️</span>
                                            <h4 className="font-semibold text-white text-sm">Recherche de Groupe</h4>
                                        </div>

                                        <p className="text-zinc-300 text-xs mb-3 leading-relaxed">
                                            <span className="text-indigo-400 font-medium hover:underline cursor-pointer">Wylan</span> a ouvert un recrutement pour le donjon **Tal Kasha**.
                                        </p>

                                        <div className="grid grid-cols-2 gap-y-3 gap-x-4">
                                            <div>
                                                <div className="text-[#b5bac1] text-caption font-bold uppercase tracking-wider mb-0.5">Activité</div>
                                                <div className="text-zinc-200 text-xs">SUCCÈS / SCORE</div>
                                            </div>
                                            <div>
                                                <div className="text-[#b5bac1] text-caption font-bold uppercase tracking-wider mb-0.5">Places</div>
                                                <div className="text-zinc-200 text-xs">👥 2 / 4</div>
                                            </div>
                                            <div className="col-span-2">
                                                <div className="text-[#b5bac1] text-caption font-bold uppercase tracking-wider mb-0.5">Description</div>
                                                <div className="text-zinc-200 text-xs">Besoin d'un Panda et Enu pour le succès.</div>
                                            </div>
                                        </div>

                                        <div className="mt-3 pt-3 border-t border-[#3f4147] flex items-center gap-2">
                                            <div className="w-4 h-4 rounded-full bg-zinc-700" />
                                            <span className="text-[#949ba4] text-caption">SigilOS • Dungeon Finder</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-blue-500/5 border-blue-500/10">
                        <CardContent className="p-4 flex gap-3 text-left">
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
        </div>
    );
}
