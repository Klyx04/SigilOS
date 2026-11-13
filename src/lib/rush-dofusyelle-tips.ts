/**
 * Corrélation des astuces Dofusyelle → quêtes du guide Rush — règle pure, réutilisable.
 *
 * Mesure du 03/11/2026 : le guide Dofusyelle (`window.RUSH_DATA`) porte **9 astuces d'étape**,
 * dont 8 citent une quête entre guillemets (« Un sombre pouvoir », « Si j'avais un marteau. »…).
 * Les **8/8** existent dans notre dataset — la corrélation par nom est donc fiable, sans
 * approximation. Les notes de donjon, elles, citent des **numéros** (« Ali 55 », « Ordre 3 ») :
 * elles ne sont pas rattachées ici, la numérotation des blocs n'étant pas assez sûre (plages
 * chevauchantes) — elles restent dans le rapport, à trancher à l'écran.
 *
 * ⚠️ Décision éditoriale du propriétaire (03/11/2026) : le texte est importé **tel quel**, il le
 * reformulera ensuite. La règle ne décide donc que du **rattachement**, jamais du contenu.
 */

export type DofusyelleStep = { n?: number; title?: string; aide?: string };
export type DofusyelleData = { steps?: DofusyelleStep[] };

/**
 * Clé de comparaison d'un nom de quête : suffixe `[brakmarien]` retiré, accents et ponctuation
 * neutralisés, casse ignorée. C'est la même clé pour le dataset et pour l'astuce Dofusyelle.
 */
export function normalizeQuestKey(name: string | null | undefined): string {
  return String(name ?? "")
    .replace(/\s*\[[^\]]*\]\s*$/, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** Titres de quêtes cités entre guillemets — droits (`"`) et typographiques (`“ ”`). */
export function quotedQuestTitles(text: string | null | undefined): string[] {
  if (typeof text !== "string" || !text) return [];
  const titles: string[] = [];
  for (const match of text.matchAll(/["“]([^"”]{3,60})["”]/g)) titles.push(match[1].trim());
  return titles;
}

export type DofusyelleAidMatch = {
  /** Nom tel qu'écrit par Dofusyelle (sert de preuve à l'écran). */
  questTitle: string;
  /** Ligne de l'astuce qui concerne CETTE quête (l'astuce d'étape peut en couvrir plusieurs). */
  text: string;
  step?: number;
  stepTitle?: string;
};

/**
 * Une astuce d'étape couvre souvent plusieurs quêtes (une par ligne). On ne garde que la ligne
 * qui cite la quête demandée — sinon chaque quête recevrait les consignes des autres.
 */
export function aidLineFor(questTitle: string | null | undefined, text: string): string {
  const key = normalizeQuestKey(questTitle);
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const line = lines.find((candidate) =>
    quotedQuestTitles(candidate).some((title) => normalizeQuestKey(title) === key),
  );
  return line ?? text.trim();
}

/**
 * Astuces dont la quête citée existe dans la liste fournie (noms normalisés).
 * Une astuce peut citer plusieurs quêtes : elle produit alors une correspondance par quête.
 */
export function matchAidsByQuestName(
  data: DofusyelleData | null | undefined,
  questTitles: Iterable<string>,
): DofusyelleAidMatch[] {
  const known = new Set<string>();
  for (const title of questTitles) known.add(normalizeQuestKey(title));
  const matches: DofusyelleAidMatch[] = [];
  for (const step of data?.steps ?? []) {
    const aide = String(step?.aide ?? "").trim();
    if (!aide) continue;
    for (const title of quotedQuestTitles(aide)) {
      if (!known.has(normalizeQuestKey(title))) continue;
      matches.push({
        questTitle: title,
        text: aidLineFor(title, aide),
        step: step.n,
        stepTitle: step.title,
      });
    }
  }
  return matches;
}

/** Références d'alignement d'une note de donjon : « Ali 55 » → { camp: "ali", number: 55 }. */
export type AlignmentRef = { camp: "ali" | "ordre"; number: number };

export function alignmentRefs(text: string | null | undefined): AlignmentRef[] {
  if (typeof text !== "string" || !text) return [];
  const refs: AlignmentRef[] = [];
  for (const match of text.matchAll(/\b(ali|ordre)\s*(\d{1,3})\b/gi)) {
    const number = Number(match[2]);
    if (Number.isFinite(number) && number > 0) {
      refs.push({ camp: match[1].toLowerCase() as AlignmentRef["camp"], number });
    }
  }
  return refs;
}
