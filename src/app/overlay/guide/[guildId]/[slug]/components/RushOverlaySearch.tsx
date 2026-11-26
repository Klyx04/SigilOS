"use client";

import React, { forwardRef } from "react";
import { ChevronUp, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface RushOverlaySearchProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  placeholder?: string;
  className?: string;
  /** PiP étroite : hauteur réduite, placeholder court, pas de raccourci `/`. */
  compact?: boolean;
  /** Replie la recherche (loupe de l'en-tête micro). */
  onClose?: () => void;
}

/**
 * Barre de recherche de l'overlay.
 * - Icône loupe + champ contrôlé + bouton effacer + raccourci `/`.
 * - Le raccourci clavier `/` et la gestion `Escape` sont gérés par le parent
 *   (GuideOverlayClient) qui détient l'état et le focus.
 */
export const RushOverlaySearch = forwardRef<HTMLInputElement, RushOverlaySearchProps>(
  function RushOverlaySearch(
    { value, onChange, onClear, placeholder, className, compact = false, onClose },
    ref
  ) {
    return (
      <div
        className={cn(
          "da-search flex shrink-0 items-center gap-2 transition-colors motion-reduce:transition-none",
          compact ? "h-8 mx-2 mt-2 mb-2 px-2.5" : "h-9 mx-3 mt-3 mb-2.5 px-3",
          className
        )}
      >
        <Search className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />

        <input
          ref={ref}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder ?? (compact ? "Rechercher…" : "Rechercher une quête, zone, donjon…")}
          aria-label="Rechercher"
          className="min-w-0 flex-1 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground"
        />

        {value && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Effacer la recherche"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}

        {!compact && (
          <kbd className="rounded border border-border-strong px-1.5 py-0.5 font-mono text-[9px] font-semibold text-muted-foreground">
            /
          </kbd>
        )}

        {compact && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Replier la recherche"
            title="Replier la recherche"
            className="rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground motion-reduce:transition-none"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    );
  }
);
