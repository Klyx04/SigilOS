import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import { PublicHeader } from "@/components/layout/public-header";
import { GalacticFooter } from "@/components/layout/galactic-footer";
import { auth } from "@/auth";
import { getAppBaseUrl } from "@/lib/utils";
import { getPublishedGuides } from "@/content/guides";
import { headers } from "next/headers";
import { JsonLd } from "@/components/shared/json-ld";
import { getServerI18n } from "@/lib/i18n/server";

/**
 * Index des guides — registre.
 * Métadonnées et registre localisés (FR source, EN traduit).
 */

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getServerI18n();

    return {
        title: t.guidesPage.metaTitle,
        description: t.guidesPage.metaDesc,
        alternates: {
            canonical: `${getAppBaseUrl()}/guides`,
        },
        openGraph: {
            title: t.guidesPage.metaTitle,
            description: t.guidesPage.metaDesc,
            url: `${getAppBaseUrl()}/guides`,
            type: "website",
        },
    };
}

export default async function GuidesPage() {
    const session = await auth();
    const { getUserContext } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext();
    const { t, locale } = await getServerI18n();
    const guides = getPublishedGuides(locale);

    // [AUDIT 2026] Retrieve nonce for inline scripts
    const headersList = await headers();
    const nonce = headersList.get('x-nonce') ?? '';

    return (
        <div className="registre min-h-screen w-full flex flex-col bg-background text-foreground">
            <PublicHeader user={session?.user} activePage="guides" isMember={userContext.isMember} />

            <main className="flex-1">
                <div className="reg-shell py-10 lg:py-14">
                    <JsonLd
                        id="json-ld-guides"
                        nonce={nonce}
                        data={{
                            "@context": "https://schema.org",
                            "@type": "BreadcrumbList",
                            "itemListElement": [
                                { "@type": "ListItem", "position": 1, "name": t.guidesPage.breadcrumbHome, "item": getAppBaseUrl() },
                                { "@type": "ListItem", "position": 2, "name": t.guidesPage.breadcrumbGuides, "item": `${getAppBaseUrl()}/guides` },
                            ],
                        }}
                    />

                    <header>
                        <p className="reg-eyebrow">{t.guidesPage.eyebrow}</p>
                        <h1 className="mt-3 text-[clamp(1.6rem,2.8vw,2rem)] font-bold tracking-tight text-foreground">
                            {t.guidesPage.title}
                        </h1>
                        <p className="mt-3 max-w-[62ch] text-sm text-muted-foreground leading-relaxed">
                            {t.guidesPage.subtitle}
                        </p>
                    </header>

                    <div className="mt-8 border-t border-border">

                        {guides.length === 0 ? (
                            <p className="py-14 text-sm text-muted-foreground">{t.guidesPage.empty}</p>
                        ) : (
                            <ul>
                                {guides.map((guide) => {
                                    const updated = new Date(guide.updatedAt);
                                    return (
                                        <li key={guide.slug}>
                                            <Link
                                                href={`/guides/${guide.slug}`}
                                                className="group flex items-start gap-4 border-b border-border py-5 transition-colors hover:bg-surface"
                                            >
                                                {guide.coverImage && (
                                                    <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border bg-muted sm:h-16 sm:w-16">
                                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                                        <img
                                                            src={guide.coverImage}
                                                            alt=""
                                                            className="h-full w-full object-cover"
                                                            loading="lazy"
                                                            width={64}
                                                            height={64}
                                                        />
                                                    </div>
                                                )}

                                                <div className="min-w-0 flex-1">
                                                    <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                                        {guide.category && (
                                                            <span className="reg-mono text-[0.6875rem] uppercase tracking-wider text-accent">
                                                                {guide.category}
                                                            </span>
                                                        )}
                                                        {guide.readingTime && (
                                                            <span className="reg-mono text-xs text-muted-foreground">
                                                                {guide.readingTime}
                                                            </span>
                                                        )}
                                                        <time
                                                            dateTime={updated.toISOString()}
                                                            className="reg-mono text-xs text-muted-foreground"
                                                        >
                                                            {updated.toLocaleDateString(locale === "en" ? "en-US" : "fr-FR", {
                                                                year: "numeric",
                                                                month: "long",
                                                                day: "numeric",
                                                            })}
                                                        </time>
                                                    </p>

                                                    <h2 className="mt-1.5 text-sm font-semibold text-foreground group-hover:text-accent sm:text-base">
                                                        {guide.title}
                                                    </h2>

                                                    <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground leading-relaxed line-clamp-2">
                                                        {guide.description}
                                                    </p>
                                                </div>

                                                <ChevronRight
                                                    className="mt-1 h-4 w-4 shrink-0 text-muted-foreground"
                                                    aria-hidden="true"
                                                />
                                            </Link>
                                        </li>
                                    );
                                })}
                            </ul>
                        )}
                    </div>
                </div>
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}
