"use client";

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PageLink {
    title: string;
    slug: string;
}

export function DocPagination({ prev, next }: { prev?: PageLink | null, next?: PageLink | null }) {
    if (!prev && !next) return null;

    return (
        <div className="flex flex-col sm:flex-row gap-4 pt-12 mt-12 border-t border-white/5">
            {prev ? (
                <Link
                    href={`/docs/${prev.slug}`}
                    className="flex-1 group flex flex-col items-start gap-2 p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all"
                >
                    <span className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-zinc-500 group-hover:text-indigo-400 transition-colors">
                        <ChevronLeft className="w-3 h-3" />
                        Précédent
                    </span>
                    <span className="text-lg font-bold text-zinc-300 group-hover:text-white transition-colors">
                        {prev.title}
                    </span>
                </Link>
            ) : (
                <div className="flex-1" />
            )}

            {next ? (
                <Link
                    href={`/docs/${next.slug}`}
                    className="flex-1 group flex flex-col items-end gap-2 p-6 rounded-2xl border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] hover:border-white/10 transition-all text-right"
                >
                    <span className="flex items-center gap-1 text-xs font-black uppercase tracking-widest text-zinc-500 group-hover:text-indigo-400 transition-colors">
                        Suivant
                        <ChevronRight className="w-3 h-3" />
                    </span>
                    <span className="text-lg font-bold text-zinc-300 group-hover:text-white transition-colors">
                        {next.title}
                    </span>
                </Link>
            ) : (
                <div className="flex-1" />
            )}
        </div>
    );
}
