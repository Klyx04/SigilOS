"use client";

/**
 * Paramètres → onglet **Sondages** → **2ᵉ encart** « Sondages programmés ».
 *
 * Même mécanique que le premier encart (sondages classiques) : un salon Discord
 * choisi dans une liste déroulante, une whitelist de rôles de ping, et la garde
 * « modifications non sauvegardées ». Deux différences voulues :
 * - une **durée de vote par défaut** (proposée dans le formulaire de créneau) ;
 * - un **compteur de places** (3 créneaux en attente maximum), lu sur la même
 *   source que la page staff — jamais recalculé ici.
 */

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { CalendarClock, ExternalLink, Loader2, Save, Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";
import { PingRolesSelector } from "@/components/admin/ping-roles-selector";
import { getDiscordRolesAction, updateAllowedPingRolesAction } from "@/server/actions/user-actions";
import {
    getScheduledPollSettings,
    getScheduledPolls,
    updateScheduledPollSettings,
} from "@/server/actions/scheduled-poll-actions";
import { MAX_DURATION_HOURS, MIN_DURATION_HOURS } from "@/lib/polls/scheduling";
import { POLL_SLOT_COUNTER } from "@/lib/polls/ui";

interface ScheduledPollSettingsClientProps {
    guildId: string;
}

export function ScheduledPollSettingsClient({ guildId }: ScheduledPollSettingsClientProps) {
    const [channelId, setChannelId] = useState("");
    const [durationHours, setDurationHours] = useState("");
    const [pingRoleIds, setPingRoleIds] = useState<string[]>([]);
    const [discordRoles, setDiscordRoles] = useState<{ id: string; name: string; color: string }[]>([]);
    const [slots, setSlots] = useState<{ used: number; max: number } | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [initial, setInitial] = useState<{ channelId: string; durationHours: string; pingRoleIds: string[] } | null>(null);

    const hasUnsavedChanges = isDirty(
        { channelId, durationHours, pingRoleIds: [...pingRoleIds].sort() },
        initial
            ? { channelId: initial.channelId, durationHours: initial.durationHours, pingRoleIds: [...initial.pingRoleIds].sort() }
            : null,
    );

    useEffect(() => {
        async function load() {
            const [settings, rolesRes, board] = await Promise.all([
                getScheduledPollSettings(guildId),
                getDiscordRolesAction(guildId, { ignoreWhitelist: true }),
                // Le compteur de places n'est disponible qu'avec le module actif :
                // sans lui, l'encart reste configurable (fail-soft, jamais bloquant).
                getScheduledPolls(guildId).catch(() => ({ success: false as const, data: undefined })),
            ]);

            if (settings.success && settings.data) {
                const loadedChannel = settings.data.scheduledPollsChannelId || "";
                const loadedDuration = settings.data.scheduledPollsDurationH ? String(settings.data.scheduledPollsDurationH) : "";
                setChannelId(loadedChannel);
                setDurationHours(loadedDuration);
                setPingRoleIds(settings.data.scheduledPollsPingRoleIds || []);
                setInitial({
                    channelId: loadedChannel,
                    durationHours: loadedDuration,
                    pingRoleIds: settings.data.scheduledPollsPingRoleIds || [],
                });
            }
            if (rolesRes.success && rolesRes.roles) {
                setDiscordRoles(rolesRes.roles.filter((r: any) => r.name !== "@everyone") as any);
            }
            if (board.success && board.data) {
                setSlots({ used: board.data.pendingCount, max: board.data.maxSlots });
            }
            setIsLoading(false);
        }
        load();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const parsedDuration = durationHours.trim() ? Number(durationHours) : null;
            const [result, rolesResult] = await Promise.all([
                updateScheduledPollSettings(guildId, {
                    scheduledPollsChannelId: channelId.trim() || null,
                    scheduledPollsDurationH: parsedDuration,
                }),
                updateAllowedPingRolesAction(guildId, pingRoleIds, "scheduledPolls"),
            ]);

            if (result.success && rolesResult.success) {
                toast.success("Sondages programmés : configuration sauvegardée");
                setInitial({ channelId: channelId.trim(), durationHours: durationHours.trim(), pingRoleIds: [...pingRoleIds] });
            } else {
                toast.error(result.error || rolesResult.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    return (
        <Card>
            <UnsavedChangesGuard hasUnsavedChanges={hasUnsavedChanges} />
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <CalendarClock className="w-4 h-4 text-info" />
                    Sondages programmés (staff)
                </CardTitle>
                <CardDescription>
                    Publication automatique d&apos;un sondage à une date, une heure et une minute choisies :
                    salon par défaut de l&apos;embed, rôles de ping autorisés et durée de vote proposée.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
                {isLoading ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Chargement…
                    </div>
                ) : (
                    <>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className={POLL_SLOT_COUNTER}>
                                {slots ? `${slots.used}/${slots.max} créneaux en attente` : "Module désactivé — compteur indisponible"}
                            </span>
                            <Link
                                href={`/dashboard/${guildId}/admin/sondages-programmes`}
                                className="text-caption text-info hover:underline inline-flex items-center gap-1.5"
                            >
                                Gérer les sondages programmés
                                <ExternalLink className="w-3 h-3" />
                            </Link>
                        </div>


                        <div className="space-y-2">
                            <Label className="text-muted-foreground">Salon Discord de l&apos;embed</Label>
                            <DiscordChannelPicker
                                guildId={guildId}
                                value={channelId}
                                onChange={setChannelId}
                                allowEmptyLabel="Aucun (les créateurs devront choisir un salon)"
                            />
                            <p className="text-caption text-muted-foreground italic">
                                Salon utilisé par défaut : un créneau peut toujours en choisir un autre.
                            </p>
                        </div>

                        <div className="space-y-2 pt-2 border-t border-border">
                            <Label className="text-muted-foreground flex items-center gap-2">
                                <Users className="w-3.5 h-3.5 text-info" />
                                Rôles autorisés pour les mentions (whitelist)
                            </Label>
                            <p className="text-caption text-muted-foreground italic mb-2">
                                Seuls ces rôles peuvent être mentionnés à la publication d&apos;un sondage programmé.
                            </p>
                            <PingRolesSelector
                                value={pingRoleIds}
                                onChange={setPingRoleIds}
                                roles={discordRoles}
                                description="Liste vide = aucune mention possible depuis un créneau (les administrateurs du serveur ne peuvent pas contourner cette règle)."
                            />
                        </div>

                        <div className="space-y-2 pt-2 border-t border-border">
                            <Label className="text-muted-foreground">Durée de vote par défaut (heures)</Label>
                            <Input
                                type="number"
                                min={MIN_DURATION_HOURS}
                                max={MAX_DURATION_HOURS}
                                value={durationHours}
                                onChange={(e) => setDurationHours(e.target.value)}
                                placeholder="Vide = sondage sans date de fin (clôturé après 30 jours)"
                                className="max-w-xs"
                            />
                        </div>

                        <div className="pt-4 flex items-center justify-end border-t border-border">
                            <Button onClick={handleSave} disabled={isPending} className="min-w-[140px]">
                                {isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                ) : (
                                    <Save className="w-4 h-4 mr-2" />
                                )}
                                Sauvegarder
                                {hasUnsavedChanges && !isPending && (
                                    <span className="ml-2 w-2 h-2 rounded-full bg-white animate-pulse" title="Modifications non sauvegardées" />
                                )}
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}
