"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Target, Users, Bell, ShieldCheck, Eye, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getMissionConfig, updateMissionNotifySettings } from "@/server/actions/admin-actions";
import { getDiscordRolesAction, updateAllowedPingRolesAction } from "@/server/actions/user-actions";
import { PingRolesSelector } from "@/components/admin/ping-roles-selector";
import { RoleSelector } from "@/components/admin/role-selector";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";

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

    // Snapshot pour détection des modifications non sauvegardées
    type MissionConfigSnapshot = {
        channelId: string;
        roleId: string | null;
        validationChannelId: string;
        validationRoleId: string | null;
        managementChannelId: string;
        managementRoleId: string | null;
        missionVitrineMode: boolean;
        missionPingRoleIds: string[];
    };

    const [initialConfig, setInitialConfig] = useState<MissionConfigSnapshot | null>(null);

    const currentConfig: MissionConfigSnapshot = useMemo(() => ({
        channelId,
        roleId,
        validationChannelId,
        validationRoleId,
        managementChannelId,
        managementRoleId,
        missionVitrineMode,
        missionPingRoleIds: [...missionPingRoleIds],
    }), [
        channelId, roleId, validationChannelId, validationRoleId,
        managementChannelId, managementRoleId, missionVitrineMode, missionPingRoleIds,
    ]);

    const hasUnsavedChanges = isDirty(currentConfig, initialConfig);

    useEffect(() => {
        async function loadData() {
            const [configRes, rolesRes] = await Promise.all([
                getMissionConfig(guildId),
                getDiscordRolesAction(guildId, { ignoreWhitelist: true })
            ]);

            if (configRes.success && configRes.data) {
                const loaded: MissionConfigSnapshot = {
                    channelId: configRes.data.missionChannelId || "",
                    roleId: configRes.data.missionNotifyRoleId || null,
                    validationChannelId: configRes.data.missionValidationChannelId || "",
                    validationRoleId: configRes.data.missionValidationNotifyRoleId || null,
                    managementChannelId: configRes.data.missionManagementNotifyChannelId || "",
                    managementRoleId: configRes.data.missionManagementNotifyRoleId || null,
                    missionVitrineMode: configRes.data.missionVitrineMode || false,
                    missionPingRoleIds: configRes.data.missionPingRoleIds || [],
                };
                setChannelId(loaded.channelId);
                setValidationChannelId(loaded.validationChannelId);
                setRoleId(loaded.roleId);
                setValidationRoleId(loaded.validationRoleId);
                setManagementChannelId(loaded.managementChannelId);
                setManagementRoleId(loaded.managementRoleId);
                setMissionVitrineMode(loaded.missionVitrineMode);
                setMissionPingRoleIds(loaded.missionPingRoleIds);
                setInitialConfig(loaded);
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
                missionManagementNotifyChannelId: managementChannelId.trim() || null,
                missionManagementNotifyRoleId: managementRoleId,
                missionVitrineMode: missionVitrineMode,
            });
            const pingRolesResult = await updateAllowedPingRolesAction(guildId, missionPingRoleIds, "missions");
            if (result.success && pingRolesResult.success) {
                setInitialConfig(currentConfig);
                toast.success("Paramètres des missions enregistrés !");
            } else {
                toast.error((pingRolesResult.success ? result.error : pingRolesResult.error) || "Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-[360px]">
                <Loader2 className="w-8 h-8 animate-spin text-amber-500/60" />
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Bannière d'en-tête du module */}
            <div className="relative rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-950/20 to-surface/80 p-6 overflow-hidden">
                <div className="absolute right-4 -bottom-6 w-36 h-36 opacity-15 pointer-events-none select-none">
                    <img
                        src="/assets/ui/dofus-missions-thumb.png"
                        alt=""
                        className="w-full h-full object-contain filter drop-shadow-xl"
                    />
                </div>
                <div className="flex items-start gap-4 relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 p-2 shadow-inner">
                        <img
                            src="/assets/dofus/modules/quest.png"
                            alt="Missions"
                            className="w-10 h-10 object-contain drop-shadow"
                        />
                    </div>
                    <div className="space-y-1 max-w-2xl">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-caption font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <Target className="w-3 h-3" />
                            Missions de Guilde Hebdomadaires
                        </div>
                        <h3 className="text-lg font-bold text-foreground">
                            Paramètres des Missions
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Configurez la diffusion automatique des 12 missions du mardi, les notifications Discord
                            pour la validation des preuves de réussite et le rappel staff post-maintenance.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* 1. PUBLICATION HEBDOMADAIRE */}
                <Card className="bg-surface/60 border-border overflow-hidden">
                    <CardHeader className="pb-4 border-b border-border/50">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                            <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
                                <Target className="w-4 h-4" />
                            </span>
                            Publication Hebdomadaire sur Discord
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                            Annonce automatique des missions de la semaine et rôles pouvant être mentionnés.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-5">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
                                    Salon de Publication
                                </label>
                                <DiscordChannelPicker
                                    guildId={guildId}
                                    value={channelId}
                                    onChange={setChannelId}
                                />
                                <p className="text-caption text-muted-foreground">
                                    Le bot y publiera la grille des missions chaque semaine.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
                                    Rôle à Mentionner par Défaut
                                </label>
                                <RoleSelector
                                    value={roleId}
                                    onChange={setRoleId}
                                    roles={roles}
                                    className="h-10"
                                />
                                <p className="text-caption text-muted-foreground">
                                    Ce rôle sera ping lors de l'annonce officielle des missions.
                                </p>
                            </div>
                        </div>

                        <div className="pt-4 border-t border-border/50">
                            <div className="space-y-2">
                                <label className="text-caption font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                                    <Users className="w-3.5 h-3.5" />
                                    Rôles Autorisés pour le Ping (Whitelist)
                                </label>
                                <PingRolesSelector
                                    value={missionPingRoleIds}
                                    onChange={setMissionPingRoleIds}
                                    roles={discordRoles}
                                    description="Si la liste est vide, aucun rôle ne pourra être mentionné lors de la publication manuelle par les membres non-administrateurs."
                                />
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 2. VALIDATION DES MISSIONS & 3. RAPPEL RESET HEBDO */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Validation */}
                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader className="pb-4 border-b border-border/50">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                                <span className="p-1.5 rounded-lg bg-info/15 text-info">
                                    <ShieldCheck className="w-4 h-4" />
                                </span>
                                Validation des Preuves de Mission
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Notifications envoyées dès qu'un membre soumet une capture d'écran.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
                                    Salon Discord des Preuves
                                </label>
                                <DiscordChannelPicker
                                    guildId={guildId}
                                    value={validationChannelId}
                                    onChange={setValidationChannelId}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
                                    Rôle Staff Vérificateur
                                </label>
                                <RoleSelector
                                    value={validationRoleId}
                                    onChange={setValidationRoleId}
                                    roles={roles}
                                    className="h-10"
                                />
                            </div>
                        </CardContent>
                    </Card>

                    {/* Rappel Reset */}
                    <Card className="bg-surface/60 border-border overflow-hidden">
                        <CardHeader className="pb-4 border-b border-border/50">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                                <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
                                    <Bell className="w-4 h-4" />
                                </span>
                                Rappel Reset Hebdo (Mardi 08h00)
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Rappel aux officiers pour générer les nouvelles missions après la maintenance.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="pt-6 space-y-4">
                            <div className="space-y-2">
                                <label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
                                    Salon de Rappel
                                </label>
                                <DiscordChannelPicker
                                    guildId={guildId}
                                    value={managementChannelId}
                                    onChange={setManagementChannelId}
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
                                    Rôle Staff Notifié
                                </label>
                                <RoleSelector
                                    value={managementRoleId}
                                    onChange={setManagementRoleId}
                                    roles={roles}
                                    className="h-10"
                                />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* 4. MODE VITRINE */}
                <Card className="bg-surface/60 border-border overflow-hidden">
                    <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4">
                        <div className="space-y-1">
                            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                                <span className="p-1.5 rounded-lg bg-surface text-muted-foreground border border-border">
                                    <Eye className="w-4 h-4" />
                                </span>
                                Mode Vitrine (Lecture Seule)
                            </CardTitle>
                            <CardDescription className="text-xs text-muted-foreground">
                                Masque l'upload de preuves, le statut de validation des missions et les classements pour vos membres.
                            </CardDescription>
                        </div>
                        <div className="flex items-center gap-3 self-end sm:self-auto">
                            <span className="text-xs font-semibold text-muted-foreground">
                                {missionVitrineMode ? "Activé" : "Désactivé"}
                            </span>
                            <Switch
                                checked={missionVitrineMode}
                                onCheckedChange={setMissionVitrineMode}
                                className="data-[state=checked]:bg-amber-500"
                            />
                        </div>
                    </CardHeader>
                </Card>
            </div>

            {/* Bouton Enregistrer */}
            <div className="flex items-center justify-end gap-3 pt-2">
                <Button
                    onClick={handleSave}
                    disabled={isPending}
                    className="bg-amber-500 hover:bg-amber-600 text-amber-950 font-bold min-w-[180px] h-11 shadow-lg shadow-amber-500/20"
                >
                    {isPending ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                            Enregistrement...
                        </>
                    ) : (
                        <>
                            <Save className="w-4 h-4 mr-2" />
                            Enregistrer les Missions
                        </>
                    )}
                </Button>
            </div>

            <UnsavedChangesGuard
                hasUnsavedChanges={hasUnsavedChanges}
                message="Vous avez des modifications de paramètres de missions non sauvegardées. Quitter cette page les perdra définitivement."
            />
        </div>
    );
}
