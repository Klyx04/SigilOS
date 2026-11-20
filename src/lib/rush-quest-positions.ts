/**
 * Position de lancement d'une quête du guide Rush — **fait de jeu**, jamais un
 * texte de guide : `{ x, y, zone }`. La carte est produite par
 * `scripts/siphon-rush-quest-positions.ts` (DPLN, lecture seule) et consommée par
 * le seed pour poser un tag `pos_tags` lu par `getSequenceCoord`.
 */
import type { RushImportActivityTag } from "@/lib/rush-import";

export type RushQuestPosition = {
    x: number;
    y: number;
    /** Zone DPLN (« Les Champs de Cania »), informative. */
    zone?: string;
    /** URL source, pour re-vérifier une mesure. */
    url?: string;
    /** Ligne « Position de lancement » du haut (`top`), premier chip du corps (`body`) ou fiche Dofus (`guide`). */
    source?: "top" | "body" | "guide";
    /** Détour zaap proposé ; le zaap le plus proche est résolu par l'interface. */
    allowZaap?: boolean;
    /** Monde Dofus (1 = monde classique). */
    worldId?: number;
    /** Zaap manuel saisi en God, prioritaire sur l'auto le plus proche. */
    zaapX?: number;
    zaapY?: number;
};

export type RushQuestPositionMap = Readonly<Record<string, RushQuestPosition>>;

/**
 * Quêtes dont l'absence de position est **mesurée et assumée** : le point de départ
 * dépend du personnage, il n'existe donc pas une coordonnée unique à afficher.
 * La raison est rendue dans l'avertissement du plan, jamais inventée.
 */
export const RUSH_POSITION_EXPLANATIONS: Readonly<Record<number, string>> = {
  1938:
    "La colère des dieux se lance au temple de votre classe : 20 positions différentes selon la classe.",
};

/** Ligne `DofusQuestEntry` telle que la lit le repli du siphon (aucune autre donnée). */
export type RushDofusQuestEntryPositionRow = {
  posX?: unknown;
  posY?: unknown;
  coords?: unknown;
  zone?: string | null;
  npcSubArea?: string | null;
  npcName?: string | null;
};

/**
 * Position de lancement depuis `DofusQuestEntry` — **repli mesuré** du siphon pour les
 * pages DPLN qui n'écrivent aucune coordonnée (Incarnam, quêtes de la chaîne des Dofus).
 *
 * Deux formes coexistent en base : `posX`/`posY` (colonnes historiques, souvent `0,0`)
 * et `coords` (`{x,y,worldId}`, posé par le siphon DofusDB). On lit la seconde quand la
 * première est vide. Un `0,0` **nu** est un défaut de saisie, jamais une position : on
 * rend `null` plutôt que d'envoyer le joueur au centre d'Amakna.
 */
export function positionFromDofusQuestEntry(
  row: RushDofusQuestEntryPositionRow | null | undefined
): RushQuestPosition | null {
  if (!row || typeof row !== "object") return null;

  const coords =
    row.coords && typeof row.coords === "object"
      ? (row.coords as Record<string, unknown>)
      : null;
  // `posX`/`posY` priment **quand les deux sont renseignés** ; un `0,0` est le défaut
  // historique et doit laisser la place à `coords`.
  const legacyX = readZaapAxis(row.posX);
  const legacyY = readZaapAxis(row.posY);
  const useLegacy = legacyX != null && legacyY != null && !(legacyX === 0 && legacyY === 0);
  const x = useLegacy ? legacyX : readZaapAxis(coords?.x ?? coords?.posX);
  const y = useLegacy ? legacyY : readZaapAxis(coords?.y ?? coords?.posY);
  if (x == null || y == null || (x === 0 && y === 0)) return null;

  const zone = [row.npcSubArea, row.zone, row.npcName]
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .find(Boolean);
  const worldId = readWorldId(coords?.worldId);

  return {
    x,
    y,
    ...(zone ? { zone: zone.slice(0, 120) } : {}),
    source: "guide",
    allowZaap: true,
    ...(worldId != null ? { worldId } : {}),
  };
}

/**
 * Tag `pos_tags` d'une position mesurée — **une seule source** pour le seed et la
 * synchro des séquences déjà en base. `name` est le format lu par `getSequenceCoord`
 * (`[-25,-36]`) ; `worldId`, `allowZaap`, `zaapX`/`zaapY` sont les champs du studio.
 *
 * Un **zaap manuel** saisi en God (`zaapX`/`zaapY` sur le tag existant) reste
 * prioritaire ; sinon le zaap de la carte (s'il existe) est repris. Un `allowZaap`
 * explicite (`true` **ou** `false`) est conservé tel quel.
 */
export function buildRushPositionTag(
  position: RushQuestPosition,
  previous?: RushImportActivityTag | null
): RushImportActivityTag {
  const manualZaap = readZaapPair(previous) ?? readZaapPair(position);
  const worldId = readWorldId(previous?.worldId) ?? readWorldId(position.worldId);
  const allowZaap =
    typeof previous?.allowZaap === "boolean"
      ? previous.allowZaap
      : position.allowZaap === true
        ? true
        : undefined;
  return {
    type: "pos_tags",
    name: `[${position.x},${position.y}]`,
    ...(worldId != null ? { worldId } : {}),
    ...(allowZaap != null ? { allowZaap } : {}),
    ...(manualZaap ? { zaapX: manualZaap.x, zaapY: manualZaap.y } : {}),
  };
}

/**
 * Séquences existantes lues en base pour la synchro. Seuls les champs utiles sont
 * demandés : la règle ne voit ni les textes, ni les ressources, ni les succès.
 */
export type RushPositionSyncSequence = {
  id: string;
  name: string;
  questDbIds?: readonly number[] | null;
  activityTags?: unknown;
  /**
   * Un succès n'est pas une quête : il n'a **aucune position de lancement**.
   * Le plan l'écarte et le compte à part, au lieu de le signaler comme un trou.
   */
  isSuccess?: boolean;
};

export type RushPositionSyncUpdate = {
  sequenceId: string;
  name: string;
  position: RushQuestPosition;
  activityTags: RushImportActivityTag[];
  /** Un zaap manuel existait déjà : il a été conservé, pas remplacé par l'auto. */
  manualZaap: boolean;
};

export type RushPositionSyncPlan = {
  updates: RushPositionSyncUpdate[];
  total: number;
  /** Succès hors trame : écartés du plan, jamais comptés comme des trous. */
  successes: number;
  withPosition: number;
  withoutPosition: number;
  unchanged: number;
  warnings: string[];
};

export type RushPositionSyncSample = {
  sequenceId: string;
  name: string;
  x: number;
  y: number;
  allowZaap: boolean;
  manualZaap: boolean;
  zaapX?: number;
  zaapY?: number;
};

/** Ce que le client reçoit : des comptes et un échantillon, jamais les 500 tags. */
export type RushPositionSyncSummary = {
  total: number;
  successes: number;
  withPosition: number;
  withoutPosition: number;
  updated: number;
  unchanged: number;
  warnings: string[];
  sample: RushPositionSyncSample[];
};

/**
 * Calcule la synchro des positions sur les séquences **déjà en base**.
 *
 * L'import consolidé est additif : il ne réécrit jamais une séquence existante. Cette
 * règle comble ce trou pour le seul tag technique `pos_tags` :
 *
 * - résolution par `questDbIds` (fait mesuré : 533/536 en local) ;
 * - le tag est **remplacé en place** (ordre des autres tags préservé), ou ajouté en
 *   fin de liste s'il est absent — comme le seed le pose après les ressources ;
 * - un second passage ne réécrit rien (comparaison des champs du tag) ;
 * - une séquence sans position ni id reste **signalée**, jamais devinée.
 */
export function planRushPositionSync(
  sequences: readonly RushPositionSyncSequence[],
  positions: RushQuestPositionMap
): RushPositionSyncPlan {
  const updates: RushPositionSyncUpdate[] = [];
  const warnings: string[] = [];
  let unchanged = 0;
  let successes = 0;
  let withPosition = 0;
  let withoutPosition = 0;

  for (const sequence of sequences) {
    // Un succès n'a pas de position : il ne doit jamais apparaître comme un trou.
    if (sequence.isSuccess) {
      successes += 1;
      continue;
    }

    const questIds = (sequence.questDbIds ?? []).filter((id) => Number.isSafeInteger(id));
    let position: RushQuestPosition | undefined;
    for (const questId of questIds) {
      const candidate = positions[String(questId)];
      if (candidate && Number.isSafeInteger(candidate.x) && Number.isSafeInteger(candidate.y)) {
        position = candidate;
        break;
      }
    }

    if (!position) {
      withoutPosition += 1;
      const base =
        questIds.length > 0
          ? `Aucune position DPLN pour « ${sequence.name} » (quête ${questIds.join(", ")}).`
          : `Aucune position DPLN pour « ${sequence.name} » (aucun id DofusDB).`;
      const explanation = questIds
        .map((questId) => RUSH_POSITION_EXPLANATIONS[questId])
        .find(Boolean);
      warnings.push(explanation ? `${base} ${explanation}` : base);
      continue;
    }

    withPosition += 1;
    const existingTags = readTags(sequence.activityTags);
    const positionIndex = existingTags.findIndex((tag) => tag.type === "pos_tags");
    const previous = positionIndex >= 0 ? existingTags[positionIndex] : null;
    const tag = buildRushPositionTag(position, previous);
    const nextTags =
      positionIndex >= 0
        ? existingTags.map((existingTag, index) => (index === positionIndex ? tag : existingTag))
        : [...existingTags, tag];

    if (previous && samePositionTag(previous, tag)) {
      unchanged += 1;
      continue;
    }

    updates.push({
      sequenceId: sequence.id,
      name: sequence.name,
      position,
      activityTags: nextTags,
      manualZaap: readZaapPair(previous) != null,
    });
  }

  const total = sequences.length;
  return {
    updates,
    total,
    successes,
    withPosition,
    withoutPosition,
    unchanged,
    warnings,
  };
}

/**
 * Réduit le plan à ce que l'interface affiche : comptes, avertissements et un
 * échantillon borné. Les centaines de tags complets restent côté serveur.
 */
export function summarizeRushPositionSyncPlan(
  plan: RushPositionSyncPlan,
  sampleLimit = 12
): RushPositionSyncSummary {
  const sample: RushPositionSyncSample[] = [];
  for (const update of plan.updates.slice(0, Math.max(0, sampleLimit))) {
    const tag = update.activityTags.find((item) => item.type === "pos_tags");
    sample.push({
      sequenceId: update.sequenceId,
      name: update.name,
      x: update.position.x,
      y: update.position.y,
      allowZaap: tag?.allowZaap === true,
      manualZaap: update.manualZaap,
      ...(tag?.zaapX != null && tag?.zaapY != null ? { zaapX: tag.zaapX, zaapY: tag.zaapY } : {}),
    });
  }
  return {
    total: plan.total,
    successes: plan.successes,
    withPosition: plan.withPosition,
    withoutPosition: plan.withoutPosition,
    updated: plan.updates.length,
    unchanged: plan.unchanged,
    warnings: plan.warnings.slice(0, 20),
    sample,
  };
}

/** Les tags d'activité sont un JSON libre côté base : on ne garde que les objets. */
function readTags(value: unknown): RushImportActivityTag[] {
  return Array.isArray(value) ? (value as RushImportActivityTag[]) : [];
}

function readWorldId(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 999
    ? value
    : null;
}

function readZaapAxis(value: unknown): number | null {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= -1000 && value <= 1000
    ? value
    : null;
}

function readZaapPair(source: { zaapX?: unknown; zaapY?: unknown } | null | undefined) {
  const x = readZaapAxis(source?.zaapX);
  const y = readZaapAxis(source?.zaapY);
  return x != null && y != null ? { x, y } : null;
}

/** Champs **lus** par l'interface : comparer le reste ferait réécrire pour rien. */
function samePositionTag(previous: RushImportActivityTag, next: RushImportActivityTag): boolean {
  return (
    previous.name === next.name &&
    previous.worldId === next.worldId &&
    previous.allowZaap === next.allowZaap &&
    previous.zaapX === next.zaapX &&
    previous.zaapY === next.zaapY
  );
}
