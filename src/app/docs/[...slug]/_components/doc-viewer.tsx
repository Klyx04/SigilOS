"use client";

import { DocContent } from "@/components/doc/doc-content";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import * as React from "react";
import { Check, Copy, Layout, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { DocBreadcrumbs } from "@/components/doc/doc-breadcrumbs";
import { DocPagination } from "@/components/doc/doc-pagination";

export function DocViewer({
    content,
    title,
    lastUpdate,
    canEdit,
    editUrl,
    prev,
    next,
    breadcrumbs,
    guildId
}: {
    content: string,
    title: string,
    lastUpdate: string,
    canEdit?: boolean,
    editUrl?: string,
    prev?: { title: string, slug: string } | null,
    next?: { title: string, slug: string } | null,
    breadcrumbs?: { label: string, href: string }[],
    guildId?: string | null
}) {
    const [headings, setHeadings] = React.useState<{ id: string; text: string; level: number }[]>([]);
    const [scrollProgress, setScrollProgress] = React.useState(0);
    const [isWide, setIsWide] = React.useState(false);

    React.useEffect(() => {
        const handleScroll = () => {
            const winScroll = document.documentElement.scrollTop;
            const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
            const scrolled = (winScroll / height) * 100;
            setScrollProgress(scrolled);
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, []);

    React.useEffect(() => {
        // Extract headings from HTML content
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const headingElements = doc.querySelectorAll('h2, h3');

        const extracted = Array.from(headingElements).map((el, index) => {
            const text = el.textContent || "";
            // Generate a slug if ID doesn't exist
            const id = el.id || text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
            return { id, text, level: parseInt(el.tagName[1]) };
        });

        setHeadings(extracted);
    }, [content]);

    return (
        <div className={cn(
            "flex flex-col xl:flex-row gap-12 relative items-start transition-all duration-500",
            isWide ? "max-w-none px-4 md:px-12" : "max-w-7xl mx-auto"
        )}>
            {/* Scroll Progress Bar */}
            <div className="fixed top-0 left-0 w-full h-1 z-[60] pointer-events-none">
                <div
                    className="h-full bg-gradient-to-r from-teal-500 via-teal-400 to-teal-300 transition-all duration-150"
                    style={{ width: `${scrollProgress}%` }}
                />

            </div>

            <article className="flex-1 min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                <header className="mb-8 border-b border-white/5 pb-8">
                    <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                        <div className="flex items-center gap-4">
                            {breadcrumbs && <DocBreadcrumbs items={breadcrumbs} />}
                        </div>

                        <div className="flex items-center gap-3">
                            {/* Layout Toggle */}
                            <button
                                onClick={() => setIsWide(!isWide)}
                                title={isWide ? "Réduire la largeur" : "Agrandir la largeur"}
                                className="p-2 rounded-lg bg-white/5 border border-white/10 text-zinc-500 hover:text-white transition-all hover:bg-white/10"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" /><polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" /></svg>
                            </button>
                        </div>
                    </div>

                    <h1 className="text-4xl md:text-5xl font-black text-white font-heading tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">
                        {title}
                    </h1>
                    <div className="flex items-center justify-between gap-4 text-sm text-zinc-500">
                        <span>Mis à jour le {format(new Date(lastUpdate), "d MMMM yyyy", { locale: fr })}</span>

                        {canEdit && editUrl && (
                            <Link
                                href={editUrl}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 hover:text-teal-300 transition-colors font-medium border border-teal-500/20"
                            >
                                <Edit className="w-3 h-3" />
                                Éditer cette page
                            </Link>
                        )}
                    </div>
                </header>

                <DocContent content={content} />

                <DocPagination prev={prev} next={next} />
            </article>

            {/* Table of Contents - Right Sticky */}
            {
                headings.length > 0 && (
                    <aside className="hidden xl:block w-64 shrink-0 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-white/5">
                        <div className="space-y-4">
                            <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500 px-2 flex items-center gap-2">
                                <div className="w-1 h-3 bg-teal-500 rounded-full" />
                                Sur cette page
                            </h4>
                            <nav className="flex flex-col gap-1">
                                {headings.map((heading, i) => (
                                    <a
                                        key={i}
                                        href={`#${heading.id}`}
                                        className={cn(
                                            "text-sm py-1.5 px-3 rounded-lg border border-transparent transition-all",
                                            "text-zinc-400 hover:text-white hover:bg-white/5",
                                            heading.level === 3 && "ml-4 text-zinc-500 border-l border-white/5 rounded-l-none"
                                        )}
                                    >
                                        {heading.text}
                                    </a>
                                ))}
                            </nav>

                            <div className="pt-8 mt-8 border-t border-white/5">
                                <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest mb-4 px-2">Besoin d'aide ?</p>
                                <Link href="/discord" className="block p-4 rounded-2xl bg-teal-500/5 border border-teal-500/10 hover:bg-teal-500/10 transition-all group">
                                    <p className="text-xs font-bold text-teal-300 mb-1 group-hover:text-white">Rejoindre le Discord</p>
                                    <p className="text-[10px] text-zinc-500">Posez vos questions à la communauté.</p>
                                </Link>
                            </div>
                        </div>
                    </aside>
                )
            }
        </div >
    );
}
