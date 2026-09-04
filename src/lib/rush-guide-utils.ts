import type { RushMilestone, RushSequence, RushActivityTag } from "@/types/rush-guide-types";
import { getJob } from "@/lib/dofus-assets";
const LOCAL_ASSET_PREFIXES = ["/uploads/assets-dofus/", "/assets-dofus/"];

/**
 * 🛡️ Résolution locale-first des images d'items (comme ItemSearchPanel).
 *
 * Priorité (autonomie) :
 * 1. Chemin local déjà fourni (WebP siphonné) -> servi en STATIQUE direct
 *    (0 appel proxy, 0 dépendance DofusDB).
 * 2. `id` numérique connu -> on tente directement le WebP local siphonné
 *    `/uploads/assets-dofus/items/{id}.webp` (indépendant si le fichier existe).
 * 3. `id` non numérique / inconnu -> proxy `/api/assets-dofus/items/{id}` qui
 *    siphonne à la volée depuis DofusDB (fallback).
 * 4. Sinon URL distante telle quelle.
 *
 * Helper PUR (client-safe) partagé overlay + dashboard.
 */
export function resolveItemImage(id?: string | number | null, imageUrl?: string | null): string {
  // 1) Chemin local connu -> statique direct.
  if (imageUrl && LOCAL_ASSET_PREFIXES.some((p) => imageUrl.startsWith(p))) {
    return imageUrl;
  }
  // 2) id numérique -> WebP local siphonné (autonome).
  if (id != null && id !== "" && /^\d+$/.test(String(id))) {
    return `/uploads/assets-dofus/items/${id}.webp`;
  }
  // 3) id non numérique -> proxy (fallback ?url=).
  if (id != null && id !== "") {
    const q = imageUrl ? `?url=${encodeURIComponent(imageUrl)}` : "";
    return `/api/assets-dofus/items/${id}${q}`;
  }
  // 4) URL distante / vide.
  return imageUrl || "";
}

/**
 * URL de secours (proxy) pour une image d'item — à utiliser comme `onError` /
 * fallback quand `resolveItemImage` pointe vers un WebP local absent. Le proxy
 * `/api/assets-dofus/items/{id}` sert le WebP localisé ou le siphonne à la
 * volée depuis DofusDB (auto-healing), puis renvoie un placeholder (jamais 404).
 */
export function getItemImageFallback(id?: string | number | null, imageUrl?: string | null): string {
  if (id != null && id !== "") {
    // On ne passe jamais un chemin local comme source distante (ce n'est pas un URL).
    const remote = imageUrl && !imageUrl.startsWith("/") ? imageUrl : null;
    const q = remote ? `?url=${encodeURIComponent(remote)}` : "";
    return `/api/assets-dofus/items/${id}${q}`;
  }
  return imageUrl || "";
}

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
    imagePath: "/assets/rush-sylvestre/faconneur.png",
  },
  solver: {
    label: "Solver",
    color: "#10b981",
    imagePath: "/assets/icons/dofusdb.png",
  },
};

/**
 * Normalise le chemin d'icône pour un métier donné
 */
export function getMetierIconPath(metierName?: string): string {
  if (!metierName) return "/assets/rush-sylvestre/faconneur.png";
  const normalized = metierName
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/ç/g, "c")
    .trim();
  return `/assets/rush-sylvestre/${normalized}.png`;
}

/**
 * Métiers requis AGRÉGÉS sur tout le guide (tags `metier` de toutes les séquences),
 * dédupliqués par id canonique, avec le niveau max rencontré.
 * Utilisé par le GOD (aperçu) et la modale de lancement (détection).
 */
export function getGuideMetiersRequires(
  milestones: RushMilestone[]
): { id: string; name: string; level: number }[] {
  const seen = new Map<string, { id: string; name: string; level: number }>();
  for (const ms of milestones) {
    for (const seq of ms.sequences) {
      for (const tag of (seq.activityTags || []) as RushActivityTag[]) {
        if (tag.type !== "metier" || !tag.name) continue;
        const job = getJob(tag.name);
        const id = job?.id || tag.name.trim().toLowerCase();
        const name = job?.name || tag.name;
        const level = typeof tag.level === "number" ? tag.level : 200;
        const cur = seen.get(id);
        if (!cur || level > cur.level) seen.set(id, { id, name, level });
      }
    }
  }
  return [...seen.values()];
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
 * Extrait la coordonnée d'une séquence (pos_tag > titre > tips > note).
 * Ordre de priorité aligné sur l'édition GOD : le tag technique `pos_tags`
 * (saisi « x, y ; … ») est la source de vérité, puis on retombe sur le titre,
 * les tips et la note (qui peuvent contenir « [x, y] »).
 */
export function getSequenceCoord(seq: RushSequence | null | undefined) {
  if (!seq) return null;
  const posTag = (seq.activityTags || []).find((t) => t.type === "pos_tags");
  const posStr = posTag?.name ? String(posTag.name) : null;
  return parseCoordinates(posStr || "") ||
    parseCoordinates(seq.subGuideName || "") ||
    parseCoordinates(seq.tips || "") ||
    parseCoordinates(seq.note || "") ||
    null;
}

/**
 * Analyse et extrait des coordonnées Dofus du format [x, y] ou [x, y, worldId]
 */
export function parseCoordinates(
  text: string
): { x: number; y: number; worldId?: number; raw: string; travelCommand: string } | null {
  if (!text) return null;
  // Priorité au format canonique [x, y] / [x, y, worldId] (tips, notes).
  let match = text.match(/\[\s*(-?\d+)\s*,\s*(-?\d+)(?:\s*,\s*(\d+))?\s*\]/);
  // Repli : format « pos_tags » saisi au GOD (x, y ; x2, y2) sans crochets.
  if (!match) match = text.match(/(-?\d+)\s*,\s*(-?\d+)/);
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

/**
 * Résout l'icône d'une séquence Rush.
 * - Clé preset (ex. "serie-de-quete", "icone-succes", "ocre") → `/assets/icons/<clé>.png`
 * - URL absolue ou chemin relatif (import d'image via upload) → renvoyée telle quelle
 * - Vide/null → null
 */
export function resolveRushSeqIcon(icon?: string | null | undefined): string | null {
  if (!icon) return null;
  const trimmed = icon.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed) || trimmed.startsWith("/")) return trimmed;
  return `/assets/icons/${trimmed}.png`;
}
