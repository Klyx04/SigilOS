/**
 * Conditions d'une quête Rush — **infos de confort**, jamais des règles de blocage.
 *
 * Les contraintes Tougli (`needPlayer` 38, `job` 37, `hours` 7, `spell` 3, `note` 4) sont
 * déjà écrites en texte dans `GuideSequence.tips` par `scripts/correlate-rush-notes.ts`,
 * sous la forme `Joueurs : …` / `Métier : …` / `Horaire : …` / `Sort : …` / `Note : …`.
 * Ce parseur les relit à l'affichage pour les rendre en **infos illustrées** (icônes Dofus)
 * dans le dashboard, le guide public et l'overlay — sans colonne neuve, sans migration et
 * sans jamais conditionner la validation d'une quête.
 *
 * Position du plan (`RUSH-DEVELOPPEMENT-SUITE.md` §4) : `needPlayer` n'est **pas
 * normalisable** (« 3 x Alchimiste >80 + 3 x Paysan >40 », « 12 classes ou 120 000 kamas »).
 * On extrait donc seulement ce qui est fiable (effectif simple, fenêtre/attente, métier
 * reconnu) et **le texte reste la vérité**.
 */

import { DOFUS_CLASSES, DOFUS_JOBS, getJob } from "@/lib/dofus-assets";
import type { RushConstraintRole, RushQuestConstraints } from "@/types/rush-constraints";

export type RushConstraintKind = "players" | "job" | "hours" | "spell" | "note";

export type RushConstraintJob = { slug: string; name: string };

export type RushConstraintHours =
  | { variant: "window"; from?: string; to?: string }
  | { variant: "wait"; minutes?: number };

export type RushConstraintInfo = {
  kind: RushConstraintKind;
  /** Libellé canonique affiché (Joueurs, Métier, Horaire, Sort, Note). */
  label: string;
  /** Texte utile, préfixe retiré — rendu par `RushRichText` (liens + positions). */
  text: string;
  /** Icône Dofus réelle (chemin absolu), jamais un glyphe. */
  icon: string;
  /** Métiers reconnus dans le texte (max 3) — un asset Dofus par métier. */
  jobs: RushConstraintJob[];
  /** Effectif extrait quand la forme est simple — **jamais** une règle de blocage. */
  players?: number;
  /** Horaire structuré quand la forme est reconnue. */
  hours?: RushConstraintHours;
};

export type ParsedRushTips = {
  constraints: RushConstraintInfo[];
  /** Lignes non reconnues : rendues comme avant, en puces. */
  rest: string;
};

/** Libellés reconnus — source unique de l'aide affichée dans le studio God. */
export const RUSH_CONSTRAINT_LABELS = ["Joueurs", "Métier", "Horaire", "Sort", "Note"] as const;

const ICONS: Record<RushConstraintKind, string> = {
  players: "/assets/dofus/game-icons/party.png",
  job: "/assets/dofus/game-icons/hammer.png",
  hours: "/assets/dofus/game-icons/pin-clock.png",
  spell: "/assets/dofus/game-icons/parchment.png",
  note: "/assets/dofus/game-icons/info.png",
};

const LABELS: Record<RushConstraintKind, string> = {
  players: "Joueurs",
  job: "Métier",
  hours: "Horaire",
  spell: "Sort",
  note: "Note",
};

/**
 * Métiers Dofus — source unique `DOFUS_JOBS` (id, nom, icône réelle).
 * Les alias sont l'id et le nom normalisé ; « Joaillomage » retrouve l'id `joaillomage`
 * et son icône `jobs/joillomage.png`.
 */
const JOBS: ReadonlyArray<{ slug: string; name: string; aliases: string[] }> = Object.values(
  DOFUS_JOBS,
)
  .flat()
  .map((job) => ({ slug: job.id, name: job.name, aliases: [job.id, normalize(job.name)] }));

const LABEL_KINDS: Record<string, RushConstraintKind> = {
  joueur: "players",
  joueurs: "players",
  metier: "job",
  metiers: "job",
  horaire: "hours",
  horaires: "hours",
  sort: "spell",
  sorts: "spell",
  note: "note",
  notes: "note",
  contrainte: "note",
  contraintes: "note",
};

const FRENCH_NUMBERS: Record<string, number> = {
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

/** Minuscules sans accents — la comparaison ne dépend pas de la frappe de l'auteur. */
function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/** Effectif simple : « 4 personnes… », « 1 Joueur… », « Deux personnes… ». */
function parsePlayers(text: string): number | undefined {
  const normalized = normalize(text);
  const digit = /^(\d+)\s*(?:x\s*)?(?:joueurs?|personnes?)\b/.exec(normalized);
  if (digit) return parseInt(digit[1], 10);
  const word = /^(un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)\s+(?:joueurs?|personnes?)\b/.exec(
    normalized,
  );
  return word ? FRENCH_NUMBERS[word[1]] : undefined;
}

function hour(value: string, minutes?: string): string {
  return `${value}h${minutes ?? "00"}`;
}

/** Fenêtre (« entre 20h et 8h », « >20h ») ou attente (« 3 minutes », « auprès d'un PNJ »). */
function parseHours(text: string): RushConstraintHours | undefined {
  const normalized = normalize(text);
  const wait = /attendre\s+(?:(\d+)\s*minutes?|aupres|devant|un pn|le pn)/.exec(normalized);
  if (wait) return { variant: "wait", minutes: wait[1] ? parseInt(wait[1], 10) : undefined };

  const between = /entre\s+(\d{1,2})\s*h\s*(\d{2})?\s*et\s+(\d{1,2})\s*h\s*(\d{2})?/.exec(normalized);
  if (between) {
    return { variant: "window", from: hour(between[1], between[2]), to: hour(between[3], between[4]) };
  }

  const dash = /(\d{1,2})\s*h\s*(\d{2})?\s*[-–]\s*(\d{1,2})\s*h\s*(\d{2})?/.exec(normalized);
  if (dash) return { variant: "window", from: hour(dash[1], dash[2]), to: hour(dash[3], dash[4]) };

  const after = /^[>≥]\s*(\d{1,2})\s*h\s*(\d{2})?/.exec(normalized);
  if (after) return { variant: "window", from: hour(after[1], after[2]) };

  return undefined;
}

/** Métiers reconnus (assets réels), dans l'ordre du texte — max 3 pour ne pas surcharger. */
function parseJobs(text: string): RushConstraintJob[] {
  const normalized = normalize(text);
  const found: Array<{ job: RushConstraintJob; index: number }> = [];
  for (const job of JOBS) {
    for (const alias of job.aliases) {
      const index = normalized.search(new RegExp(`\\b${alias}\\b`));
      if (index >= 0) {
        found.push({ job: { slug: job.slug, name: job.name }, index });
        break;
      }
    }
  }
  return found
    .sort((a, b) => a.index - b.index)
    .slice(0, 3)
    .map((entry) => entry.job);
}

/**
 * Lit les lignes de `tips` et sépare les conditions des conseils libres.
 * Fonction pure : aucune écriture, aucun accès réseau, jamais bloquante.
 */
export function parseRushConstraints(raw: string | null | undefined): ParsedRushTips {
  const constraints: RushConstraintInfo[] = [];
  const rest: string[] = [];
  const seen = new Set<string>();

  for (const line of String(raw ?? "").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const match = /^(?:[-•*]\s*)?([A-Za-zÀ-ÿ]+)\s*:\s*(.+)$/.exec(trimmed);
    const kind = match ? LABEL_KINDS[normalize(match[1])] : undefined;
    if (!match || !kind) {
      rest.push(trimmed);
      continue;
    }

    const text = match[2].trim();
    if (!text) continue;

    const key = `${kind}|${text}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const jobs = kind === "job" || kind === "players" ? parseJobs(text) : [];
    constraints.push({
      kind,
      label: LABELS[kind],
      text,
      icon: kind === "job" && jobs[0] ? (getJob(jobs[0].slug)?.icon ?? ICONS.job) : ICONS[kind],
      jobs,
      players: kind === "players" ? parsePlayers(text) : undefined,
      hours: kind === "hours" ? parseHours(text) : undefined,
    });
  }

  return { constraints, rest: rest.join("\n") };
}

/** "20h00" → "20:00" (valeur d'un `<input type="time">`), avec zéro initial. */
function toTimeValue(value: string | undefined): string {
  if (!value) return "00:00";
  const [hours = "0", minutes = "00"] = value.replace("h", ":").split(":");
  return `${hours.padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

/** "20:00" → "20h00" (affichage lisible). */
function fromTimeValue(value: string): string {
  return value.replace(":", "h");
}

function roleLabel(role: RushConstraintRole): string {
  if (role.kind === "job") {
    const job = getJob(role.job);
    return `${job?.name ?? role.job}${role.level ? ` ${role.level}` : ""}`;
  }
  if (role.kind === "class") {
    const dofusClass = DOFUS_CLASSES.find((candidate) => candidate.id === role.className);
    return `${dofusClass?.name ?? role.className}${role.level ? ` ${role.level}` : ""}`;
  }
  return role.text;
}

function jobLabel(job: { job: string; level?: number }): string {
  return `${getJob(job.job)?.name ?? job.job}${job.level ? ` ${job.level}` : ""}`;
}

/**
 * Convertit les conditions **structurées** en infos d'affichage — même forme que le
 * parseur de texte, donc un seul composant de rendu pour les données neuves et les
 * anciennes. Aucune règle de blocage.
 */
export function constraintsToInfos(constraints: RushQuestConstraints): RushConstraintInfo[] {
  const infos: RushConstraintInfo[] = [];

  if (constraints.hours) {
    const hours = constraints.hours;
    if (hours.kind === "window") {
      infos.push({
        kind: "hours",
        label: LABELS.hours,
        text: hours.to
          ? `Entre ${fromTimeValue(hours.from)} et ${fromTimeValue(hours.to)}${hours.optional ? " (contournable)" : ""}`
          : `À partir de ${fromTimeValue(hours.from)}${hours.optional ? " (contournable)" : ""}`,
        icon: ICONS.hours,
        jobs: [],
        hours: {
          variant: "window",
          from: fromTimeValue(hours.from),
          to: hours.to ? fromTimeValue(hours.to) : undefined,
        },
      });
    } else {
      infos.push({
        kind: "hours",
        label: LABELS.hours,
        text: `Attendre ${hours.minutes} minute${hours.minutes > 1 ? "s" : ""}${hours.npc ? " auprès d'un PNJ" : ""}`,
        icon: ICONS.hours,
        jobs: [],
        hours: { variant: "wait", minutes: hours.minutes },
      });
    }
  }

  if (
    constraints.players &&
    (constraints.players.count !== undefined || constraints.players.roles.length > 0)
  ) {
    const roles = constraints.players.roles;
    const jobRoles = roles.filter(
      (role): role is Extract<RushConstraintRole, { kind: "job" }> => role.kind === "job",
    );
    infos.push({
      kind: "players",
      label: LABELS.players,
      text: [
        constraints.players.count !== undefined
          ? `${constraints.players.count} joueur${constraints.players.count > 1 ? "s" : ""}`
          : "Joueurs requis",
        ...roles.map(roleLabel),
      ].join(" · "),
      icon: ICONS.players,
      jobs: jobRoles.map((role) => ({
        slug: role.job,
        name: getJob(role.job)?.name ?? role.job,
      })),
      players: constraints.players.count,
    });
  }

  if (constraints.jobs.length > 0) {
    infos.push({
      kind: "job",
      label: LABELS.job,
      text: constraints.jobs.map(jobLabel).join(" · "),
      icon: getJob(constraints.jobs[0].job)?.icon ?? ICONS.job,
      jobs: constraints.jobs.map((job) => ({
        slug: job.job,
        name: getJob(job.job)?.name ?? job.job,
      })),
    });
  }

  if (constraints.spells.length > 0) {
    infos.push({
      kind: "spell",
      label: LABELS.spell,
      text: constraints.spells.join(" · "),
      icon: ICONS.spell,
      jobs: [],
    });
  }

  if (constraints.notes.length > 0) {
    infos.push({
      kind: "note",
      label: LABELS.note,
      text: constraints.notes.join(" · "),
      icon: ICONS.note,
      jobs: [],
    });
  }

  return infos;
}

/**
 * Reprise des anciennes lignes de `tips` dans le modèle structuré — sert à **préremplir**
 * l'éditeur, jamais à écrire en base sans validation. Ce qui n'est pas représentable
 * (rôles en texte libre) devient un rôle `free` ; le texte reste visible.
 */
export function constraintsFromLegacyTips(tips: string | null | undefined): RushQuestConstraints {
  const result: RushQuestConstraints = { version: 1, jobs: [], spells: [], notes: [] };
  for (const info of parseRushConstraints(tips).constraints) {
    if (info.kind === "hours" && info.hours) {
      result.hours =
        info.hours.variant === "wait"
          ? { kind: "wait", minutes: info.hours.minutes ?? 1, npc: /pnj/i.test(info.text) }
          : {
              kind: "window",
              from: toTimeValue(info.hours.from),
              ...(info.hours.to ? { to: toTimeValue(info.hours.to) } : {}),
              ...(/contournable/i.test(info.text) ? { optional: true } : {}),
            };
    } else if (info.kind === "players") {
      const roles: RushConstraintRole[] = info.jobs.map((job) => ({ kind: "job", job: job.slug }));
      if (roles.length === 0) {
        // On retire l'effectif du texte libre : le badge « 4 joueurs » le porte déjà.
        const freeText = info.text
          .replace(
            /^(?:\d+|un|une|deux|trois|quatre|cinq|six|sept|huit|neuf|dix|onze|douze)\s*(?:x\s*)?(?:joueurs?|personnes?)\s*/i,
            "",
          )
          .trim();
        roles.push({ kind: "free", text: freeText || info.text });
      }
      result.players = {
        ...(info.players !== undefined ? { count: info.players } : {}),
        roles,
      };
    } else if (info.kind === "job") {
      result.jobs = info.jobs.map((job) => ({ job: job.slug }));
    } else if (info.kind === "spell") {
      result.spells.push(info.text);
    } else if (info.kind === "note") {
      result.notes.push(info.text);
    }
  }
  return result;
}

/** Vrai si aucune condition n'est saisie — la section est alors masquable. */
export function isEmptyConstraints(
  constraints: RushQuestConstraints | null | undefined,
): boolean {
  if (!constraints) return true;
  return (
    !constraints.hours &&
    !(
      constraints.players &&
      (constraints.players.count !== undefined || constraints.players.roles.length > 0)
    ) &&
    constraints.jobs.length === 0 &&
    constraints.spells.length === 0 &&
    constraints.notes.length === 0
  );
}

/**
 * Retire les lignes **vides** de l'éditeur (rôle libre, sort, note) avant l'aperçu et
 * l'enregistrement. Les sélecteurs (métier, classe) sont toujours renseignés ; seules les
 * saisies libres peuvent être vides. Une forme vidée à la main est donc valide.
 */
export function sanitizeConstraints(constraints: RushQuestConstraints): RushQuestConstraints {
  const players = constraints.players
    ? {
        ...constraints.players,
        roles: constraints.players.roles.filter(
          (role) => role.kind !== "free" || role.text.trim() !== "",
        ),
      }
    : null;

  return {
    ...constraints,
    players:
      players && (players.count !== undefined || players.roles.length > 0) ? players : null,
    spells: constraints.spells.map((spell) => spell.trim()).filter(Boolean),
    notes: constraints.notes.map((note) => note.trim()).filter(Boolean),
  };
}
