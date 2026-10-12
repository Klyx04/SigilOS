import Link from "next/link";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { ArrowLeft, Search, Sparkles } from "lucide-react";

import { auth } from "@/auth";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { getBestiaryHub } from "@/server/actions/game-data-actions";
import type { BestiaryHubResponse } from "@/server/actions/game-data-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { getServerI18n } from "@/lib/i18n/server";
import { getAppBaseUrl } from "@/lib/utils";
import { monsterSpriteUrl } from "@/lib/monster-fiche";

/**
 * **Sommaire du bestiaire** (`/bestiaire`) — la page qui *lie* les fiches de monstres.
 *
 * 🎯 Demande user (11/10/2026) : « un hub `/bestiaire` (serveur) : familles + fiches siphonnées
 * listées en HTML → 1 page qui pousse 59 fiches ».
 *
 * Mesure du même jour, cause racine : une fiche de monstre (`/bestiaire/<slug>`) n'avait
 * **aucun lien entrant** sur le site — la liste des monstres du catalogue public est chargée
 * **côté client** (`/boss` → 0 lien `/bestiaire/` dans le HTML servi, 238 liens `/boss/`) et
 * `/bestiaire` (racine) répondait **404**. Google ne découvrait donc ces fiches que par le
 * sitemap, sans signal de maillage.
 *
 * Règles :
 *   · **indexable** (contrairement aux ~5 000 fiches auto-générées en `noindex`) : c'est un
 *     sommaire curaté, avec un texte réel (nombre de fiches, familles officielles) ;
 *   · ne **lie** que les fiches documentées (butin réel) — exactement celles du sitemap, via la
 *     source unique `getBestiaryHub` (`listSiphonedNormalMonsterSlugs`) : aucune page `noindex`
 *     ne gaspille du budget de crawl, aucun lien ne mène à un 404 ;
 *   · contenu 100 % local (bestiaire du client + référentiel de races) : zéro tiers au rendu.
 */
export const revalidate = 3600; // Cache ISR 1h, comme les autres pages publiques de fiches

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getServerI18n();
    const hub = await getBestiaryHub();
    const hasContent = hub.success && (hub.data?.documented ?? 0) > 0;
    return {
        title: { absolute: t.bossPage.bestiaryHub.metaTitle },
        description: t.bossPage.bestiaryHub.metaDesc,
        alternates: { canonical: `${getAppBaseUrl()}/bestiaire` },
        // Un sommaire vide n'a rien à faire dans l'index (il se remplit avec le siphon).
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

    // `ItemList` : les fiches réellement listées (plafonné — un `ItemList` n'a pas à porter 300
    // entrées, et les moteurs n'en lisent qu'une partie).
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

    return (
        <div className="registre relative min-h-screen w-full flex flex-col bg-background font-sans selection:bg-warning/30 landing-theme text-foreground">
            <PublicHeader user={session?.user} activePage="boss" isMember={userContext.isMember} />

            <JsonLd id="json-ld-bestiaire-sommaire" nonce={nonce} data={jsonLdData} />

            <main className="boss-detail-shell flex-1 pt-28 pb-20 px-4 sm:px-6 md:px-8 relative z-10 max-w-6xl mx-auto w-full">
                <div className="mb-6 flex items-center justify-between gap-3">
                    <Link
                        href="/boss"
                        className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-zinc-100 transition-colors bg-surface/60 border border-border px-3.5 py-1.5 rounded-full backdrop-blur-md"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {t.bossPage.breadcrumbBoss}
                    </Link>
                    <Link
                        href="/boss"
                        className="inline-flex items-center gap-2 text-xs font-bold text-foreground bg-surface/60 border border-border hover:border-border-strong px-3.5 py-1.5 rounded-full backdrop-blur-md transition-colors"
                    >
                        <Search className="w-3.5 h-3.5" />
                        {t.bossPage.bestiaryHub.cta}
                    </Link>
                </div>

                <header className="rounded-xl border border-border bg-surface/40 p-5 sm:p-7 mb-6">
                    <div className="space-y-2.5 max-w-2xl">
                        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
                            {t.bossPage.bestiaryHub.eyebrow}
                        </p>
                        <h1 className="text-2xl sm:text-4xl font-bold text-foreground">
                            {t.bossPage.bestiaryHub.title}
                        </h1>
                        <p className="text-sm text-muted-foreground leading-relaxed">
                            {t.bossPage.bestiaryHub.subtitle}
                        </p>
                        {hub.listed > 0 ? (
                            <p className="text-xs font-bold text-foreground/90">
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

                <Families hub={hub} t={t} />
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}

/** Les familles et leurs fiches documentées — un **lien réel** par fiche (le maillage, c'est ça). */
function Families({
    hub,
    t,
}: {
    hub: BestiaryHubResponse;
    t: Awaited<ReturnType<typeof getServerI18n>>["t"];
}) {
    if (hub.families.length === 0) {
        return (
            <p className="rounded-xl border border-border bg-surface/30 p-5 text-sm text-muted-foreground">
                {t.bossPage.bestiaryHub.empty}
            </p>
        );
    }
    return (
        <div className="space-y-6">
            {hub.families.map((family) => (
                <section key={family.raceId} className="rounded-xl border border-border bg-surface/30 p-4 sm:p-5">
                    <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h2 className="text-base sm:text-lg font-bold text-foreground">
                            {family.name ?? t.bossPage.bestiaryHub.otherFamily}
                        </h2>
                        {family.superRaceName ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                <Sparkles className="w-3 h-3" />
                                {family.superRaceName}
                            </span>
                        ) : null}
                        <span className="ml-auto font-mono text-[11px] text-muted-foreground">
                            {t.bossPage.bestiaryHub.familyFiches.replace("{count}", String(family.monsters.length))}
                        </span>
                    </div>
                    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                        {family.monsters.map((monster) => {
                            const sprite = monsterSpriteUrl(monster.monsterId);
                            return (
                                <li key={monster.slug}>
                                    <Link
                                        href={`/bestiaire/${monster.slug}`}
                                        className="flex items-center gap-2.5 rounded-lg border border-border bg-background/40 px-2.5 py-2 transition-colors hover:border-border-strong hover:bg-elevated/60"
                                    >
                                        {sprite ? (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={sprite} alt="" className="h-8 w-8 shrink-0 object-contain" loading="lazy" />
                                        ) : null}
                                        <span className="min-w-0">
                                            <span className="block truncate text-xs font-bold text-foreground">{monster.name}</span>
                                            {monster.level > 0 ? (
                                                <span className="block font-mono text-[10px] text-muted-foreground">
                                                    {t.bossPage.levelShort} {monster.level}
                                                </span>
                                            ) : null}
                                        </span>
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </section>
            ))}
            {hub.truncated ? (
                <p className="text-xs text-muted-foreground">{t.bossPage.bestiaryHub.truncated}</p>
            ) : null}
        </div>
    );
}

