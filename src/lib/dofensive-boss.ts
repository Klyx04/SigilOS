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

/**
 * Choisit l'ID Dofensive du monstre à interroger pour `requestedName` parmi les
 * **membres du donjon** (`monsters`), et non systématiquement le boss du donjon.
 *
 * 🐞 Bug corrigé : `getBossDofensiveSpells` prenait toujours `bossMonsterId` ⇒ une fiche de
 * **monstre de salle** (ex. « Tambourreau ») affichait les sorts du **boss** (« Servitude »),
 * aussi bien dans les onglets du dashboard que dans la simulation.
 *
 * Ordre de résolution :
 *  1. correspondance **exacte** normalisée (minuscules, sans accents) ;
 *  2. correspondance **partielle unique** (« Kardorim » ↔ « Kardorim le Ténébreux », noms
 *     DofusDB/Dofensive légèrement différents) — uniquement si elle est **non ambiguë** ;
 *  3. repli sur `bossMonsterId` (comportement historique) : le monstre demandé n'existe pas
 *     dans la famille Dofensive (nommage trop éloigné) ou c'est le boss/l'entité principale.
 *
 * Retourne `null` si aucun ID exploitable (le caller garde alors son message d'erreur).
 */
export function pickDofensiveMonsterId(
    monsters: Array<{ id: number; name: string }> | null | undefined,
    requestedName: string | null | undefined,
    bossMonsterId: number | null | undefined
): number | null {
    const list = (Array.isArray(monsters) ? monsters : [])
        .map((m) => ({ id: Number(m?.id), name: String(m?.name ?? "") }))
        .filter((m) => Number.isFinite(m.id) && m.id > 0);
    const wanted = normLite(requestedName ?? "");

    if (list.length > 0 && wanted) {
        const exact = list.find((m) => normLite(m.name) === wanted);
        if (exact) return exact.id;

        const partial = list.filter((m) => {
            const n = normLite(m.name);
            return n.length >= 4 && wanted.length >= 4 && (n.includes(wanted) || wanted.includes(n));
        });
        if (partial.length === 1) return partial[0].id;
        if (partial.length > 1) {
            // Ambigu (ex. « Tursoel » face à « Tursoel Sauvage »/« Tursoel Affamé ») :
            // on préfère le nom le plus proche en longueur, à défaut le boss.
            const closest = partial.slice().sort((a, b) => {
                const da = Math.abs(normLite(a.name).length - wanted.length);
                const db = Math.abs(normLite(b.name).length - wanted.length);
                return da - db;
            })[0];
            if (closest) return closest.id;
        }
    }

    const boss = Number(bossMonsterId);
    return Number.isFinite(boss) && boss > 0 ? boss : null;
}

