/**
 * **Backfill Tougli → conditions structurées** — règle pure, testée hors base.
 *
 * Mesure du 24/11/2026 sur le guide RSA (`details-batch`, 530 quêtes) :
 * **389 quêtes** portent au moins une condition, dont **726 combats** (162 quêtes en
 * enchaînent plusieurs, jusqu'à 14), 80 `bashMobs`, 38 `needPlayer`, 37 métiers,
 * 7 donjons au choix, 6 horaires, 4 notes, 3 sorts, 3 songes, 2 succès, 9 outils.
 *
 * Le mapping est **fidèle ou silencieux** : un type non modélisable part en note ou en
 * `issue`, jamais inventé. Les donjons requis (`dungeon`) sont **ignorés** : le guide les
 * porte déjà dans `GuideSequence.dungeonIds` (verrou de donjons), les dupliquer dans
 * `constraints` créerait deux vérités.
 */

import { DOFUS_JOBS } from "@/lib/dofus-assets";
import type {
  RushBashMob,
  RushCombat,
  RushCombatMode,
  RushConstraintRole,
  RushDungeonChoiceDungeon,
  RushQuestConstraints,
} from "@/types/rush-constraints";

/** Donjon résolu côté base (nom canonique, visuel) — jamais deviné par similarité. */
export type TougliDungeonResolution = {
  id?: string;
  name?: string;
  bossName?: string;
  level?: number;
  imageUrl?: string;
} | null;

export type TougliDungeonResolver = (raw: {
  id?: unknown;
  name?: unknown;
  level?: unknown;
  bosses?: unknown;
}) => TougliDungeonResolution;

export type MapTougliOptions = {
  /** Résolution du donjon dans notre catalogue (id Prisma, nom, visuel). */
  resolveDungeon?: TougliDungeonResolver;
};

export type TougliMappingResult = {
  constraints: RushQuestConstraints;
  issues: string[];
};

const MAX_COMBATS = 20;
const MAX_MONSTERS_PER_COMBAT = 20;
const MAX_BASH_MOBS = 20;
const MAX_NOTES = 10;
const MAX_SPELLS = 10;
const MAX_JOBS = 10;
const MAX_DUNGEONS = 8;
const MAX_ROLES = 10;

const COMBAT_MODES: Readonly<Record<string, RushCombatMode>> = {
  solo: "solo",
  groupe: "group",
  tactique: "tactical",
  soloV: "soloWaves",
  groupeV: "groupWaves",
};

const JOB_BY_NORMALIZED_NAME = new Map(
  Object.values(DOFUS_JOBS)
    .flat()
    .map((job) => [normalizeName(job.name), job.id] as const),
);

/** Clé de rapprochement : minuscules, sans accents, sans séparateurs. */
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Texte français d'un payload Tougli (`{ fr }`, chaîne, ou vide). */
export function readFrench(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (!isRecord(value)) return "";
  if (typeof value.fr === "string") return value.fr.trim();
  if (isRecord(value.name) && typeof value.name.fr === "string") return value.name.fr.trim();
  return "";
}

function clip(value: string, max: number): string {
  return value.length > max ? value.slice(0, max).trimEnd() : value;
}

function positiveInt(value: unknown, max: number): number | undefined {
  const number = Math.floor(Number(value));
  if (!Number.isSafeInteger(number) || number <= 0) return undefined;
  return Math.min(number, max);
}

function monsterImageUrl(id: unknown): string | undefined {
  const number = positiveInt(id, 2_147_483_647);
  return number ? `/api/assets-dofus/monsters/${number}` : undefined;
}

/** Un monstre Tougli (`{ id, name: { fr }, level, health }`) — jamais un nom vide. */
function mapMonster(raw: unknown, count: unknown): RushCombat["monsters"][number] | null {
  if (!isRecord(raw)) return null;
  const name = clip(readFrench(raw.name), 120);
  if (!name) return null;
  const level = positiveInt(raw.level, 200);
  const health = positiveInt(raw.health, 999_999);
  return {
    name,
    count: positiveInt(count, 20) ?? 1,
    ...(level !== undefined ? { level } : {}),
    ...(health !== undefined ? { health } : {}),
    ...(monsterImageUrl(raw.id) ? { imageUrl: monsterImageUrl(raw.id) } : {}),
  };
}

function mapCombat(raw: unknown): { combat: RushCombat | null; issue?: string } {
  if (!isRecord(raw)) return { combat: null, issue: "combat : payload illisible" };
  const mode = COMBAT_MODES[String(raw.type ?? "")];
  if (!mode) return { combat: null, issue: `combat : mode inconnu « ${String(raw.type ?? "?")} »` };
  const entries = Array.isArray(raw.payload) ? raw.payload : [];
  const monsters = entries
    .map((entry) => (isRecord(entry) ? mapMonster(entry.monster, entry.count) : null))
    .filter((monster): monster is RushCombat["monsters"][number] => monster !== null)
    .slice(0, MAX_MONSTERS_PER_COMBAT);
  if (monsters.length === 0) {
    return { combat: null, issue: "combat sans monstre (ignoré)" };
  }
  return { combat: { mode, monsters } };
}

function combatSignature(combat: RushCombat): string {
  return [
    combat.mode,
    combat.detail ?? "",
    ...combat.monsters.map((monster) => `${monster.name}|${monster.count}|${monster.level ?? ""}`),
  ].join("~");
}

/** « Entre 20h00 et 08h00 », « >20h00 (Contournable) », « Attendre 3 minutes ». */
export function parseTougliHours(
  raw: string,
): { schedule: NonNullable<RushQuestConstraints["hours"]> | null; issue?: string } | null {
  const text = raw.trim();
  if (!text) return null;
  const wait = text.match(/attendre\s+(\d{1,4})\s*minutes?/i);
  if (wait) {
    const minutes = Math.min(1440, Math.max(1, Number(wait[1])));
    return { schedule: { kind: "wait", minutes, npc: /pnj/i.test(text) } };
  }
  const times = [...text.matchAll(/(\d{1,2})\s*h\s*(\d{2})/gi)]
    .map((match) => {
      const hours = Number(match[1]);
      const minutes = Number(match[2]);
      if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
    })
    .filter((value): value is string => value !== null);
  if (times.length === 0) {
    // Jamais de faux « 1 minute » : le texte reste la vérité, en note.
    return { schedule: null, issue: `horaire non reconnu « ${text} »` };
  }
  return {
    schedule: {
      kind: "window",
      from: times[0],
      ...(times[1] ? { to: times[1] } : {}),
      ...(/contournable/i.test(text) ? { optional: true } : {}),
    },
  };
}

function jobLevel(detail: string): number | undefined {
  const explicit = detail.match(/(?:niveau|niv\.?)\s*(\d{1,3})/i);
  const greater = detail.match(/>\s*(\d{1,3})/);
  return positiveInt(explicit?.[1] ?? greater?.[1], 200);
}

function playerCount(text: string): number | undefined {
  const words: Record<string, number> = {
    un: 1,
    une: 1,
    deux: 2,
    trois: 3,
    quatre: 4,
    cinq: 5,
    six: 6,
    sept: 7,
    huit: 8,
    neuf: 9,
    dix: 10,
    onze: 11,
    douze: 12,
  };
  const match = text.match(/^(\d{1,2}|[a-zà-ÿ]+)\s*(?:x\s*)?(?:joueurs?|personnes?)\b/i);
  if (!match) return undefined;
  const raw = match[1].toLowerCase();
  return positiveInt(words[raw] ?? raw, 40);
}

/** Retire « 4 Joueurs » du texte libre : le badge d'effectif le porte déjà. */
function stripPlayerPrefix(text: string, count: number | undefined): string {
  if (count === undefined) return text;
  const stripped = text
    .replace(
      /^(?:\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)\s*(?:x\s*)?(?:joueurs?|personnes?)\s*/i,
      "",
    )
    .trim();
  return stripped || text;
}

/** Un donjon au choix (payload `{ dungeons[], note }`). */
function mapDungeonChoice(
  raw: unknown,
  resolveDungeon: TougliDungeonResolver | undefined,
): { dungeons: RushDungeonChoiceDungeon[]; note?: string; issue?: string } {
  if (!isRecord(raw)) return { dungeons: [], issue: "donjon au choix : payload illisible" };
  const rows = Array.isArray(raw.dungeons) ? raw.dungeons : [];
  const seen = new Set<string>();
  const dungeons: RushDungeonChoiceDungeon[] = [];
  for (const row of rows) {
    if (!isRecord(row)) continue;
    const rawName = readFrench(row.name);
    if (!rawName) continue;
    const resolved = resolveDungeon?.(row) ?? null;
    const name = clip(resolved?.name?.trim() || rawName, 120);
    const key = normalizeName(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const bosses = Array.isArray(row.bosses) ? row.bosses : [];
    const firstBoss = bosses.find((boss) => isRecord(boss) && readFrench(boss.name));
    const bossName = clip(
      resolved?.bossName?.trim() ||
        (isRecord(firstBoss) ? readFrench(firstBoss.name) : ""),
      120,
    );
    const level = positiveInt(resolved?.level ?? row.level, 200);
    dungeons.push({
      ...(resolved?.id ? { id: resolved.id } : {}),
      name,
      ...(bossName ? { bossName } : {}),
      ...(level !== undefined ? { level } : {}),
      ...(resolved?.imageUrl ? { imageUrl: resolved.imageUrl } : {}),
    });
    if (dungeons.length >= MAX_DUNGEONS) break;
  }
  const note = clip(readFrench(raw.note), 300);
  return {
    dungeons,
    ...(note ? { note } : {}),
    ...(rows.length > MAX_DUNGEONS
      ? { issue: `donjon au choix : ${rows.length} propositions → ${MAX_DUNGEONS} max` }
      : {}),
  };
}

function pushUniqueNote(notes: string[], value: string, issues: string[]): void {
  const text = clip(value.trim(), 200);
  if (!text) return;
  if (notes.includes(text)) return;
  if (notes.length >= MAX_NOTES) {
    issues.push(`note ignorée (plafond ${MAX_NOTES}) : ${text}`);
    return;
  }
  notes.push(text);
}

/** Ajoute un rôle libre « joueurs » sans perdre l'effectif déjà connu. */
function addPlayerRole(
  previous: RushQuestConstraints["players"],
  text: string,
  count: number | undefined,
  issues: string[],
): RushQuestConstraints["players"] {
  const roles: RushConstraintRole[] = [...(previous?.roles ?? [])];
  if (roles.length >= MAX_ROLES) {
    issues.push(`rôle joueur ignoré (plafond ${MAX_ROLES}) : ${text}`);
    return previous ?? null;
  }
  roles.push({ kind: "free", text });
  const existingCount = previous?.count;
  return {
    ...(existingCount !== undefined
      ? { count: existingCount }
      : count !== undefined
        ? { count }
        : {}),
    roles,
  };
}

/**
 * Mappe **une** quête Tougli vers le modèle `RushQuestConstraints` v2.
 * Aucun accès base : le seul résolveur externe est le donjon (nom → catalogue).
 */
export function mapTougliQuestConstraints(
  rawQuest: unknown,
  options: MapTougliOptions = {},
): TougliMappingResult {
  const issues: string[] = [];
  const combats: RushCombat[] = [];
  const combatSeen = new Set<string>();
  const jobs: RushQuestConstraints["jobs"] = [];
  const jobSeen = new Set<string>();
  const spells: string[] = [];
  const notes: string[] = [];
  const bashMobs: RushBashMob[] = [];
  const bashSeen = new Set<string>();
  const dungeons: RushDungeonChoiceDungeon[] = [];
  const dungeonSeen = new Set<string>();
  let hours: RushQuestConstraints["hours"] = null;
  let players: RushQuestConstraints["players"] = null;
  let dungeonNote: string | undefined;

  const objectives =
    isRecord(rawQuest) && Array.isArray(rawQuest.objectives) ? rawQuest.objectives : [];

  // « Les totems de Maïmane » porte 6 groupes de 5 donjons : le modèle « donjon au
  // choix » en accepte 8 au total. Au-delà, on n'invente pas une fusion — le verrou de
  // donjons du guide porte déjà ces 29 donjons.
  const dungeonChoiceTotal = objectives.reduce((total, objective) => {
    if (!isRecord(objective) || objective.type !== "dungeonChoice") return total;
    const payload = objective.payload;
    return total + (isRecord(payload) && Array.isArray(payload.dungeons) ? payload.dungeons.length : 0);
  }, 0);
  let dungeonChoiceIssueReported = false;

  for (const objective of objectives) {
    if (!isRecord(objective)) continue;
    const type = String(objective.type ?? "");
    const payload = objective.payload;

    switch (type) {
      case "combat": {
        const body = isRecord(payload) && isRecord(payload.combat) ? payload.combat : null;
        const { combat, issue } = mapCombat(body);
        if (issue) issues.push(issue);
        if (!combat) break;
        const detail = clip(
          typeof payload === "object" && payload !== null && "detail" in payload
            ? readFrench((payload as Record<string, unknown>).detail)
            : "",
          300,
        );
        const next: RushCombat = { ...combat, ...(detail ? { detail } : {}) };
        const signature = combatSignature(next);
        if (combatSeen.has(signature)) break;
        if (combats.length >= MAX_COMBATS) {
          issues.push(`combat ignoré (plafond ${MAX_COMBATS})`);
          break;
        }
        combatSeen.add(signature);
        combats.push(next);
        break;
      }
      case "bashMobs": {
        const rows = Array.isArray(payload) ? payload : [];
        for (const row of rows) {
          const name = clip(readFrench(isRecord(row) ? row.name : null), 120);
          if (!name) continue;
          const key = normalizeName(name);
          if (!key || bashSeen.has(key)) continue;
          if (bashMobs.length >= MAX_BASH_MOBS) {
            issues.push(`monstre ignoré (plafond ${MAX_BASH_MOBS}) : ${name}`);
            break;
          }
          bashSeen.add(key);
          const level = positiveInt(isRecord(row) ? row.level : null, 200);
          bashMobs.push({
            name,
            ...(level !== undefined ? { level } : {}),
            ...(isRecord(row) && monsterImageUrl(row.id)
              ? { imageUrl: monsterImageUrl(row.id) }
              : {}),
          });
        }
        break;
      }
      case "needPlayer": {
        const text = clip(readFrench(payload), 200);
        if (!text) break;
        const count = playerCount(text);
        players = addPlayerRole(players, stripPlayerPrefix(text, count), count, issues);
        break;
      }
      case "job": {
        if (!isRecord(payload) || !isRecord(payload.job)) break;
        const name = clip(readFrench(payload.job.name), 120);
        const jobId = JOB_BY_NORMALIZED_NAME.get(normalizeName(name));
        const detail = readFrench(payload.detail);
        if (!jobId) {
          if (name) pushUniqueNote(notes, `Métier : ${name}`, issues);
          break;
        }
        if (jobSeen.has(jobId)) break;
        if (jobs.length >= MAX_JOBS) {
          issues.push(`métier ignoré (plafond ${MAX_JOBS}) : ${name}`);
          break;
        }
        jobSeen.add(jobId);
        const level = jobLevel(detail);
        jobs.push({ job: jobId, ...(level !== undefined ? { level } : {}) });
        break;
      }
      case "hours": {
        const text = readFrench(payload);
        if (!text) break;
        const parsed = parseTougliHours(text);
        if (!parsed) break;
        if (parsed.issue) issues.push(parsed.issue);
        if (!parsed.schedule) {
          pushUniqueNote(notes, `Horaire : ${text}`, issues);
          break;
        }
        if (!hours) {
          hours = parsed.schedule;
        } else {
          pushUniqueNote(notes, `Horaire : ${text}`, issues);
        }
        break;
      }
      case "spell": {
        const text = clip(readFrench(payload), 100);
        if (!text) break;
        if (spells.length >= MAX_SPELLS) {
          issues.push(`sort ignoré (plafond ${MAX_SPELLS}) : ${text}`);
          break;
        }
        if (!spells.includes(text)) spells.push(text);
        break;
      }
      case "note": {
        const text = readFrench(payload);
        if (text) pushUniqueNote(notes, text, issues);
        break;
      }
      case "songe": {
        const text = clip(readFrench(payload), 200);
        if (text) pushUniqueNote(notes, `Songes : ${text}`, issues);
        break;
      }
      case "url": {
        if (!isRecord(payload)) break;
        const label = readFrench(payload.text) || "Outil";
        const url = typeof payload.url === "string" ? payload.url.trim() : "";
        if (!url) break;
        pushUniqueNote(notes, `Outil : ${label} — ${url}`, issues);
        break;
      }
      case "dungeonChoice": {
        if (dungeonChoiceTotal > MAX_DUNGEONS) {
          if (!dungeonChoiceIssueReported) {
            issues.push(
              `donjon au choix : ${dungeonChoiceTotal} propositions → ignoré (plafond ${MAX_DUNGEONS} ; le verrou de donjons couvre Maïmane)`,
            );
            dungeonChoiceIssueReported = true;
          }
          break;
        }
        const mapped = mapDungeonChoice(payload, options.resolveDungeon);
        if (mapped.issue) issues.push(mapped.issue);
        if (mapped.note) dungeonNote = mapped.note;
        for (const dungeon of mapped.dungeons) {
          const key = normalizeName(dungeon.name);
          if (!key || dungeonSeen.has(key)) continue;
          if (dungeons.length >= MAX_DUNGEONS) {
            issues.push(`donjon au choix ignoré (plafond ${MAX_DUNGEONS}) : ${dungeon.name}`);
            break;
          }
          dungeonSeen.add(key);
          dungeons.push(dungeon);
        }
        break;
      }
      case "achievement": {
        issues.push("succès ignoré (le graphe des succès le porte déjà)");
        break;
      }
      case "dungeon": {
        // Déjà porté par `GuideSequence.dungeonIds` + le verrou de donjons.
        break;
      }
      default:
        break;
    }
  }

  const constraints: RushQuestConstraints = {
    version: 2,
    jobs,
    spells,
    notes,
    combats,
    ...(hours ? { hours } : {}),
    ...(players ? { players } : {}),
    ...(dungeons.length > 0 ? { dungeonChoice: { dungeons, ...(dungeonNote ? { note: dungeonNote } : {}) } } : {}),
    ...(bashMobs.length > 0 ? { bashMobs } : {}),
  };

  return { constraints, issues };
}
