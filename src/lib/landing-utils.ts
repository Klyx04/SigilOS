/**
 * Garde-fous de la landing publique (fonctions pures, testées).
 */

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
