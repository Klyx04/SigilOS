/**
 * Icône de type de quête — règle **pure** (aucun IO, testée unitairement).
 *
 * Mesuré le 07/10/2026 (client Beta 3.7.3.3 + DofusDB `/quests`, 1 976 quêtes) :
 * - `type` : **0 = secondaire** (1 664, ex « On recherche Padgref… »),
 *   **1 = découverte** (131, ex « Bienvenue à Frigost »),
 *   **2 = principale** (109, ex « Plongeon et dragon » du Turquoise),
 *   **3 = primordiale** (72, ex « Le nouveau monde », « L'île des naufragés »).
 * - `repeatType` : **1 = répétable** classique (140, ex Wogew — « les quêtes
 *   répétables ont un `!` bleu » en jeu) ; **3 + `isEvent` = répétable
 *   événementielle** (377, ex offrandes Almanax) ; 0 = unique. Les valeurs
 *   **2 (19) et -1 (72) ne sont pas documentées** : repli conservateur sur le
 *   type de base (jamais de variante « répétable » inventée).
 * - `isEvent` : variante événementielle (principale / secondaire / répétable).
 *   La légende à 8 ne connaît **ni « primordiale événementielle » ni
 *   « découverte événementielle »** : repli sur le type de base.
 */

export const QUEST_TYPE_KEYS = [
    "primordiale",
    "principale",
    "principale-event",
    "secondaire",
    "secondaire-event",
    "repetable",
    "repetable-event",
    "decouverte",
] as const;

export type QuestTypeKey = (typeof QUEST_TYPE_KEYS)[number];

/** Libellé FR affiché dans le sélecteur God et les légendes. */
export const QUEST_TYPE_LABELS: Record<QuestTypeKey, string> = {
    primordiale: "Quête primordiale",
    principale: "Quête principale",
    "principale-event": "Quête principale événementielle",
    secondaire: "Quête secondaire",
    "secondaire-event": "Quête secondaire événementielle",
    repetable: "Quête répétable",
    "repetable-event": "Quête répétable événementielle",
    decouverte: "Quête de découverte",
};

/**
 * Sprite du type (`public/assets/dofus/quests/…`, siphonnés du client par le
 * propriétaire — 5 posés le 07/10/2026).
 *
 * Les 3 variantes événementielles n'ont pas encore leur sprite dédié (losanges
 * gris en jeu) : repli **documenté** sur le sprite du type de base, jamais
 * d'image cassée (le `<img>` doit garder `onError` vers le fallback).
 */
const QUEST_TYPE_SPRITES: Record<QuestTypeKey, string | null> = {
    primordiale: "/assets/dofus/quests/type-primordiale.webp",
    principale: "/assets/dofus/quests/type-principale.webp",
    "principale-event": null,
    secondaire: "/assets/dofus/quests/type-secondaire.webp",
    "secondaire-event": null,
    repetable: "/assets/dofus/quests/type-repetable.webp",
    "repetable-event": null,
    decouverte: "/assets/dofus/quests/type-decouverte.webp",
};

/** Base de repli d'une variante événementielle sans sprite dédié. */
const EVENT_BASE_FALLBACK: Record<QuestTypeKey, QuestTypeKey> = {
    primordiale: "primordiale",
    principale: "principale",
    "principale-event": "principale",
    secondaire: "secondaire",
    "secondaire-event": "secondaire",
    repetable: "repetable",
    "repetable-event": "repetable",
    decouverte: "decouverte",
};

export function questTypeIconPath(key: QuestTypeKey): string {
    return QUEST_TYPE_SPRITES[key] ?? QUEST_TYPE_SPRITES[EVENT_BASE_FALLBACK[key]] ?? QUEST_TYPE_ICON_FALLBACK;
}

/** Repli existant quand le sprite du type n'est pas encore siphonné. */
export const QUEST_TYPE_ICON_FALLBACK = "/assets/dofus/icons/quests.png";

export interface QuestTypeInput {
    /** `type` DofusDB/client : 0 secondaire · 1 découverte · 2 principale · 3 primordiale. */
    type?: unknown;
    /** `repeatType` DofusDB/client : 0 unique · 1 répétable · 3 + event = journalière. */
    repeatType?: unknown;
    /** `isEvent` DofusDB/client. */
    isEvent?: unknown;
}

/**
 * Clé d'icône pour une quête — repli **fail-closed** vers `secondaire`
 * (la masse des quêtes) quand le type est inconnu, jamais d'exception.
 */
export function resolveQuestTypeKey(input: QuestTypeInput | null | undefined): QuestTypeKey {
    const type = Math.floor(Number(input?.type));
    const repeatType = Math.floor(Number(input?.repeatType));
    const isEvent = input?.isEvent === true || input?.isEvent === 1;

    // Répétable prouvée : classique (1) ou journalière événementielle (3 + event).
    const isRepeatable = repeatType === 1 || (repeatType === 3 && isEvent);
    if (isRepeatable) return isEvent ? "repetable-event" : "repetable";

    switch (type) {
        case 3:
            return "primordiale";
        case 2:
            return isEvent ? "principale-event" : "principale";
        case 1:
            return "decouverte";
        case 0:
        default:
            return isEvent ? "secondaire-event" : "secondaire";
    }
}

/** Libellé FR d'une quête à partir de ses champs bruts (jamais dethrow). */
export function questTypeLabel(input: QuestTypeInput | null | undefined): string {
    return QUEST_TYPE_LABELS[resolveQuestTypeKey(input)];
}
