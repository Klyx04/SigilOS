/**
 * URL de la carte HD d'une position Rush — règle **pure** et **partagée**.
 *
 * Le monde ne vit PAS dans le texte `[x,y]` : il est porté à côté par le tag
 * `pos_tags.worldId` (mesure du 22/11/2026 : 527 positions, dont **112** tombent sur
 * une case présente dans **plusieurs mondes**). Sans `&world`, `/api/rush/map-at`
 * peut rendre la carte d'un autre monde : l'appelant doit donc transmettre le monde
 * résolu, et cette fonction est le **seul** endroit qui construit l'URL.
 *
 * La carte imposée en God (`pos_tags.mapId`) est prioritaire côté route, mais elle
 * ne remplace pas le monde : on transmet les deux, la route tranche.
 */
export function buildRushMapAtUrl({
  x,
  y,
  worldId = null,
  mapId = null,
}: {
  x: number;
  y: number;
  /** Monde du `pos_tags` (`worldId`) — jamais deviné depuis `[x,y]`. */
  worldId?: number | null;
  /** Carte HD imposée en God (`pos_tags.mapId`). */
  mapId?: number | null;
}): string {
  const params = new URLSearchParams({ x: String(x), y: String(y) });
  if (typeof worldId === "number" && Number.isSafeInteger(worldId) && worldId > 0) {
    params.set("world", String(worldId));
  }
  if (
    typeof mapId === "number" &&
    Number.isSafeInteger(mapId) &&
    mapId > 0 &&
    mapId <= 2147483647
  ) {
    params.set("mapId", String(mapId));
  }
  return `/api/rush/map-at?${params.toString()}`;
}
