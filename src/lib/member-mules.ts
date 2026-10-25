/**
 * Mules **déclarées** d'une guilde — règle pure (aucune I/O).
 *
 * Une « mule » est un personnage secondaire déclaré par un membre (profil dashboard ou
 * ligne de registre staff) : `UserProfile.altPseudos` / `MemberRegistryEntry.altPseudos`,
 * JSON `{ pseudo, classe?, level? }`. Ce module transforme ces listes éparses en un
 * **inventaire** : combien, pour qui, avec quelle classe — sans jamais deviner une classe.
 */

import type { RosterMule, RosterRow, RosterStatus } from "@/lib/member-roster";

/** Pseudo borné : un `altPseudos` abîmé ne doit pas casser l'affichage. */
const PSEUDO_MAX = 60;
/**
 * Niveau borné. Dofus plafonne à 200, mais un personnage **Oméga** repart au-delà :
 * 200 + niveau Oméga (jusqu'à 400 constaté). Hors bornes ⇒ `null` plutôt qu'un chiffre faux.
 */
const LEVEL_MIN = 1;
export const MULE_LEVEL_MAX = 400;
/** Seuil Oméga : au-delà de 200, le niveau affiché est un niveau Oméga. */
export const MULE_OMEGA_BASE = 200;
/** Classe bornée : un id de classe fait moins que ça. */
const CLASSE_MAX = 40;

/**
 * Libellé d'un niveau de mule. Un personnage **Oméga** ne s'affiche pas « niveau 75 »
 * quand il est Oméga 75 (niveau 275) : on le dit explicitement.
 */
export function muleLevelLabel(level: number | null): string | null {
    if (level === null) return null;
    if (level > MULE_OMEGA_BASE) return `Ω ${level - MULE_OMEGA_BASE} (niv. ${level})`;
    return `Niv. ${level}`;
}

export interface DeclaredMuleOwner {
    /** Profil dashboard (`UserProfile.id`) — `null` pour une ligne de registre hors dashboard. */
    profileId: string | null;
    discordId: string | null;
    name: string;
    avatar: string | null;
    status: RosterStatus | null;
}

export interface DeclaredMule {
    pseudo: string;
    /** Id/name de classe tel que déclaré (résolu par l'UI) ; `null` si absent. */
    classe: string | null;
    level: number | null;
}

export interface DeclaredMuleGroup {
    owner: DeclaredMuleOwner;
    mules: DeclaredMule[];
}

export interface DeclaredMulesSummary {
    /** Nombre total de mules déclarées (doublons écartés). */
    total: number;
    /** Nombre de membres qui déclarent au moins une mule. */
    membersWithMules: number;
    /** Mules sans classe déclarée (l'UI affiche alors une icône de repli explicite). */
    withoutClass: number;
    /** Groupes triés par nom de propriétaire (A→Z), mules triées par pseudo (A→Z). */
    groups: DeclaredMuleGroup[];
}

/**
 * Filtre les groupes pour la **recherche** du panneau (nom du propriétaire ou pseudo
 * de mule). Insensible à la casse **et aux accents** : « Wylanette » se trouve en
 * tapant « wylanete », et « Éliotrope » en tapant « eliotrope ».
 */
export function filterDeclaredMuleGroups(
    groups: readonly DeclaredMuleGroup[],
    query: string | null | undefined
): DeclaredMuleGroup[] {
    const needle = normalizeForSearch(query);
    if (!needle) return groups.map((group) => ({ ...group, mules: [...group.mules] }));

    const out: DeclaredMuleGroup[] = [];
    for (const group of groups) {
        const ownerMatches = normalizeForSearch(group.owner.name).includes(needle);
        const mules = ownerMatches
            ? [...group.mules]
            : group.mules.filter((mule) => normalizeForSearch(mule.pseudo).includes(needle));
        if (mules.length > 0) out.push({ owner: group.owner, mules });
    }
    return out;
}

function normalizeForSearch(value: string | null | undefined): string {
    return (value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();
}

function cleanText(value: unknown, max: number): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.replace(/\s+/g, " ").trim();
    return trimmed.length > 0 ? trimmed.slice(0, max) : null;
}

function cleanLevel(value: unknown): number | null {
    const level = typeof value === "string" ? Number(value) : value;
    if (typeof level !== "number" || !Number.isFinite(level)) return null;
    if (!Number.isInteger(level) || level < LEVEL_MIN || level > MULE_LEVEL_MAX) return null;
    return level;
}

/** Normalise une entrée `altPseudos` ; `null` quand le pseudo est inexploitable. */
export function normalizeDeclaredMule(value: unknown): DeclaredMule | null {
    if (!value || typeof value !== "object") return null;
    const raw = value as Partial<RosterMule> & Record<string, unknown>;

    const pseudo = cleanText(raw.pseudo, PSEUDO_MAX);
    if (!pseudo) return null;

    return {
        pseudo,
        classe: cleanText(raw.classe, CLASSE_MAX),
        level: cleanLevel(raw.level),
    };
}

/**
 * Inventaire des mules déclarées d'une liste de membres.
 *
 * - une entrée sans pseudo est **écartée** (jamais de ligne vide dans le compteur) ;
 * - un même pseudo déclaré deux fois par le **même** propriétaire n'est compté qu'une fois ;
 * - les membres sans mule ne créent aucun groupe.
 */
export function collectDeclaredMules(rows: readonly RosterRow[]): DeclaredMulesSummary {
    const groups: DeclaredMuleGroup[] = [];
    const seen = new Set<string>();
    let total = 0;
    let withoutClass = 0;

    for (const row of rows) {
        const declared = Array.isArray(row.mules) ? row.mules : [];
        if (declared.length === 0) continue;

        const ownerKey = row.profileId || row.discordId || row.displayName;
        const mules: DeclaredMule[] = [];

        for (const raw of declared) {
            const mule = normalizeDeclaredMule(raw);
            if (!mule) continue;

            const dedupeKey = `${ownerKey}::${mule.pseudo.toLowerCase()}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);

            mules.push(mule);
            total += 1;
            if (!mule.classe) withoutClass += 1;
        }

        if (mules.length === 0) continue;

        mules.sort((a, b) => a.pseudo.localeCompare(b.pseudo, "fr", { sensitivity: "base" }));
        groups.push({
            owner: {
                profileId: row.profileId || null,
                discordId: row.discordId || null,
                name: row.displayName,
                avatar: row.avatar,
                status: row.status,
            },
            mules,
        });
    }

    groups.sort((a, b) => a.owner.name.localeCompare(b.owner.name, "fr", { sensitivity: "base" }));

    return { total, membersWithMules: groups.length, withoutClass, groups };
}
