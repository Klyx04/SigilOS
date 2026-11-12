/**
 * Ladder Ankama — **noyau partagé du snapshot** (V1e).
 *
 * Pourquoi ce module : le même bloc vivait **inline** dans `updateUserProfile`
 * (`src/server/actions/profile-actions.ts`, l. 843-887). Le profil public a besoin de la même
 * chose ; le recopier aurait fait deux comportements à maintenir (arrondis, plafonds, timeout)
 * qui divergent au premier changement.
 *
 * Invariants :
 *  · **fail-open** : worker absent, en panne ou lent ⇒ snapshot vide, jamais une exception —
 *    la sauvegarde du profil ne doit pas échouer pour un classement indisponible ;
 *  · **borné** : l'XP est réduite à ses chiffres (15 max), le niveau est ramené dans 1..400,
 *    la classe est tronquée à 50 caractères — on ne stocke pas ce que le worker renvoie brut ;
 *    `dofusLevel` stocke le **niveau total** (200 + Oméga) : le ladder ne renvoie que le
 *    niveau Oméga (128) pour un Oméga 128, l'XP totale tranche (cf. `src/lib/dofus-level.ts`) ;
 *  · **aucun secret dans les logs** : ce module n'écrit rien, jamais.
 */

import { DOFUS_LEVEL_TOTAL_MAX, toTotalDofusLevel } from "@/lib/dofus-level";

/** Champs tels que les portent `UserProfile` **et** `PublicProfile` (noms voisins). */
export type LadderSnapshot = {
    successPoints?: number;
    totalXp?: bigint;
    dofusLevel?: number;
    /** Libellé du ladder (« Iop », « Féca ») — **jamais** écrit dans `PublicProfile.classe`. */
    classe?: string;
    lastLadderUpdate?: Date;
};

/** 15 chiffres : au-delà, ce n'est plus une valeur de jeu (et `BigInt` n'aime pas l'infini). */
const MAX_XP_DIGITS = 15;

/** Niveau de jeu : borné à 1..400, entier. `undefined` si la valeur n'est pas un nombre. */
export function normalizeLadderLevel(value: unknown): number | undefined {
    // `Number(null)` vaut 0 et `Number("")` aussi : sans ce filtre, un champ absent du worker
    // deviendrait « niveau 1 » (faux niveau, et pire qu'une absence).
    if (typeof value !== "number" && typeof value !== "string") return undefined;
    if (typeof value === "string" && value.trim() === "") return undefined;
    const level = Number(value);
    if (!Number.isFinite(level)) return undefined;
    return Math.min(Math.max(Math.floor(level), 1), DOFUS_LEVEL_TOTAL_MAX);
}

/** Points de succès : entier positif seulement. */
export function normalizeLadderPoints(value: unknown): number | undefined {
    if (typeof value !== "number" || !Number.isFinite(value) || value < 0) return undefined;
    return Math.floor(value);
}

/** XP totale : on ne garde que les chiffres (`"12 345"` → `12345n`), 15 au maximum. */
export function normalizeLadderXp(value: unknown): bigint | undefined {
    if (value === null || value === undefined) return undefined;
    const digits = String(value).replace(/\D/g, "").slice(0, MAX_XP_DIGITS);
    if (!digits) return undefined;
    const xp = BigInt(digits);
    return xp > 0n ? xp : undefined;
}

/** Classe renvoyée par le ladder : libellé borné, jamais vide. */
export function normalizeLadderClass(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim().slice(0, 50);
    return trimmed.length > 0 ? trimmed : undefined;
}

/**
 * Snapshot d'un personnage : deux appels au worker (points de succès + fiche générale).
 * Retourne `{}` dès qu'un élément manque — le contrat est « au mieux », jamais bloquant.
 *
 * `timeoutMs` est **court** pour les actions utilisateur (une sauvegarde de profil ne doit pas
 * attendre 15 s) ; le worker est un service tiers, il n'a pas de SLA.
 */
export async function fetchLadderSnapshot(
    pseudo: string,
    serverId: string | number,
    timeoutMs = 8_000
): Promise<LadderSnapshot> {
    const workerUrl = process.env.DOFUS_LADDER_WORKER_URL;
    const name = pseudo.trim();
    if (!workerUrl || !name) return {};

    const workerSecret = process.env.DOFUS_LADDER_WORKER_KEY || process.env.DOFUS_LADDER_WORKER_SECRET;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (workerSecret) headers["X-SigilOS-Key"] = workerSecret;

    const base = `${workerUrl}?server_id=${encodeURIComponent(String(serverId))}&name=${encodeURIComponent(name)}`;
    const signal = AbortSignal.timeout(timeoutMs);

    const [succesRes, generalRes] = await Promise.all([
        fetch(base, { headers, cache: "no-store", signal }).catch(() => null),
        fetch(`${base}&type=general`, { headers, cache: "no-store", signal }).catch(() => null),
    ]);

    const snapshot: LadderSnapshot = {};
    let level: number | undefined;

    if (succesRes?.ok) {
        const succes = await succesRes.json().catch(() => null);
        if (succes?.success && succes?.found) {
            const points = normalizeLadderPoints(succes.points);
            if (points !== undefined) snapshot.successPoints = points;
            level = normalizeLadderLevel(succes.level);
        }
    }

    if (generalRes?.ok) {
        const general = await generalRes.json().catch(() => null);
        if (general?.success && general?.found) {
            const xp = normalizeLadderXp(general.totalXp);
            if (xp !== undefined) snapshot.totalXp = xp;
            // La fiche générale fait foi pour le niveau (le ladder succès peut être plus
            // grossier) ; l'XP totale, elle, tranche le cas Oméga.
            level = normalizeLadderLevel(general.level) ?? level;
            const classe = normalizeLadderClass(general.classe);
            if (classe) snapshot.classe = classe;
        }
    }

    const totalLevel = toTotalDofusLevel(level, snapshot.totalXp);
    if (totalLevel !== null) snapshot.dofusLevel = totalLevel;
    if (snapshot.successPoints !== undefined || snapshot.totalXp !== undefined) {
        snapshot.lastLadderUpdate = new Date();
    }

    return snapshot;
}
