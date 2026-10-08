/**
 * Lien vers la fiche d'un donjon — **source unique** (overlay + quêtes par
 * Dofus) : la destination dépend de la surface, jamais de la donnée.
 *
 *   · **public** (pas de guilde, ou sentinelle `"public"`) → `/boss/<slug|id>`
 *     (fiche publique, hors guilde) ;
 *   · **interne** → `/dashboard/<guildId>/succes?dungeon=<slug|id>&view=boss`
 *     (fiche boss du module).
 *
 * Le segment préfère le `slug` public quand la donnée de jeu le porte, sinon
 * l'identifiant. `null` = aucun lien (jamais d'URL inventée).
 */

export function dungeonFicheHref(
    guildId: string | null | undefined,
    dungeon: { id?: unknown; slug?: unknown } | null | undefined,
): string | null {
    const rawSlug = typeof dungeon?.slug === "string" ? dungeon.slug.trim() : "";
    const rawId = dungeon?.id === null || dungeon?.id === undefined ? "" : String(dungeon.id).trim();
    const segment = rawSlug !== "" ? rawSlug : rawId;
    if (segment === "") return null;
    const seg = encodeURIComponent(segment);
    if (!guildId || guildId === "public") return `/boss/${seg}`;
    return `/dashboard/${guildId}/succes?dungeon=${seg}&view=boss`;
}
