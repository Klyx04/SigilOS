import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, GalleryVerticalEnd } from "lucide-react";

import { auth } from "@/auth";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { JsonLd } from "@/components/shared/json-ld";
import { MonsterFicheView } from "@/components/succes/MonsterFicheView";
import { getMonsterFicheBySegment } from "@/server/actions/game-data-actions";
import { getUserContext } from "@/server/actions/user-actions";
import { getServerI18n } from "@/lib/i18n/server";
import { getAppBaseUrl } from "@/lib/utils";
import { slugifyBossName } from "@/lib/boss-slug";

/**
 * Fiche publique d'un **monstre** (`/bestiaire/<slug>`) — l'onglet « Monstres » des fiches
 * boss et le module Succès y renvoient.
 *
 * 🎯 Demande user (11/10/2026) : « un onglet fiche qui liste tous les monstres normaux hors
 * boss de dj / avis de recherche / anomalie / titans / boss de raid … et leur fiche existerait ».
 *
 * 🔴 Correction du 11/10/2026 — cette page rendait **404 pour TOUT monstre normal**
 * (mesure : `/bestiaire/piou-rouge` → 404 alors que `/` → 200) : elle ne résolvait que dans
 * `MonsterStat`, table que le cron ne remplit que pour les boss de donjon, titans, gardiens
 * d'anomalie et avis de recherche (base de dev : **283 lignes**, **0** « Piou »). Ce n'était
 * donc **pas** un siphon manquant : le bestiaire COMPLET (5 129 monstres) est déjà versionné
 * dans `public/game-data/unity-bestiary.json`. La résolution lit désormais, dans l'ordre, la
 * ligne du siphon (la plus riche) puis ce bestiaire local — **zéro tiers au rendu**, via la
 * source unique `getMonsterFicheBySegment` (partagée avec l'onglet interne).
 *
 * L'habillage est celui des autres fiches publiques (`/boss/<slug>`) : même en-tête, même fil
 * d'Ariane JSON-LD, même pied de page — une fiche de monstre n'est pas une page orpheline.
 *
 * Règles :
 *   · un boss de donjon, un avis de recherche ou un titan a DÉJÀ sa fiche (`/boss/<slug>`) :
 *     on y redirige (jamais deux pages pour la même bête) ;
 *   · aucune donnée n'est inventée : ce que la source locale ne porte pas (butin d'un monstre
 *     non encore siphonné) reste vide, et la vue le dit explicitement.
 */
type PageProps = { params: Promise<{ slug: string }> };

async function loadFiche(slug: string) {
    const res = await getMonsterFicheBySegment(slug).catch(() => null);
    return res?.success && res.data ? res.data : null;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const fiche = await loadFiche(slug);
    if (!fiche) return { title: "Monstre introuvable — SigilOS" };
    if (fiche.officialSegment) return { title: `${fiche.name} — SigilOS` };
    return {
        title: `${fiche.name} — fiche monstre — SigilOS`,
        description: `Caractéristiques, paliers, sorts et butin de ${fiche.name} (monstre normal), issus du bestiaire local du client de jeu Dofus.`,
        alternates: { canonical: `${getAppBaseUrl()}/bestiaire/${slugifyBossName(fiche.name)}` },
        /**
         * 🔎 Indexation : on n'injecte pas **5 129 pages auto-générées** dans l'index. Une fiche
         * servie par le seul bestiaire local du client (mêmes paliers/sorts que partout, sans
         * butin ni encyclopédie) est en `noindex, follow` ; une fiche **siphonnée** (butin,
         * encyclopédie, zone — contenu réel) reste indexable et entre au sitemap
         * (`listSiphonedNormalMonsterSlugs`). Le volume indexé est donc borné et grandit avec
         * le siphon, jamais avec le bestiaire.
         */
        robots: fiche.source === "siphon" ? undefined : { index: false, follow: true },
    };
}

export default async function MonsterFichePage({ params }: PageProps) {
    const { slug } = await params;
    const fiche = await loadFiche(slug);
    if (!fiche) notFound();

    // Entité déjà publiée ailleurs (boss de donjon / avis de recherche / titan) : sa fiche
    // officielle est la seule servie.
    if (fiche.officialSegment) redirect(`/boss/${encodeURIComponent(fiche.officialSegment)}`);

    const session = await auth();
    const [userContext, { locale, t }] = await Promise.all([getUserContext(), getServerI18n()]);
    const fr = locale !== "en";
    const headersList = await headers();
    const nonce = headersList.get("x-nonce") ?? "";
    const sheetUrl = `${getAppBaseUrl()}/bestiaire/${slugifyBossName(fiche.name)}`;
    const summary = `Caractéristiques, paliers, sorts et butin de ${fiche.name} (monstre normal).`;

    const jsonLdData = [
        {
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
                { "@type": "ListItem", position: 1, name: t.bossPage.backHome, item: getAppBaseUrl() },
                { "@type": "ListItem", position: 2, name: t.bossPage.breadcrumbBoss, item: `${getAppBaseUrl()}/boss` },
                // Le **sommaire** du bestiaire : chaque fiche de monstre lui renvoie (maillage
                // entrant/sortant réel — sans lui, la fiche était un cul-de-sac SEO).
                { "@type": "ListItem", position: 3, name: t.bossPage.bestiaryHub.eyebrow, item: `${getAppBaseUrl()}/bestiaire` },
                { "@type": "ListItem", position: 4, name: fiche.name, item: sheetUrl },
            ],
        },
        {
            "@context": "https://schema.org",
            "@type": "Article",
            headline: fiche.name,
            description: summary,
            about: { "@type": "Thing", name: fiche.name },
            inLanguage: fr ? "fr" : "en",
            url: sheetUrl,
            mainEntityOfPage: { "@type": "WebPage", "@id": sheetUrl },
            isPartOf: { "@type": "WebSite", name: "SigilOS", url: getAppBaseUrl() },
            publisher: { "@type": "Organization", name: "SigilOS", url: getAppBaseUrl() },
        },
    ];

    return (
        <div className="registre relative min-h-screen w-full flex flex-col bg-background font-sans selection:bg-success/30 landing-theme text-foreground">
            <PublicHeader user={session?.user} activePage="boss" isMember={userContext.isMember} />

            <JsonLd id="json-ld-bestiaire-monstre" nonce={nonce} data={jsonLdData} />

            <main className="boss-detail-shell flex-1 pt-28 pb-20 px-4 sm:px-6 md:px-8 relative z-10 max-w-6xl mx-auto w-full">
                {/* Navigation retour */}
                <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                    <Link
                        href="/boss"
                        className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-zinc-100 transition-colors bg-surface/60 border border-border px-3.5 py-1.5 rounded-full backdrop-blur-md"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {fr ? "Toutes les fiches (boss, avis, titans, monstres)" : "All pages (bosses, bounties, titans, monsters)"}
                    </Link>
                    <Link
                        href="/bestiaire"
                        className="inline-flex items-center gap-2 text-xs font-bold text-foreground bg-surface/60 border border-border hover:border-border-strong px-3.5 py-1.5 rounded-full backdrop-blur-md transition-colors"
                    >
                        <GalleryVerticalEnd className="w-3.5 h-3.5" />
                        {t.bossPage.bestiaryHub.linkFromFiche}
                    </Link>
                </div>

                <MonsterFicheView fiche={fiche} locale={locale} />
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}
