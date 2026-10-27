/**
 * Étapes à **variantes exclusives** — *une étape, N quêtes dont une seule est jouée*.
 *
 * Mesuré le 27/10/2026 (DPLN) : l'étape **55** de la série brâkmarienne propose **3 quêtes**
 * (« Le magnanime » / « Les kamas résolvent tout » / « Assassinat effectué », cette dernière
 * publiée le 26/09/2026) et l'étape **66** en propose **2** selon que l'on rejoint l'Espion
 * blessé à temps ou trop tard. DPLN le dit noir sur blanc : « Ces trois quêtes seront
 * identiques, juste le nom change ! » — on n'en joue **qu'une**.
 *
 * Sans modèle, trois conséquences fausses : le bloc compte 3 étapes au lieu d'1 (la
 * progression ne peut jamais atteindre 100 %), cocher une variante laisse les autres
 * ouvertes, et un joueur qui a choisi « L'attaquer » ne voit pas sa variante.
 *
 * **Convention, sans migration** : le groupe vit dans `activityTags` —
 * `{ type: "choice_group", name: "<id>" }`. Deux séquences d'un **même bloc** qui portent le
 * même nom de groupe sont des variantes : l'étape est terminée dès qu'**une** l'est, et
 * cocher l'une **dé-coche** les autres (voir `applyChoiceExclusivity`).
 */

import type { RushActivityTag } from "@/types/rush-guide-types";

/** Type de tag qui porte l'appartenance à une étape à choix. */
export const CHOICE_GROUP_TAG = "choice_group" as const;

/** Longueur maximale d'un identifiant de groupe (bornage, comme partout dans le module). */
export const MAX_CHOICE_GROUP_LENGTH = 48;

type TaggedSequence = { id: string; activityTags?: unknown };

/**
 * Identifiant du groupe de choix d'une séquence, ou `null`.
 * Une valeur vide, non textuelle ou trop longue est **écartée** (jamais devinée).
 * `activityTags` vient de PostgreSQL (`JsonValue`) : on ne suppose rien de sa forme.
 */
export function getChoiceGroup(seq: TaggedSequence | null | undefined): string | null {
    const tags = Array.isArray(seq?.activityTags) ? (seq!.activityTags as RushActivityTag[]) : [];
    const tag = tags.find((t) => t?.type === CHOICE_GROUP_TAG);
    const raw = typeof tag?.name === "string" ? tag.name.trim() : "";
    if (!raw) return null;
    return raw.slice(0, MAX_CHOICE_GROUP_LENGTH);
}

/** Les autres variantes de la même étape (jamais la séquence elle-même). */
export function siblingChoiceIds(
    seq: TaggedSequence | null | undefined,
    sequences: readonly TaggedSequence[]
): string[] {
    const group = getChoiceGroup(seq);
    if (!group || !seq) return [];
    return sequences
        .filter((s) => s.id !== seq.id && getChoiceGroup(s) === group)
        .map((s) => s.id);
}

export type RushChoiceStepCounts = {
    /** Étapes réelles : une par variante isolée, **une seule** par groupe de choix. */
    total: number;
    /** Étapes terminées : un groupe compte dès qu'**une** de ses variantes est cochée. */
    done: number;
};

/**
 * Tag `choice_group` d'une valeur d'import — `null` si la valeur est vide.
 *
 * Une seule source pour la convention : le studio, l'import et le serveur écrivent
 * exactement le même tag, borné à `MAX_CHOICE_GROUP_LENGTH`.
 */
export function choiceGroupTag(value: string | null | undefined): RushActivityTag[] | null {
    const raw = typeof value === "string" ? value.trim() : "";
    if (!raw) return null;
    return [{ type: CHOICE_GROUP_TAG, name: raw.slice(0, MAX_CHOICE_GROUP_LENGTH) }];
}

/**
 * Compte les étapes d'un bloc en tenant compte des variantes exclusives.
 *
 * L'appelant passe les séquences **de contenu** (les bandeaux `info_sequence` sont exclus en
 * amont, comme partout dans le module) ; la règle ne juge que le regroupement.
 */
export function stepCounts(
    sequences: readonly TaggedSequence[],
    completedIds: Iterable<string> | null | undefined
): RushChoiceStepCounts {
    const completed = completedIds instanceof Set ? completedIds : new Set(completedIds ?? []);
    const countedGroups = new Set<string>();
    let total = 0;
    let done = 0;

    for (const seq of sequences) {
        const group = getChoiceGroup(seq);
        if (!group) {
            total += 1;
            if (completed.has(seq.id)) done += 1;
            continue;
        }
        if (countedGroups.has(group)) continue;
        countedGroups.add(group);
        total += 1;
        // Le groupe est satisfait dès qu'une variante est cochée, quelle qu'elle soit.
        const satisfied = sequences.some((s) => getChoiceGroup(s) === group && completed.has(s.id));
        if (satisfied) done += 1;
    }

    return { total, done };
}

/**
 * Exclusivité à l'écriture : pour chaque variante **nouvellement** cochée, ses sœurs sont
 * retirées de la liste. Une séquence déjà cochée qui n'appartient à aucun groupe reste
 * intacte ; aucune variante déjà cochée n'est retirée tant qu'une nouvelle n'arrive pas.
 *
 * Déterministe : si le client envoie deux variantes du même groupe d'un coup, la **première**
 * de `incoming` gagne (l'ordre du client est celui du clic).
 */
export function applyChoiceExclusivity(
    sequences: readonly TaggedSequence[],
    incoming: readonly string[],
    newlyChecked: readonly string[]
): string[] {
    const byId = new Map(sequences.map((s) => [s.id, s]));
    const newly = new Set(newlyChecked);

    // Le **premier** id de `incoming` (ordre du clic) qui appartient à un groupe et vient
    // d'être coché est la variante retenue pour ce groupe.
    const winnerByGroup = new Map<string, string>();
    for (const id of incoming) {
        if (!newly.has(id)) continue;
        const group = getChoiceGroup(byId.get(id));
        if (group && !winnerByGroup.has(group)) winnerByGroup.set(group, id);
    }
    if (winnerByGroup.size === 0) return [...incoming];

    const dropped = new Set<string>();
    for (const [group, winner] of winnerByGroup) {
        for (const seq of sequences) {
            if (seq.id !== winner && getChoiceGroup(seq) === group) dropped.add(seq.id);
        }
    }
    return dropped.size === 0 ? [...incoming] : incoming.filter((id) => !dropped.has(id));
}
