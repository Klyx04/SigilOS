/**
 * Veille des **classes Dofus** — partie pure (aucun accès réseau, disque ou DB).
 *
 * Deux sources, une seule vérité :
 *  · **prod** (`api.dofusdb.fr`) = ce qui est live en jeu ; une classe live n'est
 *    jamais remplacée par un snapshot bêta plus récent ;
 *  · **bêta** (`api.beta.dofusdb.fr`) = aperçu, parfois en avance, parfois incomplet
 *    jusqu'à la sortie officielle. Une classe qui n'existe qu'en bêta est `preview`.
 *
 * Le manifeste est un **instantané daté** : il ne supprime jamais une classe. Une
 * disparition devient `retired` + une entrée `REMOVED` dans le journal, jamais un
 * `DELETE`. Le code jouable (`DOFUS_CLASSES`) reste une décision humaine : le veilleur
 * détecte, télécharge les assets et alerte, il n'édite pas un bundle client.
 */

import { DOFUS_CLASSES } from "@/lib/dofus-assets";
import type { DofusDbSource } from "@/lib/dofusdb-fetch";

export const CLASS_CATALOG_VERSION = 1 as const;

export type ClassLifecycle = "live" | "preview" | "retired";
export type ClassCatalogChangeType = "NEW" | "MODIFIED" | "REMOVED";
export type ClassCatalogChangeScope = DofusDbSource | "code" | "status" | "all" | "mixed";

export interface ClassBreedSnapshot {
    breed: number;
    name: string;
    slug: string;
    /** URL distante du symbole (DofusDB prod ou bêta). */
    iconUrl: string | null;
    /** Nombre de sorts du breed (`breedSpellsId.length`) : 22 pour une classe complète. */
    spellCount: number;
    /** Date de la dernière observation de CE snapshot. */
    seenAt: string;
}

export interface ClassCatalogEntry {
    breed: number;
    slug: string;
    name: string;
    status: ClassLifecycle;
    /** La classe est-elle dans `DOFUS_CLASSES` (donc sélectionnable dans l'app) ? */
    inCode: boolean;
    /** Id stable du code (`bellaphone`) quand `inCode`. */
    codeId: string | null;
    /** Ordre Dofusbook (Forgelance 19, Bellaphone 20) quand `inCode`. */
    codeDofusbookId: number | null;
    /** Icône locale : statique du dépôt, ou WebP téléchargé dans le volume. */
    localIcon: string | null;
    prod: ClassBreedSnapshot | null;
    beta: ClassBreedSnapshot | null;
    firstSeenAt: string;
    lastSeenAt: string;
    lastProdSeenAt: string | null;
    lastBetaSeenAt: string | null;
}

export interface ClassCatalogManifest {
    version: typeof CLASS_CATALOG_VERSION;
    generatedAt: string;
    /** Nombre de breeds renvoyées par chaque source (0 si la source est indisponible). */
    prodTotal: number;
    betaTotal: number;
    classes: ClassCatalogEntry[];
    /** Classes du code qui manquent dans leur source attendue (prod, ou bêta si preview). */
    codeMissingFromSources: string[];
}

export interface ClassCatalogChange {
    entityId: string;
    entityName: string;
    changeType: ClassCatalogChangeType;
    scope: ClassCatalogChangeScope;
    fields: Record<string, { before: unknown; after: unknown }>;
}

export interface ClassCatalogDiff {
    changes: ClassCatalogChange[];
    newLive: string[];
    newPreview: string[];
    modified: string[];
    removed: string[];
    missingFromCode: string[];
}

/** Normalise un libellé en slug stable (`Bellaphone` → `bellaphone`). */
export function classSlug(name: string): string {
    return String(name)
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function pickName(row: any): string {
    const candidates = [
        row?.shortName?.fr,
        row?.shortName?.en,
        row?.name?.fr,
        row?.name?.en,
        row?.shortName?.es,
        row?.name?.es,
    ];
    for (const candidate of candidates) {
        if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    }
    return "";
}

function iconUrlFor(row: any, breed: number, source: DofusDbSource): string {
    if (typeof row?.img === "string" && /^https?:\/\//i.test(row.img)) return row.img;
    const base = source === "beta" ? "https://api.beta.dofusdb.fr" : "https://api.dofusdb.fr";
    return `${base}/img/breeds/symbol_${breed}.png`;
}

/**
 * Normalise une ligne `/breeds` DofusDB. Retourne `null` pour une ligne inexploitable
 * (id absent, nom vide) : on ne fabrique jamais une classe de toutes pièces.
 */
export function normalizeBreedSnapshot(
    row: unknown,
    source: DofusDbSource,
    seenAt: string,
): ClassBreedSnapshot | null {
    const r = (row ?? {}) as Record<string, any>;
    const breed = Number(r.id ?? r.m_id);
    if (!Number.isInteger(breed) || breed <= 0) return null;
    const name = pickName(r);
    if (!name) return null;
    return {
        breed,
        name,
        slug: classSlug(name),
        iconUrl: iconUrlFor(r, breed, source),
        spellCount: Array.isArray(r.breedSpellsId) ? r.breedSpellsId.length : 0,
        seenAt,
    };
}

function codeClassForBreed(breed: number): (typeof DOFUS_CLASSES)[number] | undefined {
    return DOFUS_CLASSES.find((c) => c.breed === breed);
}

function isPreviewCodeClass(cls: (typeof DOFUS_CLASSES)[number] | undefined): boolean {
    return !!cls && "preview" in cls && cls.preview === true;
}

function localIconFor(breed: number, inCode: boolean, codeIcon: string | null, previous?: ClassCatalogEntry): string | null {
    if (inCode && codeIcon) return codeIcon;
    return previous?.localIcon ?? `/uploads/assets-dofus/classes/${breed}.webp`;
}

/**
 * Construit le prochain manifeste.
 *
 * ⚠️ `prodRows` ne doit **jamais** être vide : une source prod vide est une panne,
 * pas une suppression de 20 classes. L'appelant doit refuser d'appeler cette fonction
 * dans ce cas. `betaRows === null` signifie « bêta indisponible » : les snapshots
 * bêta précédents sont conservés tels quels, aucune classe n'est retirée pour ça.
 */
export function buildClassCatalogManifest(input: {
    previous: ClassCatalogManifest | null;
    prodRows: readonly unknown[];
    betaRows: readonly unknown[] | null;
    now: string;
}): ClassCatalogManifest {
    const { previous, prodRows, betaRows, now } = input;
    if (prodRows.length === 0) {
        throw new Error("DofusDB prod a renvoyé 0 classe : refus de construire un manifeste vide");
    }
    const betaAvailable = betaRows !== null;

    const prodMap = new Map<number, ClassBreedSnapshot>();
    for (const row of prodRows) {
        const snap = normalizeBreedSnapshot(row, "prod", now);
        if (snap) prodMap.set(snap.breed, snap);
    }
    const betaMap = new Map<number, ClassBreedSnapshot>();
    for (const row of betaRows ?? []) {
        const snap = normalizeBreedSnapshot(row, "beta", now);
        if (snap) betaMap.set(snap.breed, snap);
    }

    const previousByBreed = new Map<number, ClassCatalogEntry>(
        (previous?.classes ?? []).map((entry) => [entry.breed, entry]),
    );
    const breeds = new Set<number>([
        ...previousByBreed.keys(),
        ...prodMap.keys(),
        ...betaMap.keys(),
    ]);

    const classes: ClassCatalogEntry[] = [];
    for (const breed of [...breeds].sort((a, b) => a - b)) {
        const prev = previousByBreed.get(breed);
        const prod = prodMap.get(breed) ?? null;
        // Bêta indisponible : on garde le snapshot précédent, sans le dater à tort.
        const beta = betaAvailable ? betaMap.get(breed) ?? null : prev?.beta ?? null;
        const resolved = prod ?? beta;
        if (!resolved && !prev) continue;

        const code = codeClassForBreed(breed);
        const inCode = !!code;
        const name = resolved?.name ?? prev?.name ?? `Classe ${breed}`;
        const slug = resolved?.slug ?? prev?.slug ?? classSlug(name);
        const status: ClassLifecycle = prod ? "live" : beta ? "preview" : "retired";
        const localIcon = localIconFor(breed, inCode, code?.icon ?? null, prev);

        classes.push({
            breed,
            slug,
            name,
            status,
            inCode,
            codeId: code?.id ?? null,
            codeDofusbookId: code?.dofusbookId ?? null,
            localIcon,
            prod,
            beta,
            firstSeenAt: prev?.firstSeenAt ?? now,
            lastSeenAt: prod || beta ? now : prev?.lastSeenAt ?? now,
            lastProdSeenAt: prod ? now : prev?.lastProdSeenAt ?? null,
            lastBetaSeenAt: beta ? now : prev?.lastBetaSeenAt ?? null,
        });
    }

    const codeMissingFromSources = DOFUS_CLASSES.filter((cls) => {
        if (prodMap.has(cls.breed)) return false;
        if (isPreviewCodeClass(cls)) {
            // Une preview doit être en bêta ; bêta indisponible ⇒ on ne crie pas.
            return betaAvailable && !betaMap.has(cls.breed);
        }
        return true;
    }).map((cls) => cls.id);

    return {
        version: CLASS_CATALOG_VERSION,
        generatedAt: now,
        prodTotal: prodMap.size,
        betaTotal: betaMap.size,
        classes,
        codeMissingFromSources,
    };
}

function snapshotFields(
    prefix: "prod" | "beta",
    before: ClassBreedSnapshot | null,
    after: ClassBreedSnapshot | null,
    add: (key: string, before: unknown, after: unknown) => void,
) {
    if (!before && !after) return;
    if (!before || !after) {
        add(prefix, before, after);
        return;
    }
    for (const key of ["name", "slug", "iconUrl", "spellCount"] as const) {
        if (before[key] !== after[key]) add(`${prefix}.${key}`, before[key], after[key]);
    }
}

/**
 * Diff pure entre deux manifestes. Aucune entrée n'est inventée : les champs
 * `before/after` ne portent que ce qui a changé. Le premier passage (previous
 * `null`) est une **baseline** : aucun bruit « 20 nouvelles classes ».
 */
export function diffClassCatalog(
    previous: ClassCatalogManifest | null,
    next: ClassCatalogManifest,
): ClassCatalogDiff {
    const changes: ClassCatalogChange[] = [];
    const newLive: string[] = [];
    const newPreview: string[] = [];
    const modified: string[] = [];
    const removed: string[] = [];
    const missingFromCode: string[] = [];

    if (!previous) {
        return { changes, newLive, newPreview, modified, removed, missingFromCode };
    }

    const prevByBreed = new Map(previous.classes.map((entry) => [entry.breed, entry]));
    for (const entry of next.classes) {
        const prev = prevByBreed.get(entry.breed);
        if (!prev) {
            changes.push({
                entityId: String(entry.breed),
                entityName: entry.name,
                changeType: "NEW",
                scope: "all",
                fields: {
                    breed: { before: null, after: entry.breed },
                    name: { before: null, after: entry.name },
                    status: { before: null, after: entry.status },
                    inCode: { before: null, after: entry.inCode },
                },
            });
            if (entry.status === "preview") newPreview.push(entry.name);
            else newLive.push(entry.name);
            if (!entry.inCode) missingFromCode.push(`${entry.name} (${entry.breed})`);
            continue;
        }

        const fields: Record<string, { before: unknown; after: unknown }> = {};
        const scopes = new Set<ClassCatalogChangeScope>();
        const add = (key: string, before: unknown, after: unknown) => {
            fields[key] = { before, after };
        };

        snapshotFields("prod", prev.prod, entry.prod, add);
        snapshotFields("beta", prev.beta, entry.beta, add);
        if (prev.prod || entry.prod) scopes.add("prod");
        if (prev.beta || entry.beta) scopes.add("beta");

        const codeChanged =
            prev.inCode !== entry.inCode
            || prev.codeId !== entry.codeId
            || prev.codeDofusbookId !== entry.codeDofusbookId;
        if (codeChanged) {
            scopes.add("code");
            add("inCode", prev.inCode, entry.inCode);
            add("codeId", prev.codeId, entry.codeId);
            add("codeDofusbookId", prev.codeDofusbookId, entry.codeDofusbookId);
        }

        if (prev.status !== entry.status) {
            if (entry.status === "retired" && prev.status !== "retired") {
                changes.push({
                    entityId: String(entry.breed),
                    entityName: entry.name,
                    changeType: "REMOVED",
                    scope: "status",
                    fields: { status: { before: prev.status, after: entry.status } },
                });
                removed.push(entry.name);
                continue;
            }
            scopes.add("status");
            add("status", prev.status, entry.status);
        }

        if (Object.keys(fields).length === 0) continue;

        const scope: ClassCatalogChangeScope =
            scopes.size === 0 ? "all" : scopes.size > 1 ? "mixed" : [...scopes][0];
        changes.push({
            entityId: String(entry.breed),
            entityName: entry.name,
            changeType: "MODIFIED",
            scope,
            fields,
        });
        modified.push(entry.name);
        if (!entry.inCode) missingFromCode.push(`${entry.name} (${entry.breed})`);
    }

    return { changes, newLive, newPreview, modified, removed, missingFromCode };
}

/** Résumé court pour la notification God / le log du cron. */
export function summarizeClassCatalogDiff(diff: ClassCatalogDiff, manifest: ClassCatalogManifest): string {
    const parts: string[] = [];
    if (diff.newLive.length) parts.push(`${diff.newLive.length} nouvelle(s) live (${diff.newLive.join(", ")})`);
    if (diff.newPreview.length) parts.push(`${diff.newPreview.length} preview bêta (${diff.newPreview.join(", ")})`);
    if (diff.modified.length) parts.push(`${diff.modified.length} modifiée(s) (${diff.modified.join(", ")})`);
    if (diff.removed.length) parts.push(`${diff.removed.length} retirée(s) (${diff.removed.join(", ")})`);
    if (diff.missingFromCode.length) parts.push(`${diff.missingFromCode.length} hors code (${diff.missingFromCode.join(", ")})`);
    if (manifest.codeMissingFromSources.length) {
        parts.push(`${manifest.codeMissingFromSources.length} classe(s) du code absente(s) de la source`);
    }
    return parts.length > 0 ? parts.join(" · ") : "Aucun changement";
}
