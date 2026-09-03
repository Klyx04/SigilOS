/**
 * overlay-utils.ts
 * Helpers purs pour l'overlay Rush — aucun state, aucun side-effect.
 */

import type { RushMilestone, RushSequence, RushActivityTag } from "@/types/rush-guide-types";
import { parseCoordinates, getSequenceCoord, RUSH_ACTIVITY_TAG_CONFIG, getMetierIconPath, isSequenceBlockedByPrereqs, resolveItemImage } from "@/lib/rush-guide-utils";
// Re-export du helper central pour compatibilité des consumers overlay.
export { getSequenceCoord };
// Re-export pour compatibilité des imports overlay (RushOverlayResourceList, …)
export { resolveItemImage };

// ─── Types locaux ─────────────────────────────────────────────────────────────

export type ParsedCoord = ReturnType<typeof parseCoordinates>;

/** Tags de nature (A) — affichés directement sur la carte */
export const TAG_NATURE_TYPES = [
  "combat_tactique",
  "combat_vagues",
  "songes",
  "combat_solo",
  "combat_plusieurs",
  "plusieurs_personnes",
  "donjon",
] as const;

/** Tags de condition (B) — section repliable courte */
export const TAG_CONDITION_TYPES = [
  "contrainte_horaire",
  "metier",
  "sort",
  "alignReq",
  "alignOrderReq",
  "prereq_text",
] as const;

/** Tags cachés / techniques — jamais affichés */
export const TAG_HIDDEN_TYPES = [
  "pos_tags",
  "tougli_box",
  "info_sequence",
  "dofus_link",
  "ocre_dungeon",
  "quest_group",
  "item",
] as const;

export type TagClassification = {
  nature: RushActivityTag[];   // A — nature de l'étape
  condition: RushActivityTag[]; // B — conditions
  tool: RushActivityTag[];     // C — outils / détails utiles
};

/** Classe les tags d'une séquence selon A/B/C. */
export function classifyTags(tags: RushActivityTag[] | undefined): TagClassification {
  if (!tags) return { nature: [], condition: [], tool: [] };

  const nature: RushActivityTag[] = [];
  const condition: RushActivityTag[] = [];
  const tool: RushActivityTag[] = [];

  for (const tag of tags) {
    if ((TAG_HIDDEN_TYPES as readonly string[]).includes(tag.type)) continue;
    if ((TAG_NATURE_TYPES as readonly string[]).includes(tag.type)) {
      nature.push(tag);
    } else if ((TAG_CONDITION_TYPES as readonly string[]).includes(tag.type)) {
      condition.push(tag);
    } else {
      tool.push(tag);
    }
  }

  return { nature, condition, tool };
}

/** Extrait les tags de type item (ressources) d'une séquence. */
export function getItemTags(tags: RushActivityTag[] | undefined): RushActivityTag[] {
  return (tags || []).filter((t) => t.type === "item" && t.name);
}

/** Ressource agrégée (totaux dédupliqués + quantities sommées). */
export type RushResourceAgg = {
  key: string;
  name: string;
  id?: string;
  imageUrl?: string;
  url?: string;
  count: number;
  levels?: number[];
  chapters?: number[];
};

const normResourceName = (name = "") => name.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Agrège TOUTES les ressources `item` du guide (toutes étapes / tous chapitres),
 * dédupliquées par nom normalisé et quantities sommées. Ignore les tags
 * « instruction » (phrases d'action, pas des ressources) et les tags sans nom.
 */
export function aggregateRushResources(
  milestones: RushMilestone[],
  completedSeqIds?: Set<string>
): RushResourceAgg[] {
  const map = new Map<string, RushResourceAgg>();
  for (const ms of milestones) {
    for (const seq of ms.sequences) {
      // Mode « restantes » : on ignore les ressources des quêtes déjà validées
      // (elles sont "consommées"). Sans `completedSeqIds`, total statique.
      if (completedSeqIds?.has(seq.id)) continue;
      for (const tag of seq.activityTags || []) {
        if (tag.type !== "item" || !tag.name) continue;
        if ((tag as any).kind === "instruction") continue; // phrase d'action, pas une ressource
        // Les entrées « … avec altération Idole de X » sont des DONJONS avec une
        // altération d'idole, pas des objets (non mappés, sans icône DofusDB)
        // → on les écarte de la liste des ressources à prévoir.
        if ((tag as any).kind === "unresolved" && /avec altération/i.test(tag.name)) continue;
        const key = `id:${tag.id ?? ""}|${normResourceName(tag.name)}`;
        const existing = map.get(key);
        const qty = tag.count ?? tag.quantity ?? 1;
        if (!existing) {
          map.set(key, {
            key,
            name: tag.name,
            id: tag.id,
            imageUrl: resolveItemImage(tag.id, tag.imageUrl),
            url: tag.url,
            count: qty,
            levels: tag.level != null ? [tag.level] : [],
            chapters: [ms.chapter],
          });
        } else {
          existing.count += qty;
          if (tag.id) existing.id = existing.id || tag.id;
          if (tag.imageUrl) existing.imageUrl = existing.imageUrl || resolveItemImage(tag.id, tag.imageUrl);
          if (tag.url) existing.url = existing.url || tag.url;
          if (tag.level != null && !existing.levels!.includes(tag.level)) existing.levels!.push(tag.level);
          if (!existing.chapters!.includes(ms.chapter)) existing.chapters!.push(ms.chapter);
        }
      }
    }
  }
  return Array.from(map.values()).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

export type SequenceIcon = { src: string; alt: string };

/**
 * Icônes « nature » d'une séquence (donjon, combat, métier…) pour la vignette de quête.
 * Réutilise les visuels d'activité du module (rush-guide-utils) ; repli sur l'icône de
 * quête générique si aucune nature n'est renseignée.
 */
export function getSequenceIcons(seq: RushSequence): SequenceIcon[] {
  const natureTags = (seq.activityTags || []).filter((t) =>
    (TAG_NATURE_TYPES as readonly string[]).includes(t.type)
  );
  const out: SequenceIcon[] = [];
  const seen = new Set<string>();

  for (const tag of natureTags) {
    const cfg = RUSH_ACTIVITY_TAG_CONFIG[tag.type];
    let src = cfg?.imagePath;
    if (tag.type === "metier") src = getMetierIconPath(tag.name || "");
    const alt = cfg?.label || tag.name || (tag.type === "donjon" ? "Donjon" : "");
    if (src && !seen.has(src)) {
      seen.add(src);
      out.push({ src, alt });
    }
    if (out.length >= 2) break;
  }

  if (out.length === 0 && isDungeonSequence(seq)) {
    out.push({ src: "/assets/rush-sylvestre/donjon.png", alt: "Donjon" });
  }

  return out;
}


/** Détecte si une séquence nécessite un donjon. */
export function isDungeonSequence(seq: RushSequence): boolean {
  const seqAny = seq as any;
  return (
    !!seq.dungeon ||
    (Array.isArray(seqAny.dungeons) && seqAny.dungeons.length > 0) ||
    !!(seq.activityTags?.some((t) => t.type === "donjon" || t.type === "ocre_dungeon"))
  );
}

/** Extrait tous les donjons d'une séquence (supporte donjon singulier et tableau). */
export type DungeonInfo = {
  id?: string;
  name: string | undefined;
  bossName: string | undefined;
  imageUrl: string | undefined;
  isOcre: boolean;
};

export function getDungeons(seq: RushSequence): DungeonInfo[] {
  const seqAny = seq as any;
  const result: DungeonInfo[] = [];

  // Donjon singulier
  if (seq.dungeon) {
    result.push({
      id: (seq.dungeon as any).id,
      name: seq.dungeon.name,
      bossName: seq.dungeon.bossName,
      imageUrl: seq.dungeon.imageUrl ?? undefined,
      isOcre: false,
    });
  }

  // Tableau de donjons
  if (Array.isArray(seqAny.dungeons)) {
    for (const d of seqAny.dungeons) {
      if (!result.find((r) => r.name === d.name)) {
        result.push({
          id: (d as any).id,
          name: d.name,
          bossName: d.bossName,
          imageUrl: d.imageUrl,
          isOcre: !!(seq.activityTags?.some((t) => t.type === "ocre_dungeon")),
        });
      }
    }
  }

  // Pas d'image mais tag donjon
  if (result.length === 0 && isDungeonSequence(seq)) {
    result.push({
      name: undefined,
      bossName: undefined,
      imageUrl: undefined,
      isOcre: !!(seq.activityTags?.some((t) => t.type === "ocre_dungeon")),
    });
  }

  return result;
}

/**
 * Retourne la prochaine séquence à faire :
 * 1. Le bookmark actif (si non terminée)
 * 2. Sinon la première séquence non terminée et non info_sequence
 */
export function getNextObjective(
  sequences: RushSequence[],
  doneSeqIds: Set<string>,
  bookmarkSeqId: string | null | undefined,
  allMilestones: RushMilestone[],
  allCompletedSeqIds: Set<string>
): RushSequence | null {
  const isInfo = (s: RushSequence) =>
    (s.activityTags || []).some((t) => t.type === "info_sequence");
  const isBlocked = (s: RushSequence) =>
    isSequenceBlockedByPrereqs(s, allCompletedSeqIds, allMilestones);

  if (bookmarkSeqId) {
    const bk = sequences.find(
      (s) => s.id === bookmarkSeqId && !doneSeqIds.has(s.id) && !isInfo(s) && !isBlocked(s)
    );
    if (bk) return bk;
  }

  return sequences.find((s) => !doneSeqIds.has(s.id) && !isInfo(s) && !isBlocked(s)) ?? null;
}

/**
 * Navigation intelligente du footer.
 * Retourne l'action à effectuer au clic "Suivant".
 */
export type FooterAction =
  | { type: "next_sequence"; seqId: string }
  | { type: "validate_milestone"; msId: string }
  | { type: "next_milestone" };

export function getFooterNextAction(
  currentMs: RushMilestone,
  doneSeqIds: Set<string>,
  isMsDone: boolean,
  hasNextMs: boolean
): FooterAction {
  if (!isMsDone) {
    const nextSeq = currentMs.sequences.find((s) => !doneSeqIds.has(s.id));
    if (nextSeq) return { type: "next_sequence", seqId: nextSeq.id };
    return { type: "validate_milestone", msId: currentMs.id };
  }
  if (hasNextMs) return { type: "next_milestone" };
  // Guide terminé — on reste
  return { type: "next_milestone" };
}
