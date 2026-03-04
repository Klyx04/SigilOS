"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Save, Hash, Target, Users, Bell, Search, ShieldCheck, Coins, Trophy, Clock } from "lucide-react";
import { toast } from "sonner";
import { getMissionConfig, updateMissionNotifySettings } from "@/server/actions/admin-actions";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { RoleSelector } from "@/components/admin/role-selector";

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

    // Validation Succès
    const [achievementChannelId, setAchievementChannelId] = useState<string>("");
    const [achievementRoleId, setAchievementRoleId] = useState<string | null>(null);

    // Contributions Kamas
    const [kamaChannelId, setKamaChannelId] = useState<string>("");
    const [kamaRoleId, setKamaRoleId] = useState<string | null>(null);

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
                setKamaChannelId(configRes.data.kamaNotifyChannelId || "");
                setAchievementChannelId(configRes.data.achievementNotifyChannelId || "");
                setRoleId(configRes.data.missionNotifyRoleId || null);
                setValidationRoleId(configRes.data.missionValidationNotifyRoleId || null);
                // New fields (may not exist in older configs, graceful fallback)
                setAchievementRoleId((configRes.data as any).achievementNotifyRoleId || null);
                setKamaRoleId((configRes.data as any).kamaNotifyRoleId || null);
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
                validationRoleId: validationRoleId,
                kamaNotifyChannelId: kamaChannelId.trim() || null,
                kamaNotifyRoleId: kamaRoleId,
                achievementNotifyChannelId: achievementChannelId.trim() || null,
                achievementNotifyRoleId: achievementRoleId,
            });
            if (result.success) {
                toast.success("Paramètres mis à jour !");
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

    /** Composant réutilisable pour un bloc salon + rôle uniforme */
    const NotifBlock = ({
        accentClass,
        focusClass,
        channelValue,
        onChannelChange,
        channelHint,
        roleValue,
        onRoleChange,
        timer24h,
    }: {
        accentClass: string;
        focusClass: string;
        channelValue: string;
        onChannelChange: (v: string) => void;
        channelHint: string;
        roleValue: string | null;
        onRoleChange: (v: string | null) => void;
        timer24h?: true;
    }) => (
        <div className="space-y-3">
            {/* Salon */}
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                    <Hash className="w-3 h-3" /> Salon
                </label>
                <Input
                    value={channelValue}
                    onChange={(e) => onChannelChange(e.target.value)}
                    placeholder="ID du salon..."
                    className={`font-mono bg-black/40 border-white/10 text-white h-10 text-sm ${focusClass} rounded-xl`}
                />
                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">{channelHint}</p>
            </div>

            {/* Rôle */}
            <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-500 flex items-center gap-2">
                    <Users className="w-3 h-3" /> Staff à Alerter
                </label>
                <RoleSelector
                    value={roleValue}
                    onChange={onRoleChange}
                    roles={roles}
                    className={`h-10 border-${accentClass}-500/20`}
                />
                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                    Rôle mentionné dans l&apos;embed Discord.
                </p>
            </div>

            {/* 24h badge */}
            <div className={`p-2.5 rounded-xl bg-${accentClass}-500/5 border border-${accentClass}-500/10`}>
                <div className="flex gap-2 items-start">
                    <Clock className={`w-3 h-3 text-${accentClass}-400 shrink-0 mt-0.5`} />
                    <p className="text-[10px] text-zinc-500 leading-relaxed italic">
                        <span className={`text-${accentClass}-400 font-bold not-italic`}>24h</span> — Suppression automatique de la preuve si non validée.
                        {timer24h && <span className="ml-1">Un compte à rebours est visible dans le dashboard admin.</span>}
                    </p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            {/* ── SECTION 1: PUBLICATION (full width) ── */}
            <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600 mb-3 pl-1">
                    📢 Publication hebdomadaire
                </h3>
                <Card className="bg-zinc-900/60 border-white/5 overflow-hidden group relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                    <CardContent className="p-6 relative z-10">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                                    Salon pour l&apos;annonce des 12 missions hebdomadaires.
                                </p>
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
                                <p className="text-[9px] text-zinc-600 font-bold uppercase tracking-wider">
                                    Envoyé chaque lundi matin (auto ou manuellement).
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* ── SECTION 2: VALIDATION CHANNELS (3 cards) ── */}
            <div>
                <h3 className="text-xs font-black uppercase tracking-[0.2em] text-zinc-600 mb-3 pl-1">
                    🔔 Salons de notification uploads
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

                    {/* VALIDATION MISSIONS */}
                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-purple-400 text-sm">
                                <ShieldCheck className="w-4 h-4" />
                                Validation Missions
                            </CardTitle>
                            <CardDescription className="text-[10px] font-medium leading-relaxed">
                                Embed + boutons ✅❌ envoyés quand un membre soumet une preuve de mission.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="relative z-10 pt-0">
                            <NotifBlock
                                accentClass="purple"
                                focusClass="focus:ring-purple-500/20 focus:border-purple-500/50"
                                channelValue={validationChannelId}
                                onChannelChange={setValidationChannelId}
                                channelHint="Vide = salon de publication."
                                roleValue={validationRoleId}
                                onRoleChange={setValidationRoleId}
                                timer24h
                            />
                        </CardContent>
                    </Card>

                    {/* VALIDATION SUCCÈS */}
                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-sky-400 text-sm">
                                <Trophy className="w-4 h-4" />
                                Validation Succès
                            </CardTitle>
                            <CardDescription className="text-[10px] font-medium leading-relaxed">
                                Embed + boutons ✅❌ envoyés quand un membre upload une preuve de points succès.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="relative z-10 pt-0">
                            <NotifBlock
                                accentClass="sky"
                                focusClass="focus:ring-sky-500/20 focus:border-sky-500/50"
                                channelValue={achievementChannelId}
                                onChannelChange={setAchievementChannelId}
                                channelHint="Vide = salon validation missions."
                                roleValue={achievementRoleId}
                                onRoleChange={setAchievementRoleId}
                                timer24h
                            />
                        </CardContent>
                    </Card>

                    {/* CONTRIBUTIONS KAMAS */}
                    <Card className="bg-zinc-900/60 border-white/5 overflow-hidden group relative">
                        <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
                        <CardHeader className="pb-2">
                            <CardTitle className="flex items-center gap-2 text-yellow-400 text-sm">
                                <Coins className="w-4 h-4" />
                                Contributions Kamas
                            </CardTitle>
                            <CardDescription className="text-[10px] font-medium leading-relaxed">
                                Embed + boutons ✅❌ envoyés quand un membre soumet un don de kamas.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="relative z-10 pt-0">
                            <NotifBlock
                                accentClass="yellow"
                                focusClass="focus:ring-yellow-500/20 focus:border-yellow-500/50"
                                channelValue={kamaChannelId}
                                onChannelChange={setKamaChannelId}
                                channelHint="Vide = pas de notification."
                                roleValue={kamaRoleId}
                                onRoleChange={setKamaRoleId}
                                timer24h
                            />
                        </CardContent>
                    </Card>
                </div>
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
                    SAUVEGARDER
                </Button>
            </div>
        </div>
    );
}
