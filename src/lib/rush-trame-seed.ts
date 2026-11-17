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

type TrameStep = {
  n?: number;
  category?: string;
  title?: string;
  body?: unknown[];
  donjons?: Array<{ name?: string } | string>;
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
  /** Plafond de sécurité par bloc (le schéma Zod accepte 80). */
  maxSequencesPerBlock?: number;
  /** DofusDex officiel (`public/game-data/dofusdex.json`) : enrichit les blocs DOFUS. */
  dofusdex?: RushDofusDex | null;
};

export type RushTrameSeedReport = {
  spine: RushTrameSpine;
  blocks: number;
  sequences: number;
  questsWithIds: number;
  resources: number;
  successes: number;
  /** Blocs `DOFUS` enrichis avec la checklist officielle + le `dofusId`. */
  dofusDexTagged: number;
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

/**
 * Enrichit un bloc avec la **checklist officielle** du DofusDex : objectifs (noms +
 * niveaux), prérequis et `dofusId`. Aucune description Ankama n'est recopiée — ce sont
 * des faits de progression, affichés en markdown dans les conseils du bloc.
 */
function enrichWithDofusDex(block: RushImportBlock, dofusdex?: RushDofusDex | null): boolean {
  const entry = findDofusDexEntry(block.title, dofusdex);
  if (!entry) return false;

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
  if (lines.length === 0) return false;

  const prerequisites = (entry.prerequisites ?? [])
    .map((step) => text(step.name, 200))
    .filter(Boolean);
  const range =
    entry.minLevel != null && entry.maxLevel != null ? ` (${entry.minLevel}–${entry.maxLevel})` : "";
  const checklist = [
    `**DofusDex officiel** — ${text(entry.name)}${range}`,
    ...lines,
    ...(prerequisites.length ? [`**Prérequis** : ${prerequisites.join(", ")}`] : []),
  ].join("\n");

  // Le schéma d'import borne `tips` à 4 000 caractères : un Dofus à 20 objectifs +
  // 18 prérequis dépasserait et ferait refuser TOUT le payload. On tronque proprement.
  const MAX_TIPS = 3950;
  const combined = [block.tips, checklist].filter(Boolean).join("\n\n");
  block.tips =
    combined.length <= MAX_TIPS ? combined : `${combined.slice(0, MAX_TIPS).trimEnd()}\n…`;
  block.description = [block.description, `DofusDex : ${lines.length} objectif(s) officiel(s).`]
    .filter(Boolean)
    .join(" ");
  block.dofusId = block.dofusId ?? dofusIdForTitle(block.title);
  return true;
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

/** Un bloc Tougli : 36 blocs, conditions, ressources, Ordres à 5 paliers. */
function buildTougliBlocks(
  trame: TrameInput,
  meta: Map<number, QuestRouteMeta>,
  options: Required<Pick<RushTrameSeedOptions, "includeResources" | "maxSequencesPerBlock" | "dofusdex">>
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
    const chapterLabel = `Tougli — partie ${chapter}`;
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
          addNode(child, { ...patch, note: "Quête parallèle — l'ordre interne n'a pas d'importance." });
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
      tipsToWrite.push({ step: null, title: uniqueTitle, category: "Touglie", lines: notes.length });
    }

    for (const sequence of sequences) {
      resources += (sequence.activityTags ?? []).filter((tag) => tag.type === "item").length;
    }

    const description = `Route Tougli — ${title} · ${sequences.length} quête(s)${notes.length ? ` · ${notes.length} note(s) à réécrire` : ""}.`;
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

  return {
    blocks,
    report: {
      spine: "tougli",
      blocks: blocks.length,
      sequences: sequencesCount,
      questsWithIds,
      resources,
      successes,
      dofusDexTagged,
      unmatched: [],
      tipsToWrite,
      blockTypes,
      warnings,
    },
  };
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
    const dungeonNames = (step.donjons ?? [])
      .map((dungeon) => text(typeof dungeon === "string" ? dungeon : dungeon?.name, 200))
      .filter(Boolean);

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
            note: "Quête Dofusyelle non appariée — à relier dans le studio.",
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
      `Route Dofusyelle — ${category} · ${(step.quetes ?? []).length} quête(s), ` +
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
      dofusDexTagged,
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
    includeSuccesses: options.includeSuccesses ?? true,
    includeResources: options.includeResources ?? true,
    maxSequencesPerBlock: Math.max(1, Math.min(80, options.maxSequencesPerBlock ?? 80)),
    dofusdex: options.dofusdex ?? null,
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
        dofusDexTagged: 0,
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
