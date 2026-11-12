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

export type RushQuestConstraints = {
  /** Version du format — permet une évolution sans casser les données existantes. */
  version: 1;
  hours?: RushConstraintSchedule | null;
  players?: { count?: number; roles: RushConstraintRole[] } | null;
  jobs: Array<{ job: string; level?: number }>;
  spells: string[];
  notes: string[];
};
