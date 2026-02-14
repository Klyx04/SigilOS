"use client";

import { DocContent } from "@/components/doc/doc-content";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import Link from "next/link";
import { Edit } from "lucide-react";
import { cn } from "@/lib/utils";
import * as React from "react";
import { Check, Copy } from "lucide-react";
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
    breadcrumbs
}: {
    content: string,
    title: string,
    lastUpdate: Date,
    canEdit?: boolean,
    editUrl?: string,
    prev?: { title: string, slug: string } | null,
    next?: { title: string, slug: string } | null,
    breadcrumbs?: { label: string, href: string }[]
}) {
    const [headings, setHeadings] = React.useState<{ id: string; text: string; level: number }[]>([]);

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
        <div className="flex flex-col xl:flex-row gap-12 relative items-start">
            <article className="flex-1 min-w-0 animate-in fade-in slide-in-from-bottom-4 duration-500 w-full">
                <header className="mb-8 border-b border-white/5 pb-8">
                    {breadcrumbs && <DocBreadcrumbs items={breadcrumbs} />}
                    <h1 className="text-4xl md:text-5xl font-black text-white font-heading tracking-tight mb-4 text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-400">
                        {title}
                    </h1>
                    <div className="flex items-center justify-between gap-4 text-sm text-zinc-500">
                        <span>Mis à jour le {format(new Date(lastUpdate), "d MMMM yyyy", { locale: fr })}</span>

                        {canEdit && editUrl && (
                            <Link
                                href={editUrl}
                                className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-300 transition-colors font-medium border border-indigo-500/20"
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
            {headings.length > 0 && (
                <aside className="hidden xl:block w-64 shrink-0 sticky top-24 max-h-[calc(100vh-8rem)] overflow-y-auto pr-4 scrollbar-thin scrollbar-thumb-white/5">
                    <div className="space-y-4">
                        <h4 className="text-xs font-black uppercase tracking-widest text-zinc-500 px-2 flex items-center gap-2">
                            <div className="w-1 h-3 bg-indigo-500 rounded-full" />
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
                    </div>
                </aside>
            )}
        </div>
    );
}
