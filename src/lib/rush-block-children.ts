/**
 * Sous-blocs d'un bloc du Rush — **règle pure d'ordre d'affichage**.
 *
 * Mesure du 25/11/2026 : les types Conseils/Tips, Obtention Dofus, Séparateur et Combat
 * ne vivaient qu'au niveau du guide. Le studio les forçait en chapitre 0 ; impossible de
 * les insérer **dans** un bloc, par exemple une « Obtention Dofus » juste après une quête.
 *
 * Un sous-bloc porte une `position` qui s'intercale avec `GuideSequence.order` :
 *   · `sequence.order + 0.5` → juste après cette quête ;
 *   · `RUSH_CHILD_POSITION_END` (9999) → à la fin du bloc.
 * À position égale, la quête passe avant le sous-bloc ; deux sous-blocs sont départagés
 * par leur `order`. Aucune progression, aucun compteur, aucune route ne lit ces lignes.
 */

import type {
    RushMilestoneChild,
    RushMilestoneChildType,
    RushSequence,
} from "@/types/rush-guide-types";

/** Types acceptés comme sous-bloc (jamais une quête cochable, jamais un succès). */
export const RUSH_CHILD_TYPES = [
    "INFO",
    "DOFUS_OBTAINED",
    "SEPARATEUR",
    "COMBAT_TACTIQUE",
    "COMBAT_SEMI_TACTIQUE",
] as const satisfies readonly RushMilestoneChildType[];

/** Position d'un sous-bloc placé à la fin de son bloc. */
export const RUSH_CHILD_POSITION_END = 9999;

/** Borne une position venue de l'éditeur (jamais `NaN`/négative/énorme). */
export function normalizeRushChildPosition(value: unknown): number {
    const n = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(n) || n < 0) return RUSH_CHILD_POSITION_END;
    return Math.min(n, RUSH_CHILD_POSITION_END);
}

/** Vrai pour un type de sous-bloc autorisé (closed set). */
export function isRushChildType(value: unknown): value is RushMilestoneChildType {
    return typeof value === "string" && (RUSH_CHILD_TYPES as readonly string[]).includes(value);
}

/** Position « juste après cette quête » — `order` de séquence attendu. */
export function rushChildPositionAfter(sequenceOrder: number): number {
    if (!Number.isFinite(sequenceOrder)) return RUSH_CHILD_POSITION_END;
    const after = sequenceOrder + 0.5;
    return after >= RUSH_CHILD_POSITION_END ? RUSH_CHILD_POSITION_END : after;
}

/**
 * Ajoute un sous-bloc, ou **remplace** celui qui porte le même id.
 * Ne mute jamais l'entrée : le parent peut mettre à jour son état sans perdre
 * la liste affichée (création / édition immédiate).
 */
export function upsertRushChild(
    children: ReadonlyArray<RushMilestoneChild>,
    child: RushMilestoneChild
): RushMilestoneChild[] {
    const index = children.findIndex((item) => item.id === child.id);
    if (index === -1) return [...children, child];
    const next = [...children];
    next[index] = child;
    return next;
}

/** Retire un sous-bloc par son id, sans muter la liste. */
export function removeRushChild(
    children: ReadonlyArray<RushMilestoneChild>,
    id: string
): RushMilestoneChild[] {
    return children.filter((child) => child.id !== id);
}

export type RushBlockItem =
    | { kind: "sequence"; sequence: RushSequence; position: number; order: number }
    | { kind: "child"; child: RushMilestoneChild; position: number; order: number };

type SequenceLike = Pick<RushSequence, "id" | "order"> & Partial<RushSequence>;
type ChildLike = Pick<RushMilestoneChild, "id" | "type" | "position"> & Partial<RushMilestoneChild>;

/**
 * Fusionne les quêtes d'un bloc et ses sous-blocs en un seul fil ordonné.
 * Ne mute jamais les entrées ; une position invalide tombe en fin de bloc.
 */
export function mergeRushBlockItems(
    sequences: ReadonlyArray<SequenceLike>,
    children: ReadonlyArray<ChildLike> | null | undefined
): RushBlockItem[] {
    const items: RushBlockItem[] = [
        ...sequences.map((sequence) => ({
            kind: "sequence" as const,
            sequence: sequence as RushSequence,
            position: Number.isFinite(sequence.order) ? sequence.order : 0,
            order: Number.isFinite(sequence.order) ? sequence.order : 0,
        })),
        ...(children ?? []).map((child, index) => ({
            kind: "child" as const,
            child: child as RushMilestoneChild,
            position: normalizeRushChildPosition(child.position),
            order: Number.isFinite(child.order) ? (child.order as number) : index,
        })),
    ];

    return items.sort((a, b) => {
        if (a.position !== b.position) return a.position - b.position;
        if (a.kind !== b.kind) return a.kind === "sequence" ? -1 : 1;
        return a.order - b.order;
    });
}
