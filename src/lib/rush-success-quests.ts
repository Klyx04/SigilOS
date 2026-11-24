import type { RushGuideQuestRef } from "./rush-guide-utils";
import { RUSH_CLASS_QUESTS } from "./rush-class-quests";

/**
 * Une ligne de la fiche d'un succès : la quête est toujours listée, même quand
 * elle n'appartient pas au guide (le succès peut référencer une quête hors trame).
 * `done` n'a de sens que pour une quête du guide — une quête hors guide est
 * affichée décochée, jamais devinée.
 */
export type RushSuccessQuestRow = {
  id: number;
  name: string;
  done: boolean;
  inGuide: boolean;
  /** Séquence du guide qui porte la quête (clic + validation) ; absente hors guide. */
  sequenceId?: string;
};

function isNameMap(
  names: Readonly<Record<number, string>> | ReadonlyMap<number, string>
): names is ReadonlyMap<number, string> {
  return typeof (names as ReadonlyMap<number, string>).get === "function";
}

/**
 * Construit **toutes** les quêtes d'un succès, dans l'ordre fourni par
 * `achievements.json`. Le nom vient du guide quand la quête y est, sinon du
 * catalogue optionnel, sinon d'un libellé neutre `Quête <id>`.
 *
 * Règle pure : ids invalides écartés, doublons dédoublonnés, aucune devinette
 * d'état. Un id fourni mais absent du guide reste listé (`inGuide: false`),
 * c'est précisément ce que l'écran doit dire.
 */
export function buildSuccessQuestRows(
  questIds: readonly number[] | null | undefined,
  guideQuests: readonly RushGuideQuestRef[],
  names?: Readonly<Record<number, string>> | ReadonlyMap<number, string>
): RushSuccessQuestRow[] {
  if (!Array.isArray(questIds) || questIds.length === 0) return [];

  const byId = new Map<number, RushGuideQuestRef>();
  for (const quest of guideQuests) {
    if (!Number.isInteger(quest.id) || quest.id <= 0) continue;
    const prev = byId.get(quest.id);
    byId.set(quest.id, prev ? { ...prev, done: prev.done || quest.done } : quest);
  }

  const nameOf = (id: number): string | undefined => {
    if (!names) return undefined;
    if (isNameMap(names)) return names.get(id);
    return names[id];
  };

  const guideClassIds = guideQuests
    .filter((quest) => RUSH_CLASS_QUESTS[quest.id])
    .map((quest) => quest.id);
  const guideClassValues = new Set(guideClassIds.map((id) => RUSH_CLASS_QUESTS[id]));
  const singleClassId = guideClassValues.size === 1 ? guideClassIds[0] : null;
  let genericClassEmitted = false;

  const seen = new Set<number>();
  const rows: RushSuccessQuestRow[] = [];
  for (const raw of questIds) {
    if (!Number.isInteger(raw) || raw <= 0) continue;
    if (seen.has(raw)) continue;
    seen.add(raw);
    if (RUSH_CLASS_QUESTS[raw]) {
      if (singleClassId) {
        if (raw !== singleClassId) continue;
      } else {
        if (genericClassEmitted) continue;
        genericClassEmitted = true;
        rows.push({
          id: raw,
          name: "Quête de classe",
          done: false,
          inGuide: false,
        });
        continue;
      }
    }
    const ref = byId.get(raw);
    rows.push({
      id: raw,
      name: ref?.name || nameOf(raw) || `Quête ${raw}`,
      done: ref?.done ?? false,
      inGuide: !!ref,
      ...(ref?.sequenceId ? { sequenceId: ref.sequenceId } : {}),
    });
  }
  return rows;
}
