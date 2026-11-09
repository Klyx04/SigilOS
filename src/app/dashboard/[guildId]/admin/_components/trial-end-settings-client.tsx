"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { DiscordChannelPicker, DISCORD_FORUM_CHANNEL_TYPES } from "@/components/shared/DiscordChannelPicker";
import { getTrialEndSettings, updateTrialEndSettings } from "@/server/actions/trial-end-actions";
import { getAssignableTrialRoles } from "@/server/actions/member-lifecycle-actions";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";

/**
 * 🎓 Réglage du salon **fin d'essai**.
 *
 * Un seul embed par membre et par échéance, quand l'essai arrive à terme sans être validé
 * (l'essai n'est **jamais** validé automatiquement : le staff tranche). Salon **forum ou
 * texte** — un forum reçoit un sujet, un salon texte un message.
 */
export function TrialEndSettingsClient({ guildId }: { guildId: string }) {
    const [channelId, setChannelId] = useState("");
    const [trialDurationDays, setTrialDurationDays] = useState(14);
    const [trialRoleId, setTrialRoleId] = useState("");
    const [confirmedRoleId, setConfirmedRoleId] = useState("");
    const [confirmRoleChange, setConfirmRoleChange] = useState(false);
    const [roles, setRoles] = useState<Array<{ id: string; name: string }>>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    /** Sentinelle Radix : un `<SelectItem>` ne peut pas porter la valeur vide. */
    const NONE = "__none__";
    const toValue = (roleId: string) => (roleId ? roleId : NONE);
    const toRoleId = (value: string) => (value === NONE ? "" : value);

    useEffect(() => {
        let active = true;
        Promise.all([getTrialEndSettings(guildId), getAssignableTrialRoles(guildId)]).then(([res, rolesRes]) => {
            if (!active) return;
            if (res.success && res.data) {
                setChannelId(res.data.channelId || "");
                setTrialDurationDays(res.data.trialDurationDays);
                setTrialRoleId(res.data.trialRoleId || "");
                setConfirmedRoleId(res.data.confirmedRoleId || "");
                setConfirmRoleChange(res.data.confirmRoleChange === true);
            }
            if (rolesRes.success && rolesRes.data) {
                setRoles(rolesRes.data.map((role) => ({ id: role.id, name: role.name })));
            }
            setIsLoading(false);
        });
        return () => {
            active = false;
        };
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateTrialEndSettings(
                guildId,
                channelId.trim() || null,
                trialDurationDays,
                {
                    trialRoleId: trialRoleId || null,
                    confirmedRoleId: confirmedRoleId || null,
                },
                confirmRoleChange
            );
            if (result.success) {
                toast.success("Réglages de fin d'essai enregistrés.");
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-info" />
            </div>
        );
    }

    return (
        <Card className="bg-surface/60 border-border rounded-2xl overflow-hidden">
            <CardHeader className="border-b border-border bg-surface/30 p-6">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                    <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wider text-foreground">
                        <span className="bg-info/20 text-info p-2 rounded-xl border border-info/30">
                            <GraduationCap className="w-4 h-4" />
                        </span>
                        Fin d&apos;essai
                    </CardTitle>
                    {channelId ? (
                        <Badge className="bg-info/10 text-info border-info/20 font-black uppercase tracking-wider text-caption">Actif</Badge>
                    ) : (
                        <Badge variant="outline" className="text-muted-foreground font-black uppercase tracking-wider text-caption">Non configuré</Badge>
                    )}
                </div>
                <CardDescription className="text-muted-foreground mt-2 text-xs">
                    Quand l&apos;échéance d&apos;un essai est passée <strong>sans validation</strong>, un embed est publié
                    <strong> une seule fois</strong> dans ce salon (forum = un sujet, texte = un message). L&apos;essai
                    n&apos;est jamais validé automatiquement : le staff tranche depuis la fiche du membre.
                </CardDescription>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
                <div className="space-y-2">
                    <label
                        htmlFor="trial-duration-days"
                        className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                    >
                        Durée de l&apos;essai par défaut (jours)
                    </label>
                    <div className="flex flex-wrap items-center gap-3">
                        <input
                            id="trial-duration-days"
                            type="number"
                            min={1}
                            max={90}
                            value={trialDurationDays}
                            onChange={(event) => setTrialDurationDays(Number(event.target.value))}
                            className="w-24 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-info/40"
                        />
                        <p className="text-xs text-muted-foreground max-w-md">
                            La fin d&apos;essai est calculée à partir de la date d&apos;arrivée du membre.
                            Entre 1 et 90 jours.
                        </p>
                    </div>
                </div>
                <DiscordChannelPicker
                    guildId={guildId}
                    value={channelId}
                    onChange={setChannelId}
                    allowedTypes={DISCORD_FORUM_CHANNEL_TYPES}
                    allowEmptyLabel="Aucun (notifications désactivées)"
                />
                <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                        <label
                            htmlFor="trial-role"
                            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                        >
                            Rôle d&apos;essai (optionnel)
                        </label>
                        <Select value={toValue(trialRoleId)} onValueChange={(value) => setTrialRoleId(toRoleId(value))}>
                            <SelectTrigger id="trial-role" className="w-full rounded-xl border-border bg-surface">
                                <SelectValue placeholder="Aucun rôle" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>Aucun rôle</SelectItem>
                                {roles.map((role) => (
                                    <SelectItem key={role.id} value={role.id}>
                                        {role.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Ajouté quand l&apos;essai démarre, depuis la fiche du membre comme au démarrage
                            d&apos;essai par commande.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label
                            htmlFor="confirmed-role"
                            className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
                        >
                            Rôle confirmé (optionnel)
                        </label>
                        <Select
                            value={toValue(confirmedRoleId)}
                            onValueChange={(value) => setConfirmedRoleId(toRoleId(value))}
                        >
                            <SelectTrigger id="confirmed-role" className="w-full rounded-xl border-border bg-surface">
                                <SelectValue placeholder="Aucun rôle" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={NONE}>Aucun rôle</SelectItem>
                                {roles.map((role) => (
                                    <SelectItem key={role.id} value={role.id}>
                                        {role.name}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">
                            Ajouté à la validation de l&apos;essai, avec retrait du rôle d&apos;essai.
                        </p>
                    </div>
                </div>
                <p className="text-xs text-muted-foreground">
                    Seuls les rôles situés sous le rôle du bot et sous ton rôle le plus haut sur Discord sont
                    proposés. Un rôle laissé sur « Aucun rôle » n&apos;est jamais touché.
                </p>
                <label
                    htmlFor="confirm-role-change"
                    className="flex items-start gap-3 rounded-xl border border-border bg-surface/60 p-3"
                >
                    <Checkbox
                        id="confirm-role-change"
                        checked={confirmRoleChange}
                        onCheckedChange={(checked) => setConfirmRoleChange(checked === true)}
                        className="mt-0.5"
                    />
                    <span className="space-y-1">
                        <span className="block text-xs font-medium text-foreground">
                            Me montrer avant d&apos;appliquer les rôles
                        </span>
                        <span className="block text-xs text-muted-foreground">
                            À la validation d&apos;un essai, une fenêtre récapitule les rôles ajoutés et retirés —
                            tu peux décocher un geste pour ce membre précis.
                        </span>
                    </span>
                </label>
                <div className="flex justify-end">
                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        className="min-w-[140px] bg-info hover:bg-info text-info-foreground font-black uppercase tracking-wider text-xs rounded-xl"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Sauvegarder
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
