/**
 * Helpers de résolution des donjons « double boss » (ex. « Comte et Klime »).
 *
 * Problème : pour afficher la bonne « Balcon de … » dans le sélecteur de salle, on a besoin
 * du nom EXACT du monstre Dofensive (ex. « Klime »), pas du nom affiché du donjon
 * (« Comte et Klime »). Ces helpers dérivent ce nom de monstre à partir du nom affiché,
 * de façon robuste et réutilisable côté serveur ET côté client.
 *
 * Module pur (aucun import serveur) → importable par les composants React.
 */

/** Petit-fixe les noms dérivés : minuscules, sans accents (même normalisation que `norm`). */
function normLite(s: string): string {
    return String(s ?? "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[’'`]/g, "'")
        .replace(/\s*\(\d+\)$/, "")
        .replace(/[\s\-_]+/g, " ")
        .trim();
}

/**
 * Extrait le nom du monstre Dofensive cible d'un libellé du type « Comte et Klime ».
 *
 * Le format « X et Y » (le « et » est le connecteur, pas un mot du nom) est celui des
 * doubles boss du Comte Harebourg : « Comte et Klime », « Comte et Sylargh », etc.
 * On retourne la partie APRÈS le « et » (« Klime »), ou la suite la plus longue de mots
 * qui ne sont pas des stop-words de liaison.
 *
 * Retourne `null` si aucun monstre ne peut être dérivé (donjon solo / nom simple).
 */
export function deriveDofensiveMonsterName(displayName: string | null | undefined): string | null {
    const raw = String(displayName ?? "").trim();
    if (!raw) return null;

    const normName = normLite(raw);
    // Séparateurs de double boss : « et », « & », « + ». On garde la portion finale.
    const parts = normName.split(/\s+(?:et|&|\+)\s+/);
    if (parts.length >= 2) {
        const tail = parts[parts.length - 1].trim();
        if (tail) return tail;
    }

    // Fallback minimaliste : token final si le nom contient exactement 2 mots « X Y »
    // (n'aide pas « Comte et Klime », mais couvre « X & Y » sans espaces).
    return null;
}

/**
 * Retourne le « key » de résolution du monstre : priorité au monstre Dofensive explicitement
 * configuré (`dofensiveMonsterName`), sinon dérivé du nom affiché (« Comte et Klime » → « klime »),
 * sinon le nom de boss complet normalisé.
 */
export function resolveMonsterKey(
    dofensiveMonsterName: string | null | undefined,
    displayName: string | null | undefined
): string {
    if (dofensiveMonsterName && dofensiveMonsterName.trim()) {
        return normLite(dofensiveMonsterName);
    }
    const derived = deriveDofensiveMonsterName(displayName);
    if (derived) return derived;
    return normLite(displayName ?? "");
}
