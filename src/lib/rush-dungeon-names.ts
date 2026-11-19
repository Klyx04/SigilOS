/**
 * **Noms de donjons du guide Rush** — règle pure, partagée par l'import God
 * (`importRushGuide`), le seed de la Trame et le script de correction des ids.
 *
 * Trois mesures du 19/11/2026 (guide `rush-sylvestre` en base, 141 séquences
 * porteuses d'un tag `donjon`) ont fixé chacun des trois cas :
 *
 *  ① **Alternatives** — un tag `donjon` peut lister plusieurs donjons séparés par
 *    « / », avec une précision après « — » (« Donjon en fonction de votre niveau »).
 *    « Les totems de Maïmane » en porte 6 (4 à 5 donjons chacun, **29 noms**).
 *  ② **Niveau dans le libellé** — le client écrit « Antre du Korriandre (niv. 180) »
 *    alors que `Dungeon.name` ne porte pas ce suffixe.
 *  ③ **Trois alias** — le libellé du client n'est pas le nôtre (table ci-dessous).
 *
 * Rien n'est deviné : un nom inconnu reste inconnu (le verrou du module est
 * fail-open, il affiche le nom sans le résoudre). Les alias sont **mesurés** — jamais
 * une similarité approximative, qui ferait entrer le mauvais donjon dans un verrou.
 */

/**
 * Plafond des donjons d'une séquence (schéma d'import, seed, fusion d'ids).
 *
 * Mesure : **29** alternatives sur « Les totems de Maïmane », la plus grande
 * séquence du guide. L'ancien plafond de **12** tronquait la liste (17 donjons
 * perdus, mesurés le 19/11/2026) ; 40 laisse une marge sans ouvrir un tableau
 * arbitraire.
 */
export const MAX_RUSH_DUNGEONS_PER_SEQUENCE = 40;

/**
 * Clé de rapprochement d'un nom de donjon : minuscules, sans accents, sans
 * séparateurs — même règle que le seed (`normKey`), pour qu'un nom du client et un
 * `Dungeon.name` se rencontrent sur la même clé.
 */
export function normalizeRushDungeonName(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Alias **mesurés** : libellé du client → `Dungeon.slug` de notre catalogue.
 *
 * | Libellé client | Notre donjon |
 * |---|---|
 * | Bibliothèque du Maître Corbac | Salle de lecture du Maître Corbac |
 * | Donjon de la mine de Sakaï | Mine abandonnée de Sakaï |
 * | Sanctuaire de Torkélonia | Torkélonia |
 *
 * Les clés sont normalisées par {@link normalizeRushDungeonName} ; le test
 * `rush-dungeon-names` vérifie que chaque libellé affiché retombe bien dessus
 * (une clé recopiée à la main ne peut pas dériver en silence).
 */
export const RUSH_DUNGEON_NAME_ALIASES: Readonly<Record<string, string>> = {
  bibliothequedumaitrecorbac: "maitre-corbac",
  donjondelaminedesakai: "grolloum",
  sanctuairedetorkelonia: "torkelonia",
};

/** Libellés affichés des alias ci-dessus — pour les tests et les rapports. */
export const RUSH_DUNGEON_ALIAS_LABELS: ReadonlyArray<{ label: string; slug: string }> = [
  { label: "Bibliothèque du Maître Corbac", slug: "maitre-corbac" },
  { label: "Donjon de la mine de Sakaï", slug: "grolloum" },
  { label: "Sanctuaire de Torkélonia", slug: "torkelonia" },
];

/** Retire le suffixe de niveau du client : « (niv. 180) », « (niv 40) », « (niveau 60) ». */
export function stripRushDungeonLevel(value: string | null | undefined): string {
  return (value ?? "")
    .replace(/\s*\((?:niv\.?|niveau)\s*\d+\)\s*$/i, "")
    .trim();
}

/**
 * Découpe un tag `donjon` en noms de donjons.
 *
 * « A / B / C — précision » → `["A", "B", "C"]` (la précision est un **libellé de
 * groupe**, jamais un nom). Un tag simple (« Antre du Korriandre (niv. 180) ») donne
 * un seul nom, niveau retiré. Les doublons sont écartés, l'ordre du client est gardé.
 */
export function splitRushDungeonTagNames(raw: string | null | undefined): string[] {
  const value = typeof raw === "string" ? raw.trim() : "";
  if (!value) return [];
  const names: string[] = [];
  for (const part of value.split(" / ")) {
    const [head] = part.trim().split(/\s+—\s+/);
    const name = stripRushDungeonLevel(head ?? "");
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

/** Slug aliasé pour un libellé client, ou `null` s'il n'y en a pas. */
export function rushDungeonAliasSlug(name: string | null | undefined): string | null {
  const key = normalizeRushDungeonName(stripRushDungeonLevel(name));
  if (!key) return null;
  return RUSH_DUNGEON_NAME_ALIASES[key] ?? null;
}

/** Index d'un catalogue de donjons, clés normalisées par {@link normalizeRushDungeonName}. */
export type RushDungeonNameLookup<T> = {
  byName: ReadonlyMap<string, T>;
  byBoss: ReadonlyMap<string, T>;
  bySlug: ReadonlyMap<string, T>;
};

/**
 * Résout un nom de donjon dans un catalogue : **nom exact**, puis **boss**, puis
 * **alias mesuré** (par slug). Le nom exact gagne toujours sur un alias.
 */
export function resolveRushDungeonByName<T>(
  name: string | null | undefined,
  lookup: RushDungeonNameLookup<T>
): T | null {
  const key = normalizeRushDungeonName(stripRushDungeonLevel(name));
  if (!key) return null;
  const direct = lookup.byName.get(key) ?? lookup.byBoss.get(key);
  if (direct !== undefined) return direct;
  const alias = RUSH_DUNGEON_NAME_ALIASES[key];
  if (!alias) return null;
  return lookup.bySlug.get(normalizeRushDungeonName(alias)) ?? null;
}

/**
 * Union d'ids de donjons : ordre existant d'abord, ajouts ensuite, sans doublon ni
 * valeur vide, bornée à {@link MAX_RUSH_DUNGEONS_PER_SEQUENCE}. Ne retire **jamais**
 * un id existant — une correction de donnée ne doit pas défaire une saisie God.
 */
export function mergeRushDungeonIds(
  existing: readonly string[] | null | undefined,
  incoming: readonly string[] | null | undefined,
  max = MAX_RUSH_DUNGEONS_PER_SEQUENCE
): string[] {
  const out: string[] = [];
  for (const raw of [...(existing ?? []), ...(incoming ?? [])]) {
    const id = typeof raw === "string" ? raw.trim() : "";
    if (!id || out.includes(id)) continue;
    out.push(id);
    if (out.length >= max) break;
  }
  return out;
}
