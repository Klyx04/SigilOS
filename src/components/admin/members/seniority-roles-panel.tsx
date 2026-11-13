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

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Check, ChevronLeft, ChevronRight, ChevronsUpDown, Clock, ExternalLink, Hash, Loader2, Megaphone, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn, getAppBaseUrl } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";
import { DiscordEmbedPreview } from "@/components/discord/DiscordEmbedPreview";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import { getDiscordChannelInfo } from "@/server/actions/discord-actions";
import {
    getSeniorityRolesSettings,
    syncSeniorityRolesNow,
    updateSeniorityRolesSettings,
    type SeniorityRolesSettingsPayload,
} from "@/server/actions/seniority-roles-actions";
import {
    DEFAULT_SENIORITY_ANNOUNCEMENT,
    SENIORITY_ANNOUNCEMENT_EXTRA_VARIABLES,
    SENIORITY_ANNOUNCEMENT_VARIABLES,
    SENIORITY_MAX_RETRO_ANNOUNCEMENTS_PER_PASS,
    SENIORITY_ROLES_MAX_DAYS,
    SENIORITY_ROLES_MIN_DAYS,
    SENIORITY_UPCOMING_WINDOW_DAYS,
    buildSeniorityAnnouncementValues,
    buildSeniorityNotRegisteredField,
    renderSeniorityAnnouncement,
    resolveTierAnnouncement,
    type SeniorityThumbnailSource,
} from "@/lib/seniority-roles";
import { buildDiscordAvatarUrl, getDefaultDiscordAvatar } from "@/lib/discord-avatars";
import { formatSeniority } from "@/lib/ladder-utils";

/** Valeurs de démonstration de l'aperçu : aucun membre réel, aucune donnée de guilde inventée. */
const SAMPLE_DISCORD_ID = "123456789012345678";
const SAMPLE_DISPLAY_NAME = "Pseudo du membre";
const SAMPLE_SENIORITY_DAYS = 200;

/**
 * Sous-onglets de l'écran — l'onglet était un **seul scroll de plus de 1 000 px**
 * (activation, filtres, paliers, message, aperçu, état, passes). Chaque sujet a
 * désormais sa vue, et « État & passes » garde les informations de diagnostic.
 */
type SeniorityTab =
    | "activation"
    | "eligibilite"
    | "paliers"
    | "paliers-detail"
    | "message"
    | "prochains"
    | "etat";

/** Prochains paliers : 10 lignes par page (paginé, jamais tronqué en silence). */
const UPCOMING_PAGE_SIZE = 10;

const THUMBNAIL_LABELS: Record<SeniorityThumbnailSource, string> = {
    avatar: "PP Discord du membre",
    guild: "Icône de la guilde",
    none: "Aucune",
};

/** Texte propre à un palier dans le brouillon : **vide = hérite** du message global. */
interface TierAnnouncementDraft {
    messageTemplate: string;
    embedTitle: string;
    embedDescription: string;
}

interface TierDraft {
    days: string;
    roleIds: string[];
    announcement: TierAnnouncementDraft;
}

const emptyTierAnnouncement = (): TierAnnouncementDraft => ({
    messageTemplate: "",
    embedTitle: "",
    embedDescription: "",
});

/** Ce qui partira au serveur pour un palier : ses champs non vides, ou `undefined` (héritage). */
const compactTierAnnouncement = (draft: TierAnnouncementDraft) => {
    const out: { messageTemplate?: string; embedTitle?: string; embedDescription?: string } = {};
    if (draft.messageTemplate.trim()) out.messageTemplate = draft.messageTemplate.trim();
    if (draft.embedTitle.trim()) out.embedTitle = draft.embedTitle.trim();
    if (draft.embedDescription.trim()) out.embedDescription = draft.embedDescription.trim();
    return Object.keys(out).length > 0 ? out : undefined;
};

interface Draft {
    enabled: boolean;
    tiers: TierDraft[];
    messageTemplate: string;
    embedTitle: string;
    embedDescription: string;
    /** Couleur `#rrggbb` : l'action serveur attend un entier (converti à l'enregistrement). */
    color: string;
    thumbnail: SeniorityThumbnailSource;
    allowedRoleIds: string[];
    excludedRoleIds: string[];
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
    tiers: data.tiers.map((tier) => ({
        days: String(tier.days),
        roleIds: [...tier.roleIds],
        announcement: {
            messageTemplate: tier.announcement?.messageTemplate ?? "",
            embedTitle: tier.announcement?.embedTitle ?? "",
            embedDescription: tier.announcement?.embedDescription ?? "",
        },
    })),
    messageTemplate: data.announcement.messageTemplate,
    embedTitle: data.announcement.embedTitle,
    embedDescription: data.announcement.embedDescription,
    color: hexFromColor(data.announcement.color),
    thumbnail: data.announcement.thumbnail,
    allowedRoleIds: [...(data.allowedRoleIds ?? [])],
    excludedRoleIds: [...(data.excludedRoleIds ?? [])],
});

/** Vue comparable pour le garde « modifications non enregistrées » : l'ordre des rôles ne compte pas. */
const comparable = (draft: Draft) => ({
    ...draft,
    tiers: draft.tiers.map((tier) => ({
        days: tier.days.trim(),
        roleIds: [...tier.roleIds].sort(),
        // On compare **ce qui partira** : un champ vidé n'est pas une surcharge.
        announcement: compactTierAnnouncement(tier.announcement),
    })),
    allowedRoleIds: [...draft.allowedRoleIds].sort(),
    excludedRoleIds: [...draft.excludedRoleIds].sort(),
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
    placeholder = "Choisir les rôles de ce palier…",
}: {
    value: string[];
    onChange: (next: string[]) => void;
    roles: DiscordRoleOption[];
    placeholder?: string;
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
                            <span className="text-muted-foreground">{placeholder}</span>
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
    /** Palier relu dans l'aperçu (`null` = message global). */
    const [previewTierIndex, setPreviewTierIndex] = useState<number | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    /** Passe à la demande : le bilan complet, affiché sous les boutons (jamais un simple toast). */
    const [isSyncing, setIsSyncing] = useState(false);
    const [syncReport, setSyncReport] = useState<string[] | null>(null);
    /** Sous-onglet actif (l'écran ne se lit plus d'un seul trait). */
    const [tab, setTab] = useState<SeniorityTab>("activation");
    /** Nom du salon d'annonce (aperçu de destination) — `null` tant qu'il n'est pas résolu. */
    const [channelName, setChannelName] = useState<string | null>(null);
    /** Pagination des prochains paliers. */
    const [upcomingPage, setUpcomingPage] = useState(0);

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
            // Aperçu du salon d'annonce : nom lisible plutôt qu'un identifiant.
            if (settings.data.channelId) {
                getDiscordChannelInfo(guildId, settings.data.channelId)
                    .then((res) => setChannelName(res.success && res.data ? res.data.name ?? null : null))
                    .catch(() => setChannelName(null));
            } else {
                setChannelName(null);
            }
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
            current
                ? {
                      ...current,
                      tiers: [
                          ...current.tiers,
                          { days: "", roleIds: [], announcement: emptyTierAnnouncement() },
                      ],
                  }
                : current,
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
                .map((tier) => ({
                    days: Number.parseInt(tier.days, 10),
                    roleIds: tier.roleIds,
                    // Le texte du palier, s'il en a un : sinon il hérite du message global.
                    announcement: compactTierAnnouncement(tier.announcement),
                }))
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
                allowedRoleIds: draft.allowedRoleIds,
                excludedRoleIds: draft.excludedRoleIds,
            });

            if (result.success) {
                // 🔎 Une variable inconnue (ex. `{rôles}` accentué) reste affichée telle quelle dans
                // l'embed : on le dit ici, au moment où l'administrateur peut encore corriger.
                for (const warning of result.warnings) {
                    toast.warning(warning, { duration: 10_000 });
                }
                toast.success("Rôles d'ancienneté : configuration enregistrée");
                setIsLoading(true);
                await load(); // l'état (répartition, marqueur d'activation) se relit sur le serveur
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    };

    /**
     * Passe **à la demande**. Le bilan s'affiche sous les boutons : un toast ne dit ni combien
     * de membres ont été lus, ni pourquoi une guilde a été sautée (mesure du 18/10/2026).
     */
    const handleSync = async (announceRetroactive: boolean) => {
        setIsSyncing(true);
        setSyncReport(null);
        try {
            const result = await syncSeniorityRolesNow(guildId, { announceRetroactive });
            if (!result.success) {
                toast.error(result.error || "Synchronisation impossible");
                return;
            }
            const summary = result.summary;
            const lines = [
                `${summary.processed} guilde(s) traitée(s) · ${summary.skipped} sautée(s) · ${summary.errored} en erreur`,
                `${summary.membersChecked} membre(s) Discord — ${summary.membersUnregistered} sans profil`,
                `${summary.rolesAdded} rôle(s) posé(s) · ${summary.rolesRemoved} retiré(s) · ${summary.announcementsSent} carte(s)`,
            ];
            if (announceRetroactive || summary.retroactiveAnnouncementsSent > 0) {
                lines.push(
                    `${summary.retroactiveAnnouncementsSent} carte(s) de rattrapage · ${summary.retroactiveAnnouncementsPending} en attente (plafond ${SENIORITY_MAX_RETRO_ANNOUNCEMENTS_PER_PASS}/passe)`,
                );
            }
            setSyncReport([...lines, ...(result.details ?? [])]);
            toast.success("Passe terminée");
            setIsLoading(true);
            await load(); // répartition, annonces et dernière passe se relisent
        } catch {
            toast.error("Synchronisation impossible");
        } finally {
            setIsSyncing(false);
        }
    };

    // Aperçu : **le même rendu pur** que l'envoi (valeurs de démonstration, jamais un vrai membre).
    // Le palier choisi fait relire **son** texte et **ses** rôles : c'est ce qui partira pour ce seuil.
    const previewTier = draft && previewTierIndex !== null ? draft.tiers[previewTierIndex] ?? null : null;
    const previewValues = draft
        ? buildSeniorityAnnouncementValues({
              member: { discordId: SAMPLE_DISCORD_ID, displayName: SAMPLE_DISPLAY_NAME },
              guildName: data?.guildName ?? "La guilde",
              seniorityDays: SAMPLE_SENIORITY_DAYS,
              awardedRoleIds: (previewTier ?? draft.tiers[0])?.roleIds ?? [],
          })
        : null;

    // Lien **de l'environnement** (bêta ↔ prod) : partagé par l'aperçu et par l'envoi réel.
    const dashboardUrl = `${getAppBaseUrl()}/dashboard`;

    const preview =
        draft && previewValues
            ? renderSeniorityAnnouncement({
                  announcement: resolveTierAnnouncement({
                      announcement: {
                          messageTemplate: draft.messageTemplate,
                          embedTitle: draft.embedTitle,
                          embedDescription: draft.embedDescription,
                          color: colorFromHex(draft.color),
                          thumbnail: draft.thumbnail,
                      },
                      tier: {
                          announcement: previewTier ? compactTierAnnouncement(previewTier.announcement) : undefined,
                      },
                  }),
                  values: previewValues,
                  // `{lien}` : le lien **de l'environnement**, comme l'envoi réel.
                  extras: { lien: dashboardUrl },
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

    /** Paliers triés par seuil (un seuil vide passe en fin), avec leur index d'édition. */
    const sortedTiers = useMemo(() => {
        if (!draft) return [];
        return draft.tiers
            .map((tier, index) => ({ tier, index }))
            .sort((a, b) => {
                const left = Number.parseInt(a.tier.days, 10);
                const right = Number.parseInt(b.tier.days, 10);
                return (
                    (Number.isFinite(left) ? left : Number.MAX_SAFE_INTEGER) -
                    (Number.isFinite(right) ? right : Number.MAX_SAFE_INTEGER)
                );
            });
    }, [draft]);

    /** Nom lisible d'un rôle de palier (le payload ne transporte que des ids). */
    const roleNameById = useMemo(() => new Map(roles.map((role) => [role.id, role.name])), [roles]);

    /** Prochains paliers : pagination côté écran (10 par page), jamais de coupe silencieuse. */
    const upcoming = data?.upcoming ?? [];
    const upcomingPageCount = Math.max(1, Math.ceil(upcoming.length / UPCOMING_PAGE_SIZE));
    const safeUpcomingPage = Math.min(upcomingPage, upcomingPageCount - 1);
    const upcomingPageRows = upcoming.slice(
        safeUpcomingPage * UPCOMING_PAGE_SIZE,
        (safeUpcomingPage + 1) * UPCOMING_PAGE_SIZE
    );

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
                        <Tabs value={tab} onValueChange={(value) => setTab(value as SeniorityTab)} className="space-y-4">
                            <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 rounded-lg border border-border-strong bg-surface p-1">
                                <TabsTrigger value="activation" className="text-xs">Activation</TabsTrigger>
                                <TabsTrigger value="eligibilite" className="text-xs">Éligibilité</TabsTrigger>
                                <TabsTrigger value="paliers" className="text-xs">Paliers</TabsTrigger>
                                <TabsTrigger value="paliers-detail" className="text-xs">Détail des paliers</TabsTrigger>
                                <TabsTrigger value="message" className="text-xs">Message</TabsTrigger>
                                <TabsTrigger value="prochains" className="text-xs">Prochains paliers</TabsTrigger>
                                <TabsTrigger value="etat" className="text-xs">État &amp; passes</TabsTrigger>
                            </TabsList>

                        <TabsContent value="activation" className="space-y-4">
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
                            {data?.channelId ? (
                                <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-elevated/40 p-3">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-surface">
                                        <Hash className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                                    </span>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-medium text-foreground">
                                            #{channelName ?? "salon configuré"}
                                        </p>
                                        <p className="text-caption text-muted-foreground">
                                            Aperçu de destination : les annonces de palier partent ici.
                                        </p>
                                    </div>
                                    <Badge variant="outline" className="border-success/40 text-success">
                                        Configuré
                                    </Badge>
                                    <Link
                                        href={`https://discord.com/channels/${guildId}/${data.channelId}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                                    >
                                        Ouvrir dans Discord
                                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Link>
                                </div>
                            ) : (
                                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-3">
                                    <span className="text-sm text-muted-foreground">
                                        Aucune annonce : les rôles sont posés en silence.
                                    </span>
                                    <Link
                                        href={`/dashboard/${guildId}/admin/settings?tab=anciennete`}
                                        className="inline-flex items-center gap-1 text-xs font-medium text-accent hover:underline"
                                    >
                                        Configurer le salon
                                        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                                    </Link>
                                </div>
                            )}
                            <p className="text-xs text-muted-foreground">
                                Les rôles sont posés même sans salon : seule l&apos;annonce en dépend.
                            </p>
                        </div>

                        </TabsContent>

                        <TabsContent value="eligibilite" className="space-y-4">
                        {/* ── Filtre de rôles (Éligibilité) ─────────────────────────── */}
                        <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
                            <div>
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                    Éligibilité des membres (Filtres de rôles)
                                </Label>
                                <p className="mt-0.5 text-xs text-muted-foreground">
                                    Définis quels membres sur Discord peuvent recevoir des rôles via le robot d&apos;ancienneté.
                                </p>
                            </div>

                            {/* Rôles autorisés (Whitelist) */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">
                                    Rôles autorisés (Whitelist)
                                </Label>
                                <TierRolesSelector
                                    value={draft.allowedRoleIds}
                                    onChange={(value) => patch({ allowedRoleIds: value })}
                                    roles={roles}
                                    placeholder="Tous les membres sont autorisés (aucun filtre)…"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Si spécifié, seuls les membres ayant au moins l&apos;un de ces rôles reçoivent des rôles d&apos;ancienneté. Laisser vide pour inclure tout le monde.
                                </p>
                            </div>

                            {/* Rôles exclus (Blacklist) */}
                            <div className="space-y-1.5">
                                <Label className="text-xs font-medium">
                                    Rôles exclus / Blacklistés
                                </Label>
                                <TierRolesSelector
                                    value={draft.excludedRoleIds}
                                    onChange={(value) => patch({ excludedRoleIds: value })}
                                    roles={roles}
                                    placeholder="Aucun rôle exclu…"
                                />
                                <p className="text-[11px] text-muted-foreground">
                                    Les membres portant l&apos;un de ces rôles ne recevront jamais de rôles d&apos;ancienneté (ex: bots, invités, rôles spéciaux). Prioritaire sur la liste blanche.
                                </p>
                            </div>
                        </div>

                        </TabsContent>

                        <TabsContent value="paliers" className="space-y-4">
                        <div className="space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">Paliers</Label>
                                    <p className="text-xs text-muted-foreground">
                                        Ajoute un seuil, puis règle ses rôles et son texte dans « Détail des paliers ».
                                    </p>
                                </div>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                        addTier();
                                        setTab("paliers-detail");
                                    }}
                                    className="gap-1.5"
                                >
                                    <Plus className="h-3.5 w-3.5" />
                                    Ajouter un palier
                                </Button>
                            </div>

                            {sortedTiers.length === 0 ? (
                                <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                                    Aucun palier pour l’instant : sans palier, le robot ne fait rien.
                                </p>
                            ) : (
                                <ul className="space-y-2">
                                    {sortedTiers.map(({ tier, index }) => (
                                        <li
                                            key={index}
                                            className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface p-3"
                                        >
                                            <Badge variant="secondary" className="tabular-nums">
                                                {tier.days || "—"} jours
                                            </Badge>
                                            <span className="min-w-0 truncate text-xs text-muted-foreground">
                                                {tier.roleIds.length === 0
                                                    ? "Aucun rôle"
                                                    : tier.roleIds.map((roleId) => roleNameById.get(roleId) ?? "Rôle supprimé").join(", ")}
                                            </span>
                                            <span className="text-xs text-muted-foreground">
                                                {compactTierAnnouncement(tier.announcement) ? "texte personnalisé" : "hérite du message global"}
                                            </span>
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                className="ml-auto"
                                                onClick={() => setTab("paliers-detail")}
                                            >
                                                Modifier
                                            </Button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        </TabsContent>

                        <TabsContent value="paliers-detail" className="space-y-4">
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
                                sortedTiers.map(({ tier, index }) => (
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

                                        {/* Texte **propre au palier** (facultatif) : replié par défaut,
                                            un champ vide reprend le message global. */}
                                        <details className="rounded-lg border border-border/60 px-3 py-2">
                                            <summary className="cursor-pointer text-xs text-muted-foreground">
                                                Texte de ce palier —{" "}
                                                {compactTierAnnouncement(tier.announcement)
                                                    ? "personnalisé"
                                                    : "hérite du message global"}
                                            </summary>
                                            <div className="mt-3 space-y-3">
                                                <div className="space-y-2">
                                                    <Label
                                                        htmlFor={`tier-message-${index}`}
                                                        className="text-xs text-muted-foreground"
                                                    >
                                                        Ligne de message
                                                    </Label>
                                                    <Input
                                                        id={`tier-message-${index}`}
                                                        value={tier.announcement.messageTemplate}
                                                        placeholder={draft.messageTemplate}
                                                        onChange={(event) =>
                                                            patchTier(index, {
                                                                announcement: {
                                                                    ...tier.announcement,
                                                                    messageTemplate: event.target.value,
                                                                },
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label
                                                        htmlFor={`tier-title-${index}`}
                                                        className="text-xs text-muted-foreground"
                                                    >
                                                        Titre de l&apos;embed
                                                    </Label>
                                                    <Input
                                                        id={`tier-title-${index}`}
                                                        value={tier.announcement.embedTitle}
                                                        placeholder={draft.embedTitle}
                                                        onChange={(event) =>
                                                            patchTier(index, {
                                                                announcement: {
                                                                    ...tier.announcement,
                                                                    embedTitle: event.target.value,
                                                                },
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <Label
                                                        htmlFor={`tier-description-${index}`}
                                                        className="text-xs text-muted-foreground"
                                                    >
                                                        Description de l&apos;embed
                                                    </Label>
                                                    <Textarea
                                                        id={`tier-description-${index}`}
                                                        value={tier.announcement.embedDescription}
                                                        placeholder={draft.embedDescription}
                                                        rows={3}
                                                        onChange={(event) =>
                                                            patchTier(index, {
                                                                announcement: {
                                                                    ...tier.announcement,
                                                                    embedDescription: event.target.value,
                                                                },
                                                            })
                                                        }
                                                    />
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Un champ laissé vide reprend le message global. La couleur et la
                                                    miniature restent communes à tous les paliers.
                                                </p>
                                            </div>
                                        </details>
                                    </div>
                                ))
                            )}
                        </div>

                        </TabsContent>

                        <TabsContent value="message" className="space-y-4">
                        {/* ── Message de félicitation (personnalisable) ─────────── */}
                        <div className="space-y-4">
                            <div>
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                    Message de félicitation
                                </Label>
                                <p className="mt-1 text-xs text-muted-foreground">
                                    Variables disponibles :{" "}
                                    {[
                                        ...SENIORITY_ANNOUNCEMENT_VARIABLES,
                                        ...SENIORITY_ANNOUNCEMENT_EXTRA_VARIABLES,
                                    ].map((variable) => (
                                        <code
                                            key={variable}
                                            className="mr-1 rounded bg-elevated px-1 py-0.5 text-caption text-foreground"
                                        >
                                            {`{${variable}}`}
                                        </code>
                                    ))}
                                    — les accents sont tolérés (<code className="font-mono">{"{rôles}"}</code> ={" "}
                                    <code className="font-mono">{"{roles}"}</code>), une variable inconnue est signalée
                                    à l&apos;enregistrement.
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
                                <div className="flex flex-wrap items-end justify-between gap-3">
                                    <Label>Aperçu</Label>
                                    {/* Relire le texte **par palier** : c&apos;est ce qui partira pour ce seuil. */}
                                    <div className="w-52">
                                        <Select
                                            value={previewTierIndex === null ? "global" : String(previewTierIndex)}
                                            onValueChange={(value) =>
                                                setPreviewTierIndex(
                                                    value === "global" ? null : Number.parseInt(value, 10),
                                                )
                                            }
                                        >
                                            <SelectTrigger
                                                className="h-9"
                                                aria-label="Palier relu dans l'aperçu"
                                            >
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="global">Message global</SelectItem>
                                                {draft?.tiers.map((tier, index) => (
                                                    <SelectItem key={index} value={String(index)}>
                                                        Palier {tier.days || "?"} j
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </div>
                                {/* Le champ « Pas encore inscrit ? » n'est ajouté qu'aux membres
                                    **sans profil** : il est montré ici pour que l'aperçu dise la
                                    vérité complète. */}
                                <DiscordEmbedPreview
                                    title={preview.embedTitle}
                                    description={preview.embedDescription}
                                    color={preview.color}
                                    thumbnail={previewThumbnail}
                                    mentionContent={preview.content}
                                    fields={[buildSeniorityNotRegisteredField(dashboardUrl)]}
                                />
                                <p className="mt-2 text-xs text-muted-foreground">
                                    Le champ « Pas encore inscrit ? » n&apos;est ajouté qu&apos;aux membres qui
                                    n&apos;ont pas encore de profil sur le dashboard. La variable{" "}
                                    <code className="font-mono">{"{lien}"}</code> pointe sur{" "}
                                    <code className="font-mono">{dashboardUrl}</code>.
                                </p>
                            </div>
                        </div>

                        </TabsContent>

                        <TabsContent value="prochains" className="space-y-4">
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
                                                    <th className="px-3 py-2 text-left font-medium">Rôle visé</th>
                                                    <th className="px-3 py-2 text-right font-medium">Dans</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {upcomingPageRows.map((member) => (
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
                                                        <td className="px-3 py-2 text-muted-foreground">
                                                            {member.tierRoleIds.length > 0
                                                                ? member.tierRoleIds
                                                                      .map((roleId) => roleNameById.get(roleId) ?? "Rôle supprimé")
                                                                      .join(", ")
                                                                : "—"}
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
                                        {upcomingPageRows.map((member) => (
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
                                                    <p className="truncate text-xs text-foreground">
                                                        {member.tierRoleIds.length > 0
                                                            ? member.tierRoleIds
                                                                  .map((roleId) => roleNameById.get(roleId) ?? "Rôle supprimé")
                                                                  .join(", ")
                                                            : "Rôle visé non défini"}
                                                    </p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                        <p className="text-caption text-muted-foreground">
                                            Page {safeUpcomingPage + 1} / {upcomingPageCount} · {upcoming.length} affiché
                                            {upcoming.length > 1 ? "s" : ""} sur {data.upcomingTotal} (les plus proches
                                            d&apos;abord)
                                        </p>
                                        {upcomingPageCount > 1 && (
                                            <div className="flex items-center gap-1">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1"
                                                    disabled={safeUpcomingPage === 0}
                                                    onClick={() => setUpcomingPage(Math.max(0, safeUpcomingPage - 1))}
                                                    aria-label="Page précédente des prochains paliers"
                                                >
                                                    <ChevronLeft className="h-3.5 w-3.5" aria-hidden="true" />
                                                    Précédent
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="sm"
                                                    className="gap-1"
                                                    disabled={safeUpcomingPage >= upcomingPageCount - 1}
                                                    onClick={() =>
                                                        setUpcomingPage(Math.min(upcomingPageCount - 1, safeUpcomingPage + 1))
                                                    }
                                                    aria-label="Page suivante des prochains paliers"
                                                >
                                                    Suivant
                                                    <ChevronRight className="h-3.5 w-3.5" aria-hidden="true" />
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </>
                            )}
                        </div>

                        </TabsContent>

                        <TabsContent value="etat" className="space-y-4">
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

                        {/* ── Passes à la demande (le cron reste la voie normale) ── */}
                        <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
                            <div>
                                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                                    Passes à la demande
                                </Label>
                                <p className="text-xs text-muted-foreground">
                                    Le robot passe une fois par jour. Ici, tu lances la même passe tout de
                                    suite, sur cette guilde seulement (une passe toutes les 5 minutes).
                                </p>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSync(false)}
                                    disabled={isSyncing || isPending}
                                    className="gap-2"
                                >
                                    {isSyncing ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <RefreshCw className="h-4 w-4" />
                                    )}
                                    Synchroniser maintenant
                                </Button>
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => handleSync(true)}
                                    disabled={isSyncing || isPending}
                                    className="gap-2"
                                >
                                    <Megaphone className="h-4 w-4" />
                                    Annoncer les paliers déjà atteints
                                </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Le rattrapage envoie au plus {SENIORITY_MAX_RETRO_ANNOUNCEMENTS_PER_PASS} cartes
                                par passe (une par membre, au palier le plus haut) : le reste part aux passes
                                suivantes, sans rien perdre.
                            </p>
                            {syncReport && (
                                <ul className="space-y-1 rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
                                    {syncReport.map((line, index) => (
                                        <li key={index}>{line}</li>
                                    ))}
                                </ul>
                            )}
                        </div>

                        </TabsContent>
                        </Tabs>

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