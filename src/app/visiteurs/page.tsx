import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { auth } from "@/auth";
import { getServerI18n } from "@/lib/i18n/server";
import { GameIcon } from "@/components/shared/game-icon";
import {
    buildVisitorDirectoryHref,
    parseVisitorDirectoryFilters,
    visitorProfileHref,
    type VisitorDirectoryFilters,
} from "@/lib/public-directory";
import {
    countPublicVisitors,
    listPublicVisitors,
    resolveDirectoryViewer,
    type DirectoryViewer,
} from "@/server/public-directory";
import { parseVisitorsHubSearch } from "@/lib/visitors-hub";
import { VisitorAccess } from "./_components/visitor-access";
import { VisitorFilters } from "./_components/visitor-filters";
import { VisitorsHubNav } from "./_components/visitors-hub-nav";
import { VisitorsShell, VisitorsTitle } from "./_components/visitors-shell";
import { VisitorsViewerBanner } from "./_components/visitors-viewer-banner";
import { SharedSuccesSection } from "./_components/shared-succes-section";
import { VisitorTradesSection } from "./_components/visitor-trades-section";
import { VisitorTradesFallback } from "./_components/visitor-trades-view";
import type { Translations } from "@/lib/i18n/locales/fr";

/**
 * Hub « Communauté SigilOS » (V2e + F16) — **route privée**.
 *
 * Trois vues dans la même page : les profils consentants du serveur, les succès en commun
 * et les échanges Metamob. La vue vit dans l'URL (`?vue=succes`, `?vue=echanges`), jamais
 * dans un état client : retour arrière, partage et rafraîchissement fonctionnent.
 *
 * `robots: noindex, nofollow` : la page n'existe que pour un compte connecté, et son
 * contenu dépend d'une session. L'indexer reviendrait à publier une page vide.
 */
export const metadata: Metadata = {
    title: "Communauté SigilOS | SigilOS",
    description:
        "Les joueurs de ton serveur Dofus qui ont choisi d'apparaître, et les succès qu'ils ont validés.",
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
    const hub = parseVisitorsHubSearch(params);

    return (
        <VisitorsShell
            user={session?.user}
            titleId="visiteurs-titre"
            backHref="/"
            backLabel={labels.backHome}
        >
            <VisitorsTitle id="visiteurs-titre">{labels.title}</VisitorsTitle>
            <p className="mt-4 max-w-[62ch] text-base text-muted-foreground leading-relaxed">
                {labels.subtitle}
            </p>
            <p className="reg-mono mt-6 text-xs text-muted-foreground">{labels.privateNote}</p>

            {access.status === "viewer" ? (
                <>
                    <VisitorsViewerBanner viewer={access.viewer} labels={labels} />
                    <VisitorsHubNav vue={hub.vue} labels={labels} />
                    {hub.vue === "succes" ? (
                        <SharedSuccesSection viewer={access.viewer} hub={hub} labels={labels} />
                    ) : hub.vue === "echanges" ? (
                        <Suspense fallback={<VisitorTradesFallback labels={labels} />}>
                            <VisitorTradesSection
                                viewer={access.viewer}
                                hub={hub}
                                labels={labels}
                            />
                        </Suspense>
                    ) : (
                        <DirectoryList viewer={access.viewer} filters={filters} labels={labels} />
                    )}
                </>
            ) : (
                <VisitorAccess variant={access.status} labels={labels} />
            )}
        </VisitorsShell>
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
                                    {labels.tableJobFiltered}
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
                                                href={visitorProfileHref(entry)}
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
                                        {filters.metier && entry.jobs.length > 0 ? (
                                            <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                                                <GameIcon src={entry.jobs[0].icon} className="size-5" />
                                                <span className="text-foreground">
                                                    {entry.jobs[0].name}
                                                </span>
                                                <span className="reg-mono">
                                                    {entry.jobs[0].level}
                                                </span>
                                            </span>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                    <td className="hidden align-middle text-sm text-muted-foreground lg:table-cell">
                                        {entry.guildName ? (
                                            <span className="inline-flex items-center gap-1.5">
                                                <GameIcon
                                                    src="/assets/dofus/modules/guild.png"
                                                    className="size-4"
                                                />
                                                {entry.guildName}
                                            </span>
                                        ) : (
                                            "—"
                                        )}
                                    </td>
                                    <td className="align-middle text-right">
                                        <Link href={visitorProfileHref(entry)} className="reg-link text-sm">
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
