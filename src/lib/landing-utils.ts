/**
 * Landing — helpers publics (fonctions pures, testées).
 */

import type { PublicLandingScreen } from "@/server/actions/landing-screen-actions";

/**
 * Un libellé d'écran God n'est montrable sur la landing que s'il ressemble à
 * un vrai libellé : on masque les brouillons de test ("test1", "tmp", "essai"…)
 * pour qu'ils ne fuient jamais sur la page publique.
 */
export function isPublicLandingLabel(label: string | null | undefined): boolean {
    const clean = (label || "").trim();
    if (clean.length < 3) return false;
    return !/^(test|tmp|essai|draft|brouillon|aaa|zzz)[\s\-_0-9]*$/i.test(clean);
}

/** Un groupe d'écrans partageant le même libellé God (ex. « Guides » + 2 captures). */
export interface PublicScreenGroup {
    key: string;
    label: string;
    title?: string | null;
    description?: string | null;
    images: PublicLandingScreen[];
}

/**
 * Regroupe les écrans God par libellé partagé, en écartant les brouillons.
 *
 * La refonte a supprimé les « onglets produit » (navigation par catégories
 * marketing) : les groupes servent désormais de **légende de figure**, chaque
 * groupe devenant une capture annotée. Le filtrage des libellés de test reste
 * indispensable — c'est ce qui empêchait « test1 » d'apparaître en public.
 */
export function groupPublicScreens(screens: PublicLandingScreen[]): PublicScreenGroup[] {
    const map = new Map<string, PublicScreenGroup>();
    for (const screen of (screens || []).filter((entry) => isPublicLandingLabel(entry.label))) {
        const key = (screen.label || "").toLowerCase().trim() || screen.id;
        const existing = map.get(key);
        if (existing) {
            existing.images.push(screen);
            continue;
        }
        map.set(key, {
            key,
            label: screen.label || screen.id,
            title: screen.title,
            description: screen.description,
            images: [screen],
        });
    }
    return Array.from(map.values());
}

/** Première capture exploitable d'un lot de sections, sinon `null`. */
export function firstPublicScreen(screen: PublicLandingScreen | undefined | null): PublicLandingScreen | null {
    if (!screen) return null;
    if (!screen.imageUrl) return null;
    return screen;
}

/**
 * Récupère la capture God dont le libellé correspond à un sujet (ex. les
 * sorties), afin d'illustrer la bonne section de la landing. Retourne `null`
 * si rien ne correspond : la section garde alors sa capture par défaut.
 */
export function findPublicScreen(screens: PublicLandingScreen[], pattern: RegExp): PublicLandingScreen | null {
    return firstPublicScreen((screens || []).find((screen) => pattern.test(screen.label || "")));
}


