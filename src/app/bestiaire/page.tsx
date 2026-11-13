import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { ArrowLeft, Search } from "lucide-react";

import { auth } from "@/auth";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { getBestiaryHub } from "@/server/actions/game-data-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { getServerI18n } from "@/lib/i18n/server";
import { getAppBaseUrl } from "@/lib/utils";
import { BestiaryHubClient } from "./_components/bestiary-hub-client";

/**
 * **Sommaire du bestiaire** (`/bestiaire`) — la page qui *lie* les fiches de monstres.
 */
export const revalidate = 3600; // Cache ISR 1h

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getServerI18n();
    const hub = await getBestiaryHub();
    const hasContent = hub.success && (hub.data?.documented ?? 0) > 0;
    return {
        title: { absolute: t.bossPage.bestiaryHub.metaTitle },
        description: t.bossPage.bestiaryHub.metaDesc,
        alternates: { canonical: `${getAppBaseUrl()}/bestiaire` },
        robots: hasContent ? { index: true, follow: true } : { index: false, follow: true },
        openGraph: {
            title: t.bossPage.bestiaryHub.metaTitle,
            description: t.bossPage.bestiaryHub.metaDesc,
            url: `${getAppBaseUrl()}/bestiaire`,
        },
    };
}

export default async function BestiaryHubPage() {
    const session = await auth();
    const [userContext, { locale, t }, hubRes] = await Promise.all([
        getUserContext(),
        getServerI18n(),
        getBestiaryHub(),
    ]);
    const fr = locale !== "en";
    const hub = hubRes.success && hubRes.data
        ? hubRes.data
        : { documented: 0, listed: 0, bestiarySize: 0, families: [], truncated: false };

    const headersList = await headers();
    const nonce = headersList.get("x-nonce") ?? "";
    const baseUrl = getAppBaseUrl();
    const hubUrl = `${baseUrl}/bestiaire`;

    const listedMonsters = hub.families.flatMap((family) => family.monsters).slice(0, 100);
    const jsonLdData = [
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: t.bossPage.backHome, item: baseUrl },
                { "@type": "ListItem", position: 2, name: t.bossPage.breadcrumbBoss, item: `${baseUrl}/boss` },
                { "@type": "ListItem", position: 3, name: t.bossPage.bestiaryHub.eyebrow, item: hubUrl },
            ],
        },
        {
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: t.bossPage.bestiaryHub.metaTitle,
            description: t.bossPage.bestiaryHub.metaDesc,
            inLanguage: fr ? "fr" : "en",
            url: hubUrl,
            isPartOf: { "@type": "WebSite", name: "SigilOS", url: baseUrl },
            mainEntity: {
                "@type": "ItemList",
                numberOfItems: hub.listed,
                itemListElement: listedMonsters.map((monster, index) => ({
                    "@type": "ListItem",
                    position: index + 1,
                    name: monster.name,
                    url: `${hubUrl}/${monster.slug}`,
                })),
            },
        },
    ];

    const labels = {
        searchPlaceholder: fr ? "Rechercher un monstre ou une famille..." : "Search monster or family...",
        otherFamily: t.bossPage.bestiaryHub.otherFamily,
        familyFiches: t.bossPage.bestiaryHub.familyFiches,
        levelShort: t.bossPage.levelShort,
        empty: t.bossPage.bestiaryHub.empty,
        noResults: fr ? "Aucun monstre trouvé" : "No monster found",
    };

    return (
        <div className="registre relative min-h-screen w-full flex flex-col bg-background font-sans selection:bg-warning/30 landing-theme text-foreground">
            <PublicHeader user={session?.user} activePage="boss" isMember={userContext.isMember} />

            <JsonLd id="json-ld-bestiaire-sommaire" nonce={nonce} data={jsonLdData} />

            <main className="boss-detail-shell flex-1 pt-28 pb-20 px-4 sm:px-6 md:px-8 relative z-10 max-w-6xl mx-auto w-full">
                <div className="mb-6 flex items-center justify-between gap-3">
                    <Link
                        href="/boss"
                        className="inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-foreground transition-colors bg-surface/50 border border-border px-3.5 py-1.5 rounded-lg"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {t.bossPage.breadcrumbBoss}
                    </Link>
                    <Link
                        href="/boss"
                        className="inline-flex items-center gap-2 text-xs font-semibold text-foreground bg-surface/50 border border-border hover:border-border-strong px-3.5 py-1.5 rounded-lg transition-colors"
                    >
                        <Search className="w-3.5 h-3.5" />
                        {t.bossPage.bestiaryHub.cta}
                    </Link>
                </div>

                <header className="rounded-xl border border-border bg-surface/40 p-5 sm:p-7 mb-6">
                    <div className="space-y-2 max-w-2xl">
                        <p className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                            {t.bossPage.bestiaryHub.eyebrow}
                        </p>
                        <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                            {t.bossPage.bestiaryHub.title}
                        </h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {t.bossPage.bestiaryHub.subtitle}
                        </p>
                        {hub.listed > 0 ? (
                            <p className="text-xs font-semibold text-foreground/90">
                                {t.bossPage.bestiaryHub.listed
                                    .replace("{listed}", String(hub.listed))
                                    .replace("{total}", String(hub.bestiarySize))}
                                {hub.documented > 0 ? (
                                    <span className="ml-2 font-normal text-muted-foreground">
                                        {t.bossPage.bestiaryHub.documented.replace("{count}", String(hub.documented))}
                                    </span>
                                ) : null}
                            </p>
                        ) : null}
                    </div>
                </header>

                <BestiaryHubClient hub={hub} labels={labels} />

                {/* Liens de maillage interne et rendu serveur optimisé pour les moteurs */}
                <div
                    className="sr-only"
                    aria-hidden="true"
                    style={{ contentVisibility: "auto", containIntrinsicSize: "auto 600px" }}
                >
                    {hub.families.map((family) =>
                        family.monsters.map((monster) => (
                            <Link key={monster.slug} href={`/bestiaire/${monster.slug}`}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src=""
                                    alt=""
                                    width={32}
                                    height={32}
                                    decoding="async"
                                    loading="lazy"
                                />
                                {monster.name}
                            </Link>
                        ))
                    )}
                </div>
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}
