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

/** Libellé éditable de la carte de choix (ex. « Étape 55 · choisissez votre variante »). */
export const CHOICE_GROUP_LABEL_TAG = "choice_group_label" as const;

/** Note éditable de la carte (ex. « Quêtes identiques, seul le nom change. »). */
export const CHOICE_GROUP_NOTE_TAG = "choice_group_note" as const;

/** Longueur maximale d'un identifiant de groupe (bornage, comme partout dans le module). */
export const MAX_CHOICE_GROUP_LENGTH = 48;

/** Bornes des textes de la carte — même esprit que les autres champs du studio. */
export const MAX_CHOICE_GROUP_LABEL_LENGTH = 160;
export const MAX_CHOICE_GROUP_NOTE_LENGTH = 320;

/**
 * Note par défaut quand God n'en pose pas : c'est la phrase mesurée sur DPLN
 * (« Ces trois quêtes seront identiques, juste le nom change ! »). Elle ne dit
 * jamais quelle variante choisir — le joueur a joué la sienne.
 */
export const DEFAULT_CHOICE_GROUP_NOTE =
  "Ces quêtes sont identiques, seul le nom change. Cochez celle que vous avez jouée.";

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

/** Texte borné d'un tag de carte (libellé ou note), ou `null`. */
function readChoiceTagText(
    seq: TaggedSequence | null | undefined,
    type: string,
    maxLength: number
): string | null {
    const tags = Array.isArray(seq?.activityTags) ? (seq!.activityTags as RushActivityTag[]) : [];
    const tag = tags.find((t) => t?.type === type);
    const raw = typeof tag?.name === "string" ? tag.name.trim() : "";
    if (!raw) return null;
    return raw.slice(0, maxLength);
}

/**
 * Textes éditables d'une variante : libellé et note de la carte de choix.
 *
 * La convention reste **sans migration** — deux tags `choice_group_label` /
 * `choice_group_note` à côté du tag `choice_group`. Une variante peut porter les
 * textes ; les autres les héritent par `choiceGroupMetaForGroup`, donc God peut les
 * écrire sur n'importe quelle ligne du groupe sans dupliquer la donnée.
 */
export function getChoiceGroupMeta(seq: TaggedSequence | null | undefined): {
    label: string | null;
    note: string | null;
} {
    return {
        label: readChoiceTagText(seq, CHOICE_GROUP_LABEL_TAG, MAX_CHOICE_GROUP_LABEL_LENGTH),
        note: readChoiceTagText(seq, CHOICE_GROUP_NOTE_TAG, MAX_CHOICE_GROUP_NOTE_LENGTH),
    };
}

/**
 * Textes du groupe, lus sur **n'importe quelle** variante : le premier libellé /
 * la première note non vides gagnent. Deux surfaces qui rendent le même groupe
 * lisent donc la même carte, même si God a écrit les textes sur une seule ligne.
 */
export function choiceGroupMetaForGroup(
    sequences: readonly TaggedSequence[],
    group: string
): { label: string | null; note: string | null } {
    let label: string | null = null;
    let note: string | null = null;
    for (const seq of sequences) {
        if (getChoiceGroup(seq) !== group) continue;
        const meta = getChoiceGroupMeta(seq);
        if (!label && meta.label) label = meta.label;
        if (!note && meta.note) note = meta.note;
        if (label && note) break;
    }
    return { label, note };
}

/** Tags de texte bornés — `null`/vide ⇒ aucun tag (on n'écrit pas une coquille vide). */
export function choiceGroupMetaTags(input: {
    label?: string | null;
    note?: string | null;
}): RushActivityTag[] {
    const out: RushActivityTag[] = [];
    const label = typeof input.label === "string" ? input.label.trim() : "";
    const note = typeof input.note === "string" ? input.note.trim() : "";
    if (label) out.push({ type: CHOICE_GROUP_LABEL_TAG, name: label.slice(0, MAX_CHOICE_GROUP_LABEL_LENGTH) });
    if (note) out.push({ type: CHOICE_GROUP_NOTE_TAG, name: note.slice(0, MAX_CHOICE_GROUP_NOTE_LENGTH) });
    return out;
}

/** Retire les trois tags de choix d'une liste — utilisé par l'édition God (remplacement net). */
export function stripChoiceGroupTags(tags: unknown): RushActivityTag[] {
    const list = Array.isArray(tags) ? (tags as RushActivityTag[]) : [];
    return list.filter(
        (tag) =>
            tag?.type !== CHOICE_GROUP_TAG &&
            tag?.type !== CHOICE_GROUP_LABEL_TAG &&
            tag?.type !== CHOICE_GROUP_NOTE_TAG
    );
}

/** Élément d'affichage : une séquence seule, ou **une** carte pour N variantes. */
export type RushChoiceGroupItem<T extends TaggedSequence> =
    | { kind: "sequence"; seq: T }
    | {
          kind: "choice";
          group: string;
          label: string | null;
          note: string | null;
          sequences: T[];
      };

/**
 * Regroupe les variantes d'une liste **dans l'ordre du guide** : la carte prend la
 * place de la première variante, les suivantes ne sont plus rendues séparément.
 *
 * Une variante **seule** (route filtrée par cité/Ordre, recherche) redevient une
 * ligne normale : une carte « choisissez » à une seule option n'a aucun sens.
 */
export function collapseChoiceGroups<T extends TaggedSequence>(
    sequences: readonly T[]
): RushChoiceGroupItem<T>[] {
    const membersByGroup = new Map<string, T[]>();
    for (const seq of sequences) {
        const group = getChoiceGroup(seq);
        if (!group) continue;
        const list = membersByGroup.get(group);
        if (list) list.push(seq);
        else membersByGroup.set(group, [seq]);
    }

    const emitted = new Set<string>();
    const out: RushChoiceGroupItem<T>[] = [];
    for (const seq of sequences) {
        const group = getChoiceGroup(seq);
        if (!group) {
            out.push({ kind: "sequence", seq });
            continue;
        }
        if (emitted.has(group)) continue;
        emitted.add(group);
        const members = membersByGroup.get(group) ?? [seq];
        if (members.length === 1) {
            out.push({ kind: "sequence", seq });
            continue;
        }
        const meta = choiceGroupMetaForGroup(sequences, group);
        out.push({ kind: "choice", group, label: meta.label, note: meta.note, sequences: members });
    }
    return out;
}

/**
 * Réduit une liste d'ids de validation à **une variante par groupe**.
 *
 * Utilisé par la validation de bloc : le serveur ne doit pas cocher les trois
 * variantes (sinon les trois lignes apparaissent validées, et l'exclusivité ne veut
 * plus rien dire). Une variante déjà cochée est conservée ; sinon la première dans
 * l'ordre du guide gagne. Les ids hors groupe sont rendus intacts, dans l'ordre reçu.
 */
export function choiceRepresentatives(
    sequences: readonly TaggedSequence[],
    ids: readonly string[],
    completedIds: Iterable<string> | null | undefined
): string[] {
    const completed = completedIds instanceof Set ? completedIds : new Set(completedIds ?? []);
    const wanted = new Set(ids);
    const byId = new Map(sequences.map((seq) => [seq.id, seq]));
    const winnerByGroup = new Map<string, string>();

    for (const seq of sequences) {
        if (!wanted.has(seq.id)) continue;
        const group = getChoiceGroup(seq);
        if (!group) continue;
        const current = winnerByGroup.get(group);
        if (!current) {
            winnerByGroup.set(group, seq.id);
            continue;
        }
        if (!completed.has(current) && completed.has(seq.id)) winnerByGroup.set(group, seq.id);
    }

    return ids.filter((id) => {
        const group = getChoiceGroup(byId.get(id));
        return !group || winnerByGroup.get(group) === id;
    });
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
