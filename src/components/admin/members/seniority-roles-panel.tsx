"use client";

/**
 * Chantier Y (lot Y-3) — onglet « Rôles d'ancienneté » du module Membres.
 *
 * Un seul écran : activation, salon de l'annonce, paliers (`jours → rôles`), message
 * personnalisable + **aperçu live**, et l'état réel (répartition par palier, annonces déjà
 * envoyées, dernière passe du robot).
 *
 * L'aperçu n'est pas une maquette : il passe par **le même rendu pur** que l'envoi réel
 * (`buildSeniorityAnnouncementValues` + `renderSeniorityAnnouncement`) et l'aperçu Discord de
 * la maison (`DiscordEmbedPreview`) — ce qui est montré est ce qui part.
 */

import { useCallback, useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Check, ChevronsUpDown, Clock, ExternalLink, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";
import { DiscordEmbedPreview } from "@/components/discord/DiscordEmbedPreview";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import {
    getSeniorityRolesSettings,
    updateSeniorityRolesSettings,
    type SeniorityRolesSettingsPayload,
} from "@/server/actions/seniority-roles-actions";
import {
    DEFAULT_SENIORITY_ANNOUNCEMENT,
    SENIORITY_ANNOUNCEMENT_VARIABLES,
    SENIORITY_ROLES_MAX_DAYS,
    SENIORITY_ROLES_MIN_DAYS,
    SENIORITY_UPCOMING_WINDOW_DAYS,
    buildSeniorityAnnouncementValues,
    renderSeniorityAnnouncement,
    type SeniorityThumbnailSource,
} from "@/lib/seniority-roles";
import { buildDiscordAvatarUrl, getDefaultDiscordAvatar } from "@/lib/discord-avatars";
import { formatSeniority } from "@/lib/ladder-utils";

/** Valeurs de démonstration de l'aperçu : aucun membre réel, aucune donnée de guilde inventée. */
const SAMPLE_DISCORD_ID = "123456789012345678";
const SAMPLE_DISPLAY_NAME = "Pseudo du membre";
const SAMPLE_SENIORITY_DAYS = 200;

const THUMBNAIL_LABELS: Record<SeniorityThumbnailSource, string> = {
    avatar: "PP Discord du membre",
    guild: "Icône de la guilde",
    none: "Aucune",
};

interface TierDraft {
    days: string;
    roleIds: string[];
}

interface Draft {
    enabled: boolean;
    tiers: TierDraft[];
    messageTemplate: string;
    embedTitle: string;
    embedDescription: string;
    /** Couleur `#rrggbb` : l'action serveur attend un entier (converti à l'enregistrement). */
    color: string;
    thumbnail: SeniorityThumbnailSource;
}

const hexFromColor = (value: number) => `#${value.toString(16).padStart(6, "0")}`;

const colorFromHex = (value: string) => {
    const parsed = Number.parseInt(value.replace("#", ""), 16);
    return Number.isFinite(parsed) && parsed >= 0 && parsed <= 0xffffff
        ? parsed
        : DEFAULT_SENIORITY_ANNOUNCEMENT.color;
};

const draftFrom = (data: SeniorityRolesSettingsPayload): Draft => ({
    enabled: data.enabled,
    tiers: data.tiers.map((tier) => ({ days: String(tier.days), roleIds: [...tier.roleIds] })),
    messageTemplate: data.announcement.messageTemplate,
    embedTitle: data.announcement.embedTitle,
    embedDescription: data.announcement.embedDescription,
    color: hexFromColor(data.announcement.color),
    thumbnail: data.announcement.thumbnail,
});

/** Vue comparable pour le garde « modifications non enregistrées » : l'ordre des rôles ne compte pas. */
const comparable = (draft: Draft) => ({
    ...draft,
    tiers: draft.tiers.map((tier) => ({ days: tier.days.trim(), roleIds: [...tier.roleIds].sort() })),
});

const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "numeric" }) : "jamais";

const formatDateTime = (iso: string | null) =>
    iso
        ? new Date(iso).toLocaleString("fr-FR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
          })
        : "jamais";

/** Rôle Discord tel que `getDiscordRolesAction` le renvoie (couleur = entier, 0 = « sans couleur »). */
interface DiscordRoleOption {
    id: string;
    name: string;
    color: number;
}

/** Couleur Discord → couleur CSS, ou `null` quand le rôle n'a pas de couleur (0). */
const roleColorToCss = (color: number): string | null =>
    color > 0 ? `#${color.toString(16).padStart(6, "0")}` : null;

/**
 * Choix multiple de rôles d'un palier (recherche incluse).
 *
 * Volontairement local : le sélecteur partagé de la maison (`PingRolesSelector`) est un
 * outil de **whitelist de ping** (« Liste blanche ») — le libellé serait faux ici, et un
 * écran qui nomme mal ce qu'il configure est exactement ce qu'on corrige ailleurs.
 */
function TierRolesSelector({
    value,
    onChange,
    roles,
}: {
    value: string[];
    onChange: (next: string[]) => void;
    roles: DiscordRoleOption[];
}) {
    const [open, setOpen] = useState(false);
    const selected = roles.filter((role) => value.includes(role.id));

    const toggle = (roleId: string) =>
        onChange(value.includes(roleId) ? value.filter((id) => id !== roleId) : [...value, roleId]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className="h-auto min-h-11 w-full justify-between gap-2 py-2 text-left font-normal"
                >
                    <span className="flex flex-wrap items-center gap-1.5">
                        {selected.length === 0 ? (
                            <span className="text-muted-foreground">Choisir les rôles de ce palier…</span>
                        ) : (
                            selected.map((role) => {
                                const cssColor = roleColorToCss(role.color);
                                return (
                                    <Badge key={role.id} variant="secondary" className="gap-1.5 font-normal">
                                        <span
                                            className="h-2 w-2 shrink-0 rounded-full bg-muted-foreground"
                                            style={cssColor ? { backgroundColor: cssColor } : undefined}
                                        />
                                        {role.name}
                                    </Badge>
                                );
                            })
                        )}
                    </span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[320px] p-0" align="start">
                <Command>
                    <CommandInput placeholder="Rechercher un rôle…" />
                    <CommandList>
                        <CommandEmpty>Aucun rôle trouvé.</CommandEmpty>
                        <CommandGroup>
                            {roles.map((role) => (
                                <CommandItem key={role.id} value={role.name} onSelect={() => toggle(role.id)}>
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value.includes(role.id) ? "opacity-100" : "opacity-0",
                                        )}
                                    />
                                    {role.name}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    );
}

export function SeniorityRolesPanel({ guildId }: { guildId: string }) {
    const [data, setData] = useState<SeniorityRolesSettingsPayload | null>(null);
    const [draft, setDraft] = useState<Draft | null>(null);
    const [initial, setInitial] = useState<Draft | null>(null);
    const [roles, setRoles] = useState<DiscordRoleOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    const load = useCallback(async () => {
        const [settings, rolesRes] = await Promise.all([
            getSeniorityRolesSettings(guildId),
            getDiscordRolesAction(guildId, { ignoreWhitelist: true }).catch(() => ({
                success: false as const,
                roles: [] as DiscordRoleOption[],
            })),
        ]);

        if (settings.success && settings.data) {
            setData(settings.data);
            const next = draftFrom(settings.data);
            setDraft(next);
            setInitial(next);
        } else if (!settings.success) {
            toast.error(settings.error || "Réglages illisibles");
        }

        if (rolesRes.success) {
            // `@everyone` n'est jamais un rôle de palier (il est porté par tout le monde).
            setRoles((rolesRes.roles ?? []).filter((role) => role.name !== "@everyone"));
        }

        setIsLoading(false);
    }, [guildId]);

    useEffect(() => {
        load();
    }, [load]);

    const hasUnsavedChanges = draft && initial ? isDirty(comparable(draft), comparable(initial)) : false;

    const patch = (changes: Partial<Draft>) => setDraft((current) => (current ? { ...current, ...changes } : current));

    const patchTier = (index: number, changes: Partial<TierDraft>) =>
        setDraft((current) =>
            current
                ? {
                      ...current,
                      tiers: current.tiers.map((tier, i) => (i === index ? { ...tier, ...changes } : tier)),
                  }
                : current,
        );

    const addTier = () =>
        setDraft((current) =>
            current ? { ...current, tiers: [...current.tiers, { days: "", roleIds: [] }] } : current,
        );

    const removeTier = (index: number) =>
        setDraft((current) =>
            current ? { ...current, tiers: current.tiers.filter((_, i) => i !== index) } : current,
        );

    const handleSave = () => {
        if (!draft) return;
        startTransition(async () => {
            // Un palier sans seuil valide ou sans rôle est ignoré : la règle pure ferait le
            // même tri, autant ne pas l'envoyer.
            const tiers = draft.tiers
                .map((tier) => ({ days: Number.parseInt(tier.days, 10), roleIds: tier.roleIds }))
                .filter(
                    (tier) =>
                        Number.isInteger(tier.days) &&
                        tier.days >= SENIORITY_ROLES_MIN_DAYS &&
                        tier.days <= SENIORITY_ROLES_MAX_DAYS &&
                        tier.roleIds.length > 0,
                );

            const result = await updateSeniorityRolesSettings(guildId, {
                enabled: draft.enabled,
                tiers,
                announcement: {
                    messageTemplate: draft.messageTemplate.trim() || DEFAULT_SENIORITY_ANNOUNCEMENT.messageTemplate,
                    embedTitle: draft.embedTitle.trim() || DEFAULT_SENIORITY_ANNOUNCEMENT.embedTitle,
                    embedDescription:
                        draft.embedDescription.trim() || DEFAULT_SENIORITY_ANNOUNCEMENT.embedDescription,
                    color: colorFromHex(draft.color),
                    thumbnail: draft.thumbnail,
                },
            });

            if (result.success) {
                toast.success("Rôles d'ancienneté : configuration enregistrée");
                setIsLoading(true);
                await load(); // l'état (répartition, marqueur d'activation) se relit sur le serveur
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    // Aperçu : **le même rendu pur** que l'envoi (valeurs de démonstration, jamais un vrai membre).
    const previewValues = draft
        ? buildSeniorityAnnouncementValues({
              member: { discordId: SAMPLE_DISCORD_ID, displayName: SAMPLE_DISPLAY_NAME },
              guildName: data?.guildName ?? "La guilde",
              seniorityDays: SAMPLE_SENIORITY_DAYS,
              awardedRoleIds: draft.tiers[0]?.roleIds ?? [],
          })
        : null;

    const preview =
        draft && previewValues
            ? renderSeniorityAnnouncement({
                  announcement: {
                      messageTemplate: draft.messageTemplate,
                      embedTitle: draft.embedTitle,
                      embedDescription: draft.embedDescription,
                      color: colorFromHex(draft.color),
                      thumbnail: draft.thumbnail,
                  },
                  values: previewValues,
              })
            : null;

    const previewThumbnail =
        draft?.thumbnail === "guild"
            ? (data?.guildIconUrl ?? undefined)
            : draft?.thumbnail === "none"
              ? undefined
              : (buildDiscordAvatarUrl(SAMPLE_DISCORD_ID, null, 256) ??
                getDefaultDiscordAvatar(SAMPLE_DISCORD_ID) ??
                undefined);

    return (
        <Card>
            <UnsavedChangesGuard hasUnsavedChanges={hasUnsavedChanges} />
            <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4 text-info" />
                    Rôles automatiques par ancienneté
                </CardTitle>
                <CardDescription>
                    Un palier = un seuil en jours et les rôles Discord à porter. Le robot passe une fois par jour :
                    il pose les rôles des paliers atteints, retire ceux d&apos;un palier perdu, et fête chaque
                    franchissement <strong>à venir</strong> dans le salon ci-dessous.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                {isLoading || !draft || !preview ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Chargement…
                    </div>
                ) : (
                    <>
                        {/* ── Activation et salon ───────────────────────────────── */}
                        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-surface p-4">
                            <div className="space-y-1">
                                <Label htmlFor="seniority-enabled" className="text-sm font-medium">
                                    Activer les rôles par ancienneté
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Éteint par défaut : aucune guilde ne reçoit de rôles à son insu.
                                </p>
                            </div>
                            <Switch
                                id="seniority-enabled"
                                checked={draft.enabled}
                                onCheckedChange={(checked) => patch({ enabled: checked })}
                            />
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                Salon de l&apos;annonce
                            </Label>
                            <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                                <span>
                                    {data?.channelId
                                        ? "Un salon est réglé pour les annonces de palier."
                                        : "Aucune annonce (les rôles sont posés en silence)."}
                                </span>
                                {/* Le salon vit dans Paramètres, comme tous les autres salons du dépôt. */}
                                <Link
                                    href={`/dashboard/${guildId}/admin/settings?tab=anciennete`}
                                    className="inline-flex items-center gap-1 text-info hover:underline"
                                >
                                    Paramètres → Ancienneté
                                    <ExternalLink className="h-3.5 w-3.5" />
                                </Link>
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Les rôles sont posés même sans salon : l&apos;annonce est la seule chose qui en dépend.
                            </p>
                        </div>

                        {/* ── Paliers ──────────────────────────────────────────── */}
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                        Paliers
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Cumulatifs : un membre porte les rôles de tous les paliers atteints.
                                    </p>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={addTier} className="gap-1.5">
                                    <Plus className="h-3.5 w-3.5" />
                                    Ajouter un palier
                                </Button>
                            </div>

                            {draft.tiers.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                                    Aucun palier pour l&apos;instant : sans palier, le robot ne fait rien.
                                </p>
                            ) : (
                                draft.tiers.map((tier, index) => (
                                    <div
                                        key={index}
                                        className="space-y-3 rounded-xl border border-border bg-surface p-4"
                                    >
                                        <div className="flex flex-wrap items-end gap-3">
                                            <div className="w-32 space-y-1.5">
                                                <Label
                                                    htmlFor={`tier-days-${index}`}
                                                    className="text-xs text-muted-foreground"
                                                >
                                                    Seuil (jours)
                                                </Label>
                                                <Input
                                                    id={`tier-days-${index}`}
                                                    value={tier.days}
                                                    inputMode="numeric"
                                                    placeholder="30"
                                                    onChange={(event) =>
                                                        patchTier(index, { days: event.target.value })
                                                    }
                                                />
                                            </div>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => removeTier(index)}
                                                className="mb-1 ml-auto gap-1.5 text-danger"
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                                Supprimer
                                            </Button>
                                        </div>
                                        <TierRolesSelector
                                            value={tier.roleIds}
                                            onChange={(value) => patchTier(index, { roleIds: value })}
                                            roles={roles}
                                        />
                                    </div>
                                ))
                            )}
                        </div>

                        {/* ── Message de félicitation (personnalisable) ─────────── */}
                        <div className="space-y-4">
                            <div>
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                    Message de félicitation
                                </Label>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Variables disponibles :{" "}
                                    {SENIORITY_ANNOUNCEMENT_VARIABLES.map((variable) => (
                                        <code
                                            key={variable}
                                            className="mr-1 rounded bg-elevated px-1 py-0.5 text-caption text-foreground"
                                        >
                                            {`{${variable}}`}
                                        </code>
                                    ))}
                                </p>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="seniority-message">
                                    Ligne de message (c&apos;est elle qui notifie)
                                </Label>
                                <Input
                                    id="seniority-message"
                                    value={draft.messageTemplate}
                                    onChange={(event) => patch({ messageTemplate: event.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="seniority-title">Titre de l&apos;embed</Label>
                                <Input
                                    id="seniority-title"
                                    value={draft.embedTitle}
                                    onChange={(event) => patch({ embedTitle: event.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="seniority-description">Description de l&apos;embed</Label>
                                <Textarea
                                    id="seniority-description"
                                    value={draft.embedDescription}
                                    rows={4}
                                    onChange={(event) => patch({ embedDescription: event.target.value })}
                                />
                            </div>

                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-2">
                                    <Label htmlFor="seniority-color">Couleur de l&apos;embed</Label>
                                    <div className="flex items-center gap-3">
                                        <input
                                            id="seniority-color"
                                            type="color"
                                            value={draft.color}
                                            onChange={(event) => patch({ color: event.target.value })}
                                            className="h-11 w-16 cursor-pointer rounded-lg border border-border bg-surface"
                                        />
                                        <Input
                                            value={draft.color}
                                            onChange={(event) => patch({ color: event.target.value })}
                                            className="w-32 font-mono"
                                            aria-label="Code couleur hexadécimal"
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label>Miniature</Label>
                                    <Select
                                        value={draft.thumbnail}
                                        onValueChange={(value) =>
                                            patch({ thumbnail: value as SeniorityThumbnailSource })
                                        }
                                    >
                                        <SelectTrigger className="h-11">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {(Object.keys(THUMBNAIL_LABELS) as SeniorityThumbnailSource[]).map(
                                                (source) => (
                                                    <SelectItem key={source} value={source}>
                                                        {THUMBNAIL_LABELS[source]}
                                                    </SelectItem>
                                                ),
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label>Aperçu</Label>
                                <DiscordEmbedPreview
                                    title={preview.embedTitle}
                                    description={preview.embedDescription}
                                    color={preview.color}
                                    thumbnail={previewThumbnail}
                                    mentionContent={preview.content}
                                />
                            </div>
                        </div>

                        {/* ── Prochains paliers (informatif, staff) ─────────────── */}
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                        Prochains paliers
                                    </Label>
                                    <p className="text-xs text-muted-foreground">
                                        Qui change de rôle dans les {SENIORITY_UPCOMING_WINDOW_DAYS} prochains jours —
                                        informatif, rien n&apos;est déclenché ici.
                                    </p>
                                </div>
                                <Badge variant="secondary" className="font-normal">
                                    {data?.upcomingTotal ?? 0}
                                </Badge>
                            </div>

                            {!data || data.upcoming.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                                    Personne ne franchit de palier dans les {SENIORITY_UPCOMING_WINDOW_DAYS} prochains
                                    jours.
                                </p>
                            ) : (
                                <>
                                    {/* Desktop : tableau sobre */}
                                    <div className="hidden overflow-hidden rounded-xl border border-border md:block">
                                        <table className="w-full text-sm">
                                            <thead className="bg-surface text-xs uppercase tracking-wide text-muted-foreground">
                                                <tr>
                                                    <th className="px-3 py-2 text-left font-medium">Membre</th>
                                                    <th className="px-3 py-2 text-left font-medium">Ancienneté</th>
                                                    <th className="px-3 py-2 text-left font-medium">Palier visé</th>
                                                    <th className="px-3 py-2 text-right font-medium">Dans</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {data.upcoming.map((member) => (
                                                    <tr
                                                        key={`${member.displayName}-${member.tierDays}`}
                                                        className="border-t border-border"
                                                    >
                                                        <td className="px-3 py-2">
                                                            <span className="flex items-center gap-2">
                                                                <Avatar className="h-6 w-6">
                                                                    <AvatarImage src={member.avatarUrl ?? undefined} alt="" />
                                                                    <AvatarFallback>
                                                                        {member.displayName.slice(0, 1).toUpperCase()}
                                                                    </AvatarFallback>
                                                                </Avatar>
                                                                <span className="truncate">{member.displayName}</span>
                                                            </span>
                                                        </td>
                                                        <td className="px-3 py-2 text-muted-foreground">
                                                            {formatSeniority(member.seniorityDays)}
                                                        </td>
                                                        <td className="px-3 py-2 text-muted-foreground">
                                                            {member.tierDays} jours
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-medium text-foreground">
                                                            {member.daysUntil === 0 ? "aujourd'hui" : `${member.daysUntil} j`}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                    {/* Mobile : cartes */}
                                    <div className="space-y-2 md:hidden">
                                        {data.upcoming.map((member) => (
                                            <div
                                                key={`${member.displayName}-${member.tierDays}`}
                                                className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3"
                                            >
                                                <Avatar className="h-8 w-8">
                                                    <AvatarImage src={member.avatarUrl ?? undefined} alt="" />
                                                    <AvatarFallback>
                                                        {member.displayName.slice(0, 1).toUpperCase()}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className="min-w-0 flex-1">
                                                    <p className="truncate text-sm text-foreground">
                                                        {member.displayName}
                                                    </p>
                                                    <p className="text-xs text-muted-foreground">
                                                        palier {member.tierDays} j ·{" "}
                                                        {member.daysUntil === 0
                                                            ? "aujourd'hui"
                                                            : `dans ${member.daysUntil} j`}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    {data.upcomingTotal > data.upcoming.length && (
                                        <p className="text-xs text-muted-foreground">
                                            {data.upcoming.length} affichés sur {data.upcomingTotal} (les plus proches
                                            d&apos;abord).
                                        </p>
                                    )}
                                </>
                            )}
                        </div>

                        {/* ── État réel (lu, jamais recalculé ici) ─────────────── */}
                        <div className="space-y-2 rounded-xl border border-border bg-surface p-4">
                            <Label className="text-xs uppercase tracking-wide text-muted-foreground">État</Label>
                            {data && data.tiers.length > 0 ? (
                                <ul className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2">
                                    {data.tiers.map((tier, index) => (
                                        <li key={tier.days}>
                                            <span className="font-medium text-foreground">{tier.days} jours</span> —{" "}
                                            {data.tierCounts[index]} membre(s)
                                        </li>
                                    ))}
                                    <li>{data.belowFirstTier} membre(s) sous le premier palier</li>
                                </ul>
                            ) : (
                                <p className="text-xs text-muted-foreground">
                                    Aucun palier enregistré : rien à répartir pour l&apos;instant.
                                </p>
                            )}
                            <p className="text-xs text-muted-foreground">
                                Annonces envoyées :{" "}
                                <span className="text-foreground">{data?.announcements.total ?? 0}</span>
                                {" · "}dernière :{" "}
                                <span className="text-foreground">
                                    {formatDate(data?.announcements.lastAt ?? null)}
                                </span>
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Robot :{" "}
                                {data?.lastRun?.at
                                    ? formatDateTime(data.lastRun.at)
                                    : "pas encore passé (la ligne de crontab est-elle posée ?)"}
                                {data?.lastRun?.summary ? ` — ${data.lastRun.summary}` : ""}
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Activation :{" "}
                                <span className="text-foreground">{formatDate(data?.activatedAt ?? null)}</span> — les
                                paliers franchis <strong>avant</strong> cette date sont posés en silence (aucune
                                annonce rétroactive).
                            </p>
                        </div>

                        <div className="flex justify-end">
                            <Button
                                type="button"
                                onClick={handleSave}
                                disabled={isPending || !hasUnsavedChanges}
                                className="gap-2"
                            >
                                {isPending ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                Enregistrer
                            </Button>
                        </div>
                    </>
                )}
            </CardContent>
        </Card>
    );
}