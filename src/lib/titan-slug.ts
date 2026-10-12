/**
 * Helpers slug du module « Titan » — module PUR (aucune dépendance serveur / prisma / auth),
 * importable côté client et côté serveur.
 */

/** Slug auto-généré depuis un nom (« Gargandyas » → « gargandyas »). */
export function slugifyName(name: string): string {
    return name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[\u2019\u2018`]/g, "'")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .replace(/-{2,}/g, "-")
        .slice(0, 150);
}
