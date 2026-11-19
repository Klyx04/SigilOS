/**
 * Succès de donjon du guide Rush — **règles pures**, partagées par les trois surfaces.
 *
 * Une seule question par règle, aucun accès réseau :
 *  · quels donjons ouvrent le panneau (`requis` + `résolu` en base) ;
 *  · quels succès sont **listables** (le faux « Donjon validé » n'est jamais listé ici) ;
 *  · quel personnage visiteur reçoit la coche (pseudo invité → slot du profil) ;
 *  · quel mode de surface (membre / visiteur / invité).
 *
 * Le panneau lui-même est un composant client : il ne connaît ni Prisma ni les actions.
 */

import { NO_ACHIEVEMENT_CHALLENGE_SLUG } from "@/lib/dungeon-no-achievement";
import { MAIN_CHARACTER_SLOT, type SuccesCharacter } from "@/lib/succes-characters";

/** Un succès de donjon, forme minimale partagée par les trois surfaces. */
export type DungeonAchievementView = {
    id: string;
    name: string;
    slug: string | null;
    /** Icône du challenge (proxy), repli de `imageUrl`. */
    iconUrl: string | null;
    /** Icône **propre au donjon** (succès « Spécial » siphonné). */
    imageUrl: string | null;
    points: number;
    description: string | null;
};

/** Donjon tel que le panneau l'affiche (les champs utiles seulement). */
export type DungeonAchievementDungeon = {
    id: string;
    name: string;
    bossName?: string | null;
    imageUrl?: string | null;
    isNoAchievement?: boolean;
    level?: number | null;
};

/** Données rendues par le panneau, quelle que soit la surface. */
export type DungeonAchievementPanelData = {
    dungeon: DungeonAchievementDungeon;
    /** Catalogue **filtré** : jamais le pseudo-succès « Donjon validé ». */
    achievements: DungeonAchievementView[];
    doneIds: string[];
    /** Slot utilisé pour les coches (`null` = personnage non résolu). */
    slot: string | null;
    characterName: string | null;
    /** Personnages déclarés (sélecteur visiteur). */
    characters: Array<{ slot: string; name: string; isMain: boolean }>;
    /** `false` ⇒ liste en lecture seule (invité, personnage non déclaré, droit manquant). */
    canEdit: boolean;
};

export type DungeonAchievementPanelLoadInput = {
    dungeonId: string;
    dungeon: DungeonAchievementDungeon;
    characterSlot?: string;
    guestPseudo?: string;
};

export type DungeonAchievementPanelLoader = (
    input: DungeonAchievementPanelLoadInput
) => Promise<{ success: boolean; data?: DungeonAchievementPanelData; error?: string }>;

export type DungeonAchievementToggleInput = {
    dungeonId: string;
    achievementId: string;
    characterSlot?: string;
};

export type DungeonAchievementToggler = (
    input: DungeonAchievementToggleInput
) => Promise<{ success: boolean; done?: boolean; error?: string }>;

/** Surface du panneau : membre de guilde, visiteur connecté, invité. */
export type DungeonAchievementPanelMode = "member" | "visitor" | "guest";

/**
 * Mode déduit de la surface. `isGuest` est codé en dur à `true` par le guide public
 * (même pour un visiteur connecté) : c'est `feedbackSignedIn` qui distingue les deux.
 */
export function achievementPanelMode(input: {
    guildId?: string | null;
    isGuest?: boolean;
    feedbackSignedIn?: boolean;
}): DungeonAchievementPanelMode {
    if (input.guildId && input.guildId !== "public" && !input.isGuest) return "member";
    return input.feedbackSignedIn ? "visitor" : "guest";
}

/**
 * Le `+` n'est proposé que pour un donjon **requis** et **résolu** en base.
 * Un donjon optionnel ne bloque rien ; un nom non aliasé (`nom:…`) n'a ni fiche ni succès.
 */
export function canOpenDungeonAchievements(
    dungeon: { id?: string | null; slug?: string | null; isOptional?: boolean } | null | undefined
): boolean {
    if (!dungeon || dungeon.isOptional) return false;
    return !!(dungeon.id || dungeon.slug);
}

/** Le pseudo-succès système « Donjon validé » — jamais listé dans le panneau du guide. */
export function isPseudoCompletionAchievement(slug: string | null | undefined): boolean {
    return slug === NO_ACHIEVEMENT_CHALLENGE_SLUG;
}

/**
 * Succès à **lister** dans le panneau : le faux « Donjon validé » est toujours écarté.
 * La fiche boss garde sa propre règle (`visibleDungeonAchievements`), où il sert de
 * fallback quand c'est le seul succès ; ici, la coche du donjon le remplace.
 */
export function listableDungeonAchievements<T extends { slug?: string | null }>(
    achievements: readonly T[]
): T[] {
    return achievements.filter((achievement) => !isPseudoCompletionAchievement(achievement.slug));
}

/** Compteur affiché par le panneau (`x/y`), calculé sur la liste déjà filtrée. */
export function achievementPanelSummary(
    achievements: readonly { id: string }[],
    doneIds: readonly string[]
): { total: number; done: number; allDone: boolean; isEmpty: boolean } {
    const done = new Set(doneIds);
    const total = achievements.length;
    const doneCount = achievements.filter((achievement) => done.has(achievement.id)).length;
    return {
        total,
        done: doneCount,
        allDone: total > 0 && doneCount === total,
        isEmpty: total === 0,
    };
}

/** Normalise un pseudo pour rapprocher le personnage invité des personnages déclarés. */
function normalizePseudo(value: string): string {
    return value
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

/**
 * Slot du profil visiteur à utiliser pour les succès.
 *
 * - aucun pseudo invité ⇒ personnage principal ;
 * - pseudo identique au principal ou à une mule déclarée ⇒ son slot ;
 * - pseudo non déclaré ⇒ `null` : le panneau reste en lecture seule et propose le
 *   sélecteur des personnages déclarés (jamais de coche sur un personnage inventé).
 */
export function resolveVisitorAchievementSlot(
    guestPseudo: string | null | undefined,
    characters: ReadonlyArray<Pick<SuccesCharacter, "slot" | "name" | "isMain">>
): string | null {
    const raw = (guestPseudo ?? "").trim();
    if (!raw) return MAIN_CHARACTER_SLOT;
    const target = normalizePseudo(raw);
    const found = characters.find(
        (character) =>
            normalizePseudo(character.name) === target || normalizePseudo(character.slot) === target
    );
    return found?.slot ?? null;
}
