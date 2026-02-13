import { getChangelogEntries } from '@/server/actions/changelog-actions';
import { ChangelogCategory } from '@prisma/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import ReactMarkdown from 'react-markdown';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

const categoryConfig: Record<ChangelogCategory, { label: string; color: string }> = {
    FEATURE: { label: 'Nouvelle fonctionnalité', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
    BUGFIX: { label: 'Correction', color: 'bg-green-500/20 text-green-400 border-green-500/50' },
    SECURITY: { label: 'Sécurité', color: 'bg-red-500/20 text-red-400 border-red-500/50' },
    PERFORMANCE: { label: 'Performance', color: 'bg-purple-500/20 text-purple-400 border-purple-500/50' },
    DOCUMENTATION: { label: 'Documentation', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
};

export default async function ChangelogPage() {
    const allEntries = await getChangelogEntries();

    return (
        <div className="min-h-screen bg-zinc-950">
            <div className="max-w-5xl mx-auto px-6 py-12">
                {/* Breadcrumb / Back Link */}
                <div className="mb-8">
                    <Link
                        href="/"
                        className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Retour accueil
                    </Link>
                </div>

                {/* Header */}
                <div className="relative overflow-hidden rounded-2xl bg-indigo-900/20 border border-indigo-500/20 p-8 sm:p-12 mb-12">
                    <div className="relative z-10">
                        <h1 className="text-3xl sm:text-4xl font-black text-white font-heading mb-4">
                            📝 Changelog SigilOS
                        </h1>
                        <p className="text-lg text-indigo-200 max-w-2xl">
                            Toutes les mises à jour, fonctionnalités et corrections de bugs. Suivez l&apos;évolution de SigilOS.
                        </p>
                    </div>
                </div>

                {/* Content */}
                <Tabs defaultValue="all" className="w-full">
                    <TabsList className="mb-8 bg-zinc-900 border border-zinc-800">
                        <TabsTrigger value="all">Tout</TabsTrigger>
                        <TabsTrigger value="FEATURE">Fonctionnalités</TabsTrigger>
                        <TabsTrigger value="BUGFIX">Corrections</TabsTrigger>
                        <TabsTrigger value="SECURITY">Sécurité</TabsTrigger>
                        <TabsTrigger value="PERFORMANCE">Performance</TabsTrigger>
                    </TabsList>

                    {/* All Entries */}
                    <TabsContent value="all" className="space-y-6">
                        {allEntries.length === 0 ? (
                            <EmptyState />
                        ) : (
                            allEntries.map((entry) => (
                                <ChangelogEntry key={entry.id} entry={entry} />
                            ))
                        )}
                    </TabsContent>

                    {/* Filtered Entries */}
                    {(['FEATURE', 'BUGFIX', 'SECURITY', 'PERFORMANCE'] as ChangelogCategory[]).map((category) => {
                        const filtered = allEntries.filter((e) => e.category === category);
                        return (
                            <TabsContent key={category} value={category} className="space-y-6">
                                {filtered.length === 0 ? (
                                    <EmptyState />
                                ) : (
                                    filtered.map((entry) => (
                                        <ChangelogEntry key={entry.id} entry={entry} />
                                    ))
                                )}
                            </TabsContent>
                        );
                    })}
                </Tabs>
            </div>
        </div>
    );
}

interface ChangelogEntryProps {
    entry: Awaited<ReturnType<typeof getChangelogEntries>>[0];
}

function ChangelogEntry({ entry }: ChangelogEntryProps) {
    const config = categoryConfig[entry.category];

    return (
        <article className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors">
            {/* Header */}
            <div className="flex items-start justify-between mb-4">
                <div>
                    <div className="flex items-center gap-3 mb-2">
                        <h2 className="text-2xl font-bold text-white">{entry.title}</h2>
                        <Badge variant="outline" className={config.color}>
                            {config.label}
                        </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-sm text-zinc-400">
                        <span className="font-mono">{entry.version}</span>
                        <span>•</span>
                        <time>
                            {formatDistanceToNow(new Date(entry.publishedAt), {
                                addSuffix: true,
                                locale: fr,
                            })}
                        </time>
                    </div>
                </div>
            </div>

            {/* Content - Markdown */}
            <div className="prose prose-invert prose-zinc max-w-none">
                <ReactMarkdown>{entry.content}</ReactMarkdown>
            </div>
        </article>
    );
}

function EmptyState() {
    return (
        <div className="text-center py-16">
            <p className="text-zinc-500 text-lg">Aucune entrée pour cette catégorie</p>
        </div>
    );
}
