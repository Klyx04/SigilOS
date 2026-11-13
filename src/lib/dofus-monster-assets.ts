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

/**
 * Interrupteur du **mode hybride** (rang 61, lot S2).
 *
 * Par défaut (`false`), le proxy **ne sort plus** sur Internet pour un sprite : il sert le
 * fichier siphonné, sinon le picto. C'est ce qui rend la souveraineté réelle — un sprite manquant
 * ne dépend plus d'un service tiers.
 *
 * `ASSETS_REMOTE_FETCH=true` rallume le téléchargement à la volée **sans redéployer** : c'est la
 * position à prendre le temps d'une mise à jour de contenu, puis à recouper. Volontairement
 * strict : seule la valeur exacte `true` active le réseau (`1`, `yes`, `TRUE` ne comptent pas).
 *
 * ⚠️ Ne concerne que l'**espace apparence** (`?sprite=1`). Les autres chemins du proxy (items,
 * sorts, succès, id d'entité) gardent leur comportement tant qu'ils ne sont pas siphonnés.
 */
export function isRemoteSpriteFetchEnabled(env: Record<string, string | undefined> = process.env): boolean {
  return env.ASSETS_REMOTE_FETCH === "true";
}
