/**
 * Assets **monstres** — règles pures du siphon hors ligne (souveraineté des visuels).
 *
 * Mesure du 09/11/2026 : le proxy `/api/assets-dofus` télécharge encore chez l'amont **à la
 * demande**. Tant que ce cache n'est pas rempli, une image dépend d'un service qu'on ne
 * maîtrise pas (et une panne de téléchargement = picto générique).
 *
 * ⚠️ Deux espaces d'identifiants, jamais interchangeables (mesure du 12/10/2026) :
 *   • `img/monsters/<n>.png` porte un **gfxId** (apparence) → fichier `<gfx>.sprite.webp` ;
 *   • l'id d'**entité** (colonne `dofusdbId`) → fichier `<id>.webp`.
 * Ce module ne traite que l'**espace apparence**, celui que le proxy sert pour `?sprite=1`.
 */

/** `https://api.dofusdb.fr/img/monsters/646.png` → `"646"` ; `null` si l'URL n'est pas un sprite. */
export function gfxIdFromDofusDbImageUrl(raw: string | null | undefined): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  // Uniquement le dossier des monstres : une icône d'objet ou de sort n'a rien à faire ici.
  const match = value.match(/\/img\/monsters\/(\d{1,12})\.(?:png|webp|jpg|jpeg)(?:\?.*)?$/i);
  return match ? match[1] : null;
}

/** Nom de fichier **de l'espace apparence** — celui que lit le proxy pour `?sprite=1`. */
export function spriteAssetFileName(gfxId: string | number): string {
  return `${String(gfxId).trim()}.sprite.webp`;
}

/** URL interne qui **sert** ce sprite (chemin déjà en cache, ou téléchargement proxy). */
export function spriteAssetUrl(gfxId: string | number): string {
  const id = String(gfxId).trim();
  return `/api/assets-dofus/monsters/${id}?url=${encodeURIComponent(
    `https://api.dofusdb.fr/img/monsters/${id}.png`
  )}&sprite=1`;
}

/**
 * Taille minimale d'un WebP **valide**.
 *
 * ⚠️ Mesure du 09/11/2026 : le placeholder du proxy (PNG 1×1 transparent) pèse **118 octets**.
 * Un seuil à 100 le prendrait pour une vignette déjà siphonnée et le siphon ne remplirait
 * jamais le cache. 500 laisse passer toute vraie image (4–20 Ko) et rejette le placeholder.
 */
export const MIN_SPRITE_BYTES = 500;
