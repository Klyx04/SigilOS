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
        <nav
            className="mt-10 flex flex-col gap-3 border-t border-border pt-6 sm:flex-row"
            aria-label="Navigation dans la documentation"
        >
            {prev ? (
                <Link
                    href={`/docs/${prev.slug}`}
                    className="group flex flex-1 items-start gap-3 rounded-[4px] border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-elevated"
                >
                    <ChevronLeft className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0">
                        <span className="block text-[11px] text-muted-foreground">Précédent</span>
                        <span className="mt-0.5 block truncate text-[14px] font-semibold text-foreground">{prev.title}</span>
                    </span>
                </Link>
            ) : (
                <div className="flex-1" />
            )}

            {next ? (
                <Link
                    href={`/docs/${next.slug}`}
                    className="group flex flex-1 items-start gap-3 rounded-[4px] border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-elevated"
                >
                    <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                    <span className="min-w-0">
                        <span className="block text-[11px] text-muted-foreground">Suivant</span>
                        <span className="mt-0.5 block truncate text-[14px] font-semibold text-foreground">{next.title}</span>
                    </span>
                </Link>
            ) : (
                <div className="flex-1" />
            )}
        </nav>
    );
}
