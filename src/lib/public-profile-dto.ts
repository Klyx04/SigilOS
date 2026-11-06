/**
 * Espace visiteur (rang 57) — **DTO étanche** du profil public (aucune I/O).
 *
 * Pourquoi ce module : `getPublicAccount()` renvoyait la ligne Prisma **entière**, et le
 * hook de `src/lib/prisma.ts` **déchiffre** `metamobApiKey` à la lecture. Une page qui
 * passait ce profil à un composant client publiait donc la clé Metamob dans le payload
 * RSC. Le remède n'est pas un `delete` après coup (le spread revient toujours) : c'est
 * une **liste blanche** de champs, écrite une fois, ici.
 *
 * Invariants :
 *  · `metamobApiKey` n'est **jamais** dans `PublicProfileView` — on expose
 *    `hasMetamobApiKey` (booléen), qui suffit à l'écran ;
 *  · `totalXp` est un `BigInt` : il ne franchit pas la frontière RSC (inexploitable côté
 *    client), et V1c n'en a pas besoin ;
 *  · les mules sont **normalisées** à la lecture (une ligne abîmée ne casse pas l'écran)
 *    et bornées par `PUBLIC_MULES_MAX`.
 */

import { normalizeDeclaredMule, type DeclaredMule } from "@/lib/member-mules";

/** Nombre maximum de mules déclarables par un visiteur (borne dite à l'écran). */
export const PUBLIC_MULES_MAX = 10;

export type PublicProfileView = {
    id: string;
    userId: string;
    dofusServerId: number;
    pseudoDofus: string | null;
    classe: string | null;
    declaredGuildName: string | null;
    altPseudos: DeclaredMule[];
    introduction: string | null;
    objectifs: string | null;
    preferredActivities: string[];
    metamobPseudo: string | null;
    metamobVerified: boolean;
    /** La clé existe **sans être exposée** : c'est ce booléen que lit l'écran. */
    hasMetamobApiKey: boolean;
    alignment: string | null;
    alignmentLevel: number;
    dofusLevel: number | null;
    successPoints: number | null;
    lastLadderSync: Date | null;
    showOnDirectory: boolean;
    showPresence: boolean;
    createdAt: Date;
    updatedAt: Date;
};

/**
 * Forme **exacte** lue en base. Elle est déclarée ici pour que le `select` de
 * `src/server/public-account.ts` et le mapper restent alignés : ajouter un champ à la vue
 * sans l'ajouter au `select` casse le typage, et inversement.
 */
export type PublicProfileRow = {
    id: string;
    userId: string;
    dofusServerId: number;
    pseudoDofus: string | null;
    classe: string | null;
    declaredGuildName: string | null;
    altPseudos: unknown;
    introduction: string | null;
    objectifs: string | null;
    preferredActivities: unknown;
    metamobPseudo: string | null;
    metamobApiKey: string | null;
    metamobVerified: boolean;
    alignment: string | null;
    alignmentLevel: number;
    dofusLevel: number | null;
    successPoints: number | null;
    lastLadderSync: Date | null;
    showOnDirectory: boolean;
    showPresence: boolean;
    createdAt: Date;
    updatedAt: Date;
};

/** Normalise une liste de mules déclarées : pseudo exploitable obligatoire, borne dite. */
export function normalizeDeclaredMules(raw: unknown, max = PUBLIC_MULES_MAX): DeclaredMule[] {
    if (!Array.isArray(raw)) return [];
    const out: DeclaredMule[] = [];
    const seen = new Set<string>();
    for (const entry of raw) {
        const mule = normalizeDeclaredMule(entry);
        if (!mule) continue;
        const key = mule.pseudo.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ pseudo: mule.pseudo, classe: mule.classe, level: mule.level });
        if (out.length >= max) break;
    }
    return out;
}

/** Liste d'ids d'activités, bornée : un `Json` abîmé rend une liste vide, jamais une exception. */
export function normalizePreferredActivities(raw: unknown, allowed: readonly string[]): string[] {
    if (!Array.isArray(raw)) return [];
    const allowedSet = new Set(allowed);
    return raw
        .filter((value): value is string => typeof value === "string" && allowedSet.has(value))
        .slice(0, allowed.length);
}

/**
 * Ligne Prisma → vue publique. **Seul** chemin autorisé : la clé Metamob est réduite à un
 * booléen, les mules et les activités sont normalisées, et rien d'autre ne fuit.
 */
export function toPublicProfileView(
    row: PublicProfileRow,
    allowedActivities: readonly string[]
): PublicProfileView {
    return {
        id: row.id,
        userId: row.userId,
        dofusServerId: row.dofusServerId,
        pseudoDofus: row.pseudoDofus,
        classe: row.classe,
        declaredGuildName: row.declaredGuildName,
        altPseudos: normalizeDeclaredMules(row.altPseudos),
        introduction: row.introduction,
        objectifs: row.objectifs,
        preferredActivities: normalizePreferredActivities(row.preferredActivities, allowedActivities),
        metamobPseudo: row.metamobPseudo,
        metamobVerified: row.metamobVerified,
        hasMetamobApiKey: typeof row.metamobApiKey === "string" && row.metamobApiKey.length > 0,
        alignment: row.alignment,
        alignmentLevel: row.alignmentLevel,
        dofusLevel: row.dofusLevel,
        successPoints: row.successPoints,
        lastLadderSync: row.lastLadderSync,
        showOnDirectory: row.showOnDirectory,
        showPresence: row.showPresence,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
    };
}
