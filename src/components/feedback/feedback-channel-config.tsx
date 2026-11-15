"use client";

import { useEffect, useState, useTransition } from "react";
import { ExternalLink, Link2, Save, Tags } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { FEEDBACK_LABELS, FEEDBACK_TYPES } from "@/lib/feedback-types";
import {
    getFeedbackForumTagSettingsAction,
    setFeedbackForumTagMapAction,
    setFeedbackScreenshotChannelAction,
} from "@/server/actions/feedback-actions";

interface FeedbackChannelConfigProps {
    /** Salon actuellement configuré (`PlatformConfig.questFeedbackChannelId`). */
    initialChannelId: string | null;
    /** Lien résolu côté serveur, ou `null` si le salon n'est pas configuré/résolvable. */
    initialUrl: string | null;
}

/**
 * Réglage God du **salon des captures d'écran**.
 *
 * Décision du 14/11/2026 : pas d'upload de pièce jointe. Tous les formulaires
 * de retour renvoient vers ce salon, dont l'identifiant est saisi ici — jamais
 * une invitation en dur. Si le salon change, le lien suit.
 */
export function FeedbackChannelConfig({ initialChannelId, initialUrl }: FeedbackChannelConfigProps) {
    const [channelId, setChannelId] = useState(initialChannelId ?? "");
    const [url, setUrl] = useState<string | null>(initialUrl);
    const [isPending, startTransition] = useTransition();
    const [isForum, setIsForum] = useState(false);
    const [forumTags, setForumTags] = useState<{ id: string; name: string; moderated: boolean }[]>([]);
    const [tagMap, setTagMap] = useState<Record<string, string>>({});
    const [tagsLoading, setTagsLoading] = useState(true);
    const [tagsSaving, startTagsTransition] = useTransition();

    const loadForumSettings = async () => {
        setTagsLoading(true);
        try {
            const response = await getFeedbackForumTagSettingsAction();
            if (response.success && response.data) {
                setIsForum(response.data.isForum);
                setForumTags(response.data.tags.filter((tag) => !tag.moderated));
                setTagMap(response.data.map);
            }
        } finally {
            setTagsLoading(false);
        }
    };

    useEffect(() => {
        void loadForumSettings();
        // Une seule fois au montage : le salon courant est lu côté serveur.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const save = () => {
        startTransition(async () => {
            const response = await setFeedbackScreenshotChannelAction(channelId.trim());
            if (!response.success) {
                toast.error(response.error || "Enregistrement impossible.");
                return;
            }
            setUrl(response.data?.url ?? null);
            toast.success(
                response.data?.url
                    ? "Salon des captures enregistré."
                    : "Salon des captures effacé."
            );
            // Le salon a changé : les tags disponibles aussi.
            await loadForumSettings();
        });
    };

    const saveTags = () => {
        startTagsTransition(async () => {
            const response = await setFeedbackForumTagMapAction(tagMap);
            if (!response.success) {
                toast.error(response.error || "Enregistrement impossible.");
                return;
            }
            setTagMap(response.data?.map ?? {});
            toast.success("Tags de forum enregistrés.");
        });
    };

    const setTagForType = (type: string, value: string) => {
        setTagMap((previous) => {
            const next = { ...previous };
            if (value === "none") delete next[type];
            else next[type] = value;
            return next;
        });
    };

    return (
        <section className="rounded-xl border border-border bg-surface/40 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                    <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                        Salon des captures d&apos;écran
                    </h2>
                    <p className="text-xs text-muted-foreground">
                        Les formulaires de retour renvoient vers ce salon. Le site n&apos;envoie aucune pièce jointe.
                    </p>
                </div>
                {url && (
                    <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary underline underline-offset-2"
                    >
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        Ouvrir le salon
                    </a>
                )}
            </div>

            <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
                <label htmlFor="feedback-screenshot-channel" className="sr-only">
                    Identifiant du salon Discord
                </label>
                <Input
                    id="feedback-screenshot-channel"
                    value={channelId}
                    onChange={(event) => setChannelId(event.target.value.slice(0, 32))}
                    placeholder="ID du salon Discord (17 à 20 chiffres)"
                    inputMode="numeric"
                    autoComplete="off"
                    spellCheck={false}
                    className="h-9 font-mono text-xs sm:max-w-sm"
                />
                <Button
                    type="button"
                    size="sm"
                    onClick={save}
                    disabled={isPending}
                    className="h-9 shrink-0 gap-2"
                >
                    <Save className="h-3.5 w-3.5" aria-hidden="true" />
                    {isPending ? "Enregistrement…" : "Enregistrer"}
                </Button>
            </div>

            <p className="mt-2 break-words text-[11px] text-muted-foreground">
                {url
                    ? `Lien actif : ${url}`
                    : "Aucun lien affiché tant que le salon n'est pas enregistré."}
            </p>

            {!tagsLoading && isForum && forumTags.length > 0 && (
                <div className="mt-4 space-y-3 border-t border-border pt-4">
                    <div className="space-y-1">
                        <h3 className="flex items-center gap-2 text-xs font-semibold text-foreground">
                            <Tags className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
                            Tag du post selon le type de retour
                        </h3>
                        <p className="text-[11px] text-muted-foreground">
                            Sans choix, le premier tag utilisable du forum est appliqué. Un tag supprimé
                            côté Discord retombe aussi sur ce premier tag.
                        </p>
                    </div>

                    <div className="grid gap-2 md:grid-cols-2">
                        {FEEDBACK_TYPES.map((type) => {
                            const meta = FEEDBACK_LABELS[type];
                            return (
                                <div key={type} className="flex items-center gap-2">
                                    <span className="min-w-0 flex-1 truncate text-[11px] text-muted-foreground" title={meta.label}>
                                        {meta.emoji} {meta.label}
                                    </span>
                                    <label htmlFor={`forum-tag-${type}`} className="sr-only">
                                        Tag du forum pour {meta.label}
                                    </label>
                                    <Select
                                        value={tagMap[type] ?? "none"}
                                        onValueChange={(value) => setTagForType(type, value)}
                                    >
                                        <SelectTrigger
                                            id={`forum-tag-${type}`}
                                            className="h-8 w-[150px] shrink-0 text-[11px]"
                                        >
                                            <SelectValue placeholder="Aucun" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none">Aucun (repli)</SelectItem>
                                            {forumTags.map((tag) => (
                                                <SelectItem key={tag.id} value={tag.id}>
                                                    {tag.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            );
                        })}
                    </div>

                    <Button
                        type="button"
                        size="sm"
                        onClick={saveTags}
                        disabled={tagsSaving}
                        className="h-8 shrink-0 gap-2"
                    >
                        <Save className="h-3.5 w-3.5" aria-hidden="true" />
                        {tagsSaving ? "Enregistrement…" : "Enregistrer les tags"}
                    </Button>
                </div>
            )}
        </section>
    );
}
