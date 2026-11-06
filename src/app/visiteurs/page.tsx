import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@/auth";
import { getServerI18n } from "@/lib/i18n/server";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { GameIcon } from "@/components/shared/game-icon";
import {
    buildVisitorDirectoryHref,
    parseVisitorDirectoryFilters,
    type VisitorDirectoryFilters,
} from "@/lib/public-directory";
import {
    countPublicVisitors,
    listPublicVisitors,
    resolveDirectoryViewer,
    type DirectoryViewer,
} from "@/server/public-directory";
import { VisitorAccess } from "./_components/visitor-access";
import { VisitorFilters } from "./_components/visitor-filters";
import type { Translations } from "@/lib/i18n/locales/fr";

/**
 * Annuaire des visiteurs (V2e) — **route privée**.
 *
 * `robots: noindex, nofollow` : la page n'existe que pour un compte connecté, et son contenu
 * dépend d'une session. L'indexer reviendrait à publier une page vide ou une redirection.
 */
export const metadata: Metadata = {
    title: "Visiteurs de ton serveur | SigilOS",
    description:
        "Annuaire privé des visiteurs Dofus : les joueurs de ton serveur qui ont choisi d'apparaître.",
    robots: { index: false, follow: false },
};

export default async function VisitorsPage({
    searchParams,
}: {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const [params, session, access, { t }] = await Promise.all([
        searchParams,
        auth(),
        resolveDirectoryViewer(),
        getServerI18n(),
    ]);
    const labels = t.visitorsPage;
    const filters = parseVisitorDirectoryFilters(params);

    return (
        <div className="registre relative min-h-screen flex flex-col bg-background text-foreground">
            <PublicHeader
                user={session?.user}
                activePage="visiteurs"
                backHref="/"
                backLabel={labels.backHome}
            />

            <main className="flex-1">
                <section className="reg-section" aria-labelledby="visiteurs-titre">
                    <div className="reg-shell">
                        <h1
                            id="visiteurs-titre"
                            className="max-w-[36ch] text-[clamp(1.75rem,3.2vw,2.5rem)] font-bold leading-[1.12] tracking-tight text-foreground"
                        >
                            {labels.title}
                        </h1>
                        <p className="mt-4 max-w-[62ch] text-base text-muted-foreground leading-relaxed">
                            {labels.subtitle}
                        </p>
                        <p className="reg-mono mt-6 text-xs text-muted-foreground">{labels.privateNote}</p>

                        {access.status === "viewer" ? (
                            <DirectoryList viewer={access.viewer} filters={filters} labels={labels} />
                        ) : (
                            <VisitorAccess variant={access.status} labels={labels} />
                        )}
                    </div>
                </section>
            </main>

            <GalacticFooter />
        </div>
    );
}

/**
 * Liste + compteur. Composant **serveur** asynchrone : les deux requêtes partent ensemble, et
 * un refus de la base remonte à l'`error.tsx` du segment (jamais une liste vide trompeuse).
 */
async function DirectoryList({
    viewer,
    filters,
    labels,
}: {
    viewer: DirectoryViewer;
    filters: VisitorDirectoryFilters;
    labels: Translations["visitorsPage"];
}) {
    const [{ items, nextCursor }, total] = await Promise.all([
        listPublicVisitors(viewer, filters),
        countPublicVisitors(viewer, filters),
    ]);

    const countLabel =
        total === 0 ? labels.countZero : total === 1 ? labels.countOne : `${total} ${labels.countMany}`;

    return (
        <>
            <VisitorFilters filters={filters} labels={labels} />

            <p className="reg-mono mt-6 text-xs text-muted-foreground">{countLabel}</p>

            {items.length === 0 ? (
                <div className="reg-callout mt-8">
                    <h2 className="text-base font-semibold text-foreground">{labels.emptyTitle}</h2>
                    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{labels.emptyDesc}</p>
                </div>
            ) : (
                <div className="mt-8 overflow-x-auto">
                    <table className="reg-table">
                        <caption className="sr-only">{labels.title}</caption>
                        <thead>
                            <tr>
                                <th scope="col">{labels.tablePlayer}</th>
                                <th scope="col" className="hidden w-[6rem] sm:table-cell">
                                    {labels.tableLevel}
                                </th>
                                <th scope="col" className="hidden w-[11rem] md:table-cell">
                                    {labels.tableJobs}
                                </th>
                                <th scope="col" className="hidden w-[12rem] lg:table-cell">
                                    {labels.tableGuild}
                                </th>
                                <th scope="col" className="w-[8rem] text-right">
                                    {labels.tableProfile}
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {items.map((entry) => (
                                <tr key={entry.id}>
                                    <th
                                        scope="row"
                                        className="border-b border-border py-[0.85rem] pr-4 text-left align-middle text-sm font-semibold normal-case tracking-normal text-foreground"
                                    >
                                        <span className="flex items-center gap-3">
                                            {entry.classe ? (
                                                <GameIcon src={entry.classe.icon} className="size-7" />
                                            ) : null}
                                            <Link
                                                href={`/visiteurs/${entry.id}`}
                                                className="min-w-0 truncate text-foreground hover:text-accent"
                                            >
                                                {entry.pseudo ?? labels.anonymous}
                                            </Link>
                                            {entry.classe ? (
                                                <span className="reg-tag shrink-0 text-muted-foreground">
                                                    {entry.classe.name}
                                                </span>
                                            ) : null}
                                        </span>
                                    </th>
                                    <td className="hidden align-middle text-sm text-muted-foreground sm:table-cell">
                                        {entry.level ?? "—"}
                                    </td>
                                    <td className="hidden align-middle md:table-cell">
                                        {entry.jobs.length > 0 ? (
                                            <span className="flex items-center gap-2">
                                                {entry.jobs.map((job) => (
                                                    <span
                                                        key={job.id}
                                                        className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                                                        title={job.name}
                                                    >
                                                        <GameIcon src={job.icon} className="size-5" />
                                                        {job.level}
                                                    </span>
                                                ))}
                                            </span>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                    <td className="hidden align-middle text-sm text-muted-foreground lg:table-cell">
                                        {entry.guildName ?? "—"}
                                    </td>
                                    <td className="align-middle text-right">
                                        <Link href={`/visiteurs/${entry.id}`} className="reg-link text-sm">
                                            {labels.viewProfile}
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            {nextCursor && (
                <div className="mt-6">
                    <Link
                        href={buildVisitorDirectoryHref({ ...filters, cursor: nextCursor })}
                        className="reg-link text-sm"
                    >
                        {labels.nextPage}
                    </Link>
                </div>
            )}
        </>
    );
}
