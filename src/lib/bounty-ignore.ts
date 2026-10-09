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
 *
 * 🔶 08/10/2026 — une entrée **sans id mais avec un nom** (`dofusdbId: 0`) est CONSERVÉE :
 * c'est le cas d'une ligne historique (`dofusdbId` nul en base) supprimée dans God — sans
 * cela, aucune exclusion n'était enregistrée et le siphon recréait l'avis à la passe
 * suivante. Le siphon filtre sur l'id **ou** le nom normalisé (voir `isIgnoredBountyName`).
 */
export function normalizeIgnoredBounties(entries: unknown): IgnoredBountyEntry[] {
    const byKey = new Map<string, IgnoredBountyEntry>();
    for (const raw of Array.isArray(entries) ? entries : []) {
        const item = raw !== null && typeof raw === "object" ? (raw as any) : null;
        const id = Math.floor(Number(item ? (item.dofusdbId ?? item.id) : raw) || 0);
        const name = item?.name != null ? String(item.name).trim() || null : null;
        if (id <= 0 && !name) continue;
        // Clé de dédoublonnage : l'id quand il existe, sinon le nom normalisé (deux
        // exclusions sans id ne doivent jamais se cannibaliser).
        const key = id > 0 ? `id:${id}` : `name:${normalizeBountyName(name ?? "")}`;
        const previous = byKey.get(key);
        byKey.set(key, {
            dofusdbId: id > 0 ? id : 0,
            name: name ?? previous?.name ?? null,
            deletedAt: item?.deletedAt != null ? String(item.deletedAt) : (previous?.deletedAt ?? null),
        });
    }
    return [...byKey.values()].sort((a, b) => a.dofusdbId - b.dofusdbId);
}

/** Normalisation d'un nom d'avis pour la comparaison (casse + espaces). */
export function normalizeBountyName(name: string | null | undefined): string {
    return String(name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
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
    return getIgnoredBounties().map((e) => e.dofusdbId).filter((id) => id > 0);
}

/** Noms des avis exclus, normalisés (second filtre du siphon : couvre les lignes sans id). */
export function getIgnoredBountyNames(): string[] {
    return getIgnoredBounties()
        .map((e) => normalizeBountyName(e.name))
        .filter((n) => n.length > 0);
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
    const cleanName = name != null ? String(name).trim() || null : null;
    // 🔶 Un avis sans id (ligne historique) s'exclut PAR SON NOM (`dofusdbId: 0`) : sans
    // cela, la suppression n'enregistrait rien et le siphon recréait l'avis. Voir
    // `normalizeIgnoredBounties` + `isIgnoredBountyName`.
    if (id <= 0 && !cleanName) return getIgnoredBounties();
    const keyId = id > 0 ? id : 0;
    const current = getIgnoredBounties().filter((e) =>
        keyId > 0 ? e.dofusdbId !== keyId : normalizeBountyName(e.name) !== normalizeBountyName(cleanName),
    );
    return writeIgnoredBounties([
        ...current,
        { dofusdbId: keyId, name: cleanName, deletedAt: new Date().toISOString() },
    ]);
}

/** Réintègre un avis (le prochain siphon le recrée) — retourne la liste restante. */
export function removeIgnoredBounty(dofusdbId: number, name?: string | null): IgnoredBountyEntry[] {
    const id = Math.floor(Number(dofusdbId) || 0);
    if (id > 0) {
        return writeIgnoredBounties(getIgnoredBounties().filter((e) => e.dofusdbId !== id));
    }
    // Exclusion par nom seul (`dofusdbId: 0`) : on la retire par le nom normalisé.
    const target = normalizeBountyName(name);
    if (!target) return getIgnoredBounties();
    return writeIgnoredBounties(
        getIgnoredBounties().filter((e) => !(e.dofusdbId === 0 && normalizeBountyName(e.name) === target)),
    );
}

/** Un avis est-il exclu ? (`ignored` peut être fourni pour éviter une relecture disque.) */
export function isIgnoredBounty(dofusdbId: number | null | undefined, ignored?: number[]): boolean {
    const id = Math.floor(Number(dofusdbId) || 0);
    if (id <= 0) return false;
    return (ignored ?? getIgnoredBountyIds()).includes(id);
}

/**
 * Un avis est-il exclu **par son nom** ? (`ignoredNames` = `getIgnoredBountyNames()`.)
 * Couvre les exclusions sans id (lignes historiques) : deux monstres homonymes partagent
 * un nom mais jamais un id — le filtre par id reste prioritaire dans le siphon.
 */
export function isIgnoredBountyName(name: string | null | undefined, ignoredNames?: string[]): boolean {
    const target = normalizeBountyName(name);
    if (!target) return false;
    return (ignoredNames ?? getIgnoredBountyNames()).includes(target);
}
