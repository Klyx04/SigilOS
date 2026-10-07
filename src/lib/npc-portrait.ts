/**
 * Portrait d'un PNJ — règle **pure** (aucun IO, testée unitairement).
 *
 * Constat (client Beta 3.7.3.3, 07/10/2026) : DofusDB `/npcs` ne sert ni image
 * ni position, et le client n'a aucun PNG statique (les dialogues rendent le
 * modèle 3D en direct). Les portraits sont donc posés **par convention** en
 * fichiers statiques (`public/game-data/npcs/<npcId>.png`, rendus 3D siphonnés
 * en local) : présent ⇒ affiché, absent ⇒ repli nom seul (jamais d'image cassée).
 */

export interface NpcRef {
    id: number | null;
    name: string | null;
    /** Image importée en God (prioritaire sur la convention dans `NpcBadge`). */
    imageUrl: string | null;
}

/** Chemin du portrait siphonné — `null` si l'id n'est pas exploitable. */
export function npcPortraitUrl(npcId: unknown): string | null {
    const id = Math.floor(Number(npcId));
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    return `/game-data/npcs/${id}.png`;
}

/**
 * Référence PNJ d'une entrée de quête (champs God : `npcName` + `npcId` et
 * `npcImageUrl` glissés dans `requirements`, sans migration —
 * `requirements: z.any()`).
 */
export function extractNpcRef(
    entry: { npcName?: unknown; requirements?: unknown } | null | undefined,
): NpcRef {
    const name = typeof entry?.npcName === "string" && entry.npcName.trim() !== ""
        ? entry.npcName.trim()
        : null;
    const req = entry?.requirements as { npcId?: unknown; npcImageUrl?: unknown } | null | undefined;
    const fromId = Math.floor(Number(req?.npcId));
    const id = Number.isSafeInteger(fromId) && fromId > 0 ? fromId : null;
    const imageUrl = typeof req?.npcImageUrl === "string" && req.npcImageUrl.trim() !== ""
        ? req.npcImageUrl.trim()
        : null;
    return { id, name, imageUrl };
}
