import Link from "next/link";
import { DiscordIcon } from "@/components/shared/icons";
import { loginWithDiscord } from "@/server/actions/auth-actions";
import type { Translations } from "@/lib/i18n/locales/fr";

/**
 * Les deux refus de l'annuaire, expliqués **séparément** : se connecter et créer un profil
 * sont deux gestes différents, et confondre les deux renvoie le visiteur dans une boucle.
 *
 * Aucune liste n'est rendue ici : le composant ne reçoit aucune donnée, donc il ne peut rien
 * fuiter même si un appelant se trompe.
 */
export function VisitorAccess({
    variant,
    labels,
}: {
    variant: "anonymous" | "no-profile";
    labels: Translations["visitorsPage"];
}) {
    if (variant === "anonymous") {
        return (
            <div className="reg-callout mt-8">
                <h2 className="text-base font-semibold text-foreground">{labels.signInTitle}</h2>
                <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{labels.signInDesc}</p>
                <form action={loginWithDiscord} className="mt-4">
                    <button type="submit" className="reg-btn reg-btn-primary min-h-11">
                        <DiscordIcon className="w-4 h-4" aria-hidden="true" />
                        {labels.signInCta}
                    </button>
                </form>
            </div>
        );
    }

    return (
        <div className="reg-callout mt-8">
            <h2 className="text-base font-semibold text-foreground">{labels.profileTitle}</h2>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{labels.profileDesc}</p>
            <Link href="/espace-visiteur/general" className="reg-btn reg-btn-primary mt-4 min-h-11">
                {labels.profileCta}
            </Link>
        </div>
    );
}
