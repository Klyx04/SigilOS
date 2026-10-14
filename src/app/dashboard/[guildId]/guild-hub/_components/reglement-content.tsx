import Link from "next/link";
import { Pencil } from "lucide-react";
import type { GuildPresentation } from "@/server/actions/presentation-actions";
import { isInternalRulesEmpty } from "@/lib/presentation-rules";
import { DocContent } from "@/components/doc/doc-content";

/**
 * Règlement intérieur — **destination propre** du hub « La Guilde ».
 *
 * Avant : le texte n'existait que dans l'onglet Présentation, noyé après le manifeste — un membre
 * ne le trouvait pas. Il a désormais son entrée de navigation et son rendu (`?tab=reglement`),
 * tandis que l'onglet Présentation garde l'histoire et la galerie.
 * Contenu **interne** : jamais servi à l'annuaire public (`getGuildPresentation(guildId, true)`
 * renvoie `internalRules: null`).
 */
export default function ReglementContent({
    guild,
    user,
    guildId,
}: {
    guild: GuildPresentation;
    user: { isAdmin?: boolean; canEditPresentation?: boolean };
    guildId: string;
}) {
    const canEdit = !!user.isAdmin || !!user.canEditPresentation;
    const hasRules = !!guild.internalRules && !isInternalRulesEmpty(guild.internalRules);
    const editHref = `/dashboard/${guildId}/admin/presentation`;

    return (
        <div className="mx-auto max-w-3xl space-y-6">
            <section aria-labelledby="reglement-titre">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <h2 id="reglement-titre" className="reg-eyebrow">
                        Règlement intérieur
                    </h2>
                    <p className="inline-flex items-center gap-2 text-sm">
                        <span className="reg-tag">Interne</span>
                        <span className="text-muted-foreground">Invisible de l&apos;annuaire public.</span>
                    </p>
                </div>

                {hasRules ? (
                    <>
                        <div className="mt-4 border-l-2 border-border-strong pl-5">
                            <DocContent content={guild.internalRules as string} />
                        </div>
                        {canEdit && (
                            <p className="mt-6">
                                <Link
                                    href={editHref}
                                    className="reg-link-quiet inline-flex items-center gap-1.5 text-xs"
                                >
                                    <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                    Modifier le règlement
                                </Link>
                            </p>
                        )}
                    </>
                ) : (
                    <p className="mt-4 border-l-2 border-border pl-5 text-sm leading-relaxed text-muted-foreground">
                        Aucune règle écrite pour l&apos;instant. L&apos;état-major peut poser les bases en cinq
                        minutes depuis l&apos;édition.
                        {canEdit && (
                            <>
                                {" "}
                                <Link href={editHref} className="reg-link">
                                    Écrire le règlement
                                </Link>
                            </>
                        )}
                    </p>
                )}
            </section>
        </div>
    );
}
