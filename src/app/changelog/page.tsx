import { getChangelogEntries } from '@/server/actions/changelog-actions';
import { ChangelogCategory } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
// TipTap saves HTML, not Markdown - content is pre-sanitized by server action
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PublicHeader } from '@/components/layout/public-header';
import { GalacticFooter } from '@/components/layout/galactic-footer';
import { auth } from '@/auth';
import { AuroraBackground } from '@/components/ui/aurora-background';
import { DocContent } from '@/components/doc/doc-content';

const categoryConfig: Record<ChangelogCategory, { label: string; color: string }> = {
    FEATURE: { label: 'Nouvelle fonctionnalité', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
    BUGFIX: { label: 'Correction', color: 'bg-green-500/20 text-green-400 border-green-500/50' },
    SECURITY: { label: 'Sécurité', color: 'bg-red-500/20 text-red-400 border-red-500/50' },
    PERFORMANCE: { label: 'Performance', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
    DOCUMENTATION: { label: 'Documentation', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
};

export const dynamic = "force-dynamic";

import { getAppBaseUrl } from "@/lib/utils";

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

    return (
        <div className="relative min-h-screen w-full flex flex-col bg-zinc-950 font-sans selection:bg-accent-teal/30 landing-theme">
            <AuroraBackground className="absolute inset-0 z-0 pointer-events-none opacity-40" />
            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] bg-emerald-500/10 rounded-full blur-[120px] animate-pulse-slow" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-600/10 rounded-full blur-[100px] animate-pulse-slow delay-1000" />
            </div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(16,185,129,0.05),transparent_50%)] pointer-events-none" />

            <PublicHeader user={session?.user} activePage="changelog" isMember={userContext.isMember} />

            <main className="flex-1 pt-24 pb-12 relative z-10">
                <div className="max-w-4xl mx-auto px-6">
                    {/* Breadcrumb + BlogPosting JSON-LD */}
                    <script
                        type="application/ld+json"
                        dangerouslySetInnerHTML={{
                            __html: JSON.stringify([
                                {
                                    "@context": "https://schema.org",
                                    "@type": "BreadcrumbList",
                                    "itemListElement": [
                                        { "@type": "ListItem", "position": 1, "name": "Accueil", "item": getAppBaseUrl() },
                                        { "@type": "ListItem", "position": 2, "name": "Changelog", "item": `${getAppBaseUrl()}/changelog` },
                                    ],
                                },
                                ...allEntries.slice(0, 10).map((entry) => ({
                                    "@context": "https://schema.org",
                                    "@type": "BlogPosting",
                                    "headline": entry.title,
                                    "datePublished": new Date(entry.publishedAt).toISOString(),
                                    "author": { "@type": "Organization", "name": "SigilOS" },
                                    "publisher": { "@type": "Organization", "name": "SigilOS", "url": getAppBaseUrl() },
                                    "description": entry.summary || `${entry.title} — Mise à jour SigilOS ${entry.version}`,
                                    "articleSection": entry.category,
                                })),
                            ]),
                        }}
                    />
                    {/* Breadcrumb */}
                    <div className="mb-8">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            Retour accueil
                        </Link>
                    </div>

                    {/* Hero Header */}
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-900/30 via-emerald-900/20 to-zinc-900/30 border border-emerald-500/20 p-8 sm:p-12 mb-12">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/10 via-transparent to-transparent" />
                        <div className="relative z-10">
                            <h1 className="text-3xl sm:text-4xl font-black text-white font-heading mb-4">
                                📝 Changelog SigilOS
                            </h1>
                            <p className="text-lg text-emerald-200/80 max-w-2xl">
                                Toutes les mises à jour, fonctionnalités et corrections de bugs.
                                Suivez l&apos;évolution de SigilOS en temps réel.
                            </p>
                        </div>
                    </div>

                    {/* Timeline Entries */}
                    <div className="space-y-6">
                        {allEntries.length === 0 ? (
                            <div className="text-center py-16 bg-zinc-900/30 border border-zinc-800 rounded-xl">
                                <p className="text-zinc-500 text-lg">Aucune entrée changelog pour le moment</p>
                            </div>
                        ) : (
                            allEntries.map((entry) => {
                                const config = categoryConfig[entry.category];
                                return (
                                    <article
                                        key={entry.id}
                                        className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden hover:border-zinc-700 transition-colors"
                                    >
                                        {/* Entry Header */}
                                        <div className="px-6 pt-6 pb-4 border-b border-zinc-800/50">
                                            <div className="flex flex-wrap items-center gap-3 mb-3">
                                                <Badge variant="outline" className={config.color}>
                                                    {config.label}
                                                </Badge>
                                                <span className="font-mono text-sm text-zinc-500">{entry.version}</span>
                                                <span className="text-zinc-700">•</span>
                                                <time className="text-sm text-zinc-500">
                                                    {formatDistanceToNow(new Date(entry.publishedAt), {
                                                        addSuffix: true,
                                                        locale: fr,
                                                    })}
                                                </time>
                                            </div>
                                            <h2 className="text-xl font-bold text-white">{entry.title}</h2>
                                            {entry.summary && (
                                                <div className="mt-2 text-zinc-400 text-sm leading-relaxed">
                                                    <DocContent content={entry.summary} className="prose-sm" />
                                                </div>
                                            )}
                                        </div>

                                        {session && entry.content && (
                                            <div className="px-6 py-5">
                                                <DocContent content={entry.content} className="prose-headings:text-white prose-headings:font-bold prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-base prose-p:text-zinc-300 prose-p:leading-relaxed prose-li:text-zinc-300 prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-code:text-indigo-300 prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-img:rounded-xl prose-img:max-w-full" />
                                            </div>
                                        )}
                                    </article>
                                );
                            })
                        )}
                    </div>
                </div>
            </main>

            <GalacticFooter isMember={userContext.isMember} />
        </div>
    );
}
