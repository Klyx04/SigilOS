/**
 * Types unifiés et exhaustifs pour le module Rush Sylvestre.
 * Couvre l'ensemble des tags, séquences, jalons et formats de progression
 * utilisés par GOD, le Dashboard Membre et l'Overlay In-Game.
 */

import type { RushQuestConstraints } from "@/types/rush-constraints";
import type { RushCombatMonster } from "@/lib/rush-combat-monsters";

export type RushActivityTagType =
  | "combat_tactique"
  | "combat_vagues"
  | "songes"
  | "combat_solo"
  | "combat_plusieurs"
  | "contrainte_horaire"
  | "donjon"
  | "plusieurs_personnes"
  | "sort"
  | "metier"
  | "solver"
  | "quest_group"
  | "item"
  | "pos_tags"
  | "prereq_text"
  | "tougli_box"
  | "info_sequence"
  | "dofus_link"
  | "ocre_dungeon"
  | "alignment_set"
  | "succes"
  | "npc";

/** Alternative d'un prérequis « au choix » (tag `prereq_expr`), par id DofusDB. */
export type RushPrereqAlternative = {
  questId: number;
  /** Nom connu à la source (affichage seulement) ; la résolution passe par `questDbIds`. */
  name?: string;
};

export type RushActivityTag = {
  type: RushActivityTagType | string;
  name?: string;
  /**
   * Tag `prereq_expr` — **prérequis « au choix »** : au moins une de ces quêtes suffit
   * (groupe OU du client). Les alternatives sont désignées par leur id DofusDB, résolu
   * contre les `questDbIds` des séquences : une alternative absente du guide est
   * **non vérifiable** et ne bloque jamais (voir `rush-prereq-expr`).
   */
  alternatives?: RushPrereqAlternative[];
  /**
   * Camp d'un tag `alignment_set` — **vocabulaire canonique** (02/11/2026).
   * L'ancien import écrivait `name` : il reste lu en legacy (`alignmentTagCamp`).
   */
  camp?: string | null;
  level?: number;
  count?: number;
  color?: string;
  url?: string;
  id?: string;
  /** Tag `succes` : icône officielle du client (`img/achievements/{iconId}.png`). */
  iconId?: number;
  imageUrl?: string;
  quantity?: number;
  /** Tag `npc` : identifiant client du PNJ (portrait par convention). */
  npcId?: number;
  /** Tag `pos_tags` : monde Dofus (1 = classique). */
  worldId?: number;
  /** Tag `pos_tags` : détour zaap proposé ; l'auto résout le plus proche. */
  allowZaap?: boolean;
  /** Tag `pos_tags` : zaap manuel (God), prioritaire sur l'auto. */
  zaapX?: number;
  zaapY?: number;
  /**
   * Tag de combat — monstres du groupe, résolus par nom au seed. Un nom inconnu
   * reste nommé, sans slug : le rendu ne devine jamais la fiche.
   */
  monsters?: RushCombatMonster[];
};

export type RushDungeonRef = {
  id: string;
  name: string;
  bossName?: string;
  imageUrl?: string | null;
  /** Optionnel : affiché dans la quête, mais ne bloque pas sa validation. */
  isOptional?: boolean;
};

export type RushSequence = {
  id: string;
  subGuideRef: string;
  subGuideName: string;
  stepFrom?: number | null;
  stepTo?: number | null;
  note?: string | null;
  isOptional: boolean;
  order: number;
  dungeonId?: string | null;
  dungeonIds?: string[];
  dungeon?: RushDungeonRef | null;
  dungeons?: RushDungeonRef[];
  /** Ids DofusDB des quêtes portées par la séquence (source des prérequis « au choix »). */
  questDbIds?: number[];
  dofusdbUrl?: string | null;
  dofuspourlesnoobsUrl?: string | null;
  tips?: string | null;
  /** Conditions structurées (horaire, joueurs, métiers, sorts, notes) — des infos, jamais un blocage. */
  constraints?: RushQuestConstraints | null;
  alignReq?: string | null;
  /** Code d'Ordre (6 valeurs) — seules les quêtes d'Ordre en portent. */
  alignOrderCode?: string | null;
  /** Palier d'alignement requis : 20 | 40 | 60 | 80 | 100 (VERROU calculé). */
  alignLevelReq?: number | null;
  /** Classe requise (fec | osa | enu | …) — quêtes de classe. */
  classReq?: string | null;
  /** Variantes de texte par camp (lot 4) — vide ⇒ `subGuideName` / `tips` de base. */
  routeVariants?: {
    bontarien?: { name?: string; tips?: string };
    brakmarien?: { name?: string; tips?: string };
  } | null;
  isSuccess?: boolean;
  icon?: string | null;
  metamobMonsterId?: number | null;
  activityTags?: RushActivityTag[];
  /** Bloc B — page publique : slug figé à la publication, `null` tant que non publiée. */
  publicSlug?: string | null;
  /** Bloc B — la page publique existe-t-elle ? */
  isPublished?: boolean;
};

export type RushMilestoneType =
  | "PREREQUIS"
  | "ALIGNEMENT"
  | "DOFUS"
  | "SUCCES"
  | "ZONE"
  | "QUETE_SERIE"
  | "DONJON"
  | "INFO"
  | "SEPARATEUR"
  | "DOFUS_OBTAINED"
  | "COMBAT_TACTIQUE"
  | "COMBAT_SEMI_TACTIQUE";

export type RushMilestone = {
  id: string;
  chapter: number;
  chapterLabel: string;
  title: string;
  subtitle?: string | null;
  description?: string | null;
  accentColor?: string | null;
  imageUrl?: string | null;
  isOptional: boolean;
  order: number;
  tips?: string | null;
  /** Liens externes nommés des blocs Combat / Conseils (JSON borné). */
  links?: unknown;
  dofusId?: string | null;
  type?: RushMilestoneType | string;
  sequences: RushSequence[];
  playerProgress?: Array<{
    isCompleted: boolean;
    completedSteps?: any;
    completedStepIds?: string[];
    bookmarkedSeqId?: string | null;
    currentStep?: string | null;
  }>;
};

export type RushGuildMemberProgress = {
  profileId: string;
  milestoneId: string;
  isCompleted: boolean;
  userName: string;
  userAvatar?: string;
  currentStep?: string | null;
};
