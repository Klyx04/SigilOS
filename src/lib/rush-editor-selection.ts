/**
 * Règles pures du studio God « Rush Sylvestre » (E1, 05/11/2026).
 *
 * 🎯 Ce que ce module remplace : il n'existait **aucun** accès rapide — 492 quêtes se
 * déroulaient dans une seule liste, sans recherche, sans filtre, sans repère de position.
 * Ici vivent les règles, **sans React** : l'arbre (chapitres → blocs → quêtes), la
 * recherche (nom, qid, bloc, cité, Ordre, classe, tags), les filtres, la sélection
 * suivante après une suppression et l'index de la palette `Ctrl+K`.
 *
 * ⚠️ Aucun import de composant (le module est consommé par le studio **et** par les
 * tests) : les composants ne font que rendre ce que ces fonctions calculent.
 */

/** Séquence telle que le studio la reçoit (sous-ensemble structurel de `RushSequence`). */
export type RushEditorSequenceInput = {
  id: string;
  subGuideRef?: string | null;
  subGuideName?: string | null;
  order?: number | null;
  tips?: string | null;
  note?: string | null;
  alignReq?: string | null;
  alignOrderCode?: string | null;
  alignLevelReq?: number | null;
  classReq?: string | null;
  questDbIds?: number[] | null;
  activityTags?: Array<{ type?: string | null; name?: string | null; camp?: string | null }> | null;
};

/** Bloc tel que le studio le reçoit (sous-ensemble structurel de `Milestone`). */
export type RushEditorMilestoneInput = {
  id: string;
  title: string;
  chapter?: number | null;
  chapterLabel?: string | null;
  type?: string | null;
  order?: number | null;
  sequences?: RushEditorSequenceInput[] | null;
};

/** Un bloc SEPARATEUR ne porte ni quête ni option (règle du module). */
export function isRushSeparator(m: { type?: string | null }): boolean {
  return m.type === "SEPARATEUR";
}

/**
 * Un bloc hors chapitre n'appartient à **aucun** regroupement : séparateur, bannière
 * d'obtention de Dofus et bloc Conseil / Tips. Même règle que `isOutsideChapterMilestone`
 * du studio, exportée ici pour qu'il n'y en ait qu'une.
 */
export function isRushOutsideChapter(m: { type?: string | null }): boolean {
  return m.type === "SEPARATEUR" || m.type === "DOFUS_OBTAINED" || m.type === "INFO";
}

/** Ordre stable des blocs (`order` serveur, 0 par défaut). */
export function sortRushEditorMilestones<T extends { order?: number | null }>(milestones: T[]): T[] {
  return [...milestones].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

/**
 * Clé de recherche tolérante : minuscule, sans accents, ligatures dépliées.
 * `Cœur Vaillant`, `coeur vaillant` et `COEUR VAILLANT` donnent la même clé.
 */
export function normalizeRushEditorQuery(value: string): string {
  return (value ?? "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Découpe une requête en mots : chaque mot doit matcher (ET, jamais OU). */
export function rushEditorTokens(query: string): string[] {
  return normalizeRushEditorQuery(query).split(/\s+/).filter(Boolean);
}

function matchesEveryToken(haystack: string, tokens: string[]): boolean {
  if (tokens.length === 0) return true;
  return tokens.every((token) => haystack.includes(token));
}

// ─── Arbre chapitres → blocs → quêtes ────────────────────────────────────────

export type RushEditorQuestNode = {
  id: string;
  blockId: string;
  blockTitle: string;
  chapter: number;
  chapterLabel: string;
  /** Nom affiché (nom de quête, repli sur la référence du guide). */
  name: string;
  /** Cité de la route (`alignReq`), `null` si la quête n'en porte pas. */
  camp: string | null;
  /** Code d'Ordre (`alignOrderCode`), `null` sinon. */
  orderCode: string | null;
  /** Palier d'alignement requis (`alignLevelReq`). */
  level: number | null;
  /** Classe requise (`classReq`). */
  classReq: string | null;
  /** Ids DofusDB des quêtes incarnées — cherchables tels quels. */
  qids: number[];
  /** Un conseil est écrit (une ligne = une puce). */
  hasTips: boolean;
  /** Texte de recherche pré-calculé (tags, note, libellés). */
  keywords: string;
};

export type RushEditorBlockNode = {
  id: string;
  title: string;
  type: string;
  chapter: number;
  chapterLabel: string;
  isSeparator: boolean;
  isTips: boolean;
  /** Bloc d'information Combat tactique / semi-tactique (non cochable). */
  isCombat: boolean;
  quests: RushEditorQuestNode[];
};

export type RushEditorChapterNode = {
  chapter: number;
  label: string;
  blocks: RushEditorBlockNode[];
  questCount: number;
};

export type RushEditorTree = RushEditorChapterNode[];

/** Libellé du regroupement hors chapitre (chapitre 0 côté base). */
export const RUSH_EDITOR_CHAPTER_ZERO_LABEL = "Hors chapitre";

function questNodeOf(
  seq: RushEditorSequenceInput,
  block: { id: string; title: string },
  chapter: number,
  chapterLabel: string,
): RushEditorQuestNode {
  const name = (seq.subGuideName ?? "").trim() || (seq.subGuideRef ?? "").trim();
  const tags = Array.isArray(seq.activityTags) ? seq.activityTags : [];
  const keywords = [
    ...tags.map((tag) => [tag.name, tag.camp, tag.type].filter(Boolean).join(" ")),
    seq.note ?? "",
  ]
    .filter(Boolean)
    .join(" · ");
  return {
    id: seq.id,
    blockId: block.id,
    blockTitle: block.title,
    chapter,
    chapterLabel,
    name,
    camp: seq.alignReq ?? null,
    orderCode: seq.alignOrderCode ?? null,
    level: typeof seq.alignLevelReq === "number" ? seq.alignLevelReq : null,
    classReq: seq.classReq ?? null,
    qids: Array.isArray(seq.questDbIds) ? seq.questDbIds : [],
    hasTips: !!(seq.tips && seq.tips.trim()),
    keywords,
  };
}

/**
 * Construit l'arbre du studio. Les blocs hors chapitre (séparateur, bannière Dofus,
 * Conseil / Tips) sont regroupés sous **« Hors chapitre »** (chapitre 0) : ils ne
 * portent aucune quête, et les mêler aux chapitres donnerait une fausse hiérarchie.
 */
export function buildRushEditorTree(milestones: RushEditorMilestoneInput[]): RushEditorTree {
  const chapters = new Map<number, RushEditorChapterNode>();

  for (const milestone of sortRushEditorMilestones(milestones)) {
    const outside = isRushOutsideChapter(milestone);
    const chapter = outside ? 0 : Math.max(0, milestone.chapter ?? 0);
    const label = outside
      ? RUSH_EDITOR_CHAPTER_ZERO_LABEL
      : (milestone.chapterLabel ?? "").trim() || `Chapitre ${chapter}`;

    let node = chapters.get(chapter);
    if (!node) {
      node = { chapter, label, blocks: [], questCount: 0 };
      chapters.set(chapter, node);
    }

    const sequences = (milestone.sequences ?? []).slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const block: RushEditorBlockNode = {
      id: milestone.id,
      title: milestone.title,
      type: String(milestone.type ?? "QUETE_SERIE"),
      chapter,
      chapterLabel: label,
      isSeparator: isRushSeparator(milestone),
      isTips: milestone.type === "INFO",
      isCombat: milestone.type === "COMBAT_TACTIQUE" || milestone.type === "COMBAT_SEMI_TACTIQUE",
      quests: sequences.map((seq) => questNodeOf(seq, milestone, chapter, label)),
    };
    node.blocks.push(block);
    node.questCount += block.quests.length;
  }

  return [...chapters.values()].sort((a, b) => a.chapter - b.chapter);
}

// ─── Recherche et filtres ────────────────────────────────────────────────────

export type RushEditorFilters = {
  /** Recherche libre (nom, qid, bloc, cité, Ordre, classe, tags). */
  query: string;
  /** Cité de la route : `bontarien` | `brakmarien` | `null` (toutes). */
  camp: string | null;
  /** Code canonique d'Ordre, `null` = tous. */
  orderCode: string | null;
  /** Id de classe, `null` = toutes. */
  classReq: string | null;
  /** Ne garder que les quêtes **sans** conseil (panneau « à compléter »). */
  withoutTips: boolean;
};

export const EMPTY_RUSH_EDITOR_FILTERS: RushEditorFilters = {
  query: "",
  camp: null,
  orderCode: null,
  classReq: null,
  withoutTips: false,
};

/** Vrai dès qu'un filtre autre que la recherche est posé (badge « filtres actifs »). */
export function hasActiveRushEditorFilters(filters: RushEditorFilters): boolean {
  return !!(filters.camp || filters.orderCode || filters.classReq || filters.withoutTips);
}

/** Une quête répond-elle à la recherche libre ? (nom, bloc, cité, Ordre, classe, qid, tags) */
export function matchRushEditorQuest(quest: RushEditorQuestNode, query: string): boolean {
  const tokens = rushEditorTokens(query);
  if (tokens.length === 0) return true;
  const haystack = normalizeRushEditorQuery(
    [
      quest.name,
      quest.blockTitle,
      quest.chapterLabel,
      quest.camp ?? "",
      quest.orderCode ?? "",
      quest.classReq ?? "",
      quest.qids.join(" "),
      quest.keywords,
    ].join(" "),
  );
  return matchesEveryToken(haystack, tokens);
}

function questPassesFilters(quest: RushEditorQuestNode, filters: RushEditorFilters): boolean {
  if (filters.camp && quest.camp !== filters.camp) return false;
  if (filters.orderCode && quest.orderCode !== filters.orderCode) return false;
  if (filters.classReq && quest.classReq !== filters.classReq) return false;
  if (filters.withoutTips && quest.hasTips) return false;
  return true;
}

/**
 * Applique recherche + filtres. Règles :
 *  · un **bloc** dont le titre répond à la recherche garde toutes ses quêtes filtrées ;
 *  · sinon une quête doit répondre elle-même à la recherche ;
 *  · un bloc qui perd toutes ses quêtes disparaît, **sauf** un bloc vide (Conseil / Tips)
 *    qui répond à la recherche et qu'aucun filtre de quête n'exclut.
 */
export function filterRushEditorTree(tree: RushEditorTree, filters: RushEditorFilters): RushEditorTree {
  const tokens = rushEditorTokens(filters.query);
  const questFiltersActive = !!(filters.camp || filters.orderCode || filters.classReq || filters.withoutTips);

  return tree
    .map((chapter) => {
      const chapterMatches = matchesEveryToken(normalizeRushEditorQuery(chapter.label), tokens);
      const blocks = chapter.blocks
        .map((block) => {
          const blockMatches = matchesEveryToken(normalizeRushEditorQuery(block.title), tokens);
          const quests = block.quests
            .filter((quest) => questPassesFilters(quest, filters))
            .filter((quest) => (blockMatches || chapterMatches ? true : matchRushEditorQuest(quest, filters.query)));
          return { ...block, quests };
        })
        .filter((block) => block.quests.length > 0 || (!questFiltersActive && matchesEveryToken(
          normalizeRushEditorQuery(`${block.title} ${block.chapterLabel}`), tokens,
        )));
      return { ...chapter, blocks, questCount: blocks.reduce((sum, block) => sum + block.quests.length, 0) };
    })
    .filter((chapter) => chapter.blocks.length > 0);
}

/** Nombre de quêtes visibles dans un arbre (badge de la barre unique). */
export function countRushEditorQuests(tree: RushEditorTree): number {
  return tree.reduce((sum, chapter) => sum + chapter.questCount, 0);
}

// ─── Sélection ───────────────────────────────────────────────────────────────

/**
 * Ce que l'inspecteur affiche. Une **seule** sélection à la fois : c'est elle qui
 * remplace `editingMilestone` / `editingSeqId` et qui rend l'inspecteur prévisible.
 */
export type RushEditorSelection =
  | { kind: "none" }
  | { kind: "block"; blockId: string }
  | { kind: "quest"; blockId: string; questId: string };

export function findRushEditorBlock(tree: RushEditorTree, blockId: string): RushEditorBlockNode | null {
  for (const chapter of tree) {
    const block = chapter.blocks.find((candidate) => candidate.id === blockId);
    if (block) return block;
  }
  return null;
}

export function findRushEditorQuest(
  tree: RushEditorTree,
  questId: string,
): { quest: RushEditorQuestNode; block: RushEditorBlockNode } | null {
  for (const chapter of tree) {
    for (const block of chapter.blocks) {
      const quest = block.quests.find((candidate) => candidate.id === questId);
      if (quest) return { quest, block };
    }
  }
  return null;
}

/** La sélection désigne-t-elle ce bloc (directement ou par une de ses quêtes) ? */
export function selectionTargetsRushEditorBlock(selection: RushEditorSelection, blockId: string): boolean {
  return (selection.kind === "block" || selection.kind === "quest") && selection.blockId === blockId;
}

/**
 * Après la suppression d'un bloc : on garde la **position** — le bloc qui occupe
 * désormais l'index supprimé, sinon le précédent, sinon aucun. Sans ça, la sélection
 * pointait un id disparu et l'inspecteur restait sur une épave.
 */
export function selectionAfterRushEditorBlockRemoved(
  selection: RushEditorSelection,
  tree: RushEditorTree,
  removedBlockId: string,
): RushEditorSelection {
  if (!selectionTargetsRushEditorBlock(selection, removedBlockId)) return selection;
  const blocks = tree.flatMap((chapter) => chapter.blocks);
  const index = blocks.findIndex((block) => block.id === removedBlockId);
  const next = blocks[index + 1] ?? blocks[index - 1];
  return next ? { kind: "block", blockId: next.id } : { kind: "none" };
}

/** Après la suppression d'une quête : la suivante du même bloc, sinon la précédente, sinon le bloc. */
export function selectionAfterRushEditorQuestRemoved(
  selection: RushEditorSelection,
  block: RushEditorBlockNode | null,
  removedQuestId: string,
): RushEditorSelection {
  if (selection.kind !== "quest" || selection.questId !== removedQuestId) return selection;
  if (!block) return { kind: "none" };
  const index = block.quests.findIndex((quest) => quest.id === removedQuestId);
  const next = block.quests[index + 1] ?? block.quests[index - 1];
  return next
    ? { kind: "quest", blockId: block.id, questId: next.id }
    : { kind: "block", blockId: block.id };
}

// ─── Palette de commandes (Ctrl+K) ───────────────────────────────────────────

export type RushEditorCommandKind = "quest" | "block" | "action";

export type RushEditorCommand = {
  /** Identifiant stable de la ligne (`quest:<id>`, `block:<id>`, `action:<id>`). */
  id: string;
  kind: RushEditorCommandKind;
  label: string;
  /** Contexte affiché à droite (chapitre, qid, bloc). */
  hint: string;
  /** Texte cherché par la palette. */
  keywords: string;
  /** Sélection appliquée au clic (quête / bloc). */
  selection?: RushEditorSelection;
  /** Action à exécuter (créer un bloc, ouvrir Config…). */
  actionId?: string;
};

/**
 * Index aplati de la palette : un bloc, puis ses quêtes, dans l'ordre de l'arbre.
 * L'ordre suit le guide — la palette sert d'abord à **aller à un endroit connu**.
 */
export function buildRushEditorCommands(tree: RushEditorTree): RushEditorCommand[] {
  const commands: RushEditorCommand[] = [];
  for (const chapter of tree) {
    for (const block of chapter.blocks) {
      commands.push({
        id: `block:${block.id}`,
        kind: "block",
        label: `Bloc · ${block.title}`,
        hint: `${chapter.label} · ${block.quests.length} quête${block.quests.length > 1 ? "s" : ""}`,
        keywords: normalizeRushEditorQuery(`${block.title} ${chapter.label} ${block.type}`),
        selection: { kind: "block", blockId: block.id },
      });
      for (const quest of block.quests) {
        commands.push({
          id: `quest:${quest.id}`,
          kind: "quest",
          label: `Quête · ${quest.name || "(sans nom)"}`,
          hint: quest.qids.length > 0
            ? `${block.title} · qid ${quest.qids.join(", ")}`
            : block.title,
          keywords: normalizeRushEditorQuery(
            `${quest.name} ${quest.blockTitle} ${quest.chapterLabel} ${quest.camp ?? ""} ${quest.orderCode ?? ""} ${quest.classReq ?? ""} ${quest.qids.join(" ")} ${quest.keywords}`,
          ),
          selection: { kind: "quest", blockId: block.id, questId: quest.id },
        });
      }
    }
  }
  return commands;
}

/** Filtre la palette : chaque mot de la requête doit matcher le libellé ou les mots-clés. */
export function filterRushEditorCommands(commands: RushEditorCommand[], query: string): RushEditorCommand[] {
  const tokens = rushEditorTokens(query);
  if (tokens.length === 0) return commands;
  return commands.filter((command) => matchesEveryToken(
    normalizeRushEditorQuery(`${command.label} ${command.hint} ${command.keywords}`),
    tokens,
  ));
}
