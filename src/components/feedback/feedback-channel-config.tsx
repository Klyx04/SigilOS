"use client";

import { useState, useTransition } from "react";
import { ExternalLink, Link2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setFeedbackScreenshotChannelAction } from "@/server/actions/feedback-actions";

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
        </section>
    );
}
