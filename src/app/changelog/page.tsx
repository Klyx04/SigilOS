import { getChangelogEntries } from '@/server/actions/changelog-actions';
import { ChangelogCategory } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';
import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft, Rocket, Bug, Shield, Zap, BookOpen, Tag, type LucideIcon } from 'lucide-react';
import { PublicHeader } from '@/components/layout/public-header';
import { GalacticFooter } from '@/components/layout/galactic-footer';
import { auth } from '@/auth';
import { DocContent } from '@/components/doc/doc-content';
import { headers } from 'next/headers';
import { JsonLd } from '@/components/shared/json-ld';
import { getAppBaseUrl } from "@/lib/utils";
import { getServerI18n } from '@/lib/i18n/server';

/**
 * Journal des mises à jour — registre (refonte anti-slop).
 */

const CATEGORY_ICONS: Record<ChangelogCategory, LucideIcon> = {
    FEATURE: Rocket,
    BUGFIX: Bug,
    SECURITY: Shield,
    PERFORMANCE: Zap,
    DOCUMENTATION: BookOpen,
};

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
    const { t } = await getServerI18n();

    return {
        title: t.changelogPage.metaTitle,
        description: t.changelogPage.metaDesc,
        alternates: {
            canonical: `${getAppBaseUrl()}/changelog`,
        },
        openGraph: {
            title: t.changelogPage.metaTitle,
            description: t.changelogPage.metaDesc,
            url: `${getAppBaseUrl()}/changelog`,
            type: "website",
        },
    };
}

export default async function ChangelogPage() {
    const session = await auth();
    const { getUserContext } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext();
    const { t, locale } = await getServerI18n();

    // Non-logged-in users only see public entries
    const allEntries = await getChangelogEntries(undefined, !session, locale);
    const latestVersion = allEntries[0]?.version ?? null;

    // [AUDIT 2026] Retrieve nonce for inline scripts
    const headersList = await headers();
    const nonce = headersList.get('x-nonce') ?? '';

    return (
        <div className="registre relative min-h-screen w-full flex flex-col bg-background font-sans landing-theme">

            <PublicHeader user={session?.user} activePage="changelog" isMember={userContext.isMember} />

            <JsonLd
                id="json-ld-changelog"
                nonce={nonce}
                data={[
                    {
                        "@context": "https://schema.org",
                        "@type": "BreadcrumbList",
                        "itemListElement": [
                            { "@type": "ListItem", "position": 1, "name": t.changelogPage.breadcrumbHome, "item": getAppBaseUrl() },
                            { "@type": "ListItem", "position": 2, "name": t.changelogPage.breadcrumbChangelog, "item": `${getAppBaseUrl()}/changelog` },
                        ],
                    },
                    ...allEntries.map((entry) => ({
                        "@context": "https://schema.org",
                        "@type": "BlogPosting",
                        "headline": entry.title,
                        "datePublished": new Date(entry.publishedAt).toISOString(),
                        "author": { "@type": "Organization", "name": "SigilOS" },
                        "publisher": { "@type": "Organization", "name": "SigilOS", "url": getAppBaseUrl() },
                        "description": entry.summary || `${entry.title} — Mise à jour SigilOS ${entry.version}`,
                        "articleSection": entry.category,
                    })),
                ]}
            />

            <main className="flex-1">
                <section className="reg-section reg-section-tight" aria-labelledby="changelog-titre">
                    <div className="reg-shell">
                        <Link href="/" className="reg-link-quiet inline-flex items-center gap-1.5 text-sm">
                            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                            {t.changelogPage.backHome}
                        </Link>

                        <h1
                            id="changelog-titre"
                            className="mt-8 max-w-[30ch] text-[clamp(1.75rem,3.2vw,2.5rem)] font-bold leading-[1.12] tracking-tight text-foreground"
                        >
                            {t.changelogPage.title}
                        </h1>
                        <p className="mt-4 max-w-[62ch] text-base text-muted-foreground leading-relaxed">
                            {t.changelogPage.subtitle}
                        </p>
                        {latestVersion && (
                            <p className="mt-6 flex items-baseline gap-2">
                                <span className="reg-mono text-sm font-semibold text-foreground">{latestVersion}</span>
                                <span className="text-xs text-muted-foreground">{t.changelogPage.latestBadge}</span>
                            </p>
                        )}
                        {allEntries.length === 0 ? (
                            <div className="reg-callout mt-8">
                                <p className="text-sm text-muted-foreground">
                                    {t.changelogPage.empty}
                                </p>
                            </div>
                        ) : (
                            <ol className="mt-10 border-t border-border">
                                {allEntries.map((entry) => {
                                    const Icon = CATEGORY_ICONS[entry.category] ?? Tag;
                                    const label = t.changelogPage.categories[entry.category] ?? entry.category;

                                    return (
                                        <li key={entry.id} className="border-b border-border py-6">
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                                <span className="reg-tag">
                                                    <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                                    {label}
                                                </span>
                                                <span className="reg-mono text-xs text-muted-foreground">{entry.version}</span>
                                                <time
                                                    dateTime={new Date(entry.publishedAt).toISOString()}
                                                    className="reg-mono text-xs text-muted-foreground"
                                                >
                                                    {formatDistanceToNow(new Date(entry.publishedAt), {
                                                        addSuffix: true,
                                                        locale: locale === "en" ? enUS : fr,
                                                    })}
                                                </time>
                                            </div>

                                            <h2 className="mt-3 text-lg font-bold leading-snug tracking-tight text-foreground sm:text-xl">
                                                {entry.title}
                                            </h2>

                                            {entry.summary && (
                                                <div className="mt-2">
                                                    <DocContent content={entry.summary} className="reg-doc reg-content" />
                                                </div>
                                            )}

                                            {/* Detailed Content */}
                                            {session && entry.content && (
                                                <div className="mt-4">
                                                    <DocContent content={entry.content} className="reg-doc reg-content" />
                                                </div>
                                            )}
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </div>
                </section>
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}
