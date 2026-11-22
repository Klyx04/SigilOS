/**
 * overlay-utils.ts
 * Helpers purs pour l'overlay Rush — aucun state, aucun side-effect.
 */

import type { RushMilestone, RushSequence, RushActivityTag } from "@/types/rush-guide-types";
import { parseCoordinates, getSequenceCoord, isNonCheckableBlock, RUSH_ACTIVITY_TAG_CONFIG, getMetierIconPath, isSequenceBlockedByPrereqs, resolveItemImage, rushResourceKey } from "@/lib/rush-guide-utils";
import { successIconUrl } from "@/lib/achievement-icon";
import { isRushSequenceBannerMarker } from "@/lib/rush-block-types";
// Re-export du helper central pour compatibilité des consumers overlay.
export { getSequenceCoord };
// Re-export pour compatibilité des imports overlay.
export { resolveItemImage };

/**
 * Index du prochain bloc à proposer dans l'overlay : le prochain bloc QUI RESTE À VALIDER
 * (on saute les chapitres déjà cochés, pour toujours proposer le suivant à faire).
 *
 * ⚠️ `blocks` = les CHAPITRES uniquement : les bannières (séparateur, encart CONSEIL/TIPS,
 * « Dofus obtenu ») ne sont pas des étapes, elles s'affichent dans le flux de leur chapitre
 * (voir `bannersForChapter`) — jamais comme un bloc courant, donc jamais « sautées ».
 *
 * @returns l'index du bloc suivant, ou `null` si on est déjà au bout du guide.
 */
export function nextBlockIndex(
  blocks: Array<Pick<RushMilestone, "id" | "type">>,
  fromIndex: number,
  completedIds: Set<string>
): number | null {
  for (let i = fromIndex + 1; i < blocks.length; i++) {
    if (!completedIds.has(blocks[i].id)) return i;
  }
  return null;
}

/**
 * L'overlay tourne-t-il pour le **guide public** (hors guilde) ?
 *
 * SOURCE UNIQUE : la destination des liens de l'overlay en dépend — une fiche donjon vit
 * `/boss/<slug>` côté public, et `/dashboard/<guildId>/succes?dungeon=…&view=boss` côté
 * interne. Même convention que le reste du dépôt (`BossOverlayClient`).
 */
export function isPublicOverlay(guildId?: string | null): boolean {
  return !guildId || guildId === "public";
}

/**
 * Les bannières à afficher AVEC un chapitre — même règle que le dashboard membre
 * (`chapterPages` : « les bannières restent collées au chapitre qui les suit »).
 *
 * 🎯 Demande user (21/09/2026) : « ces bandeaux-là ont juste à afficher dans l'ordre
 * chronologique » + « si je choisis une étape dans le dropdown, je peux plus retrouver la
 * partie des bandeaux ». Donc une bannière se lit à sa place dans le flux : juste AVANT le
 * chapitre qu'elle introduit — et on la retrouve dès qu'on ouvre ce chapitre, quel que soit
 * le chemin (dropdown, précédent/suivant, repère).
 *
 * @returns `before` = bannières situées entre le chapitre précédent (exclu) et ce chapitre
 *          (exclu) ; `after` = bannières de fin de guide, rattachées au DERNIER chapitre.
 */
export function bannersForChapter(
  allBlocks: RushMilestone[],
  chapterMsId: string | null | undefined
): { before: RushMilestone[]; after: RushMilestone[] } {
  const chapterIdx = allBlocks.findIndex((ms) => ms.id === chapterMsId && !isNonCheckableBlock(ms));
  if (chapterIdx < 0) return { before: [], after: [] };

  const before: RushMilestone[] = [];
  for (let i = chapterIdx - 1; i >= 0; i--) {
    if (!isNonCheckableBlock(allBlocks[i])) break;
    before.unshift(allBlocks[i]);
  }

  // Les bannières qui suivent ce chapitre : elles appartiennent au chapitre SUIVANT, sauf
  // s'il n'y en a plus — elles terminent alors le guide, donc la vue du dernier chapitre.
  const after: RushMilestone[] = [];
  let isLastChapter = true;
  for (let i = chapterIdx + 1; i < allBlocks.length; i++) {
    if (isNonCheckableBlock(allBlocks[i])) continue;
    isLastChapter = false;
    break;
  }
  if (isLastChapter) {
    for (let i = chapterIdx + 1; i < allBlocks.length; i++) {
      if (!isNonCheckableBlock(allBlocks[i])) continue;
      after.push(allBlocks[i]);
    }
  }

  return { before, after };
}

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

/** Tags « succès lié » — un succès officiel, ni une condition ni un outil. */
export const TAG_SUCCESS_TYPES = ["succes"] as const;

/** Tags cachés / techniques — jamais affichés (`npc` a son affichage dédié `NpcBadge`). */
export const TAG_HIDDEN_TYPES = [
  "pos_tags",
  "tougli_box",
  "info_sequence",
  // Marqueur d'un bandeau de séquence Combat (22/11/2026) : il pilote le rendu du
  // bandeau, jamais une puce de nature (le tag `combat_tactique` d'une quête, lui,
  // reste affiché).
  "sequence_banner",
  "dofus_link",
  "ocre_dungeon",
  "quest_group",
  "item",
  "npc",
] as const;

export type TagClassification = {
  /** S — succès officiel lié (tag `succes`), jamais un « détail utile ». */
  success: RushActivityTag[];
  nature: RushActivityTag[];   // A — nature de l'étape
  condition: RushActivityTag[]; // B — conditions
  tool: RushActivityTag[];     // C — outils / détails utiles
};

/** Classe les tags d'une séquence selon A/B/C. */
export function classifyTags(tags: RushActivityTag[] | undefined): TagClassification {
  if (!tags) return { nature: [], condition: [], tool: [], success: [] };

  const nature: RushActivityTag[] = [];
  const condition: RushActivityTag[] = [];
  const tool: RushActivityTag[] = [];
  const success: RushActivityTag[] = [];

  for (const tag of tags) {
    if ((TAG_HIDDEN_TYPES as readonly string[]).includes(tag.type)) continue;
    if ((TAG_SUCCESS_TYPES as readonly string[]).includes(tag.type)) { success.push(tag); continue; }
    if ((TAG_NATURE_TYPES as readonly string[]).includes(tag.type)) {
      nature.push(tag);
    } else if ((TAG_CONDITION_TYPES as readonly string[]).includes(tag.type)) {
      condition.push(tag);
    } else {
      tool.push(tag);
    }
  }

  return { nature, condition, tool, success };
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
        const key = rushResourceKey(tag);
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
    out.push({ src: RUSH_ACTIVITY_TAG_CONFIG.donjon.imagePath, alt: "Donjon" });
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
  /** Slug public (`/boss/<slug>`) quand la donnée de jeu le fournit. */
  slug?: string;
  name: string | undefined;
  bossName: string | undefined;
  imageUrl: string | undefined;
  isOcre: boolean;
  /**
   * V-H — drapeau **fiable** de la table `Dungeon` (le donjon fait partie de la Quête Ocre).
   * Le tag `ocre_dungeon` reste un **repli** : il peut manquer sur une séquence (mesure du
   * 10/11 : Meulou avait `isOcreQuest: true` et aucun tag), et il peut être posé à la main
   * dans le studio God.
   */
  isOcreQuest?: boolean;
  /** Optionnel : ne bloque pas la validation de la quête (verrou `rush-dungeons`). */
  isOptional?: boolean;
  /**
   * Groupe de donjons **au choix** (`null` = exigence simple). Un tag `donjon` qui liste
   * plusieurs donjons séparés par « / » désigne des **alternatives** : un seul suffit.
   */
  choiceGroup?: string | null;
  /** Libellé humain du groupe (« Donjon en fonction de votre niveau »…). */
  choiceLabel?: string | null;
};

/** Normalisation d'un libellé pour rapprocher un nom de tag d'un nom de donjon. */
function normalizeChoiceName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Découpe un tag `donjon` multi : « A / B / C — précision ».
 *
 * La précision après le tiret cadratin n'est **pas** un nom de donjon (« Donjon en
 * fonction de votre niveau ») : elle sert de libellé au groupe.
 */
export function splitDungeonChoiceTag(name: string | null | undefined): {
  segments: string[];
  label: string | null;
} {
  const raw = typeof name === "string" ? name.trim() : "";
  if (!raw || !raw.includes(" / ")) return { segments: [], label: null };
  const segments: string[] = [];
  let label: string | null = null;
  for (const part of raw.split(" / ")) {
    const [head, ...rest] = part.trim().split(/\s+—\s+/);
    const segment = (head ?? "").trim();
    if (segment) segments.push(segment);
    if (!label && rest.length > 0) label = rest.join(" — ").trim() || null;
  }
  return { segments, label };
}

/**
 * Rattache les donjons d'un même tag `donjon` multi à un **groupe de choix**.
 *
 * Mesure du 19/11/2026 sur le guide Touglie : **7 tags multi sur 174**, tous sur deux
 * quêtes — « Le disparu de Sufokia » (1 donjon selon le niveau, 5 listés) et « Les
 * totems de Maïmane » (6 totems, 3 à 5 donjons par totem). Le seed écrit **un tag par
 * groupe** et `dungeonIds` **à plat** : sans cette règle, la quête exige les 5 / 12
 * donjons au lieu d'un par groupe, et reste verrouillée à vie.
 *
 * Le rapprochement se fait **par nom normalisé** (les tags portent les noms, `dungeons`
 * les ids). Un groupe qui ne résout pas au moins **deux** donjons est ignoré : on ne
 * fige jamais une quête sur une donnée absente (fail-open, comme le reste du module).
 */
export function attachDungeonChoices(
  dungeons: DungeonInfo[],
  tags: readonly RushActivityTag[] | null | undefined
): DungeonInfo[] {
  const tagList = Array.isArray(tags) ? tags : [];
  const hasChoiceTag = tagList.some(
    (tag) => tag?.type === "donjon" && splitDungeonChoiceTag(tag.name).segments.length >= 2
  );
  if (dungeons.length === 0 && !hasChoiceTag) return dungeons;
  const out = dungeons.map((d) => ({ ...d }));
  const normalized = out.map((d) => normalizeChoiceName(d.name ?? ""));
  const normalizedNames = new Set(normalized.filter(Boolean));
  const grouped = new Set<number>();
  let groupIndex = 0;

  for (const tag of tagList) {
    if (tag?.type !== "donjon") continue;
    const { segments, label } = splitDungeonChoiceTag(tag.name);
    if (segments.length < 2) continue;
    const key = `choix:${groupIndex++}`;
    const used = new Set<number>();

    for (const segment of segments) {
      const normalizedSegment = normalizeChoiceName(segment);
      if (normalizedSegment.length < 4) continue;

      let matchIndex = -1;
      for (let i = 0; i < out.length; i++) {
        if (grouped.has(i) || used.has(i)) continue;
        const name = normalized[i];
        if (!name || name.length < 4) continue;
        if (name.includes(normalizedSegment) || normalizedSegment.includes(name)) {
          matchIndex = i;
          break;
        }
      }
      if (matchIndex >= 0) {
        used.add(matchIndex);
        grouped.add(matchIndex);
        out[matchIndex] = { ...out[matchIndex], choiceGroup: key, choiceLabel: label ?? "Au choix" };
        continue;
      }
      // Donjon du tag **non résolu en base** (mesure du 19/11 : Maïmane n'a que 11 des
      // 30 donjons) : on garde son nom comme alternative, avec une clé stable `nom:<…>`.
      // Sans cela, les totems 4 à 6 disparaissaient du verrou et la quête se débloquait
      // avec 3 donjons au lieu de 6.
      if (normalizedNames.has(normalizedSegment)) continue;
      normalizedNames.add(normalizedSegment);
      out.push({
        name: segment,
        bossName: undefined,
        imageUrl: undefined,
        isOcre: false,
        choiceGroup: key,
        choiceLabel: label ?? "Au choix",
      });
      const ghostIndex = out.length - 1;
      normalized.push(normalizedSegment);
      used.add(ghostIndex);
      grouped.add(ghostIndex);
    }
  }
  return out;
}

export function getDungeons(seq: RushSequence): DungeonInfo[] {
  const seqAny = seq as any;
  const result: DungeonInfo[] = [];

  // V-H — un tag `ocre_dungeon` désigne UN donjon (`name` = id, slug ou nom selon la
  // source God). L'ancien test marquait TOUS les donjons de la séquence dès qu'un tag
  // existait : un donjon ocre voisin rendait les autres « ocre » à tort.
  const isOcreTagged = (dungeon: {
    id?: string | null;
    slug?: string | null;
    name?: string | null;
  }) =>
    (seq.activityTags ?? []).some(
      (tag) =>
        tag.type === "ocre_dungeon" &&
        !!tag.name &&
        (tag.name === dungeon.id || tag.name === dungeon.slug || tag.name === dungeon.name)
    );

  // Donjon singulier
  if (seq.dungeon) {
    const isOcreQuest = (seq.dungeon as any).isOcreQuest === true;
    result.push({
      id: (seq.dungeon as any).id,
      slug: (seq.dungeon as any).slug,
      name: seq.dungeon.name,
      bossName: seq.dungeon.bossName,
      imageUrl: seq.dungeon.imageUrl ?? undefined,
      isOcre: isOcreQuest || isOcreTagged(seq.dungeon as any),
      isOcreQuest,
      isOptional: seq.dungeon.isOptional === true,
    });
  }

  // Tableau de donjons
  if (Array.isArray(seqAny.dungeons)) {
    for (const d of seqAny.dungeons) {
      if (!result.find((r) => r.name === d.name)) {
        const isOcreQuest = (d as any).isOcreQuest === true;
        result.push({
          id: (d as any).id,
          slug: (d as any).slug,
          name: d.name,
          bossName: d.bossName,
          imageUrl: d.imageUrl,
          isOcre: isOcreQuest || isOcreTagged(d),
          isOcreQuest,
          isOptional: (d as any).isOptional === true,
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
      isOcre: (seq.activityTags ?? []).some((tag) => tag.type === "ocre_dungeon"),
    });
  }

  return attachDungeonChoices(result, seq.activityTags);
}

/**
 * Retourne la prochaine séquence à faire :
 * 1. Le bookmark actif (si non terminée)
 * 2. Sinon la première séquence non terminée et non bandeau (conseil ou combat)
 */
export function getNextObjective(
  sequences: RushSequence[],
  doneSeqIds: Set<string>,
  bookmarkSeqId: string | null | undefined,
  allMilestones: RushMilestone[],
  allCompletedSeqIds: Set<string>
): RushSequence | null {
  // Règle PARTAGÉE (`isRushSequenceBannerMarker`) : `info_sequence` et le marqueur
  // `sequence_banner` des bandeaux Combat ne sont pas des objectifs — le tag
  // `combat_tactique` d'une quête, lui, en reste un.
  const isInfo = (s: RushSequence) =>
    (s.activityTags || []).some((t) => isRushSequenceBannerMarker(t));
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

/**
 * Icône d'un badge d'activité (lignes + modale détail).
 * Résolution par type puis par libellé (ex. alignement « Bonta » → blason).
 * Retourne null quand aucun asset ne correspond (badge texte seul).
 * Pur et client-safe.
 */
export function getTagBadgeIcon(tag: { type: string; name?: string | null; iconId?: number | null }): string | null {
  if (tag.type === "succes") return successIconUrl(tag.iconId);
  const label = `${tag.type || ""} ${(tag.name || "").toLowerCase()}`;
  if (label.includes("brakmar")) return "/ordres/brakmar.png";
  if (label.includes("bonta")) return "/ordres/bonta.png";
  if (tag.type === "metier") return getMetierIconPath(tag.name || "");
  // Pictos d'activité : une seule vérité, le référentiel partagé (pictos du jeu
  // colorés, lisibles en clair comme en sombre). `ocre_dungeon` est un alias
  // de donjon côté data.
  const cfg = RUSH_ACTIVITY_TAG_CONFIG[tag.type === "ocre_dungeon" ? "donjon" : tag.type];
  if (cfg) return cfg.imagePath;
  // Type de combat non répertorié : plutôt que rien, l'épée croisée de référence.
  if (tag.type.startsWith("combat_")) return RUSH_ACTIVITY_TAG_CONFIG.combat_plusieurs.imagePath;
  return null;
}
