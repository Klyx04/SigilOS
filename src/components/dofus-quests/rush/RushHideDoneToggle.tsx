"use client";

import { Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * **Masquer / afficher les étapes faites** — un seul contrôle, une seule grammaire
 * sur les trois surfaces.
 *
 * Demande user du 25/11/2026 : le bouton du dashboard était un « Masquer » discret
 * dans la barre du haut, et la PiP n'en montrait qu'une icône dans un menu. Ici le
 * libellé est explicite, le compteur dit ce qui est masqué, et le bouton vit à côté
 * de la recherche (là où l'on agit sur la liste).
 */
export function RushHideDoneToggle({
  hidden,
  onToggle,
  count = 0,
  locale = "fr",
  compact = false,
  className,
}: {
  hidden: boolean;
  onToggle: () => void;
  /** Nombre d'étapes réellement masquées (badge discret, jamais un compteur faux). */
  count?: number;
  locale?: "fr" | "en";
  compact?: boolean;
  className?: string;
}) {
  const label = hidden
    ? locale === "en"
      ? "Show completed steps"
      : "Afficher les étapes faites"
    : locale === "en"
      ? "Hide completed steps"
      : "Masquer les étapes faites";

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={hidden}
      aria-label={label}
      title={label}
      data-tour="rush-hide-done"
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-[4px] border text-xs font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-accent/60",
        compact ? "px-2.5 py-1.5" : "px-3 py-2",
        hidden
          ? "border-accent/60 bg-accent/10 text-foreground"
          : "border-border bg-surface text-muted-foreground hover:border-foreground/20 hover:text-foreground",
        className,
      )}
    >
      {hidden ? (
        <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      ) : (
        <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      )}
      <span>{label}</span>
      {count > 0 ? (
        <span
          className={cn(
            "ml-0.5 rounded-full px-1.5 py-0.5 font-mono text-[10px] tabular-nums",
            hidden ? "bg-accent/20 text-foreground" : "bg-muted text-muted-foreground",
          )}
        >
          {count > 99 ? "99+" : count}
        </span>
      ) : null}
    </button>
  );
}
