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

    if (Array.isArray(profile)) {
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
                <VisitorsTitle id="visiteur-titre">{labels.profile.ambiguousTitle}</VisitorsTitle>
                <p className="mt-3 max-w-[62ch] text-sm text-muted-foreground">
                    {labels.profile.ambiguousDesc}
                </p>
                <ul className="mt-4 space-y-2">
                    {profile.map((candidate) => (
                        <li
                            key={candidate.id}
                            className="reg-panel flex flex-wrap items-center gap-x-3 gap-y-1 p-3"
                        >
                            <Link href={`/visiteurs/${candidate.id}`} className="reg-link font-semibold">
                                {candidate.pseudo ?? labels.anonymous}
                            </Link>
                            <span className="text-sm text-muted-foreground">
                                {candidate.classe?.name ?? ""}
                                {candidate.server ? ` · ${candidate.server.name}` : ""}
                                {` · ${labels.profile.level} ${candidate.level ?? "—"}`}
                            </span>
                        </li>
                    ))}
                </ul>
            </VisitorsShell>
        );
    }

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
