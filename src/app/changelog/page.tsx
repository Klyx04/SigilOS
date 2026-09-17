import { getChangelogEntries } from '@/server/actions/changelog-actions';
import { ChangelogCategory } from '@prisma/client';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { ArrowLeft, Rocket, Bug, Shield, Zap, BookOpen, Tag, type LucideIcon } from 'lucide-react';
import { PublicHeader } from '@/components/layout/public-header';
import { GalacticFooter } from '@/components/layout/galactic-footer';
import { auth } from '@/auth';
import { DocContent } from '@/components/doc/doc-content';
import { headers } from 'next/headers';
import { JsonLd } from '@/components/shared/json-ld';
import { getAppBaseUrl } from "@/lib/utils";

/**
 * Journal des mises à jour — registre (refonte anti-slop).
 *
 * Ce qui a été retiré : la carte d'en-tête `rounded-3xl` remplie de dégradés,
 * d'ombre `shadow-2xl` et de `backdrop-blur-xl`, le badge pilule en capitales, le
 * titre `font-black`, la version en ocre `font-black`, la ligne de temps en
 * dégradé et les cartes d'entrée `rounded-2xl shadow-xl backdrop-blur-md`. Les
 * surcharges `prose-*` (titres en capitales, h2 ocre, ombres sur les images)
 * laissent la place à `.reg-doc reg-content`.
 *
 * Les mises à jour se lisent comme un journal : une liste datée séparée par des
 * filets. Plus de couleur par catégorie — quatre couleurs pour quatre
 * catégories, c'était de la décoration, pas de l'information.
 */

const categoryConfig: Record<ChangelogCategory, { label: string; icon: LucideIcon }> = {
    FEATURE: { label: 'Nouvelle fonctionnalité', icon: Rocket },
    BUGFIX: { label: 'Correction', icon: Bug },
    SECURITY: { label: 'Sécurité', icon: Shield },
    PERFORMANCE: { label: 'Performance', icon: Zap },
    DOCUMENTATION: { label: 'Documentation', icon: BookOpen },
};

export const dynamic = "force-dynamic";

export const metadata = {
    title: "Changelog",
    description: "Suivez l'évolution de SigilOS : mises à jour, correctifs et nouvelles fonctionnalités en temps réel.",
    alternates: {
        canonical: `${getAppBaseUrl()}/changelog`,
    },
};

export default async function ChangelogPage() {
    const session = await auth();
    const { getUserContext } = await import("@/server/actions/user-actions");
    const userContext = await getUserContext();

    // Non-logged-in users only see public entries
    const allEntries = await getChangelogEntries(undefined, !session);
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
                            { "@type": "ListItem", "position": 1, "name": "Accueil", "item": getAppBaseUrl() },
                            { "@type": "ListItem", "position": 2, "name": "Changelog", "item": `${getAppBaseUrl()}/changelog` },
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
                            Retour à l'accueil
                        </Link>

                        <h1
                            id="changelog-titre"
                            className="mt-8 max-w-[30ch] text-[clamp(1.75rem,3.2vw,2.5rem)] font-bold leading-[1.12] tracking-tight text-foreground"
                        >
                            Changelog SigilOS
                        </h1>
                        <p className="mt-4 max-w-[62ch] text-base text-muted-foreground leading-relaxed">
                            Découvrez les dernières améliorations, correctifs et nouveautés déployés sur la plateforme.
                        </p>
                        {latestVersion && (
                            <p className="mt-6 flex items-baseline gap-2">
                                <span className="reg-mono text-sm font-semibold text-foreground">{latestVersion}</span>
                                <span className="text-xs text-muted-foreground">Dernière version</span>
                            </p>
                        )}
                        {allEntries.length === 0 ? (
                            <div className="reg-callout mt-8">
                                <p className="text-sm text-muted-foreground">
                                    Aucune entrée changelog pour le moment
                                </p>
                            </div>
                        ) : (
                            <ol className="mt-10 border-t border-border">
                                {allEntries.map((entry) => {
                                    const config = categoryConfig[entry.category] ?? { label: entry.category, icon: Tag };
                                    const Icon = config.icon;

                                    return (
                                        <li key={entry.id} className="border-b border-border py-6">
                                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
                                                <span className="reg-tag">
                                                    <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden="true" />
                                                    {config.label}
                                                </span>
                                                <span className="reg-mono text-xs text-muted-foreground">{entry.version}</span>
                                                <time
                                                    dateTime={new Date(entry.publishedAt).toISOString()}
                                                    className="reg-mono text-xs text-muted-foreground"
                                                >
                                                    {formatDistanceToNow(new Date(entry.publishedAt), {
                                                        addSuffix: true,
                                                        locale: fr,
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
