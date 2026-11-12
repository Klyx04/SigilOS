"use client";

/**
 * Rush Live du guide public (V2c) — qui est en ligne sur **le même serveur**, et le
 * consentement qui décide d'y figurer.
 *
 * Deux choses que cette modale ne fait jamais :
 *  · afficher un compteur quand la source manque (`unavailable` ⇒ une phrase, pas un « 0 ») ;
 *  · publier quelqu'un sans geste : `showPresence` reste **fermé par défaut** (aucune
 *    migration), et le bouton « Afficher ma présence » est le seul chemin qui l'ouvre.
 */

import { useState } from "react";
import { Loader2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { getClass } from "@/lib/dofus-assets";
import type { PublicRushLiveMember } from "@/lib/public-rush-live";
import type { PublicRushLiveStatus } from "@/hooks/use-public-rush-live";
import { setMyPresence } from "../_actions/public-presence";

export function PublicRushLiveModal({
    open,
    onClose,
    status,
    members,
    presenceEnabled,
    onPresenceChange,
    selfPseudo,
    locale = "fr",
}: {
    open: boolean;
    onClose: () => void;
    status: PublicRushLiveStatus;
    members: PublicRushLiveMember[];
    presenceEnabled: boolean;
    onPresenceChange: (enabled: boolean) => void;
    /** Pseudo du compte connecté : sert seulement à dire « toi », jamais à filtrer. */
    selfPseudo: string | null;
    locale?: "fr" | "en";
}) {
    const en = locale === "en";
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const togglePresence = async (next: boolean) => {
        setSaving(true);
        setError(null);
        const result = await setMyPresence(next);
        setSaving(false);
        if (!result.success) {
            setError(result.error);
            return;
        }
        onPresenceChange(next);
        toast.success(
            next
                ? en ? "Your presence is now visible." : "Ta présence est maintenant visible."
                : en ? "Your presence is now hidden." : "Ta présence est maintenant masquée."
        );
    };

    const statusLine = (() => {
        if (status === "unavailable") {
            return en ? "Presence unavailable right now." : "Présence indisponible pour l'instant.";
        }
        if (status === "connecting") {
            return en ? "Connecting…" : "Connexion…";
        }
        if (members.length === 0) {
            return en
                ? "Nobody else has the guide open on your server."
                : "Personne d'autre n'a le guide ouvert sur ton serveur.";
        }
        return en
            ? `${members.length} online on your server`
            : `${members.length} en ligne sur ton serveur`;
    })();

    return (
        <Dialog open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
            <DialogContent className="max-w-md rounded-[8px] border-border bg-surface p-0">
                <div className="border-b border-border px-4 py-3">
                    <DialogTitle className="text-sm font-semibold text-foreground">Rush Live</DialogTitle>
                    <p className="mt-1 text-xs text-muted-foreground">
                        {en
                            ? "Visitors of your server who have the guide open right now."
                            : "Les visiteurs de ton serveur qui ont le guide ouvert maintenant."}
                    </p>
                </div>

                <div className="px-4 py-3">
                    <p className="text-xs font-medium text-foreground">{statusLine}</p>

                    {status === "live" && members.length > 0 ? (
                        <ul className="mt-2 space-y-1">
                            {members.map((member, index) => {
                                const klass = member.classe ? getClass(member.classe) : undefined;
                                const isSelf = !!selfPseudo && member.pseudo === selfPseudo;
                                return (
                                    <li
                                        key={`${member.pseudo}-${index}`}
                                        className="flex items-center gap-2 rounded-[4px] border border-border bg-elevated px-2 py-1.5"
                                    >
                                        {klass ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                src={klass.icon}
                                                alt=""
                                                aria-hidden="true"
                                                loading="lazy"
                                                className="h-5 w-5 shrink-0 object-contain"
                                            />
                                        ) : (
                                            <UserRound
                                                className="h-4 w-4 shrink-0 text-muted-foreground"
                                                aria-hidden="true"
                                            />
                                        )}
                                        <span className="min-w-0 flex-1 truncate text-xs text-foreground">
                                            {member.pseudo}
                                            {isSelf ? (
                                                <span className="ml-1 text-muted-foreground">
                                                    {en ? "(you)" : "(toi)"}
                                                </span>
                                            ) : null}
                                        </span>
                                        {klass ? (
                                            <span className="shrink-0 text-[11px] text-muted-foreground">
                                                {klass.name}
                                            </span>
                                        ) : null}
                                    </li>
                                );
                            })}
                        </ul>
                    ) : null}

                    <div className="mt-4 rounded-[6px] border border-border bg-elevated px-3 py-2.5">
                        <p className="text-xs font-medium text-foreground">
                            {presenceEnabled
                                ? en ? "Your presence is visible" : "Ta présence est visible"
                                : en ? "Your presence is hidden" : "Ta présence est masquée"}
                        </p>
                        <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
                            {en
                                ? "When visible, visitors of your server see that you are online and which blocks you just validated. Nothing else is published."
                                : "Quand elle est visible, les visiteurs de ton serveur voient que tu es en ligne et les blocs que tu viens de valider. Rien d'autre n'est publié."}
                        </p>
                        <button
                            type="button"
                            onClick={() => void togglePresence(!presenceEnabled)}
                            disabled={saving}
                            className="mt-2 inline-flex items-center gap-1.5 rounded-[4px] border border-border bg-surface px-2.5 py-1.5 text-[11px] font-semibold text-foreground transition-colors hover:bg-elevated disabled:opacity-60"
                        >
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : null}
                            {presenceEnabled
                                ? en ? "Hide my presence" : "Masquer ma présence"
                                : en ? "Show my presence" : "Afficher ma présence"}
                        </button>
                        {error ? (
                            <p role="alert" className="mt-2 text-[11px] text-danger">
                                {error}
                            </p>
                        ) : null}
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
