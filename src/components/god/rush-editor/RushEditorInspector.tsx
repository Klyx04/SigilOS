"use client";

/**
 * Hôte de l'inspecteur (E1) : un cadre, un titre, un bouton de fermeture.
 *
 * Il ne **sait rien** des formulaires : le studio lui passe `children` (le formulaire
 * existant monté tel quel). C'est ce qui garantit qu'aucun formulaire ne vit dans la
 * liste — la seule porte d'édition est ici.
 */

import type { ReactNode } from "react";
import { X } from "lucide-react";

export function RushEditorInspector({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string;
  subtitle?: string | null;
  onClose?: () => void;
  children: ReactNode;
}) {
  return (
    <section aria-label="Inspecteur" className="flex h-full min-h-0 flex-col" data-rush-editor-inspector>
      <header className="flex items-start justify-between gap-2 border-b border-border px-3 py-2">
        <div className="min-w-0">
          <p className="text-caption uppercase tracking-wide text-muted-foreground">Inspecteur</p>
          <h2 className="truncate text-sm font-semibold text-foreground">{title}</h2>
          {subtitle && <p className="truncate text-caption text-muted-foreground">{subtitle}</p>}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'inspecteur"
            className="shrink-0 rounded-lg border border-border bg-surface p-1.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        )}
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">{children}</div>
    </section>
  );
}

/** État vide de l'inspecteur : on dit quoi faire, on ne laisse pas un cadre blanc. */
export function RushEditorInspectorEmpty() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-border p-6 text-center">
      <p className="text-sm font-medium text-foreground">Rien de sélectionné</p>
      <p className="text-xs text-muted-foreground">
        Choisissez un bloc ou une quête dans l'arbre pour l'éditer ici.{" "}
        <kbd className="rounded border border-border bg-muted px-1 text-caption">Ctrl K</kbd> ouvre la palette.
      </p>
    </div>
  );
}
