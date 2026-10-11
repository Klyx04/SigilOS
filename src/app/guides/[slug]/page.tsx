import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { headers } from "next/headers";
import { JsonLd } from "@/components/shared/json-ld";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { getGuideBySlug, getGuideContent } from "@/content/guides";
import { DocContent } from "@/components/doc/doc-content";
import { getServerI18n } from "@/lib/i18n/server";
import { RaidOverlayLaunchBanner } from "@/components/raid-overlay/RaidOverlayLaunchBanner";
import { GuideTocSidebar } from "@/components/guides/GuideTocSidebar";

/** Slugs qui ont un overlay Raid disponible */
const RAID_OVERLAY_CONFIG: Record<string, { raidSlug: "gigalodon" | "jardin-eternel"; raidName: string; themeColor: string }> = {
  "raid-gigalodon-dofus-guide": {
    raidSlug: "gigalodon",
    raidName: "Gouffre du Gigalodon",
    themeColor: "#06b6d4",
  },
  "raid-sanctuaire-jardins-eternels-dofus-guide": {
    raidSlug: "jardin-eternel",
    raidName: "Sanctuaire des Jardins Éternels",
    themeColor: "#10b981",
  },
  "guide-sanctuaire-jardins-eternels": {
    raidSlug: "jardin-eternel",
    raidName: "Sanctuaire des Jardins Éternels",
    themeColor: "#10b981",
  },
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const { t, locale } = await getServerI18n();
    const guide = getGuideBySlug(slug, locale);

    if (!guide) {
        return {
            title: t.guidesPage.notFoundTitle,
            robots: { index: false, follow: false },
        };
    }

    const ogImageUrl = `${getAppBaseUrl()}/api/og?title=${encodeURIComponent(guide.title)}&subtitle=Guide%20Officiel%20SigilOS`;

    return {
        title: guide.title,
        description: guide.description,
        alternates: {
            canonical: `${getAppBaseUrl()}/guides/${guide.slug}`,
        },
        openGraph: {
            type: "article",
            title: guide.title,
            description: guide.description,
            url: `${getAppBaseUrl()}/guides/${guide.slug}`,
            images: [
                {
                    url: ogImageUrl,
                    width: 1200,
                    height: 630,
                    alt: guide.title,
                    type: "image/png",
                },
            ],
        },
        twitter: {
            card: "summary_large_image",
            title: guide.title,
            description: guide.description,
            images: [ogImageUrl],
        },
        robots: guide.draft
            ? { index: false, follow: false, googleBot: { index: false, follow: false } }
            : { index: true, follow: true },
    };
}

export default async function GuidePage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const { t, locale } = await getServerI18n();
    const meta = getGuideBySlug(slug, locale);
    const content = await getGuideContent(slug, locale);

    if (!meta || !content || meta.draft) {
        notFound();
    }

    const dateLocale = locale === "en" ? "en-US" : "fr-FR";
    const session = await auth();
    const { getUserContext } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext();
    const headersList = await headers();
    const nonce = headersList.get("x-nonce") ?? "";

    const raidConfig = RAID_OVERLAY_CONFIG[slug];

    return (
        <div className="registre min-h-screen w-full flex flex-col bg-background text-foreground">
            <PublicHeader user={session?.user} activePage="guides" isMember={userContext.isMember} />

            <JsonLd
                id="json-ld-guide-article"
                nonce={nonce}
                data={[
                    {
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        "itemListElement": [
                            { "@type": "ListItem", "position": 1, "name": t.guidesPage.breadcrumbHome, "item": getAppBaseUrl() },
                            { "@type": "ListItem", "position": 2, "name": t.guidesPage.breadcrumbGuides, "item": `${getAppBaseUrl()}/guides` },
                            { "@type": "ListItem", "position": 3, "name": meta.title, "item": `${getAppBaseUrl()}/guides/${meta.slug}` },
                        ],
                    },
                    {
                        "@context": "https://schema.org",
                        "@type": "Article",
                        "headline": meta.title,
                        "description": meta.description,
                        "datePublished": new Date(meta.publishedAt).toISOString(),
                        "dateModified": new Date(meta.updatedAt).toISOString(),
                        "image": meta.coverImage ? `${getAppBaseUrl()}${meta.coverImage}` : undefined,
                        "author": { "@type": "Organization", "name": "SigilOS", "url": getAppBaseUrl() },
                        "publisher": { "@type": "Organization", "name": "SigilOS", "url": getAppBaseUrl() },
                        "inLanguage": locale === "en" ? "en-US" : "fr-FR",
                    },
                ]}
            />

            <main className="flex-1">
                {/* ── HERO ARTICLE : plat, sans image de fond (déslop 10/10/2026 — la
                    couverture floue + le glow + le dégradé ont été retirés : la couverture
                    reste visible en vignette, en OG et en JSON-LD, jamais en fond). */}
                <div className="border-b border-border">
                    <div className="reg-shell !max-w-6xl relative py-10 lg:py-14">
                        {/* Breadcrumb */}
                        <nav aria-label={locale === "en" ? "Breadcrumb" : "Fil d'Ariane"} className="mb-5 flex items-center gap-2 text-sm text-muted-foreground">
                            <Link href="/" className="reg-link-quiet">SigilOS</Link>
                            <span className="opacity-40">/</span>
                            <Link href="/guides" className="reg-link-quiet">{t.guidesPage.breadcrumbGuides}</Link>
                            <span className="opacity-40">/</span>
                            <span className="text-foreground truncate max-w-[200px]">{meta.category}</span>
                        </nav>

                        {/* Badge catégorie */}
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold uppercase tracking-widest border mb-4 bg-elevated text-foreground border-border">
                            {meta.category ?? "Guide"}
                        </span>

                        {/* Titre */}
                        <h1 className="text-[clamp(1.6rem,3.5vw,2.6rem)] font-bold leading-[1.1] tracking-tight text-foreground max-w-3xl">
                            {meta.title}
                        </h1>

                        {/* Description */}
                        {meta.description && (
                            <p className="mt-4 max-w-2xl text-base text-muted-foreground leading-relaxed">
                                {meta.description}
                            </p>
                        )}

                        {/* Méta barre */}
                        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground reg-mono border-t border-border pt-5">
                            {meta.readingTime && (
                                <span>{meta.readingTime} {t.guidesPage.readingTimeSuffix}</span>
                            )}
                            <span className="opacity-40">·</span>
                            <span>
                                {t.guidesPage.updatedAt}{" "}
                                {new Date(meta.updatedAt).toLocaleDateString(dateLocale, {
                                    year: "numeric", month: "long", day: "numeric",
                                })}
                            </span>
                            <span className="opacity-40">·</span>
                            <span className="text-foreground/70">SigilOS</span>
                        </div>
                    </div>
                </div>

                {/* ── LAYOUT 2 COLONNES : ARTICLE + SIDEBAR ─────────────────── */}
                <div className="reg-shell !max-w-6xl py-10 lg:py-14">
                    <div className="flex gap-10 xl:gap-14 items-start">

                        {/* ── CONTENU PRINCIPAL ─────────────────────────────── */}
                        <div className="min-w-0 flex-1">
                            <div id="guide-content">
                                <DocContent content={content.body} />
                            </div>
                        </div>

                        {/* ── SIDEBAR STICKY ────────────────────────────────── */}
                        <aside className="hidden lg:block w-64 xl:w-72 shrink-0 self-start sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto custom-scrollbar space-y-6 pr-1">
                            {/* CTA Overlay Raid — visible uniquement pour les guides raid */}
                            {raidConfig && (
                                <RaidOverlayLaunchBanner
                                    raidSlug={raidConfig.raidSlug}
                                    raidName={locale === "en"
                                        ? (raidConfig.raidSlug === "jardin-eternel" ? "Eternal Gardens Sanctuary" : "The Gigalodon Abyss")
                                        : raidConfig.raidName}
                                    themeColor={raidConfig.themeColor}
                                    compact
                                />
                            )}

                            {/* Table des matières */}
                            <div className="reg-panel p-4 rounded-xl">
                                <GuideTocSidebar contentId="guide-content" title={t.guidesPage.onThisPage} />
                            </div>
                        </aside>
                    </div>

                    {/* CTA Overlay Raid — version mobile (sous le contenu) */}
                    {raidConfig && (
                        <div className="lg:hidden mt-10">
                            <RaidOverlayLaunchBanner
                                raidSlug={raidConfig.raidSlug}
                                raidName={locale === "en"
                                    ? (raidConfig.raidSlug === "jardin-eternel" ? "Eternal Gardens Sanctuary" : "The Gigalodon Abyss")
                                    : raidConfig.raidName}
                                themeColor={raidConfig.themeColor}
                            />
                        </div>
                    )}
                </div>
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}