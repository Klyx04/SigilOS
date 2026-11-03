/**
 * Fusion des objets d'une quête (`activityTags.type = "item"`) — **additive, jamais destructive**.
 *
 * Mesure du 04/11/2026 : la série Brâkmarien a été importée avec **115 séquences sur 121 sans
 * aucun tag** (ni objet, ni donjon, ni position), alors que la trame
 * (`src/temp/trame-rush/data.json`) porte les objets **par quête** (`id`, `name`, `count`).
 *
 * Ce module ne fait qu'**ajouter** les objets absents : il ne remplace ni ne supprime un tag
 * existant (le studio God peut avoir corrigé un nom ou une quantité — on ne l'écrase jamais).
 *
 * ⚠️ La clé d'agrégation (`rushResourceKey`) vaut `id + nom normalisé` : un même id ajouté sous un
 * autre nom créerait une **seconde** ligne (totaux et coches séparés). D'où `canonicalNames` :
 * pour un id déjà présent dans le guide, on réutilise le nom déjà affiché.
 */

export type RushTagLike = {
  type?: string | null;
  id?: string | number | null;
  name?: string | null;
  count?: number | null;
  [key: string]: unknown;
};

export type RushIncomingItem = {
  id?: string | number | null;
  name?: string | null;
  count?: number | null;
};

/** Tag produit — même forme que les tags existants (`id` numérique, `count` entier). */
export type RushItemTag = { type: "item"; id: number; name: string; count: number };

export type MergeItemTagsOptions = {
  /** Nom **canonique** par id (déjà affiché par le guide) — garde la clé `id|nom` stable. */
  canonicalNames?: ReadonlyMap<string, string>;
  /** Borne le nombre de tags d'une séquence : les tags existants ne sont jamais retirés. */
  maxTags?: number;
};

export type MergeItemTagsResult = {
  tags: RushTagLike[];
  /** Tags réellement ajoutés (vide au 2ᵉ passage : la fusion est idempotente). */
  added: RushItemTag[];
  /** Entrées ignorées : id absent/invalide, nom vide, ou borne atteinte. */
  skipped: number;
};

const DEFAULT_MAX_TAGS = 80;

/** Id DofusDB exploitable : entier strictement positif. Tout le reste est ignoré. */
export function rushItemId(value: string | number | null | undefined): number | null {
  const raw = typeof value === "number" ? value : Number(String(value ?? "").trim());
  return Number.isSafeInteger(raw) && raw > 0 ? raw : null;
}

/**
 * Ajoute les `incoming` absents aux tags `item` de `existing`.
 *
 * - un id **déjà présent** n'est jamais réécrit (quantité et nom d'origine conservés) ;
 * - un id inconnu prend le nom de `canonicalNames` s'il existe, sinon le nom d'entrée ;
 * - `count` non fini ou ≤ 0 ⇒ **1** ;
 * - `maxTags` borne la liste **sans jamais retirer** un tag existant ;
 * - l'ordre d'origine est conservé, les ajouts vont à la fin.
 */
export function mergeItemTags(
  existing: readonly RushTagLike[] | null | undefined,
  incoming: readonly RushIncomingItem[] | null | undefined,
  options: MergeItemTagsOptions = {},
): MergeItemTagsResult {
  const tags = [...(existing ?? [])];
  const maxTags = Math.max(1, Math.trunc(options.maxTags ?? DEFAULT_MAX_TAGS));

  const seen = new Set<number>();
  for (const tag of tags) {
    if (tag?.type !== "item") continue;
    const id = rushItemId(tag.id);
    if (id !== null) seen.add(id);
  }

  const added: RushItemTag[] = [];
  let skipped = 0;

  for (const item of incoming ?? []) {
    const id = rushItemId(item?.id);
    if (id === null) {
      skipped += 1;
      continue;
    }
    // Déjà là (sous le nom que le guide affiche) : on ne touche à rien.
    if (seen.has(id)) continue;
    if (tags.length >= maxTags) {
      skipped += 1;
      continue;
    }
    const name = String(options.canonicalNames?.get(String(id)) ?? item?.name ?? "").trim();
    if (!name) {
      skipped += 1;
      continue;
    }
    const rawCount = Number(item?.count);
    const count = Number.isFinite(rawCount) && rawCount > 0 ? Math.trunc(rawCount) : 1;
    const tag: RushItemTag = { type: "item", id, name, count };
    tags.push(tag);
    added.push(tag);
    seen.add(id);
  }

  return { tags, added, skipped };
}
