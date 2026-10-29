"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Save, GraduationCap } from "lucide-react";
import { toast } from "sonner";
import { DiscordChannelPicker, DISCORD_FORUM_CHANNEL_TYPES } from "@/components/shared/DiscordChannelPicker";
import { getTrialEndSettings, updateTrialEndSettings } from "@/server/actions/trial-end-actions";

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
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    useEffect(() => {
        let active = true;
        getTrialEndSettings(guildId).then((res) => {
            if (!active) return;
            if (res.success && res.data) {
                setChannelId(res.data.channelId || "");
                setTrialDurationDays(res.data.trialDurationDays);
            }
            setIsLoading(false);
        });
        return () => {
            active = false;
        };
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateTrialEndSettings(guildId, channelId.trim() || null, trialDurationDays);
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
