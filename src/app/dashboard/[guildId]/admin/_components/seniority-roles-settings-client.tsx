"use client";

/**
 * Chantier Y — onglet **Paramètres → Ancienneté** : le **salon de l'annonce**.
 *
 * Pourquoi ici : dans ce dépôt, **tous** les salons se déclarent dans Paramètres (les 16 encarts
 * des modules) ; le module Ancienneté ne fait pas exception. Le reste du module (activation,
 * paliers, message, aperçu, état, prochains paliers) vit dans l'onglet Membres →
 * « Rôles d'ancienneté ».
 *
 * **Une seule porte par réglage** : cet écran n'écrit que le salon (`updateSeniorityRolesChannel`),
 * et l'onglet Membres n'écrit plus ce champ — aucun des deux ne peut écraser l'autre.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { Clock, Loader2, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";
import {
    getSeniorityRolesSettings,
    updateSeniorityRolesChannel,
} from "@/server/actions/seniority-roles-actions";

export function SeniorityRolesSettingsClient({ guildId }: { guildId: string }) {
    const [channelId, setChannelId] = useState("");
    const [initial, setInitial] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const load = useCallback(async () => {
        const settings = await getSeniorityRolesSettings(guildId);
        if (settings.success && settings.data) {
            const loaded = settings.data.channelId ?? "";
            setChannelId(loaded);
            setInitial(loaded);
            setError(null);
        } else if (!settings.success) {
            // Le réglage exige la **gestion des membres** : l'écran le dit, il ne le cache pas.
            setError(settings.error || "Réglages illisibles");
        }
        setIsLoading(false);
    }, [guildId]);

    useEffect(() => {
        load();
    }, [load]);

    const hasUnsavedChanges =
        initial !== null && isDirty({ channelId: channelId.trim() }, { channelId: initial });

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateSeniorityRolesChannel(guildId, { channelId: channelId.trim() || null });
            if (result.success) {
                toast.success("Salon de l'annonce enregistré");
                setInitial(channelId.trim());
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    return (
        <Card>
            <UnsavedChangesGuard hasUnsavedChanges={hasUnsavedChanges} />
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-info" />
                    Rôles automatiques par ancienneté
                </CardTitle>
                <CardDescription>
                    Le salon où sont fêtés les paliers franchis. Les rôles, les paliers et le message se
                    règlent dans <strong>Membres → Rôles d&apos;ancienneté</strong>.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Chargement…
                    </div>
                ) : error ? (
                    <p className="rounded-xl border border-border bg-surface p-4 text-sm text-muted-foreground">
                        {error}
                    </p>
                ) : (
                    <>
                        <div className="space-y-2">
                            <Label htmlFor="seniority-channel">Salon de l&apos;annonce</Label>
                            <DiscordChannelPicker
                                guildId={guildId}
                                value={channelId}
                                onChange={setChannelId}
                                allowEmptyLabel="Aucune annonce (rôles posés en silence)"
                            />
                            <p className="text-xs text-muted-foreground">
                                Les rôles sont posés même sans salon : l&apos;annonce est la seule chose qui en dépend.
                            </p>
                        </div>
                        <div className="flex justify-end">
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={isPending || !hasUnsavedChanges}
                                className="gap-2"
                            >
                                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                                Enregistrer
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
