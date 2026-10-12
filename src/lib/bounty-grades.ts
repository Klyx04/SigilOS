/**
 * 🐗 Avis de recherche — **grades & drops de repli** (pur : aucun I/O).
 *
 * Cause mesurée (28/09/2026) : `siphonOneBounty` persiste le payload de
 * `getMonsterStats`, mais en cas d'échec live (429, panne) ce payload est un
 * repli `{ id, name, spells: [] }` **sans `grades` ni `drops`** ⇒ la fiche
 * affiche des barres vides et des résistances à « 0 % ». Or l'appel de liste
 * (`monsters?race=`) porte déjà les grades complets (PV/PA/PM, résistances,
 * caracs) et les drops bruts (`percentDropForGrade1..5`) : ce module les
 * convertit au **même format** que `getMonsterStats` (zéro appel en plus).
 *
 * Règles :
 *   · un grade sans `level` ni PV est ignoré (jamais de grade fantôme) ;
 *   · `actionPoints`/`movementPoints` acceptent les alias `pa`/`pm` ;
 *   · un drop sans `objectId` est ignoré ; taux = premier grade non nul,
 *     sinon repli (`minPercentDrop`/`maxPercentDrop`/`percent`), formaté
 *     comme `getMonsterStats` (2 décimales ≥ 0,01, 3 en dessous).
 */

export type BountyMappedGrade = {
    level: number;
    lifePoints: number;
    actionPoints: number;
    movementPoints: number;
    resists: {
        neutral: number;
        earth: number;
        fire: number;
        water: number;
        air: number;
    };
    carac: {
        wisdom: number;
        strength: number;
        intelligence: number;
        chance: number;
        agility: number;
        paDodge: number;
        pmDodge: number;
        gradeXp: number;
    };
};

export type BountyMappedDrop = {
    objectId: number;
    name: string;
    nameEn: string | null;
    imageUrl: string;
    percent: number;
    percentByGrade: number[];
};

function toFiniteNumber(value: unknown): number | null {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Grades bruts DofusDB → forme fiche (`getMonsterStats`). `null` = rien
 * d'exploitable (l'appelant garde l'absence honnête, jamais un grade inventé).
 */
export function mapBountyGrades(raw: unknown): BountyMappedGrade[] | null {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const mapped: BountyMappedGrade[] = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== "object") continue;
        const grade = entry as Record<string, unknown>;
        const level = toFiniteNumber(grade.level);
        const lifePoints = toFiniteNumber(grade.lifePoints);
        // Un grade se reconnaît à son niveau + ses PV (le reste peut manquer).
        if (level === null || lifePoints === null) continue;
        const num = (value: unknown, fallback = 0): number => toFiniteNumber(value) ?? fallback;
        mapped.push({
            level: Math.trunc(level),
            lifePoints: Math.trunc(lifePoints),
            actionPoints: Math.trunc(num(grade.actionPoints ?? grade.pa)),
            movementPoints: Math.trunc(num(grade.movementPoints ?? grade.pm)),
            resists: {
                neutral: num(grade.neutralResistance),
                earth: num(grade.earthResistance),
                fire: num(grade.fireResistance),
                water: num(grade.waterResistance),
                air: num(grade.airResistance),
            },
            carac: {
                wisdom: num(grade.wisdom),
                strength: num(grade.strength),
                intelligence: num(grade.intelligence),
                chance: num(grade.chance),
                agility: num(grade.agility),
                paDodge: num(grade.paDodge),
                pmDodge: num(grade.pmDodge),
                gradeXp: num(grade.gradeXp),
            },
        });
    }
    return mapped.length > 0 ? mapped : null;
}

function formatDropRate(value: number): number {
    if (!value || value <= 0) return 0;
    if (value < 0.01) return parseFloat(value.toFixed(3));
    return parseFloat(value.toFixed(2));
}

/**
 * Drops bruts DofusDB + table d'objets (`items?` groupés par id) → forme fiche.
 * Sans table d'objets, le nom retombe sur `Objet #id` (repli déjà prévu par l'UI).
 */
export function mapBountyDrops(
    raw: unknown,
    itemsById: Record<number, { nameFr?: string; nameEn?: string | null; img?: string }> = {}
): BountyMappedDrop[] | null {
    if (!Array.isArray(raw) || raw.length === 0) return null;
    const mapped: BountyMappedDrop[] = [];
    for (const entry of raw) {
        if (!entry || typeof entry !== "object") continue;
        const drop = entry as Record<string, unknown>;
        const objectId = toFiniteNumber(drop.objectId);
        if (objectId === null || objectId <= 0) continue;
        const id = Math.trunc(objectId);

        const gradePercents = [1, 2, 3, 4, 5].map((grade) => {
            const direct = toFiniteNumber(drop[`percentDropForGrade${grade}`]);
            if (direct !== null && direct > 0) return direct;
            const fallback =
                toFiniteNumber(drop.minPercentDrop) ??
                toFiniteNumber(drop.maxPercentDrop) ??
                toFiniteNumber(drop.percent);
            if (fallback !== null && fallback > 0) return fallback;
            return typeof direct === "number" ? direct : 0;
        });
        const firstNonZero = gradePercents.find((rate) => rate > 0);
        const item = itemsById[id];
        mapped.push({
            objectId: id,
            name: item?.nameFr || `Objet #${id}`,
            nameEn: item?.nameEn ?? null,
            imageUrl: item?.img || `https://static.dofusdb.fr/items/illustr/${id}.png`,
            percent: formatDropRate(firstNonZero ?? 0),
            percentByGrade: gradePercents.map(formatDropRate),
        });
    }
    return mapped.length > 0 ? mapped : null;
}
