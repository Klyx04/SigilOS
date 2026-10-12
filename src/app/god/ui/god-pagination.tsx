"use client";

/**
 * GodPagination — pagination **numérotée** du kit God (G6).
 *
 * Le viewer God n'avait qu'un « Page 1 / 2 ‹ › » : on ne savait ni où l'on était,
 * ni combien d'entrées restaient, et le « par page » n'existait pas. Ce composant
 * est la **seule** recette de pagination de la console : les écrans qui paginent
 * (journaux, accès délégués) le consomment, ils n'en réinventent pas un.
 *
 * `paginationWindow` (règle pure de `@/lib/audit-log-view`) décide des numéros
 * affichés ; ce composant ne calcule rien.
 */

import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { paginationWindow } from "@/lib/audit-log-view";

export function GodPagination({
    page,
    totalPages,
    onPageChange,
    total,
    pageSize,
    pageSizes,
    onPageSizeChange,
    disabled = false,
    className,
}: {
    page: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    /** Total d'entrées du périmètre courant (affiché tel quel). */
    total: number;
    pageSize?: number;
    pageSizes?: readonly number[];
    onPageSizeChange?: (size: number) => void;
    disabled?: boolean;
    className?: string;
}) {
    const window = paginationWindow(page, totalPages);
    const current = totalPages > 0 ? Math.min(Math.max(page, 1), totalPages) : 1;

    return (
        <div className={cn("flex flex-wrap items-center gap-3", className)}>
            <span className="text-caption font-semibold text-muted-foreground tabular-nums">
                {total} entrée{total > 1 ? "s" : ""} · page {current} / {totalPages}
            </span>

            <div className="flex items-center gap-1">
                <button
                    type="button"
                    onClick={() => onPageChange(current - 1)}
                    disabled={disabled || current <= 1}
                    aria-label="Page précédente"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-elevated text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                >
                    <ChevronLeft className="h-4 w-4" />
                </button>

                {window.map((entry, index) =>
                    entry === "gap" ? (
                        <span key={`gap-${index}`} className="px-1 text-caption text-muted-foreground">
                            …
                        </span>
                    ) : (
                        <button
                            key={entry}
                            type="button"
                            onClick={() => onPageChange(entry)}
                            disabled={disabled}
                            aria-label={`Page ${entry}`}
                            aria-current={entry === current ? "page" : undefined}
                            className={cn(
                                "h-8 min-w-8 rounded-lg border px-2 text-caption font-bold tabular-nums transition-colors",
                                entry === current
                                    ? "border-foreground/30 bg-foreground text-background"
                                    : "border-border bg-elevated text-muted-foreground hover:text-foreground",
                            )}
                        >
                            {entry}
                        </button>
                    ),
                )}

                <button
                    type="button"
                    onClick={() => onPageChange(current + 1)}
                    disabled={disabled || current >= totalPages}
                    aria-label="Page suivante"
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-elevated text-muted-foreground transition-colors hover:text-foreground disabled:opacity-30"
                >
                    <ChevronRight className="h-4 w-4" />
                </button>
            </div>

            {pageSize !== undefined && pageSizes && onPageSizeChange ? (
                <label className="flex items-center gap-2 text-caption text-muted-foreground">
                    <span>Par page</span>
                    <select
                        value={pageSize}
                        onChange={(event) => onPageSizeChange(Number(event.target.value))}
                        disabled={disabled}
                        className="h-8 rounded-lg border border-border bg-elevated px-2 text-caption text-foreground"
                    >
                        {pageSizes.map((size) => (
                            <option key={size} value={size}>
                                {size}
                            </option>
                        ))}
                    </select>
                </label>
            ) : null}
        </div>
    );
}
