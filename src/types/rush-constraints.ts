/**
 * Conditions **structurées** d'une quête Rush — des **infos** de confort, jamais des
 * règles de blocage. La validation d'une quête ne dépend jamais de ces champs.
 *
 * Le texte libre de `GuideSequence.tips` reste la source des conseils ; les conditions
 * saisies dans le studio God vivent ici, dans `GuideSequence.constraints` (JSON).
 */

export type RushConstraintSchedule =
  | { kind: "window"; from: string; to?: string; optional?: boolean }
  | { kind: "wait"; minutes: number; npc?: boolean };

export type RushConstraintRole =
  | { kind: "job"; job: string; level?: number }
  | { kind: "class"; className: string; level?: number }
  | { kind: "free"; text: string };

/** Modes de combat Tougli (`solo`, `groupe`, `tactique`, `soloV`, `groupeV`). */
export type RushCombatMode = "solo" | "group" | "tactical" | "soloWaves" | "groupWaves";

export type RushCombatMonster = {
  name: string;
  count: number;
  level?: number;
  health?: number;
  imageUrl?: string;
};

export type RushCombat = {
  mode: RushCombatMode;
  monsters: RushCombatMonster[];
};

/** Un donjon proposé au choix (le joueur en fait un) — nom et visuel dénormalisés. */
export type RushDungeonChoiceDungeon = {
  id?: string;
  name: string;
  bossName?: string;
  level?: number;
  imageUrl?: string;
};

export type RushDungeonChoice = {
  dungeons: RushDungeonChoiceDungeon[];
  note?: string;
};

/** Espèce à combattre (`bashMobs` Tougli) — pas une quantité. */
export type RushBashMob = {
  name: string;
  level?: number;
  imageUrl?: string;
};

export type RushQuestConstraints = {
  /** Version du format — permet une évolution sans casser les données existantes. */
  version: 1;
  hours?: RushConstraintSchedule | null;
  players?: { count?: number; roles: RushConstraintRole[] } | null;
  jobs: Array<{ job: string; level?: number }>;
  spells: string[];
  notes: string[];
  combat?: RushCombat | null;
  dungeonChoice?: RushDungeonChoice | null;
  bashMobs?: RushBashMob[];
};
