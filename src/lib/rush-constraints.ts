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
 * Métiers Dofus dont l'asset existe dans `public/assets/dofus/jobs/`.
 * `joillomage` garde le nom de fichier historique (faute de frappe d'asset) : le libellé
 * affiché reste « Joaillomage ».
 */
const JOBS: ReadonlyArray<{ slug: string; name: string; aliases: string[] }> = [
  { slug: "alchimiste", name: "Alchimiste", aliases: ["alchimiste"] },
  { slug: "bijoutier", name: "Bijoutier", aliases: ["bijoutier"] },
  { slug: "bricoleur", name: "Bricoleur", aliases: ["bricoleur"] },
  { slug: "bucheron", name: "Bûcheron", aliases: ["bucheron"] },
  { slug: "chasseur", name: "Chasseur", aliases: ["chasseur"] },
  { slug: "cordomage", name: "Cordomage", aliases: ["cordomage"] },
  { slug: "cordonnier", name: "Cordonnier", aliases: ["cordonnier"] },
  { slug: "costumage", name: "Costumage", aliases: ["costumage"] },
  { slug: "eleveur", name: "Éleveur", aliases: ["eleveur"] },
  { slug: "facomage", name: "Façomage", aliases: ["facomage"] },
  { slug: "faconneur", name: "Façonneur", aliases: ["faconneur"] },
  { slug: "forgemage", name: "Forgemage", aliases: ["forgemage"] },
  { slug: "forgeron", name: "Forgeron", aliases: ["forgeron"] },
  { slug: "joillomage", name: "Joaillomage", aliases: ["joaillomage", "joillomage"] },
  { slug: "mineur", name: "Mineur", aliases: ["mineur"] },
  { slug: "paysan", name: "Paysan", aliases: ["paysan"] },
  { slug: "pecheur", name: "Pêcheur", aliases: ["pecheur"] },
  { slug: "sculptemage", name: "Sculptemage", aliases: ["sculptemage"] },
  { slug: "sculpteur", name: "Sculpteur", aliases: ["sculpteur"] },
  { slug: "tailleur", name: "Tailleur", aliases: ["tailleur"] },
];

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
      icon: kind === "job" && jobs[0] ? `/assets/dofus/jobs/${jobs[0].slug}.png` : ICONS[kind],
      jobs,
      players: kind === "players" ? parsePlayers(text) : undefined,
      hours: kind === "hours" ? parseHours(text) : undefined,
    });
  }

  return { constraints, rest: rest.join("\n") };
}
