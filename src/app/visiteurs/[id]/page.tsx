import type { Metadata } from "next";
import type { ReactNode } from "react";
import type { User } from "next-auth";
import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getServerI18n } from "@/lib/i18n/server";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { getPublicVisitor, resolveDirectoryViewer } from "@/server/public-directory";
import { VisitorAccess } from "../_components/visitor-access";
import { VisitorProfileCard } from "../_components/visitor-profile-card";
import type { Translations } from "@/lib/i18n/locales/fr";

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
            <VisitorPageShell user={session?.user} labels={labels}>
                <h1
                    id="visiteur-titre"
                    className="max-w-[36ch] text-[clamp(1.75rem,3.2vw,2.5rem)] font-bold leading-[1.12] tracking-tight text-foreground"
                >
                    {labels.title}
                </h1>
                <p className="mt-4 max-w-[62ch] text-base text-muted-foreground leading-relaxed">
                    {labels.subtitle}
                </p>
                <VisitorAccess variant={access.status} labels={labels} />
            </VisitorPageShell>
        );
    }

    const profile = await getPublicVisitor(access.viewer, id);
    if (!profile) notFound();

    return (
        <VisitorPageShell user={session?.user} labels={labels}>
            <Link href="/visiteurs" className="reg-link text-sm">
                {labels.profile.backToList}
            </Link>
            <VisitorProfileCard profile={profile} labels={labels} />
        </VisitorPageShell>
    );
}

/** Coque commune aux trois états de la fiche (refus compris) — un seul en-tête, un seul pied. */
function VisitorPageShell({
    user,
    labels,
    children,
}: {
    user?: User;
    labels: Translations["visitorsPage"];
    children: ReactNode;
}) {
    return (
        <div className="registre relative min-h-screen flex flex-col bg-background text-foreground">
            <PublicHeader
                user={user}
                activePage="visiteurs"
                backHref="/visiteurs"
                backLabel={labels.profile.backToDirectory}
            />
            <main className="flex-1">
                <section className="reg-section" aria-labelledby="visiteur-titre">
                    <div className="reg-shell">{children}</div>
                </section>
            </main>
            <GalacticFooter />
        </div>
    );
}
