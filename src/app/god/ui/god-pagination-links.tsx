/**
 * GodPaginationLinks — pagination **serveur** du kit God.
 *
 * `GodPagination` est un composant client qui pilote un état (`onPageChange`). Les
 * écrans rendus côté serveur (visiteurs, journaux) paginent par **URL** : ce
 * composant produit des liens réels, donc la page reste partageable et fonctionne
 * sans JavaScript. Même habillage que `GodPagination`, même règle de fenêtre.
 */

import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { paginationWindow } from "@/lib/audit-log-view";

export function GodPaginationLinks({
    page,
    totalPages,
    total,
    hrefForPage,
    label = "entrée",
    className,
}: {
    page: number;
    totalPages: number;
    total: number;
    /** Construit l'URL d'une page ; reçoit une page **bornée**. */
    hrefForPage: (page: number) => string;
    label?: string;
    className?: string;
}) {
    const current = totalPages > 0 ? Math.min(Math.max(page, 1), totalPages) : 1;
    const window = paginationWindow(current, totalPages);

    return (
        <div className={cn("flex flex-wrap items-center gap-3", className)}>
            <span className="text-caption font-semibold text-muted-foreground tabular-nums">
                {total} {label}
                {total > 1 ? "s" : ""} · page {current} / {totalPages}
            </span>

            <div className="flex items-center gap-1">
                {current <= 1 ? (
                    <span aria-disabled="true" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-elevated text-muted-foreground opacity-30">
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </span>
                ) : (
                    <Link
                        href={hrefForPage(current - 1)}
                        aria-label="Page précédente"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-elevated text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                    </Link>
                )}

                {window.map((entry, index) =>
                    entry === "gap" ? (
                        <span key={`gap-${index}`} className="px-1 text-caption text-muted-foreground">
                            …
                        </span>
                    ) : entry === current ? (
                        <span
                            key={entry}
                            aria-current="page"
                            className="h-8 min-w-8 rounded-lg border border-foreground/30 bg-foreground px-2 text-center text-caption font-bold leading-8 text-background tabular-nums"
                        >
                            {entry}
                        </span>
                    ) : (
                        <Link
                            key={entry}
                            href={hrefForPage(entry)}
                            aria-label={`Page ${entry}`}
                            className="h-8 min-w-8 rounded-lg border border-border bg-elevated px-2 text-center text-caption font-bold leading-8 text-muted-foreground tabular-nums transition-colors hover:text-foreground"
                        >
                            {entry}
                        </Link>
                    ),
                )}

                {current >= totalPages ? (
                    <span aria-disabled="true" className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-elevated text-muted-foreground opacity-30">
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </span>
                ) : (
                    <Link
                        href={hrefForPage(current + 1)}
                        aria-label="Page suivante"
                        className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-elevated text-muted-foreground transition-colors hover:text-foreground"
                    >
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                )}
            </div>
        </div>
    );
}
