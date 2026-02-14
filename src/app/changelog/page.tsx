import { getChangelogEntries } from '@/server/actions/changelog-actions';
import { ChangelogCategory } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { PublicHeader } from '@/components/layout/public-header';
import { GalacticFooter } from '@/components/layout/galactic-footer';
import { auth } from '@/auth';

const categoryConfig: Record<ChangelogCategory, { label: string; color: string }> = {
    FEATURE: { label: 'Nouvelle fonctionnalité', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
    BUGFIX: { label: 'Correction', color: 'bg-green-500/20 text-green-400 border-green-500/50' },
    SECURITY: { label: 'Sécurité', color: 'bg-red-500/20 text-red-400 border-red-500/50' },
    PERFORMANCE: { label: 'Performance', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
    DOCUMENTATION: { label: 'Documentation', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
};

export const dynamic = "force-dynamic";

export default async function ChangelogPage() {
    const allEntries = await getChangelogEntries();
    const session = await auth();

    return (
        <div className="relative min-h-screen w-full flex flex-col bg-zinc-950 font-sans selection:bg-purple-500/30">
            <PublicHeader user={session?.user} />

            <main className="flex-1 pt-24 pb-12">
                <div className="max-w-4xl mx-auto px-6">
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
                    <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-900/30 via-purple-900/20 to-zinc-900/30 border border-indigo-500/20 p-8 sm:p-12 mb-12">
                        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-500/10 via-transparent to-transparent" />
                        <div className="relative z-10">
                            <h1 className="text-3xl sm:text-4xl font-black text-white font-heading mb-4">
                                📝 Changelog SigilOS
                            </h1>
                            <p className="text-lg text-indigo-200/80 max-w-2xl">
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
                                                <p className="mt-2 text-zinc-400 text-sm leading-relaxed">
                                                    {entry.summary}
                                                </p>
                                            )}
                                        </div>

                                        {/* Entry Content - Markdown */}
                                        <div className="px-6 py-5">
                                            <div className="prose prose-invert prose-zinc max-w-none prose-headings:text-white prose-headings:font-bold prose-h2:text-lg prose-h2:mt-4 prose-h2:mb-2 prose-h3:text-base prose-p:text-zinc-300 prose-p:leading-relaxed prose-li:text-zinc-300 prose-a:text-indigo-400 prose-a:no-underline hover:prose-a:underline prose-strong:text-white prose-code:text-indigo-300 prose-code:bg-zinc-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm">
                                                <ReactMarkdown>{entry.content}</ReactMarkdown>
                                            </div>
                                        </div>
                                    </article>
                                );
                            })
                        )}
                    </div>
                </div>
            </main>

            <GalacticFooter />
        </div>
    );
}
