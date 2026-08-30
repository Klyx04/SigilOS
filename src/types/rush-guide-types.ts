/**
 * Types unifiés et exhaustifs pour le module Rush Sylvestre.
 * Couvre l'ensemble des tags, séquences, jalons et formats de progression
 * utilisés par GOD, le Dashboard Membre et l'Overlay In-Game.
 */

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
  | "alignment_set";

export type RushActivityTag = {
  type: RushActivityTagType | string;
  name?: string;
  level?: number;
  count?: number;
  color?: string;
  url?: string;
  id?: string;
  imageUrl?: string;
  quantity?: number;
};

export type RushDungeonRef = {
  id: string;
  name: string;
  bossName?: string;
  imageUrl?: string | null;
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
  dofusdbUrl?: string | null;
  dofuspourlesnoobsUrl?: string | null;
  tips?: string | null;
  alignReq?: string | null;
  alignOrderReq?: number | null;
  isSuccess?: boolean;
  icon?: string | null;
  metamobMonsterId?: number | null;
  activityTags?: RushActivityTag[];
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
  | "DOFUS_OBTAINED";

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
