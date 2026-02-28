"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Hash, Target, Users, Bell, Search, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { getMissionConfig, updateMissionNotifySettings } from "@/server/actions/admin-actions";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { RoleSelector } from "@/components/admin/role-selector";
import { cn } from "@/lib/utils";

interface MissionSettingsClientProps {
    guildId: string;
}

export function MissionSettingsClient({ guildId }: MissionSettingsClientProps) {
    const [channelId, setChannelId] = useState<string>("");
    const [validationChannelId, setValidationChannelId] = useState<string>("");
    const [roleId, setRoleId] = useState<string | null>(null);
    const [validationRoleId, setValidationRoleId] = useState<string | null>(null);
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
                setValidationChannelId(configRes.data.missionValidationChannelId || "");
                setRoleId(configRes.data.missionNotifyRoleId || null);
                setValidationRoleId(configRes.data.missionValidationNotifyRoleId || null);
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
                roleId: roleId,
                validationChannelId: validationChannelId.trim() || null,
                validationRoleId: validationRoleId
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
        <div className="space-y-6 max-w-5xl mx-auto">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* 1. PUBLICATION SETTINGS */}
                <Card className="bg-zinc-900/60 border-white/5 overflow-hidden group relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-amber-400">
                            <Target className="w-5 h-5 font-black" />
                            Publication
                        </CardTitle>
                        <CardDescription className="text-[10px] font-medium leading-relaxed">
                            Configuration de l&apos;annonce hebdomadaire des nouvelles missions.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 relative z-10">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                                <Hash className="w-3 h-3" /> Salon de Publication
                            </label>
                            <Input
                                value={channelId}
                                onChange={(e) => setChannelId(e.target.value)}
                                placeholder="ID du salon..."
                                className="font-mono bg-black/40 border-white/10 text-white h-11 focus:ring-amber-500/20 focus:border-amber-500/50 rounded-xl"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                                <Users className="w-3 h-3" /> Rôle à Mentionner
                            </label>
                            <RoleSelector
                                value={roleId}
                                onChange={setRoleId}
                                roles={roles}
                                className="h-11"
                            />
                        </div>

                        <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/10">
                            <p className="text-[10px] text-amber-500/60 leading-relaxed italic">
                                "Ce message est envoyé chaque lundi matin lors de la génération automatique ou manuelle."
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. VALIDATION SETTINGS */}
                <Card className="bg-zinc-900/60 border-white/5 overflow-hidden group relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-purple-400">
                            <ShieldCheck className="w-5 h-5" />
                            Alertes Validation
                        </CardTitle>
                        <CardDescription className="text-[10px] font-medium leading-relaxed">
                            Configuration des notifications d&apos;admin lors du dépôt d&apos;une preuve.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 relative z-10">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                                <Hash className="w-3 h-3" /> Salon d&apos;Alertes
                            </label>
                            <Input
                                value={validationChannelId}
                                onChange={(e) => setValidationChannelId(e.target.value)}
                                placeholder="ID du salon (souvent le même)..."
                                className="font-mono bg-black/40 border-white/10 text-white h-11 focus:ring-purple-500/20 focus:border-purple-500/50 rounded-xl"
                            />
                            <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                                Vide = Salon de publication par défaut.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                                <Users className="w-3 h-3" /> Staff à Alerter
                            </label>
                            <RoleSelector
                                value={validationRoleId}
                                onChange={setValidationRoleId}
                                roles={roles}
                                className="h-11 border-purple-500/20"
                            />
                        </div>

                        <div className="p-3 rounded-xl bg-purple-500/5 border border-purple-500/10">
                            <div className="flex gap-2">
                                <Bell className="w-3 h-3 text-purple-400 shrink-0 mt-0.5" />
                                <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                                    "Un nouvel embed compact avec un lien direct vers la validation sera envoyé à chaque nouvelle preuve postée."
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ACTION FOOTER */}
            <div className="flex items-center justify-between p-4 rounded-2xl bg-zinc-900/40 border border-white/5">
                <div className="flex items-start gap-4 max-w-md">
                    <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20">
                        <Search className="w-4 h-4 text-indigo-400" />
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                        Ces réglages s&apos;appliquent à l&apos;ensemble de la guilde. Assurez-vous que le bot SigilOS a les permissions d&apos;écrire dans les salons choisis.
                    </p>
                </div>
                <Button
                    onClick={handleSave}
                    disabled={isPending}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white font-black px-8 h-12 shadow-lg shadow-indigo-900/20 rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                    SAUVEGARDER LES CHANGEMENTS
                </Button>
            </div>
        </div>
    );
}
