"use client";

import { useEffect, useLayoutEffect, useRef, type DependencyList, type RefObject } from "react";

/**
 * Fil de sève — la longueur du fil est **mesurée**, jamais devinée.
 *
 * Règle de la maquette (`growRails()`) : le fil s'arrête à la première quête ni
 * validée ni verrouillée — `offsetTop` du nœud + 26 px, moins les 20 px de départ
 * du tracé. Tout le chapitre est validé ⇒ il va jusqu'au bout, à 48 px du bas.
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
            const height = target
                ? target.offsetTop + 26
                : rows.length > 0
                    ? rail.clientHeight - 48
                    : 0;
            rail.style.setProperty("--da-grow", `${Math.max(0, height - 20)}px`);
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
