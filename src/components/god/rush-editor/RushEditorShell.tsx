"use client";

/**
 * Coquille du studio (E1) : **trois panneaux** — arbre / contenu / inspecteur — sous la
 * barre unique du studio (`RushEditorTopbar`, montée par `RushEditorStudio`). Responsive :
 *   · ≥ 1280 px : arbre + contenu + inspecteur côte à côte (inspecteur 460–560 px) ;
 *   · 768–1279 px : arbre en `Sheet` (bouton « Arbre »), contenu + inspecteur ;
 *   · < 768 px : contenu seul, arbre **et** inspecteur en `Sheet`.
 *
 * ⚠️ Le seuil des trois colonnes est **1280 px**, pas 1024 : à 1024–1279, les trois
 * colonnes laissaient ~380 px au contenu et ~360 px à l'inspecteur (retour user du
 * 10/11 : « le bandeau de droite est trop peu large, pas agréable »).
 *
 * L'arbre et l'inspecteur sont `sticky` : la position ne se perd plus quand la liste
 * défile. `Ctrl+K` ouvre la palette (rendue par le studio) ; la garde de saisie et la
 * palette vivent au niveau du studio, pas ici.
 */

import { useEffect, useState, type ReactNode } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

/** Vrai tant que la fenêtre est **plus étroite** que le seuil (pilote les tiroirs). */
function useBelowWidth(minWidthPx: number): boolean {
  const [below, setBelow] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${minWidthPx - 1}px)`);
    const update = () => setBelow(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, [minWidthPx]);
  return below;
}

export function RushEditorShell({
  tree,
  list,
  inspector,
  treeOpen,
  onTreeOpenChange,
  inspectorOpen,
  onInspectorOpenChange,
  onOpenPalette,
}: {
  tree: ReactNode;
  list: ReactNode;
  inspector: ReactNode;
  treeOpen: boolean;
  onTreeOpenChange: (open: boolean) => void;
  inspectorOpen: boolean;
  onInspectorOpenChange: (open: boolean) => void;
  onOpenPalette: () => void;
}) {
  const belowXl = useBelowWidth(1280);
  const belowMd = useBelowWidth(768);

  // Ctrl+K / Cmd+K — le raccourci vit dans la coquille, pas dans chaque panneau.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenPalette();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenPalette]);

  return (
    <div className="flex flex-col" data-rush-editor-shell>
      <div className="grid grid-cols-1 items-start gap-3 px-3 py-3 md:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] xl:grid-cols-[260px_minmax(0,1fr)_minmax(460px,560px)] 2xl:grid-cols-[260px_minmax(0,1fr)_minmax(520px,720px)]">
        <aside aria-label="Arbre du guide" className="hidden min-w-0 xl:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-border bg-surface">
            {tree}
          </div>
        </aside>

        <section aria-label="Contenu du chapitre" className="min-w-0 space-y-3">
          {list}
        </section>

        <aside aria-label="Panneau d'édition" className="hidden min-w-0 md:block">
          <div className="sticky top-24 max-h-[calc(100vh-7rem)] overflow-y-auto rounded-xl border border-border bg-surface">
            {inspector}
          </div>
        </aside>
      </div>

      {/* < 1280 px — l'arbre passe en tiroir (le contenu garde toute la largeur). */}
      {belowXl && (
        <Sheet open={treeOpen} onOpenChange={onTreeOpenChange}>
          <SheetContent side="left" className="w-[min(20rem,calc(100vw-2rem))] overflow-y-auto p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Arbre du guide</SheetTitle>
              <SheetDescription>Chapitres, blocs et quêtes</SheetDescription>
            </SheetHeader>
            {tree}
          </SheetContent>
        </Sheet>
      )}

      {/* < 768 px — l'inspecteur passe en tiroir, ouvert à la sélection. */}
      {belowMd && (
        <Sheet open={inspectorOpen} onOpenChange={onInspectorOpenChange}>
          <SheetContent side="right" className="w-[min(34rem,calc(100vw-2rem))] overflow-y-auto p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Inspecteur</SheetTitle>
              <SheetDescription>Édition du bloc ou de la quête sélectionnée</SheetDescription>
            </SheetHeader>
            {inspector}
          </SheetContent>
        </Sheet>
      )}

    </div>
  );
}
