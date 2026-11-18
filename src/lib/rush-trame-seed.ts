/**
 * **Seed de la route Rush Sylvestre** — corrélation Trame → payload d'import God.
 *
 * La Trame (`src/temp/trame-rush/data.json`, outil local hors dépôt) a déjà fait le
 * rapprochement Tougli × Dofusyelle : 530 quêtes, 36 blocs, 57 étapes, 361/384 quêtes
 * Yelle appariées. Ce module ne re-siphonne rien : il **met en forme** ce corpus dans
 * le payload additif de `importRushGuide`, avec deux spines :
 *
 * - `tougli` : les **36 blocs** de Tougli (référence exhaustive, deux cités, 6 Ordres) ;
 * - `yelle`  : les **57 étapes** chronologiques de Dofusyelle (référence de trame).
 *
 * Règles :
 *  · les **conditions** (`Classe=`, `Ali=`, `Ordre=`) viennent des branches de la Trame,
 *    jamais d'une déduction sur le nom d'une quête ;
 *  · les **ressources** et contraintes viennent de `quests[id].items` / `.constraints` ;
 *  · les **textes Yelle/Tougli ne sont pas recopiés** : le seed ne pose que des
 *    descriptions factuelles et quelques conseils rédigés pour SigilOS ;
 *  · une quête non appariée n'est **jamais perdue** : elle est créée sans id DofusDB
 *    et signalée dans le rapport.
 */

import type { RushImportActivityTag, RushImportBlock, RushImportSequence } from "@/lib/rush-import";
import { RUSH_DOFUS_META } from "@/lib/rush-dofus-meta";
import type { RushMilestoneType } from "@/types/rush-guide-types";

export type RushTrameSpine = "tougli" | "yelle";

type TrameConstraint = {
  type?: string;
  label?: string;
  detail?: string;
  refs?: { mode?: string; level?: number; [key: string]: unknown };
};

type TrameItem = { id?: number | string; name?: string; count?: number; quantity?: number };

type TrameQuest = {
  id?: number;
  name?: string;
  level?: number;
  dnpl?: string | null;
  constraints?: TrameConstraint[];
  items?: TrameItem[];
  /** Ids DofusDB des donjons — **portables** entre local et VPS. */
  dungeonIds?: number[];
  /** Ids locaux de la Trame (cuid) — **non portables**, conservés pour mémoire. */
  dungeonOurIds?: string[];
  dungeonNames?: string[];
  /** Prérequis **entre quêtes** (Touglie) : ids des quêtes à terminer avant celle-ci. */
  prereqIds?: number[];
};

type TrameCondition = { kind?: string; raw?: string; value?: string | null };

type TrameItemNode = {
  kind?: string;
  questId?: number;
  name?: string;
  title?: string;
  questIds?: number[];
  names?: string[];
  text?: string;
  branches?: Array<{ condition?: TrameCondition; items?: TrameItemNode[] }>;
  items?: TrameItemNode[];
};

type TrameBlock = { id?: number; order?: number; title?: string; items?: TrameItemNode[] };

type TrameDungeonNode =
  | string
  | {
      name?: string;
      t?: string;
      title?: string;
      items?: Array<{ name?: string; t?: string; title?: string } | string>;
    };

type TrameStep = {
  n?: number;
  category?: string;
  title?: string;
  body?: unknown[];
  donjons?: TrameDungeonNode[];
  succes?: Array<{ t?: string; title?: string } | string>;
  quetes?: Array<{ t?: string; u?: string }>;
};

type TrameCorrelation = { step?: number; title?: string; questIds?: number[]; matched?: boolean };

export type TrameInput = {
  blocks?: TrameBlock[];
  quests?: Record<string, TrameQuest>;
  referentials?: { ordres?: Array<{ code?: string; camp?: string; paliers?: number[] }> };
  dofusyelle?: { steps?: TrameStep[]; correlation?: TrameCorrelation[] };
};

/** Succès officiel (`public/game-data/achievements.json`) : id, nom, quêtes couvertes. */
export type RushAchievementInput = { id: number; name: string; questIds?: number[] };

/** Objectif officiel d'un Dofus (`public/game-data/dofusdex.json`). */
export type RushDofusDexObjective = {
  order?: number;
  objectiveId?: number | null;
  type?: string;
  id?: number;
  name?: string | null;
  level?: number | null;
  isAchievement?: boolean;
};

export type RushDofusDexStep = {
  order?: number;
  type?: string;
  id?: number;
  name?: string | null;
  level?: number | null;
  objectives?: RushDofusDexObjective[];
};

export type RushDofusDexEntry = {
  id?: number;
  name?: string | null;
  minLevel?: number | null;
  maxLevel?: number | null;
  prerequisites?: RushDofusDexStep[];
  steps?: RushDofusDexStep[];
};

export type RushDofusDex = { dofus?: RushDofusDexEntry[] };

export type RushTrameSeedOptions = {
  spine?: RushTrameSpine;
  /** Ajoute les 19 quêtes de classe au premier bloc « Incarnam » du spine Yelle. */
  includeClasses?: boolean;
  /** Ajoute les succès Yelle comme étapes `isSuccess`. */
  includeSuccesses?: boolean;
  /** Ajoute les ressources/contraintes des quêtes comme tags d'activité. */
  includeResources?: boolean;
  /**
   * Plafond de sécurité par bloc (le schéma Zod accepte 120). Mesuré le 18/11/2026 :
   * « Alignement - Partie 2/4 » porte **90 quêtes** ; un plafond à 80 coupait les 10
   * dernières (dont « Manière forte » et « Retour aux origines »), donc leurs prérequis
   * ne pouvaient pas être posés.
   */
  maxSequencesPerBlock?: number;
  /** DofusDex officiel (`public/game-data/dofusdex.json`) : enrichit les blocs DOFUS. */
  dofusdex?: RushDofusDex | null;
  /**
   * **Touglie enrichi** : garde la charpente Touglie et y fusionne les succès, conseils
   * rédigés, DofusDex et donjons Dofusyelle déjà corrélés. Sans effet sur le spine Yelle,
   * qui est déjà la source.
   */
  enrichFromYelle?: boolean;
  /**
   * Verrou d'**ordre** de la route (option C, 18/11/2026) : chaque quête exige la précédente
   * de sa branche. `false` pour ne tester que le graphe du jeu (prérequis officiels).
   */
  routeOrderLock?: boolean;
  /** Succès officiels : leur présence pose un tag `succes` sur les quêtes qu'ils couvrent. */
  achievements?: RushAchievementInput[];
};

export type RushTrameSeedReport = {
  spine: RushTrameSpine;
  blocks: number;
  sequences: number;
  questsWithIds: number;
  resources: number;
  successes: number;
  /** Succès Dofusyelle fusionnés dans la charpente Touglie (0 pour le spine Yelle). */
  yelleSuccesses: number;
  /** Conseils Dofusyelle rédigés posés sur une quête Touglie. */
  yelleTipsMerged: number;
  /** Blocs Touglie enrichis par un DofusDex d'étape Dofusyelle. */
  yelleDofusDexMerged: number;
  /** Blocs Touglie ayant reçu une ligne « Donjons (étape Yelle N) ». */
  yelleDungeonBlocks: number;
  /** Blocs `DOFUS` enrichis avec la checklist officielle + le `dofusId`. */
  dofusDexTagged: number;
  /** Tags `prereq_text` posés depuis les `prereqIds` de la Trame (442 sur 492 le 17/11/2026). */
  prereqTags: number;
  /** Arêtes de prérequis écartées : cible absente, autre branche, soi-même, plafond de tags. */
  prereqSkipped: number;
  /** Prérequis d'**ordre** posés par la route (chaque quête exige la précédente de sa branche). */
  routePrereqs: number;
  /** Succès officiels attachés (au moins une quête couverte). */
  successAchievements: number;
  /** Tags `succes` posés sur des quêtes. */
  successTags: number;
  /** Quêtes distinctes portant au moins un succès. */
  successQuests: number;
  unmatched: Array<{ step: number | null; title: string; reason: string }>;
  tipsToWrite: Array<{ step: number | null; title: string; category: string; lines: number }>;
  blockTypes: Record<string, number>;
  warnings: string[];
};

export type RushTrameSeedResult = {
  payload: { blocks: RushImportBlock[] };
  report: RushTrameSeedReport;
};

const ORDER_LEVELS = [20, 40, 60, 80, 100] as const;

/**
 * Marqueur des quêtes **parallèles** (branche `group` d'un bloc) : leur ordre interne
 * n'a pas d'importance, elles ne s'enchaînent donc pas entre elles (verrou d'ordre, C).
 */
const PARALLEL_NOTE = "Quête parallèle — l'ordre interne n'a pas d'importance.";

/**
 * Conseils **rédigés pour SigilOS** sur les étapes où le guide source porte un
 * avertissement mesuré (cf. `docs/plans/MAPPING-RUSH-SYLvestre.md` et les captures du
 * 17/11/2026). Aucun texte tiers n'est recopié : ce sont des paraphrases courtes.
 * Les autres étapes restent sans conseil et sont listées dans `tipsToWrite`.
 */
const YELLE_DEMO_TIPS: Record<number, string> = {
  1: "Lance « Éternelle Moisson » tôt et garde la première ouverture pour un Kralamoure ; lance « Chaque chose en son temps » dès qu'une anomalie ouvre (Pixel Perpétuel).",
  2: "Prends toutes les quêtes des PNJ d'Incarnam et d'Astrub. Le Dofus Argenté n'est pas nécessaire tout de suite, mais garde-en un dans l'inventaire pour plus tard.",
  23: "Un seul Kanigroula peut couvrir le Dofus Turquoise et l'alignement : arrête-toi au Korriandre et termine « Chachnée de vie ».",
  37: "Avant les dialogues avec les Sages, vérifie que tout est prêt : une erreur peut bloquer environ 30 minutes.",
  40: "Parle à Rathrosk avant Thanatena pour « L'ovis de la mort », puis enchaîne jusqu'à « Prise de conscience ».",
  52: "Pour « Une voie de cristal », parle au Pichon extérieur.",
  54: "Ne lance pas « Le Silence est d'Aure » : cette quête est hors route.",
};

/**
 * ⚠️ Aucune couleur dans le seed : `accentColor` reste `null` et la **DA / le type**
 * fournit la teinte (source unique : palette du studio, tokens de la landing). Un seed
 * qui écrirait des hex figerait une deuxième palette, interdite par `docs/RULES.md`.
 */

/** Texte borné (les données de la Trame sont hétérogènes). */
function text(value: unknown, max = 200): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Clé de titre tolérante (casse, accents, ponctuation) pour apparier Yelle ↔ Trame. */
function normTitle(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const DOFUS_STOP_WORDS = new Set(["dofus", "du", "de", "des", "la", "le", "les", "l", "d"]);

/** Mots significatifs d'un nom de Dofus (« Dofus du Cauchemar » → `cauchemar`). */
function significantTokens(value: string): string[] {
  return normTitle(value)
    .split(" ")
    .filter((token) => token && !DOFUS_STOP_WORDS.has(token));
}

/**
 * Retrouve l'entrée DofusDex d'un bloc par **recouvrement de mots**.
 *
 * « Dofus Pourpre », « Dofus Pourpre 2 » et « Quêtes Pandala - Domakuro » retrouvent
 * respectivement `Dofus Pourpre` et `Domakuro` sans table d'alias. Un bloc générique
 * (« Dofus ») ne matche rien : `dofus` est un mot vide.
 */
function findDofusDexEntry(title: string, dofusdex?: RushDofusDex | null): RushDofusDexEntry | null {
  if (!dofusdex) return null;
  const titleTokens = new Set(significantTokens(title));
  if (titleTokens.size === 0) return null;
  const candidates = (dofusdex.dofus ?? []).filter((entry) => {
    const nameTokens = significantTokens(text(entry.name));
    return nameTokens.length > 0 && nameTokens.every((token) => titleTokens.has(token));
  });
  candidates.sort((a, b) => text(b.name).length - text(a.name).length);
  return candidates[0] ?? null;
}

/** Identifiant `RUSH_DOFUS_META` d'un bloc (match le plus long : Argenté ≠ Scintillant). */
function dofusIdForTitle(title: string): string | null {
  const titleTokens = new Set(significantTokens(title));
  const candidates = RUSH_DOFUS_META.filter((meta) => {
    const metaTokens = significantTokens(meta.id.replace(/_/g, " "));
    return metaTokens.length > 0 && metaTokens.every((token) => titleTokens.has(token));
  });
  candidates.sort((a, b) => b.id.length - a.id.length);
  return candidates[0]?.id ?? null;
}

/** Construit la checklist DofusDex d'une entrée (objectifs, niveaux, prérequis). */
function buildDofusDexChecklist(entry: RushDofusDexEntry): { checklist: string; objectives: number } | null {
  const lines: string[] = [];
  const seen = new Set<string>();
  for (const step of entry.steps ?? []) {
    const objectives = step.objectives?.length ? step.objectives : [step];
    for (const objective of objectives) {
      const name = text(objective.name, 200);
      if (!name) continue;
      const key = `${objective.type ?? step.type ?? "?"}:${objective.id ?? step.id ?? name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const level = objective.level ?? step.level;
      lines.push(`- ${name}${typeof level === "number" ? ` (Niv. ${level})` : ""}`);
    }
  }
  if (lines.length === 0) return null;

  const prerequisites = (entry.prerequisites ?? [])
    .map((step) => text(step.name, 200))
    .filter(Boolean);
  const range =
    entry.minLevel != null && entry.maxLevel != null ? ` (${entry.minLevel}–${entry.maxLevel})` : "";
  return {
    checklist: [
      `**DofusDex officiel** — ${text(entry.name)}${range}`,
      ...lines,
      ...(prerequisites.length ? [`**Prérequis** : ${prerequisites.join(", ")}`] : []),
    ].join("\n"),
    objectives: lines.length,
  };
}

// Le schéma d'import borne `tips` à 4 000 caractères : un Dofus à 20 objectifs +
// 18 prérequis dépasserait et ferait refuser TOUT le payload. On tronque proprement.
const MAX_TIPS = 3950;

/**
 * Applique **une entrée DofusDex** à un bloc, sans doublon.
 *
 * `titleForId` sert au repli `dofusId` : une étape Yelle « Quêtes Pandala - Domakuro »
 * appliquée à un bloc Touglie « Pandala » retrouve bien `domakuro`.
 */
function applyDofusDexEntry(
  block: RushImportBlock,
  entry: RushDofusDexEntry,
  titleForId = block.title
): boolean {
  const built = buildDofusDexChecklist(entry);
  if (!built) return false;

  const header = `**DofusDex officiel** — ${text(entry.name)}`;
  if ((block.tips ?? "").includes(header)) return false; // déjà posé (titre Touglie ou autre étape)

  const combined = [block.tips, built.checklist].filter(Boolean).join("\n\n");
  block.tips =
    combined.length <= MAX_TIPS ? combined : `${combined.slice(0, MAX_TIPS).trimEnd()}\n…`;
  block.description = [block.description, `DofusDex : ${built.objectives} objectif(s) officiel(s).`]
    .filter(Boolean)
    .join(" ");
  block.dofusId = block.dofusId ?? dofusIdForTitle(titleForId);
  return true;
}

/**
 * Enrichit un bloc avec la **checklist officielle** du DofusDex : objectifs (noms +
 * niveaux), prérequis et `dofusId`. Aucune description Ankama n'est recopiée — ce sont
 * des faits de progression, affichés en markdown dans les conseils du bloc.
 */
function enrichWithDofusDex(block: RushImportBlock, dofusdex?: RushDofusDex | null): boolean {
  const entry = findDofusDexEntry(block.title, dofusdex);
  if (!entry) return false;
  return applyDofusDexEntry(block, entry);
}

/** Aplatit les donjons d'une étape Yelle : groupe `{ items:[{ t }] }`, `{ name }` ou string. */
function dungeonNamesOf(step: TrameStep): string[] {
  const names: string[] = [];
  for (const entry of step.donjons ?? []) {
    if (typeof entry === "string") {
      const name = text(entry, 200);
      if (name) names.push(name);
      continue;
    }
    if (!entry || typeof entry !== "object") continue;
    if (Array.isArray(entry.items)) {
      for (const item of entry.items) {
        const name = text(
          typeof item === "string" ? item : item?.t ?? item?.name ?? item?.title,
          200
        );
        if (name) names.push(name);
      }
      continue;
    }
    const name = text(entry.name ?? entry.t ?? entry.title, 200);
    if (name) names.push(name);
  }
  return [...new Set(names)];
}

function typeForTougliBlock(title: string): RushMilestoneType {
  const t = title.toLowerCase();
  if (t.includes("alignement") || t.includes("ordres")) return "ALIGNEMENT";
  if (t.includes("donjons")) return "DONJON";
  if (t.includes("dofus")) return "DOFUS";
  if (t.includes("prérequis") || t.includes("pre-requis")) return "PREREQUIS";
  if (t.includes("introduction")) return "INFO";
  if (
    t.includes("frigost") ||
    t.includes("pandala") ||
    t.includes("silvosse") ||
    t.includes("valonia") ||
    t.includes("zone") ||
    t.includes("necronyx") ||
    t.includes("dazak")
  ) {
    return "ZONE";
  }
  return "QUETE_SERIE";
}

function typeForYelleStep(step: TrameStep): RushMilestoneType {
  const category = text(step.category).toLowerCase();
  const title = text(step.title).toLowerCase();
  if ((step.n ?? 0) <= 1) return "INFO";
  if (category.includes("alignement")) return "ALIGNEMENT";
  if (category.includes("dofus")) {
    return title.startsWith("récupérer") || title.startsWith("recuperer") ? "DOFUS_OBTAINED" : "DOFUS";
  }
  if (
    category.includes("frigost") ||
    category.includes("silvosse") ||
    category.includes("pandala") ||
    category.includes("sidimote") ||
    category.includes("zone dazak") ||
    category.includes("valonia") ||
    category.includes("necronyx")
  ) {
    return "ZONE";
  }
  if ((step.quetes ?? []).length === 0 && (step.donjons ?? []).length > 0) return "DONJON";
  if ((step.quetes ?? []).length === 0 && (step.succes ?? []).length > 0) return "SUCCES";
  return "QUETE_SERIE";
}

type QuestRouteMeta = {
  alignReq?: string | null;
  alignOrderCode?: string | null;
  alignLevelReq?: number | null;
  classReq?: string | null;
};

/**
 * Indexe les **conditions** des branches de la Trame par `questId`.
 *
 * C'est la source unique de la classe / cité / Ordre / palier du seed : aucune
 * déduction depuis le nom d'une quête. Une branche `Ordre=CV` porte 5 quêtes, dans
 * l'ordre des paliers 20 → 100 ; le palier est donc l'**index** de la quête.
 */
function buildQuestMeta(trame: TrameInput): Map<number, QuestRouteMeta> {
  const meta = new Map<number, QuestRouteMeta>();
  const orderCamp = new Map<string, string>();
  for (const order of trame.referentials?.ordres ?? []) {
    if (order.code && order.camp) orderCamp.set(order.code, order.camp);
  }

  const apply = (node: TrameItemNode | undefined, patch: QuestRouteMeta): void => {
    if (!node) return;
    if (node.kind === "quest" && typeof node.questId === "number") {
      meta.set(node.questId, { ...(meta.get(node.questId) ?? {}), ...patch });
      return;
    }
    if (node.kind === "choice" && node.branches) {
      for (const branch of node.branches) {
        const condition = branch.condition ?? {};
        const kind = text(condition.kind).toLowerCase();
        const value = text(condition.value);
        const branchMeta: QuestRouteMeta = { ...patch };
        if (kind === "classe") branchMeta.classReq = value || null;
        else if (kind === "camp") branchMeta.alignReq = value || "neutre";
        else if (kind === "ordre") {
          branchMeta.alignOrderCode = value || null;
          branchMeta.alignReq = orderCamp.get(value) ?? null;
        }
        (branch.items ?? []).forEach((child, index) => {
          const childMeta: QuestRouteMeta = { ...branchMeta };
          if (kind === "ordre") childMeta.alignLevelReq = ORDER_LEVELS[index] ?? null;
          apply(child, childMeta);
        });
      }
      return;
    }
    for (const child of node.items ?? []) apply(child, patch);
  };

  for (const block of trame.blocks ?? []) {
    for (const item of block.items ?? []) apply(item, {});
  }
  return meta;
}

/** Tags d'activité d'une quête : ressources + contraintes, bornés et dédoublonnés. */
function tagsForQuest(quest: TrameQuest | undefined, includeResources: boolean): RushImportActivityTag[] {
  if (!quest || !includeResources) return [];
  const tags: RushImportActivityTag[] = [];
  const seenNonItem = new Set<string>();

  for (const item of (quest.items ?? []).slice(0, 30)) {
    const name = text(item.name, 200);
    if (!name) continue;
    const id = item.id == null ? undefined : String(item.id).slice(0, 64);
    const quantity = Math.max(0, Math.min(1_000_000, Number(item.count ?? item.quantity ?? 1) || 1));
    tags.push({ type: "item", name, ...(id ? { id } : {}), quantity });
  }

  const pushOnce = (tag: RushImportActivityTag) => {
    const key = `${tag.type}:${tag.name ?? ""}`;
    if (seenNonItem.has(key)) return;
    seenNonItem.add(key);
    tags.push(tag);
  };

  for (const constraint of quest.constraints ?? []) {
    const type = text(constraint.type).toLowerCase();
    const name = text(constraint.detail ?? constraint.label, 200);
    const level =
      typeof constraint.refs?.level === "number"
        ? Math.max(0, Math.min(200, Math.round(constraint.refs.level)))
        : undefined;

    if (type === "combat") {
      const mode = text(constraint.refs?.mode).toLowerCase();
      const tag =
        mode === "tactical"
          ? "combat_tactique"
          : mode === "solowaves" || mode === "groupwaves"
            ? "combat_vagues"
            : mode === "solo"
              ? "combat_solo"
              : "combat_plusieurs";
      pushOnce({ type: tag, ...(name ? { name } : {}) });
    } else if (type === "needplayer") {
      pushOnce({ type: "plusieurs_personnes", ...(name ? { name } : {}) });
    } else if (type === "job") {
      pushOnce({ type: "metier", ...(name ? { name } : {}), ...(level != null ? { level } : {}) });
    } else if (type === "hours") {
      pushOnce({ type: "contrainte_horaire", ...(name ? { name } : {}) });
    } else if (type === "songe") {
      pushOnce({ type: "songes", ...(name ? { name } : {}) });
    } else if (type === "spell") {
      pushOnce({ type: "sort", ...(name ? { name } : {}) });
    } else if (type === "dungeon" || type === "dungeonchoice") {
      pushOnce({ type: "donjon", ...(name ? { name } : {}) });
    } else if (type === "bashmobs") {
      pushOnce({ type: "combat_solo", ...(name ? { name } : {}) });
    }
  }

  return tags.slice(0, 30);
}

/** Une quête de la Trame → une séquence d'import (nom, liens, ressources, route). */
function sequenceForQuest(
  questId: number,
  trame: TrameInput,
  meta: Map<number, QuestRouteMeta>,
  includeResources: boolean,
  patch: Partial<RushImportSequence> = {}
): RushImportSequence {
  const quest = trame.quests?.[String(questId)];
  const route = meta.get(questId) ?? {};
  return {
    subGuideName: text(quest?.name ?? patch.subGuideName, 200) || `Quête ${questId}`,
    questDbIds: [questId],
    dofusdbUrl: `https://dofusdb.fr/database/quest/${questId}`,
    ...(quest?.dnpl ? { dofuspourlesnoobsUrl: quest.dnpl } : {}),
    // ⚠️ `dungeonOurIds` est un cuid **local** : il ne survit pas à l'import sur le VPS.
    // On transporte l'id DofusDB, que le serveur résout par `Dungeon.dofusdbId`.
    ...(quest?.dungeonIds?.length ? { dungeonDbIds: quest.dungeonIds.slice(0, 12) } : {}),
    ...(quest?.dungeonNames?.length
      ? {
          dungeonNames: quest.dungeonNames
            .slice(0, 12)
            .map((name) => text(name, 200))
            .filter(Boolean),
        }
      : {}),
    ...(route.classReq ? { classReq: route.classReq } : {}),
    ...(route.alignReq ? { alignReq: route.alignReq } : {}),
    ...(route.alignOrderCode ? { alignOrderCode: route.alignOrderCode } : {}),
    ...(route.alignLevelReq ? { alignLevelReq: route.alignLevelReq } : {}),
    activityTags: tagsForQuest(quest, includeResources),
    isOptional: false,
    isSuccess: false,
    ...patch,
  };
}

/** Ajoute une séquence sans doublon dans le bloc (clé = nom normalisé). */
function pushUnique(sequences: RushImportSequence[], sequence: RushImportSequence): boolean {
  const key = sequence.subGuideName.trim().toLowerCase();
  if (sequences.some((existing) => existing.subGuideName.trim().toLowerCase() === key)) return false;
  sequences.push(sequence);
  return true;
}

/** Plafond du schéma d'import (`RushImportSequenceSchema`) : au-delà, l'import est refusé. */
const MAX_ACTIVITY_TAGS = 30;

/**
 * Prérequis **entre quêtes** — `quests[id].prereqIds` (Touglie) → tags `prereq_text` par nom.
 *
 * La Trame porte **492 arêtes** sur 430 quêtes, **sans opérateur** : la liste est plate, donc
 * chaque arête est lue en **ET** par `isSequenceBlockedByPrereqs`. Trois gardes :
 *
 *  · **branche** : une cible conditionnée par une autre cité ou une autre classe n'est
 *    jamais posée — elle filtrerait la quête à vie pour un joueur de l'autre branche
 *    (mesure du 17/11/2026 : 19 arêtes de classe sur `1960`, 1 arête de cité) ;
 *  · **cible absente** du guide (ou nom vide) : rien n'est inventé, l'arête est comptée ;
 *  · **plafond** : le schéma d'import borne `activityTags` à 30 — les prérequis prennent la
 *    place restante, jamais celle des ressources (une ressource effacée serait une perte).
 *
 * Le nom est le seul lien disponible **avant** l'import (les ids de séquence n'existent pas
 * encore) : c'est exactement ce que `resolvePrereqTag` sait résoudre ; T-2c backfillera l'id
 * une fois les lignes créées. `1960` (« Ça sent le gaz ») n'est jamais posé : ses 19 arêtes
 * visent des quêtes de classe, déjà couvertes par `classReq` + `resolveRushRoute`.
 */
function attachQuestPrerequisites(
  trame: TrameInput,
  blocks: RushImportBlock[]
): { tags: number; skipped: number } {
  type PrereqTarget = {
    sequence: RushImportSequence;
    name: string;
    alignReq: string;
    classReq: string;
  };

  const byQuest = new Map<number, PrereqTarget>();
  for (const block of blocks) {
    for (const sequence of block.sequences) {
      const name = text(sequence.subGuideName, 200);
      if (!name) continue;
      for (const questId of sequence.questDbIds ?? []) {
        if (byQuest.has(questId)) continue;
        byQuest.set(questId, {
          sequence,
          name,
          alignReq: text(sequence.alignReq, 60),
          classReq: text(sequence.classReq, 60),
        });
      }
    }
  }

  let tags = 0;
  let skipped = 0;
  for (const block of blocks) {
    for (const sequence of block.sequences) {
      const ownAlign = text(sequence.alignReq, 60);
      const ownClass = text(sequence.classReq, 60);
      const wanted: string[] = [];
      const seen = new Set<string>();

      for (const questId of sequence.questDbIds ?? []) {
        for (const prereqId of trame.quests?.[String(questId)]?.prereqIds ?? []) {
          const target = byQuest.get(prereqId);
          if (!target || target.sequence === sequence) {
            skipped += 1;
            continue;
          }
          if (target.classReq && target.classReq !== ownClass) {
            skipped += 1;
            continue;
          }
          if (target.alignReq && target.alignReq !== ownAlign) {
            skipped += 1;
            continue;
          }
          const key = target.name.toLowerCase();
          if (seen.has(key)) continue;
          seen.add(key);
          wanted.push(target.name);
        }
      }
      if (wanted.length === 0) continue;

      const existingTags = Array.isArray(sequence.activityTags) ? sequence.activityTags : [];
      const existingNames = new Set(
        existingTags
          .filter((tag) => tag.type === "prereq_text")
          .map((tag) => text(tag.name, 200).toLowerCase())
      );
      const room = MAX_ACTIVITY_TAGS - existingTags.length;
      if (room <= 0) {
        skipped += wanted.length;
        continue;
      }

      const added: RushImportActivityTag[] = [];
      for (const name of wanted.slice(0, room)) {
        if (existingNames.has(name.toLowerCase())) continue;
        added.push({ type: "prereq_text", name });
      }
      if (added.length === 0) continue;
      sequence.activityTags = [...existingTags, ...added];
      tags += added.length;
      skipped += wanted.length - added.length;
    }
  }

  return { tags, skipped };
}

/**
 * Succès officiels (`public/game-data/achievements.json`) → tag `succes` sur **chaque quête**
 * que le succès couvre.
 *
 * Un succès n'est **jamais** une case à cocher : sa progression est celle de ses quêtes
 * (mesure du 18/11/2026 : les 68 lignes `isSuccess` étaient 68 doublons cochables, sans
 * aucune quête liée). Une quête pleine (30 tags) n'en reçoit pas — les ressources passent avant.
 */
function attachSuccessTags(
  blocks: RushImportBlock[],
  achievements: RushAchievementInput[] | undefined
): { achievements: number; tags: number; quests: number } {
  if (!achievements?.length) return { achievements: 0, tags: 0, quests: 0 };

  const byQuest = new Map<number, RushImportSequence>();
  for (const block of blocks) {
    for (const sequence of block.sequences) {
      for (const questId of sequence.questDbIds ?? []) {
        if (!byQuest.has(questId)) byQuest.set(questId, sequence);
      }
    }
  }

  const touched = new Set<RushImportSequence>();
  let attached = 0;
  let tags = 0;
  for (const achievement of achievements) {
    const name = text(achievement.name, 200);
    if (!name) continue;
    const id = String(achievement.id);
    let used = false;
    for (const questId of achievement.questIds ?? []) {
      const sequence = byQuest.get(questId);
      if (!sequence) continue;
      const current = Array.isArray(sequence.activityTags) ? sequence.activityTags : [];
      if (current.some((tag) => tag.type === "succes" && tag.id === id)) {
        used = true;
        continue;
      }
      if (current.length >= MAX_ACTIVITY_TAGS) continue;
      sequence.activityTags = [...current, { type: "succes", name, id }];
      touched.add(sequence);
      tags += 1;
      used = true;
    }
    if (used) attached += 1;
  }
  return { achievements: attached, tags, quests: touched.size };
}

/**
 * Verrou d'**ORDRE** de la route (option C, 18/11/2026) — chaque quête exige la **précédente
 * de sa branche**, sauf :
 *  · une quête **« à prendre à l'avance »** (`takeEarly`) : elle se prend tôt et ne sert pas
 *    de référence ;
 *  · une quête **parallèle** (`PARALLEL_NOTE`) : l'ordre interne du groupe est libre ;
 *  · les succès (pas des quêtes).
 *
 * La **branche** est la clé : une quête brâkmarienne n'exige jamais une bontarienne — elle ne
 * serait jamais validée (verrou à vie). La signature reprend `alignReq`, `classReq` et
 * `alignOrderCode`.
 *
 * Le verrou **s'ajoute** aux prérequis réels du jeu, il ne les remplace jamais ; le plafond de
 * 30 tags du schéma d'import reste respecté (une quête pleine n'en reçoit pas).
 */
function applyRouteOrderPrerequisites(blocks: RushImportBlock[]): { added: number; cycles: number } {
  // Index global des noms : les tags se résolvent par nom, comme à l'exécution.
  const byName = new Map<string, RushImportSequence>();
  for (const block of blocks) {
    for (const sequence of block.sequences) {
      const key = normTitle(sequence.subGuideName);
      if (key && !byName.has(key)) byName.set(key, sequence);
    }
  }

  /** `start` dépend-il (directement ou non) de `targetName` ? Sert à refuser un cycle. */
  const dependsOn = (start: RushImportSequence, targetName: string, seen: Set<string>): boolean => {
    const key = normTitle(start.subGuideName);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    if (key === normTitle(targetName)) return true;
    for (const tag of start.activityTags ?? []) {
      if (tag.type !== "prereq_text" || !tag.name) continue;
      const next = byName.get(normTitle(tag.name));
      if (next && dependsOn(next, targetName, seen)) return true;
    }
    return false;
  };

  let added = 0;
  let cycles = 0;
  for (const block of blocks) {
    const lastByBranch = new Map<string, RushImportSequence>();
    for (const sequence of block.sequences) {
      if (sequence.isSuccess || sequence.takeEarly || sequence.note === PARALLEL_NOTE) continue;
      const name = text(sequence.subGuideName, 200);
      if (!name) continue;
      const branch = [
        text(sequence.alignReq, 60),
        text(sequence.classReq, 60),
        text(sequence.alignOrderCode, 60),
      ].join("|");
      const previous = lastByBranch.get(branch);
      const tags = Array.isArray(sequence.activityTags) ? sequence.activityTags : [];
      if (previous && previous !== sequence && tags.length < MAX_ACTIVITY_TAGS) {
        const prevName = text(previous.subGuideName, 200);
        const already = tags.some(
          (tag) =>
            tag.type === "prereq_text" && text(tag.name, 200).toLowerCase() === prevName.toLowerCase()
        );
        // Refus d'un cycle : si la précédente dépend déjà de cette quête (prérequis du jeu),
        // l'arête d'ordre l'enfermerait — on ne la pose pas.
        const wouldCycle = previous === sequence || dependsOn(previous, name, new Set<string>());
        if (wouldCycle) {
          cycles += 1;
        } else if (!already) {
          sequence.activityTags = [...tags, { type: "prereq_text", name: prevName }];
          added += 1;
        }
      }
      lastByBranch.set(branch, sequence);
    }
  }
  return { added, cycles };
}

/**
 * Un bloc Tougli : 36 blocs, conditions, ressources, Ordres à 5 paliers.
 */

function buildTougliBlocks(
  trame: TrameInput,
  meta: Map<number, QuestRouteMeta>,
  options: Required<
    Pick<
      RushTrameSeedOptions,
      "includeSuccesses" | "includeResources" | "maxSequencesPerBlock" | "dofusdex" | "enrichFromYelle"
    >
  >
): { blocks: RushImportBlock[]; report: RushTrameSeedReport } {
  const warnings: string[] = [];
  const tipsToWrite: RushTrameSeedReport["tipsToWrite"] = [];
  const blockTypes: Record<string, number> = {};
  let sequencesCount = 0;
  let questsWithIds = 0;
  let resources = 0;
  let successes = 0;
  let dofusDexTagged = 0;

  const orderCamp = new Map<string, string>();
  for (const order of trame.referentials?.ordres ?? []) {
    if (order.code && order.camp) orderCamp.set(order.code, order.camp);
  }

  const blocks: RushImportBlock[] = [];
  const seenTitles = new Set<string>();
  const sourceBlocks = trame.blocks ?? [];

  sourceBlocks.forEach((source, blockIndex) => {
    const title = text(source.title, 200) || `Bloc ${blockIndex + 1}`;
    const order = Number.isFinite(source.order) ? Number(source.order) : blockIndex + 1;
    // Chapitres de 6 blocs : l'ordre chronologique de la Trame reste lisible dans la
    // timeline. Six chapitres ≈ les grandes phases du rush, pas 36 chapitres d'un bloc.
    const chapter = Math.ceil((blockIndex + 1) / 6);
    const chapterLabel = `Route Sylvestre — partie ${chapter}`;
    const type = typeForTougliBlock(title);
    const sequences: RushImportSequence[] = [];
    const notes: string[] = [];

    const addNode = (node: TrameItemNode | undefined, patch: Partial<RushImportSequence> = {}) => {
      if (!node) return;
      if (node.kind === "quest" && typeof node.questId === "number") {
        if (sequences.length < options.maxSequencesPerBlock) {
          if (pushUnique(sequences, sequenceForQuest(node.questId, trame, meta, options.includeResources, patch))) {
            sequencesCount += 1;
            questsWithIds += 1;
          }
        }
        return;
      }
      if (node.kind === "take_quests") {
        for (const questId of node.questIds ?? []) {
          if (typeof questId !== "number" || sequences.length >= options.maxSequencesPerBlock) continue;
          const sequence = sequenceForQuest(questId, trame, meta, options.includeResources, {
            ...patch,
            note: "À prendre à l'avance.",
            takeEarly: true,
          });
          if (pushUnique(sequences, sequence)) {
            sequencesCount += 1;
            questsWithIds += 1;
          }
        }
        return;
      }
      if (node.kind === "achievement") {
        const name = text(node.name ?? node.names?.[0] ?? node.title, 200);
        if (name && sequences.length < options.maxSequencesPerBlock) {
          if (pushUnique(sequences, { subGuideName: name, questDbIds: [], isSuccess: true, activityTags: [] })) {
            sequencesCount += 1;
            successes += 1;
          }
        }
        return;
      }
      if (node.kind === "choice" && node.branches) {
        for (const branch of node.branches) {
          const condition = branch.condition ?? {};
          const kind = text(condition.kind).toLowerCase();
          const value = text(condition.value);
          const branchPatch: Partial<RushImportSequence> = { ...patch };
          if (kind === "classe") branchPatch.classReq = value || null;
          else if (kind === "camp") branchPatch.alignReq = value || "neutre";
          else if (kind === "ordre") {
            branchPatch.alignOrderCode = value || null;
            branchPatch.alignReq = orderCamp.get(value) ?? null;
          } else if (kind) {
            warnings.push(`Condition inconnue « ${text(condition.raw, 80) || kind} » dans « ${title} » : ignorée.`);
          }
          (branch.items ?? []).forEach((child, index) => {
            const childPatch: Partial<RushImportSequence> = { ...branchPatch };
            if (kind === "ordre") childPatch.alignLevelReq = ORDER_LEVELS[index] ?? null;
            addNode(child, childPatch);
          });
        }
        return;
      }
      if (node.kind === "group") {
        for (const child of node.items ?? []) {
          addNode(child, { ...patch, note: PARALLEL_NOTE });
        }
        return;
      }
      if (node.kind === "note") {
        const line = text(node.text, 200);
        if (line) notes.push(line);
      }
    };

    for (const item of source.items ?? []) addNode(item, {});

    if (sequences.length === 0 && notes.length === 0) {
      warnings.push(`Bloc « ${title} » vide : ignoré.`);
      return;
    }

    let uniqueTitle = title;
    let suffix = 2;
    while (seenTitles.has(uniqueTitle.toLowerCase())) uniqueTitle = `${title} (${suffix++})`;
    seenTitles.add(uniqueTitle.toLowerCase());

    if (notes.length > 0) {
      tipsToWrite.push({ step: null, title: uniqueTitle, category: "Route Sylvestre", lines: notes.length });
    }

    for (const sequence of sequences) {
      resources += (sequence.activityTags ?? []).filter((tag) => tag.type === "item").length;
    }

    const description = `Route Sylvestre — ${title} · ${sequences.length} quête(s)${notes.length ? ` · ${notes.length} note(s) à réécrire` : ""}.`;
    const block: RushImportBlock = {
      title: uniqueTitle,
      type,
      chapter,
      chapterLabel,
      order,
      description,
      accentColor: null,
      imageUrl: null,
      tips: null,
      links: [],
      dofusId: null,
      isOptional: false,
      sequences,
    };
    if (enrichWithDofusDex(block, options.dofusdex)) dofusDexTagged += 1;
    blocks.push(block);
    blockTypes[type] = (blockTypes[type] ?? 0) + 1;
  });

  const report: RushTrameSeedReport = {
    spine: "tougli",
    blocks: blocks.length,
    sequences: sequencesCount,
    questsWithIds,
    resources,
    successes,
    yelleSuccesses: 0,
    yelleTipsMerged: 0,
    yelleDofusDexMerged: 0,
    yelleDungeonBlocks: 0,
    dofusDexTagged,
    prereqTags: 0,
    prereqSkipped: 0,
    routePrereqs: 0,
    successAchievements: 0,
    successTags: 0,
    successQuests: 0,
    unmatched: [],
    tipsToWrite,
    blockTypes,
    warnings,
  };

  if (options.enrichFromYelle) {
    enrichTougliWithYelle(blocks, trame, options, report);
  }

  return { blocks, report };
}

/**
 * **Touglie enrichi** — la trame Touglie reste la seule charpente ; on y fusionne les
 * données Dofusyelle déjà corrélées : succès, conseils rédigés, DofusDex et donjons.
 *
 * Règles :
 *  · une étape Yelle est rattachée au bloc Touglie de la **première quête corrélée** ;
 *  · un succès n'est ajouté qu'une fois par bloc (nom normalisé) ;
 *  · un conseil rédigé se pose sur la **quête** corrélée (jamais sur le bloc) ;
 *  · les autres conseils restent dans `tipsToWrite` (aucun texte tiers recopié) ;
 *  · un DofusDex d'étape est appliqué au bloc Touglie même si son titre diffère
 *    (Domakuro, Dorigami, Tacheté…), sans doublon ;
 *  · une étape qui porte des quêtes/succès/donjons sans quête Touglie corrélée est
 *    signalée dans `unmatched` — elle n'est jamais perdue silencieusement.
 *
 * Les **ressources** et **conditions** restent celles de la Trame Touglie (par quête) :
 * la liste globale Yelle n'est pas recopiée sur un bloc, elle n'a pas de quête cible.
 */
function enrichTougliWithYelle(
  blocks: RushImportBlock[],
  trame: TrameInput,
  options: Required<Pick<RushTrameSeedOptions, "includeSuccesses" | "maxSequencesPerBlock" | "dofusdex">>,
  report: RushTrameSeedReport
): void {
  const steps = trame.dofusyelle?.steps ?? [];
  const byStep = new Map<number, TrameCorrelation[]>();
  for (const entry of trame.dofusyelle?.correlation ?? []) {
    const step = Number(entry.step);
    if (!Number.isFinite(step)) continue;
    const list = byStep.get(step) ?? [];
    list.push(entry);
    byStep.set(step, list);
  }

  const questIndex = new Map<number, { block: RushImportBlock; sequence: RushImportSequence }>();
  for (const block of blocks) {
    for (const sequence of block.sequences) {
      for (const questId of sequence.questDbIds ?? []) {
        if (!questIndex.has(questId)) questIndex.set(questId, { block, sequence });
      }
    }
  }

  const findNamed = (block: RushImportBlock, name: string) => {
    const key = normTitle(name);
    return block.sequences.find((sequence) => normTitle(sequence.subGuideName) === key) ?? null;
  };

  const allByName = new Map<string, RushImportSequence>();
  for (const block of blocks) {
    for (const sequence of block.sequences) {
      const key = normTitle(sequence.subGuideName);
      if (key && !allByName.has(key)) allByName.set(key, sequence);
    }
  }
  const fallbackSuccesses = new Map<string, string>();
  const fallbackDex: Array<{ entry: RushDofusDexEntry; title: string }> = [];
  const fallbackDungeons: Array<{ step: number; names: string[] }> = [];

  for (const step of steps) {
    const n = Number.isFinite(step.n) ? Number(step.n) : 0;
    const title = text(step.title, 200) || `Étape ${n}`;
    const category = text(step.category, 120) || "Route";
    const entries = byStep.get(n) ?? [];
    const questIds = [...new Set(entries.flatMap((entry) => entry.questIds ?? []))];

    let target: { block: RushImportBlock; sequence: RushImportSequence } | null = null;
    for (const questId of questIds) {
      const hit = questIndex.get(questId);
      if (hit) {
        target = hit;
        break;
      }
    }

    if (!target) {
      const successNames = (step.succes ?? [])
        .map((success) => text(typeof success === "string" ? success : success?.t ?? success?.title, 200))
        .filter(Boolean);
      const hasContent =
        (step.quetes ?? []).length > 0 ||
        successNames.length > 0 ||
        (step.donjons ?? []).length > 0;
      if (hasContent) {
        report.unmatched.push({ step: n, title, reason: "Aucune quête Touglie corrélée" });
      }
      // Succès sans bloc cible : marqués sur une quête existante, sinon gardés pour le
      // bloc « Compléments » — rien ne se perd.
      for (const name of successNames) {
        const key = normTitle(name);
        if (!key) continue;
        const existing = allByName.get(key);
        if (existing) {
          if (!existing.isSuccess) {
            existing.isSuccess = true;
            report.successes += 1;
            report.yelleSuccesses += 1;
          }
        } else if (!fallbackSuccesses.has(key)) {
          fallbackSuccesses.set(key, name);
        }
      }
      // Conseil non rattaché : il reste listé, jamais recopié.
      const tip = YELLE_DEMO_TIPS[n];
      const bodyLines = Array.isArray(step.body) ? step.body.length : 0;
      if (tip || bodyLines > 0) {
        report.tipsToWrite.push({ step: n, title, category, lines: tip ? 1 : bodyLines });
      }
      const dexEntry = findDofusDexEntry(title, options.dofusdex);
      if (dexEntry) fallbackDex.push({ entry: dexEntry, title });
      const dungeonNames = dungeonNamesOf(step);
      if (dungeonNames.length > 0) fallbackDungeons.push({ step: n, names: dungeonNames });
      continue;
    }

    // 1. Succès Yelle → séquences `isSuccess` dans le bloc Touglie de la quête corrélée.
    if (options.includeSuccesses) {
      const successNames = (step.succes ?? [])
        .map((success) => text(typeof success === "string" ? success : success?.t ?? success?.title, 200))
        .filter(Boolean);
      for (const name of successNames) {
        const existing = findNamed(target.block, name);
        if (existing) {
          // Le succès porte le nom d'une quête déjà dans le bloc : on MARQUE la quête,
          // on ne crée pas un doublon de libellé.
          if (!existing.isSuccess) {
            existing.isSuccess = true;
            report.successes += 1;
            report.yelleSuccesses += 1;
          }
          continue;
        }
        if (target.block.sequences.length >= options.maxSequencesPerBlock) {
          const key = normTitle(name);
          const anywhere = allByName.get(key);
          if (anywhere) {
            if (!anywhere.isSuccess) {
              anywhere.isSuccess = true;
              report.successes += 1;
              report.yelleSuccesses += 1;
            }
          } else if (!fallbackSuccesses.has(key)) {
            fallbackSuccesses.set(key, name);
          }
          report.warnings.push(
            `Succès « ${name} » (étape ${n}) : bloc « ${target.block.title} » plein → « Compléments — succès hors trame ».`
          );
          continue;
        }
        target.block.sequences.push({
          subGuideName: name,
          questDbIds: [],
          isSuccess: true,
          activityTags: [],
        });
        report.sequences += 1;
        report.successes += 1;
        report.yelleSuccesses += 1;
      }
    }

    // 2. Conseil Yelle : seulement s'il a été rédigé pour SigilOS ; sinon il reste à écrire.
    const tip = YELLE_DEMO_TIPS[n];
    if (tip) {
      if (!target.sequence.tips) {
        target.sequence.tips = tip;
        report.yelleTipsMerged += 1;
      } else if (target.sequence.tips !== tip) {
        report.tipsToWrite.push({ step: n, title, category, lines: 1 });
      }
    } else {
      const bodyLines = Array.isArray(step.body) ? step.body.length : 0;
      if (bodyLines > 0) report.tipsToWrite.push({ step: n, title, category, lines: bodyLines });
    }

    // 3. DofusDex d'étape → bloc Touglie, même si le titre du bloc ne le reconnaît pas.
    const dexEntry = findDofusDexEntry(title, options.dofusdex);
    if (dexEntry && applyDofusDexEntry(target.block, dexEntry, title)) {
      report.dofusDexTagged += 1;
      report.yelleDofusDexMerged += 1;
    }

    // 4. Donjons Yelle → une ligne de conseil datée de l'étape, sans doublon.
    const dungeonNames = dungeonNamesOf(step);
    if (dungeonNames.length > 0) {
      const header = `**Donjons (étape ${n} de la trame)**`;
      if (!(target.block.tips ?? "").includes(header)) {
        const combined = [target.block.tips, `${header} — ${dungeonNames.join(", ")}`]
          .filter(Boolean)
          .join("\n\n");
        target.block.tips =
          combined.length <= MAX_TIPS ? combined : `${combined.slice(0, MAX_TIPS).trimEnd()}\n…`;
        report.yelleDungeonBlocks += 1;
      }
    }
  }

  // 5. Les succès/repères des étapes sans quête Touglie : un bloc dédié, jamais perdus.
  if (fallbackSuccesses.size > 0 || fallbackDex.length > 0 || fallbackDungeons.length > 0) {
    const chapter = Math.max(0, ...blocks.map((block) => block.chapter ?? 0)) + 1;
    const order = Math.max(0, ...blocks.map((block) => block.order ?? 0)) + 1;
    const fallback: RushImportBlock = {
      title: "Compléments — succès hors trame",
      type: "SUCCES",
      chapter,
      chapterLabel: "Compléments",
      order,
      description: `Route Sylvestre — succès et repères non rattachés à un bloc de la trame · ${fallbackSuccesses.size} succès.`,
      accentColor: null,
      imageUrl: null,
      tips: null,
      links: [],
      dofusId: null,
      isOptional: false,
      sequences: [...fallbackSuccesses.values()].map((name) => ({
        subGuideName: name,
        questDbIds: [],
        isSuccess: true,
        activityTags: [],
      })),
    };
    for (const { entry, title } of fallbackDex) {
      if (applyDofusDexEntry(fallback, entry, title)) {
        report.dofusDexTagged += 1;
        report.yelleDofusDexMerged += 1;
      }
    }
    for (const { step, names } of fallbackDungeons) {
      const header = `**Donjons (étape ${step} de la trame)**`;
      if (!(fallback.tips ?? "").includes(header)) {
        const combined = [fallback.tips, `${header} — ${names.join(", ")}`]
          .filter(Boolean)
          .join("\n\n");
        fallback.tips =
          combined.length <= MAX_TIPS ? combined : `${combined.slice(0, MAX_TIPS).trimEnd()}\n…`;
      }
    }
    if (fallbackDungeons.length > 0) report.yelleDungeonBlocks += 1;
    blocks.push(fallback);
    report.blocks = blocks.length;
    report.sequences += fallbackSuccesses.size;
    report.successes += fallbackSuccesses.size;
    report.yelleSuccesses += fallbackSuccesses.size;
    report.blockTypes.SUCCES = (report.blockTypes.SUCCES ?? 0) + 1;
    report.warnings.push(
      `Succès hors trame : ${fallbackSuccesses.size} succès placé(s) dans « ${fallback.title} ».`
    );
  }

  const successOccurrences = steps.reduce(
    (count, step) => count + (Array.isArray(step.succes) ? step.succes.length : 0),
    0
  );
  if (successOccurrences > report.yelleSuccesses) {
    report.warnings.push(
      `Succès Yelle : ${successOccurrences} occurrences → ${report.yelleSuccesses} succès distincts (doublons fusionnés).`
    );
  }
}

/** Le spine Yelle : 57 étapes chronologiques, 361/384 quêtes appariées. */
function buildYelleBlocks(
  trame: TrameInput,
  meta: Map<number, QuestRouteMeta>,
  options: Required<
    Pick<
      RushTrameSeedOptions,
      "includeClasses" | "includeSuccesses" | "includeResources" | "maxSequencesPerBlock" | "dofusdex"
    >
  >
): { blocks: RushImportBlock[]; report: RushTrameSeedReport } {
  const warnings: string[] = [];
  const tipsToWrite: RushTrameSeedReport["tipsToWrite"] = [];
  const unmatched: RushTrameSeedReport["unmatched"] = [];
  const blockTypes: Record<string, number> = {};
  let sequencesCount = 0;
  let questsWithIds = 0;
  let resources = 0;
  let successes = 0;
  let dofusDexTagged = 0;

  const steps = trame.dofusyelle?.steps ?? [];
  const correlations = trame.dofusyelle?.correlation ?? [];
  const byStep = new Map<number, TrameCorrelation[]>();
  for (const entry of correlations) {
    const step = Number(entry.step);
    if (!Number.isFinite(step)) continue;
    const list = byStep.get(step) ?? [];
    list.push(entry);
    byStep.set(step, list);
  }

  // Enrichissements croisés : les 19 classes viennent du bloc « Astrub » de Tougli,
  // la quête neutre du bloc « Dofus des Veilleurs » — via l'index `meta`, pas d'une table
  // parallèle. On les ajoute une seule fois au bon endroit de la trame Yelle.
  const classQuestIds = [...meta.entries()].filter(([, route]) => route.classReq).map(([id]) => id);
  const neutralQuestId =
    [...meta.entries()].find(([, route]) => text(route.alignReq).toLowerCase() === "neutre")?.[0] ?? null;
  if (options.includeClasses && classQuestIds.length === 0) {
    warnings.push("Aucune quête de classe dans la Trame : l'enrichissement est vide.");
  }
  if (neutralQuestId == null) {
    warnings.push("Aucune quête neutre (« La rivalité ») dans la Trame : le scénario sans cité sera vide.");
  }

  let classesAdded = false;
  let neutralAdded = false;
  const blocks: RushImportBlock[] = [];
  const seenTitles = new Set<string>();

  steps.forEach((step, index) => {
    const n = Number.isFinite(step.n) ? Number(step.n) : index + 1;
    const category = text(step.category, 120) || "Route";
    const title = text(step.title, 200) || `Étape ${n}`;
    const type = typeForYelleStep(step);
    const chapter = Math.ceil(n / 8);
    const chapterLabel = `Étapes ${(chapter - 1) * 8 + 1}–${chapter * 8}`;
    const sequences: RushImportSequence[] = [];
    const isAlignment = category.toLowerCase().includes("alignement");
    const dungeonNames = dungeonNamesOf(step);

    const push = (sequence: RushImportSequence) => {
      if (sequences.length >= options.maxSequencesPerBlock) return false;
      if (!pushUnique(sequences, sequence)) return false;
      sequencesCount += 1;
      if ((sequence.questDbIds ?? []).length > 0) questsWithIds += 1;
      if (sequence.isSuccess) successes += 1;
      resources += (sequence.activityTags ?? []).filter((tag) => tag.type === "item").length;
      return true;
    };

    // 1. Les quêtes de l'étape : la liste Yelle (`step.quetes`) est la **référence** ;
    //    la corrélation fournit les ids. Une ligne de corps (« Bloqué par un horaire… »)
    //    n'est pas une quête : elle n'entre jamais dans le guide.
    const entries = byStep.get(n) ?? [];
    const byTitle = new Map<string, TrameCorrelation[]>();
    for (const entry of entries) {
      const key = normTitle(text(entry.title));
      if (!key) continue;
      const list = byTitle.get(key) ?? [];
      list.push(entry);
      byTitle.set(key, list);
    }
    const yelleQuests = (step.quetes ?? []).map((quest) => text(quest.t, 200)).filter(Boolean);

    const pushQuest = (questTitle: string, ids: number[]) => {
      if (ids.length === 0) {
        if (
          push({
            subGuideName: questTitle || "Quête sans id",
            questDbIds: [],
            note: "Quête non appariée — à relier dans le studio.",
            isSuccess: false,
            activityTags: [],
          })
        ) {
          unmatched.push({ step: n, title: questTitle || "Quête sans id", reason: "Aucun id DofusDB" });
        }
        return;
      }
      for (const id of ids) {
        const route = meta.get(id) ?? {};
        // La catégorie « Alignement Bonta » est une source de repli : si la Trame ne
        // connaît pas la cité de cette quête, elle reste dans la branche bontarienne.
        const patch: Partial<RushImportSequence> =
          isAlignment && !route.alignReq ? { alignReq: "bontarien" } : {};
        push(sequenceForQuest(id, trame, meta, options.includeResources, patch));
      }
    };

    if (yelleQuests.length > 0) {
      for (const questTitle of yelleQuests) {
        const matches = byTitle.get(normTitle(questTitle)) ?? [];
        const ids = matches
          .flatMap((entry) => entry.questIds ?? [])
          .filter((id) => typeof id === "number");
        pushQuest(questTitle, ids);
      }
    } else {
      // Liste Yelle absente : on ne prend que les entrées **appariées** — une entrée
      // sans id est une ligne de corps, pas une quête.
      for (const entry of entries) {
        const ids = (entry.questIds ?? []).filter((id) => typeof id === "number");
        if (ids.length === 0) continue;
        pushQuest(text(entry.title, 200) || "Quête sans id", ids);
      }
      warnings.push(`Étape ${n} « ${title} » : liste Yelle absente, corrélation appariée utilisée.`);
    }

    // 2. Les 19 classes, ajoutées à la première étape « Incarnam / Astrub ».
    if (options.includeClasses && !classesAdded && /incarnam|astrub/i.test(title)) {
      for (const id of classQuestIds) push(sequenceForQuest(id, trame, meta, options.includeResources));
      classesAdded = true;
    }

    // 3. « La rivalité » (choix neutre) à la première étape d'alignement.
    if (neutralQuestId != null && !neutralAdded && isAlignment) {
      push(sequenceForQuest(neutralQuestId, trame, meta, options.includeResources));
      neutralAdded = true;
    }

    // 4. Les succès Yelle (faits) comme étapes cochables `isSuccess`.
    if (options.includeSuccesses) {
      for (const success of step.succes ?? []) {
        const name = text(
          typeof success === "string" ? success : (success?.t ?? success?.title),
          200
        );
        if (!name) continue;
        push({ subGuideName: name, questDbIds: [], isSuccess: true, activityTags: [] });
      }
    }

    const isInformationBlock =
      type === "INFO" ||
      type === "SEPARATEUR" ||
      type === "DOFUS_OBTAINED" ||
      type === "COMBAT_TACTIQUE" ||
      type === "COMBAT_SEMI_TACTIQUE";
    if (sequences.length === 0 && !isInformationBlock) {
      warnings.push(`Étape ${n} « ${title} » vide : aucun contenu à importer.`);
      return;
    }

    let uniqueTitle = `Étape ${n} · ${title}`;
    let suffix = 2;
    while (seenTitles.has(uniqueTitle.toLowerCase())) uniqueTitle = `Étape ${n} · ${title} (${suffix++})`;
    seenTitles.add(uniqueTitle.toLowerCase());

    const bodyLines = Array.isArray(step.body) ? step.body.length : 0;
    if (bodyLines > 0 && !YELLE_DEMO_TIPS[n]) {
      tipsToWrite.push({ step: n, title: uniqueTitle, category, lines: bodyLines });
    }

    const pushedSuccesses = sequences.filter((sequence) => sequence.isSuccess).length;
    const description =
      `Route Sylvestre — ${category} · ${(step.quetes ?? []).length} quête(s), ` +
      `${pushedSuccesses} succès, ${dungeonNames.length} donjon(s).` +
      (dungeonNames.length ? ` Donjons : ${dungeonNames.join(", ")}.` : "");

    const block: RushImportBlock = {
      title: uniqueTitle,
      type,
      chapter,
      chapterLabel,
      order: n,
      description,
      accentColor: null,
      imageUrl: null,
      tips: YELLE_DEMO_TIPS[n] ?? null,
      links: [],
      dofusId: null,
      isOptional: false,
      sequences,
    };
    if (enrichWithDofusDex(block, options.dofusdex)) dofusDexTagged += 1;
    blocks.push(block);
    blockTypes[type] = (blockTypes[type] ?? 0) + 1;
  });

  return {
    blocks,
    report: {
      spine: "yelle",
      blocks: blocks.length,
      sequences: sequencesCount,
      questsWithIds,
      resources,
      successes,
      yelleSuccesses: 0,
      yelleTipsMerged: 0,
      yelleDofusDexMerged: 0,
      yelleDungeonBlocks: 0,
      dofusDexTagged,
      prereqTags: 0,
      prereqSkipped: 0,
      routePrereqs: 0,
      successAchievements: 0,
      successTags: 0,
      successQuests: 0,
      unmatched,
      tipsToWrite,
      blockTypes,
      warnings,
    },
  };
}

/**
 * Point d'entrée pur : Trame → payload d'import God + rapport.
 *
 * Aucune lecture de fichier, aucune écriture : le CLI (`scripts/build-rush-trame-seed.ts`)
 * fournit la Trame et écrit les deux sorties dans `src/temp/` (zone volatile).
 */
export function buildRushSeedFromTrame(
  trame: TrameInput,
  options: RushTrameSeedOptions = {}
): RushTrameSeedResult {
  const spine: RushTrameSpine = options.spine ?? "tougli";
  const resolved = {
    includeClasses: options.includeClasses ?? true,
    includeSuccesses: options.includeSuccesses ?? false,
    includeResources: options.includeResources ?? true,
    maxSequencesPerBlock: Math.max(1, Math.min(120, options.maxSequencesPerBlock ?? 120)),
    dofusdex: options.dofusdex ?? null,
    enrichFromYelle: options.enrichFromYelle ?? false,
    routeOrderLock: options.routeOrderLock ?? true,
    achievements: options.achievements ?? [],
  };

  if (!trame || typeof trame !== "object") {
    return {
      payload: { blocks: [] },
      report: {
        spine,
        blocks: 0,
        sequences: 0,
        questsWithIds: 0,
        resources: 0,
        successes: 0,
        yelleSuccesses: 0,
        yelleTipsMerged: 0,
        yelleDofusDexMerged: 0,
        yelleDungeonBlocks: 0,
        dofusDexTagged: 0,
        prereqTags: 0,
        prereqSkipped: 0,
        routePrereqs: 0,
        successAchievements: 0,
        successTags: 0,
        successQuests: 0,
        unmatched: [],
        tipsToWrite: [],
        blockTypes: {},
        warnings: ["Trame absente ou illisible : aucun bloc généré."],
      },
    };
  }

  const meta = buildQuestMeta(trame);
  const built =
    spine === "yelle" ? buildYelleBlocks(trame, meta, resolved) : buildTougliBlocks(trame, meta, resolved);

  if (spine === "yelle" && resolved.enrichFromYelle) {
    built.report.warnings.push(
      "enrichFromYelle est ignoré pour le spine yelle : ce spine est déjà la source Yelle."
    );
  }

  // Prérequis entre quêtes : après l'enrichissement (toutes les séquences sont là),
  // avant le filet de titres — les noms posés sont ceux du payload final.
  const prereq = attachQuestPrerequisites(trame, built.blocks);
  built.report.prereqTags = prereq.tags;
  built.report.prereqSkipped = prereq.skipped;

  // Verrou d'ORDRE (option C) : après les prérequis réels (on ne les remplace pas).
  if (resolved.routeOrderLock) {
    const route = applyRouteOrderPrerequisites(built.blocks);
    built.report.routePrereqs = route.added;
    if (route.cycles > 0) {
      built.report.warnings.push(
        `${route.cycles} verrou(s) d'ordre écarté(s) : ils auraient formé un cycle avec un prérequis du jeu.`
      );
    }
  }

  // Succès officiels : tags sur les quêtes qu'ils couvrent (jamais une ligne cochable).
  const success = attachSuccessTags(built.blocks, resolved.achievements);
  built.report.successAchievements = success.achievements;
  built.report.successTags = success.tags;
  built.report.successQuests = success.quests;

  // Filet de sécurité inter-blocs : l'import apparie les blocs par titre normalisé.
  const seen = new Set<string>();
  let duplicate = 0;
  for (const block of built.blocks) {
    let key = block.title.trim().toLowerCase();
    while (seen.has(key)) {
      duplicate += 1;
      block.title = `${block.title} (${duplicate})`;
      key = block.title.trim().toLowerCase();
    }
    seen.add(key);
  }
  if (duplicate > 0) {
    built.report.warnings.push(`${duplicate} titre(s) de bloc dupliqué(s) ont été suffixés.`);
  }

  return { payload: { blocks: built.blocks }, report: built.report };
}
