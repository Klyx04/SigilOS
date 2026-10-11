/**
 * Onglets d'une fiche boss — **source unique** partagée par la fiche publique
 * (`/boss/<slug>`), les fiches internes du module Succès (donjons, avis de
 * recherche) et la fiche d'un **monstre normal** (`/bestiaire/<slug>`, onglet
 * interne « Monstres »). Une seule définition ⇒ une surface ne peut plus proposer
 * un onglet que l'autre n'a pas ; la parité est verrouillée par
 * `tests/unit/boss-fiche-tabs-parite.test.ts`.
 *
 * La règle est **pure** : elle ne consomme que des compteurs et des indicateurs
 * fournis par l'appelant (aucune requête, aucun accès base). Un onglet dont la
 * donnée est absente n'est **pas rendu** (`hidden` par construction) : on
 * n'invente jamais un onglet vide, et on ne duplique pas la définition dans un
 * écran — le seul écart admis entre surfaces est la **locale** (fiche publique
 * bilingue).
 */

/** Identifiants d'onglet, dans l'ordre canonique d'affichage. */
export type BossFicheTabId =
    | "sorts"
    | "sim"
    | "strategy"
    | "grades"
    | "loot"
    | "family"
    | "monsters"
    | "quests"
    | "achievements";

/** Nature de l'entité : ne change que le libellé du 1er onglet, jamais le jeu d'onglets. */
export type BossFicheEntity = "dungeon" | "bounty" | "titan" | "anomaly" | "raid" | "monster";

/**
 * Pictos des onglets. Assets **locaux** du dépôt (mêmes chemins dans les deux
 * surfaces : `public/assets/dofus/*` est servi statiquement). Aucun hotlink.
 */
export const BOSS_FICHE_TAB_ICONS: Record<BossFicheTabId, string> = {
    sorts: "/assets/dofus/modules/spells.png",
    sim: "/assets/dofus/modules/map.png",
    strategy: "/assets/dofus/icons/quests.png",
    grades: "/assets/dofus/modules/character.png",
    loot: "/assets/dofus/modules/chest.png",
    family: "/assets/dofus/modules/party.png",
    monsters: "/assets/dofus/icons/archimonster.png",
    quests: "/assets/dofus/icons/quests.png",
    achievements: "/assets/dofus/icons/success.png",
};

export interface BossFicheTab {
    id: BossFicheTabId;
    label: string;
    icon: string;
}

/**
 * Compteurs consommés par les règles de masquage et par les libellés à badge.
 * Volontairement minimal : seules les données qui **décident** d'un onglet.
 */
export interface BossFicheTabCounts {
    grades: number;
    roomMonsters: number;
    /** Monstres normaux (hors boss / avis / anomalie / titan / raid) qui ont leur fiche. */
    monsters: number;
    quests: number;
    achievements: number;
}

export interface BossFicheTabInput {
    entity: BossFicheEntity;
    counts: BossFicheTabCounts;
    /** Une mécanique **réelle** est décrite (texte de passif) — sinon pas d'onglet Stratégie. */
    hasMechanics: boolean;
    /** Locale d'affichage (la fiche publique est bilingue). Défaut : `fr`. */
    locale?: "fr" | "en";
}

const ORDRE: BossFicheTabId[] = [
    "sorts",
    "sim",
    "strategy",
    "grades",
    "loot",
    "family",
    "monsters",
    "quests",
    "achievements",
];

/** libellés « courts » (paliers génériques), dépendants de la locale. */
const LABELS: Record<"fr" | "en", Record<Exclude<BossFicheTabId, "sorts">, string>> = {
    fr: {
        sim: "Simulation Tactique",
        strategy: "Stratégie",
        grades: "Rangs & Paliers",
        loot: "Butin & Drops",
        family: "Monstres de la salle",
        monsters: "Monstres",
        quests: "Quêtes liées",
        achievements: "Succès du donjon",
    },
    en: {
        sim: "Tactical Simulation",
        strategy: "Strategy",
        grades: "Ranks & Levels",
        loot: "Loot & Drops",
        family: "Room Monsters",
        monsters: "Monsters",
        quests: "Linked Quests",
        achievements: "Dungeon Achievements",
    },
};

/** 1er onglet : seul libellé qui dépend de la nature de l'entité. */
function spellsLabel(entity: BossFicheEntity, locale: "fr" | "en"): string {
    if (locale === "en") {
        if (entity === "titan") return "Titan Spells";
        if (entity === "bounty") return "Bounty Monster Spells";
        if (entity === "monster") return "Monster Spells";
        return "Boss Spells";
    }
    if (entity === "titan") return "Sorts du Titan";
    if (entity === "bounty") return "Sorts du monstre recherché";
    if (entity === "monster") return "Sorts du monstre";
    return "Sorts du Boss";
}

/**
 * Construit la liste **affichée** des onglets d'une fiche boss.
 *
 * Règles de masquage (identiques pour toutes les surfaces) :
 *   · `strategy`     — seulement si une mécanique est décrite ;
 *   · `grades`       — seulement s'il y a plus d'un palier à comparer ;
 *   · `family`       — seulement s'il y a plus d'un monstre de salle ;
 *   · `quests`       — seulement si des quêtes sont liées ;
 *   · `achievements` — seulement si des succès sont connus ;
 *   · `sorts` · `sim` · `loot` — toujours rendus (les vues gèrent leur état vide).
 */
export function buildBossFicheTabs(input: BossFicheTabInput): BossFicheTab[] {
    const locale = input.locale ?? "fr";
    const visible: Record<BossFicheTabId, boolean> = {
        sorts: true,
        sim: true,
        strategy: input.hasMechanics,
        grades: input.counts.grades > 1,
        loot: true,
        family: input.counts.roomMonsters > 1,
        // Onglet « Monstres » : seulement s'il reste au moins un monstre normal à montrer.
        monsters: input.counts.monsters > 0,
        quests: input.counts.quests > 0,
        achievements: input.counts.achievements > 0,
    };

    const labelOf = (id: BossFicheTabId): string => {
        if (id === "sorts") return spellsLabel(input.entity, locale);
        const base = LABELS[locale][id];
        // Un compteur n'a de sens que sur les onglets de collection (jamais sur les
        // onglets « outil » : simulation, stratégie, butin se lisent en une vue).
        const counts: Record<"grades" | "family" | "monsters" | "quests" | "achievements", number> = {
            grades: input.counts.grades,
            family: input.counts.roomMonsters,
            monsters: input.counts.monsters,
            quests: input.counts.quests,
            achievements: input.counts.achievements,
        };
        return id in counts ? `${base} (${counts[id as keyof typeof counts]})` : base;
    };

    return ORDRE.filter((id) => visible[id]).map((id) => ({
        id,
        label: labelOf(id),
        icon: BOSS_FICHE_TAB_ICONS[id],
    }));
}

/** Ordre canonique des onglets (exporté pour les verrous de parité). */
export const BOSS_FICHE_TAB_ORDER: readonly BossFicheTabId[] = ORDRE;
