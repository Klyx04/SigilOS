"use client";

/**
 * Sondages — **tuiles de thématique** partagées par les deux modales de création
 * (sondage classique et sondage programmé).
 *
 * Pourquoi un composant unique : les deux modales affichaient la même liste de
 * catégories de deux façons différentes — un `select` nu côté module staff, des
 * tuiles côté module membre. Deux rendus, deux largeurs, deux resynchronisations
 * le jour où une catégorie change ; ici, une seule source (et le juste milieu
 * demandé : vivant, jamais bariolé).
 *
 * Contraintes de rendu : **3 colonnes** sur petit écran (un libellé comme
 * « AMÉLIORATION » débordait en 5 colonnes), 5 au-delà ; le texte est borné à sa
 * tuile (`overflow-hidden`, `break-words`, `hyphens-auto`).
 */

import { cn } from "@/lib/utils";

export const POLL_CATEGORY_OPTIONS = [
    { value: "SUGGESTION", label: "Suggestion", emoji: "💡", color: "text-info" },
    { value: "AMELIORATION", label: "Amélioration", emoji: "🔧", color: "text-success" },
    { value: "EVENT", label: "Événement", emoji: "🎉", color: "text-warning" },
    { value: "MISSION", label: "Mission", emoji: "🎯", color: "text-danger" },
    { value: "AUTRE", label: "Autres", emoji: "📋", color: "text-muted-foreground" },
] as const;

export type PollCategoryValue = (typeof POLL_CATEGORY_OPTIONS)[number]["value"];

export function PollCategoryTiles({
    value,
    onChange,
    className,
}: {
    value: string;
    onChange: (value: PollCategoryValue) => void;
    className?: string;
}) {
    return (
        <div className={cn("grid grid-cols-3 sm:grid-cols-5 gap-2", className)}>
            {POLL_CATEGORY_OPTIONS.map((option) => {
                const isSelected = value === option.value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(option.value)}
                        aria-pressed={isSelected}
                        className={cn(
                            "relative flex flex-col items-center justify-center gap-1 p-2.5 rounded-lg border transition-colors overflow-hidden min-w-0",
                            isSelected
                                ? "bg-surface border-border-strong"
                                : "bg-surface/60 border-border hover:bg-surface opacity-70"
                        )}
                    >
                        <span className="text-lg leading-none">{option.emoji}</span>
                        <span className={cn(
                            "text-[10px] leading-tight font-semibold uppercase tracking-tight text-center break-words hyphens-auto max-w-full min-w-0 w-full",
                            isSelected ? option.color : "text-muted-foreground"
                        )}>
                            {option.label}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}
