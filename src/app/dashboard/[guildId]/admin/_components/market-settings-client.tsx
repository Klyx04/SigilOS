"use client";

import { useEffect, useState, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { DiscordChannelPicker, DISCORD_FORUM_CHANNEL_TYPES } from "@/components/shared/DiscordChannelPicker";
import { ChannelPreview } from "@/components/shared/ChannelPreview";
import { PingRolesSelector } from "@/components/admin/ping-roles-selector";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";
import { getDiscordRolesAction } from "@/server/actions/user-actions";
import {
    getMarketSettings,
    updateMarketSettings,
    testMarketConfiguration,
    listMarketForumAvailableTags,
    type MarketForumTagOption,
} from "@/server/actions/market-admin-actions";
import { MARKET_SETTINGS_DEFAULTS } from "@/server/actions/market-constants";
import {
    MARKET_FORUM_TAG_KEYS,
    MARKET_FORUM_TAG_LABELS,
    type MarketForumTagMap,
} from "@/lib/market/forum-tags";
import { toast } from "sonner";
import { AlertTriangle, FlaskConical, Hash, Loader2, Save, ShieldCheck, Tags } from "lucide-react";

type Role = { id: string; name: string; color: string };

type MarketConfigSnapshot = {
    marketNotifyChannelId: string;
    marketNotifyRoleId: string | null;
    marketAllowedPingRoleIds: string[];
    marketModeratorRoleId: string | null;
    marketMinRoleId: string | null;
    marketMaxActivePerMember: number;
    marketDefaultDurationDays: number;
    marketMaxLifetimeDays: number;
    marketReminderDays: number[];
    marketReservationHours: number;
    marketOfferHours: number;
    marketNegotiationsEnabled: boolean;
    marketProofsEnabled: boolean;
    marketMediaRetentionDays: number;
    marketLogRetentionDays: number;
    /** D20 / S3.13 — mapping `type|statut → id de tag` (vide hors forum). */
    marketForumTags: MarketForumTagMap;
};

const EMPTY: MarketConfigSnapshot = {
    marketNotifyChannelId: "",
    marketNotifyRoleId: null,
    marketAllowedPingRoleIds: [],
    marketModeratorRoleId: null,
    marketMinRoleId: null,
    marketForumTags: {},
    ...MARKET_SETTINGS_DEFAULTS,
};

export function MarketSettingsClient({ guildId }: { guildId: string }) {
    const [config, setConfig] = useState<MarketConfigSnapshot>(EMPTY);
    const [initialConfig, setInitialConfig] = useState<MarketConfigSnapshot | null>(null);
    const [roles, setRoles] = useState<Role[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();
    const [isTesting, setIsTesting] = useState(false);
    const [channelKind, setChannelKind] = useState<string | null>(null);
    const [issues, setIssues] = useState<string[]>([]);
    /** D20 / S3.13 — tags **existants** du salon forum (sélecteurs). */
    const [forumTagOptions, setForumTagOptions] = useState<MarketForumTagOption[]>([]);
    const [forumTagsAvailable, setForumTagsAvailable] = useState(false);

    const hasUnsavedChanges = isDirty(config, initialConfig);

    useEffect(() => {
        async function load() {
            const [settingsRes, rolesRes, forumTagsRes] = await Promise.all([
                getMarketSettings(guildId),
                getDiscordRolesAction(guildId, { ignoreWhitelist: true }),
                listMarketForumAvailableTags(guildId),
            ]);

            if (settingsRes.success && settingsRes.data) {
                const loaded: MarketConfigSnapshot = {
                    ...EMPTY,
                    ...settingsRes.data,
                    marketNotifyChannelId: settingsRes.data.marketNotifyChannelId || "",
                    marketForumTags: settingsRes.data.marketForumTags ?? {},
                };
                setConfig(loaded);
                setInitialConfig(loaded);
                setChannelKind(settingsRes.data.marketChannelKind);
            } else {
                setInitialConfig(EMPTY);
            }

            if (forumTagsRes.success && forumTagsRes.data) {
                setForumTagOptions(forumTagsRes.data.tags);
                setForumTagsAvailable(forumTagsRes.data.forum);
            }

            // Contrat réel de `getDiscordRolesAction` : `{ success, roles }` — **jamais** `.data`.
            // Correctif du 13/09 : le panneau lisait `rolesRes.data` (propriété inexistante) ⇒
            // `setRoles([])` systématique ⇒ **aucun rôle Discord** dans les 4 sélecteurs du Marché
            // (rôle à mentionner, rôle modérateur, rôle minimum, rôles pinguables).
            // `color` est un **entier Discord** (ex. 16711680) : converti en `#rrggbb` pour les
            // pastilles de couleur (0 = couleur par défaut Discord ⇒ `#000000`, affiché en gris).
            if (rolesRes.success && rolesRes.roles) {
                setRoles(
                    rolesRes.roles
                        // T6/D-E (ratifié) — `@everyone` n'est **jamais** proposé comme rôle
                        // pinguable (même filtre que calendar/songes/dj/mission/poll) ;
                        // le serveur revalide de son côté.
                        .filter((role) => role.name !== "@everyone")
                        .map((role) => ({
                            ...role,
                            color: `#${role.color.toString(16).padStart(6, "0")}`,
                        }))
                );
            }
            setIsLoading(false);
        }
        load();
    }, [guildId]);

    /**
     * 🗑️ Les champs « Durées, plafonds & rappels » ne sont **plus édités ici**
     * (décision user du 14/09/2026 : réglages **globaux** côté God). Ils restent
     * dans l'état du panneau — `getMarketSettings` les renvoie et `handleSave` les
     * renvoie tels quels — pour qu'un enregistrement du panneau de guilde ne
     * **modifie jamais** une valeur pilotée par SigilOS (§ « une seule vérité »).
     */

    function handleSave() {
        startTransition(async () => {
            const result = await updateMarketSettings(guildId, {
                marketNotifyChannelId: config.marketNotifyChannelId.trim() || null,
                marketNotifyRoleId: config.marketNotifyRoleId,
                marketAllowedPingRoleIds: config.marketAllowedPingRoleIds,
                marketModeratorRoleId: config.marketModeratorRoleId,
                marketMinRoleId: config.marketMinRoleId,
                marketMaxActivePerMember: config.marketMaxActivePerMember,
                marketDefaultDurationDays: config.marketDefaultDurationDays,
                marketMaxLifetimeDays: config.marketMaxLifetimeDays,
                marketReminderDays: config.marketReminderDays,
                marketReservationHours: config.marketReservationHours,
                marketOfferHours: config.marketOfferHours,
                marketNegotiationsEnabled: config.marketNegotiationsEnabled,
                marketProofsEnabled: config.marketProofsEnabled,
                marketMediaRetentionDays: config.marketMediaRetentionDays,
                marketLogRetentionDays: config.marketLogRetentionDays,
                marketForumTags: config.marketForumTags,
            });

            if (result.success) {
                toast.success("Réglages du marché enregistrés !");
                setInitialConfig(config);
            } else {
                toast.error(result.error || "Erreur lors de la sauvegarde");
            }
        });
    }

    function handleTest() {
        setIsTesting(true);
        startTransition(async () => {
            const result = await testMarketConfiguration(guildId);
            setIsTesting(false);
            if (result.success && result.data) {
                setChannelKind(result.data.channelKind);
                setIssues(result.data.issues);
                if (result.data.issues.length === 0) {
                    toast.success("Configuration valide : le marché est prêt.");
                } else {
                    toast.warning("Configuration testée — vérifie les points signalés.");
                }
            } else {
                toast.error(result.error || "Test impossible");
            }
        });
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-info" />
            </div>
        );
    }


    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <UnsavedChangesGuard hasUnsavedChanges={hasUnsavedChanges} />

            {/* Salon & rôles */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <Card className="lg:col-span-2 bg-surface/60 border-border shadow-xl rounded-2xl overflow-hidden backdrop-blur-xl">
                    <CardHeader className="border-b border-border bg-surface/30 p-6">
                        <div className="flex items-center justify-between gap-3">
                            <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wider text-foreground">
                                <span className="bg-info/20 text-info p-2 rounded-xl border border-info/30">
                                    <Hash className="w-4 h-4" />
                                </span>
                                Salon de publication Discord
                            </CardTitle>
                            <Badge variant="outline" className="text-[10px] font-black uppercase tracking-wider">
                                {channelKind === "FORUM" ? "Forum" : channelKind === "TEXT" ? "Textuel" : "Non testé"}
                            </Badge>
                        </div>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <div className="space-y-2">
                            <Label className="text-xs">Salon (texte, annonces ou forum)</Label>
                            <DiscordChannelPicker
                                guildId={guildId}
                                value={config.marketNotifyChannelId}
                                onChange={(value) => setConfig((prev) => ({ ...prev, marketNotifyChannelId: value }))}
                                allowedTypes={DISCORD_FORUM_CHANNEL_TYPES}
                                allowEmptyLabel="Aucun (publication Discord désactivée)"
                            />
                            {config.marketNotifyChannelId && (
                                <ChannelPreview guildId={guildId} channelId={config.marketNotifyChannelId} color="cyan" />
                            )}
                            <p className="text-[11px] text-muted-foreground">
                                Le bot doit pouvoir voir le salon et y écrire. Sur un salon forum, SigilOS applique les tags{" "}
                                <strong>déjà existants</strong> (Disponible, Réservé, Vendu…) : il n&apos;en crée{" "}
                                <strong>aucun</strong> — associe-les dans « Tags de forum » ci-dessous.
                            </p>
                        </div>

                        <div className="space-y-2">
                            <Label className="text-xs">Rôles que le créateur peut mentionner</Label>
                            {/* Décision user (14/09/2026) — les sélecteurs « Rôle à mentionner à
                                la publication », « Rôle modérateur du marché » et « Rôle minimum
                                pour publier » sont **supprimés** : la **matrice RBAC** est la seule
                                source de vérité (`market:trade` = voir / publier / offrir / gérer
                                ses annonces · `market:moderate` = modération du marché EN PLUS).
                                Les colonnes restent en base (aucune migration) et ne sont plus
                                alimentées : aucun écran ne doit réintroduire un second système de
                                droits par rôle Discord. */}
                            <PingRolesSelector
                                value={config.marketAllowedPingRoleIds}
                                onChange={(value) => setConfig((prev) => ({ ...prev, marketAllowedPingRoleIds: value }))}
                                roles={roles}
                                description="Si la liste est vide, les créateurs ne pourront mentionner aucun rôle à la publication."
                            />
                        </div>

                        <div className="flex justify-end">
                            <Button
                                onClick={handleSave}
                                disabled={isPending}
                                className="min-w-[120px] gap-2 bg-info text-info-foreground font-black uppercase tracking-wider text-xs rounded-xl"
                            >
                                {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Sauvegarder
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* D20 / S3.13 — tags de forum (salon forum uniquement) */}
                {forumTagsAvailable && (
                    <Card className="bg-surface/60 border-border rounded-2xl overflow-hidden">
                        <CardHeader className="border-b border-border bg-surface/30 p-6">
                            <CardTitle className="text-base font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                                <Tags className="w-4 h-4 text-info" />
                                Tags de forum
                            </CardTitle>
                            <CardDescription>
                                Assigne aux sujets les tags <strong>déjà existants</strong> de ton salon forum : les membres
                                peuvent alors filtrer les annonces par famille ou par statut directement depuis Discord.
                                SigilOS <strong>ne crée aucun tag</strong> — crée-les d&apos;abord dans les réglages du salon Discord.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {MARKET_FORUM_TAG_KEYS.map((key) => (
                                    <div key={key} className="space-y-2">
                                        <Label className="text-xs">{MARKET_FORUM_TAG_LABELS[key]}</Label>
                                        <select
                                            className="h-9 w-full rounded-xl border border-border bg-surface px-3 text-body-sm text-foreground"
                                            value={config.marketForumTags[key] ?? ""}
                                            onChange={(event) =>
                                                setConfig((prev) => {
                                                    const next: MarketForumTagMap = { ...prev.marketForumTags };
                                                    const value = event.target.value;
                                                    if (value) next[key] = value;
                                                    else delete next[key];
                                                    return { ...prev, marketForumTags: next };
                                                })
                                            }
                                            disabled={isPending}
                                        >
                                            <option value="">— Aucun tag —</option>
                                            {forumTagOptions.map((tag) => (
                                                <option key={tag.id} value={tag.id}>
                                                    {tag.name}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                ))}
                            </div>
                            <p className="text-caption text-muted-foreground">
                                {forumTagOptions.length} tag(s) disponible(s) dans le salon. Maximum 5 tags par sujet :
                                la famille et le statut suffisent.
                            </p>
                        </CardContent>
                    </Card>
                )}

                {/* 🗑️ Décision user (14/09/2026) — le panneau de guilde « Durées, plafonds &
                    rappels » est **supprimé** : les réglages sont **globaux** (God, « Marché »)
                    et `saveGodMarketSettings` les pousse à **toutes** les guildes
                    (`db.guildConfig.updateMany`, mesuré). Un doublon de réglage = deux vérités ;
                    la guilde ne garde que ce qui est **local par nature** : le salon de
                    publication, les rôles pinguables et les tags du forum.
                    Les colonnes `GuildConfig.market*` restent en base (aucune migration) et
                    continuent d'être lues par le serveur (héritage du panneau God). */}
            </div>

            {/* Diagnostic */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <Card className="bg-surface/60 border-border rounded-2xl">
                    <CardHeader className="p-6 pb-2">
                        <CardTitle className="text-sm font-black uppercase tracking-wider text-foreground flex items-center gap-2">
                            <FlaskConical className="w-4 h-4 text-info" />
                            Tester la configuration
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-6 pt-2 space-y-4">
                        <p className="text-xs text-muted-foreground">
                            Vérifie que le salon est joignable par le bot et détecte son type (texte ou forum).
                        </p>
                        <Button variant="outline" className="gap-2" onClick={handleTest} disabled={isTesting || isPending}>
                            {isTesting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                            Lancer le test
                        </Button>
                        {issues.length > 0 && (
                            <ul className="space-y-1">
                                {issues.map((issue) => (
                                    <li key={issue} className="text-[11px] text-warning flex items-start gap-2">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        {issue}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </CardContent>
                </Card>

                <Card className="bg-info/5 border-info/10 rounded-2xl">
                    <CardContent className="p-5 flex gap-3">
                        <div className="p-2 bg-info/20 rounded-xl shrink-0 h-fit border border-info/30">
                            <ShieldCheck className="w-4 h-4 text-info" />
                        </div>
                        <div className="space-y-1.5">
                            <h4 className="text-sm font-black uppercase tracking-wider text-info">Rappel de sécurité</h4>
                            <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                                Le salon est revalidé côté serveur à chaque sauvegarde : un identifiant fourni par le
                                client n&apos;est jamais utilisé aveuglément. Les annonces hors de la guilde restent
                                inaccessibles.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}


