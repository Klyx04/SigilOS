/**
 * Espace visiteur (rang 57) — **Progression Communautaire** (V2a-2) : règles pures, aucune I/O.
 *
 * Le panneau public reproduit le panneau interne (D-V8) à partir de la progression déjà stockée
 * par les visiteurs **consentants** (`PublicRushProgress`). Trois invariants :
 *
 *  · **consentement** : seules les lignes dont le profil porte `showRushProgress` arrivent ici
 *    (le filtre vit dans `src/server/rush-community.ts`) ; ce module ne connaît ni `userId` ni
 *    `publicProfileId` — l'identité affichable est un **nom de personnage**, jamais un compte ;
 *  · **borné** : un nom (40), des listes plafonnées — une ligne abîmée est ignorée, jamais une
 *    exception (les colonnes sont des `Json`, n'importe quoi peut y entrer) ;
 *  · **aucun agrégat inventé** : un membre sans bloc coché reste un membre à zéro.
 */

export const COMMUNITY_MAX_MEMBERS = 200;
export const COMMUNITY_NAME_MAX = 40;
export const COMMUNITY_MAX_MILESTONES = 300;
export const COMMUNITY_MAX_DUNGEONS = 2_000;

export type CommunityMember = {
    /** Nom affichable : `characterName` du personnage, jamais le pseudo du compte. */
    name: string;
    /** Blocs terminés (ids de `GuideMilestone`). */
    completedMilestones: string[];
    /** Donjons cochés « done » (clés `sequenceId::dungeonKey`). */
    dungeonDone: string[];
    /** Horodatage ISO de la dernière synchronisation (tri stable côté écran). */
    updatedAt: string;
};

/** Ligne brute telle que lue en base — les `Json` sont `unknown` par construction. */
export type CommunityRow = {
    characterName: string | null;
    completedMilestones: unknown;
    dungeonChecks: unknown;
    updatedAt: Date;
    pseudoDofus: string | null;
};

/** Un nom de personnage exploitable, ou `null` (ligne ignorée). */
export function normalizeCommunityName(raw: string | null | undefined): string | null {
    if (typeof raw !== 'string') return null;
    const name = raw.trim().slice(0, COMMUNITY_NAME_MAX);
    return name.length > 0 ? name : null;
}

/** Tableau de chaînes bornées ; tout ce qui n'est pas une chaîne est écarté. */
export function readCommunityKeys(raw: unknown, max: number): string[] {
    if (!Array.isArray(raw)) return [];
    const out: string[] = [];
    for (const value of raw) {
        if (typeof value !== 'string' || value.length === 0) continue;
        out.push(value.slice(0, 200));
        if (out.length >= max) break;
    }
    return out;
}

/** Coches de donjons : seules les valeurs `"done"` comptent (closed set). */
export function readCommunityDungeons(raw: unknown): string[] {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
    const out: string[] = [];
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (value !== 'done') continue;
        out.push(key.slice(0, 200));
        if (out.length >= COMMUNITY_MAX_DUNGEONS) break;
    }
    return out;
}

/**
 * Ligne Prisma → membre affichable, ou `null` si aucun nom ne peut être publié.
 * Le repli `pseudoDofus` n'est utilisé que si le personnage n'a pas de nom : le panneau ne
 * fabrique jamais un nom à partir d'un identifiant de compte.
 */
export function toCommunityMember(row: CommunityRow): CommunityMember | null {
    const name = normalizeCommunityName(row.characterName) ?? normalizeCommunityName(row.pseudoDofus);
    if (!name) return null;
    return {
        name,
        completedMilestones: readCommunityKeys(row.completedMilestones, COMMUNITY_MAX_MILESTONES),
        dungeonDone: readCommunityDungeons(row.dungeonChecks),
        updatedAt: row.updatedAt.toISOString(),
    };
}

/** Avancement d'un membre sur le guide (blocs terminés / blocs du guide). */
export function memberCompletion(member: CommunityMember, totalMilestones: number): number {
    if (totalMilestones <= 0) return 0;
    const done = Math.min(member.completedMilestones.length, totalMilestones);
    return Math.round((done / totalMilestones) * 100);
}

/**
 * Tri d'affichage : les plus avancés d'abord, puis le nom (déterministe), puis la fraîcheur.
 * Une copie est rendue — l'appelant garde son tableau d'origine intact.
 */
export function sortCommunityMembers(members: CommunityMember[], totalMilestones: number): CommunityMember[] {
    return [...members].sort((a, b) => {
        const delta = memberCompletion(b, totalMilestones) - memberCompletion(a, totalMilestones);
        if (delta !== 0) return delta;
        const byName = a.name.localeCompare(b.name, 'fr');
        if (byName !== 0) return byName;
        return b.updatedAt.localeCompare(a.updatedAt);
    });
}