"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 📱 **Tableau → cartes** (chantier A3, 28/09/2026).
 *
 * Constat mesuré : les tableaux d'administration game-data (Journal, « État des datasets »,
 * « Santé des données ») étaient enveloppés dans un `overflow-x-auto` avec `min-w-[46rem]`.
 * Sur un téléphone (390 px), l'utilisateur ne voit que **trois colonnes sur six** et doit
 * faire défiler horizontalement pour lire une ligne — le pire cas pour des données
 * tabulaires (§ « affichage mobile »).
 *
 * Règle :
 *   1. **sous 768 px** (`md` de Tailwind, seuil des cartes) ⇒ cartes ;
 *   2. **au-dessus**, le tableau reste — *sauf* s'il déborde réellement de son conteneur
 *      (`scrollWidth > clientWidth`), auquel cas on garde les cartes : **un débordement
 *      mesuré bat une supposition de breakpoint**.
 *
 * ⚠️ La mesure ne tourne **que** sur `resize` et au montage : jamais pendant un rendu, jamais
 * en boucle (masquer le tableau ne peut donc pas relancer une mesure qui le réaffiche).
 * En premier rendu (SSR + hydratation), ce sont les classes CSS (`hidden md:block` /
 * `md:hidden`) qui décident : aucune ligne « brute » n'est peinte sur mobile avant la mesure.
 */

/** Seuil (px) sous lequel les cartes sont la seule mise en page lisible — `md` de Tailwind. */
export const RESPONSIVE_TABLE_CARD_MAX_WIDTH = 768;

export interface ResponsiveTable {
    /** À poser sur le conteneur qui **contient le tableau** (celui qui porte `overflow-x-auto`). */
    containerRef: React.RefObject<HTMLDivElement | null>;
    /** `true` ⇒ afficher les cartes, `false` ⇒ tableau (≥ 768 px et aucun débordement mesuré). */
    useCards: boolean;
}

/**
 * Classes **uniques** du couple tableau/cartes (deux panneaux les partagent : « État des
 * datasets » et « Santé des données ») — la règle du seuil vit ici, jamais recopiée par écran :
 *   · `table` : masqué sous 768 px (`hidden`), visible au-delà (`md:block`) ;
 *   · `cards` : l'inverse (`md:hidden`) ;
 * dès que la mesure impose les cartes, le tableau disparaît **quelle que soit la largeur**
 * (le débordement mesuré bat le breakpoint) et les cartes prennent la place.
 *
 * Le premier rendu (SSR + hydratation, avant mesure) suit donc les classes : aucune ligne brute
 * n'est peinte sur un téléphone.
 */
export function responsiveTableSlots(useCards: boolean): { table: string; cards: string } {
    return useCards
        ? { table: "hidden", cards: "space-y-2" }
        : { table: "hidden md:block", cards: "space-y-2 md:hidden" };
}

export function useResponsiveTable(): ResponsiveTable {
    const containerRef = useRef<HTMLDivElement | null>(null);
    const [narrow, setNarrow] = useState(false);
    const [overflowing, setOverflowing] = useState(false);

    const measure = useCallback(() => {
        if (typeof window === "undefined") return;
        const isNarrow = window.innerWidth < RESPONSIVE_TABLE_CARD_MAX_WIDTH;
        setNarrow(isNarrow);
        // Sous le seuil, le débordement n'a plus de sens (les cartes sont la mise en page) : on
        // oublie la mesure précédente pour qu'un retour en largeur reparte d'un tableau réel.
        if (isNarrow) {
            setOverflowing(false);
            return;
        }
        const el = containerRef.current;
        if (!el) return;
        // ⚠️ Conteneur masqué (`useCards` ⇒ `hidden`) : `clientWidth`/`scrollWidth` valent **0**, la
        // mesure est fausse. On garde donc la dernière mesure vraie — sinon un simple `resize`
        // réafficherait le tableau qui débordait, et le débordement mesuré ne vaudrait plus rien.
        if (el.clientWidth === 0) return;
        // +1 : arrondi sous-pixel de `clientWidth` (sinon un débordement de 0,5 px bascule les cartes).
        setOverflowing(el.scrollWidth > el.clientWidth + 1);
    }, []);

    useEffect(() => {
        measure();
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [measure]);

    return { containerRef, useCards: narrow || overflowing };
}
