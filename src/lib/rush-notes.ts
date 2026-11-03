/**
 * Corrélation des **notes** du guide Rush — Tougli et Dofusyelle, chacun rattaché par ses
 * propres données, sans dépendance de l'un à l'autre.
 *
 * Mesure du 03/11/2026 :
 *   · Tougli n'a **aucun texte** dans `quests[].objectives` ; ses notes sont des **contraintes
 *     structurées** (`needPlayer` 38, `job` 37, `hours` 6, `spell` 3, `note` 4) + 73 textes de
 *     guide (dont 20 `take_quests` avec `&n`, résolus par `resolveQuestRefs`) ;
 *   · Dofusyelle est un guide **autonome** (353 quêtes, 57 étapes) : son rattachement propre est
 *     l'**étape** (elle liste ses quêtes et ses donjons) et la **note de donjon** (par slug).
 *
 * La règle ne décide que du **rattachement** ; le contenu est importé tel quel (décision du
 * propriétaire : il reformulera).
 */

import { aidLineFor, quotedQuestTitles } from "./rush-dofusyelle-tips";

export type RushNoteSource = "tougli" | "dofusyelle";

export type RushNote = {
  source: RushNoteSource;
  /** `constraint` · `note` · `take_quests` (Tougli) · `step` · `aide` · `dungeon` (Dofusyelle). */
  kind: string;
  text: string;
  /** Provenance lisible (type de contrainte, étape, donjon). */
  origin: string;
};

export type TougliNotes = {
  guideNotes?: Array<{ type?: string; text?: string; questNames?: string[] }>;
  questConstraints?: Array<{
    /** Id DofusDB de la quête — **le rattachement exact** quand notre nom diffère de Tougli. */
    questId?: number;
    questName?: string;
    constraints?: Array<{ type?: string; text?: string }>;
  }>;
};

export type DofusyelleNotes = {
  steps?: Array<{
    n?: number;
    title?: string;
    body?: string;
    aide?: string;
    remark?: string;
    quetes?: string[];
    donjons?: Array<{ name?: string; slug?: string }>;
  }>;
  dungeonNotes?: Array<{ name?: string; slug?: string; note?: string }>;
};

export type NoteTarget = {
  /** Clé de comparaison (`normalizeQuestKey`). */
  key: string;
  /** Nom affiché (preuve). */
  name: string;
  /**
   * Ids DofusDB de la quête (`GuideSequence.questDbIds`) — rattachement **exact**, y compris
   * pour les séquences importées depuis God (Brâkmarien) absentes du dataset de seed et dont
   * le nom peut différer de celui de Tougli.
   */
  questIds?: number[];
  /** Donjons de la quête (noms), pour rattacher les notes de donjon. */
  dungeonNames?: string[];
};

/** Clé de comparaison — même normalisation que la corrélation Dofusyelle des astuces. */
export function normalizeQuestKey(name: string | null | undefined): string {
  return String(name ?? "")
    .replace(/\s*\[[^\]]*\]\s*$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Libellé court d'une contrainte Tougli — jamais le nom technique à l'écran. */
export function constraintLabel(type: string | null | undefined): string {
  switch (type) {
    case "needPlayer":
      return "Joueurs";
    case "job":
      return "Métier";
    case "hours":
      return "Horaire";
    case "spell":
      return "Sort";
    case "note":
      return "Note";
    default:
      return "Contrainte";
  }
}

/**
 * Dofusyelle insère parfois ses quêtes dans le `body` sans les résoudre : le texte contient
 * `[object Object]`. On retire ces marqueurs et la ponctuation orpheline qu'ils laissent.
 */
export function cleanDofusyelleBody(text: string | null | undefined): string {
  return String(text ?? "")
    .replace(/(?:,\s*)?\[object Object\](?:\s*,)?/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .replace(/^[\s,;]+|[\s,;]+$/g, "")
    .trim();
}

const MAX_NOTES_PER_TARGET = 6;

/**
 * Construit les notes par quête. Une note identique n'est ajoutée qu'une fois par quête
 * (dédoublonnage `source + kind + texte`), et le nombre de notes par quête est borné.
 */
export function correlateRushNotes(input: {
  toughli?: TougliNotes | null;
  dofusyelle?: DofusyelleNotes | null;
  targets: NoteTarget[];
  maxNotesPerTarget?: number;
}): Map<string, RushNote[]> {
  const max = input.maxNotesPerTarget ?? MAX_NOTES_PER_TARGET;
  const known = new Set(input.targets.map((target) => target.key).filter(Boolean));
  const notes = new Map<string, RushNote[]>();
  /** Rattachement **exact** par id DofusDB — une séquence importée n'a pas toujours le nom de Tougli. */
  const byQuestId = new Map<string, NoteTarget[]>();
  for (const target of input.targets) {
    for (const id of target.questIds ?? []) {
      const idKey = String(id);
      const list = byQuestId.get(idKey) ?? [];
      list.push(target);
      byQuestId.set(idKey, list);
    }
  }

  const add = (key: string, note: RushNote) => {
    if (!known.has(key)) return;
    const list = notes.get(key) ?? [];
    if (list.length >= max) return;
    const fingerprint = `${note.source}|${note.kind}|${normalizeQuestKey(note.text)}`;
    const duplicate = list.some(
      (existing) => `${existing.source}|${existing.kind}|${normalizeQuestKey(existing.text)}` === fingerprint,
    );
    if (duplicate) return;
    list.push(note);
    notes.set(key, list);
  };

  // ─── Tougli : contraintes de quête (métier, joueurs, horaire, sort, note) ──
  for (const quest of input.toughli?.questConstraints ?? []) {
    const key = normalizeQuestKey(quest?.questName);
    // Le nom de Tougli ne suffit pas : les séquences importées depuis God (Brâkmarien) portent
    // `questDbIds` et gardent leur propre libellé. L'id tranche, le nom reste le repli.
    const exact = quest?.questId != null ? (byQuestId.get(String(quest.questId)) ?? []) : [];
    if (!key && exact.length === 0) continue;
    for (const constraint of quest?.constraints ?? []) {
      const text = String(constraint?.text ?? "").trim();
      if (!text) continue;
      const note: RushNote = {
        source: "tougli",
        kind: "constraint",
        text: `${constraintLabel(constraint?.type)} : ${text}`,
        origin: String(constraint?.type ?? "constraint"),
      };
      if (key) add(key, note);
      for (const target of exact) add(target.key, note);
    }
  }

  // ─── Tougli : textes du guide rattachés à leurs quêtes ─────────────────────
  for (const guideNote of input.toughli?.guideNotes ?? []) {
    const text = String(guideNote?.text ?? "").trim();
    if (!text) continue;
    for (const questName of guideNote?.questNames ?? []) {
      add(normalizeQuestKey(questName), {
        source: "tougli",
        kind: String(guideNote?.type ?? "note"),
        text,
        origin: `guide ${guideNote?.type ?? "note"}`,
      });
    }
  }

  // ─── Dofusyelle : texte de l'étape rattaché à ses quêtes ───────────────────
  for (const step of input.dofusyelle?.steps ?? []) {
    const body = cleanDofusyelleBody(step?.body);
    const aide = cleanDofusyelleBody(step?.aide);
    const remark = cleanDofusyelleBody(step?.remark);
    const origin = `étape ${step?.n ?? "?"} — ${String(step?.title ?? "").trim()}`;

    // Le `body` et le `remark` décrivent l'étape entière : ils restent au rapport (`step`/`remark`),
    // jamais appliqués — les coller sur chaque quête reproduirait le défaut des 38 doublons.
    for (const questName of step?.quetes ?? []) {
      const key = normalizeQuestKey(questName);
      if (!key) continue;
      if (body) add(key, { source: "dofusyelle", kind: "step", text: body, origin });
      if (remark) add(key, { source: "dofusyelle", kind: "remark", text: remark, origin });
    }

    // L'aide, elle, cite ses quêtes entre guillemets : on ne rattache que celles-là, avec la
    // SEULE ligne qui les concerne (mesure du 03/11/2026 : « Ali 57… » se retrouvait sur 12 quêtes).
    if (aide) {
      for (const title of quotedQuestTitles(aide)) {
        add(normalizeQuestKey(title), {
          source: "dofusyelle",
          kind: "aide",
          text: aidLineFor(title, aide),
          origin,
        });
      }
    }
  }

  // ─── Dofusyelle : note de donjon rattachée aux quêtes qui exigent ce donjon ─
  for (const dungeonNote of input.dofusyelle?.dungeonNotes ?? []) {
    const note = String(dungeonNote?.note ?? "").trim();
    const dungeon = normalizeQuestKey(dungeonNote?.name);
    if (!note || !dungeon) continue;
    for (const target of input.targets) {
      const hasDungeon = (target.dungeonNames ?? []).some(
        (name) => normalizeQuestKey(name) === dungeon,
      );
      if (!hasDungeon) continue;
      add(target.key, {
        source: "dofusyelle",
        kind: "dungeon",
        text: note,
        origin: `donjon ${String(dungeonNote?.name ?? "").trim()}`,
      });
    }
  }

  return notes;
}
