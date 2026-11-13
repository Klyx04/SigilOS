/**
 * « En guilde **en jeu** » — règle pure (aucune I/O, testable).
 *
 * Décision user du 25/10/2026 : la guilde veut **compter ses personnages réellement en
 * guilde dans Dofus**, à partir de deux sources déclaratives :
 *  1. **rôles Discord** cochés par le staff (ex. « Membre », « Vétéran ») → chaque
 *     personne qui porte **au moins un** de ces rôles compte **une seule fois**, même
 *     si elle en porte plusieurs (pas de duplication) ;
 *  2. **mules déclarées** taguées « en guilde en jeu » sur la fiche du membre.
 *
 * Le total affiché est la somme des deux : `personnes (rôles) + mules taguées`.
 * Aucune classe, aucun niveau, aucun personnage n'est inventé ici.
 */

import type { RosterMule, RosterRow } from "@/lib/member-roster";

/** Plafond : une sélection de rôles reste un réglage, pas un dump de tout le serveur. */
export const IN_GAME_GUILD_MAX_ROLES = 50;

/** Un identifiant de rôle Discord exploitable (snowflake 15-21 chiffres). */
export function isInGameGuildRoleId(value: unknown): value is string {
    return typeof value === "string" && /^\d{15,21}$/.test(value);
}

/**
 * Assainit une sélection de rôles : snowflakes valides, dédupliqués, bornés.
 * `allowed` (les rôles **réellement présents** sur le serveur) filtre les IDs inconnus :
 * un rôle supprimé depuis ne doit pas rester compté en silence.
 */
export function normalizeInGameGuildRoleIds(
    value: unknown,
    allowed?: ReadonlySet<string> | null
): string[] {
    const list = Array.isArray(value) ? value : [];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const raw of list) {
        if (!isInGameGuildRoleId(raw)) continue;
        if (allowed && !allowed.has(raw)) continue;
        if (seen.has(raw)) continue;
        seen.add(raw);
        out.push(raw);
        if (out.length >= IN_GAME_GUILD_MAX_ROLES) break;
    }
    return out;
}

/** Une mule est-elle déclarée « en guilde en jeu » ? Seul `true` compte. */
export function isMuleInGameGuild(mule: Pick<RosterMule, "inGameGuild"> | null | undefined): boolean {
    return mule?.inGameGuild === true;
}

function normalizePseudo(value: string | null | undefined): string {
    return (value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

/**
 * Clé de comparaison d'un pseudo de mule (casse **et** accents ignorés).
 * Exportée pour que l'écriture en base compare exactement comme la règle pure.
 */
export function mulePseudoKey(value: string | null | undefined): string {
    return normalizePseudo(value);
}

/**
 * Bascule le tag d'**une** mule (même pseudo, insensible à la casse et aux accents).
 * Les autres mules et leurs champs (`classe`, `level`) sont conservés tels quels ;
 * `false` **supprime** la clé pour ne pas laisser de `inGameGuild: false` traîner.
 */
export function withMuleInGameGuild(
    mules: readonly RosterMule[],
    pseudo: string,
    value: boolean
): RosterMule[] {
    const target = normalizePseudo(pseudo);
    if (!target) return mules.map((mule) => ({ ...mule }));

    return mules.map((mule) => {
        if (normalizePseudo(mule.pseudo) !== target) return { ...mule };
        if (value) return { ...mule, inGameGuild: true };
        const next: RosterMule = { ...mule };
        delete next.inGameGuild;
        return next;
    });
}

export interface InGameGuildTally {
    /** Personnes distinctes portant au moins un rôle sélectionné. */
    members: number;
    /** Mules déclarées taguées « en guilde en jeu ». */
    mules: number;
    /** `members + mules` — le chiffre affiché par le compteur. */
    total: number;
}

/**
 * Compte les personnages « en guilde en jeu ».
 *
 * - **Aucune duplication** : une personne portant trois rôles cochés compte **1** ;
 * - une personne **hors dashboard** (`discordOnly`) compte comme les autres ;
 * - les mules taguées sont comptées **quel que soit le statut** du propriétaire : le tag
 *   est une déclaration du staff, pas une déduction sur le statut du profil ;
 * - sélection vide ⇒ 0 personne (jamais de repli permissif).
 */
export function tallyInGameGuild(input: {
    roleIds: readonly string[];
    rows: readonly RosterRow[];
}): InGameGuildTally {
    const selected = new Set(normalizeInGameGuildRoleIds(input.roleIds));
    let members = 0;
    let mules = 0;

    for (const row of input.rows) {
        // Un compte de bot n'est jamais un joueur en guilde (ni ses mules).
        if (row.isBot === true) continue;
        if (selected.size > 0 && Array.isArray(row.roles) && row.roles.some((roleId) => selected.has(roleId))) {
            members += 1;
        }
        for (const mule of row.mules ?? []) {
            if (isMuleInGameGuild(mule)) mules += 1;
        }
    }

    return { members, mules, total: members + mules };
}
