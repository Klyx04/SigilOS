/**
 * Règles pures du **slug public d'une quête Rush** (bloc B, 12/11/2026).
 *
 * 🎯 Le slug est **figé à la publication** : il n'est jamais recalculé depuis le nom,
 * sinon un renommage dans le studio casserait une URL déjà indexée. Ces fonctions
 * ne servent donc qu'à la **première** publication ; ensuite, la valeur en base fait
 * foi.
 *
 * Le slug vit sur `GuideSequence.publicSlug` (unique global). Deux quêtes peuvent
 * porter le même nom dans deux blocs : `uniqueRushPublicSlug` suffixe `-2`, `-3`…
 * au lieu d'écraser.
 */

/** Longueur maximale d'un slug : assez pour un titre de quête, borné pour l'URL. */
export const RUSH_PUBLIC_SLUG_MAX = 80;

/**
 * Transforme un nom de quête en slug d'URL : minuscules, sans accents, séparateurs
 * `-`. Un nom vide ou 100 % ponctuation donne `quete` (jamais un slug vide).
 */
export function slugifyRushQuestName(name: string): string {
  const base = (name ?? "")
    .replace(/œ/gi, "oe")
    .replace(/æ/gi, "ae")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, RUSH_PUBLIC_SLUG_MAX)
    .replace(/-+$/g, "");
  return base || "quete";
}

/**
 * Rend un slug unique face aux slugs déjà pris. Le premier garde son nom, les
 * suivants reçoivent `-2`, `-3`… ; au-delà de 999 collisions, on refuse plutôt
 * que de boucler (fail-closed).
 */
export function uniqueRushPublicSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let index = 2; index <= 999; index += 1) {
    const candidate = `${base}-${index}`;
    if (!taken.has(candidate)) return candidate;
  }
  throw new Error("Trop de collisions de slug public");
}
