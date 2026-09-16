/**
 * Exclusions d'avis de recherche (God) — « supprimer un avis » doit être **PERSISTANT**.
 *
 * Le siphon recrée tout ce qu'il trouve dans les 5 races DofusDB : une suppression en base serait
 * annulée à la passe suivante. On tient donc une **liste d'exclusion** sur disque
 * (`public/game-data/ignored-bounties.json`, même esprit que `ignored-monsters.json`), **lue par le
 * siphon** (les avis exclus ne sont ni réécrits ni recréés) et **écrite par les actions God**
 * (supprimer / restaurer).
 *
 * Module **serveur uniquement** (accès disque) : ne jamais l'importer depuis un composant client.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { logger } from "@/lib/logger";

/** Emplacement du fichier d'exclusion (relatif au `cwd`, comme les autres datasets de jeu). */
export const IGNORED_BOUNTIES_PATH = join(process.cwd(), "public", "game-data", "ignored-bounties.json");

/** Une exclusion : l'id Ankama/DofusDB (+ nom et date, pour l'affichage God et la restauration). */
export interface IgnoredBountyEntry {
    dofusdbId: number;
    name: string | null;
    deletedAt: string | null;
}

export interface IgnoredBountiesFile {
    entries: IgnoredBountyEntry[];
    updatedAt: string | null;
}

/**
 * Parse **tolérant** : accepte le format courant (`{ entries: [...] }`) **et** un ancien format
 * simple (`{ dofusdbIds: [...] }` ou `[1, 2, 3]`). Fichier absent/corrompu ⇒ liste vide.
 */
export function parseIgnoredBounties(content: string | null | undefined): IgnoredBountyEntry[] {
    if (!content) return [];
    try {
        const raw = JSON.parse(content) as IgnoredBountiesFile | { dofusdbIds?: unknown } | unknown[];
        const source = Array.isArray(raw)
            ? raw
            : Array.isArray((raw as IgnoredBountiesFile)?.entries)
                ? (raw as IgnoredBountiesFile).entries
                : (raw as { dofusdbIds?: unknown })?.dofusdbIds;
        return normalizeIgnoredBounties(source);
    } catch {
        return [];
    }
}

/**
 * Normalise des entrées d'exclusion : accepte des objets `{ dofusdbId, name, deletedAt }` **ou**
 * des ids nus. Dédoublonné par id (le dernier nom connu gagne), trié par id.
 */
export function normalizeIgnoredBounties(entries: unknown): IgnoredBountyEntry[] {
    const byId = new Map<number, IgnoredBountyEntry>();
    for (const raw of Array.isArray(entries) ? entries : []) {
        const item = raw !== null && typeof raw === "object" ? (raw as any) : null;
        const id = Math.floor(Number(item ? (item.dofusdbId ?? item.id) : raw) || 0);
        if (id <= 0) continue;
        const name = item?.name != null ? String(item.name).trim() || null : null;
        const deletedAt = item?.deletedAt != null ? String(item.deletedAt) : null;
        const previous = byId.get(id);
        byId.set(id, {
            dofusdbId: id,
            name: name ?? previous?.name ?? null,
            deletedAt: deletedAt ?? previous?.deletedAt ?? null,
        });
    }
    return [...byId.values()].sort((a, b) => a.dofusdbId - b.dofusdbId);
}

/** Sérialise la liste d'exclusion (fichier lisible et versionnable, comme les autres datasets). */
export function serializeIgnoredBounties(entries: unknown, updatedAt?: Date | string | null): string {
    const date = updatedAt instanceof Date ? updatedAt : updatedAt ? new Date(updatedAt) : new Date();
    const payload: IgnoredBountiesFile = {
        entries: normalizeIgnoredBounties(entries),
        updatedAt: Number.isNaN(date.getTime()) ? null : date.toISOString(),
    };
    return `${JSON.stringify(payload, null, 2)}\n`;
}

/** Lit les exclusions (fichier absent ⇒ liste vide). */
export function getIgnoredBounties(): IgnoredBountyEntry[] {
    try {
        if (!existsSync(IGNORED_BOUNTIES_PATH)) return [];
        return parseIgnoredBounties(readFileSync(IGNORED_BOUNTIES_PATH, "utf8"));
    } catch (error) {
        logger.warn("[bounty-ignore] lecture impossible:", { error: String(error) });
        return [];
    }
}

/** Ids des avis exclus (forme la plus utilisée : filtre du siphon). */
export function getIgnoredBountyIds(): number[] {
    return getIgnoredBounties().map((e) => e.dofusdbId);
}

/** Écrit la liste d'exclusion (retourne les entrées normalisées écrites). */
function writeIgnoredBounties(entries: unknown): IgnoredBountyEntry[] {
    const normalized = normalizeIgnoredBounties(entries);
    try {
        writeFileSync(IGNORED_BOUNTIES_PATH, serializeIgnoredBounties(normalized), "utf8");
    } catch (error) {
        logger.error("[bounty-ignore] écriture impossible:", { error: String(error) });
    }
    return normalized;
}

/** Exclut un avis (idempotent) — `name` sert uniquement à l'affichage dans God. */
export function addIgnoredBounty(dofusdbId: number, name?: string | null): IgnoredBountyEntry[] {
    const id = Math.floor(Number(dofusdbId) || 0);
    if (id <= 0) return getIgnoredBounties();
    const current = getIgnoredBounties().filter((e) => e.dofusdbId !== id);
    return writeIgnoredBounties([
        ...current,
        { dofusdbId: id, name: name != null ? String(name).trim() || null : null, deletedAt: new Date().toISOString() },
    ]);
}

/** Réintègre un avis (le prochain siphon le recrée) — retourne la liste restante. */
export function removeIgnoredBounty(dofusdbId: number): IgnoredBountyEntry[] {
    const id = Math.floor(Number(dofusdbId) || 0);
    return writeIgnoredBounties(getIgnoredBounties().filter((e) => e.dofusdbId !== id));
}

/** Un avis est-il exclu ? (`ignored` peut être fourni pour éviter une relecture disque.) */
export function isIgnoredBounty(dofusdbId: number | null | undefined, ignored?: number[]): boolean {
    const id = Math.floor(Number(dofusdbId) || 0);
    if (id <= 0) return false;
    return (ignored ?? getIgnoredBountyIds()).includes(id);
}
