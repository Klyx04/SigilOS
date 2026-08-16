import { getChangelogEntries } from '@/server/actions/changelog-actions';
import { ChangelogCategory } from '@prisma/client';
import { Badge } from '@/components/ui/badge';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';
import Link from 'next/link';
import { ArrowLeft, Sparkles, Rocket, Bug, Shield, Zap, BookOpen, Clock, Tag } from 'lucide-react';
import { PublicHeader } from '@/components/layout/public-header';
import { GalacticFooter } from '@/components/layout/galactic-footer';
import { auth } from '@/auth';
import { DocContent } from '@/components/doc/doc-content';
import { headers } from 'next/headers';
import Script from 'next/script';
import { cn, getAppBaseUrl } from "@/lib/utils";

const categoryConfig: Record<ChangelogCategory, { label: string; bg: string; text: string; border: string; icon: any }> = {
    FEATURE: { label: 'Nouvelle fonctionnalité', bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30', icon: Rocket },
    BUGFIX: { label: 'Correction', bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30', icon: Bug },
    SECURITY: { label: 'Sécurité', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/30', icon: Shield },
    PERFORMANCE: { label: 'Performance', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30', icon: Zap },
    DOCUMENTATION: { label: 'Documentation', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30', icon: BookOpen },
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

    // [AUDIT 2026] Retrieve nonce for inline scripts
    const headersList = await headers();
    const nonce = headersList.get('x-nonce') ?? '';

    return (
        <div className="relative min-h-screen w-full flex flex-col bg-zinc-950 font-sans selection:bg-teal-500/30 landing-theme">

            <PublicHeader user={session?.user} activePage="changelog" isMember={userContext.isMember} />

            <main className="flex-1 pt-24 pb-16 relative z-10">
                <div className="max-w-4xl mx-auto px-4 sm:px-6">
                    {/* Breadcrumb + BlogPosting JSON-LD */}
                    <Script
                        id="json-ld-changelog"
                        type="application/ld+json"
                        nonce={nonce}
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
                    <div className="mb-6">
                        <Link
                            href="/"
                            className="inline-flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-zinc-100 transition-colors bg-zinc-900/60 border border-zinc-800 px-3.5 py-1.5 rounded-full backdrop-blur-md"
                        >
                            <ArrowLeft className="w-3.5 h-3.5" />
                            Retour à l'accueil
                        </Link>
                    </div>

                    {/* Hero Header */}
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-zinc-900/90 via-zinc-950/80 to-zinc-900/90 border border-white/10 p-8 sm:p-10 mb-12 shadow-2xl backdrop-blur-xl">
                        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-transparent to-amber-500/10 pointer-events-none" />
                        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
                            <div>
                                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-black uppercase tracking-widest mb-3">
                                    <Sparkles className="w-3.5 h-3.5" /> Journal de mises à jour
                                </div>
                                <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                                    Changelog SigilOS
                                </h1>
                                <p className="text-sm sm:text-base text-zinc-400 max-w-xl mt-2 leading-relaxed">
                                    Découvrez les dernières améliorations, correctifs et nouveautés déployés sur la plateforme.
                                </p>
                            </div>

                            <div className="hidden sm:flex flex-col items-end shrink-0">
                                <span className="text-3xl font-black text-amber-400 font-mono">
                                    {allEntries[0]?.version || "v3.6"}
                                </span>
                                <span className="text-caption font-bold text-zinc-500 uppercase tracking-widest">
                                    Dernière version
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Timeline Entries */}
                    <div className="relative space-y-8">
                        {/* Vertical timeline line */}
                        <div className="absolute top-4 bottom-4 left-6 sm:left-8 w-0.5 bg-gradient-to-b from-emerald-500/40 via-zinc-800 to-transparent pointer-events-none hidden sm:block" />

                        {allEntries.length === 0 ? (
                            <div className="text-center py-16 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl">
                                <p className="text-zinc-500 text-sm font-bold">Aucune entrée changelog pour le moment</p>
                            </div>
                        ) : (
                            allEntries.map((entry) => {
                                const config = categoryConfig[entry.category] || {
                                    label: entry.category,
                                    bg: "bg-indigo-500/10",
                                    text: "text-indigo-400",
                                    border: "border-indigo-500/30",
                                    icon: Tag,
                                };
                                const Icon = config.icon;

                                return (
                                    <article
                                        key={entry.id}
                                        className="relative sm:pl-16 group"
                                    >
                                        {/* Timeline Node Icon (Desktop) */}
                                        <div className="absolute left-4 top-6 w-8 h-8 rounded-full bg-zinc-950 border-2 border-zinc-700 group-hover:border-amber-500 flex items-center justify-center text-zinc-400 group-hover:text-amber-400 shadow-md transition-all hidden sm:flex z-10">
                                            <Icon className="w-3.5 h-3.5" />
                                        </div>

                                        {/* Entry Card */}
                                        <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-2xl overflow-hidden hover:border-zinc-700/90 shadow-xl backdrop-blur-md transition-all">
                                            {/* Entry Header */}
                                            <div className="p-6 border-b border-zinc-800/60 bg-gradient-to-r from-zinc-900/80 to-transparent">
                                                <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
                                                    <div className="flex items-center gap-2.5">
                                                        <Badge variant="outline" className={cn("px-2.5 py-0.5 text-caption font-black uppercase tracking-widest border flex items-center gap-1", config.bg, config.text, config.border)}>
                                                            <Icon className="w-3 h-3" />
                                                            {config.label}
                                                        </Badge>
                                                        <span className="font-mono text-xs font-bold text-amber-400 px-2 py-0.5 bg-amber-500/10 rounded-md border border-amber-500/20">
                                                            {entry.version}
                                                        </span>
                                                    </div>

                                                    <time className="text-xs font-medium text-zinc-500 flex items-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5 text-zinc-600" />
                                                        {formatDistanceToNow(new Date(entry.publishedAt), {
                                                            addSuffix: true,
                                                            locale: fr,
                                                        })}
                                                    </time>
                                                </div>

                                                <h2 className="text-xl sm:text-2xl font-black text-zinc-100 tracking-tight leading-snug">
                                                    {entry.title}
                                                </h2>

                                                {entry.summary && (
                                                    <div className="mt-2 text-zinc-400 text-sm leading-relaxed">
                                                        <DocContent content={entry.summary} className="prose-p:text-zinc-400 prose-p:text-sm prose-p:leading-relaxed" />
                                                    </div>
                                                )}
                                            </div>

                                            {/* Detailed Content */}
                                            {session && entry.content && (
                                                <div className="p-6">
                                                    <DocContent
                                                        content={entry.content}
                                                        className="
                                                            prose-p:text-sm prose-p:leading-relaxed prose-p:text-zinc-300
                                                            prose-headings:text-zinc-100 prose-headings:font-black prose-headings:uppercase prose-headings:tracking-tight prose-headings:mb-3 prose-headings:mt-6
                                                            prose-h2:text-lg prose-h2:text-amber-400 prose-h2:border-b-0 prose-h2:pb-0
                                                            prose-h3:text-base prose-h3:text-indigo-400
                                                            prose-strong:text-amber-300 prose-strong:font-bold
                                                            prose-ul:list-disc prose-ul:ml-4 prose-li:text-zinc-300 prose-li:text-sm prose-li:my-1
                                                            prose-hr:border-white/10 prose-hr:my-4
                                                            [&_.callout]:my-4 [&_.callout]:p-4 [&_.callout]:rounded-xl
                                                            [&_img]:max-w-full [&_img]:max-h-[450px] [&_img]:w-auto [&_img]:h-auto [&_img]:object-contain [&_img]:rounded-xl [&_img]:border [&_img]:border-white/10 [&_img]:my-3 [&_img]:shadow-lg [&_img]:mx-auto
                                                            [&_figure]:my-4 [&_figure]:flex [&_figure]:flex-col [&_figure]:items-center
                                                        "
                                                    />
                                                </div>
                                            )}
                                        </div>
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
