import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getServerI18n } from "@/lib/i18n/server";
import { getPublicVisitor, resolveDirectoryViewer } from "@/server/public-directory";
import { VisitorAccess } from "../_components/visitor-access";
import { VisitorProfileCard } from "../_components/visitor-profile-card";
import { VisitorsShell, VisitorsTitle } from "../_components/visitors-shell";

/**
 * Fiche d'un visiteur du même serveur (V2e) — **privée**, comme la liste.
 *
 * `notFound()` couvre les trois refus d'un seul geste : profil inexistant, consentement
 * retiré, ou profil d'un autre serveur. Un 404 ne dit pas lequel — c'est voulu : distinguer
 * « existe mais caché » de « n'existe pas » serait déjà une fuite.
 */
export const metadata: Metadata = {
    title: "Fiche visiteur | SigilOS",
    description: "Fiche d'un visiteur Dofus de ton serveur, dans l'annuaire privé de SigilOS.",
    robots: { index: false, follow: false },
};

export default async function VisitorProfilePage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const [{ id }, session, access, { t }] = await Promise.all([
        params,
        auth(),
        resolveDirectoryViewer(),
        getServerI18n(),
    ]);
    const labels = t.visitorsPage;

    if (access.status !== "viewer") {
        return (
            <VisitorsShell
                user={session?.user}
                titleId="visiteur-titre"
                backHref="/visiteurs"
                backLabel={labels.profile.backToDirectory}
            >
                <VisitorsTitle id="visiteur-titre">{labels.title}</VisitorsTitle>
                <p className="mt-4 max-w-[62ch] text-base text-muted-foreground leading-relaxed">
                    {labels.subtitle}
                </p>
                <VisitorAccess variant={access.status} labels={labels} />
            </VisitorsShell>
        );
    }

    const profile = await getPublicVisitor(access.viewer, id);
    if (!profile) notFound();

    return (
        <VisitorsShell
            user={session?.user}
            titleId="visiteur-titre"
            backHref="/visiteurs"
            backLabel={labels.profile.backToDirectory}
        >
            <Link href="/visiteurs" className="reg-link text-sm">
                {labels.profile.backToList}
            </Link>
            <VisitorProfileCard profile={profile} labels={labels} />
        </VisitorsShell>
    );
}
