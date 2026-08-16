'use client';

import { useState, useEffect } from 'react';
import { getChangelogEntries } from '@/server/actions/changelog-actions';

export const dynamic = "force-dynamic";
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import type { ChangelogCategory } from '@prisma/client';

const categoryConfig: Record<ChangelogCategory, { label: string; color: string }> = {
    FEATURE: { label: 'Nouveau', color: 'bg-info/20 text-info border-info/50' },
    BUGFIX: { label: 'Correction', color: 'bg-green-500/20 text-green-400 border-green-500/50' },
    SECURITY: { label: 'Sécurité', color: 'bg-danger/20 text-danger border-danger/50' },
    PERFORMANCE: { label: 'Performance', color: 'bg-info/20 text-info border-info/50' },
    DOCUMENTATION: { label: 'Docs', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
};

export function ChangelogWidget() {
    type Entry = Awaited<ReturnType<typeof getChangelogEntries>>[0];
    const [latestEntries, setLatestEntries] = useState<Entry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        async function load() {
            const entries = await getChangelogEntries(undefined, true);
            setLatestEntries(entries.slice(0, 3)); // Only last 3
            setIsLoading(false);
        }
        load();
    }, []);

    if (isLoading) {
        return (
            <div className="bg-surface/50 border border-border rounded-xl p-6 animate-pulse">
                <div className="h-6 bg-elevated rounded w-32 mb-4" />
                <div className="space-y-3">
                    <div className="h-16 bg-elevated rounded" />
                    <div className="h-16 bg-elevated rounded" />
                </div>
            </div>
        );
    }

    if (latestEntries.length === 0) {
        return null; // Don't show widget if no entries
    }

    return (
        <div className="bg-surface/30 border border-border rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                    📝 Nouveautés
                </h3>
                <Link
                    href="/changelog"
                    className="text-sm text-info hover:text-info transition-colors flex items-center gap-1"
                >
                    Voir tout
                    <ExternalLink className="w-3 h-3" />
                </Link>
            </div>

            <div className="space-y-3">
                {latestEntries.map((entry) => {
                    const config = categoryConfig[entry.category];
                    return (
                        <Link
                            key={entry.id}
                            href="/changelog"
                            className="block p-3 rounded-lg bg-surface/50 border border-border hover:border-border hover:bg-surface transition-all group"
                        >
                            <div className="flex items-start justify-between gap-3 mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                    <Badge variant="outline" className={`${config.color} text-xs flex-shrink-0`}>
                                        {config.label}
                                    </Badge>
                                    <span className="font-mono text-xs text-muted-foreground flex-shrink-0">{entry.version}</span>
                                </div>
                                <time className="text-xs text-muted-foreground flex-shrink-0">
                                    {formatDistanceToNow(new Date(entry.publishedAt), { addSuffix: true, locale: fr })}
                                </time>
                            </div>
                            <h4 className="font-semibold text-foreground mb-1 group-hover:text-info transition-colors">
                                {entry.title}
                            </h4>
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                {entry.summary}
                            </p>
                        </Link>
                    );
                })}
            </div>
        </div>
    );
}
