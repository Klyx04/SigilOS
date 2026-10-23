/**
 * Brouillon **local** d'une variante de stuff (avant ou sans publication).
 *
 * Pourquoi (constat user du 23/10/2026) : « dès qu'on quitte la modale on perd la variante ».
 * Tant qu'un build n'est pas publié (`dofusBookLinks[].variants`), ou quand l'appel serveur échoue,
 * la variante doit **survivre** à la fermeture de la fiche et au rechargement de la page.
 *
 * Le stockage local est une **entrée non fiable** : elle est relue via `normalizeSavedVariants`
 * (slots connus, bornes, valeurs) — une entrée corrompue est ignorée, jamais propagée.
 */

import { normalizeSavedVariants, type SavedVariant } from "@/lib/dofus-variant-utils";

const STORAGE_PREFIX = "sigilos_build_variant:";

function storageKey(buildId: string): string {
    return `${STORAGE_PREFIX}${buildId}`;
}

function hasWindow(): boolean {
    return typeof window !== "undefined" && !!window.localStorage;
}

/** Lit le brouillon local d'un build (assaini). `{}` si absent ou illisible. */
export function readLocalVariant(buildId: string | null | undefined): SavedVariant {
    if (!buildId || !hasWindow()) return {};
    try {
        const raw = window.localStorage.getItem(storageKey(buildId));
        if (!raw) return {};
        return normalizeSavedVariants(JSON.parse(raw));
    } catch {
        return {};
    }
}

/** Écrit le brouillon local (silencieux : quota plein ou mode privé ⇒ on n'échoue pas). */
export function writeLocalVariant(buildId: string | null | undefined, variants: SavedVariant | null | undefined): void {
    if (!buildId || !hasWindow()) return;
    try {
        const clean = normalizeSavedVariants(variants);
        if (Object.keys(clean).length === 0) {
            window.localStorage.removeItem(storageKey(buildId));
            return;
        }
        window.localStorage.setItem(storageKey(buildId), JSON.stringify(clean));
    } catch {
        // Stockage indisponible : l'état mémoire reste la seule source jusqu'au prochain rendu.
    }
}

/** Supprime le brouillon local (après publication réussie). */
export function clearLocalVariant(buildId: string | null | undefined): void {
    if (!buildId || !hasWindow()) return;
    try {
        window.localStorage.removeItem(storageKey(buildId));
    } catch {
        // Ignorer
    }
}

/** Clé utilisée (exportée pour les tests — jamais construite ailleurs). */
export function variantStorageKey(buildId: string): string {
    return storageKey(buildId);
}
