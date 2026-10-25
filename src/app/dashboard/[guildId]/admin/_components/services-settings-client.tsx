"use client";

import { useState, useEffect, useTransition } from "react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Loader2, Save, Hash, MessagesSquare, Tags, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { UnsavedChangesGuard, isDirty } from "@/components/ui/unsaved-changes-guard";
import { getServiceSettings, updateServiceSettings } from "@/server/actions/service-actions";
import { DiscordChannelPicker, DISCORD_FORUM_CHANNEL_TYPES } from "@/components/shared/DiscordChannelPicker";
import {
    SERVICE_FORUM_TAG_KEYS,
    SERVICE_FORUM_TAG_LABELS,
    type ServiceForumTagMap,
} from "@/lib/services/forum-tags";

interface ServicesSettingsClientProps {
    guildId: string;
}

/** Salon des annonces : **forum uniquement** (15 = forum, 16 = média). */
const LISTINGS_CHANNEL_TYPES = [15, 16];

type SettingsState = {
    listingsChannelId: string;
    requestsChannelId: string;
    forumTags: ServiceForumTagMap;
};

const EMPTY_STATE: SettingsState = { listingsChannelId: "", requestsChannelId: "", forumTags: {} };

export function ServicesSettingsClient({ guildId }: ServicesSettingsClientProps) {
    const [state, setState] = useState<SettingsState>(EMPTY_STATE);
    const [initialConfig, setInitialConfig] = useState<SettingsState | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Diagnostics lus sur Discord (type réel du salon + tags existants + repli historique).
    const [listingsChannelType, setListingsChannelType] = useState<number | null>(null);
    const [listingsForumTags, setListingsForumTags] = useState<{ id: string; name: string }[]>([]);
    const [legacyNotifyChannelId, setLegacyNotifyChannelId] = useState<string | null>(null);

    const hasUnsavedChanges = isDirty(state, initialConfig);
    const listingsIsForum = listingsChannelType === 15 || listingsChannelType === 16;

    useEffect(() => {
        async function loadConfig() {
            const res = await getServiceSettings(guildId);
            if (res.success && res.data) {
                const next: SettingsState = {
                    listingsChannelId: res.data.servicesListingsChannelId || "",
                    requestsChannelId: res.data.servicesRequestsChannelId || "",
                    forumTags: res.data.servicesForumTags ?? {},
                };
                setState(next);
                setInitialConfig(next);
                setListingsChannelType(res.data.listingsChannelType);
                setListingsForumTags(res.data.listingsForumTags ?? []);
                setLegacyNotifyChannelId(res.data.legacyNotifyChannelId);
            }
            setIsLoading(false);
        }
        loadConfig();
    }, [guildId]);

    const handleSave = () => {
        startTransition(async () => {
            const result = await updateServiceSettings(guildId, {
                listingsChannelId: state.listingsChannelId.trim() || null,
                requestsChannelId: state.requestsChannelId.trim() || null,
                forumTags: state.forumTags,
            });
            if (result.success) {
                toast.success("Réglages des services enregistrés.");
                setInitialConfig(state);
                // Relit l'état réel (type du salon + tags) — la source de vérité est Discord.
                const refreshed = await getServiceSettings(guildId);
                if (refreshed.success && refreshed.data) {
                    setListingsChannelType(refreshed.data.listingsChannelType);
                    setListingsForumTags(refreshed.data.listingsForumTags ?? []);
                    setLegacyNotifyChannelId(refreshed.data.legacyNotifyChannelId);
                    setState((prev) => ({ ...prev, forumTags: refreshed.data?.servicesForumTags ?? {} }));
                }
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
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
            <UnsavedChangesGuard hasUnsavedChanges={hasUnsavedChanges} />

            <div className="grid grid-cols-1 gap-6">
                {/* 1. Annonces de service — forum obligatoire */}
                <Card className="bg-surface/60 border-border rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-border bg-surface/30 p-6">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                            <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wider text-foreground">
                                <span className="bg-info/20 text-info p-2 rounded-xl border border-info/30">
                                    <Hash className="w-4 h-4" />
                                </span>
                                Salon des annonces de services
                            </CardTitle>
                            {!state.listingsChannelId ? (
                                <Badge variant="outline" className="text-muted-foreground font-black uppercase tracking-wider text-caption">Non configuré</Badge>
                            ) : listingsIsForum ? (
                                <Badge className="bg-info/10 text-info border-info/20 font-black uppercase tracking-wider text-caption">
                                    <CheckCircle2 className="w-3 h-3 mr-1" /> Forum détecté
                                </Badge>
                            ) : (
                                <Badge className="bg-danger/10 text-danger border-danger/20 font-black uppercase tracking-wider text-caption">Pas un forum</Badge>
                            )}
                        </div>
                        <CardDescription className="text-muted-foreground mt-2 text-xs">
                            Les prestataires y publient <strong>un sujet par service</strong>. Salon <strong>forum obligatoire</strong> :
                            un salon texte n&apos;a ni sujets ni filtres, et c&apos;est ce qui rendait annonces et demandes indistinguables.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <DiscordChannelPicker
                            guildId={guildId}
                            value={state.listingsChannelId}
                            onChange={(value) => setState((prev) => ({ ...prev, listingsChannelId: value }))}
                            allowedTypes={LISTINGS_CHANNEL_TYPES}
                            allowEmptyLabel="Aucun (publication désactivée)"
                        />
                        {state.listingsChannelId && !listingsIsForum && (
                            <p className="text-caption text-danger">
                                Ce salon n&apos;est pas un forum : l&apos;enregistrement sera refusé.
                            </p>
                        )}

                        <div className="rounded-xl border border-border bg-surface/40 p-4 space-y-2">
                            <p className="text-xs font-black uppercase tracking-wider text-foreground">Créer le salon forum (2 minutes)</p>
                            <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                                <li>Dans Discord : <strong>créer un salon</strong> ▸ nom ▸ type <strong>Forum</strong>.</li>
                                <li>Autoriser <strong>SigilOS</strong> à voir le salon, envoyer des messages et créer des sujets.</li>
                                <li>Choisir ce salon ici, puis <strong>Sauvegarder</strong>.</li>
                            </ol>
                            <p className="text-xs font-black uppercase tracking-wider text-foreground pt-2">Créer les tags (facultatif, pour les filtres)</p>
                            <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
                                <li>Modifier le salon ▸ <strong>Tags</strong> ▸ un tag par catégorie (<em>Donjon</em>, <em>Forgemagie</em>…).</li>
                                <li>Revenir ici : ils apparaissent dans la carte « Tags de forum », à lier à une catégorie.</li>
                                <li>SigilOS <strong>ne crée aucun tag</strong> : il applique ceux que tu as créés.</li>
                            </ol>
                        </div>
                    </CardContent>
                </Card>


                {/* 2. Demandes des clients — forum ou texte */}
                <Card className="bg-surface/60 border-border rounded-2xl overflow-hidden">
                    <CardHeader className="border-b border-border bg-surface/30 p-6">
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                            <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wider text-foreground">
                                <span className="bg-info/20 text-info p-2 rounded-xl border border-info/30">
                                    <MessagesSquare className="w-4 h-4" />
                                </span>
                                Salon des demandes des clients
                            </CardTitle>
                            {state.requestsChannelId ? (
                                <Badge className="bg-info/10 text-info border-info/20 font-black uppercase tracking-wider text-caption">Actif</Badge>
                            ) : legacyNotifyChannelId ? (
                                <Badge className="bg-info/10 text-info border-info/20 font-black uppercase tracking-wider text-caption">Ancien salon</Badge>
                            ) : (
                                <Badge variant="outline" className="text-muted-foreground font-black uppercase tracking-wider text-caption">Non configuré</Badge>
                            )}
                        </div>
                        <CardDescription className="text-muted-foreground mt-2 text-xs">
                            Chaque demande envoyée depuis la page Services y apparaît avec le bouton <strong>Répondre</strong>.
                            Salon <strong>forum</strong> = un sujet par demande (la conversation y reste) ; salon <strong>texte</strong> = un message par demande.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="p-6 space-y-4">
                        <DiscordChannelPicker
                            guildId={guildId}
                            value={state.requestsChannelId}
                            onChange={(value) => setState((prev) => ({ ...prev, requestsChannelId: value }))}
                            allowedTypes={DISCORD_FORUM_CHANNEL_TYPES}
                            allowEmptyLabel="Aucun (demandes non publiées)"
                        />
                        {!state.requestsChannelId && legacyNotifyChannelId && (
                            <p className="text-caption text-info">
                                Les demandes utilisent encore l&apos;ancien salon configuré. Choisis-en un ci-dessus pour le remplacer.
                            </p>
                        )}
                        {!state.requestsChannelId && !legacyNotifyChannelId && (
                            <p className="text-caption text-muted-foreground">
                                Sans salon, les demandes restent visibles dans l&apos;onglet <strong>Demandes</strong> du module,
                                mais rien n&apos;est publié sur Discord.
                            </p>
                        )}
                    </CardContent>
                </Card>


                {/* 3. Tags de forum par catégorie (salon forum uniquement) */}
                {listingsIsForum && (
                    <Card className="bg-surface/60 border-border rounded-2xl overflow-hidden">
                        <CardHeader className="border-b border-border bg-surface/30 p-6">
                            <CardTitle className="flex items-center gap-2 text-base font-black uppercase tracking-wider text-foreground">
                                <span className="bg-info/20 text-info p-2 rounded-xl border border-info/30">
                                    <Tags className="w-4 h-4" />
                                </span>
                                Tags de forum par catégorie
                            </CardTitle>
                            <CardDescription className="text-muted-foreground mt-2 text-xs">
                                Assigne à chaque catégorie un tag <strong>déjà existant</strong> de ton salon forum : les membres filtrent
                                les annonces directement dans Discord. SigilOS <strong>ne crée aucun tag</strong> — crée-les dans les réglages du salon.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="p-6 space-y-4">
                            {listingsForumTags.length === 0 ? (
                                <p className="text-xs text-muted-foreground">
                                    Aucun tag trouvé dans ce forum. Crée-les dans Discord (Modifier le salon ▸ Tags), puis rouvre cette page.
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {SERVICE_FORUM_TAG_KEYS.map((key) => (
                                        <div key={key} className="space-y-2">
                                            <Label className="text-xs">{SERVICE_FORUM_TAG_LABELS[key]}</Label>
                                            <select
                                                className="h-9 w-full rounded-xl border border-border bg-surface px-3 text-body-sm text-foreground"
                                                value={state.forumTags[key] ?? ""}
                                                onChange={(event) => {
                                                    const value = event.target.value;
                                                    setState((prev) => {
                                                        const next: ServiceForumTagMap = { ...prev.forumTags };
                                                        if (value) next[key] = value;
                                                        else delete next[key];
                                                        return { ...prev, forumTags: next };
                                                    });
                                                }}
                                                disabled={isPending}
                                            >
                                                <option value="">— Aucun tag —</option>
                                                {listingsForumTags.map((tag) => (
                                                    <option key={tag.id} value={tag.id}>{tag.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Enregistrement unique : les deux salons + les tags (état cohérent ou rien) */}
                <div className="flex items-center justify-between gap-3 flex-wrap rounded-2xl border border-border bg-surface/40 p-4">
                    <p className="text-caption text-muted-foreground">
                        Le type réel des salons et les tags sont relus sur Discord à chaque enregistrement.
                    </p>
                    <Button
                        onClick={handleSave}
                        disabled={isPending}
                        className="min-w-[140px] bg-info hover:bg-info text-info-foreground font-black uppercase tracking-wider text-xs rounded-xl shadow-lg shadow-cyan-900/20"
                    >
                        {isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                        Sauvegarder
                        {hasUnsavedChanges && !isPending && (
                            <span className="ml-2 w-2 h-2 rounded-full bg-white animate-pulse" title="Modifications non sauvegardées" />
                        )}
                    </Button>
                </div>

                <div className="flex gap-3 rounded-2xl border border-info/10 bg-info/5 p-4">
                    <div className="p-2 bg-info/20 rounded-xl shrink-0 h-fit border border-info/30">
                        <AlertTriangle className="w-4 h-4 text-info" />
                    </div>
                    <div className="space-y-1.5">
                        <h4 className="text-sm font-black uppercase tracking-wider text-info">Permissions requises</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed font-medium">
                            Le bot <strong>SigilOS</strong> doit avoir <em>Voir le salon</em>, <em>Envoyer des messages</em> et,
                            dans un forum, <em>Créer des sujets</em>. Sans ces droits la publication est refusée, et l&apos;auteur
                            de l&apos;annonce en est averti à l&apos;écran.
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}

