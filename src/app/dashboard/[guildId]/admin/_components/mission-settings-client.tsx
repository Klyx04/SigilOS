"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Hash, Target, Users, Bell, Search, ShieldCheck, Coins, Trophy, Clock, Eye } from "lucide-react";
import { toast } from "sonner";
import { getMissionConfig, updateMissionNotifySettings } from "@/server/actions/admin-actions";
import { getDiscordRolesAction, updateAllowedPingRolesAction } from "@/server/actions/user-actions";
import { PingRolesSelector } from "@/components/admin/ping-roles-selector";
import { RoleSelector } from "@/components/admin/role-selector";
import { ChannelPreview } from "@/components/shared/ChannelPreview";

interface MissionSettingsClientProps {
    guildId: string;
}

export function MissionSettingsClient({ guildId }: MissionSettingsClientProps) {
    // Publication (missions hebdo)
    const [channelId, setChannelId] = useState<string>("");
    const [roleId, setRoleId] = useState<string | null>(null);

    // Validation Missions
    const [validationChannelId, setValidationChannelId] = useState<string>("");
    const [validationRoleId, setValidationRoleId] = useState<string | null>(null);

    // Contributions Kamas
    const [kamaChannelId, setKamaChannelId] = useState<string>("");
    const [kamaRoleId, setKamaRoleId] = useState<string | null>(null);
    
    // Rappel Reset Staff (Mardi 8h00)
    const [managementChannelId, setManagementChannelId] = useState<string>("");
    const [managementRoleId, setManagementRoleId] = useState<string | null>(null);

    // Mode Vitrine
    const [missionVitrineMode, setMissionVitrineMode] = useState<boolean>(false);

    const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
    const [discordRoles, setDiscordRoles] = useState<{ id: string; name: string; color: string }[]>([]);
    const [missionPingRoleIds, setMissionPingRoleIds] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        async function loadData() {
            const [configRes, rolesRes] = await Promise.all([
                getMissionConfig(guildId),
                getDiscordRolesAction(guildId, { ignoreWhitelist: true })

            ]);

            if (configRes.success && configRes.data) {
                setChannelId(configRes.data.missionChannelId || "");
                setValidationChannelId(configRes.data.missionValidationChannelId || "");
                setKamaChannelId(configRes.data.kamaNotifyChannelId || "");
                setRoleId(configRes.data.missionNotifyRoleId || null);
                setValidationRoleId(configRes.data.missionValidationNotifyRoleId || null);
                // New fields (may not exist in older configs, graceful fallback)
                setKamaRoleId((configRes.data as any).kamaNotifyRoleId || null);
                setManagementChannelId(configRes.data.missionManagementNotifyChannelId || "");
                setManagementRoleId(configRes.data.missionManagementNotifyRoleId || null);
                setMissionVitrineMode(configRes.data.missionVitrineMode || false);
                setMissionPingRoleIds(configRes.data.missionPingRoleIds || []);
            }

            if (rolesRes.success && rolesRes.roles) {
                setRoles(rolesRes.roles);
                setDiscordRoles(rolesRes.roles.filter((r: any) => r.name !== "@everyone") as any);
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
                validationRoleId: validationRoleId,
                kamaNotifyChannelId: kamaChannelId.trim() || null,
                kamaNotifyRoleId: kamaRoleId,
                missionManagementNotifyChannelId: managementChannelId.trim() || null,
                missionManagementNotifyRoleId: managementRoleId,
                missionVitrineMode: missionVitrineMode,
            });
            const pingRolesResult = await updateAllowedPingRolesAction(guildId, missionPingRoleIds, "missions");
            if (result.success && pingRolesResult.success) {
                toast.success("Paramètres mis à jour !");
            } else {
                toast.error((pingRolesResult.success ? result.error : pingRolesResult.error) || "Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[400px]">
                <Loader2 className="w-8 h-8 animate-spin text-warning/50" />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Configuration Panel */}
                <div className="lg:col-span-2 space-y-6">
                    {/* SECTION 1: PUBLICATION */}
                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-foreground">
                                <span className="bg-warning/20 text-warning p-2 rounded-lg">
                                    <Target className="w-5 h-5" />
                                </span>
                                Publication Hebdomadaire
                            </CardTitle>
                            <CardDescription>
                                Annonce automatique des 12 missions de la semaine.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <label className="text-caption font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <Hash className="w-3 h-3" /> Salon de Publication
                                    </label>
                                    <Input
                                        value={channelId}
                                        onChange={(e) => setChannelId(e.target.value)}
                                        placeholder="ID du salon..."
                                        className="font-mono bg-black/20 border-border h-10"
                                    />
                                    <ChannelPreview guildId={guildId} channelId={channelId} color="amber" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-caption font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                                        <Users className="w-3 h-3" /> Rôle à Mentionner
                                    </label>
                                    <RoleSelector value={roleId} onChange={setRoleId} roles={roles} className="h-10" />
                                </div>
                            </div>
                            <div className="pt-4 border-t border-border">
                                <label className="text-caption font-black uppercase tracking-widest text-muted-foreground flex items-center gap-2 mb-2">
                                    <Users className="w-3 h-3" /> Ping Rôles Autorisés (Whitelist)
                                </label>
                                <PingRolesSelector
                                    value={missionPingRoleIds}
                                    onChange={setMissionPingRoleIds}
                                    roles={discordRoles}
                                    description="Si la liste est vide, aucun rôle Discord ne sera disponible pour le ping lors de la publication des missions (seuls les administrateurs verront toujours tous les rôles)."
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* SECTION 2: NOTIFICATIONS UPLOADS */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <Card className="bg-surface/60 border-border">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-sm flex items-center gap-2 text-info uppercase tracking-tight">
                                    <ShieldCheck className="w-4 h-4" /> Validation Missions
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Salon ID</label>
                                    <Input value={validationChannelId} onChange={(e) => setValidationChannelId(e.target.value)} className="font-mono bg-black/20 border-border h-9" />
                                    <ChannelPreview guildId={guildId} channelId={validationChannelId} color="amber" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Staff à alerter</label>
                                    <RoleSelector value={validationRoleId} onChange={setValidationRoleId} roles={roles} className="h-9" />
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="bg-surface/60 border-border">
                            <CardHeader className="pb-4">
                                <CardTitle className="text-sm flex items-center gap-2 text-warning uppercase tracking-tight">
                                    <Coins className="w-4 h-4" /> Contributions Kamas
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Salon ID</label>
                                    <Input value={kamaChannelId} onChange={(e) => setKamaChannelId(e.target.value)} className="font-mono bg-black/20 border-border h-9" />
                                    <ChannelPreview guildId={guildId} channelId={kamaChannelId} color="amber" />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Staff à alerter</label>
                                    <RoleSelector value={kamaRoleId} onChange={setKamaRoleId} roles={roles} className="h-9" />
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                    {/* SECTION 3: RAPPEL RESET */}
                    <Card className="bg-surface/60 border-border">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-info text-sm uppercase tracking-tight">
                                <Bell className="w-4 h-4" /> Rappel Reset Hebdo (Mardi 08:00)
                            </CardTitle>
                            <CardDescription>Rappelle aux officiers de générer les missions après la maintenance Dofus.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Salon de Rappel</label>
                                <Input value={managementChannelId} onChange={(e) => setManagementChannelId(e.target.value)} className="font-mono bg-black/20 border-border h-10" />
                                <ChannelPreview guildId={guildId} channelId={managementChannelId} color="indigo" />
                            </div>
                            <div className="space-y-2">
                                <label className="text-caption font-black uppercase tracking-widest text-muted-foreground">Rôle Staff</label>
                                <RoleSelector value={managementRoleId} onChange={setManagementRoleId} roles={roles} className="h-10" />
                            </div>
                        </CardContent>
                    </Card>

                    {/* SECTION 4: MODE VITRINE */}
                    <Card className="bg-surface/60 border-border">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                            <div className="space-y-1">
                                <CardTitle className="flex items-center gap-2 text-info text-sm uppercase tracking-tight">
                                    <Eye className="w-4 h-4" /> Mode Vitrine (Lecture seule)
                                </CardTitle>
                                <CardDescription className="text-muted-foreground text-xs">
                                    Masque la possibilité d'uploader des captures (bouton PREUVE), le statut "Validé" sur les missions, et cache les ladders aux membres.
                                </CardDescription>
                            </div>
                            <Switch checked={missionVitrineMode} onCheckedChange={setMissionVitrineMode} />
                        </CardHeader>
                    </Card>

                    <div className="flex justify-end pt-4">
                        <Button onClick={handleSave} disabled={isPending} className="bg-warning hover:bg-warning text-warning-foreground min-w-[200px] font-bold h-12 shadow-xl shadow-amber-600/20">
                            {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                            SAUVEGARDER TOUT
                        </Button>
                    </div>
                </div>

                {/* Preview Panel */}
                <div className="space-y-6">
                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader className="bg-surface pb-4 px-4 py-3">
                            <CardTitle className="text-caption font-black uppercase tracking-widest text-muted-foreground">Aperçu : Validation</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative text-left px-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-info flex items-center justify-center shrink-0">
                                    <ShieldCheck className="w-4 h-4 text-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-info text-xs">SigilOS</span>
                                        <span className="text-caption text-muted-foreground uppercase">Maintenant</span>
                                    </div>
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-info p-3 max-w-sm shadow-xl">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm">🛡️</span>
                                            <h4 className="font-semibold text-foreground text-caption">Preuve de Mission</h4>
                                        </div>
                                        <p className="text-foreground text-caption mb-3 leading-relaxed">
                                            <span className="text-info font-medium">@Wylan</span> a soumis une preuve pour **Donjon Kralamoure**.
                                        </p>
                                        <div className="flex gap-2">
                                            <div className="px-3 py-1 bg-success/20 border border-success/30 text-success text-caption font-bold rounded">VALIDER</div>
                                            <div className="px-3 py-1 bg-danger/20 border border-danger/30 text-danger text-caption font-bold rounded">REFUSER</div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader className="bg-surface pb-4 px-4 py-3">
                            <CardTitle className="text-caption font-black uppercase tracking-widest text-muted-foreground">Aperçu : Reset Hebdo</CardTitle>
                        </CardHeader>
                        <CardContent className="pt-6 relative text-left px-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-info flex items-center justify-center shrink-0">
                                    <Bell className="w-4 h-4 text-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-baseline gap-2 mb-1">
                                        <span className="font-medium text-info text-xs">SigilOS</span>
                                        <span className="text-caption text-muted-foreground uppercase font-black">Mardi 08:00</span>
                                    </div>
                                    <div className="bg-[#2b2d31] rounded border-l-4 border-info p-3 max-w-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm">🚀</span>
                                            <h4 className="font-semibold text-foreground text-caption">Reset Hebdomadaire</h4>
                                        </div>
                                        <p className="text-foreground text-caption leading-relaxed mb-3">
                                            Le reset Dofus a eu lieu. Il est temps de générer les missions !
                                        </p>
                                        <div className="w-full py-1.5 bg-muted hover:bg-muted text-foreground text-caption font-bold rounded flex items-center justify-center gap-2">
                                            <span>🛠️</span> GÉRER LES MISSIONS
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
