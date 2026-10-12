"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
    Sliders,
    Save,
    Shield,
    Bell,
    FileText,
    Star,
    Hash,
    Layers,
    AlertTriangle,
} from "lucide-react";
import { updateTicketGuildConfigAction, saveTicketGuildPermissionsAction } from "@/server/actions/ticket-bot-actions";
import { DiscordChannelPicker } from "@/components/shared/DiscordChannelPicker";
import { TicketRolesPicker } from "../ticket-discord-pickers";
import { readTicketPermissionSettings } from "@/lib/tickets/category-permissions";
import {
    TICKET_CHANNEL_GROUPS,
    TICKET_CHANNEL_GROUP_LABELS,
    TICKET_CHANNEL_PERMS,
    TICKET_CHANNEL_PERM_META,
    TICKET_CHANNEL_STATES,
    TICKET_CHANNEL_STATE_LABELS,
    readChannelPermissions,
    type TicketChannelGroup,
    type TicketChannelMatrix,
    type TicketChannelPerm,
    type TicketChannelState,
} from "@/lib/tickets/channel-permissions";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface TicketSettingsTabProps {
    guildId: string;
    config: any;
    onRefresh: () => void;
}

export function TicketSettingsTab({ guildId, config, onRefresh }: TicketSettingsTabProps) {
    const [isPending, startTransition] = useTransition();

    const [isEnabled, setIsEnabled] = useState<boolean>(config?.isEnabled ?? true);
    const [logChannelId, setLogChannelId] = useState<string>(config?.logChannelId || "");
    const [transcriptsChannelId, setTranscriptsChannelId] = useState<string>(config?.transcriptsChannelId || "");
    const [staffRoleIds, setStaffRoleIds] = useState<string[]>(config?.staffRoleIds || []);
    const [maxActiveTicketsPerUser, setMaxActiveTicketsPerUser] = useState<number>(
        config?.maxActiveTicketsPerUser ?? 1
    );
    const [maxTicketsTotalGuild, setMaxTicketsTotalGuild] = useState<number>(
        config?.maxTicketsTotalGuild ?? 50
    );
    const [enableCsat, setEnableCsat] = useState<boolean>(config?.enableCsat ?? true);
    const [enableDmNotifications, setEnableDmNotifications] = useState<boolean>(
        config?.enableDmNotifications ?? true
    );
    // 🆕 Plateforme (God) : transcripts, durées et plafonds — lecture seule ici.
    const platformLimits = config?.platformLimits as
        | {
              transcriptsEnabled?: boolean;
              retentionArchivesDays?: number;
              retentionNotesDays?: number;
              retentionAuditDays?: number;
              maxPerUserCap?: number;
              maxGuildCap?: number;
          }
        | undefined;

    // 🆕 Permissions globales (sans migration : `settingsJson`).
    const initialPermissions = readTicketPermissionSettings(config?.settingsJson);
    const [allowUserClose, setAllowUserClose] = useState<boolean>(initialPermissions.allowUserClose);
    const [requireCloseConfirm, setRequireCloseConfirm] = useState<boolean>(
        initialPermissions.requireCloseConfirm
    );
    const [blacklistRoleIds, setBlacklistRoleIds] = useState<string[]>(
        initialPermissions.blacklistRoleIds
    );
    // 🆕 Matrice Ouvert/Fermé (4 groupes × 2 états × 8 permissions, sans migration).
    const [matrix, setMatrix] = useState<TicketChannelMatrix>(() =>
        readChannelPermissions(config?.settingsJson)
    );

    const toggleMatrix = (group: TicketChannelGroup, state: TicketChannelState, perm: TicketChannelPerm) => {
        setMatrix((previous) => ({
            ...previous,
            [group]: {
                ...previous[group],
                [state]: { ...previous[group][state], [perm]: !previous[group][state][perm] },
            },
        }));
    };

    const handleSave = () => {
        startTransition(async () => {
            const res = await updateTicketGuildConfigAction(guildId, {
                isEnabled,
                logChannelId: logChannelId.trim() || undefined,
                transcriptsChannelId: transcriptsChannelId.trim() || undefined,
                staffRoleIds,
                maxActiveTicketsPerUser,
                maxTicketsTotalGuild,
                enableCsat,
                // `enableDmNotifications` n'est **plus exposé** : aucun code ne consomme ce
                // réglage (il n'existe pas d'envoi de MP « réponse du staff »). La colonne
                // reste en base, sa valeur est simplement conservée telle quelle.
                enableDmNotifications: config?.enableDmNotifications ?? true,
            });

            if (!res.success) {
                toast.error(res.error || "Erreur de mise à jour");
                return;
            }

            const permRes = await saveTicketGuildPermissionsAction(guildId, {
                allowUserClose,
                requireCloseConfirm,
                blacklistRoleIds,
                channelPermissions: matrix,
            });

            if (!permRes.success) {
                toast.error(permRes.error || "Réglages sauvés, permissions non enregistrées");
                return;
            }

            toast.success("Paramètres enregistrés !");
            onRefresh();
        });
    };

    return (
        <div className="max-w-4xl space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                        <Sliders className="h-5 w-5 text-amber-400" /> Paramètres du Système de Support
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Règles globales de modération, quotas par membre et alertes automatisées.
                    </p>
                </div>

                <Button onClick={handleSave} disabled={isPending} size="sm" className="bg-amber-600 hover:bg-amber-700 text-white text-xs">
                    <Save className="h-3.5 w-3.5 mr-1" /> Sauvegarder
                </Button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* General Toggles */}
                <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Shield className="h-4 w-4 text-amber-400" /> Options & Notifications
                    </h3>

                    <div className="space-y-3 divide-y divide-border/40 text-xs">
                        <div className="flex items-center justify-between pt-2">
                            <div>
                                <div className="font-semibold text-foreground">Activer le module Ticket</div>
                                <div className="text-muted-foreground">Autorise l'ouverture de tickets par les membres.</div>
                            </div>
                            <Switch checked={isEnabled} onCheckedChange={setIsEnabled} />
                        </div>

                        <div className="flex items-center justify-between pt-3">
                            <div>
                                <div className="font-semibold text-foreground">Enquête de Satisfaction CSAT</div>
                                <div className="text-muted-foreground">Envoie un sondage 1-5 étoiles en DM Discord à la fermeture.</div>
                            </div>
                            <Switch checked={enableCsat} onCheckedChange={setEnableCsat} />
                        </div>

                        <div className="pt-3 text-[11px] text-muted-foreground">
                            Copies des messages : {platformLimits?.transcriptsEnabled === false ? "désactivées" : "activées"} par
                            la plateforme · conservation archives {platformLimits?.retentionArchivesDays ?? 90} j,
                            notes {platformLimits?.retentionNotesDays ?? 90} j, audit {platformLimits?.retentionAuditDays ?? 180} j.
                        </div>
                    </div>
                </div>

                {/* Quotas & Roles */}
                <div className="rounded-2xl border border-border bg-card p-5 space-y-4 text-xs">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                        <Layers className="h-4 w-4 text-amber-400" /> Quotas & Canaux Discord
                    </h3>
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <label className="font-semibold text-foreground">Rôles Staff globaux</label>
                            <TicketRolesPicker
                                guildId={guildId}
                                value={staffRoleIds}
                                onChange={setStaffRoleIds}
                                description="Ces rôles ont accès à tous les tickets ouverts, quel que soit le motif."
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                                <label className="font-semibold text-foreground">Max tickets par membre</label>
                                <Input
                                    type="number"
                                    min={1}
                                    max={platformLimits?.maxPerUserCap ?? 5}
                                    value={maxActiveTicketsPerUser}
                                    onChange={(e) => setMaxActiveTicketsPerUser(Number(e.target.value))}
                                    className="text-xs h-8"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="font-semibold text-foreground">Quota max simultané guilde</label>
                                <Input
                                    type="number"
                                    min={5}
                                    max={platformLimits?.maxGuildCap ?? 100}
                                    value={maxTicketsTotalGuild}
                                    onChange={(e) => setMaxTicketsTotalGuild(Number(e.target.value))}
                                    className="text-xs h-8"
                                />
                            </div>
                        </div>

                        <p className="text-[11px] text-muted-foreground">
                            Plafonds plateforme : {platformLimits?.maxPerUserCap ?? 5} par membre,{" "}
                            {platformLimits?.maxGuildCap ?? 100} au total — le serveur plafonne automatiquement.
                        </p>
                    </div>
                </div>
            </div>

            {/* 🆕 Permissions globales : qui ferme, confirmation, blacklist. */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 text-xs">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-400" /> Permissions des tickets
                </h3>

                <div className="space-y-3 divide-y divide-border/40">
                    <div className="flex items-center justify-between pt-2">
                        <div>
                            <div className="font-semibold text-foreground">Les demandeurs peuvent fermer</div>
                            <div className="text-muted-foreground">
                                Sinon, seule l'équipe ferme. Réglable par motif dans l'onglet Motifs.
                            </div>
                        </div>
                        <Switch checked={allowUserClose} onCheckedChange={setAllowUserClose} />
                    </div>

                    <div className="flex items-center justify-between pt-3">
                        <div>
                            <div className="font-semibold text-foreground">Confirmation avant fermeture</div>
                            <div className="text-muted-foreground">
                                « Oui, fermer / Annuler » avant toute clôture. La suppression demande toujours confirmation.
                            </div>
                        </div>
                        <Switch checked={requireCloseConfirm} onCheckedChange={setRequireCloseConfirm} />
                    </div>

                    <div className="space-y-1 pt-3">
                        <label className="font-semibold text-foreground">Rôles bloqués (blacklist)</label>
                        <TicketRolesPicker
                            guildId={guildId}
                            value={blacklistRoleIds}
                            onChange={setBlacklistRoleIds}
                            description="Ces rôles ne voient aucun bouton d'ouverture et ne peuvent pas agir sur les tickets."
                        />
                    </div>
                </div>
            </div>

            {/* 🆕 Matrice des permissions de salon : 4 groupes × Ouvert/Fermé. */}
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4 text-xs">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    <Shield className="h-4 w-4 text-amber-400" /> Permissions des salons de ticket
                </h3>
                <p className="text-[11px] text-muted-foreground">
                    Qui peut quoi dans le salon, quand il est ouvert puis après fermeture.
                    Les rôles invités se choisissent par motif, dans l'onglet Motifs.
                </p>

                {matrix.everyone.open.view && (
                    <div className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-[11px] text-destructive">
                        ⚠️ « Tout le monde » peut voir les salons ouverts : tes tickets sont publics.
                        Décoche « Voir le salon » pour les rendre privés à nouveau.
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                        <thead>
                            <tr className="text-muted-foreground">
                                <th className="text-left font-semibold p-2">Permission</th>
                                {TICKET_CHANNEL_GROUPS.map((group) => (
                                    <th key={group} colSpan={2} className="font-semibold p-2 text-center border-l border-border/40">
                                        {TICKET_CHANNEL_GROUP_LABELS[group]}
                                    </th>
                                ))}
                            </tr>
                            <tr className="text-muted-foreground">
                                <th className="p-1" />
                                {TICKET_CHANNEL_GROUPS.map((group) =>
                                    TICKET_CHANNEL_STATES.map((state) => (
                                        <th
                                            key={`${group}-${state}`}
                                            className="p-1 text-center text-[11px] font-medium border-l border-border/40"
                                        >
                                            {TICKET_CHANNEL_STATE_LABELS[state]}
                                        </th>
                                    ))
                                )}
                            </tr>
                        </thead>
                        <tbody>
                            {TICKET_CHANNEL_PERMS.map((perm) => (
                                <tr key={perm} className="border-t border-border/40">
                                    <td className="p-2 text-muted-foreground">
                                        {TICKET_CHANNEL_PERM_META[perm].label}
                                    </td>
                                    {TICKET_CHANNEL_GROUPS.map((group) =>
                                        TICKET_CHANNEL_STATES.map((state) => (
                                            <td key={`${group}-${state}-${perm}`} className="p-2 text-center border-l border-border/40">
                                                <Switch
                                                    checked={matrix[group][state][perm]}
                                                    onCheckedChange={() => toggleMatrix(group, state, perm)}
                                                    aria-label={`${TICKET_CHANNEL_GROUP_LABELS[group]} ${TICKET_CHANNEL_STATE_LABELS[state]} ${TICKET_CHANNEL_PERM_META[perm].label}`}
                                                />
                                            </td>
                                        ))
                                    )}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
