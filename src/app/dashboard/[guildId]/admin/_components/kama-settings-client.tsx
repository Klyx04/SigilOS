"use client";

import { useState, useEffect, useTransition, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, AlertTriangle, ShieldCheck, Coins, Sparkles, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
    getCalendarConfig,
    getMissionConfig,
    updateRaidKamaDonationRequired,
    updateRaidKamaDonationThreshold,
    updateMissionNotifySettings
} from "@/server/actions/admin-actions";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";
import { RoleSelector } from "@/components/admin/role-selector";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";
import Image from "next/image";

interface KamaSettingsClientProps {
    guildId: string;
}

export function KamaSettingsClient({ guildId }: KamaSettingsClientProps) {
    const [requireKamaDonation, setRequireKamaDonation] = useState(true);
    const [kamaDonationThreshold, setKamaDonationThreshold] = useState(3);
    const [kamaChannelId, setKamaChannelId] = useState<string>("");
    const [kamaRoleId, setKamaRoleId] = useState<string | null>(null);

    const [roles, setRoles] = useState<{ id: string; name: string }[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    type KamaConfigSnapshot = {
        requireKamaDonation: boolean;
        kamaDonationThreshold: number;
        kamaChannelId: string;
        kamaRoleId: string | null;
    };

    const [initialConfig, setInitialConfig] = useState<KamaConfigSnapshot | null>(null);

    const currentConfig: KamaConfigSnapshot = useMemo(() => ({
        requireKamaDonation,
        kamaDonationThreshold,
        kamaChannelId,
        kamaRoleId,
    }), [requireKamaDonation, kamaDonationThreshold, kamaChannelId, kamaRoleId]);

    const hasUnsavedChanges = isDirty(currentConfig, initialConfig);

    useEffect(() => {
        async function loadData() {
            const [calendarRes, missionRes, rolesRes] = await Promise.all([
                getCalendarConfig(guildId),
                getMissionConfig(guildId),
                getDiscordRolesAction(guildId, { ignoreWhitelist: true })
            ]);

            const loaded: KamaConfigSnapshot = {
                requireKamaDonation: calendarRes.success && calendarRes.data?.raidRequireKamaDonation !== undefined
                    ? calendarRes.data.raidRequireKamaDonation
                    : true,
                kamaDonationThreshold: calendarRes.success && calendarRes.data?.raidKamaDonationThreshold !== undefined
                    ? calendarRes.data.raidKamaDonationThreshold
                    : 3,
                kamaChannelId: missionRes.success && missionRes.data?.kamaNotifyChannelId
                    ? missionRes.data.kamaNotifyChannelId
                    : "",
                kamaRoleId: missionRes.success && (missionRes.data as any)?.kamaNotifyRoleId
                    ? (missionRes.data as any).kamaNotifyRoleId
                    : null,
            };

            setRequireKamaDonation(loaded.requireKamaDonation);
            setKamaDonationThreshold(loaded.kamaDonationThreshold);
            setKamaChannelId(loaded.kamaChannelId);
            setKamaRoleId(loaded.kamaRoleId);
            setInitialConfig(loaded);

            if (rolesRes.success && rolesRes.roles) {
                setRoles(rolesRes.roles.filter((r: any) => r.name !== "@everyone"));
            }

            setIsLoading(false);
        }

        loadData();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const [donationReqRes, thresholdRes, notifyRes] = await Promise.all([
                updateRaidKamaDonationRequired(guildId, requireKamaDonation),
                updateRaidKamaDonationThreshold(guildId, kamaDonationThreshold),
                updateMissionNotifySettings(guildId, {
                    kamaNotifyChannelId: kamaChannelId.trim() || null,
                    kamaNotifyRoleId: kamaRoleId,
                }),
            ]);

            if (donationReqRes.success && thresholdRes.success && notifyRes.success) {
                setInitialConfig(currentConfig);
                toast.success("Paramètres de don de kamas enregistrés avec succès !");
            } else {
                toast.error(
                    donationReqRes.error ||
                    thresholdRes.error ||
                    notifyRes.error ||
                    "Erreur lors de la sauvegarde"
                );
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
            {/* Bannière visuelle Dofus */}
            <div className="relative rounded-2xl border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-amber-950/20 to-surface/80 p-6 overflow-hidden">
                <div className="absolute right-4 -bottom-6 w-36 h-36 opacity-15 pointer-events-none select-none">
                    <img
                        src="/assets/missions/don-kamas-guilde.png"
                        alt=""
                        className="w-full h-full object-contain filter drop-shadow-xl"
                    />
                </div>
                <div className="flex items-start gap-4 relative z-10">
                    <div className="w-14 h-14 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center shrink-0 p-2 shadow-inner">
                        <img
                            src="/assets/dofus/modules/kamas.png"
                            alt="Kamas"
                            className="w-10 h-10 object-contain drop-shadow"
                        />
                    </div>
                    <div className="space-y-1 max-w-2xl">
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-caption font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            <Coins className="w-3 h-3" />
                            Trésorerie & Dons de Guilde
                        </div>
                        <h3 className="text-lg font-bold text-foreground">
                            Gestion des Dons de Kamas
                        </h3>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                            Configurez l'obligation de participation financière pour l'accès aux Raids officiels,
                            définissez le montant hebdomadaire attendu et configurez le salon Discord pour la validation des preuves de don.
                        </p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 gap-6">
                {/* CARTE 1 : RÈGLE DU DON REQUIS */}
                <Card className="bg-surface/60 border-border overflow-hidden">
                    <CardHeader className="pb-4 border-b border-border/50">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                            <div className="space-y-1">
                                <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                                    <span className="p-1.5 rounded-lg bg-amber-500/15 text-amber-400">
                                        <Coins className="w-4 h-4" />
                                    </span>
                                    Don obligatoire pour l'inscription aux Raids
                                </CardTitle>
                                <CardDescription className="text-xs text-muted-foreground">
                                    Conditionne l'accès aux Raids et active le widget de soumission de don sur la page Missions.
                                </CardDescription>
                            </div>
                            <div className="flex items-center gap-3 self-end sm:self-auto">
                                <span className="text-xs font-semibold text-muted-foreground">
                                    {requireKamaDonation ? "Activé" : "Désactivé"}
                                </span>
                                <Switch
                                    checked={requireKamaDonation}
                                    onCheckedChange={setRequireKamaDonation}
                                    className="data-[state=checked]:bg-amber-500"
                                />
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-6">
                        {requireKamaDonation ? (
                            <div className="space-y-6">
                                <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-start gap-3">
                                    <CheckCircle2 className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                    <div className="space-y-1 text-xs">
                                        <p className="font-semibold text-amber-300">
                                            Règle active pour tous les membres
                                        </p>
                                        <p className="text-amber-200/80 leading-relaxed">
                                            Chaque membre souhaitant s'inscrire à un Raid officiel doit avoir fait valider un don
                                            au cours de la semaine Dofus (mardi à mardi). Le formulaire d'envoi de capture apparaît directement
                                            sur la page Missions de chaque membre.
                                        </p>
                                    </div>
                                </div>

                                {/* Sélecteur de Seuil */}
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                                                Montant du don requis par semaine
                                            </label>
                                            <p className="text-caption text-muted-foreground">
                                                1 tranche de 10 000 kamas = 10 jetons violets 🟣. Actuellement :{" "}
                                                <strong className="text-foreground">
                                                    {(kamaDonationThreshold * 10_000).toLocaleString("fr-FR")} kamas
                                                </strong>{" "}
                                                ({kamaDonationThreshold * 10} 🟣)
                                            </p>
                                        </div>
                                        <Badge variant="outline" className="border-violet-500/30 text-violet-300 bg-violet-500/10 font-mono text-xs">
                                            {kamaDonationThreshold * 10} 🟣
                                        </Badge>
                                    </div>

                                    <div className="grid grid-cols-5 gap-2 sm:gap-3">
                                        {[1, 2, 3, 4, 5].map((level) => {
                                            const kamas = level * 10_000;
                                            const isSelected = kamaDonationThreshold === level;
                                            return (
                                                <button
                                                    key={level}
                                                    type="button"
                                                    onClick={() => setKamaDonationThreshold(level)}
                                                    className={`group relative p-3 sm:p-4 rounded-xl border flex flex-col items-center justify-center gap-1.5 transition-all text-center ${
                                                        isSelected
                                                            ? "bg-violet-500/20 border-violet-500/50 shadow-lg shadow-violet-500/10 ring-2 ring-violet-500/30"
                                                            : "bg-surface/80 border-border/60 hover:bg-surface hover:border-border text-muted-foreground hover:text-foreground"
                                                    }`}
                                                >
                                                    <div className="w-6 h-6 flex items-center justify-center">
                                                        <img
                                                            src="/assets/icons/kamas-violet.png"
                                                            alt="🟣"
                                                            className={`w-5 h-5 object-contain transition-transform group-hover:scale-110 ${
                                                                isSelected ? "scale-110 drop-shadow" : "opacity-70"
                                                            }`}
                                                        />
                                                    </div>
                                                    <span className={`text-xs font-bold ${isSelected ? "text-violet-200" : ""}`}>
                                                        {level * 10} 🟣
                                                    </span>
                                                    <span className="text-caption text-muted-foreground font-mono">
                                                        {(kamas / 1000).toFixed(0)}k
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="p-4 rounded-xl bg-surface border border-border flex items-start gap-3">
                                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                                <div className="space-y-1 text-xs">
                                    <p className="font-semibold text-foreground">
                                        Accès libre sans don obligatoire
                                    </p>
                                    <p className="text-muted-foreground leading-relaxed">
                                        Les membres ayant le rôle Raid peuvent s'inscrire librement sans faire de don préalable.
                                        Le widget d'envoi de dons de kamas est actuellement masqué sur la page Missions.
                                    </p>
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* CARTE 2 : NOTIFICATIONS DISCORD DES DONS */}
                <Card className="bg-surface/60 border-border overflow-hidden">
                    <CardHeader className="pb-4 border-b border-border/50">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
                            <span className="p-1.5 rounded-lg bg-info/15 text-info">
                                <ShieldCheck className="w-4 h-4" />
                            </span>
                            Alertes Discord des Preuves de Don
                        </CardTitle>
                        <CardDescription className="text-xs text-muted-foreground">
                            Définissez dans quel salon et quel rôle du staff doit être averti dès qu'un membre soumet une capture de don de kamas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
                                    Salon Discord des Dons
                                </label>
                                <DiscordChannelPicker
                                    guildId={guildId}
                                    value={kamaChannelId}
                                    onChange={setKamaChannelId}
                                />
                                <p className="text-caption text-muted-foreground">
                                    Les captures d'écran et fiches de validation de dons y seront postées.
                                </p>
                            </div>
                            <div className="space-y-2">
                                <label className="text-caption font-bold uppercase tracking-wider text-muted-foreground">
                                    Rôle Staff à Mentionner
                                </label>
                                <RoleSelector
                                    value={kamaRoleId}
                                    onChange={setKamaRoleId}
                                    roles={roles}
                                    className="h-10"
                                />
                                <p className="text-caption text-muted-foreground">
                                    Ce rôle Discord sera notifié pour vérifier et valider la transaction.
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Barre d'action */}
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
                            Enregistrer les Dons
                        </>
                    )}
                </Button>
            </div>

            <UnsavedChangesGuard
                hasUnsavedChanges={hasUnsavedChanges}
                message="Vous avez des modifications des paramètres de don de kamas non sauvegardées. Quitter cette page les perdra définitivement."
            />
        </div>
    );
}
