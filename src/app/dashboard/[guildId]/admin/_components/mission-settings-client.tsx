"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Hash, Target, Users, Bell } from "lucide-react";
import { toast } from "sonner";
import { getMissionConfig, updateMissionNotifySettings } from "@/server/actions/admin-actions";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface MissionSettingsClientProps {
    guildId: string;
}

export function MissionSettingsClient({ guildId }: MissionSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [roleId, setRoleId] = useState<string>("NONE");
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
                setChannelId(configRes.data.missionChannelId || "");
                setRoleId(configRes.data.missionNotifyRoleId || "NONE");
            }

            if (rolesRes.success && rolesRes.data) {
                setRoles(rolesRes.data);
            }

            setIsLoading(false);
        }
        loadData();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateMissionNotifySettings(guildId, {
                channelId: channelId.trim() || null,
                roleId: roleId === "NONE" ? null : roleId
            });
            if (result.success) {
                toast.success("Paramètres des missions mis à jour !");
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[200px]">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500/50" />
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 bg-zinc-900/60 border-white/5">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <span className="bg-amber-500/20 text-amber-400 p-2 rounded-lg">
                            <Target className="w-5 h-5" />
                        </span>
                        Notifications de Publication
                    </CardTitle>
                    <CardDescription>
                        Configurez comment et où notifier vos membres lors de la publication des missions hebdomadaires sur Discord.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-4">
                        <div className="grid gap-2">
                            <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                                <Hash className="w-4 h-4" /> Salon Discord (ID)
                            </label>
                            <Input
                                value={channelId}
                                onChange={(e) => setChannelId(e.target.value)}
                                placeholder="ID du salon (ex: 123456789...)"
                                className="font-mono bg-black/20 border-white/10 text-white"
                            />
                            <p className="text-[10px] text-zinc-500">
                                Activez le mode développeur sur Discord pour copier l'identifiant du salon.
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <label className="text-sm font-medium text-zinc-300 flex items-center gap-2">
                                <Users className="w-4 h-4" /> Rôle par défaut à mentionner (Optionnel)
                            </label>
                            <Select value={roleId} onValueChange={setRoleId}>
                                <SelectTrigger className="bg-black/20 border-white/10 text-zinc-300">
                                    <SelectValue placeholder="Choisir un rôle" />
                                </SelectTrigger>
                                <SelectContent className="bg-zinc-900 border-white/10 text-zinc-300 shadow-2xl">
                                    <SelectItem value="NONE" className="focus:bg-zinc-800">Aucun (Pas de mention auto)</SelectItem>
                                    {roles.map(role => (
                                        <SelectItem key={role.id} value={role.id} className="focus:bg-zinc-800">
                                            @{role.name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p className="text-[10px] text-zinc-500">
                                Ce rôle sera proposé comme option rapide lors de la publication manuelle.
                            </p>
                        </div>

                        <div className="pt-4 flex justify-end">
                            <Button
                                onClick={handleSave}
                                disabled={isPending}
                                className="bg-amber-600 hover:bg-amber-500 text-white font-bold px-8 shadow-lg shadow-amber-900/20"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                SAUVEGARDER
                            </Button>
                        </div>
                    </div>
                </CardContent>
            </Card>

            <div className="space-y-6">
                <Card className="bg-indigo-500/5 border-indigo-500/10 h-fit">
                    <CardContent className="p-4 flex gap-3">
                        <div className="p-2 bg-indigo-500/20 rounded-lg shrink-0 h-fit">
                            <Bell className="w-4 h-4 text-indigo-400" />
                        </div>
                        <div className="space-y-1">
                            <h4 className="text-sm font-medium text-indigo-200">Fonctionnement</h4>
                            <p className="text-xs text-indigo-300/70 leading-relaxed">
                                Une fois configuré, un bouton <strong>"Notifier Discord"</strong> apparaîtra sur la page de gestion des missions.
                                <br /><br />
                                Vous pourrez déclencher manuellement une annonce élégante (Embed) avec un recap interactif.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
