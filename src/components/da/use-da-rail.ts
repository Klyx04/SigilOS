"use client";

import { useEffect, useLayoutEffect, useRef, type DependencyList, type RefObject } from "react";
import { daRailGrow } from "@/lib/da-rail-geometrie";

/**
 * Fil de sève — la longueur du fil est **mesurée**, jamais devinée.
 *
 * Règle de la maquette (`growRails()`) : le fil s'arrête à la première quête ni
 * validée ni verrouillée — position du nœud + 26 px, moins les 20 px de départ
 * du tracé. Tout le chapitre est validé ⇒ il va jusqu'au bout, à 48 px du bas.
 * L'arithmétique vit dans `src/lib/da-rail-geometrie.ts` (règle pure, testée) ;
 * ce hook ne fait que lire la géométrie et la lui donner.
 *
 * ⚠️ Défaut mesuré le 05/11/2026 : lire `offsetTop` supposait des lignes filles
 * directes du rail. Le guide public enveloppe chaque quête dans son propre
 * `div.relative` (le panneau de la carte) : les 18 lignes rapportaient alors
 * `offsetTop = 12` et le fil restait figé à 18 px, sans jamais descendre. La
 * position est donc calculée par **différence de rectangles** — relative au rail,
 * insensible à l'imbrication et au défilement (les deux rectangles bougent ensemble).
 *
 * Mesuré **avant la peinture** (`useLayoutEffect`, repli `useEffect` au rendu
 * serveur) pour qu'aucun saut ne soit visible, puis ré-observé : un filtre, un
 * repli de chapitre ou un redimensionnement remesurent le fil.
 *
 * Extrait de `GuideOverlayClient` (E1e) pour que le guide plein écran applique
 * exactement la même règle : c'est la parité public ↔ interne, pas une copie.
 * L'élément rendu doit porter la classe `.da-rail` et ses enfants un `data-state`.
 */
export function useDaRail(deps: DependencyList): RefObject<HTMLDivElement | null> {
    const railRef = useRef<HTMLDivElement | null>(null);
    const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

    useIsomorphicLayoutEffect(() => {
        const rail = railRef.current;
        if (!rail) return;

        const grow = () => {
            const rows = rail.querySelectorAll<HTMLElement>("[data-state]");
            const target =
                rail.querySelector<HTMLElement>('[data-state="next"]') ??
                rail.querySelector<HTMLElement>('[data-state="todo"]');
            // `getBoundingClientRect` plutôt que `offsetTop` : la cible peut être
            // imbriquée dans une enveloppe positionnée (guide public), et seuls les
            // rectangles donnent une position relative au rail dans tous les montages.
            const railTop = rail.getBoundingClientRect().top;
            const targetOffset = target ? target.getBoundingClientRect().top - railTop : null;
            const height = daRailGrow({
                targetOffset,
                railHeight: rail.clientHeight,
                rowCount: rows.length,
            });
            rail.style.setProperty("--da-grow", `${height}px`);
        };

        grow();
        const ro = new ResizeObserver(grow);
        ro.observe(rail);
        return () => ro.disconnect();
        // Les dépendances viennent de l'appelant (liste de quêtes, chapitre, filtres) :
        // c'est le contrat du hook, on ne peut pas les connaître ici.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, deps);

    return railRef;
}
