/**
 * Listes d'exclusion game-data — **source de vérité UNIQUE** (fichiers JSON).
 *
 * Extraites de `src/server/actions/game-data-actions.ts` (22/09/2026) pour que les
 * **cœurs de siphon `src/lib`** (appelés par la file/le worker, sans session Next)
 * filtrent EXACTEMENT comme les boutons du dashboard. Sans ça, un siphon lancé en
 * arrière-plan recréerait ce qu'un God a supprimé (une suppression ne doit jamais
 * être annulée par le cron — règle déjà posée pour les avis de recherche).
 *
 * Lecture seule ici : les écritures restent dans les actions God (avec audit).
 */
import * as fs from "fs";
import * as path from "path";

export const IGNORED_FAMILIES_PATH = path.join(process.cwd(), "public", "game-data", "ignored-families.json");
export const IGNORED_ZONES_PATH = path.join(process.cwd(), "public", "game-data", "ignored-zones.json");
export const IGNORED_DUNGEONS_PATH = path.join(process.cwd(), "public", "game-data", "ignored-dungeons.json");
export const IGNORED_CHALLENGES_PATH = path.join(process.cwd(), "public", "game-data", "ignored-challenges.json");

/** Familles jamais siphonnées (bruit structurel de DofusDB, pas des monstres jouables). */
export const DEFAULT_IGNORED_FAMILY_PATTERNS = [
    "archimonstres",
    "archimonstre",
    "monstres de quête",
    "monstres de quetes",
    "alignement",
    "avis de recherche",
    "monstre d'alignement",
    "pnj",
    "invocation",
    "garde",
    "protecteur",
    "tutorial",
    "tutoriel",
];

function readNamesFile(filePath: string): string[] {
    try {
        if (fs.existsSync(filePath)) {
            const raw = fs.readFileSync(filePath, "utf-8");
            const data = JSON.parse(raw);
            return Array.isArray(data.names) ? data.names : [];
        }
    } catch {
        // fail-open : une liste illisible ne doit pas bloquer un siphon
    }
    return [];
}

export function getIgnoredFamilies(): string[] {
    return readNamesFile(IGNORED_FAMILIES_PATH);
}

export function getIgnoredZones(): string[] {
    return readNamesFile(IGNORED_ZONES_PATH);
}

export function isIgnoredFamily(name?: string | null): boolean {
    if (!name) return false;
    const lower = name.trim().toLowerCase();
    if (DEFAULT_IGNORED_FAMILY_PATTERNS.some((pat) => lower.includes(pat))) return true;
    return getIgnoredFamilies().includes(lower);
}

export function isIgnoredZone(name?: string | null): boolean {
    if (!name) return false;
    return getIgnoredZones().includes(name.trim().toLowerCase());
}

// ─── Donjons & succès : anti-résurrection (backlog ⑥, 27/09/2026) ────────────
//
// 🐛 Mesure : le **seed de déploiement** (`prisma/seed-data/seed.ts`, upsert par `(name, bossName)`)
// et le **siphon d'anomalie** (`anomaly-boss-siphon.ts`) recréaient tout ce qu'ils trouvaient —
// une suppression à la main était annulée à la passe suivante (constaté : donjons d'anomalie en
// DOUBLE — `/boss/qilby-2` et `/boss/agonie-la-deterree-2` dans le sitemap — et le pseudo-succès
// « Donjon validé » impossible à supprimer). Ces listes sont la mémoire de ce que le God a
// supprimé : **les siphons et les seeds les respectent**.
//
// Même format que `ignored-bounties.json` (`{ entries: [...] }`) : lisible et versionnable.

/** Donjon exclu : la clé métier est `(name, bossName)` — la clé unique du modèle Prisma. */
export interface IgnoredDungeonEntry {
    name: string;
    bossName: string;
    /** Slug public (`/boss/<slug>`) — affichage/robustesse, jamais la clé. */
    slug?: string | null;
    dofusdbId?: number | null;
    deletedAt?: string | null;
}

interface IgnoredFileEntries<T> {
    entries: T[];
    updatedAt?: string | null;
}

/** Normalisation de comparaison (accents, casse, ponctuation) : mêmes règles que les siphons. */
function normKey(value: unknown): string {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "");
}

/** Clé d'identité d'un donjon (stable entre le seed, le siphon et les actions God). */
export function dungeonIgnoreKey(name: unknown, bossName: unknown): string {
    return `${normKey(name)}::${normKey(bossName)}`;
}

/**
 * Normalisation d'un **slug** de succès : minuscules, accents retirés, séparateurs unifiés.
 * Indispensable : `slugify` côté God produit `donjon-validé` pour « Donjon validé » alors que le
 * pseudo-succès système est `donjon-valide` — sans cette normalisation, la suppression n'était pas
 * reconnue (mesuré : `"Donjon-Validé".toLowerCase()` conserve le `é`).
 */
export function normalizeSlugKey(value: unknown): string {
    return String(value ?? "")
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

/** Parse **tolérant** un fichier d'exclusions `{ entries: [...] }` (absent/corrompu ⇒ `[]`). */
function readEntriesFile<T>(filePath: string, normalize: (entries: unknown) => T[]): T[] {
    try {
        if (!fs.existsSync(filePath)) return [];
        const raw = JSON.parse(fs.readFileSync(filePath, "utf-8"));
        return normalize(Array.isArray(raw) ? raw : (raw as IgnoredFileEntries<unknown>)?.entries);
    } catch {
        // fail-open : une liste illisible ne doit pas bloquer un siphon (comme les familles/zones)
        return [];
    }
}

/** Écrit un fichier d'exclusions (jamais bloquant : une écriture en échec est signalée). */
function writeEntriesFile<T>(filePath: string, entries: T[]): T[] {
    try {
        const payload: IgnoredFileEntries<T> = { entries, updatedAt: new Date().toISOString() };
        fs.writeFileSync(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    } catch (error) {
        // Pas de `logger` ici : ce module est importé par le bundle des seeds (hors chaîne Next).
        console.error("[game-data-ignores] écriture impossible:", String(error));
    }
    return entries;
}

/** Normalise une liste de donjons exclus (dédoublonnée par clé, ordre stable). */
export function normalizeIgnoredDungeons(entries: unknown): IgnoredDungeonEntry[] {
    const byKey = new Map<string, IgnoredDungeonEntry>();
    for (const raw of Array.isArray(entries) ? entries : []) {
        const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
        const name = String(item?.name ?? "").trim();
        const bossName = String(item?.bossName ?? "").trim();
        if (!name || !bossName) continue;
        const dofusdbId = Math.floor(Number(item?.dofusdbId) || 0);
        const key = dungeonIgnoreKey(name, bossName);
        const previous = byKey.get(key);
        // Fusion : on garde le premier libellé (l'intention d'origine) et on n'égare aucun id/slug.
        byKey.set(key, {
            name: previous?.name ?? name,
            bossName: previous?.bossName ?? bossName,
            slug: previous?.slug ?? (item?.slug != null ? String(item.slug).trim() || null : null),
            dofusdbId: previous?.dofusdbId ?? (dofusdbId > 0 ? dofusdbId : null),
            deletedAt: item?.deletedAt != null ? String(item.deletedAt) : (previous?.deletedAt ?? null),
        });
    }
    return [...byKey.values()].sort((a, b) =>
        dungeonIgnoreKey(a.name, a.bossName).localeCompare(dungeonIgnoreKey(b.name, b.bossName))
    );
}

/** Donjons exclus du seed et du siphon (`public/game-data/ignored-dungeons.json`). */
export function getIgnoredDungeons(): IgnoredDungeonEntry[] {
    return readEntriesFile(IGNORED_DUNGEONS_PATH, normalizeIgnoredDungeons);
}

/** Exclut un donjon (idempotent) — appelé par la suppression God. */
export function addIgnoredDungeon(entry: {
    name: string;
    bossName: string;
    slug?: string | null;
    dofusdbId?: number | null;
}): IgnoredDungeonEntry[] {
    const key = dungeonIgnoreKey(entry?.name, entry?.bossName);
    if (key === "::") return getIgnoredDungeons();
    const current = getIgnoredDungeons().filter((e) => dungeonIgnoreKey(e.name, e.bossName) !== key);
    const dofusdbId = Math.floor(Number(entry?.dofusdbId) || 0);
    return writeEntriesFile(IGNORED_DUNGEONS_PATH, [
        ...current,
        {
            name: String(entry?.name ?? "").trim(),
            bossName: String(entry?.bossName ?? "").trim(),
            slug: entry?.slug != null ? String(entry.slug).trim() || null : null,
            dofusdbId: dofusdbId > 0 ? dofusdbId : null,
            deletedAt: new Date().toISOString(),
        },
    ]);
}

/** Réintègre un donjon (le prochain seed/siphon peut le recréer) — retourne la liste restante. */
export function removeIgnoredDungeon(entry: { name: string; bossName: string }): IgnoredDungeonEntry[] {
    const key = dungeonIgnoreKey(entry?.name, entry?.bossName);
    return writeEntriesFile(
        IGNORED_DUNGEONS_PATH,
        getIgnoredDungeons().filter((e) => dungeonIgnoreKey(e.name, e.bossName) !== key)
    );
}

/** Un donjon est-il exclu ? (`ignored` évite une relecture disque dans une boucle.) */
export function isIgnoredDungeon(
    dungeon: { name?: string | null; bossName?: string | null },
    ignored?: IgnoredDungeonEntry[]
): boolean {
    const key = dungeonIgnoreKey(dungeon?.name, dungeon?.bossName);
    if (key === "::") return false;
    return (ignored ?? getIgnoredDungeons()).some((e) => dungeonIgnoreKey(e.name, e.bossName) === key);
}

/** Succès exclu : la clé métier est le `slug` (stable, dérivé du nom). */
export interface IgnoredChallengeEntry {
    slug: string;
    name?: string | null;
    deletedAt?: string | null;
}

/** Normalise une liste de succès exclus (accepte `{ slug }` ou un slug nu, dédoublonné). */
export function normalizeIgnoredChallenges(entries: unknown): IgnoredChallengeEntry[] {
    const bySlug = new Map<string, IgnoredChallengeEntry>();
    for (const raw of Array.isArray(entries) ? entries : []) {
        const item = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : null;
        const slug = normalizeSlugKey(item?.slug ?? (typeof raw === "string" ? raw : ""));
        if (!slug) continue;
        const previous = bySlug.get(slug);
        bySlug.set(slug, {
            slug,
            name: (item?.name != null ? String(item.name).trim() || null : null) ?? previous?.name ?? null,
            deletedAt: (item?.deletedAt != null ? String(item.deletedAt) : null) ?? previous?.deletedAt ?? null,
        });
    }
    return [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
}

/** Succès exclus du seed et des garanties de pseudo-succès (`ignored-challenges.json`). */
export function getIgnoredChallenges(): IgnoredChallengeEntry[] {
    return readEntriesFile(IGNORED_CHALLENGES_PATH, normalizeIgnoredChallenges);
}

/** Exclut un succès (idempotent) — appelé par la suppression God. */
export function addIgnoredChallenge(slug: string, name?: string | null): IgnoredChallengeEntry[] {
    const key = normalizeSlugKey(slug);
    if (!key) return getIgnoredChallenges();
    const current = getIgnoredChallenges().filter((e) => e.slug !== key);
    return writeEntriesFile(IGNORED_CHALLENGES_PATH, [
        ...current,
        { slug: key, name: name != null ? String(name).trim() || null : null, deletedAt: new Date().toISOString() },
    ]);
}

/** Réintègre un succès (recréable par le seed, ou immédiatement par `ensureNoAchievement…`). */
export function removeIgnoredChallenge(slug: string): IgnoredChallengeEntry[] {
    const key = normalizeSlugKey(slug);
    return writeEntriesFile(
        IGNORED_CHALLENGES_PATH,
        getIgnoredChallenges().filter((e) => e.slug !== key)
    );
}

/** Un succès est-il exclu ? (`ignored` évite une relecture disque dans une boucle.) */
export function isIgnoredChallenge(slug?: string | null, ignored?: IgnoredChallengeEntry[]): boolean {
    const key = normalizeSlugKey(slug);
    if (!key) return false;
    return (ignored ?? getIgnoredChallenges()).some((e) => e.slug === key);
}
