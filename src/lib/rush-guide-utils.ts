import type { RushMilestone, RushSequence, RushActivityTag } from "@/types/rush-guide-types";

/**
 * Métadonnées graphiques des tags d'activité Rush Sylvestre
 */
export const RUSH_ACTIVITY_TAG_CONFIG: Record<
  string,
  { label: string; color: string; imagePath: string }
> = {
  combat_tactique: {
    label: "Combat Tactique",
    color: "#ef4444",
    imagePath: "/assets/rush-sylvestre/combat-tactique.png",
  },
  combat_vagues: {
    label: "Combat à vagues",
    color: "#3b82f6",
    imagePath: "/assets/rush-sylvestre/combat-vagues.png",
  },
  songes: {
    label: "Songes",
    color: "#8b5cf6",
    imagePath: "/assets/rush-sylvestre/songes.png",
  },
  combat_solo: {
    label: "Combat Solo",
    color: "#f43f5e",
    imagePath: "/assets/rush-sylvestre/combat-solo.png",
  },
  combat_plusieurs: {
    label: "Combat à plusieurs",
    color: "#a855f7",
    imagePath: "/assets/rush-sylvestre/combat-plusieurs.png",
  },
  plusieurs_personnes: {
    label: "Multi joueurs",
    color: "#10b981",
    imagePath: "/assets/rush-sylvestre/plusieurs-personnes.png",
  },
  contrainte_horaire: {
    label: "Horaire Spécifique",
    color: "#f59e0b",
    imagePath: "/assets/rush-sylvestre/contrainte-horaire.png",
  },
  donjon: {
    label: "Donjon requis",
    color: "#3b82f6",
    imagePath: "/assets/rush-sylvestre/donjon.png",
  },
  sort: {
    label: "Sort requis",
    color: "#ec4899",
    imagePath: "/assets/rush-sylvestre/sort.png",
  },
  metier: {
    label: "Métier requis",
    color: "#eab308",
    imagePath: "/assets/rush-sylvestre/façonneur.png",
  },
  solver: {
    label: "Solver",
    color: "#10b981",
    imagePath: "/assets/rush-sylvestre/solver.png",
  },
};

/**
 * Normalise le chemin d'icône pour un métier donné
 */
export function getMetierIconPath(metierName?: string): string {
  if (!metierName) return "/assets/rush-sylvestre/façonneur.png";
  const normalized = metierName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .trim();
  return `/assets/rush-sylvestre/${normalized}.png`;
}

/**
 * Détecte si une séquence est purement informative (non cochable, pas de progression)
 */
export function isInfoSequence(seq: RushSequence | null | undefined): boolean {
  if (!seq) return false;
  if (!Array.isArray(seq.activityTags)) return false;
  return seq.activityTags.some((tag) => tag.type === "info_sequence");
}

/**
 * Analyse et extrait des coordonnées Dofus du format [x, y] ou [x, y, worldId]
 */
export function parseCoordinates(
  text: string
): { x: number; y: number; worldId?: number; raw: string; travelCommand: string } | null {
  if (!text) return null;
  const match = text.match(/\[\s*(-?\d+)\s*,\s*(-?\d+)(?:\s*,\s*(\d+))?\s*\]/);
  if (!match) return null;

  const x = parseInt(match[1], 10);
  const y = parseInt(match[2], 10);
  const worldId = match[3] ? parseInt(match[3], 10) : undefined;
  const travelCommand = worldId !== undefined ? `/travel ${x},${y},${worldId}` : `/travel ${x},${y}`;

  return {
    x,
    y,
    worldId,
    raw: match[0],
    travelCommand,
  };
}

/** Référence vers une quête prérequis d'une autre quête. */
export type RushPrereqRef = { seqId: string; milestoneId: string; name: string };

/**
 * Retourne les quêtes prérequis d'une séquence (match par nom via tags `prereq_text`).
 * Indépendant de la complétion : sert à afficher/dispatcher les prérequis cliquables.
 */
export function getPrereqRefs(seq: RushSequence | null | undefined, allMilestones: RushMilestone[]): RushPrereqRef[] {
  if (!seq || !Array.isArray(seq.activityTags) || !seq.activityTags.length) return [];
  const prereqNames = seq.activityTags
    .filter((tag) => tag.type === "prereq_text")
    .map((tag) => tag.name?.toLowerCase().trim())
    .filter(Boolean) as string[];
  if (!prereqNames.length) return [];

  const out: RushPrereqRef[] = [];
  for (const candidateMs of allMilestones) {
    if (candidateMs.type === "SEPARATEUR" || candidateMs.type === "INFO") continue;
    for (const candidateSeq of candidateMs.sequences) {
      if (candidateSeq.id === seq.id) continue;
      const candidateName = (candidateSeq.subGuideName || candidateSeq.subGuideRef || "")
        .toLowerCase()
        .trim();
      if (prereqNames.includes(candidateName)) {
        out.push({
          seqId: candidateSeq.id,
          milestoneId: candidateMs.id,
          name: candidateSeq.subGuideName || candidateSeq.subGuideRef || candidateSeq.id,
        });
      }
    }
  }
  return out;
}

/**
 * Helper pur vérifiant si une séquence est bloquée par des prérequis inachevés.
 * Renvoie false si la séquence n'a pas de tag prereq_text OU si tous les prérequis sont terminés.
 */
export function isSequenceBlockedByPrereqs(
  seq: RushSequence,
  allCompletedSeqIds: Set<string>,
  allMilestones: RushMilestone[]
): boolean {
  if (!seq || !Array.isArray(seq.activityTags) || !seq.activityTags.length) {
    return false;
  }

  const prereqNames = seq.activityTags
    .filter((tag) => tag.type === "prereq_text")
    .map((tag) => tag.name?.toLowerCase().trim())
    .filter(Boolean) as string[];

  if (!prereqNames.length) return false;

  return allMilestones.some((candidateMs) => {
    if (candidateMs.type === "SEPARATEUR" || candidateMs.type === "INFO") return false;
    return candidateMs.sequences.some((candidateSeq) => {
      if (candidateSeq.id === seq.id) return false;
      const candidateName = (
        candidateSeq.subGuideName ||
        candidateSeq.subGuideRef ||
        ""
      )
        .toLowerCase()
        .trim();

      // Si le candidat correspond à un prérequis requis ET qu'il n'est PAS complété -> bloqué
      return (
        prereqNames.includes(candidateName) &&
        !allCompletedSeqIds.has(candidateSeq.id)
      );
    });
  });
}

/**
 * Trouve la prochaine séquence actionnable du guide en appliquant la priorité :
 * 1. Bookmark actif non terminé et non bloqué
 * 2. Première séquence non terminée, non-info et non bloquée par un prérequis
 */
export function findNextActionableSequence(
  milestones: RushMilestone[],
  completedSeqIds: Set<string>,
  bookmarkedSeqId?: string | null
): { milestone: RushMilestone; sequence: RushSequence } | null {
  // 1. Si un bookmark est défini
  if (bookmarkedSeqId) {
    for (const milestone of milestones) {
      if (milestone.type === "SEPARATEUR" || milestone.type === "INFO") continue;
      const seq = milestone.sequences.find((s) => s.id === bookmarkedSeqId);
      if (seq && !completedSeqIds.has(seq.id) && !isInfoSequence(seq)) {
        return { milestone, sequence: seq };
      }
    }
  }

  // 2. Sinon, première séquence non terminée et non bloquée
  for (const milestone of milestones) {
    if (milestone.type === "SEPARATEUR" || milestone.type === "INFO") continue;
    for (const sequence of milestone.sequences) {
      if (
        !completedSeqIds.has(sequence.id) &&
        !isInfoSequence(sequence) &&
        !isSequenceBlockedByPrereqs(sequence, completedSeqIds, milestones)
      ) {
        return { milestone, sequence };
      }
    }
  }

  return null;
}

/**
 * Formatage standardisé des libellés de progression avec unités explicites
 */
export function formatProgressLabel(
  completed: number,
  total: number,
  unit: "étapes" | "quêtes" | "jalons" | "blocs" = "étapes"
): string {
  return `${completed} / ${total} ${unit}`;
}
