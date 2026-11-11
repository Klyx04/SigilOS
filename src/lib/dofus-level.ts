/**
 * Niveaux Dofus — règle pure (aucune I/O).
 *
 * Dofus plafonne le niveau **normal** à 200. Au-delà, le personnage continue en
 * **niveaux Oméga** : le ladder Ankama (fiche succès **et** fiche générale) renvoie
 * alors le **niveau Oméga** (128 pour Oméga 128), jamais le niveau total. Afficher
 * « 128 » sans le dire est faux : le personnage est niveau 200 + Oméga 128.
 *
 * Convention du dépôt (déjà celle des mules, `MULE_OMEGA_BASE`) : on stocke et on
 * manipule le **niveau total** (200 + Oméga, borné à 400), et on l'affiche « Ω 128 ».
 * Le seul signal qui distingue un niveau 128 normal d'un Oméga 128 est l'XP totale :
 * au-delà du cumul du niveau 200 (4 716 600 000 XP ; le dernier palier 199→200 en
 * représente 1 847 000 000), le personnage a passé le niveau 200. Mesure du
 * 11/11/2026 sur un Oméga 128 : ladder succès/général `level = 128`,
 * `totalXp = 18 441 163 609`.
 *
 * `toTotalDofusLevel` est **idempotent** : un niveau déjà total (328) reste 328,
 * un niveau courant (128) + son XP totale devient 328. Les anciennes lignes en base
 * (niveau courant + `totalXp` déjà stocké) s'affichent donc correctement sans
 * attendre une resynchro.
 */

/** Niveau normal maximum (le niveau 200). */
export const DOFUS_LEVEL_MAX = 200;
/** Niveau total maximum (niveau 200 + Oméga 200), comme les mules. */
export const DOFUS_LEVEL_TOTAL_MAX = 400;
/** Cumul d'XP du niveau 200 (le dernier palier 199→200 vaut 1 847 000 000). */
export const DOFUS_LEVEL_200_XP = 4_716_600_000n;

type XpValue = bigint | number | string | null | undefined;

function readTotalXp(value: XpValue): bigint | null {
    if (typeof value === "bigint") return value > 0n ? value : null;
    if (typeof value === "number") {
        return Number.isFinite(value) && value > 0 ? BigInt(Math.floor(value)) : null;
    }
    if (typeof value === "string") {
        const digits = value.replace(/\D/g, "").slice(0, 15);
        if (!digits) return null;
        const xp = BigInt(digits);
        return xp > 0n ? xp : null;
    }
    return null;
}

/**
 * Niveau courant du ladder → **niveau total** (200 + Oméga).
 * - > 200 : déjà un total (ou un niveau total renvoyé par une autre source) → tel quel ;
 * - < 200 avec une XP > cumul 200 : Oméga → 200 + niveau ;
 * - sinon : niveau normal inchangé.
 * `null` si le niveau n'est pas exploitable ; jamais un chiffre inventé.
 */
export function toTotalDofusLevel(level: number | null | undefined, totalXp: XpValue): number | null {
    if (typeof level !== "number" || !Number.isFinite(level) || level <= 0) return null;
    const current = Math.floor(level);
    if (current > DOFUS_LEVEL_MAX) {
        return Math.min(current, DOFUS_LEVEL_TOTAL_MAX);
    }
    const xp = readTotalXp(totalXp);
    if (current < DOFUS_LEVEL_MAX && xp !== null && xp > DOFUS_LEVEL_200_XP) {
        return Math.min(current + DOFUS_LEVEL_MAX, DOFUS_LEVEL_TOTAL_MAX);
    }
    return Math.min(current, DOFUS_LEVEL_TOTAL_MAX);
}

/**
 * Libellé **compact** d'un niveau total : « Ω 128 » pour un Oméga, « 128 » pour un
 * niveau normal, « — » si absent. Le libellé « Niveau » de l'écran reste devant.
 */
export function formatDofusLevel(level: number | null | undefined): string {
    if (typeof level !== "number" || !Number.isFinite(level) || level <= 0) return "—";
    const total = Math.min(Math.floor(level), DOFUS_LEVEL_TOTAL_MAX);
    return total > DOFUS_LEVEL_MAX ? `Ω ${total - DOFUS_LEVEL_MAX}` : String(total);
}

/**
 * Libellé **avec le total** (mules, éditeur) : « Ω 75 (niv. 275) », « Niv. 128 ».
 * `null` si le niveau est absent (l'appelant décide de ne rien afficher).
 */
export function formatDofusLevelWithBase(level: number | null | undefined): string | null {
    if (typeof level !== "number" || !Number.isFinite(level) || level <= 0) return null;
    const total = Math.min(Math.floor(level), DOFUS_LEVEL_TOTAL_MAX);
    return total > DOFUS_LEVEL_MAX ? `Ω ${total - DOFUS_LEVEL_MAX} (niv. ${total})` : `Niv. ${total}`;
}
