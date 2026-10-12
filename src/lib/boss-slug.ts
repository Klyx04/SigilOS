/**
 * Slug d'URL des fiches boss (`/boss/<slug>`) — module PUR (aucune dépendance
 * serveur / prisma / auth) : importable côté client, serveur et tests.
 *
 * ⚠️ Le même algorithme est écrit en SQL dans
 * `prisma/migrations/20260919130000_add_dungeon_slug/migration.sql` (backfill des
 * donjons existants). Les deux doivent rester alignés : accents français dépliés,
 * tout caractère non alphanumérique → « - », tirets compactés puis rognés.
 * Un test verrouille les cas piégeux (apostrophes, parenthèses, accents).
 */

/** Segment d'URL d'un nom de boss (« Mob l'Éponge » → « mob-l-eponge »). */
export function slugifyBossName(name: string): string {
    return String(name ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 150);
}

/**
 * Repli d'affichage : un nom vide ou 100 % non alphanumérique ne doit pas
 * produire d'URL vide ni de canonique bancal.
 */
export function bossSlugWithFallback(name: string, fallback = "boss"): string {
    return slugifyBossName(name) || fallback;
}

/** Segment d'URL « canonique » d'une fiche : slug en base, sinon identifiant. */
export function bossUrlSegment(row: { slug?: string | null; id: string }): string {
    return String(row.slug ?? "").trim() || row.id;
}
